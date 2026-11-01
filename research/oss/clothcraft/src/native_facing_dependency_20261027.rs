//! Strict source-linked rectangular facing strip, reconstructed per physical grade.
//! The facing is an actual sewn polygon, not a manufacturing release claim.
use crate::{
    fitting::{FittingProject, PersistedGradeRun},
    garment::{
        cutline::graded_production_cutlines,
        polygon::{EdgeNotch, PolygonPattern},
        seam::{BoundaryRef, SeamSpec, Side},
        template::Panel,
        GarmentTemplate,
    },
};
use glam::{DVec2, DVec3};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PersistedFacingDependency {
    pub version: u32,
    pub parent_panel_id: String,
    pub parent_edge_id: String,
    pub facing_id: String,
    pub depth_m: f64,
    pub allowance_m: f64,
    /// The exact installed base template, including source panels and facing.
    pub source_template: GarmentTemplate,
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64
        && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

fn facing_seam_id(child: &str) -> String { format!("{child}_attach") }
fn facing_edges(child: &str) -> [String;4] {
    [format!("{child}_sew"),format!("{child}_side1"),format!("{child}_hem"),format!("{child}_side2")]
}

const TRUE_NORMAL_SEGMENTS: usize = 64;

fn true_normal_hem(source:[DVec2;4],depth:f64)->Result<Vec<DVec2>,String>{
    if !(0.01..=0.08).contains(&depth) || source.iter().any(|p|!p.is_finite()) {
        return Err("Facing v3 requires finite cubic and 10–80 mm depth".into());
    }
    let width=source[3].x-source[0].x;
    if !(0.03..=5.).contains(&width) || (source[0].y-source[3].y).abs()>1e-9 {
        return Err("Facing v3 requires a horizontal top cubic".into());
    }
    let mut hem:Vec<DVec2>=Vec::with_capacity(TRUE_NORMAL_SEGMENTS+1);
    let mut last_x=f64::NEG_INFINITY;
    let mut preceding_midpoint:Option<DVec2>=None;
    for i in 0..=TRUE_NORMAL_SEGMENTS*2 {
        let t=i as f64/(TRUE_NORMAL_SEGMENTS*2) as f64;
        let p=crate::garment::curves::cubic(source,t);
        let tangent=crate::garment::curves::cubic_derivative(source,t);
        let second=6.*((1.-t)*(source[2]-2.*source[1]+source[0])
            +t*(source[3]-2.*source[2]+source[1]));
        if tangent.x<=width*0.2 || !tangent.is_finite() || p.x<=last_x && i!=0
            || p.y>source[0].y+1e-9 {
            return Err("Facing v3 source tangent is nonmonotone or turns inward".into());
        }
        last_x=p.x;
        let curvature=(tangent.x*second.y-tangent.y*second.x).abs()/tangent.length().powi(3);
        if !curvature.is_finite() || curvature*depth>=0.5 {
            return Err("Facing v3 curvature times depth exceeds safe envelope".into());
        }
        let inward=DVec2::new(-tangent.y,tangent.x)/tangent.length();
        let q=p+inward*depth;
        if !q.is_finite() || q.y<=source[0].y+0.001 {
            return Err("Facing v3 normal offset collapsed toward sewn edge".into());
        }
        if i%2==0 {
            if let Some(midpoint)=preceding_midpoint.take() {
                if midpoint.distance(hem.last().unwrap().lerp(q,0.5))>0.00025 {
                    return Err("Facing v3 hem chord deviates beyond 0.25 mm".into());
                }
            }
            hem.push(q);
        } else {
            preceding_midpoint=Some(q);
        }
    }
    for pair in hem.windows(2) {
        if pair[1].x<=pair[0].x+1e-8 || pair[1].distance(pair[0])<=1e-8 {
            return Err("Facing v3 hem folded or collapsed".into());
        }
    }
    let min_gap=hem.iter().map(|p|p.y-source[0].y).fold(f64::INFINITY,f64::min);
    if min_gap<=0.001 {return Err("Facing v3 hem intersects source envelope".into());}
    Ok(hem)
}

/// A translated hem is only an acceptable physical approximation of a normal
/// offset while the true normal separation stays within 0.25 mm everywhere.
fn guarded_top_curve(points: [DVec2; 4], depth: f64) -> Result<(), String> {
    if !(0.01..=0.08).contains(&depth) || points.iter().any(|p| !p.is_finite()) {
        return Err("Facing v2 requires finite 10–80 mm depth and cubic controls".into());
    }
    let width = points[3].x - points[0].x;
    let y = points[0].y;
    if width <= 0. || (points[3].y-y).abs()>1e-9
        || points[1].x <= points[0].x || points[2].x <= points[1].x
        || points[2].x >= points[3].x
        || points[1].y > y || points[2].y > y
        || points[1].y < y-0.015 || points[2].y < y-0.015 {
        return Err("Facing v2 cubic must be a gentle outward monotone top span".into());
    }
    let mut last_x=f64::NEG_INFINITY;
    for i in 0..=64 {
        let t=i as f64/64.;
        let p=crate::garment::curves::cubic(points,t);
        let tangent=crate::garment::curves::cubic_derivative(points,t);
        if tangent.x <= width*0.2 || p.x <= last_x && i!=0 || p.y>y+1e-9 {
            return Err("Facing v2 cubic tangent or monotonicity unsafe".into());
        }
        last_x=p.x;
        let normal=DVec2::new(-tangent.y,tangent.x).normalize();
        let displacement=DVec2::new(0.,depth);
        let normal_gap=displacement.dot(normal);
        let normal_error=(displacement-normal*normal_gap).length();
        if normal_gap <= 0. || normal_error > 0.00025+1e-12 {
            return Err("Facing v2 translated hem exceeds physical normal-offset tolerance".into());
        }
        // The strictly positive horizontal derivative prevents the two
        // translated cubic boundaries from folding or intersecting.
        let second=6.*((1.-t)*(points[2]-2.*points[1]+points[0])
            +t*(points[3]-2.*points[2]+points[1]));
        let curvature=(tangent.x*second.y-tangent.y*second.x).abs()
            / tangent.length().powi(3);
        if !curvature.is_finite() || curvature*depth >= 0.25 {
            return Err("Facing v2 cubic curvature is unsafe for strip depth".into());
        }
    }
    Ok(())
}

fn rectangle_edge(template: &GarmentTemplate, parent: &str, edge: &str, version:u32)
    -> Result<(usize,DVec2,DVec2,Option<[DVec2;2]>), String>
{
    let panel = template.panels.iter().find(|p| p.id == parent)
        .ok_or("Facing parent panel not present")?;
    let polygon = panel.polygon.as_ref().ok_or("Facing parent requires a polygon")?;
    if polygon.points.len()!=4 || polygon.edges.len()!=4
        || !polygon.holes.is_empty() || !polygon.lines.is_empty()
        || !polygon.free_curve_points.is_empty()
        || !polygon.vertex_mirror_groups.is_empty() {
        return Err("Facing parent requires four straight CCW vertices without attachments".into());
    }
    let p=&polygon.points;
    let width=p[1].x-p[0].x;
    let height=p[2].y-p[1].y;
    if p.iter().any(|v| !v.is_finite()) || p[0].x < 0. || p[0].y < 0.
        || !(0.03..=5.).contains(&width) || !(0.03..=5.).contains(&height)
        || (p[1].y-p[0].y).abs()>1e-8
        || (p[2].x-p[1].x).abs()>1e-8
        || (p[3].y-p[2].y).abs()>1e-8
        || (p[3].x-p[0].x).abs()>1e-8 {
        return Err("Facing requires an axis-aligned finite CCW rectangular parent".into());
    }
    if polygon.notches.keys().any(|k|!polygon.edges.contains(k))
        || polygon.seam_allowances.len()!=4
        || polygon.edges.iter().any(|name|!polygon.seam_allowances.get(name)
            .is_some_and(|v|v.is_finite() && (0.001..=0.05).contains(v))) {
        return Err("Facing parent requires complete bounded edge allowances".into());
    }
    let index=polygon.edges.iter().position(|e|e==edge)
        .ok_or("Facing source edge does not exist")?;
    if index != 0 {
        return Err("Facing v1 supports the CCW rectangle top edge (edge index 0)".into());
    }
    let curve=if version==1 {
        if !polygon.curves.is_empty() {return Err("Facing v1 requires straight edges".into());}
        None
    } else if matches!(version,2|3) {
        if polygon.curves.len()!=1 {return Err("Facing curved versions require exactly one top cubic".into());}
        Some(*polygon.curves.get(edge).ok_or("Facing top cubic missing")?)
    } else {return Err("Unsupported facing dependency version".into());};
    if polygon.notches.get(edge).is_some_and(|n|!n.is_empty()) {
        return Err("Facing source edge must have no existing competing notches".into());
    }
    if template.seams.iter().any(|seam| [&seam.a,&seam.b].iter()
        .any(|r| r.panel == parent && r.edge.as_deref()==Some(edge))) {
        return Err("Facing source edge already owns a seam".into());
    }
    Ok((index,p[0],p[1],curve))
}

fn build_facing(template:&mut GarmentTemplate, spec:&PersistedFacingDependency)
    -> Result<(),String>
{
    if !matches!(spec.version,1|2|3) || !valid_id(&spec.parent_panel_id)
        || !valid_id(&spec.parent_edge_id) || !valid_id(&spec.facing_id)
        || spec.parent_panel_id == spec.facing_id
        || !spec.depth_m.is_finite() || !(0.005..=0.15).contains(&spec.depth_m)
        || !spec.allowance_m.is_finite() || !(0.002..=0.03).contains(&spec.allowance_m) {
        return Err("Facing dependency requires finite bounded IDs, depth and allowance".into());
    }
    if template.panels.iter().any(|p| p.id==spec.facing_id)
        || template.seams.iter().any(|s|s.id==facing_seam_id(&spec.facing_id)) {
        return Err("Facing child or seam ID collides with authored geometry".into());
    }
    let (_,start,end,curve)=rectangle_edge(template,&spec.parent_panel_id,&spec.parent_edge_id,spec.version)?;
    if let Some(controls)=curve {
        if spec.version==2 {guarded_top_curve([start,controls[0],controls[1],end],spec.depth_m)?;}
    }
    let parent_index=template.panels.iter().position(|p|p.id==spec.parent_panel_id).unwrap();
    let parent=&template.panels[parent_index];
    let length=end.x-start.x;
    let mut child:Panel=parent.clone();
    child.id=spec.facing_id.clone();
    child.name=format!("{} facing",parent.name);
    child.pins.clear();
    child.pin_points.clear();
    child.layout_2d=None;
    child.layout_rotation_degrees=0.;
    // Grade-run v1 permits physical polygon point movement, while pattern
    // envelopes must remain identical across all six saved sizes.
    child.pattern.width=parent.pattern.width;
    child.pattern.height=parent.pattern.height;
    child.placement.translation+=DVec3::new(0.,0.,0.006);
    let mut edges=facing_edges(&spec.facing_id).to_vec();
    let mut points=vec![DVec2::new(0.,0.),DVec2::new(length,0.),
        DVec2::new(length,spec.depth_m),DVec2::new(0.,spec.depth_m)];
    if spec.version==3 {
        let [c1,c2]=curve.ok_or("Facing v3 requires a source cubic")?;
        let source=[start,c1,c2,end];
        let hem=true_normal_hem(source,spec.depth_m)?;
        // Stable clockwise traversal of the inward offset from right to left.
        points.truncate(2);
        points.extend(hem.into_iter().rev().map(|p|p-start));
        edges.truncate(2);
        edges.extend((0..TRUE_NORMAL_SEGMENTS).map(|i|format!("{}_hem_{i:02}",spec.facing_id)));
        edges.push(format!("{}_side2",spec.facing_id));
    }
    let mut allowances=BTreeMap::new();
    for edge in &edges {allowances.insert(edge.clone(),spec.allowance_m);}
    let notch_depth=(spec.allowance_m*0.5).min(0.005);
    let notches=vec![EdgeNotch{t:0.25,depth_m:notch_depth},
        EdgeNotch{t:0.75,depth_m:notch_depth}];
    let mut curves=BTreeMap::new();
    if let Some([c1,c2])=curve {
        let a=c1-start;
        let b=c2-start;
        curves.insert(edges[0].clone(),[a,b]);
        if spec.version==2 {
            curves.insert(edges[2].clone(),[
                b+DVec2::new(0.,spec.depth_m),
                a+DVec2::new(0.,spec.depth_m)]);
        }
    }
    let polygon=PolygonPattern{
        points,edges:edges.clone(),
        subdivisions:parent.polygon.as_ref().unwrap().subdivisions,
        meshing:parent.polygon.as_ref().unwrap().meshing.clone(),
        curves,free_curve_points:BTreeMap::new(),
        vertex_ids:BTreeMap::new(),vertex_mirror_groups:BTreeMap::new(),
        holes:vec![],lines:vec![],target_lengths:BTreeMap::new(),
        notches:BTreeMap::from([(edges[0].clone(),notches.clone())]),
        seam_allowances:allowances,annotations:vec![],measurements:vec![],
    };
    child.polygon=Some(polygon);
    let parent_poly=template.panels[parent_index].polygon.as_mut().unwrap();
    parent_poly.notches.insert(spec.parent_edge_id.clone(),notches);
    let seam=SeamSpec{
        id:facing_seam_id(&spec.facing_id),
        a:BoundaryRef{panel:spec.parent_panel_id.clone(),side:Side::Top,
            edge:Some(spec.parent_edge_id.clone()),range:[0.,1.]},
        b:BoundaryRef{panel:spec.facing_id.clone(),side:Side::Top,
            edge:Some(edges[0].clone()),range:[0.,1.]},
        reverse_b:true,notches:vec![[0.25,0.25],[0.75,0.75]],
        stiffness:5000.,allow_ease:false,
    };
    template.panels.push(child);
    template.seams.push(seam);
    Ok(())
}

fn strip(template:&GarmentTemplate,spec:&PersistedFacingDependency)
    -> Result<GarmentTemplate,String>
{
    let mut bare=template.clone();
    let seam=facing_seam_id(&spec.facing_id);
    if bare.panels.iter().filter(|p|p.id==spec.facing_id).count()!=1
        || bare.seams.iter().filter(|s|s.id==seam).count()!=1 {
        return Err("Installed facing child/seam inventory is incomplete".into());
    }
    bare.panels.retain(|p|p.id!=spec.facing_id);
    bare.seams.retain(|s|s.id!=seam);
    let parent=bare.panels.iter_mut().find(|p|p.id==spec.parent_panel_id)
        .ok_or("Installed facing source parent missing")?;
    let poly=parent.polygon.as_mut().ok_or("Installed facing source polygon missing")?;
    let notches=poly.notches.remove(&spec.parent_edge_id)
        .ok_or("Installed facing mirrored source notches absent")?;
    if notches.len()!=2 || notches[0].t!=0.25 || notches[1].t!=0.75
        || notches.iter().any(|n|(n.depth_m-(spec.allowance_m*0.5).min(0.005)).abs()>1e-12) {
        return Err("Installed facing source notch identity changed".into());
    }
    Ok(bare)
}

/// Returns an isolated, source-bound parent-only project for the existing
/// native measurement solver. The old installed facing is verified first.
/// No original data is modified, and every graded child is removed as one unit.
pub fn strip_native_facing_dependency(old:&FittingProject)->Result<FittingProject,String>{
    verify_native_facing_dependency(old)?;
    let spec=old.native_facing_dependency.as_ref().unwrap();
    let mut stripped=old.clone();
    stripped.template=strip(&old.template,spec)?;
    let run=stripped.grade_run.as_mut().ok_or("Facing grade run absent")?;
    run.base_template=stripped.template.clone();
    run.graded_templates=run.graded_templates.iter()
        .map(|template|strip(template,spec)).collect::<Result<Vec<_>,_>>()?;
    stripped.native_facing_dependency=None;
    if let Some(bindings)=stripped.native_point_bindings.as_mut() {
        bindings.source_template=stripped.template.clone();
        bindings.valid_against(&bindings.source_template)?;
    }
    run.validate(&stripped.template)?;
    Ok(stripped)
}

fn same(a:&GarmentTemplate,b:&GarmentTemplate)->Result<bool,String>{
    Ok(serde_json::to_value(a).map_err(|e|e.to_string())?
        ==serde_json::to_value(b).map_err(|e|e.to_string())?)
}

fn assert_exact(template:&GarmentTemplate,spec:&PersistedFacingDependency)->Result<(),String>{
    let mut expected=strip(template,spec)?;
    build_facing(&mut expected,spec)?;
    if !same(template,&expected)? {
        return Err("Installed facing child, sewing or parent metadata tampered".into());
    }
    Ok(())
}

/// Installs one source-dependent physical child across all six authored sizes.
pub fn create_native_facing_dependency(
    project:&FittingProject,parent:&str,edge:&str,child:&str,depth:f64,allowance:f64
) -> Result<(GarmentTemplate,PersistedGradeRun,PersistedFacingDependency),String>{
    if project.native_facing_dependency.is_some() {
        return Err("Only one native facing dependency per saved project".into());
    }
    if project.piece_variant.is_some() {
        return Err("Existing piece variant must be regenerated for the added facing".into());
    }
    let existing=project.grade_run.as_ref().ok_or("Facing requires a persisted six-size grade run")?;
    existing.validate(&project.template)?;
    let mut spec=PersistedFacingDependency{
        version:if project.template.panels.iter().find(|p|p.id==parent)
            .and_then(|p|p.polygon.as_ref()).is_some_and(|p|!p.curves.is_empty()) {2} else {1},
        parent_panel_id:parent.into(),parent_edge_id:edge.into(),
        facing_id:child.into(),depth_m:depth,allowance_m:allowance,
        source_template:project.template.clone(),
    };
    let mut base;
    let mut run;
    loop {
        base=project.template.clone();
        run=existing.clone();
        let attempt=(|| {
            build_facing(&mut base,&spec)?;
            run.base_template=base.clone();
            for graded in &mut run.graded_templates {build_facing(graded,&spec)?;}
            run.validate(&base)?;
            Ok::<(),String>(())
        })();
        match attempt {
            Ok(())=>break,
            Err(_) if spec.version==2 => {spec.version=3;continue;},
            Err(error)=>return Err(error),
        }
    }
    spec.source_template=base.clone();
    run.validate(&base)?;
    let mut installed=project.clone();
    installed.template=base.clone();
    installed.grade_run=Some(run.clone());
    installed.native_facing_dependency=Some(spec.clone());
    verify_native_facing_dependency(&installed)?;
    Ok((base,run,spec))
}

pub fn verify_native_facing_dependency(project:&FittingProject)->Result<(),String>{
    let spec=project.native_facing_dependency.as_ref()
        .ok_or("No persisted native facing dependency")?;
    if !matches!(spec.version,1|2|3) || !same(&project.template,&spec.source_template)? {
        return Err("Stale or invalid facing sourceTemplate".into());
    }
    let run=project.grade_run.as_ref().ok_or("Native facing lacks six-size grade run")?;
    run.validate(&project.template)?;
    assert_exact(&project.template,spec)?;
    for (size,graded) in run.sizes.iter().zip(&run.graded_templates){
        assert_exact(graded,spec).map_err(|e|format!("Facing grade {size}: {e}"))?;
    }
    let physical=graded_production_cutlines(project)?;
    let seam=facing_seam_id(&spec.facing_id);
    for size in physical {
        let sewn=size.seams.iter().find(|s|s.seam_id==seam)
            .ok_or("Facing six-size seam proof missing")?;
        if sewn.allows_ease || sewn.mismatch_m>1e-8
            || sewn.notch_intervals_m.len()!=3 {
            return Err(format!("Facing size {} has eased or unequal stitches",size.size));
        }
        let child=size.panels.iter().find(|p|p.panel_id==spec.facing_id)
            .ok_or("Facing six-size physical CUT panel missing")?;
        let expected_edges=if spec.version==3 {TRUE_NORMAL_SEGMENTS+3} else {4};
        if child.cut.notches.len()!=2 || child.cut.edges.len()!=expected_edges {
            return Err("Facing CUT missing stable manufacturing marks".into());
        }
    }
    Ok(())
}

/// Recomputes the child from new qualified source rectangles, leaving all
/// unrelated panels and saved grade identities untouched.
pub fn regenerate_native_facing_dependency(
    old:&FittingProject,candidate_base:&mut GarmentTemplate,candidate_run:&mut PersistedGradeRun
) ->Result<(),String>{
    verify_native_facing_dependency(old)?;
    let spec=old.native_facing_dependency.as_ref().unwrap();
    let mut next=strip(candidate_base,spec)?;
    build_facing(&mut next,spec)?;
    let mut graded=Vec::with_capacity(candidate_run.graded_templates.len());
    for item in &candidate_run.graded_templates {
        let mut bare=strip(item,spec)?;
        build_facing(&mut bare,spec)?;
        graded.push(bare);
    }
    candidate_run.base_template=next.clone();
    candidate_run.graded_templates=graded;
    candidate_run.validate(&next)?;
    *candidate_base=next;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{garment::presets::GarmentKind, fitting::FittingProject};
    use std::path::PathBuf;

    fn sample()->FittingProject {
        let mut project=FittingProject::basic(GarmentKind::Tshirt,1,PathBuf::from("avatar.obj"));
        project.template.panels.truncate(2);
        project.template.seams.clear();
        for panel in &mut project.template.panels {
            panel.pattern.width=0.8;
            panel.pattern.height=0.8;
            let poly=panel.polygon.as_mut().unwrap();
            poly.points=vec![DVec2::new(0.,0.),DVec2::new(0.4,0.),
                DVec2::new(0.4,0.32),DVec2::new(0.,0.32)];
            poly.edges=vec!["top","right","bottom","left"].into_iter().map(str::to_string).collect();
            poly.seam_allowances=poly.edges.iter().map(|e|(e.clone(),0.01)).collect();
            poly.curves.clear();
            poly.notches.clear();
        }
        let sizes=["XS","S","M","L","XL","XXL"];
        let mut run=PersistedGradeRun{
            schema_version:1,sizes:sizes.iter().map(|s|s.to_string()).collect(),
            base_size:"M".into(),base_template:project.template.clone(),
            graded_templates:vec![project.template.clone();6],size_correspondence: Default::default(), pom_specs:vec![],
        };
        for (size,template) in run.graded_templates.iter_mut().enumerate(){
            let w=0.38+(size as f64)*0.01;
            for panel in &mut template.panels {
                let poly=panel.polygon.as_mut().unwrap();
                poly.points[1].x=w;
                poly.points[2].x=w;
            }
        }
        run.validate(&project.template).unwrap();
        project.grade_run=Some(run);
        project
    }

    fn installed()->FittingProject {
        let mut p=sample();
        let (base,run,spec)=create_native_facing_dependency(&p,"front","top","frontFacing",0.04,0.01).unwrap();
        p.template=base;
        p.grade_run=Some(run);
        p.native_facing_dependency=Some(spec);
        p
    }

    fn curved_sample()->FittingProject {
        let mut p=sample();
        let top="top".to_string();
        p.template.panels[0].polygon.as_mut().unwrap().curves.insert(
            top.clone(),[DVec2::new(0.13,-0.0004),DVec2::new(0.27,-0.0004)]);
        let run=p.grade_run.as_mut().unwrap();
        run.base_template=p.template.clone();
        for grade in &mut run.graded_templates {
            let polygon=grade.panels[0].polygon.as_mut().unwrap();
            let width=polygon.points[1].x;
            let delta=width-0.4;
            polygon.curves.insert(top.clone(),[
                DVec2::new(0.13+delta/3.,-0.0004),
                DVec2::new(0.27+2.*delta/3.,-0.0004)]);
        }
        run.validate(&p.template).unwrap();
        p
    }

    fn curved_installed()->FittingProject {
        let mut p=curved_sample();
        let (base,run,spec)=create_native_facing_dependency(
            &p,"front","top","frontFacing",0.04,0.01).unwrap();
        assert_eq!(spec.version,2);
        p.template=base;
        p.grade_run=Some(run);
        p.native_facing_dependency=Some(spec);
        p
    }

    fn true_normal_sample()->FittingProject {
        let mut p=sample();
        p.template.panels[0].polygon.as_mut().unwrap().curves.insert("top".into(),
            [DVec2::new(0.12,-0.02),DVec2::new(0.28,-0.02)]);
        let run=p.grade_run.as_mut().unwrap();
        run.base_template=p.template.clone();
        for grade in &mut run.graded_templates {
            let poly=grade.panels[0].polygon.as_mut().unwrap();
            let delta=poly.points[1].x-0.4;
            poly.curves.insert("top".into(),[
                DVec2::new(0.12+delta/3.,-0.02),DVec2::new(0.28+2.*delta/3.,-0.02)]);
        }
        run.validate(&p.template).unwrap();
        p
    }

    #[test]
    fn v3_true_inward_normal_six_size_physical_and_reopen() {
        let mut p=true_normal_sample();
        let (base,run,spec)=create_native_facing_dependency(&p,"front","top","frontFacing",0.04,0.01).unwrap();
        assert_eq!(spec.version,3);
        p.template=base;
        p.grade_run=Some(run);
        p.native_facing_dependency=Some(spec);
        verify_native_facing_dependency(&p).unwrap();
        let reopened:FittingProject=serde_json::from_str(&serde_json::to_string(&p).unwrap()).unwrap();
        verify_native_facing_dependency(&reopened).unwrap();
        for (i,size) in graded_production_cutlines(&reopened).unwrap().iter().enumerate() {
            let child=size.panels.iter().find(|panel|panel.panel_id=="frontFacing").unwrap();
            assert_eq!(child.cut.edges.len(),67);
            assert_eq!(child.cut.notches.len(),2);
            assert!(child.cut.area_m2>0.);
            let seam=size.seams.iter().find(|seam|seam.seam_id=="frontFacing_attach").unwrap();
            assert!(!seam.allows_ease && seam.mismatch_m<1e-8);
            let poly=reopened.grade_run.as_ref().unwrap().graded_templates[i].panels[2].polygon.as_ref().unwrap();
            assert_eq!(poly.points.len(),67);
            assert_eq!(poly.edges[0],"frontFacing_sew");
            assert_eq!(poly.edges[2],"frontFacing_hem_00");
            assert_eq!(poly.edges[65],"frontFacing_hem_63");
            assert_eq!(poly.edges[66],"frontFacing_side2");
            assert_eq!(poly.curves.len(),1);
        }
        let stripped=strip_native_facing_dependency(&reopened).unwrap();
        assert_eq!(stripped.template.panels.len(),2);
        let mut base=reopened.template.clone();
        let mut run=reopened.grade_run.clone().unwrap();
        for template in std::iter::once(&mut base).chain(run.graded_templates.iter_mut()) {
            let poly=template.panels[0].polygon.as_mut().unwrap();
            poly.points[1].x+=0.01;
            poly.points[2].x+=0.01;
            poly.curves.get_mut("top").unwrap()[0].x+=0.01/3.;
            poly.curves.get_mut("top").unwrap()[1].x+=0.02/3.;
        }
        regenerate_native_facing_dependency(&reopened,&mut base,&mut run).unwrap();
        let mut regenerated=reopened;
        regenerated.template=base;
        regenerated.grade_run=Some(run);
        regenerated.native_facing_dependency.as_mut().unwrap().source_template=regenerated.template.clone();
        verify_native_facing_dependency(&regenerated).unwrap();
    }

    #[test]
    fn v3_rejects_sharp_degenerate_and_forged_contour() {
        let mut p=true_normal_sample();
        p.template.panels[0].polygon.as_mut().unwrap().curves.get_mut("top").unwrap()[0]=DVec2::new(0.001,-0.2);
        assert!(create_native_facing_dependency(&p,"front","top","facing",0.04,0.01).is_err());
        let mut p=true_normal_sample();
        p.template.panels[0].polygon.as_mut().unwrap().curves.get_mut("top").unwrap()[0].x=-0.1;
        assert!(create_native_facing_dependency(&p,"front","top","facing",0.04,0.01).is_err());
        let mut p=true_normal_sample();
        p.template.panels[0].polygon.as_mut().unwrap().curves.insert("right".into(),[DVec2::new(0.4,0.1),DVec2::new(0.4,0.2)]);
        assert!(create_native_facing_dependency(&p,"front","top","facing",0.04,0.01).is_err());
        let mut p=true_normal_sample();
        let (base,run,spec)=create_native_facing_dependency(&p,"front","top","frontFacing",0.04,0.01).unwrap();
        p.template=base;p.grade_run=Some(run);p.native_facing_dependency=Some(spec);
        p.grade_run.as_mut().unwrap().graded_templates[4].panels[2].polygon.as_mut().unwrap().points[10].y+=0.0005;
        assert!(verify_native_facing_dependency(&p).is_err());
    }

    #[test]
    fn cubic_v2_six_size_physical_cut_sew_persistence_and_regeneration() {
        let original=curved_installed();
        verify_native_facing_dependency(&original).unwrap();
        let loaded:FittingProject=serde_json::from_str(&serde_json::to_string(&original).unwrap()).unwrap();
        verify_native_facing_dependency(&loaded).unwrap();
        let cuts=graded_production_cutlines(&loaded).unwrap();
        assert_eq!(cuts.len(),6);
        for (i,size) in cuts.iter().enumerate() {
            let seam=size.seams.iter().find(|s|s.seam_id=="frontFacing_attach").unwrap();
            assert!(seam.mismatch_m<1e-8);
            assert_eq!(seam.notch_intervals_m.len(),3);
            let child=size.panels.iter().find(|p|p.panel_id=="frontFacing").unwrap();
            assert_eq!(child.cut.notches.len(),2);
            assert_eq!(child.cut.edges.len(),4);
            let poly=loaded.grade_run.as_ref().unwrap().graded_templates[i].panels[2].polygon.as_ref().unwrap();
            assert_eq!(poly.curves.len(),2);
            assert_eq!(poly.curves["frontFacing_hem"][0],poly.curves["frontFacing_sew"][1]+DVec2::new(0.,0.04));
        }
        let mut base=loaded.template.clone();
        let mut run=loaded.grade_run.clone().unwrap();
        for template in std::iter::once(&mut base).chain(run.graded_templates.iter_mut()) {
            let poly=template.panels[0].polygon.as_mut().unwrap();
            poly.points[1].x+=0.01;
            poly.points[2].x+=0.01;
            poly.curves.get_mut("top").unwrap()[0].x+=0.01/3.;
            poly.curves.get_mut("top").unwrap()[1].x+=0.02/3.;
        }
        regenerate_native_facing_dependency(&loaded,&mut base,&mut run).unwrap();
        let mut regenerated=loaded;
        regenerated.template=base;
        regenerated.grade_run=Some(run);
        regenerated.native_facing_dependency.as_mut().unwrap().source_template=regenerated.template.clone();
        verify_native_facing_dependency(&regenerated).unwrap();
    }

    #[test]
    fn cubic_v2_unsafe_controls_and_forged_topology_fail_closed() {
        for (x,y,depth) in [(0.13,-0.015,0.04),(0.13,-0.005,0.08),
            (0.13,0.002,0.04),(0.001,-0.0004,0.04),(0.13,-0.0004,0.09)] {
            let mut p=curved_sample();
            p.template.panels[0].polygon.as_mut().unwrap().curves.get_mut("top").unwrap()[0]=DVec2::new(x,y);
            assert!(create_native_facing_dependency(&p,"front","top","facing",depth,0.01).is_err());
        }
        let mut p=curved_sample();
        p.template.panels[0].polygon.as_mut().unwrap().curves.insert(
            "right".into(),[DVec2::new(0.4,0.1),DVec2::new(0.4,0.2)]);
        assert!(create_native_facing_dependency(&p,"front","top","facing",0.04,0.01).is_err());
        let mut p=curved_sample();
        p.template.panels[0].polygon.as_mut().unwrap().free_curve_points.insert("top".into(),vec![]);
        assert!(create_native_facing_dependency(&p,"front","top","facing",0.04,0.01).is_err());
        let mut installed=curved_installed();
        installed.grade_run.as_mut().unwrap().graded_templates[0].panels[2]
            .polygon.as_mut().unwrap().curves.get_mut("frontFacing_hem").unwrap()[0].y+=0.001;
        assert!(verify_native_facing_dependency(&installed).is_err());
    }

    #[test]
    fn facing_real_six_size_cut_and_seam_and_saved_json() {
        let project=installed();
        verify_native_facing_dependency(&project).unwrap();
        let reopen:FittingProject=serde_json::from_str(&serde_json::to_string(&project).unwrap()).unwrap();
        verify_native_facing_dependency(&reopen).unwrap();
        let cuts=graded_production_cutlines(&project).unwrap();
        assert_eq!(cuts.len(),6);
        for (index,size) in cuts.iter().enumerate(){
            assert_eq!(size.panels.len(),3);
            let seam=size.seams.iter().find(|s|s.seam_id=="frontFacing_attach").unwrap();
            assert!(seam.mismatch_m < 1e-9);
            let child=size.panels.iter().find(|p|p.panel_id=="frontFacing").unwrap();
            assert_eq!(child.cut.notches.len(),2);
            let length=child.sewline_edge_lengths_m["frontFacing_sew"];
            assert!((length-(0.38+index as f64*0.01)).abs()<1e-9);
        }
    }

    #[test]
    fn tamper_saved_child_allowance_notches_ease_and_source_fails(){
        let p=installed();
        let mut invalid=p.clone();
        invalid.grade_run.as_mut().unwrap().graded_templates[0].panels[2]
            .polygon.as_mut().unwrap().points[1].x+=0.001;
        assert!(verify_native_facing_dependency(&invalid).is_err());
        let mut invalid=p.clone();
        invalid.template.panels[2].polygon.as_mut().unwrap()
            .seam_allowances.insert("frontFacing_sew".into(),0.02);
        assert!(verify_native_facing_dependency(&invalid).is_err());
        let mut invalid=p.clone();
        invalid.template.seams.last_mut().unwrap().allow_ease=true;
        assert!(verify_native_facing_dependency(&invalid).is_err());
        let mut invalid=p.clone();
        invalid.template.panels[0].polygon.as_mut().unwrap().notches.clear();
        assert!(verify_native_facing_dependency(&invalid).is_err());
        let mut invalid=p.clone();
        invalid.native_facing_dependency.as_mut().unwrap().depth_m=0.06;
        assert!(verify_native_facing_dependency(&invalid).is_err());
    }

    #[test]
    fn regeneration_updates_only_dependent_facing_and_rejects_trapezoid(){
        let project=installed();
        let mut base=project.template.clone();
        let mut run=project.grade_run.clone().unwrap();
        for panel in &mut base.panels[..2]{
            let poly=panel.polygon.as_mut().unwrap();
            poly.points[1].x+=0.02;poly.points[2].x+=0.02;
        }
        for graded in &mut run.graded_templates {
            for panel in &mut graded.panels[..2] {
                let poly=panel.polygon.as_mut().unwrap();
                poly.points[1].x+=0.02;poly.points[2].x+=0.02;
            }
        }
        regenerate_native_facing_dependency(&project,&mut base,&mut run).unwrap();
        assert_eq!(run.graded_templates[0].panels[2].polygon.as_ref().unwrap().points[1].x,0.4);
        let mut tampered=base.clone();
        tampered.panels[0].polygon.as_mut().unwrap().points[2].x+=0.003;
        assert!(regenerate_native_facing_dependency(&project,&mut tampered,&mut run).is_err());
    }

    #[test]
    fn invalid_parent_edge_or_occupied_edge_does_not_install(){
        let p=sample();
        assert!(create_native_facing_dependency(&p,"front","right","facing",0.04,0.01).is_err());
        assert!(create_native_facing_dependency(&p,"front","top","front",0.04,0.01).is_err());
        assert!(create_native_facing_dependency(&p,"front","top","facing",f64::NAN,0.01).is_err());
        let mut trapezoid=p.clone();
        trapezoid.template.panels[0].polygon.as_mut().unwrap().points[2].x+=0.005;
        assert!(create_native_facing_dependency(&trapezoid,"front","top","facing",0.04,0.01).is_err());
    }

    #[test]
    fn stripped_project_rebases_graph_and_preserves_original_size_sources(){
        let original=installed();
        let saved=serde_json::to_value(&original).unwrap();
        let stripped=strip_native_facing_dependency(&original).unwrap();
        assert_eq!(stripped.template.panels.len(),2);
        assert!(stripped.native_facing_dependency.is_none());
        assert!(stripped.template.seams.is_empty());
        assert!(stripped.template.panels[0].polygon.as_ref().unwrap().notches.is_empty());
        stripped.grade_run.as_ref().unwrap().validate(&stripped.template).unwrap();
        assert_eq!(serde_json::to_value(&original).unwrap(),saved);
        let mut forged=original;
        forged.grade_run.as_mut().unwrap().graded_templates[4].panels[2]
            .polygon.as_mut().unwrap().points[2].y+=0.002;
        assert!(strip_native_facing_dependency(&forged).is_err());
    }
}
