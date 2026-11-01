//! Independently drafted engineering fixtures, not production sewing patterns.
use super::{
    GarmentTemplate,
    polygon::PolygonPattern,
    seam::{BoundaryRef, SeamSpec, Side},
    template::{Fabric, FabricProperties, Panel, Placement},
};
use crate::model::Pattern;
use clap::ValueEnum;
use glam::{DVec2, DVec3};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, ValueEnum, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GarmentKind {
    Tshirt,
    Dress,
}
impl GarmentKind {
    pub fn name(self) -> &'static str {
        match self {
            Self::Tshirt => "tshirt",
            Self::Dress => "dress",
        }
    }
}
pub fn basic(kind: GarmentKind, subdivisions: u32) -> GarmentTemplate {
    let (points, edges, sewn, height): (Vec<[f64; 2]>, Vec<&str>, Vec<usize>, f64) = match kind {
        GarmentKind::Tshirt => (
            vec![
                [0.42, 0.0],
                [0.46, 0.065],
                [0.54, 0.065],
                [0.58, 0.0],
                [0.72, 0.04],
                [0.98, 0.24],
                [0.84, 0.40],
                [0.72, 0.29],
                [0.78, 0.66],
                [0.22, 0.66],
                [0.28, 0.29],
                [0.16, 0.40],
                [0.02, 0.24],
                [0.28, 0.04],
            ],
            vec![
                "neck-left",
                "neck-bottom",
                "neck-right",
                "shoulder-right",
                "sleeve-top-right",
                "cuff-right",
                "sleeve-under-right",
                "side-right",
                "hem",
                "side-left",
                "sleeve-under-left",
                "cuff-left",
                "sleeve-top-left",
                "shoulder-left",
            ],
            vec![3, 4, 6, 7, 9, 10, 12, 13],
            0.66,
        ),
        GarmentKind::Dress => (
            vec![
                [0.42, 0.0],
                [0.46, 0.065],
                [0.54, 0.065],
                [0.58, 0.0],
                [0.72, 0.035],
                [0.74, 0.23],
                [0.94, 1.08],
                [0.06, 1.08],
                [0.26, 0.23],
                [0.28, 0.035],
            ],
            vec![
                "neck-left",
                "neck-bottom",
                "neck-right",
                "shoulder-right",
                "armhole-right",
                "side-right",
                "hem",
                "side-left",
                "armhole-left",
                "shoulder-left",
            ],
            vec![3, 5, 7, 9],
            1.08,
        ),
    };
    let polygon = PolygonPattern {
        holes: vec![],
        lines: vec![],
        curves: Default::default(),
        free_curve_points: Default::default(),
        vertex_ids: Default::default(),
        vertex_mirror_groups: Default::default(),
        target_lengths: Default::default(),
        notches: Default::default(),
        seam_allowances: Default::default(),
        annotations: vec![],
        measurements: vec![],
        points: points.into_iter().map(DVec2::from_array).collect(),
        edges: edges.iter().map(|s| s.to_string()).collect(),
        subdivisions,
        meshing: Some(super::meshing::MeshingSettings {
            target_edge_m: 0.1 / 2.0_f64.powi(subdivisions as i32),
            ..Default::default()
        }),
    };
    // `Pattern` is the authored drafting envelope, not the stitched contour.
    // The engineering presets use a fixed material-space lower anchor and
    // the XS–XXL sample grade reaches 1.045x about that anchor. Reserve 5%
    // headroom above the original 1.0m width / garment-specific height;
    // keep every source point, seam and physical placement unchanged.
    // Previously saved project files retain their serialized v1/v2 bounds.
    const POSITIVE_SIZE_GRADE_HEADROOM: f64 = 1.05;
    let panels = [("front", 0.38), ("back", -0.15)]
        .into_iter()
        .map(|(id, z)| Panel {
            id: id.into(),
            name: format!("{} {id}", kind.name()),
            pattern: Pattern {
                width: POSITIVE_SIZE_GRADE_HEADROOM,
                height: height * POSITIVE_SIZE_GRADE_HEADROOM,
                nx: 1,
                ny: 1,
            },
            polygon: Some(polygon.clone()),
            fabric: "woven-reference".into(),
            grain_degrees: 90.0,
            placement: Placement {
                translation: DVec3::new(-0.5, 1.50, z),
                ..Default::default()
            },
            pins: vec![],
            pin_points: vec![],
            layout_2d: None,
            layout_rotation_degrees: 0.,
        })
        .collect();
    let seams = sewn
        .into_iter()
        .map(|i| SeamSpec {
            id: edges[i].into(),
            a: BoundaryRef {
                panel: "front".into(),
                side: Side::Top,
                edge: Some(edges[i].into()),
                range: [0.0, 1.0],
            },
            b: BoundaryRef {
                panel: "back".into(),
                side: Side::Top,
                edge: Some(edges[i].into()),
                range: [0.0, 1.0],
            },
            reverse_b: false,
            notches: vec![],
            stiffness: 50_000.0,
            allow_ease: false,
        })
        .collect();
    GarmentTemplate {
        format: "marvelous-cloth-template".into(),
        version: 2,
        name: format!("{} / MakeHuman 1.75 m engineering fixture", kind.name()),
        fabrics: vec![Fabric {
            id: "woven-reference".into(),
            name: "Uncalibrated woven reference".into(),
            properties: FabricProperties::default(),
        }],
        panels,
        seams,
    }
}

#[cfg(test)]
mod grading_envelope_tests {
    use super::*;

    #[test]
    fn presets_allow_45_per_mille_positive_size_grading_without_changing_source_contours() {
        for kind in [GarmentKind::Tshirt, GarmentKind::Dress] {
            let template = basic(kind, 1);
            let original_height = match kind {
                GarmentKind::Tshirt => 0.66,
                GarmentKind::Dress => 1.08,
            };
            assert_eq!(template.version, 2);
            assert_eq!(template.panels.len(), 2);
            assert_eq!(template.seams.len(), match kind { GarmentKind::Tshirt => 8, GarmentKind::Dress => 4 });
            for panel in &template.panels {
                assert_eq!(panel.pattern.width, 1.05);
                assert!((panel.pattern.height - original_height * 1.05).abs() < 1e-12);
                let polygon = panel.polygon.as_ref().unwrap();
                let anchor = polygon.points.iter().fold(DVec2::splat(f64::INFINITY), |acc, point| acc.min(*point));
                assert_eq!(anchor.y, 0.0);
                for factor in [0.97, 0.985, 1.0, 1.015, 1.03, 1.045] {
                    let mut graded = template.clone();
                    for graded_panel in &mut graded.panels {
                        for point in &mut graded_panel.polygon.as_mut().unwrap().points {
                            *point = anchor + (*point - anchor) * factor;
                        }
                    }
                    // Compiles all named seams using the strict native panel
                    // bounds; the authored source template remains identical.
                    graded.compile().expect("XS–XXL contour stays within preset authored envelope");
                }
                assert_eq!(panel.polygon.as_ref().unwrap().points, polygon.points);
            }
            template.compile().expect("unchanged source template compiles");
        }
    }

    #[test]
    fn envelope_still_rejects_negative_and_excessive_grade_points() {
        let template = basic(GarmentKind::Tshirt, 1);
        let mut below_zero = template.clone();
        below_zero.panels[0].polygon.as_mut().unwrap().points[0].y = -0.000001;
        assert!(below_zero.compile().is_err());
        let mut outside = template;
        outside.panels[0].polygon.as_mut().unwrap().points[0].x = 1.051;
        assert!(outside.compile().is_err());
    }
}
