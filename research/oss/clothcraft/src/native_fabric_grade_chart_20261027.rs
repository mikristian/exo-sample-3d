//! Persisted, explicitly sourced measurement limits. Limits are independent of fabric stretch.
use crate::{fitting::{FittingProject, NativeDraftMeasurement, NativeDraftPointBindings, PersistedGradeRun}, garment::GarmentTemplate};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

const SIZES: [&str; 6] = ["XS", "S", "M", "L", "XL", "XXL"];

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
pub struct FabricGradeBounds { pub min_mm: f64, pub max_mm: f64 }

/// A cell contains an independently supplied, per-size direct input and a
/// materialized result. Formula strings always come from the saved native
/// binding graph: callers cannot inject a different expression for a size.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
pub struct FabricGradeMeasurementCell {
    pub value_mm: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub direct_input_mm: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
pub struct FabricGradeSizeChart {
    pub provenance: String,
    pub source_measurements: BTreeMap<String, NativeDraftMeasurement>,
    pub values: BTreeMap<String, BTreeMap<String, FabricGradeMeasurementCell>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
pub struct PersistedFabricGradeEnvelope {
    pub schema_version: u32,
    pub provenance: String,
    pub fabric_id: String,
    pub source_template: GarmentTemplate,
    pub measurements: BTreeMap<String, BTreeMap<String, FabricGradeBounds>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub per_size_chart: Option<FabricGradeSizeChart>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub physical_pom_bounds: BTreeMap<String, BTreeMap<String, FabricGradeBounds>>,
}

impl PersistedFabricGradeEnvelope {
    pub fn validate(&self, project: &FittingProject) -> Result<(), String> {
        if self.schema_version != 1 || self.provenance.trim().is_empty()
            || self.provenance.len() > 512 || self.provenance.chars().any(char::is_control)
            || self.measurements.is_empty() || self.measurements.len()>64
            || serde_json::to_vec(self).map_err(|e|e.to_string())?.len()>3_000_000 {
            return Err("Invalid fabric grade envelope schema, provenance or dimensions".into());
        }
        let same = |a:&GarmentTemplate,b:&GarmentTemplate| -> Result<bool,String> {
            Ok(serde_json::to_value(a).map_err(|e|e.to_string())?
                ==serde_json::to_value(b).map_err(|e|e.to_string())?)
        };
        if !same(&self.source_template,&project.template)? {
            return Err("Stale fabric grade envelope source template".into());
        }
        if self.fabric_id.trim().is_empty() || project.template.fabrics.iter()
            .filter(|fabric|fabric.id==self.fabric_id).count()!=1 {
            return Err("Fabric grade envelope requires a unique source fabric id".into());
        }
        let run = project.grade_run.as_ref().ok_or("Fabric grade envelope requires saved six-size catalog")?;
        run.validate(&project.template)?;
        if run.sizes.iter().map(String::as_str).collect::<Vec<_>>() != SIZES {
            return Err("Fabric envelope requires exact XS through XXL coverage".into());
        }
        let graph=project.native_point_bindings.as_ref().ok_or("Fabric envelope requires saved native point bindings")?;
        graph.valid_against(&project.template)?;
        if !graph.source_matches(&project.template) {
            return Err("Stale native binding source for fabric envelope".into());
        }
        if self.measurements.keys().ne(graph.measurements.keys()) {
            return Err("Fabric grade envelope must cover every native measurement".into());
        }
        for (name, sizes) in &self.measurements {
            if !graph.measurements.contains_key(name) || sizes.len()!=6
                || !SIZES.iter().all(|size|sizes.contains_key(*size)) {
                return Err(format!("Fabric measurement {name} has incomplete six-size coverage or unknown source"));
            }
            for (size,bound) in sizes {
                if !bound.min_mm.is_finite() || !bound.max_mm.is_finite()
                    || bound.min_mm < -5000. || bound.max_mm > 5000.
                    || bound.min_mm > bound.max_mm {
                    return Err(format!("Invalid mm fabric bounds for {name} / {size}"));
                }
            }
        }
        self.enforce_measurements(graph,run,&BTreeMap::new())?;
        self.preflight_physical(project)
    }

    /// Compare independently authored physical allowances against actual persisted
    /// material geometry, including sampled curved edges and each graded size.
    /// An absent map is an old direct-measurement-only envelope.
    pub fn preflight_physical(&self, project: &FittingProject) -> Result<(), String> {
        if self.physical_pom_bounds.is_empty() { return Ok(()); }
        let run = project.grade_run.as_ref().ok_or("Physical POM envelope requires saved six-size catalog")?;
        run.validate(&project.template)?;
        if run.pom_specs.is_empty() || self.physical_pom_bounds.len() != run.pom_specs.len()
            || run.pom_specs.iter().any(|spec| !self.physical_pom_bounds.contains_key(&spec.id)) {
            return Err("Physical POM envelope must contain exactly every authored POM id".into());
        }
        for (id, sizes) in &self.physical_pom_bounds {
            if sizes.len() != SIZES.len() || !SIZES.iter().all(|size| sizes.contains_key(*size)) {
                return Err(format!("Physical POM {id} requires exact XS through XXL coverage"));
            }
            for (size, bound) in sizes {
                if !bound.min_mm.is_finite() || !bound.max_mm.is_finite()
                    || bound.min_mm < 0.0 || bound.max_mm > 100_000.0
                    || bound.min_mm > bound.max_mm {
                    return Err(format!("Invalid physical POM mm bounds for {id} / {size}"));
                }
            }
        }
        let report = crate::grade_pom_audit_20261027::audit_persisted_grade_pom20261027(project)?;
        let rows = report.get("rows").and_then(serde_json::Value::as_array)
            .ok_or("Physical POM audit missing measured rows")?;
        if rows.len() != run.pom_specs.len() * SIZES.len() {
            return Err("Physical POM audit has incomplete measurements".into());
        }
        let mut seen = std::collections::BTreeSet::new();
        for row in rows {
            let id = row.get("pomId").and_then(serde_json::Value::as_str)
                .ok_or("Physical POM audit missing id")?;
            let size = row.get("size").and_then(serde_json::Value::as_str)
                .ok_or("Physical POM audit missing size")?;
            let measured = row.get("measuredMm").and_then(serde_json::Value::as_f64)
                .ok_or("Physical POM audit missing actual measuredMm")?;
            let bound = self.physical_pom_bounds.get(id).and_then(|sizes| sizes.get(size))
                .ok_or_else(|| format!("Unbounded physical POM audit row: {id} / {size}"))?;
            if !seen.insert((id.to_owned(), size.to_owned())) || !measured.is_finite() {
                return Err(format!("Duplicate or nonfinite physical POM audit row: {id} / {size}"));
            }
            if measured < bound.min_mm - 1e-8 || measured > bound.max_mm + 1e-8 {
                return Err(format!("Physical POM envelope violation: {id} / {size}: {measured} mm outside [{}, {}] mm",bound.min_mm,bound.max_mm));
            }
        }
        if seen.len() != run.pom_specs.len() * SIZES.len() {
            return Err("Incomplete physical POM audit coverage".into());
        }
        Ok(())
    }

    fn enforce_measurements(&self, graph:&NativeDraftPointBindings,run:&PersistedGradeRun,
        overrides:&BTreeMap<String,f64>) -> Result<(),String> {
        if let Some(chart) = &self.per_size_chart {
            if chart.provenance.trim().is_empty() || chart.provenance.len()>512
                || chart.provenance.chars().any(char::is_control)
                || serde_json::to_value(&chart.source_measurements).map_err(|e|e.to_string())?
                    !=serde_json::to_value(&graph.measurements).map_err(|e|e.to_string())?
                || chart.values.keys().ne(graph.measurements.keys()) {
                return Err("Stale or forged per-size measurement chart source/provenance".into());
            }
            for size in &run.sizes {
                let mut sized_graph=graph.measurements.clone();
                for (name, cells) in &chart.values {
                    if cells.len()!=SIZES.len() || !SIZES.iter().all(|s|cells.contains_key(*s)) {
                        return Err(format!("Incomplete per-size measurement chart: {name}"));
                    }
                    let cell=&cells[size];
                    if !cell.value_mm.is_finite() || cell.value_mm.abs()>5000.
                        || cell.direct_input_mm.is_some_and(|n|!n.is_finite() || n.abs()>5000.) {
                        return Err(format!("Invalid per-size chart cell: {name} / {size}"));
                    }
                    match sized_graph.get_mut(name).ok_or("Unknown per-size measurement")? {
                        NativeDraftMeasurement::Number(n) => {
                            if size=="M" && cell.direct_input_mm.is_some_and(|value|(value-*n).abs()>1e-8) {
                                return Err(format!("Forged base M direct measurement: {name}"));
                            }
                            let authored=cell.direct_input_mm
                                .ok_or_else(||format!("Missing direct per-size input: {name} / {size}"))?;
                            let value=authored+overrides.get(name).map_or(0.,|override_mm|override_mm-*n);
                            if !value.is_finite() || value.abs()>5000. {
                                return Err(format!("Invalid rebased per-size input: {name} / {size}"));
                            }
                            *n=value;
                        },
                        NativeDraftMeasurement::Definition(d) if d.formula.is_none() => {
                            if size=="M" && cell.direct_input_mm.is_some_and(|value|d.value_mm.is_some_and(|n|(value-n).abs()>1e-8)) {
                                return Err(format!("Forged base M direct measurement: {name}"));
                            }
                            let authored=cell.direct_input_mm
                                .ok_or_else(||format!("Missing direct per-size input: {name} / {size}"))?;
                            let base=d.value_mm.ok_or("Missing authoritative native direct value")?;
                            let value=authored+overrides.get(name).map_or(0.,|override_mm|override_mm-base);
                            if !value.is_finite() || value.abs()>5000. {
                                return Err(format!("Invalid rebased per-size input: {name} / {size}"));
                            }
                            d.value_mm=Some(value);
                        },
                        NativeDraftMeasurement::Definition(_) if cell.direct_input_mm.is_some() =>
                            return Err(format!("Formula chart cell has forged direct input: {name} / {size}")),
                        NativeDraftMeasurement::Definition(_) => (),
                    }
                }
                let results=crate::native_measurement_formulas_20261027::evaluate_native_measurements_20261027(&sized_graph)?;
                for (name, cells) in &chart.values {
                    let measured=results[name];
                    if overrides.is_empty() && (measured-cells[size].value_mm).abs()>1e-8 {
                        return Err(format!("Stale per-size computed measurement: {name} / {size}"));
                    }
                    let bound=&self.measurements[name][size];
                    if measured < bound.min_mm-1e-8 || measured > bound.max_mm+1e-8 {
                        return Err(format!("Fabric grade envelope violation: {name} / {size}: {measured} mm outside [{}, {}] mm",bound.min_mm,bound.max_mm));
                    }
                }
            }
            return Ok(());
        }
        for (name,sizes) in &self.measurements {
            let v=overrides.get(name).copied().or_else(||match graph.measurements.get(name) {
                Some(NativeDraftMeasurement::Number(n))=>Some(*n),
                Some(NativeDraftMeasurement::Definition(d)) if d.formula.is_none()=>d.value_mm,
                _=>None,
            });
            // Formula-valued measurements cannot be bounded from the direct source alone.
            // Reject them rather than certifying unchecked six-size values.
            let mm=v.ok_or_else(||format!("Computed measurement {name} requires native per-size evaluator"))?;
            if !mm.is_finite() {return Err(format!("Nonfinite fabric measurement {name}"));}
            for size in &run.sizes {
                let bound=&sizes[size];
                if mm < bound.min_mm-1e-8 || mm > bound.max_mm+1e-8 {
                    return Err(format!("Fabric grade envelope violation: {name} / {size}: {mm} mm outside [{}, {}] mm",bound.min_mm,bound.max_mm));
                }
            }
        }
        Ok(())
    }

    pub fn preflight(&self, project:&FittingProject,overrides:&BTreeMap<String,f64>) -> Result<(),String> {
        self.validate(project)?;
        for name in overrides.keys() {
            if !self.measurements.contains_key(name) {return Err(format!("Fabric envelope missing measurement {name}"));}
        }
        self.enforce_measurements(project.native_point_bindings.as_ref().unwrap(),
            project.grade_run.as_ref().unwrap(),overrides)
    }

    pub fn rebase(&mut self,source:&GarmentTemplate) {self.source_template=source.clone();}

    /// Rebase an already validated chart after a native direct measurement edit.
    /// Every size retains its independently authored distance from base M.
    /// Formula identities cannot change as a side effect of regeneration.
    pub fn rebase_after_measurement_change(
        &mut self,old_graph:&NativeDraftPointBindings,new_graph:&NativeDraftPointBindings,
        source:&GarmentTemplate,
    )->Result<(),String>{
        let Some(chart)=self.per_size_chart.as_mut() else {
            self.rebase(source);
            return Ok(());
        };
        if chart.source_measurements.keys().ne(old_graph.measurements.keys())
            || new_graph.measurements.keys().ne(old_graph.measurements.keys())
            || serde_json::to_value(&chart.source_measurements).map_err(|e|e.to_string())?
                !=serde_json::to_value(&old_graph.measurements).map_err(|e|e.to_string())? {
            return Err("Stale native per-size chart source during rebase".into());
        }
        fn direct(value:&NativeDraftMeasurement)->Result<Option<f64>,String>{
            match value {
                NativeDraftMeasurement::Number(n)=>Ok(Some(*n)),
                NativeDraftMeasurement::Definition(d) if d.formula.is_none()=>Ok(d.value_mm),
                NativeDraftMeasurement::Definition(d) if d.value_mm.is_none()=>Ok(None),
                _=>Err("Unsupported formula/direct measurement transition".into()),
            }
        }
        let mut deltas=BTreeMap::new();
        for (name,before) in &old_graph.measurements {
            let after=&new_graph.measurements[name];
            match (direct(before)?,direct(after)?) {
                (Some(a),Some(b)) if a.is_finite() && b.is_finite()=>{
                    let delta=b-a;
                    if !delta.is_finite() || delta.abs()>5000. {return Err(format!("Invalid native direct measurement rebase: {name}"));}
                    deltas.insert(name.clone(),delta);
                },
                (None,None) => {
                    if serde_json::to_value(before).map_err(|e|e.to_string())?
                        !=serde_json::to_value(after).map_err(|e|e.to_string())? {
                        return Err(format!("Changed native formula identity: {name}"));
                    }
                },
                _=>return Err(format!("Unsupported formula/direct measurement transition: {name}")),
            }
        }
        if chart.values.keys().ne(old_graph.measurements.keys()) {
            return Err("Incomplete native per-size chart rebase".into());
        }
        for size in SIZES {
            let mut size_graph=new_graph.measurements.clone();
            for (name,cells) in &mut chart.values {
                if cells.len()!=6 || !SIZES.iter().all(|s|cells.contains_key(*s)) {
                    return Err(format!("Incomplete rebase coverage: {name}"));
                }
                let cell=cells.get_mut(size).ok_or("Missing native chart size")?;
                match size_graph.get_mut(name).ok_or("Missing native chart source")? {
                    NativeDraftMeasurement::Number(n)=>{
                        let old=cell.direct_input_mm.ok_or("Missing direct chart input")?;
                        let next=old+deltas[name];
                        if !next.is_finite() || next.abs()>5000. {return Err(format!("Out-of-range rebased chart input: {name} / {size}"));}
                        cell.direct_input_mm=Some(next);
                        *n=next;
                    },
                    NativeDraftMeasurement::Definition(d) if d.formula.is_none()=>{
                        let old=cell.direct_input_mm.ok_or("Missing direct chart input")?;
                        let next=old+deltas[name];
                        if !next.is_finite() || next.abs()>5000. {return Err(format!("Out-of-range rebased chart input: {name} / {size}"));}
                        cell.direct_input_mm=Some(next);
                        d.value_mm=Some(next);
                    },
                    NativeDraftMeasurement::Definition(_) if cell.direct_input_mm.is_some()=>
                        return Err("Forged formula direct input during rebase".into()),
                    NativeDraftMeasurement::Definition(_)=>(),
                }
            }
            let values=crate::native_measurement_formulas_20261027::evaluate_native_measurements_20261027(&size_graph)?;
            for (name,cells) in &mut chart.values {
                let measured=values[name];
                let bound=&self.measurements[name][size];
                if measured.abs()>5000. || measured<bound.min_mm-1e-8 || measured>bound.max_mm+1e-8 {
                    return Err(format!("Rebased fabric grade envelope violation: {name} / {size}"));
                }
                cells.get_mut(size).ok_or("Missing rebased size cell")?.value_mm=measured;
            }
        }
        chart.source_measurements=new_graph.measurements.clone();
        self.source_template=source.clone();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{fitting::{GradedPomSpec, NativeDraftPointRule}, garment::presets::GarmentKind};
    use std::path::PathBuf;

    fn fixture()->(FittingProject,PersistedFabricGradeEnvelope){
        let mut p=FittingProject::basic(GarmentKind::Tshirt,1,PathBuf::from("avatar.obj"));
        p.template.seams.clear();
        let sizes=SIZES.iter().map(|s|s.to_string()).collect();
        p.grade_run=Some(PersistedGradeRun{schema_version:1,sizes,base_size:"M".into(),
            base_template:p.template.clone(),graded_templates:vec![p.template.clone();6],size_correspondence: Default::default(), pom_specs:vec![]});
        p.native_point_bindings=Some(NativeDraftPointBindings{
            version:1,source_template:p.template.clone(),
            measurements:BTreeMap::from([("neck_distance".into(),NativeDraftMeasurement::Number(75.))]),
            bindings:vec![NativeDraftPointRule{id:"front-neck".into(),panel_id:"front".into(),
                point_index:1,mode:"polar".into(),a:0,b:0,distance_formula:"neck_distance".into(),
                angle_deg:Some(0.),depends_on:vec![]}],
        });
        let envelope=PersistedFabricGradeEnvelope{schema_version:1,
            provenance:"Author-supplied measured six-size allowances, 2026-10-27".into(),
            fabric_id:p.template.fabrics[0].id.clone(),
            source_template:p.template.clone(),
            measurements:BTreeMap::from([("neck_distance".into(),SIZES.iter().map(|s|(
                s.to_string(),FabricGradeBounds{min_mm:70.,max_mm:90.})).collect())]),
            per_size_chart:None,
            physical_pom_bounds:BTreeMap::new(),
        };
        (p,envelope)
    }

    #[test]
    fn six_size_direct_bounds_and_reopen(){
        let (mut p,mut e)=fixture();
        // Isolate the XL guard rather than letting the identical XS limit
        // reject the same 95 mm input first. This verifies size identity.
        for size in ["XS", "S", "M", "L"] {
            e.measurements.get_mut("neck_distance").unwrap().get_mut(size).unwrap().max_mm=100.;
        }
        e.validate(&p).unwrap();
        e.preflight(&p,&BTreeMap::from([("neck_distance".into(),85.)])).unwrap();
        assert!(e.preflight(&p,&BTreeMap::from([("neck_distance".into(),95.)])).unwrap_err().contains("neck_distance"));
        p.fabric_grade_envelope=Some(e);
        let reopened:FittingProject=serde_json::from_value(serde_json::to_value(&p).unwrap()).unwrap();
        reopened.fabric_grade_envelope.as_ref().unwrap().validate(&reopened).unwrap();
    }

    #[test]
    fn forged_source_and_incomplete_six_sizes_rejected(){
        let (p,mut e)=fixture();
        e.measurements.get_mut("neck_distance").unwrap().remove("XL");
        assert!(e.validate(&p).is_err());
        let (_,mut e)=fixture();
        e.source_template.panels[0].name.push_str(" forged");
        assert!(e.validate(&p).unwrap_err().contains("Stale"));
        let (_,mut e)=fixture();
        e.provenance.clear();
        assert!(e.validate(&p).is_err());
    }

    fn physical_fixture()->(FittingProject,PersistedFabricGradeEnvelope) {
        let (mut project,mut envelope)=fixture();
        let panel=project.template.panels.iter().find(|panel|panel.polygon.is_some()).unwrap();
        let polygon=panel.polygon.as_ref().unwrap();
        let measured=polygon.points[0].distance(polygon.points[1])*1000.;
        let pom=GradedPomSpec {
            id:"width".into(),label:"Physical width".into(),panel_id:panel.id.clone(),
            kind:"anchor-distance".into(),tolerance_mm:0.01,
            from_point:Some(0),to_point:Some(1),edge:None,
            // Intentionally unscored: bounds are authoritative independently of targets.
            targets_mm:SIZES.iter().map(|size|(size.to_string(),None)).collect(),
        };
        project.grade_run.as_mut().unwrap().pom_specs=vec![pom];
        envelope.physical_pom_bounds=BTreeMap::from([("width".into(),SIZES.iter().map(|size|(
            size.to_string(),FabricGradeBounds{min_mm:measured-1.,max_mm:measured+1.})).collect())]);
        (project,envelope)
    }

    #[test]
    fn actual_six_size_physical_pom_bounds_survive_reopen_without_targets(){
        let (mut project,envelope)=physical_fixture();
        envelope.validate(&project).unwrap();
        let encoded=serde_json::to_value(&envelope).unwrap();
        assert!(encoded.get("physicalPomBounds").is_some());
        project.fabric_grade_envelope=Some(envelope);
        let reopened:FittingProject=serde_json::from_value(serde_json::to_value(&project).unwrap()).unwrap();
        reopened.fabric_grade_envelope.as_ref().unwrap().validate(&reopened).unwrap();
    }

    #[test]
    fn forged_graded_physical_geometry_rejected_even_if_targets_unscored(){
        let (mut project,envelope)=physical_fixture();
        let run=project.grade_run.as_mut().unwrap();
        let polygon=run.graded_templates[4].panels.iter_mut().find_map(|p|p.polygon.as_mut()).unwrap();
        polygon.points[1].x+=0.025;
        let err=envelope.validate(&project).unwrap_err();
        assert!(err.contains("width / XL"),"{err}");
    }

    #[test]
    fn physical_pom_missing_unknown_and_invalid_bounds_fail_closed(){
        let (project,mut envelope)=physical_fixture();
        envelope.physical_pom_bounds.get_mut("width").unwrap().remove("XL");
        assert!(envelope.validate(&project).unwrap_err().contains("coverage"));
        let (_,mut envelope)=physical_fixture();
        envelope.physical_pom_bounds.insert("unknown".into(),envelope.physical_pom_bounds["width"].clone());
        assert!(envelope.validate(&project).unwrap_err().contains("exactly every"));
        let (_,mut envelope)=physical_fixture();
        envelope.physical_pom_bounds.get_mut("width").unwrap().get_mut("XS").unwrap().min_mm=f64::NAN;
        assert!(envelope.validate(&project).unwrap_err().contains("Invalid physical"));
    }

    #[test]
    fn old_direct_only_envelope_deserializes_with_no_physical_claim(){
        let (project,envelope)=fixture();
        let json=serde_json::to_value(&envelope).unwrap();
        assert!(json.get("physicalPomBounds").is_none());
        assert!(json.get("perSizeChart").is_none());
        let old:PersistedFabricGradeEnvelope=serde_json::from_value(json).unwrap();
        assert!(old.physical_pom_bounds.is_empty());
        old.validate(&project).unwrap();
    }

    fn chart_fixture()->(FittingProject,PersistedFabricGradeEnvelope) {
        use crate::fitting::NativeDraftMeasurementDefinition as Def;
        let (mut project,mut envelope)=fixture();
        let graph=project.native_point_bindings.as_mut().unwrap();
        graph.measurements.insert("neck_with_ease".into(),NativeDraftMeasurement::Definition(Def{
            formula:Some("neck_distance + 5".into()),value_mm:None}));
        envelope.measurements.insert("neck_with_ease".into(),SIZES.iter().map(|size|(
            size.to_string(),FabricGradeBounds{min_mm:70.,max_mm:110.})).collect());
        let values=BTreeMap::from([
            ("neck_distance".into(),SIZES.iter().enumerate().map(|(i,size)|(
                size.to_string(),FabricGradeMeasurementCell{value_mm:73.+i as f64,
                    direct_input_mm:Some(73.+i as f64)})).collect()),
            ("neck_with_ease".into(),SIZES.iter().enumerate().map(|(i,size)|(
                size.to_string(),FabricGradeMeasurementCell{value_mm:78.+i as f64,
                    direct_input_mm:None})).collect()),
        ]);
        envelope.per_size_chart=Some(FabricGradeSizeChart{provenance:"Independent per-size authored chart".into(),
            source_measurements:graph.measurements.clone(),values});
        (project,envelope)
    }

    #[test]
    fn per_size_direct_and_formula_evaluation_and_json_reopen(){
        let (mut project,envelope)=chart_fixture();
        envelope.validate(&project).unwrap();
        let error=envelope.preflight(&project,&BTreeMap::from([("neck_distance".into(),95.)])).unwrap_err();
        assert!(error.contains("neck_distance") || error.contains("neck_with_ease"),"{error}");
        project.fabric_grade_envelope=Some(envelope);
        let opened:FittingProject=serde_json::from_value(serde_json::to_value(&project).unwrap()).unwrap();
        opened.fabric_grade_envelope.as_ref().unwrap().validate(&opened).unwrap();
    }

    #[test]
    fn chart_rebase_updates_all_six_direct_and_derived_values(){
        let (mut project,mut envelope)=chart_fixture();
        envelope.validate(&project).unwrap();
        let old=project.native_point_bindings.as_ref().unwrap().clone();
        let mut new=old.clone();
        new.measurements.insert("neck_distance".into(),NativeDraftMeasurement::Number(77.));
        envelope.rebase_after_measurement_change(&old,&new,&project.template).unwrap();
        project.native_point_bindings=Some(new);
        envelope.validate(&project).unwrap();
        let chart=envelope.per_size_chart.as_ref().unwrap();
        assert_eq!(chart.values["neck_distance"]["M"].value_mm,77.);
        assert_eq!(chart.values["neck_with_ease"]["XL"].value_mm,84.);
        let before=serde_json::to_value(&envelope).unwrap();
        let opened:PersistedFabricGradeEnvelope=serde_json::from_value(before.clone()).unwrap();
        assert_eq!(serde_json::to_value(opened).unwrap(),before);
    }

    #[test]
    fn preflight_applies_base_edit_as_delta_per_size_and_rechecks_formulas(){
        let (project,mut envelope)=chart_fixture();
        envelope.measurements.get_mut("neck_distance").unwrap().get_mut("XS").unwrap().max_mm=76.;
        envelope.measurements.get_mut("neck_with_ease").unwrap().get_mut("XS").unwrap().max_mm=81.;
        envelope.validate(&project).unwrap();
        // Base M 75 -> 77: XS 73 -> 75, formula XS 78 -> 80.
        envelope.preflight(&project,&BTreeMap::from([("neck_distance".into(),77.)])).unwrap();
        // Base M 75 -> 79: XS 73 -> 77, which breaches XS-only bounds.
        let error=envelope.preflight(&project,&BTreeMap::from([("neck_distance".into(),79.)])).unwrap_err();
        assert!(error.contains("/ XS"),"{error}");
    }

    #[test]
    fn per_size_chart_fails_closed_on_missing_forged_stale_or_cycle(){
        let (project,mut envelope)=chart_fixture();
        envelope.per_size_chart.as_mut().unwrap().values.get_mut("neck_distance").unwrap().remove("XL");
        assert!(envelope.validate(&project).unwrap_err().contains("Incomplete"));
        let (_,mut envelope)=chart_fixture();
        envelope.per_size_chart.as_mut().unwrap().values.get_mut("neck_with_ease").unwrap().get_mut("M").unwrap().value_mm=99.;
        assert!(envelope.validate(&project).unwrap_err().contains("Stale"));
        let (_,mut envelope)=chart_fixture();
        envelope.per_size_chart.as_mut().unwrap().source_measurements.insert("forged".into(),NativeDraftMeasurement::Number(10.));
        assert!(envelope.validate(&project).unwrap_err().contains("forged"));
        let (mut project,mut envelope)=chart_fixture();
        let formula=NativeDraftMeasurement::Definition(crate::fitting::NativeDraftMeasurementDefinition{
            formula:Some("neck_with_ease + 1".into()),value_mm:None});
        project.native_point_bindings.as_mut().unwrap().measurements.insert("neck_distance".into(),formula);
        envelope.per_size_chart.as_mut().unwrap().source_measurements=project.native_point_bindings.as_ref().unwrap().measurements.clone();
        assert!(envelope.validate(&project).is_err());
    }
}
