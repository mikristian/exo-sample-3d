//! Read-only numerical inspection of a persisted named-size native POM catalog.
//! Material coordinates are metres; reported distances are millimetres.
use crate::fitting::FittingProject;
use serde_json::{json, Value};

/// Follow directed authored edges by increasing vertex index, with at most one wrap.
/// The polygon's material (u,v) convention displays positive v downward.
fn clockwise_sewline_path_mm(
    polygon: &crate::garment::polygon::PolygonPattern,
    from: usize,
    to: usize,
) -> Result<f64, String> {
    let n = polygon.points.len();
    if n < 3 || polygon.edges.len() != n || from >= n || to >= n || from == to {
        return Err("Invalid sewline-path endpoints or boundary topology".into());
    }
    let count = if to > from { to - from } else { n - from + to };
    if count == 0 || count >= n {
        return Err("Unsafe sewline-path traversal".into());
    }
    let mut total = 0.0;
    for step in 0..count {
        let index = (from + step) % n;
        let samples = polygon.edge_points(index)?;
        if samples.len() < 2 || samples.len() > 1_000_000
            || samples.iter().any(|p| !p.is_finite()) {
            return Err(format!("Invalid sewline-path samples at edge {index}"));
        }
        let start = polygon.points[index];
        let end = polygon.points[(index + 1) % n];
        if !start.is_finite() || !end.is_finite()
            || samples.first().unwrap().distance(start) > 1e-7
            || samples.last().unwrap().distance(end) > 1e-7 {
            return Err(format!("Disconnected sewline-path samples at edge {index}"));
        }
        for pair in samples.windows(2) {
            let segment = pair[0].distance(pair[1]);
            if !segment.is_finite() || segment <= 1e-12 {
                return Err(format!("Degenerate sewline-path segment at edge {index}"));
            }
            total += segment;
            if !total.is_finite() || total > 100.0 {
                return Err("Sewline-path exceeds safe material length".into());
            }
        }
    }
    Ok(total * 1000.0)
}

pub fn audit_persisted_grade_pom20261027(project: &FittingProject) -> Result<Value, String> {
    let run = project.grade_run.as_ref().ok_or("No persisted native grade run")?;
    run.validate(&project.template)?;
    if run.pom_specs.is_empty() {
        return Err("POM audit requires at least one authored POM specification".into());
    }
    if run.pom_specs.len() > 64 {
        return Err("POM audit exceeds 64 POM specifications".into());
    }

    let mut rows = Vec::with_capacity(run.pom_specs.len() * run.sizes.len());
    let (mut scored, mut passed, mut failed, mut unscored) = (0usize, 0usize, 0usize, 0usize);
    let mut blockers = Vec::new();
    for spec in &run.pom_specs {
        for (size, template) in run.sizes.iter().zip(&run.graded_templates) {
            let panel = template.panels.iter().find(|p| p.id == spec.panel_id)
                .ok_or_else(|| format!("POM {} size {} has no panel {}", spec.id, size, spec.panel_id))?;
            let polygon = panel.polygon.as_ref()
                .ok_or_else(|| format!("POM {} size {} has no material polygon", spec.id, size))?;
            let length_m = match spec.kind.as_str() {
                "anchor-distance" => {
                    let a = spec.from_point.ok_or_else(|| format!("POM {} missing from point", spec.id))?;
                    let b = spec.to_point.ok_or_else(|| format!("POM {} missing to point", spec.id))?;
                    let x = polygon.points.get(a).ok_or_else(|| format!("POM {} missing point {}", spec.id, a))?;
                    let y = polygon.points.get(b).ok_or_else(|| format!("POM {} missing point {}", spec.id, b))?;
                    if !x.is_finite() || !y.is_finite() || a == b {
                        return Err(format!("POM {} invalid material anchors in {}", spec.id, size));
                    }
                    x.distance(*y)
                }
                "sewline-edge" => {
                    let edge = spec.edge.as_deref().ok_or_else(|| format!("POM {} missing seam edge", spec.id))?;
                    let index = polygon.edges.iter().position(|name| name == edge)
                        .ok_or_else(|| format!("POM {} missing seam edge {} in {}", spec.id, edge, size))?;
                    let points = polygon.edge_points(index)
                        .map_err(|err| format!("POM {} invalid edge geometry in {}: {}", spec.id, size, err))?;
                    if points.len() < 2 || points.iter().any(|p| !p.is_finite()) {
                        return Err(format!("POM {} invalid sampled seam in {}", spec.id, size));
                    }
                    points.windows(2).map(|w| w[0].distance(w[1])).sum::<f64>()
                }
                "sewline-path" => {
                    if spec.edge.is_some() {
                        return Err(format!("POM {} sewline-path cannot name a single edge", spec.id));
                    }
                    let from = spec.from_point.ok_or_else(|| format!("POM {} missing starting vertex", spec.id))?;
                    let to = spec.to_point.ok_or_else(|| format!("POM {} missing ending vertex", spec.id))?;
                    clockwise_sewline_path_mm(polygon, from, to)
                        .map_err(|e| format!("POM {} size {}: {}", spec.id, size, e))? / 1000.0
                }
                _ => return Err(format!("POM {} unsupported measurement kind", spec.id)),
            };
            let measured = length_m * 1000.0;
            if !measured.is_finite() || measured <= 0.0 || measured > 100_000.0 {
                return Err(format!("POM {} invalid measured length in {}", spec.id, size));
            }
            let target = spec.targets_mm.get(size)
                .ok_or_else(|| format!("POM {} missing size target key {}", spec.id, size))?;
            let delta = target.map(|value| measured - value);
            let within = delta.map(|difference| difference.abs() <= spec.tolerance_mm);
            match within {
                Some(true) => { scored += 1; passed += 1; }
                Some(false) => {
                    scored += 1; failed += 1;
                    blockers.push(format!("POM {} size {} exceeds tolerance: delta {:.6} mm, tolerance {:.6} mm", spec.id, size, delta.unwrap(), spec.tolerance_mm));
                }
                None => {
                    unscored += 1;
                    blockers.push(format!("POM {} size {} has no authored target", spec.id, size));
                }
            }
            rows.push(json!({
                "pomId": spec.id, "label": spec.label, "panelId": spec.panel_id,
                "kind": spec.kind, "size": size, "measuredMm": measured,
                "targetMm": target, "deltaMm": delta, "toleranceMm": spec.tolerance_mm,
                "withinTolerance": within, "scored": within.is_some()
            }));
        }
    }
    Ok(json!({
        "format": if run.schema_version == 1 {"exo-native-grade-pom-audit.v1"} else {"exo-native-named-grade-pom-audit.v2"},
        "schemaVersion": run.schema_version, "source": "persisted-native-grade-run",
        "units": "mm", "sizeCount": run.sizes.len(), "pomCount": run.pom_specs.len(),
        "total": rows.len(), "scored": scored, "passed": passed,
        "failed": failed, "unscored": unscored,
        "numericalAcceptanceComplete": failed == 0 && unscored == 0,
        "acceptanceComplete": failed == 0 && unscored == 0,
        "factoryApproved": false, "blockers": blockers, "rows": rows
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fitting::{GradedPomSpec, PersistedGradeRun};
    use crate::garment::presets::GarmentKind;
    use std::{collections::BTreeMap, path::PathBuf};

    #[test]
    fn four_named_sizes_measure_real_geometry_and_refuse_bad_targets() {
        let mut project = fixture();
        let run = project.grade_run.as_mut().unwrap();
        run.schema_version = 2;
        run.sizes = ["2", "4", "6", "8"].iter().map(|s| s.to_string()).collect();
        run.base_size = "6".into();
        run.graded_templates.truncate(4);
        run.size_correspondence.insert("US12".into(), "8".into());
        for spec in &mut run.pom_specs {
            let measured = spec.targets_mm.get("M").copied().flatten().unwrap();
            spec.targets_mm = run.sizes.iter().map(|s| (s.clone(), Some(measured))).collect();
        }
        let proof = audit_persisted_grade_pom20261027(&project).unwrap();
        assert_eq!(proof["format"], "exo-native-named-grade-pom-audit.v2");
        assert_eq!(proof["sizeCount"], 4);
        assert_eq!(proof["total"], 8);
        assert_eq!(proof["passed"], 8);
        assert_eq!(proof["factoryApproved"], false);
        let mut wrong = project.clone();
        wrong.grade_run.as_mut().unwrap().pom_specs[0].targets_mm.insert("8".into(), Some(9999.));
        let refusal = audit_persisted_grade_pom20261027(&wrong).unwrap();
        assert_eq!(refusal["acceptanceComplete"], false);
        assert_eq!(refusal["failed"], 1);
        let mut missing = project.clone();
        missing.grade_run.as_mut().unwrap().pom_specs[0].targets_mm.remove("8");
        assert!(audit_persisted_grade_pom20261027(&missing).is_err());
    }

    fn fixture() -> FittingProject {
        let mut project = FittingProject::basic(GarmentKind::Tshirt, 2, PathBuf::from("avatar.obj"));
        let sizes = ["XS", "S", "M", "L", "XL", "XXL"];
        let panel = project.template.panels.iter().find(|p| p.polygon.is_some()).unwrap();
        let shape = panel.polygon.as_ref().unwrap();
        let measured = shape.points[0].distance(shape.points[1]) * 1000.0;
        let seam = shape.edge_points(0).unwrap().windows(2)
            .map(|p| p[0].distance(p[1])).sum::<f64>() * 1000.0;
        let make = |id: &str, kind: &str, target: f64| GradedPomSpec {
            id: id.into(), label: id.into(), panel_id: panel.id.clone(), kind: kind.into(),
            tolerance_mm: 0.01, from_point: if kind == "anchor-distance" { Some(0) } else { None },
            to_point: if kind == "anchor-distance" { Some(1) } else { None },
            edge: if kind == "sewline-edge" { Some(shape.edges[0].clone()) } else { None },
            targets_mm: sizes.iter().map(|s| (s.to_string(), Some(target))).collect::<BTreeMap<_, _>>(),
        };
        project.grade_run = Some(PersistedGradeRun {
            schema_version: 1, sizes: sizes.iter().map(|s| s.to_string()).collect(), base_size: "M".into(),
            base_template: project.template.clone(), graded_templates: vec![project.template.clone(); 6],
            size_correspondence: Default::default(), pom_specs: vec![make("width", "anchor-distance", measured), make("seam", "sewline-edge", seam)],
        });
        project
    }

    #[test]
    fn measures_real_anchor_and_sampled_seam_in_six_sizes() {
        let report = audit_persisted_grade_pom20261027(&fixture()).unwrap();
        assert_eq!(report["total"], 12);
        assert_eq!(report["passed"], 12);
        assert_eq!(report["acceptanceComplete"], true);
        assert_eq!(report["factoryApproved"], false);
        assert_eq!(report["rows"][6]["kind"], "sewline-edge");
    }

    #[test]
    fn mismatched_and_null_targets_are_distinct_blockers() {
        let mut project = fixture();
        let run = project.grade_run.as_mut().unwrap();
        *run.pom_specs[0].targets_mm.get_mut("XS").unwrap() = Some(1.0);
        *run.pom_specs[1].targets_mm.get_mut("XXL").unwrap() = None;
        let report = audit_persisted_grade_pom20261027(&project).unwrap();
        assert_eq!(report["failed"], 1);
        assert_eq!(report["unscored"], 1);
        assert_eq!(report["scored"], 11);
        assert_eq!(report["acceptanceComplete"], false);
        assert_eq!(report["rows"][11]["scored"], false);
    }

    #[test]
    fn stale_catalog_corrupt_references_and_missing_sources_refuse() {
        let mut project = fixture();
        project.grade_run = None;
        assert!(audit_persisted_grade_pom20261027(&project).is_err());
        project = fixture();
        project.template.name.push_str(" stale");
        assert!(audit_persisted_grade_pom20261027(&project).is_err());
        project = fixture();
        project.grade_run.as_mut().unwrap().pom_specs[0].to_point = Some(usize::MAX);
        assert!(audit_persisted_grade_pom20261027(&project).is_err());
    }

    #[test]
    fn wrapped_clockwise_path_sums_last_and_first_authored_edges() {
        let project = fixture();
        let polygon = project.template.panels.iter().find_map(|p| p.polygon.as_ref()).unwrap();
        let n = polygon.points.len();
        let expected = [n - 1, 0].iter().map(|&index| {
            polygon.edge_points(index).unwrap().windows(2)
                .map(|w| w[0].distance(w[1])).sum::<f64>() * 1000.0
        }).sum::<f64>();
        let actual = clockwise_sewline_path_mm(polygon, n - 1, 1).unwrap();
        assert!((actual - expected).abs() < 1e-8);
        assert!(actual > polygon.points[n - 1].distance(polygon.points[1]) * 1000.0);
    }

    #[test]
    fn authored_wrapped_path_scores_through_full_persisted_audit() {
        let mut project = fixture();
        let polygon = project.template.panels.iter().find_map(|p| p.polygon.as_ref()).unwrap();
        let from = polygon.points.len() - 1;
        let length = clockwise_sewline_path_mm(polygon, from, 1).unwrap();
        let run = project.grade_run.as_mut().unwrap();
        let spec = &mut run.pom_specs[0];
        spec.kind = "sewline-path".into();
        spec.from_point = Some(from);
        spec.to_point = Some(1);
        spec.edge = None;
        for value in spec.targets_mm.values_mut() { *value = Some(length); }
        let report = audit_persisted_grade_pom20261027(&project).unwrap();
        assert_eq!(report["rows"][0]["kind"], "sewline-path");
        assert_eq!(report["rows"][0]["measuredMm"].as_f64().unwrap(), length);
        assert_eq!(report["passed"], 12);
        assert_eq!(report["acceptanceComplete"], true);
        assert_eq!(report["factoryApproved"], false);
    }

    #[test]
    fn curved_path_uses_native_sampled_arclength() {
        let project = fixture();
        let mut polygon = project.template.panels.iter().find_map(|p| p.polygon.as_ref()).unwrap().clone();
        let a = polygon.points[0];
        let b = polygon.points[1];
        let direction = b - a;
        let bulge = glam::DVec2::new(-direction.y, direction.x) * 0.25;
        polygon.curves.insert(polygon.edges[0].clone(), [a + direction / 3.0 + bulge, a + direction * (2.0 / 3.0) + bulge]);
        let straight = a.distance(b) * 1000.0;
        let sampled = clockwise_sewline_path_mm(&polygon, 0, 1).unwrap();
        assert!(sampled > straight + 0.1, "sampled {sampled}, straight {straight}");
    }

    #[test]
    fn invalid_or_degenerate_clockwise_paths_fail_closed() {
        let project = fixture();
        let polygon = project.template.panels.iter().find_map(|p| p.polygon.as_ref()).unwrap();
        let n = polygon.points.len();
        assert!(clockwise_sewline_path_mm(polygon, 0, 0).is_err());
        assert!(clockwise_sewline_path_mm(polygon, n, 1).is_err());
        assert!(clockwise_sewline_path_mm(polygon, 0, n).is_err());
        let mut degenerate = polygon.clone();
        degenerate.points[1] = degenerate.points[0];
        assert!(clockwise_sewline_path_mm(&degenerate, 0, 1).is_err());
    }
}
