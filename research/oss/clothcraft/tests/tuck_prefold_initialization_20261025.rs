//! The sewn tuck prefold is an initial 3D arrangement, never a new rest pattern.
use glam::{DVec2, DVec3};
use marvelous_cloth::{authoring::{self, Command}, garment::{meshing::MeshingSettings, presets::{self, GarmentKind}}};

fn fixture() -> marvelous_cloth::garment::GarmentTemplate {
    authoring::apply(&presets::basic(GarmentKind::Tshirt, 0), Command::Polygon {
        points: vec![DVec2::ZERO, DVec2::new(0.3, 0.), DVec2::new(0.3, 0.2), DVec2::new(0., 0.2)],
        tangents: vec![],
        meshing: MeshingSettings::default(),
        fabric: "woven-reference".into(),
        replace: true,
    }).unwrap().template
}

#[test]
fn tuck_prefold_changes_only_initial_positions_and_keeps_deterministic_rest() {
    let source=fixture();
    let untouched=source.compile().unwrap();
    let untouched_again=source.compile().unwrap();
    assert_eq!(untouched.initial_state.x, untouched_again.initial_state.x,
        "no-tuck compile must preserve unchanged flat placement");
    for (uv,x) in untouched.mesh.uv.iter().zip(&untouched.initial_state.x) {
        assert_eq!(*x,source.panels[0].placement.transform(DVec3::new(uv.x,-uv.y,0.)),
            "no-tuck vertices must remain on the original panel plane");
    }
    let panel=source.panels[0].id.clone();
    let edge=source.panels[0].polygon.as_ref().unwrap().edges[0].clone();
    let edited=authoring::apply(&source, Command::TuckFoldSew {
        panel, edge, left_t:0.35, right_t:0.45, depth_m:0.08,
    }).unwrap().template;
    let compiled=edited.compile().unwrap();
    let again=edited.compile().unwrap();
    assert_eq!(compiled.mesh.uv, again.mesh.uv);
    assert_eq!(compiled.mesh.rest_area, again.mesh.rest_area);
    assert_eq!(compiled.initial_state.x, again.initial_state.x);
    assert!(compiled.initial_state.x.iter().all(|p|p.is_finite()));
    assert!(compiled.initial_state.v.iter().all(|v|*v==DVec3::ZERO));

    let mut without_seam=edited.clone();
    without_seam.seams.clear();
    let flat=without_seam.compile().unwrap();
    assert_eq!(compiled.mesh.uv, flat.mesh.uv);
    assert_eq!(compiled.mesh.rest_area, flat.mesh.rest_area);
    assert_eq!(compiled.mesh.masses, flat.mesh.masses);
    assert_eq!(compiled.mesh.triangles.len(), flat.mesh.triangles.len());
    assert!(compiled.initial_state.x.iter().zip(&flat.initial_state.x)
        .any(|(p,q)|p.distance(*q)>1e-6), "tuck must initialize a real 3D bend");
    assert!(compiled.initial_state.x.iter().zip(&flat.initial_state.x)
        .any(|(p,q)|(p.z-q.z).abs()>1e-6), "tuck prefold must lift vertices out of the plane");
    let current_gap=compiled.max_seam_gap(&compiled.initial_state.x);
    let previous_gap=compiled.max_seam_gap(&flat.initial_state.x);
    assert!(current_gap+1e-6<previous_gap,
        "prefold should reduce seam start gap from {previous_gap} to {current_gap}");
    let max_shift=compiled.initial_state.x.iter().zip(&flat.initial_state.x)
        .map(|(p,q)|p.distance(*q)).fold(0.0,f64::max);
    assert!(max_shift<0.04, "initial bend must remain mild: {max_shift}");
}

#[test]
fn prefold_does_not_displace_other_panels() {
    let mut source=fixture();
    let second=source.panels[0].clone();
    let mut second=second;
    second.id="untouched".into();
    second.placement.translation=DVec3::new(0.4,0.0,0.1);
    source.panels.push(second);
    let panel=source.panels[0].id.clone();
    let edge=source.panels[0].polygon.as_ref().unwrap().edges[0].clone();
    let edited=authoring::apply(&source,Command::TuckFoldSew{
        panel,edge,left_t:0.35,right_t:0.45,depth_m:0.08,
    }).unwrap().template;
    let before=source.compile().unwrap();
    let after=edited.compile().unwrap();
    let old=before.panels.iter().find(|p|p.id=="untouched").unwrap();
    let new=after.panels.iter().find(|p|p.id=="untouched").unwrap();
    assert_eq!(
        &before.initial_state.x[old.vertices.clone()],
        &after.initial_state.x[new.vertices.clone()],
    );
}
