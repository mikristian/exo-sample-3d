//! Native uncut fold/tuck: sewn INTERNAL paths, unchanged contour and rest area.
use glam::DVec2;
use marvelous_cloth::{authoring::{self,Command,History},garment::{meshing::MeshingSettings,presets::{self,GarmentKind}}};

fn rectangle() -> marvelous_cloth::garment::GarmentTemplate {
    authoring::apply(&presets::basic(GarmentKind::Tshirt,0),Command::Polygon {
        points:vec![DVec2::ZERO,DVec2::new(0.3,0.),DVec2::new(0.3,0.2),DVec2::new(0.,0.2)],
        tangents:vec![],meshing:MeshingSettings::default(),fabric:"woven-reference".into(),replace:true,
    }).unwrap().template
}

#[test]
fn uncut_tuck_retains_rest_area_and_compiles_live_solver_seam_and_undo() {
    let source=rectangle();
    let previous=source.compile().unwrap();
    let before_area:f64=previous.mesh.triangles.iter().map(|tri|tri.area).sum();
    let panel=source.panels[0].id.clone();
    let edge=source.panels[0].polygon.as_ref().unwrap().edges[0].clone();
    let result=authoring::apply(&source,Command::TuckFoldSew{
        panel,edge,left_t:0.35,right_t:0.45,depth_m:0.08,
    }).unwrap();
    let poly=result.template.panels[0].polygon.as_ref().unwrap();
    let original=source.panels[0].polygon.as_ref().unwrap();
    assert_eq!(poly.points,original.points,"uncut panel contour must remain unchanged");
    assert_eq!(poly.edges,original.edges,"sewing must not rename or cut the contour");
    assert_eq!(poly.lines.len(),2);
    assert_eq!(result.template.seams.len(),1);
    assert!(!result.template.seams[0].reverse_b);
    assert_eq!(result.garment.seams.len(),1);
    assert!(!result.garment.seams[0].samples.is_empty());
    let area:f64=result.garment.mesh.triangles.iter().map(|tri|tri.area).sum();
    assert!((area-before_area).abs()<1e-9,"inserting seam paths must preserve all material area");
    let initial_gap=result.garment.seams[0].max_gap(&result.garment.initial_state.x);
    assert!(initial_gap.is_finite() && initial_gap > 0.025 && initial_gap <= 0.03000001,
        "the default conservative prefold cannot claim 2mm closure: {initial_gap} m");
    let reopened:marvelous_cloth::garment::GarmentTemplate=serde_json::from_slice(&serde_json::to_vec(&result.template).unwrap()).unwrap();
    assert_eq!(reopened.seams.len(),1);
    assert_eq!(reopened.panels[0].polygon.as_ref().unwrap().lines.len(),2);
    assert_eq!(reopened.compile().unwrap().seams.len(),1);
    let mut history=History::default();history.record(source.clone());
    let restored=history.restore(&result.template,false).unwrap();
    assert_eq!(serde_json::to_vec(&restored.template).unwrap(),serde_json::to_vec(&source).unwrap());
}

#[test]
fn invalid_tuck_never_changes_source() {
    let source=rectangle();
    let original=serde_json::to_vec(&source).unwrap();
    let panel=source.panels[0].id.clone();
    let edge=source.panels[0].polygon.as_ref().unwrap().edges[0].clone();
    for (left,right,depth) in [(0.45,0.35,0.08),(0.35,0.45,0.),(0.35,0.45,0.3),(f64::NAN,0.45,0.08)] {
        assert!(authoring::apply(&source,Command::TuckFoldSew{
            panel:panel.clone(),edge:edge.clone(),left_t:left,right_t:right,depth_m:depth,
        }).is_err());
        assert_eq!(serde_json::to_vec(&source).unwrap(),original);
    }
}

fn tuck(source:&marvelous_cloth::garment::GarmentTemplate,left:f64,right:f64,depth:f64)->Result<authoring::Edit,String>{
    authoring::apply(source,Command::TuckFoldSew{
        panel:source.panels[0].id.clone(),
        edge:source.panels[0].polygon.as_ref().unwrap().edges[0].clone(),
        left_t:left,right_t:right,depth_m:depth,
    })
}

#[test]
fn two_spaced_tucks_compile_separate_live_constraints_without_losing_area(){
    let original=rectangle();
    let a=tuck(&original,0.10,0.20,0.06).unwrap();
    let b=tuck(&a.template,0.55,0.65,0.06).unwrap();
    let c=tuck(&b.template,0.78,0.88,0.06).unwrap();
    assert_eq!(c.template.seams.len(),3);
    assert_eq!(c.template.panels[0].polygon.as_ref().unwrap().lines.len(),6);
    assert_eq!(c.garment.seams.len(),3);
    assert!(c.garment.seams.iter().all(|seam|!seam.samples.is_empty()));
    assert!(c.garment.seams.iter().all(|seam|
        seam.max_gap(&c.garment.initial_state.x)>0.010),
        "default pretucked geometry must not masquerade as verified closure");
    let total_area: f64=c.garment.mesh.triangles.iter().map(|tri|tri.area).sum();
    assert!((total_area-0.06).abs()<1e-9);
}

#[test]
fn duplicate_nested_and_adjacent_tuck_stations_fail_closed(){
    let first=tuck(&rectangle(),0.3,0.5,0.06).unwrap();
    let source=first.template;
    let serial=serde_json::to_vec(&source).unwrap();
    for (left,right) in [(0.3,0.5),(0.32,0.48),(0.2,0.6),(0.49,0.58),(0.5,0.55)] {
        assert!(tuck(&source,left,right,0.06).is_err(),"overlapping [{left},{right}] must be rejected");
        assert_eq!(serde_json::to_vec(&source).unwrap(),serial);
    }
}

#[test]
fn deep_tuck_escaping_panel_is_rejected_and_source_unchanged(){
    let original=rectangle();
    let serial=serde_json::to_vec(&original).unwrap();
    let attempted=tuck(&original,0.35,0.45,0.15);
    assert!(attempted.is_ok(),"150mm fold fits 200mm panel");
    let narrow=authoring::apply(&presets::basic(GarmentKind::Tshirt,0),Command::Polygon{
        points:vec![DVec2::ZERO,DVec2::new(0.3,0.),DVec2::new(0.3,0.07),DVec2::new(0.,0.07)],
        tangents:vec![],meshing:MeshingSettings::default(),fabric:"woven-reference".into(),replace:true,
    }).unwrap().template;
    assert!(tuck(&narrow,0.35,0.45,0.12).is_err(),"internal line leaves short panel");
    assert_eq!(serde_json::to_vec(&original).unwrap(),serial);
}

#[test]
fn crossing_preexisting_internal_line_fails_closed(){
    let original=rectangle();
    let panel=original.panels[0].id.clone();
    let with_line=authoring::apply(&original,Command::InternalLine{
        panel,points:vec![DVec2::new(0.08,0.04),DVec2::new(0.2,0.04)],
        tangents:vec![DVec2::ZERO;2],
    }).unwrap().template;
    assert!(tuck(&with_line,0.35,0.45,0.08).is_err(),"tuck crosses existing internal line");
}

#[test]
fn tuck_entering_a_real_hole_is_rejected(){
    let mut source=rectangle();
    let poly=source.panels[0].polygon.as_mut().unwrap();
    poly.holes.push(marvelous_cloth::garment::domain::Hole{
        points:vec![DVec2::new(0.14,0.07),DVec2::new(0.14,0.03),DVec2::new(0.115,0.03),DVec2::new(0.115,0.07)],
        edges:vec!["h0".into(),"h1".into(),"h2".into(),"h3".into()],
    });
    assert!(source.compile().is_ok(),"hole fixture should be physically valid");
    let original=serde_json::to_vec(&source).unwrap();
    let result=tuck(&source,0.35,0.45,0.08);
    assert!(result.is_err(),"internal fold line crosses a hole");
    assert_eq!(serde_json::to_vec(&source).unwrap(),original);
}
