//! One native Undo transaction for a *shared named measurement* driving two
//! or more detached 2D pattern pieces, including cubic edge handles.
//!
//! This is independently written EXO engineering, not GPL Valentina code.
//! The v1 schema references only anchors within each panel: distinct panels
//! can share formula inputs, not arbitrary cross-panel source points.
use crate::{
    authoring::{self, Command, Edit},
    fitting::{NativeDraftMeasurement, NativeDraftPointBindings, NativeDraftPointRule},
    garment::{cutline::production_cutline, polygon::PolygonPattern, template::GarmentTemplate},
    native_measurement_formulas_20261027::evaluate_native_measurements_20261027,
};
use glam::DVec2;
use std::collections::{BTreeMap, BTreeSet};

fn qualified_panel<'a>(template: &'a GarmentTemplate, id: &str) -> Result<&'a PolygonPattern, String> {
    if template.panels.iter().filter(|panel| panel.id == id).count() != 1 {
        return Err(format!("Missing or duplicate native bound panel: {id}"));
    }
    if template.seams.iter().any(|seam| seam.a.panel == id || seam.b.panel == id) {
        return Err("Sewn pieces require coordinated native seam regeneration".into());
    }
    let panel = template.panels.iter().find(|p| p.id == id).unwrap();
    let poly = panel.polygon.as_ref().ok_or("Native bound piece requires polygon geometry")?;
    if !panel.pins.is_empty() || !panel.pin_points.is_empty()
        || !poly.holes.is_empty() || !poly.lines.is_empty()
        || !poly.free_curve_points.is_empty() || !poly.vertex_ids.is_empty()
        || !poly.vertex_mirror_groups.is_empty() || !poly.annotations.is_empty()
        || !poly.measurements.is_empty() || !poly.target_lengths.is_empty() {
        return Err("Attached complex geometry requires a larger native dependency solver".into());
    }
    if !(3..=32).contains(&poly.points.len()) || poly.edges.len() != poly.points.len()
        || poly.points.iter().any(|p| !p.is_finite() || p.abs().max_element() > 10.)
        || poly.edges.iter().collect::<BTreeSet<_>>().len() != poly.edges.len() {
        return Err("Native reactive piece must have a finite, stable polygon contour".into());
    }
    if poly.curves.keys().any(|edge| !poly.edges.contains(edge)) ||
        poly.curves.values().flatten().any(|p| !p.is_finite()) {
        return Err("Native bound cubic curve inventory is invalid".into());
    }
    for index in 0..poly.edges.len() {
        let sampled=poly.edge_points(index)?;
        if sampled.len()<2 || sampled.windows(2).any(|p| p[0].distance(p[1])<=1e-9) {
            return Err("Native bound curve has collapsed material geometry".into());
        }
    }
    if !poly.seam_allowances.is_empty() || !poly.notches.is_empty() {
        if poly.seam_allowances.len()!=poly.edges.len() {
            return Err("Reactive industrial panel requires allowances on every edge".into());
        }
        // The production offset is not silently replaced by drawing guides.
        production_cutline(poly)?;
    }
    Ok(poly)
}

fn geometry(rule:&NativeDraftPointRule, points:&[DVec2], values:&BTreeMap<String,f64>) -> Result<DVec2,String> {
    let distance=*values.get(&rule.distance_formula)
        .ok_or("Native rule needs one saved named distance formula")?;
    if !distance.is_finite() || distance.abs()>5000. {
        return Err("Native rule distance exceeds ±5000 millimetres".into());
    }
    if rule.point_index==rule.a || (rule.mode!="polar" && rule.point_index==rule.b) {
        return Err("Self-referential native point construction".into());
    }
    let source=*points.get(rule.a).ok_or("Missing native reference anchor A")?;
    let direction=match rule.mode.as_str() {
        "polar"=>{
            let angle=rule.angle_deg.unwrap_or(0.).to_radians();
            DVec2::new(angle.cos(),angle.sin())
        }
        "along"|"normal"=>{
            let b=*points.get(rule.b).ok_or("Missing native reference anchor B")?;
            let delta=b-source;
            if !delta.is_finite() || delta.length_squared()<1e-12 {
                return Err("Native direction references have coincident anchors".into());
            }
            let unit=delta.normalize();
            if rule.mode=="normal" {DVec2::new(-unit.y,unit.x)} else {unit}
        }
        _=>return Err("Unsupported native point construction mode".into())
    };
    let next=source+direction*(distance/1000.);
    if !next.is_finite() || next.abs().max_element()>10. {
        return Err("Recomputed native point is outside finite material bounds".into());
    }
    Ok(next)
}

fn ordered_rules(graph:&NativeDraftPointBindings) -> Result<Vec<&NativeDraftPointRule>,String> {
    let by_id:BTreeMap<_,_>=graph.bindings.iter().map(|rule|(rule.id.as_str(),rule)).collect();
    let mut waiting:BTreeSet<&str>=by_id.keys().copied().collect();
    let mut done=BTreeSet::new();
    let mut order=Vec::new();
    while !waiting.is_empty() {
        let next=waiting.iter().find(|id|by_id[**id].depends_on.iter()
            .all(|dependency|done.contains(dependency.as_str())))
            .copied().ok_or("Circular or missing native construction reference")?;
        waiting.remove(next);
        done.insert(next);
        order.push(by_id[next]);
    }
    Ok(order)
}

/// Recompute one changed direct measurement across at least two physical
/// pieces. All mutation is performed on clones, and the complete compiled Edit
/// and rebased binding graph are returned *before* Session records history.
pub fn recompute_native_multi_panel_measurement_20261030(
    template:&GarmentTemplate, saved:&NativeDraftPointBindings,
    measurement:&str, expected_mm:f64, value_mm:f64,
) -> Result<(Edit,NativeDraftPointBindings,Vec<String>,Vec<String>),String> {
    saved.valid_against(template)?;
    if !saved.source_matches(template) {
        return Err("Source and native saved dependency graph are stale".into());
    }
    if !expected_mm.is_finite() || !value_mm.is_finite() ||
        expected_mm.abs()>5000. || value_mm.abs()>5000. ||
        (expected_mm-value_mm).abs()<1e-8 {
        return Err("Invalid or unchanged native direct measurement".into());
    }
    let existing=saved.measurements.get(measurement).ok_or("Unknown source measurement")?;
    let original=match existing {
        NativeDraftMeasurement::Number(v)=>*v,
        NativeDraftMeasurement::Definition(def) if def.formula.is_none()=>
            def.value_mm.ok_or("Direct measurement has no numeric value")?,
        _=>return Err("Computed formula measurements are not directly editable".into())
    };
    if original!=expected_mm {return Err("Stale expected native direct measurement".into());}
    let panels:BTreeSet<_>=saved.bindings.iter().map(|rule|rule.panel_id.as_str()).collect();
    if !(2..=16).contains(&panels.len()) {
        return Err("Multi-panel native recomputation requires 2–16 bound pieces".into());
    }
    for panel in &panels { qualified_panel(template,panel)?; }
    let ordered=ordered_rules(saved)?;
    let old_values=evaluate_native_measurements_20261027(&saved.measurements)?;
    // Reject a stale downstream point rather than fixing it invisibly during
    // an unrelated measurement change. Every saved rule must match its source.
    for rule in &ordered {
        let poly=qualified_panel(template,&rule.panel_id)?;
        let calculated=geometry(rule,&poly.points,&old_values)?;
        if poly.points[rule.point_index].distance(calculated)>1e-8 {
            return Err(format!("Saved native point rule {} disagrees with original geometry",rule.id));
        }
    }
    let mut updated=saved.clone();
    match updated.measurements.get_mut(measurement).unwrap() {
        NativeDraftMeasurement::Number(value)=>*value=value_mm,
        NativeDraftMeasurement::Definition(def)=>def.value_mm=Some(value_mm),
    }
    let new_values=evaluate_native_measurements_20261027(&updated.measurements)?;
    let mut planned:BTreeMap<String,Vec<DVec2>>=panels.iter().map(|id| {
        let poly=template.panels.iter().find(|p|p.id==*id).unwrap().polygon.as_ref().unwrap();
        ((*id).to_string(),poly.points.clone())
    }).collect();
    let mut changes:BTreeMap<String,Vec<(usize,DVec2)>>=BTreeMap::new();
    let mut changed_ids=Vec::new();
    for rule in &ordered {
        let points=planned.get_mut(&rule.panel_id).ok_or("Lost bound panel")?;
        let position=geometry(rule,points,&new_values)?;
        if points[rule.point_index].distance(position)>1e-8 {
            points[rule.point_index]=position;
            changes.entry(rule.panel_id.clone()).or_default()
                .push((rule.point_index,position));
            changed_ids.push(rule.id.clone());
        }
    }
    if changes.len()<2 {
        return Err("Measurement did not change points in two distinct native panels".into());
    }
    let mut candidate=template.clone();
    let affected:Vec<_>=changes.keys().cloned().collect();
    for (id,edits) in &changes {
        if edits.len()>32 {return Err("Native AnchorGroup exceeds 32 points per panel".into());}
        let before=qualified_panel(&candidate,id)?.clone();
        let after=authoring::apply(&candidate,Command::AnchorGroup{
            panel:id.clone(),edits:edits.clone()
        })?;
        candidate=after.template;
        let next=qualified_panel(&candidate,id)?;
        if before.edges!=next.edges ||
            before.notches!=next.notches ||
            before.seam_allowances!=next.seam_allowances {
            return Err("Native 2D edit changed permanent edge, notch or allowance identity".into());
        }
    }
    for rule in &ordered {
        let poly=qualified_panel(&candidate,&rule.panel_id)?;
        if poly.points[rule.point_index].distance(geometry(rule,&poly.points,&new_values)?)>1e-8 {
            return Err(format!("Recomputed native rule {} is not satisfied",rule.id));
        }
    }
    // Compile every part together after all groups. No user project mutation
    // takes place until the caller accepts the fully compiled native Edit.
    let garment=candidate.compile()?;
    updated.source_template=candidate.clone();
    updated.valid_against(&candidate)?;
    Ok((Edit{template:candidate,garment,selected:None,reset_simulation:true,new_point:None},
        updated,changed_ids,affected))
}

#[cfg(test)]
pub(crate) mod native_multi_panel_20261030_tests {
    use super::*;
    use crate::{
        fitting::FittingProject,
        garment::{presets::GarmentKind, shapes::{self,Primitive}},
    };

    pub fn fixture()->FittingProject {
        let mut project=FittingProject::basic(GarmentKind::Tshirt,0,
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("assets/makehuman/mannequin.obj"));
        project.template.seams.clear();
        project.template.panels.truncate(2);
        for panel in &mut project.template.panels {
            panel.pins.clear();
            panel.pin_points.clear();
            panel.polygon=Some(shapes::primitive(Primitive::Rectangle,
                DVec2::new(0.4,0.25),180.,Default::default()).unwrap());
            panel.pattern.width=0.4;panel.pattern.height=0.25;
        }
        let mut bindings=Vec::new();
        for panel in &project.template.panels {
            bindings.push(NativeDraftPointRule{
                id:format!("{}_width",panel.id),
                panel_id:panel.id.clone(),point_index:1,mode:"polar".into(),
                a:0,b:0,distance_formula:"frontWidth".into(),
                angle_deg:Some(0.),depends_on:vec![]
            });
            bindings.push(NativeDraftPointRule{
                id:format!("{}_corner",panel.id),
                panel_id:panel.id.clone(),point_index:2,mode:"polar".into(),
                a:1,b:0,distance_formula:"depth".into(),
                angle_deg:Some(90.),depends_on:vec![format!("{}_width",panel.id)]
            });
        }
        project.native_point_bindings=Some(NativeDraftPointBindings{
            version:1,source_template:project.template.clone(),
            measurements:BTreeMap::from([
                ("chest".into(),NativeDraftMeasurement::Number(800.)),
                ("frontWidth".into(),NativeDraftMeasurement::Definition(
                    crate::fitting::NativeDraftMeasurementDefinition{
                        formula:Some("chest / 2".into()),value_mm:None
                    })),
                ("depth".into(),NativeDraftMeasurement::Number(250.))
            ]),bindings,
        });
        project
    }

    #[test]
    fn two_piece_formula_change_recomputes_nested_points_and_preserves_source() {
        let project=fixture();
        let original=serde_json::to_string(&project.template).unwrap();
        let graph=project.native_point_bindings.as_ref().unwrap();
        let (edit,rebound,changed,affected)=recompute_native_multi_panel_measurement_20261030(
            &project.template,graph,"chest",800.,840.).unwrap();
        assert_eq!(affected.len(),2);
        assert_eq!(changed.len(),4);
        for panel in &edit.template.panels {
            let points=&panel.polygon.as_ref().unwrap().points;
            assert!((points[1].x-points[0].x-0.42).abs()<1e-8);
            assert!((points[2].x-points[1].x).abs()<1e-8);
            assert!((points[2].y-points[1].y-0.25).abs()<1e-8);
        }
        assert!(rebound.source_matches(&edit.template));
        assert!(serde_json::to_string(&project.template).unwrap()==original);
    }

    #[test]
    fn curved_edges_keep_their_identity_and_move_their_tangent_control_with_corner() {
        let mut project=fixture();
        for panel in &mut project.template.panels {
            let poly=panel.polygon.as_mut().unwrap();
            poly.curves.insert(poly.edges[0].clone(),
                [DVec2::new(0.12,-0.03),DVec2::new(0.28,-0.03)]);
        }
        project.native_point_bindings.as_mut().unwrap().source_template=project.template.clone();
        let graph=project.native_point_bindings.as_ref().unwrap();
        let (edit,_,_,_)=recompute_native_multi_panel_measurement_20261030(
            &project.template,graph,"chest",800.,840.).unwrap();
        for (old,new) in project.template.panels.iter().zip(&edit.template.panels) {
            let before=old.polygon.as_ref().unwrap();
            let after=new.polygon.as_ref().unwrap();
            assert_eq!(before.edges,after.edges);
            let edge=&before.edges[0];
            let prior=before.curves[edge];
            let next=after.curves[edge];
            // Normalization may translate both points; the relative
            // second control must follow the changed endpoint exactly.
            let old_rel=prior[1]-before.points[1];
            let new_rel=next[1]-after.points[1];
            assert!(old_rel.distance(new_rel)<1e-8);
        }
    }

    #[test]
    fn invalid_direct_edit_and_stale_or_cyclic_graph_leave_source_unchanged(){
        let project=fixture();
        let before=serde_json::to_string(&project.template).unwrap();
        let graph=project.native_point_bindings.as_ref().unwrap();
        assert!(recompute_native_multi_panel_measurement_20261030(
            &project.template,graph,"chest",801.,840.).is_err());
        assert!(recompute_native_multi_panel_measurement_20261030(
            &project.template,graph,"frontWidth",400.,420.).is_err());
        assert!(recompute_native_multi_panel_measurement_20261030(
            &project.template,graph,"chest",800.,f64::NAN).is_err());
        let mut stale=graph.clone();
        stale.source_template.panels[0].name.push_str(" stale");
        assert!(recompute_native_multi_panel_measurement_20261030(
            &project.template,&stale,"chest",800.,840.).is_err());
        let mut cyclic=graph.clone();
        cyclic.bindings[0].depends_on=vec![cyclic.bindings[1].id.clone()];
        assert!(recompute_native_multi_panel_measurement_20261030(
            &project.template,&cyclic,"chest",800.,840.).is_err());
        assert_eq!(serde_json::to_string(&project.template).unwrap(),before);
    }
}
