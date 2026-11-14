//! Independent geometric offset construction, using sampled material contours.
//! Original implementation; no third-party geometry code incorporated.
use super::polygon::PolygonPattern;
use crate::fitting::FittingProject;
use glam::DVec2;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CutlineEdge { pub name: String, pub allowance_m: f64, pub start: usize, pub end: usize }
/// Separate marking layer. Experimental geometry, not manufacturer certified.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CutlineNotch { pub edge_id: String, pub t: f64, pub depth_m: f64, pub cut_start: DVec2, pub inner_end: DVec2 }
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProductionCutline { pub points: Vec<DVec2>, pub edges: Vec<CutlineEdge>, pub notches: Vec<CutlineNotch>, pub perimeter_m: f64, pub area_m2: f64 }

/// Material-space measurements of a single derived size; metres and square metres.
/// This is a geometric inspection record, not a factory/CAD approval.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GradedCutPanel {
    pub panel_id: String,
    pub sewline_edge_lengths_m: BTreeMap<String, f64>,
    pub cut: ProductionCutline,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GradedCutSeam {
    pub seam_id: String,
    pub a_length_m: f64,
    pub b_length_m: f64,
    pub mismatch_m: f64,
    pub allows_ease: bool,
    pub notch_intervals_m: Vec<[f64; 2]>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GradedCutSize {
    pub size: String,
    pub panels: Vec<GradedCutPanel>,
    pub seams: Vec<GradedCutSeam>,
}

/// Derive physical CUT boundaries for every stored size, while measuring sewn
/// spans from the original material sewlines. A missing allowance, ambiguous
/// notch projection, or unsupported CUT topology fails the complete catalog.
/// This requires independently measured physical samples for factory acceptance.
pub fn graded_production_cutlines(project: &FittingProject) -> Result<Vec<GradedCutSize>, String> {
    let run = project.grade_run.as_ref().ok_or("No persisted six-size grade run")?;
    run.validate(&project.template)?;
    let mut sizes = Vec::with_capacity(run.sizes.len());
    for (size, template) in run.sizes.iter().zip(&run.graded_templates) {
        let mut panels = Vec::with_capacity(template.panels.len());
        for panel in &template.panels {
            let polygon = panel.polygon.as_ref().ok_or_else(||
                format!("Grade {size} panel {} has no polygon CUT geometry", panel.id))?;
            let cut = production_cutline(polygon)
                .map_err(|e| format!("Grade {size} panel {} CUT: {e}", panel.id))?;
            let mut sewline_edge_lengths_m = BTreeMap::new();
            for (i, edge) in polygon.edges.iter().enumerate() {
                let sampled = polygon.edge_points(i)?;
                let length: f64 = sampled.windows(2).map(|v| v[0].distance(v[1])).sum();
                if !length.is_finite() || length <= 1e-9 {
                    return Err(format!("Grade {size} panel {} degenerate sewline edge {edge}", panel.id));
                }
                sewline_edge_lengths_m.insert(edge.clone(), length);
            }
            panels.push(GradedCutPanel { panel_id: panel.id.clone(), sewline_edge_lengths_m, cut });
        }
        let mut seams = Vec::with_capacity(template.seams.len());
        for seam in &template.seams {
            let length = |reference: &super::seam::BoundaryRef| -> Result<f64, String> {
                if !reference.range.iter().all(|v| v.is_finite())
                    || reference.range[0] < 0. || reference.range[1] > 1.
                    || reference.range[1] - reference.range[0] <= 1e-9 {
                    return Err(format!("Grade {size} seam {} invalid range", seam.id));
                }
                let panel = panels.iter().find(|p| p.panel_id == reference.panel)
                    .ok_or_else(|| format!("Grade {size} seam {} missing panel", seam.id))?;
                let edge = reference.edge.as_ref().ok_or_else(||
                    format!("Grade {size} seam {} needs a named polygon edge", seam.id))?;
                let full = panel.sewline_edge_lengths_m.get(edge).ok_or_else(||
                    format!("Grade {size} seam {} missing sewline edge {edge}", seam.id))?;
                Ok(full * (reference.range[1] - reference.range[0]))
            };
            let a = length(&seam.a)?;
            let b = length(&seam.b)?;
            let mut notch_intervals_m = Vec::with_capacity(seam.notches.len() + 1);
            let mut previous = [0., 0.];
            for station in seam.notches.iter().copied().chain(std::iter::once([1., 1.])) {
                if station.iter().any(|v| !v.is_finite() || *v <= 0. || *v > 1.)
                    || station[0] <= previous[0] || station[1] <= previous[1] {
                    return Err(format!("Grade {size} seam {} invalid notch correspondence", seam.id));
                }
                notch_intervals_m.push([(station[0] - previous[0]) * a, (station[1] - previous[1]) * b]);
                previous = station;
            }
            if !seam.allow_ease && notch_intervals_m.iter().any(|v|
                (v[0] - v[1]).abs() > 1e-8 * v[0].max(v[1])) {
                return Err(format!("Grade {size} seam {} unequal sewn notch intervals without easing", seam.id));
            }
            seams.push(GradedCutSeam { seam_id: seam.id.clone(), a_length_m: a,
                b_length_m: b, mismatch_m: (a - b).abs(), allows_ease: seam.allow_ease,
                notch_intervals_m });
        }
        sizes.push(GradedCutSize { size: size.clone(), panels, seams });
    }
    Ok(sizes)
}

fn cross(a: DVec2,b:DVec2)->f64 { a.perp_dot(b) }
fn intersect(a:DVec2,b:DVec2,c:DVec2,d:DVec2)->bool {
    let ab=b-a; let cd=d-c;
    let x=cross(ab,cd);
    if x.abs()<1e-12 {
        if cross(c-a,ab).abs()>=1e-12 { return false; }
        // A collinear edge may begin OUTSIDE AB and still run across it.
        // Testing only C (the first endpoint) silently accepts overlapping
        // non-adjacent CUT edges when C is before A or beyond B.
        let ab2=ab.length_squared();
        if ab2<=1e-18 { return true; }
        let t0=(c-a).dot(ab)/ab2;
        let t1=(d-a).dot(ab)/ab2;
        return t0.min(t1)<=1.+1e-10 && t0.max(t1)>=-1e-10;
    }
    let t=cross(c-a,cd)/x; let u=cross(c-a,ab)/x;
    t>=-1e-10 && t<=1.+1e-10 && u>=-1e-10 && u<=1.+1e-10
}
fn check_loop(p:&[DVec2])->Result<f64,String> {
    if p.len()<3 || p.iter().any(|v| !v.is_finite()) {return Err("Cutline requires at least three finite vertices".into())}
    let n=p.len(); let mut area=0.;
    for i in 0..n { let j=(i+1)%n; if p[i].distance(p[j])<1e-9 {return Err(format!("Collapsed contour segment {i}"))} area+=cross(p[i],p[j]); }
    if area<=1e-12 {return Err("Contour must have positive CCW area".into())}
    for i in 0..n { for j in (i+1)..n {if j==i+1 || (i==0 && j==n-1) {continue} if intersect(p[i],p[(i+1)%n],p[j],p[(j+1)%n]) {return Err(format!("Self-intersection between segments {i} and {j}"))} } }
    Ok(area/2.)
}
/// Returns a closed CCW contour (closure implicit). Widths are in metres.
/// Joins use bounded miters. Acute corners, holes, topology collisions and
/// missing allowances fail closed pending a topology-aware offset kernel.
pub fn production_cutline(p:&PolygonPattern)->Result<ProductionCutline,String> {
    if !p.holes.is_empty() || !p.lines.is_empty() {return Err("Holes and internal lines require topology-aware production processing".into())}
    let n=p.points.len(); if n<3 || p.edges.len()!=n {return Err("Invalid panel topology".into())}
    let mut names=BTreeSet::new(); let mut path=Vec::new(); let mut widths=Vec::new(); let mut ownership=Vec::new();
    for i in 0..n {
        let name=&p.edges[i]; if name.is_empty() || !names.insert(name.clone()) {return Err("Missing or duplicate stable edge name".into())}
        let w=*p.seam_allowances.get(name).ok_or_else(||format!("Missing seam allowance: {name}"))?;
        if !w.is_finite() || !(0.0..=0.5).contains(&w) {return Err(format!("Allowance outside 0..500 mm: {name}"))}
        let samples=p.edge_points(i)?;
        if samples.len()<2 {return Err(format!("Empty sampled edge: {name}"))}
        for v in samples.iter().take(samples.len()-1) {path.push(*v);widths.push(w);ownership.push(i);}
    }
    if p.seam_allowances.keys().any(|k| !names.contains(k)) {return Err("Allowance refers to unknown edge".into())}
    let source_area=check_loop(&path)?;
    let m=path.len(); let mut out=Vec::with_capacity(m);
    for i in 0..m {
        let prev=(i+m-1)%m; let next=(i+1)%m;
        let d0=(path[i]-path[prev]).normalize(); let d1=(path[next]-path[i]).normalize();
        let n0=DVec2::new(d0.y,-d0.x);let n1=DVec2::new(d1.y,-d1.x);
        let a=path[i]+n0*widths[prev];let b=path[i]+n1*widths[i];
        let denom=cross(d0,d1);
        let q=if denom.abs()<1e-10 {
            if d0.dot(d1)<0.999999 {return Err(format!("Reentrant cusp at sample {i}"))}
            if (widths[prev]-widths[i]).abs()>1e-9 {return Err(format!("Unequal allowance at collinear join {i} requires bevel"))}
            a
        } else {a+d0*(cross(b-a,d1)/denom)};
        if !q.is_finite() || q.distance(path[i])>10.*widths[prev].max(widths[i]).max(1e-6) {return Err(format!("Miter limit exceeded at sample {i}"))}
        out.push(q);
    }
    let area=check_loop(&out)?;
    if area+1e-10<source_area {return Err("Offset reduced panel area; unsafe corner topology".into())}
    let perimeter=out.iter().enumerate().map(|(i,v)|v.distance(out[(i+1)%m])).sum();
    let mut edges=Vec::new();
    for i in 0..n {let start=ownership.iter().position(|&v|v==i).ok_or("Empty named edge")?;let end=ownership.iter().rposition(|&v|v==i).unwrap()+1;edges.push(CutlineEdge{name:p.edges[i].clone(),allowance_m:p.seam_allowances[&p.edges[i]],start,end:end%m});}
    let mut notches=Vec::new();
    for (name, marks) in &p.notches {
        let edge_index=p.edges.iter().position(|id|id==name).ok_or_else(||format!("Notch references missing edge: {name}"))?;
        let width=p.seam_allowances[name];
        let sampled=p.edge_points(edge_index)?;
        let total:f64=sampled.windows(2).map(|pair|pair[0].distance(pair[1])).sum();
        if !total.is_finite() || total<1e-9 {return Err(format!("Invalid notch edge length: {name}"))}
        for mark in marks {
            if !mark.t.is_finite() || !(0.0..1.0).contains(&mark.t) || mark.t==0. || !mark.depth_m.is_finite() || mark.depth_m<=0. || mark.depth_m>width+1e-10 {return Err(format!("Invalid notch station or depth exceeds allowance: {name}"))}
            let station=total*mark.t;
            let mut consumed=0.;let mut found=None;
            for pair in sampled.windows(2) {
                let v=pair[1]-pair[0];let length=v.length();
                if length<=1e-10 {return Err(format!("Degenerate notch source segment: {name}"))}
                if consumed+length>=station { let origin=pair[0]+v*((station-consumed)/length);let normal=DVec2::new(v.y,-v.x)/length;found=Some((origin,normal));break }
                consumed+=length;
            }
            let (origin,normal)=found.ok_or_else(||format!("Notch station missing: {name}"))?;
            let mut hits=Vec::new();
            for j in 0..out.len() {
                let a=out[j];let d=out[(j+1)%out.len()]-a;let denom=cross(normal,d);
                if denom.abs()<1e-12 {continue}
                let ray=cross(a-origin,d)/denom;let segment=cross(a-origin,normal)/denom;
                if ray>1e-9 && segment>=-1e-9 && segment<=1.+1e-9 && ray.is_finite() { hits.push((ray,j,origin+normal*ray)); }
            }
            hits.sort_by(|a,b|a.0.total_cmp(&b.0));
            if hits.len()!=1 || ownership[hits[0].1]!=edge_index || (hits[0].0-width).abs()>0.001 {return Err(format!("Ambiguous or incorrect cut-boundary notch projection: {name}"))}
            let cut_start=hits[0].2;let inner_end=cut_start-normal*mark.depth_m;
            if !cut_start.is_finite() || !inner_end.is_finite() {return Err(format!("Nonfinite notch marking: {name}"))}
            if notches.iter().any(|previous: &CutlineNotch|previous.cut_start.distance(cut_start)<1e-5) {return Err("Conflicting notch markings".into())}
            notches.push(CutlineNotch{edge_id:name.clone(),t:mark.t,depth_m:mark.depth_m,cut_start,inner_end});
        }
    }
    Ok(ProductionCutline{points:out,edges,notches,perimeter_m:perimeter,area_m2:area})
}

#[cfg(test)]
mod graded_cut_tests {
    use super::*;
    use crate::{fitting::PersistedGradeRun, garment::presets::GarmentKind};
    use std::path::PathBuf;

    #[test]
    fn collinear_cross_edge_overlap_is_not_lost_when_start_is_outside() {
        let p=|x:f64,y:f64|DVec2::new(x,y);
        assert!(intersect(p(0.,0.),p(1.,0.),p(2.,0.),p(0.5,0.)));
        assert!(intersect(p(0.,0.),p(1.,0.),p(-1.,0.),p(0.5,0.)));
        assert!(intersect(p(0.,0.),p(1.,0.),p(2.,0.),p(-1.,0.)));
        assert!(!intersect(p(0.,0.),p(1.,0.),p(2.,0.),p(3.,0.)));
        assert!(!intersect(p(0.,0.),p(1.,0.),p(0.,1.),p(1.,1.)));
    }

    fn six_sizes() -> FittingProject {
        let mut project = FittingProject::basic(GarmentKind::Tshirt, 2, PathBuf::from("avatar.obj"));
        let sizes = ["XS", "S", "M", "L", "XL", "XXL"];
        let mut run = PersistedGradeRun {
            schema_version: 1, sizes: sizes.iter().map(|v| v.to_string()).collect(),
            base_size: "M".into(), base_template: project.template.clone(),
            graded_templates: vec![project.template.clone(); 6], size_correspondence: Default::default(), pom_specs: vec![],
        };
        let factors = [0.95, 0.975, 1., 1.05, 1.10, 1.12];
        for (template, factor) in run.graded_templates.iter_mut().zip(factors) {
            for panel in &mut template.panels {
                let polygon = panel.polygon.as_mut().unwrap();
                let origin = polygon.points.iter().copied().reduce(|a,b| a.min(b)).unwrap();
                for point in &mut polygon.points { *point = origin + (*point - origin) * factor; }
                for edge in &polygon.edges { polygon.seam_allowances.insert(edge.clone(), 0.01); }
            }
        }
        // Allowances are source-linked metadata and therefore must be authored
        // before deriving the grade packet, across all six stored templates.
        for panel in &mut project.template.panels {
            let polygon = panel.polygon.as_mut().unwrap();
            for edge in &polygon.edges { polygon.seam_allowances.insert(edge.clone(), 0.01); }
        }
        run.base_template = project.template.clone();
        for template in &mut run.graded_templates {
            for (panel, source) in template.panels.iter_mut().zip(&project.template.panels) {
                panel.polygon.as_mut().unwrap().seam_allowances = source.polygon.as_ref().unwrap().seam_allowances.clone();
            }
        }
        project.grade_run = Some(run);
        project
    }

    #[test]
    fn six_sizes_generate_measurable_native_cut_and_sewn_spans() {
        let project = six_sizes();
        let source_json = serde_json::to_value(&project.template).unwrap();
        let run_json = serde_json::to_value(&project.grade_run).unwrap();
        let results = graded_production_cutlines(&project).unwrap();
        assert_eq!(results.len(), 6);
        let factors = [0.95, 0.975, 1., 1.05, 1.10, 1.12];
        let source_length = results[2].panels[0].sewline_edge_lengths_m.values().sum::<f64>();
        for (size, factor) in results.iter().zip(factors) {
            assert_eq!(size.panels.len(), 2);
            assert_eq!(size.seams.len(), project.template.seams.len());
            for panel in &size.panels {
                assert!(panel.cut.area_m2 > 0.);
                assert!(panel.cut.perimeter_m.is_finite());
                assert_eq!(panel.cut.edges.len(), panel.sewline_edge_lengths_m.len());
                assert!(panel.cut.edges.iter().all(|edge| (edge.allowance_m - 0.01).abs() < 1e-12));
                assert!((panel.sewline_edge_lengths_m.values().sum::<f64>() - source_length * factor).abs() < 0.002);
            }
            assert!(size.seams.iter().all(|seam| seam.mismatch_m < 1e-8));
        }
        assert!(results[5].panels[0].cut.area_m2 > results[2].panels[0].cut.area_m2);
        assert_eq!(serde_json::to_value(&project.template).unwrap(), source_json);
        assert_eq!(serde_json::to_value(&project.grade_run).unwrap(), run_json);
    }

    #[test]
    fn missing_grade_allowance_fails_every_size_packet() {
        let mut project = six_sizes();
        project.grade_run.as_mut().unwrap().graded_templates[5].panels[0]
            .polygon.as_mut().unwrap().seam_allowances.clear();
        assert!(graded_production_cutlines(&project).is_err());
    }

    #[test]
    fn unequal_sewn_spans_fail_without_ease() {
        let mut project = six_sizes();
        let run = project.grade_run.as_mut().unwrap();
        // A single graded panel drifts in width on one size, and validation
        // must catch both the factory seam mismatch and the CUT discrepancy.
        for point in &mut run.graded_templates[5].panels[1].polygon.as_mut().unwrap().points {
            point.x *= 1.01;
        }
        let error = graded_production_cutlines(&project).unwrap_err();
        assert!(error.contains("unequal sewn") || error.contains("seam") || error.contains("compile"), "{error}");
    }
}
