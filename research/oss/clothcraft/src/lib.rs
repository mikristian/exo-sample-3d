//! SI units throughout: metres, kilograms, seconds, Newtons.
pub mod authoring;
pub mod avatar;
pub mod contact;
pub mod energy;
pub mod fabrics;
pub mod fitting;
pub mod grade_pom_audit_20261027;
pub mod garment;
#[cfg(feature = "desktop")]
pub mod gpu_vbd;
pub mod math;
pub mod model;
pub mod native_reference_recompute_20261027;
pub mod native_multi_panel_measurement_20261030;
pub mod native_cross_piece_link_20261030;
pub mod native_measurement_formulas_20261027;
pub mod native_six_size_recompute_20261027;
pub mod native_fabric_grade_chart_20261027;
pub mod ogc;
pub mod picking;
pub mod project;
/// Shared optional renderer; the numerical modules do not depend on this module.
#[cfg(feature = "desktop")]
pub mod render;
pub mod solver;
pub mod vbd;

pub mod native_linked_industrial_propagation_20261027;
pub mod native_piece_variant_20261027;
pub mod native_variant_instance_20261027;
pub mod native_facing_dependency_20261027;
