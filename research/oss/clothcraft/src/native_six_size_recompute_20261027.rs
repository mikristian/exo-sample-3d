//! Qualified multi-panel direct-measurement recomputation for a saved six-size catalog.
//! The operation is pure and the caller owns a single atomic save/Undo boundary.
use crate::{
    authoring::{self, Command},
    fitting::{
        FittingProject, NativeDraftMeasurement, NativeDraftPointBindings, PersistedGradeRun,
    },
    garment::{cutline::production_cutline, polygon::PolygonPattern, template::GarmentTemplate},
};
use glam::DVec2;
use std::collections::{BTreeMap, BTreeSet};
use crate::native_linked_industrial_propagation_20261027::audit_native_six_size_sewn_balance20261027;

fn contour(points: &[DVec2]) -> Result<f64, String> {
    if !(3..=128).contains(&points.len())
        || points
            .iter()
            .any(|p| !p.is_finite() || p.abs().max_element() > 10.)
    {
        return Err("Unsupported native polygon coordinates".into());
    }
    let n = points.len();
    let mut area = 0.;
    for i in 0..n {
        let a = points[i];
        let b = points[(i + 1) % n];
        if a.distance(b) < 1e-6 {
            return Err("Collapsed native polygon edge".into());
        }
        area += a.perp_dot(b);
        for j in i + 2..n {
            if i == 0 && j == n - 1 {
                continue;
            }
            let c = points[j];
            let d = points[(j + 1) % n];
            let cross = |p: DVec2, q: DVec2, r: DVec2| (q - p).perp_dot(r - p);
            let on = |p: DVec2, q: DVec2, r: DVec2| {
                cross(p, q, r).abs() < 1e-10 && (r - p).dot(r - q) <= 1e-12
            };
            if (cross(a, b, c) * cross(a, b, d) < -1e-18
                && cross(c, d, a) * cross(c, d, b) < -1e-18)
                || on(a, b, c)
                || on(a, b, d)
                || on(c, d, a)
                || on(c, d, b)
            {
                return Err("Native polygon intersects or touches itself".into());
            }
        }
    }
    if area.abs() < 2e-9 || !area.is_finite() {
        return Err("Degenerate native polygon".into());
    }
    Ok(area.signum())
}

fn qualified(template: &GarmentTemplate, panel_id: &str) -> Result<(), String> {
    let p = template
        .panels
        .iter()
        .find(|p| p.id == panel_id)
        .ok_or("Unknown native panel")?;
    if template.panels.iter().filter(|p| p.id == panel_id).count() != 1 {
        return Err("Duplicate native panel id".into());
    }
    let poly = p.polygon.as_ref().ok_or("Native panel needs a polygon")?;
    if !p.pins.is_empty()
        || !p.pin_points.is_empty()
        || !poly.vertex_ids.is_empty()
        || !poly.vertex_mirror_groups.is_empty()
        || !poly.holes.is_empty()
        || !poly.lines.is_empty()
        || !poly.target_lengths.is_empty()
        || !poly.annotations.is_empty()
        || !poly.measurements.is_empty()
    {
        return Err("Attached geometry or manufacturing metadata is unsupported".into());
    }
    contour(&poly.points)?;
    qualified_free_knots(poly)?;
    // Only native single-span cubic pairs on existing named boundaries qualify.
    // The physical offset kernel and grade validator independently check curves.
    if poly.curves.iter().any(|(edge, handles)|
        !poly.edges.iter().any(|name| name == edge)
            || handles.iter().any(|point| !point.is_finite() || point.abs().max_element() > 10.)) {
        return Err("Unsupported or nonfinite native cubic control inventory".into());
    }
    for index in 0..poly.edges.len() {
        let samples = poly.edge_points(index)?;
        if samples.len() < 2 || samples.windows(2).any(|pair|
            !pair[0].is_finite() || !pair[1].is_finite()
                || pair[0].distance(pair[1]) <= 1e-9) {
            return Err("Invalid sampled cubic stitch geometry".into());
        }
    }
    if !poly.seam_allowances.is_empty() || !poly.notches.is_empty() {
        verify_industrial(poly)?;
    }
    Ok(())
}

/// Conservative v1 free-knot envelope. Mirrored knots require coordinated
/// reflected edits that the point dependency graph cannot currently express.
fn qualified_free_knots(poly: &PolygonPattern) -> Result<(), String> {
    if poly.edges.len() != poly.points.len() {
        return Err("Free curve knots require stable named polygon edges".into());
    }
    let mut ids = BTreeSet::new();
    for (edge, knots) in &poly.free_curve_points {
        if !poly.edges.contains(edge) || !(1..=4).contains(&knots.len()) {
            return Err("Free curve knots require 1 to 4 points per named edge".into());
        }
        let mut previous_t = 0.;
        for knot in knots {
            if knot.id.is_empty() || !ids.insert(knot.id.as_str())
                || !knot.t.is_finite() || knot.t <= 1e-5 || knot.t >= 1. - 1e-5
                || knot.t - previous_t < 1e-5
                || knot.mirror_group.is_some()
                || !knot.position.is_finite() || knot.position.abs().max_element() > 10.
                || [knot.derivative, knot.derivative_in, knot.derivative_out].iter()
                    .flatten().any(|p| !p.is_finite() || p.abs().max_element() > 10.)
            {
                return Err("Unsupported, mirrored, duplicate or nonfinite free curve knot".into());
            }
            previous_t = knot.t;
        }
    }
    Ok(())
}

fn propagate_free_knots(original: &PolygonPattern, updated: &mut PolygonPattern) -> Result<(), String> {
    qualified_free_knots(original)?;
    if original.edges != updated.edges || original.points.len() != updated.points.len()
        || original.free_curve_points.keys().ne(updated.free_curve_points.keys()) {
        return Err("Free curve knot edge inventory drift".into());
    }
    for (index, edge) in original.edges.iter().enumerate() {
        let start = updated.points[index] - original.points[index];
        let end_index = (index + 1) % original.points.len();
        let end = updated.points[end_index] - original.points[end_index];
        if let Some(old) = original.free_curve_points.get(edge) {
            let live = updated.free_curve_points.get_mut(edge)
                .ok_or("Missing authored free curve knot")?;
            if live.len() != old.len() || live.iter().zip(old).any(|(a,b)|
                a.id != b.id || a.t != b.t || a.mirror_group != b.mirror_group
                    || a.position != b.position || a.derivative != b.derivative
                    || a.derivative_in != b.derivative_in || a.derivative_out != b.derivative_out) {
                return Err("Anchor operation unexpectedly changed free curve knot".into());
            }
            for (knot, prior) in live.iter_mut().zip(old) {
                knot.position = prior.position + start * (1. - prior.t) + end * prior.t;
                for (field, value) in [(&mut knot.derivative, prior.derivative),
                    (&mut knot.derivative_in, prior.derivative_in),
                    (&mut knot.derivative_out, prior.derivative_out)] {
                    *field = value.map(|v| v + end - start);
                }
            }
        }
    }
    qualified_free_knots(updated)?;
    Ok(())
}

fn verify_graded_free_knots(base: &PolygonPattern, graded: &PolygonPattern, size: &str) -> Result<(), String> {
    qualified_free_knots(base)?;
    qualified_free_knots(graded)?;
    if base.free_curve_points.keys().ne(graded.free_curve_points.keys()) || base.edges != graded.edges {
        return Err(format!("Grade {size} changes free curve knot inventory"));
    }
    for (index, edge) in base.edges.iter().enumerate() {
        if let Some(source) = base.free_curve_points.get(edge) {
            let saved = graded.free_curve_points.get(edge).ok_or("Missing graded free curve knot")?;
            let start = graded.points[index] - base.points[index];
            let end_index = (index+1)%base.points.len();
            let end = graded.points[end_index] - base.points[end_index];
            for (a,b) in source.iter().zip(saved) {
                let slope = end-start;
                let matches = |x: Option<DVec2>, y: Option<DVec2>| match (x,y) {
                    (None,None) => true,
                    (Some(a),Some(b)) => b.is_finite() && b.distance(a+slope) <= 1e-8,
                    _ => false,
                };
                if a.id != b.id || a.t != b.t || a.mirror_group != b.mirror_group
                    || b.position.distance(a.position + start*(1.-a.t)+end*a.t)>1e-8
                    || !matches(a.derivative,b.derivative)
                    || !matches(a.derivative_in,b.derivative_in)
                    || !matches(a.derivative_out,b.derivative_out) {
                    return Err(format!("Grade {size} has forged or stale free curve knot: {edge}"));
                }
            }
        }
    }
    Ok(())
}

/// Identify exactly the physical V inserted by `DartCutSew`. An arbitrary
/// same-panel seam must never qualify through a dart-looking seam name alone.
fn qualified_physical_dart(template: &GarmentTemplate, seam: &crate::garment::seam::SeamSpec) -> Result<(), String> {
    let id = seam.id.as_str();
    if !id.starts_with("dart_") || id.len() <= "dart_".len()
        || seam.a.panel != seam.b.panel || !seam.reverse_b || seam.allow_ease
        || seam.a.range != [0., 1.] || seam.b.range != [0., 1.]
        || !seam.notches.is_empty()
        || seam.a.edge.as_deref() != Some(format!("{id}_leg_a").as_str())
        || seam.b.edge.as_deref() != Some(format!("{id}_leg_b").as_str())
        || !seam.stiffness.is_finite() || seam.stiffness != 50_000.
    {
        return Err(format!("Unsupported same-panel dart seam {id}"));
    }
    let panel = template.panels.iter().find(|p| p.id == seam.a.panel)
        .ok_or("Dart seam has missing panel")?;
    let poly = panel.polygon.as_ref().ok_or("Dart seam needs a physical polygon")?;
    let first = poly.edges.iter().position(|name| name == &format!("{id}_leg_a"))
        .ok_or("Dart leg A is missing")?;
    let second = (first + 1) % poly.points.len();
    if poly.edges.len() != poly.points.len() || poly.edges.get(second)
        != Some(&format!("{id}_leg_b")) || second + 1 >= poly.points.len()
        || poly.curves.contains_key(&poly.edges[first])
        || poly.curves.contains_key(&poly.edges[second])
        || poly.free_curve_points.contains_key(&poly.edges[first])
        || poly.free_curve_points.contains_key(&poly.edges[second])
        || poly.notches.contains_key(&poly.edges[first])
        || poly.notches.contains_key(&poly.edges[second])
        || poly.target_lengths.contains_key(&poly.edges[first])
        || poly.target_lengths.contains_key(&poly.edges[second])
        || poly.measurements.iter().any(|mark|
            [&mark.a.edge, &mark.b.edge].iter().any(|edge|
                *edge == &poly.edges[first] || *edge == &poly.edges[second]))
    {
        return Err(format!("Dart {id} has unsupported leg topology or marks"));
    }
    let (left, apex, right) = (poly.points[first], poly.points[second], poly.points[second + 1]);
    let intake = right - left;
    if !intake.is_finite() || intake.length() < 0.003 {
        return Err(format!("Dart {id} has invalid intake"));
    }
    let mid = (left + right) * 0.5;
    let height = (apex - mid).perp_dot(intake.normalize()).abs();
    let leg_a = left.distance(apex);
    let leg_b = apex.distance(right);
    if !leg_a.is_finite() || !leg_b.is_finite()
        || !(0.003..=0.15).contains(&intake.length())
        || !(0.008..=0.5).contains(&height)
        || (apex - mid).dot(intake.normalize()).abs() > 1e-6
        || (leg_a - leg_b).abs() > 1e-8
    {
        return Err(format!("Dart {id} has asymmetric or invalid physical legs"));
    }
    Ok(())
}

/// Paired sewing is eligible only when every physical size passes the existing
/// independent length/station audit, with no authored ease anywhere. The saved
/// seam inventory remains identical across sizes under grade-run validation.
fn verify_sewn_run(run: &PersistedGradeRun, active: &GarmentTemplate) -> Result<(), String> {
    if active.seams.is_empty() { return Ok(()); }
    if active.seams.iter().any(|seam| seam.allow_ease) {
        return Err("Reactive sewn geometry requires allow_ease:false on every seam".into());
    }
    for (size, template) in run.sizes.iter().zip(&run.graded_templates) {
        for seam in &template.seams {
            if seam.a.panel == seam.b.panel {
                qualified_physical_dart(template, seam)
                    .map_err(|e| format!("Grade {size}: {e}"))?;
            }
        }
    }
    let audit = audit_native_six_size_sewn_balance20261027(run, active)?;
    if audit.ease_review_required || audit.sizes.len() != 6 {
        return Err("Six-size sewn geometry requires balance without ease review".into());
    }
    for size in &audit.sizes {
        if size.seams.len() != active.seams.len() {
            return Err(format!("Grade {} has incomplete paired sewing", size.size));
        }
        for seam in &size.seams {
            if seam.allow_ease || seam.requires_ease_review
                || !seam.mismatch_m.is_finite() || seam.mismatch_m > 1e-5
                || seam.a.edge_id.is_empty() || seam.b.edge_id.is_empty()
                || seam.notch_interval_lengths_m.iter().any(|pair|
                    pair.iter().any(|length| !length.is_finite() || *length <= 0.)
                    || (pair[0] - pair[1]).abs() > 1e-5)
            {
                return Err(format!("Grade {} has unsupported or unbalanced sewn seam {}", size.size, seam.seam_id));
            }
        }
    }
    Ok(())
}

/// Verify a physical sewn contour, independent CUT boundary, and every named
/// notch against the native offset kernel. The industrial layer is optional;
/// when present, CUT requires a width on every edge and valid physical marks.
fn verify_industrial(poly: &PolygonPattern) -> Result<(), String> {
    if poly.edges.len() != poly.points.len()
        || poly.edges.iter().any(|id| id.is_empty())
        || poly.edges.iter().collect::<BTreeSet<_>>().len() != poly.edges.len()
    {
        return Err("Industrial contour needs unique stable edge identifiers".into());
    }
    if poly.seam_allowances.is_empty() && poly.notches.is_empty() {
        return Ok(());
    }
    if poly.seam_allowances.len() != poly.edges.len() {
        return Err("Industrial CUT requires a seam allowance on every named edge".into());
    }
    let mut sew_perimeter = 0.;
    for (index, name) in poly.edges.iter().enumerate() {
        let width = poly.seam_allowances.get(name).ok_or("Industrial CUT missing named edge allowance")?;
        if !width.is_finite() || !(0.0..=0.5).contains(width) {
            return Err("Invalid physical seam allowance width".into());
        }
        let sample = poly.edge_points(index)?;
        let length: f64 = sample.windows(2).map(|s| s[0].distance(s[1])).sum();
        if !length.is_finite() || length <= 1e-9 {
            return Err("Nonfinite or collapsed industrial sewline".into());
        }
        sew_perimeter += length;
    }
    if !sew_perimeter.is_finite() || sew_perimeter <= 0. {
        return Err("Invalid industrial sewline perimeter".into());
    }
    let cut = production_cutline(poly)?;
    if !cut.area_m2.is_finite() || cut.area_m2 <= 1e-12
        || !cut.perimeter_m.is_finite() || cut.perimeter_m <= 0.
        || cut.edges.len() != poly.edges.len()
    {
        return Err("Invalid physical industrial CUT boundary".into());
    }
    for (index, edge) in cut.edges.iter().enumerate() {
        if edge.name != poly.edges[index]
            || edge.allowance_m != poly.seam_allowances[&edge.name]
        {
            return Err("Industrial CUT edge identity or width drift".into());
        }
    }
    let expected_count: usize = poly.notches.values().map(Vec::len).sum();
    if cut.notches.len() != expected_count {
        return Err("Industrial CUT notch count drift".into());
    }
    for (name, marks) in &poly.notches {
        for mark in marks {
            let endpoints = poly.notch_segment(name, mark)?;
            let physical = cut.notches.iter().find(|candidate|
                candidate.edge_id == *name && candidate.t == mark.t && candidate.depth_m == mark.depth_m)
                .ok_or("Industrial CUT missing physical notch")?;
            let outward = (endpoints[1] - endpoints[0]) / mark.depth_m;
            let expected_cut = endpoints[0] + outward * poly.seam_allowances[name];
            let expected_inner = expected_cut - outward * mark.depth_m;
            if !physical.cut_start.is_finite() || !physical.inner_end.is_finite()
                || ((physical.cut_start - physical.inner_end).length() - mark.depth_m).abs() > 1e-9
                || physical.cut_start.distance(expected_cut) > 0.001
                || physical.inner_end.distance(expected_inner) > 0.001
            {
                return Err("Industrial CUT notch moved off its named sewline".into());
            }
        }
    }
    Ok(())
}

fn direct(graph: &NativeDraftPointBindings, name: &str) -> Result<f64, String> {
    // Geometry distances may refer to computed named measurements, but the
    // *overrides* themselves must still be direct authored inputs (enforced
    // by the caller's match below). Evaluate the complete saved worksheet in
    // Rust before deriving any dependent point coordinate; cycles, unknown
    // names, invalid arithmetic and nonfinite results must fail closed.
    let evaluated=crate::native_measurement_formulas_20261027::
        evaluate_native_measurements_20261027(&graph.measurements)?;
    let mm=*evaluated.get(name).ok_or("Unknown native measurement distance")?;
    if !mm.is_finite() || mm.abs() > 5000. {
        return Err("Native computed measurement exceeds ±5000 mm".into());
    }
    Ok(mm / 1000.)
}

/// Rebuild a qualified detached straight-edge pattern and preserve all original
/// per-vertex six-size offsets, including the origin translation during normalization.
pub fn recompute_native_six_size_measurement20261027(
    project: &FittingProject,
    overrides: &BTreeMap<String, f64>,
) -> Result<
    (
        GarmentTemplate,
        PersistedGradeRun,
        NativeDraftPointBindings,
        serde_json::Value,
    ),
    String,
> {
    if overrides.is_empty() {
        return Err("At least one measurement override required".into());
    }
    if !project.print_graphics.is_empty() || !project.imported_hardware.is_empty() {
        return Err("Project-level manufacturing attachments are unsupported".into());
    }
    let run = project
        .grade_run
        .as_ref()
        .ok_or("Saved six-size grade catalog required")?;
    run.validate(&project.template)?;
    verify_sewn_run(run, &project.template)
        .map_err(|e| format!("Pre-edit sewn balance: {e}"))?;
    // Validate every pre-edit industrial source before rebasing any point.
    // Existing v1 grade catalogs require identical per-size metadata, but
    // retaining the original size layer here also protects future catalogs.
    let industrial_panels: BTreeSet<String> = project.template.panels.iter()
        .filter_map(|panel| panel.polygon.as_ref().and_then(|poly|
            (!poly.seam_allowances.is_empty() || !poly.notches.is_empty())
                .then(|| panel.id.clone())))
        .collect();
    for (size, grade) in run.sizes.iter().zip(&run.graded_templates) {
        for panel in &grade.panels {
            if let Some(source) = project.template.panels.iter().find(|p| p.id == panel.id) {
                if let (Some(base_poly), Some(size_poly)) = (&source.polygon, &panel.polygon) {
                    verify_graded_free_knots(base_poly, size_poly, size)?;
                }
            }
            if industrial_panels.contains(&panel.id) {
                qualified(grade, &panel.id)
                    .map_err(|e| format!("Pre-edit grade {size} panel {}: {e}", panel.id))?;
            }
        }
    }
    let saved = project
        .native_point_bindings
        .as_ref()
        .ok_or("Saved native point bindings required")?;
    saved.valid_against(&project.template)?;
    if !saved.source_matches(&project.template) {
        return Err("Stale native source graph".into());
    }
    let mut graph = saved.clone();
    for (key, value) in overrides {
        direct(&graph, key)?;
        if !value.is_finite() || value.abs() > 5000. {
            return Err("Invalid direct mm override".into());
        }
        match graph
            .measurements
            .get_mut(key)
            .ok_or("Missing direct measurement override")?
        {
            NativeDraftMeasurement::Number(n) => *n = *value,
            NativeDraftMeasurement::Definition(d) if d.formula.is_none() => {
                d.value_mm = Some(*value)
            }
            _ => return Err("Computed measurement override is unsupported".into()),
        }
    }
    graph.valid_against(&project.template)?;
    let mut by_id = BTreeMap::new();
    let mut by_target = BTreeMap::new();
    for rule in &graph.bindings {
        by_id.insert(rule.id.as_str(), rule);
        by_target.insert((rule.panel_id.as_str(), rule.point_index), rule.id.as_str());
    }
    let mut waiting: BTreeSet<&str> = by_id.keys().copied().collect();
    let mut done = BTreeSet::new();
    let mut ordered = Vec::new();
    while !waiting.is_empty() {
        let next = waiting
            .iter()
            .find(|id| {
                by_id[**id]
                    .depends_on
                    .iter()
                    .all(|d| done.contains(d.as_str()))
            })
            .copied()
            .ok_or("Cyclic native dependency graph")?;
        waiting.remove(next);
        done.insert(next);
        ordered.push(by_id[next]);
    }
    // The saved graph must still describe the authored *base* before any
    // override is applied. Otherwise a changed measurement could conceal a
    // stale target (or an incorrectly installed dependent construction).
    // Evaluate against the original points, rather than progressively fixing
    // targets in topological order, so upstream drift is also detected.
    for rule in &ordered {
        qualified(&project.template, &rule.panel_id)?;
        let poly = project.template.panels.iter()
            .find(|p| p.id == rule.panel_id).unwrap().polygon.as_ref().unwrap();
        let a = poly.points[rule.a];
        let old_distance = direct(saved, &rule.distance_formula)?;
        let expected = match rule.mode.as_str() {
            "polar" => {
                let angle = rule.angle_deg.unwrap_or(0.).to_radians();
                a + DVec2::new(angle.cos(), angle.sin()) * old_distance
            }
            "along" | "normal" => {
                let direction = poly.points[rule.b] - a;
                if direction.length_squared() < 1e-12 {
                    return Err("Degenerate saved native reference direction".into());
                }
                let unit = direction.normalize();
                a + (if rule.mode == "normal" {
                    DVec2::new(-unit.y, unit.x)
                } else { unit }) * old_distance
            }
            _ => return Err("Unsupported saved native point mode".into()),
        };
        if !expected.is_finite() || poly.points[rule.point_index].distance(expected) > 1e-8 {
            return Err("Saved native six-size point binding does not match source geometry".into());
        }
    }
    let mut rebuilt = project.template.clone();
    let mut changes: BTreeMap<String, Vec<(usize, DVec2)>> = BTreeMap::new();
    let mut changed_ids = Vec::new();
    for rule in ordered {
        qualified(&project.template, &rule.panel_id)?;
        let used = if rule.mode == "polar" {
            vec![rule.a]
        } else {
            vec![rule.a, rule.b]
        };
        if used.contains(&rule.point_index) {
            return Err("Self-referential native target".into());
        }
        let expected: BTreeSet<&str> = used
            .iter()
            .filter_map(|index| by_target.get(&(rule.panel_id.as_str(), *index)).copied())
            .collect();
        let declared: BTreeSet<&str> = rule.depends_on.iter().map(String::as_str).collect();
        if expected != declared {
            return Err("Dependency edges do not match bound reference points".into());
        }
        let poly = rebuilt
            .panels
            .iter_mut()
            .find(|p| p.id == rule.panel_id)
            .unwrap()
            .polygon
            .as_mut()
            .unwrap();
        let a = poly.points[rule.a];
        let distance = direct(&graph, &rule.distance_formula)?;
        let next = match rule.mode.as_str() {
            "polar" => {
                let angle = rule.angle_deg.unwrap_or(0.).to_radians();
                a + DVec2::new(angle.cos(), angle.sin()) * distance
            }
            "along" | "normal" => {
                let delta = poly.points[rule.b] - a;
                if delta.length_squared() < 1e-12 {
                    return Err("Degenerate native reference direction".into());
                }
                let unit = delta.normalize();
                a + (if rule.mode == "normal" {
                    DVec2::new(-unit.y, unit.x)
                } else {
                    unit
                }) * distance
            }
            _ => return Err("Unsupported native point mode".into()),
        };
        if !next.is_finite() || next.abs().max_element() > 10. {
            return Err("Native target out of bounds".into());
        }
        if poly.points[rule.point_index].distance(next) > 1e-8 {
            poly.points[rule.point_index] = next;
            changes
                .entry(rule.panel_id.clone())
                .or_default()
                .push((rule.point_index, next));
            changed_ids.push(rule.id.clone());
        }
    }
    if changes.is_empty() {
        return Err("Native six-size operation requires at least one changed bound point".into());
    }
    // AnchorGroup compiles its candidate after each panel update. A genuinely
    // paired edit is temporarily unbalanced between the first and second
    // panel, although the complete native transaction may sew exactly. Stage
    // the entire point operation without seams, then restore the original
    // metadata before the single final sewn compile and six-size audit.
    let original_seams = project.template.seams.clone();
    let mut next_base = project.template.clone();
    if !original_seams.is_empty() {
        next_base.seams.clear();
    }
    for (panel_id, edits) in &changes {
        if edits.len() > 32 {
            return Err("Too many changed native anchors per panel".into());
        }
        let before = project
            .template
            .panels
            .iter()
            .find(|p| p.id == *panel_id)
            .unwrap();
        let after = rebuilt.panels.iter().find(|p| p.id == *panel_id).unwrap();
        if contour(&before.polygon.as_ref().unwrap().points)?
            != contour(&after.polygon.as_ref().unwrap().points)?
        {
            return Err("Native recompute reverses polygon winding".into());
        }
        next_base = authoring::apply(
            &next_base,
            Command::AnchorGroup {
                panel: panel_id.clone(),
                edits: edits.clone(),
            },
        )?
        .template;
        let original_poly = before.polygon.as_ref().unwrap();
        let updated_poly = next_base.panels.iter_mut().find(|p| p.id == *panel_id)
            .unwrap().polygon.as_mut().unwrap();
        propagate_free_knots(original_poly, updated_poly)?;
    }
    if !original_seams.is_empty() {
        next_base.seams = original_seams;
        if serde_json::to_value(&next_base.seams).map_err(|e| e.to_string())?
            != serde_json::to_value(&project.template.seams).map_err(|e| e.to_string())? {
            return Err("Native authoring modified saved sewing metadata".into());
        }
        next_base.compile().map_err(|e| format!("Recomputed sewn base: {e}"))?;
    }
    let mut next_run = run.clone();
    next_run.base_template = next_base.clone();
    for panel_id in &industrial_panels {
        let source = project.template.panels.iter().find(|p| &p.id == panel_id).unwrap();
        let resulting = next_base.panels.iter().find(|p| &p.id == panel_id).unwrap();
        let old = source.polygon.as_ref().unwrap();
        let new = resulting.polygon.as_ref().unwrap();
        if old.edges != new.edges || old.notches != new.notches
            || old.seam_allowances != new.seam_allowances {
            return Err(format!("Native edit altered industrial identities on {panel_id}"));
        }
        qualified(&next_base, panel_id)?;
    }
    for (i, size) in run.sizes.iter().enumerate() {
        if *size == run.base_size {
            next_run.graded_templates[i] = next_base.clone();
            continue;
        }
        let old_grade = &run.graded_templates[i];
        let mut new_grade = next_base.clone();
        for (idx, panel) in new_grade.panels.iter_mut().enumerate() {
            let old_base_panel = &project.template.panels[idx];
            let old_size_panel = &old_grade.panels[idx];
            // Selective invalidation: unrelated sized pieces are authored data,
            // not output to rebuild through floating-point offset arithmetic.
            // Retain their exact geometry, placement and manufacturing metadata.
            if !changes.contains_key(&panel.id) {
                *panel = old_size_panel.clone();
                continue;
            }
            let (Some(base_poly), Some(size_poly), Some(new_poly)) = (
                &old_base_panel.polygon,
                &old_size_panel.polygon,
                &mut panel.polygon,
            ) else {
                continue;
            };
            if size_poly.points.len() != base_poly.points.len()
                || new_poly.points.len() != base_poly.points.len()
            {
                return Err("Grade point topology changed".into());
            }
            for k in 0..new_poly.points.len() {
                new_poly.points[k] += size_poly.points[k] - base_poly.points[k];
            }
            if base_poly.edges != size_poly.edges || new_poly.edges != base_poly.edges
                || base_poly.curves.keys().ne(size_poly.curves.keys())
                || base_poly.curves.keys().ne(new_poly.curves.keys()) {
                return Err(format!("Grade {size} changed cubic curve inventory: {}", panel.id));
            }
            // A v1 graded cubic follows each endpoint's authored point offset.
            // The first and second handles use the exact 2/3:1/3 and 1/3:2/3
            // Bézier displacement blends already enforced by run.validate().
            for (edge_index, edge_id) in base_poly.edges.iter().enumerate() {
                if let Some(original) = base_poly.curves.get(edge_id) {
                    let saved = size_poly.curves.get(edge_id)
                        .ok_or("Missing saved graded cubic handles")?;
                    let next = new_poly.curves.get_mut(edge_id)
                        .ok_or("Missing recomputed cubic handles")?;
                    let start = size_poly.points[edge_index] - base_poly.points[edge_index];
                    let end_index = (edge_index + 1) % base_poly.points.len();
                    let end = size_poly.points[end_index] - base_poly.points[end_index];
                    let expected = [original[0] + (start * 2. + end) / 3.,
                        original[1] + (start + end * 2.) / 3.];
                    if saved.iter().zip(expected).any(|(got, want)| got.distance(want) > 1e-8) {
                        return Err(format!("Grade {size} has invalid saved cubic offsets: {}", panel.id));
                    }
                    next[0] += (start * 2. + end) / 3.;
                    next[1] += (start + end * 2.) / 3.;
                }
            }
            verify_graded_free_knots(base_poly, size_poly, size)?;
            for (edge_index, edge_id) in base_poly.edges.iter().enumerate() {
                if let Some(knots) = base_poly.free_curve_points.get(edge_id) {
                    let start = size_poly.points[edge_index] - base_poly.points[edge_index];
                    let end_index = (edge_index + 1) % base_poly.points.len();
                    let end = size_poly.points[end_index] - base_poly.points[end_index];
                    let live = new_poly.free_curve_points.get_mut(edge_id)
                        .ok_or("Missing regenerated free curve knot")?;
                    if live.len() != knots.len() {
                        return Err("Regenerated free curve knot inventory drift".into());
                    }
                    for knot in live {
                        knot.position += start * (1. - knot.t) + end * knot.t;
                        for derivative in [&mut knot.derivative, &mut knot.derivative_in, &mut knot.derivative_out] {
                            if let Some(value) = derivative.as_mut() { *value += end-start; }
                        }
                    }
                }
            }
            qualified_free_knots(new_poly)?;
            contour(&new_poly.points)?;
            // Preserve each saved size's authored industrial attributes, even
            // though the current v1 validator only permits identical metadata.
            new_poly.seam_allowances = size_poly.seam_allowances.clone();
            new_poly.notches = size_poly.notches.clone();
            if industrial_panels.contains(&panel.id) {
                if new_poly.edges != size_poly.edges {
                    return Err(format!("Grade {size} loses original named edges: {}", panel.id));
                }
                verify_industrial(new_poly).map_err(|e|
                    format!("Post-edit grade {size} panel {}: {e}", panel.id))?;
            }
        }
        PersistedGradeRun::compilation_template_for_size(&new_grade)?;
        next_run.graded_templates[i] = new_grade;
    }
    next_run.validate(&next_base)?;
    verify_sewn_run(&next_run, &next_base)
        .map_err(|e| format!("Post-edit sewn balance: {e}"))?;
    for (size, template) in next_run.sizes.iter().zip(&next_run.graded_templates) {
        for panel in &template.panels {
            if industrial_panels.contains(&panel.id) {
                verify_industrial(panel.polygon.as_ref().unwrap())
                    .map_err(|e| format!("Final grade {size} CUT {}: {e}", panel.id))?;
            }
        }
    }
    graph.source_template = next_base.clone();
    graph.valid_against(&next_base)?;
    // The public six-size receipt covers more than the moved point rows.
    // All derived garment templates have already passed Rust compilation,
    // paired sewing balance and physical named CUT/notch validation above.
    // Report the *actual post-rebuild inventories* for each size so a caller
    // can detect an incomplete result instead of assuming every dependent
    // cutline and sew association survived a successful point displacement.
    let per_size_integrity = next_run.sizes.iter()
        .zip(&next_run.graded_templates)
        .map(|(size, template)| {
            let mut notch_count = 0usize;
            let mut marked_panel_count = 0usize;
            let mut named_edge_count = 0usize;
            for panel in &template.panels {
                if let Some(poly) = &panel.polygon {
                    named_edge_count += poly.edges.len();
                    notch_count += poly.notches.values().map(Vec::len).sum::<usize>();
                    if industrial_panels.contains(&panel.id) {
                        marked_panel_count += 1;
                    }
                }
            }
            serde_json::json!({"size":size,"panelCount":template.panels.len(),
                "seamCount":template.seams.len(),
                "industrialPanelCount":marked_panel_count,
                "namedEdgeCount":named_edge_count,"notchCount":notch_count,
                "nativeCutAndSewValidated":true})
        }).collect::<Vec<_>>();
    let by_size = run
        .sizes
        .iter()
        .enumerate()
        .map(|(i, size)| {
            let mut rows = Vec::new();
            for (panel_id, edits) in &changes {
                let index = next_base
                    .panels
                    .iter()
                    .position(|p| &p.id == panel_id)
                    .unwrap();
                let before = &run.graded_templates[i].panels[index]
                    .polygon
                    .as_ref()
                    .unwrap()
                    .points;
                let after = &next_run.graded_templates[i].panels[index]
                    .polygon
                    .as_ref()
                    .unwrap()
                    .points;
                for (point_index, _) in edits {
                    rows.push(
                        serde_json::json!({"panelId":panel_id,"pointIndex":point_index,
                    "beforeMm":[before[*point_index].x*1000.,before[*point_index].y*1000.],
                    "afterMm":[after[*point_index].x*1000.,after[*point_index].y*1000.]}),
                    );
                }
            }
            serde_json::json!({"size":size,"changes":rows})
        })
        .collect::<Vec<_>>();
    let report = serde_json::json!({
        "format":"exo-native-reactive-size-run.v1", "changedPanels":changes.len(),
        "changedBindings":changed_ids.len(), "panelIds":changes.keys().collect::<Vec<_>>(),
        "bindingIds":changed_ids, "bySize":by_size,"sizes":run.sizes, "baseSize":run.base_size,
        "perSizeIntegrity":per_size_integrity,
        "measurementOverrides":overrides, "manufacturerApproved":false,
    });
    Ok((next_base, next_run, graph, report))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{fitting::NativeDraftPointRule, garment::presets::GarmentKind};
    use std::path::PathBuf;

    fn fixture() -> FittingProject {
        let mut project =
            FittingProject::basic(GarmentKind::Tshirt, 1, PathBuf::from("avatar.obj"));
        project.template.seams.clear();
        let sizes = ["XS", "S", "M", "L", "XL", "XXL"];
        let mut run = PersistedGradeRun {
            schema_version: 1,
            sizes: sizes.iter().map(|s| s.to_string()).collect(),
            base_size: "M".into(),
            base_template: project.template.clone(),
            graded_templates: vec![project.template.clone(); 6],
            size_correspondence: Default::default(), pom_specs: vec![],
        };
        for (size, template) in run.graded_templates.iter_mut().enumerate() {
            if size == 2 {
                continue;
            }
            for panel in &mut template.panels {
                panel.polygon.as_mut().unwrap().points[1].x += (size as f64 - 2.) * 0.001;
            }
        }
        run.validate(&project.template).unwrap();
        project.grade_run = Some(run);
        let mut measurements = BTreeMap::new();
        measurements.insert(
            "neck_distance".into(),
            NativeDraftMeasurement::Number(76.321687612),
        );
        let angle = (0.065_f64).atan2(0.04).to_degrees();
        let mut bindings: Vec<NativeDraftPointRule> = ["front", "back"]
            .iter()
            .map(|panel| NativeDraftPointRule {
                id: format!("{panel}_neck"),
                panel_id: (*panel).into(),
                point_index: 1,
                mode: "polar".into(),
                a: 0,
                b: 0,
                distance_formula: "neck_distance".into(),
                angle_deg: Some(angle),
                depends_on: vec![],
            })
            .collect();
        bindings.push(NativeDraftPointRule {
            id: "front_dependent".into(),
            panel_id: "front".into(),
            point_index: 2,
            mode: "polar".into(),
            a: 1,
            b: 0,
            distance_formula: "neck_distance".into(),
            angle_deg: Some(0.),
            depends_on: vec!["front_neck".into()],
        });
        for panel in &mut project.template.panels {
            if panel.id == "front" {
                panel.polygon.as_mut().unwrap().points[2] = DVec2::new(0.536321687612, 0.065);
            }
        }
        let grade_run = project.grade_run.as_mut().unwrap();
        grade_run.base_template = project.template.clone();
        for template in &mut grade_run.graded_templates {
            template.panels.iter_mut().find(|panel| panel.id == "front")
                .unwrap().polygon.as_mut().unwrap().points[2] = DVec2::new(0.536321687612, 0.065);
        }
        project.native_point_bindings = Some(NativeDraftPointBindings {
            version: 1,
            source_template: project.template.clone(),
            measurements,
            bindings,
        });
        project
    }

    fn industrial_fixture() -> FittingProject {
        use crate::garment::polygon::EdgeNotch;
        let mut project = fixture();
        for panel in &mut project.template.panels {
            let polygon = panel.polygon.as_mut().unwrap();
            for edge in polygon.edges.clone() {
                polygon.seam_allowances.insert(edge, 0.012);
            }
            let name = polygon.edges[0].clone();
            polygon.notches.insert(name, vec![EdgeNotch { t: 0.45, depth_m: 0.004 }]);
        }
        let run = project.grade_run.as_mut().unwrap();
        run.base_template = project.template.clone();
        for grade in &mut run.graded_templates {
            for panel in &mut grade.panels {
                let source = project.template.panels.iter().find(|s| s.id == panel.id).unwrap();
                panel.polygon.as_mut().unwrap().seam_allowances =
                    source.polygon.as_ref().unwrap().seam_allowances.clone();
                panel.polygon.as_mut().unwrap().notches =
                    source.polygon.as_ref().unwrap().notches.clone();
            }
        }
        project.native_point_bindings.as_mut().unwrap().source_template = project.template.clone();
        run.validate(&project.template).unwrap();
        project
    }

    fn dart_fixture() -> FittingProject {
        let mut project = sewn_fixture();
        project.template.seams.clear();
        project.template.panels[0].polygon.as_mut().unwrap().notches.clear();
        let source_edge = project.template.panels[0].polygon.as_ref().unwrap().edges[0].clone();
        let dart = authoring::apply(&project.template, Command::DartCutSew {
            panel: "front".into(), edge: source_edge,
            left_t: 0.4, right_t: 0.6, apex: DVec2::new(0.2, 0.06),
        }).unwrap();
        project.template = dart.template;
        // The authored point 1 at the end of the source edge moves through the
        // shared measurement. The symmetric V lies entirely inside that edge.
        // A fixed apex cannot remain symmetric when the parent edge expands,
        // so bind a second panel and translate the whole dart only in tests
        // where its physical geometry remains invariant.
        let base = project.template.clone();
        let run = project.grade_run.as_mut().unwrap();
        run.base_template = base.clone();
        for (index, grade) in run.graded_templates.iter_mut().enumerate() {
            *grade = base.clone();
            if index != 2 {
                let shift = (index as f64 - 2.) * 0.001;
                grade.panels.iter_mut().find(|p| p.id == "back").unwrap()
                    .polygon.as_mut().unwrap().points[1].x += shift;
            }
        }
        project.native_point_bindings.as_mut().unwrap().source_template = base;
        run.validate(&project.template).unwrap();
        verify_sewn_run(run, &project.template).unwrap();
        project
    }

    #[test]
    fn authored_dart_six_sizes_are_physically_verified() {
        let project = dart_fixture();
        let run = project.grade_run.as_ref().unwrap();
        for size in &run.graded_templates {
            let seam = &size.seams[0];
            assert!(seam.id.starts_with("dart_"));
            qualified_physical_dart(size, seam).unwrap();
        }
        let audit = audit_native_six_size_sewn_balance20261027(run, &project.template).unwrap();
        assert_eq!(audit.sizes.len(), 6);
        assert!(audit.sizes.iter().all(|size| size.seams[0].mismatch_m < 1e-8));
    }


    #[test]
    fn forged_darts_and_asymmetric_geometry_fail_closed() {
        for case in 0..6 {
            let mut project = dart_fixture();
            let seam = &mut project.template.seams[0];
            match case {
                0 => seam.id = "dart_forged".into(),
                1 => seam.allow_ease = true,
                2 => seam.reverse_b = false,
                3 => seam.b.range = [0.1, 1.],
                4 => project.template.panels[0].polygon.as_mut().unwrap().points[2].x += 0.005,
                _ => project.template.panels[0].polygon.as_mut().unwrap().edges.swap(1, 2),
            }
            let run = project.grade_run.as_mut().unwrap();
            run.base_template = project.template.clone();
            run.graded_templates = vec![project.template.clone(); 6];
            assert!(verify_sewn_run(run, &project.template).is_err(), "case {case}");
        }
    }

    fn sewn_fixture() -> FittingProject {
        use crate::garment::polygon::EdgeNotch;
        let mut project = fixture();
        // Both bound point-1 anchors alter the paired edge-0 sewn length.
        // The front dependent point also moves, preserving its own binding.
        // This paired fixture isolates the two direct bound seam endpoints.
        project.native_point_bindings.as_mut().unwrap().bindings
            .retain(|rule| rule.id != "front_dependent");
        project.native_point_bindings.as_mut().unwrap().measurements
            .insert("neck_distance".into(),NativeDraftMeasurement::Number(400.));
        for panel in &mut project.template.panels {
            let poly = panel.polygon.as_mut().unwrap();
            *poly = crate::garment::shapes::primitive(
                crate::garment::shapes::Primitive::Rectangle,
                DVec2::new(0.400,0.320),0.,
                crate::garment::meshing::MeshingSettings::default()).unwrap();
            panel.pattern.width = 0.400;
            panel.pattern.height = 0.320;
        }
        for rule in &mut project.native_point_bindings.as_mut().unwrap().bindings {
            rule.angle_deg=Some(0.);
        }
        let front = project.template.panels.iter().find(|panel| panel.id == "front")
            .unwrap().polygon.as_ref().unwrap().clone();
        let front_width = project.template.panels[0].pattern.width;
        let front_height = project.template.panels[0].pattern.height;
        let back = project.template.panels.iter_mut().find(|panel| panel.id == "back").unwrap();
        back.polygon = Some(front.clone());
        back.pattern.width = front_width;
        back.pattern.height = front_height;
        for panel in &mut project.template.panels {
            let poly = panel.polygon.as_mut().unwrap();
            for edge in poly.edges.clone() { poly.seam_allowances.insert(edge, 0.012); }
            let edge = poly.edges[0].clone();
            poly.notches.insert(edge, vec![EdgeNotch {t:0.5,depth_m:0.004}]);
        }
        let mut seam = crate::garment::presets::basic(GarmentKind::Tshirt, 1).seams[0].clone();
        seam.id = "reactive-paired-edge".into();
        seam.a.panel = "front".into();
        seam.a.edge = Some(project.template.panels[0].polygon.as_ref().unwrap().edges[0].clone());
        seam.b.panel = "back".into();
        seam.b.edge = Some(project.template.panels[1].polygon.as_ref().unwrap().edges[0].clone());
        seam.a.range = [0.,1.];
        seam.b.range = [0.,1.];
        seam.reverse_b = true;
        seam.notches = vec![[0.5,0.5]];
        seam.allow_ease = false;
        project.template.seams = vec![seam];
        let run = project.grade_run.as_mut().unwrap();
        run.base_template = project.template.clone();
        for (i, grade) in run.graded_templates.iter_mut().enumerate() {
            grade.seams = project.template.seams.clone();
            for panel in &mut grade.panels {
                let source_panel = project.template.panels.iter().find(|source| source.id == panel.id).unwrap();
                panel.pattern = source_panel.pattern.clone();
                let poly = panel.polygon.as_mut().unwrap();
                *poly = source_panel.polygon.as_ref().unwrap().clone();
                if i != 2 {poly.points[1].x += (i as f64 - 2.) * 0.001;}
            }
        }
        project.native_point_bindings.as_mut().unwrap().source_template = project.template.clone();
        run.validate(&project.template).unwrap();
        verify_sewn_run(run, &project.template).unwrap();
        project
    }

    fn cubic_sewn_fixture() -> FittingProject {
        let mut project = sewn_fixture();
        for panel in &mut project.template.panels {
            let poly = panel.polygon.as_mut().unwrap();
            let edge = poly.edges[0].clone();
            // A smooth outward-curved, single cubic with two genuine control
            // points, with matched physical notches on both sewn edges.
            poly.curves.insert(edge, [DVec2::new(0.13,0.018), DVec2::new(0.27,0.018)]);
        }
        let run = project.grade_run.as_mut().unwrap();
        run.base_template = project.template.clone();
        for (index, grade) in run.graded_templates.iter_mut().enumerate() {
            for panel in &mut grade.panels {
                let source = project.template.panels.iter().find(|p| p.id == panel.id).unwrap();
                let poly = panel.polygon.as_mut().unwrap();
                let edge = poly.edges[0].clone();
                let start = poly.points[0] - source.polygon.as_ref().unwrap().points[0];
                let end = poly.points[1] - source.polygon.as_ref().unwrap().points[1];
                let controls = source.polygon.as_ref().unwrap().curves[&edge];
                poly.curves.insert(edge, [controls[0] + (start * 2. + end) / 3.,
                    controls[1] + (start + end * 2.) / 3.]);
            }
            assert_eq!(run.sizes[index], ["XS","S","M","L","XL","XXL"][index]);
        }
        project.native_point_bindings.as_mut().unwrap().source_template = project.template.clone();
        run.validate(&project.template).unwrap();
        verify_sewn_run(run,&project.template).unwrap();
        project
    }

    fn free_knot_sewn_fixture() -> FittingProject {
        use crate::garment::polygon::FreeCurvePoint;
        let mut project = cubic_sewn_fixture();
        for panel in &mut project.template.panels {
            let poly = panel.polygon.as_mut().unwrap();
            let edge = poly.edges[0].clone();
            poly.free_curve_points.insert(edge, vec![FreeCurvePoint {
                id: "sewn-knot".into(), t: 0.5,
                position: DVec2::new(0.2, 0.018),
                derivative: Some(DVec2::new(0.4, 0.)),
                derivative_in: Some(DVec2::new(0.4, 0.)),
                derivative_out: Some(DVec2::new(0.4, 0.)),
                mirror_group: None,
            }]);
        }
        let run = project.grade_run.as_mut().unwrap();
        run.base_template = project.template.clone();
        for grade in &mut run.graded_templates {
            for panel in &mut grade.panels {
                let source = project.template.panels.iter().find(|p| p.id == panel.id).unwrap();
                let source_poly = source.polygon.as_ref().unwrap();
                let poly = panel.polygon.as_mut().unwrap();
                let edge = poly.edges[0].clone();
                let start = poly.points[0] - source_poly.points[0];
                let end = poly.points[1] - source_poly.points[1];
                let mut knot = source_poly.free_curve_points[&edge][0].clone();
                knot.position += start * (1. - knot.t) + end * knot.t;
                knot.derivative = knot.derivative.map(|v| v + end - start);
                knot.derivative_in = knot.derivative_in.map(|v| v + end - start);
                knot.derivative_out = knot.derivative_out.map(|v| v + end - start);
                poly.free_curve_points.insert(edge, vec![knot]);
            }
        }
        project.native_point_bindings.as_mut().unwrap().source_template = project.template.clone();
        run.validate(&project.template).unwrap();
        verify_sewn_run(run, &project.template).unwrap();
        project
    }

    fn multiple_free_knot_sewn_fixture() -> FittingProject {
        let mut project = free_knot_sewn_fixture();
        for panel in &mut project.template.panels {
            let poly = panel.polygon.as_mut().unwrap();
            let edge = poly.edges[0].clone();
            let original = poly.free_curve_points.get(&edge).unwrap()[0].clone();
            let mut first = original.clone();
            first.id = "knot-035".into();
            first.t = 0.35;
            first.position = DVec2::new(0.14, 0.019);
            first.derivative = Some(DVec2::new(0.4, 0.015));
            first.derivative_in = None;
            first.derivative_out = Some(DVec2::new(0.4, 0.008));
            let mut second = original;
            second.id = "knot-065".into();
            second.t = 0.65;
            second.position = DVec2::new(0.26, 0.019);
            second.derivative = None;
            second.derivative_in = Some(DVec2::new(0.4, -0.008));
            second.derivative_out = Some(DVec2::new(0.4, -0.015));
            poly.free_curve_points.insert(edge, vec![first, second]);
        }
        let run = project.grade_run.as_mut().unwrap();
        run.base_template = project.template.clone();
        for grade in &mut run.graded_templates {
            for panel in &mut grade.panels {
                let source = project.template.panels.iter().find(|p| p.id == panel.id).unwrap();
                let source_poly = source.polygon.as_ref().unwrap();
                let poly = panel.polygon.as_mut().unwrap();
                let edge = poly.edges[0].clone();
                let start = poly.points[0] - source_poly.points[0];
                let end = poly.points[1] - source_poly.points[1];
                let knots = source_poly.free_curve_points[&edge].iter().cloned().map(|mut knot| {
                    knot.position += start * (1. - knot.t) + end * knot.t;
                    knot.derivative = knot.derivative.map(|v| v + end - start);
                    knot.derivative_in = knot.derivative_in.map(|v| v + end - start);
                    knot.derivative_out = knot.derivative_out.map(|v| v + end - start);
                    knot
                }).collect();
                poly.free_curve_points.insert(edge, knots);
            }
        }
        project.native_point_bindings.as_mut().unwrap().source_template = project.template.clone();
        run.validate(&project.template).unwrap();
        verify_sewn_run(run, &project.template).unwrap();
        project
    }

    #[test]
    fn two_distinct_hermite_knots_follow_six_physical_sewn_grades_and_cut_notches() {
        let project = multiple_free_knot_sewn_fixture();
        let source = serde_json::to_value(&project).unwrap();
        let (base, grades, graph, report) = recompute_native_six_size_measurement20261027(
            &project, &BTreeMap::from([("neck_distance".into(), 380.)])).unwrap();
        assert_eq!(serde_json::to_value(&project).unwrap(), source);
        assert!(graph.source_matches(&base));
        assert_eq!(report["bySize"].as_array().unwrap().len(), 6);
        grades.validate(&base).unwrap();
        let audit = audit_native_six_size_sewn_balance20261027(&grades, &base).unwrap();
        assert!(!audit.ease_review_required);
        assert_eq!(audit.sizes.len(), 6);
        for (index, template) in grades.graded_templates.iter().enumerate() {
            let seam = &audit.sizes[index].seams[0];
            assert!(seam.mismatch_m < 1e-8);
            assert_eq!(seam.a.notch_positions_m.len(), 1);
            assert_eq!(seam.b.notch_positions_m.len(), 1);
            for (panel_index, panel) in template.panels.iter().enumerate() {
                let poly = panel.polygon.as_ref().unwrap();
                let old_poly = project.grade_run.as_ref().unwrap().graded_templates[index]
                    .panels[panel_index].polygon.as_ref().unwrap();
                let edge = &poly.edges[0];
                let knots = &poly.free_curve_points[edge];
                let old_knots = &old_poly.free_curve_points[edge];
                assert_eq!(knots.len(), 2);
                assert_eq!([knots[0].t, knots[1].t], [0.35, 0.65]);
                assert_eq!([knots[0].id.as_str(), knots[1].id.as_str()], ["knot-035", "knot-065"]);
                for (knot, old) in knots.iter().zip(old_knots) {
                    assert!(knot.position.distance(old.position) > 0.005);
                    assert_eq!(knot.derivative.is_some(), old.derivative.is_some());
                    assert_eq!(knot.derivative_in.is_some(), old.derivative_in.is_some());
                    assert_eq!(knot.derivative_out.is_some(), old.derivative_out.is_some());
                    for (new, prior) in [(knot.derivative, old.derivative),
                        (knot.derivative_in, old.derivative_in),
                        (knot.derivative_out, old.derivative_out)] {
                        if let (Some(a), Some(b)) = (new, prior) {
                            assert!((a-b).length() > 0.01);
                        }
                    }
                }
                verify_industrial(poly).unwrap();
                let cut = production_cutline(poly).unwrap();
                let old_cut = production_cutline(old_poly).unwrap();
                assert_eq!(cut.notches.len(), 1);
                assert!(cut.notches[0].cut_start.distance(old_cut.notches[0].cut_start) > 0.005);
                assert!((cut.perimeter_m - old_cut.perimeter_m).abs() > 0.005);
            }
        }
    }

    #[test]
    fn multiple_knots_reject_reordering_duplicates_forgery_and_mirror() {
        let override_mm = BTreeMap::from([("neck_distance".into(), 380.)]);
        for case in 0..7 {
            let mut project = multiple_free_knot_sewn_fixture();
            let edge = project.template.panels[0].polygon.as_ref().unwrap().edges[0].clone();
            if case <= 2 {
                let poly = project.template.panels[0].polygon.as_mut().unwrap();
                let knots = poly.free_curve_points.get_mut(&edge).unwrap();
                match case {
                    0 => knots.swap(0, 1),
                    1 => knots[1].id = knots[0].id.clone(),
                    _ => knots[1].t = knots[0].t + 0.000001,
                }
            } else {
                let poly = project.grade_run.as_mut().unwrap().graded_templates[0]
                    .panels[0].polygon.as_mut().unwrap();
                let knot = &mut poly.free_curve_points.get_mut(&edge).unwrap()[1];
                match case {
                    3 => knot.position.x += 0.001,
                    4 => knot.derivative_in.as_mut().unwrap().y += 0.001,
                    5 => knot.derivative_out = None,
                    _ => knot.mirror_group = Some("reflected".into()),
                }
            }
            assert!(recompute_native_six_size_measurement20261027(&project, &override_mm).is_err(), "case {case}");
        }
    }

    #[test]
    fn free_knot_paired_sewn_cut_and_grading_regenerate_all_six() {
        let project = free_knot_sewn_fixture();
        let frozen = serde_json::to_value(&project).unwrap();
        let (base, grades, graph, report) = recompute_native_six_size_measurement20261027(
            &project, &BTreeMap::from([("neck_distance".into(), 380.)])).unwrap();
        assert_eq!(serde_json::to_value(&project).unwrap(), frozen);
        let integrity=report["perSizeIntegrity"].as_array().unwrap();
        assert_eq!(integrity.len(),6);
        for (index, row) in integrity.iter().enumerate() {
            let template=&grades.graded_templates[index];
            let expected_notches:usize=template.panels.iter().filter_map(|panel|
                panel.polygon.as_ref()).map(|poly|
                poly.notches.values().map(Vec::len).sum::<usize>()).sum();
            let expected_industrial=template.panels.iter().filter(|panel|
                panel.polygon.as_ref().is_some_and(|poly|
                    !poly.seam_allowances.is_empty() || !poly.notches.is_empty())).count();
            assert_eq!(row["size"].as_str(),Some(grades.sizes[index].as_str()));
            assert_eq!(row["panelCount"].as_u64(),Some(template.panels.len() as u64));
            assert_eq!(row["seamCount"].as_u64(),Some(template.seams.len() as u64));
            assert_eq!(row["industrialPanelCount"].as_u64(),Some(expected_industrial as u64));
            assert_eq!(row["notchCount"].as_u64(),Some(expected_notches as u64));
            assert_eq!(row["nativeCutAndSewValidated"],true);
        }
        assert!(graph.source_matches(&base));
        grades.validate(&base).unwrap();
        let audit = audit_native_six_size_sewn_balance20261027(&grades, &base).unwrap();
        assert_eq!(audit.sizes.len(), 6);
        for (i, template) in grades.graded_templates.iter().enumerate() {
            assert!(audit.sizes[i].seams[0].mismatch_m < 1e-8);
            for (j, panel) in template.panels.iter().enumerate() {
                let poly = panel.polygon.as_ref().unwrap();
                let knot = &poly.free_curve_points[&poly.edges[0]][0];
                let source = project.grade_run.as_ref().unwrap().graded_templates[i].panels[j]
                    .polygon.as_ref().unwrap();
                let old_knot = &source.free_curve_points[&source.edges[0]][0];
                assert!(knot.position.distance(old_knot.position) > 0.005);
                assert_eq!(knot.id, old_knot.id);
                assert_eq!(knot.t, old_knot.t);
                verify_industrial(poly).unwrap();
                let old_cut = production_cutline(source).unwrap();
                let new_cut = production_cutline(poly).unwrap();
                assert_eq!(new_cut.notches.len(), 1);
                assert!(new_cut.notches[0].cut_start.distance(old_cut.notches[0].cut_start) > 0.005);
            }
        }
    }

    #[test]
    fn free_knot_rejects_forged_nonfinite_stale_and_mirrored_grades() {
        let overrides = BTreeMap::from([("neck_distance".into(), 380.)]);
        let edge = free_knot_sewn_fixture().template.panels[0].polygon.as_ref().unwrap().edges[0].clone();
        for case in 0..7 {
            let mut project = free_knot_sewn_fixture();
            let knot = &mut project.grade_run.as_mut().unwrap().graded_templates[0].panels[0]
                .polygon.as_mut().unwrap().free_curve_points.get_mut(&edge).unwrap()[0];
            match case {
                0 => knot.position.x += 0.001,
                1 => knot.derivative_in.as_mut().unwrap().x += 0.001,
                2 => knot.t = 0.8,
                3 => knot.id = "forged".into(),
                4 => knot.position.x = f64::NAN,
                5 => knot.mirror_group = Some("mirror".into()),
                _ => knot.derivative_out = Some(DVec2::new(f64::INFINITY, 0.)),
            }
            assert!(recompute_native_six_size_measurement20261027(&project, &overrides).is_err(), "case {case}");
        }
        let mut duplicate = free_knot_sewn_fixture();
        for panel in &mut duplicate.template.panels {
            let poly = panel.polygon.as_mut().unwrap();
            let second = poly.free_curve_points[&edge][0].clone();
            poly.free_curve_points.get_mut(&edge).unwrap().push(second);
        }
        assert!(recompute_native_six_size_measurement20261027(&duplicate, &overrides).is_err());
        let mut stale = free_knot_sewn_fixture();
        stale.template.panels[0].polygon.as_mut().unwrap().free_curve_points
            .get_mut(&edge).unwrap()[0].position.x += 0.001;
        assert!(recompute_native_six_size_measurement20261027(&stale, &overrides).is_err());
    }

    #[test]
    fn paired_cubic_sewn_notches_and_cut_follow_all_six_grades() {
        let project = cubic_sewn_fixture();
        let snapshot = serde_json::to_value(&project).unwrap();
        let before = audit_native_six_size_sewn_balance20261027(
            project.grade_run.as_ref().unwrap(),&project.template).unwrap();
        let (base,run,graph,report) = recompute_native_six_size_measurement20261027(
            &project,&BTreeMap::from([("neck_distance".into(),380.)])).unwrap();
        assert_eq!(serde_json::to_value(&project).unwrap(),snapshot);
        assert_eq!(report["manufacturerApproved"],false);
        assert!(graph.source_matches(&base));
        run.validate(&base).unwrap();
        let after = audit_native_six_size_sewn_balance20261027(&run,&base).unwrap();
        assert_eq!(after.sizes.len(),6);
        assert!(!after.ease_review_required);
        for (index,grade) in run.graded_templates.iter().enumerate() {
            let proof = &after.sizes[index].seams[0];
            assert!(proof.mismatch_m < 1e-9);
            assert_eq!(proof.a.notch_positions_m.len(),1);
            assert_eq!(proof.b.notch_positions_m.len(),1);
            assert_eq!(proof.notch_interval_lengths_m.len(),2);
            assert!((proof.a.sewn_interval_m - before.sizes[index].seams[0].a.sewn_interval_m).abs()>0.01);
            assert!((proof.b.sewn_interval_m - before.sizes[index].seams[0].b.sewn_interval_m).abs()>0.01);
            for (panel_index,panel) in grade.panels.iter().enumerate() {
                let poly = panel.polygon.as_ref().unwrap();
                let base_poly = base.panels[panel_index].polygon.as_ref().unwrap();
                let old_poly = project.grade_run.as_ref().unwrap().graded_templates[index].panels[panel_index]
                    .polygon.as_ref().unwrap();
                let old_base = project.template.panels[panel_index].polygon.as_ref().unwrap();
                let edge = &poly.edges[0];
                let controls = poly.curves[edge];
                let start = old_poly.points[0] - old_base.points[0];
                let end = old_poly.points[1] - old_base.points[1];
                let base_controls = base_poly.curves[edge];
                assert!(controls[0].distance(base_controls[0]+(start*2.+end)/3.)<1e-9);
                assert!(controls[1].distance(base_controls[1]+(start+end*2.)/3.)<1e-9);
                assert_eq!(poly.curves.len(),1);
                assert_eq!(poly.notches,old_poly.notches);
                verify_industrial(poly).unwrap();
                let cut = production_cutline(poly).unwrap();
                assert_eq!(cut.notches.len(),1);
                assert_eq!(cut.notches[0].edge_id,*edge);
                assert_eq!(cut.notches[0].t,0.5);
                assert!(cut.perimeter_m.is_finite() && cut.area_m2 > 0.);
            }
        }
    }

    #[test]
    fn cubic_recompute_rejects_invalid_knots_controls_and_grade_handles() {
        let overrides = BTreeMap::from([("neck_distance".into(),380.)]);
        let mut bad_control = cubic_sewn_fixture();
        let edge = bad_control.template.panels[0].polygon.as_ref().unwrap().edges[0].clone();
        bad_control.template.panels[0].polygon.as_mut().unwrap().curves.get_mut(&edge).unwrap()[0].x=f64::NAN;
        assert!(recompute_native_six_size_measurement20261027(&bad_control,&overrides).is_err());

        let mut bad_grade = cubic_sewn_fixture();
        bad_grade.grade_run.as_mut().unwrap().graded_templates[0].panels[0]
            .polygon.as_mut().unwrap().curves.get_mut(&edge).unwrap()[0].x+=0.01;
        assert!(recompute_native_six_size_measurement20261027(&bad_grade,&overrides).is_err());

        let mut wrong_curve_edge = cubic_sewn_fixture();
        wrong_curve_edge.template.panels[0].polygon.as_mut().unwrap().curves
            .insert("missing-edge".into(),[DVec2::new(0.1,0.01),DVec2::new(0.2,0.01)]);
        assert!(recompute_native_six_size_measurement20261027(&wrong_curve_edge,&overrides).is_err());

        let mut wrong_sewing_curve = cubic_sewn_fixture();
        let back = &mut wrong_sewing_curve.grade_run.as_mut().unwrap().graded_templates[0].panels[1];
        back.polygon.as_mut().unwrap().curves.get_mut(&edge).unwrap()[0].y += 0.02;
        assert!(recompute_native_six_size_measurement20261027(&wrong_sewing_curve,&overrides).is_err());
    }

    #[test]
    fn sewn_two_panel_reactivity_balances_six_physical_stitch_and_cut_sizes() {
        let project = sewn_fixture();
        let original = serde_json::to_value(&project).unwrap();
        let (base, run, graph, report) = recompute_native_six_size_measurement20261027(
            &project, &BTreeMap::from([("neck_distance".into(),380.)])).unwrap();
        assert_eq!(serde_json::to_value(&project).unwrap(), original);
        assert_eq!(report["manufacturerApproved"], false);
        assert!(graph.source_matches(&base));
        assert_eq!(serde_json::to_value(&base.seams).unwrap(),
            serde_json::to_value(&project.template.seams).unwrap());
        let audit = audit_native_six_size_sewn_balance20261027(&run,&base).unwrap();
        assert!(!audit.ease_review_required);
        assert_eq!(audit.sizes.len(),6);
        for (i, size) in audit.sizes.iter().enumerate() {
            assert_eq!(size.seams.len(),1);
            assert!(size.seams[0].mismatch_m < 1e-9);
            assert_eq!(size.seams[0].notch_interval_lengths_m.len(),2);
            assert_eq!(size.seams[0].a.edge_id, run.graded_templates[i].panels[0].polygon.as_ref().unwrap().edges[0]);
            assert_eq!(size.seams[0].a.notch_positions_m.len(),1);
            assert_eq!(size.seams[0].b.notch_positions_m.len(),1);
            let before = audit_native_six_size_sewn_balance20261027(
                project.grade_run.as_ref().unwrap(), &project.template).unwrap();
            assert!((size.seams[0].a.sewn_interval_m - before.sizes[i].seams[0].a.sewn_interval_m).abs() > 0.001);
            assert!((size.seams[0].b.sewn_interval_m - before.sizes[i].seams[0].b.sewn_interval_m).abs() > 0.001);
            for panel in &run.graded_templates[i].panels {
                let poly = panel.polygon.as_ref().unwrap();
                verify_industrial(poly).unwrap();
                assert_eq!(production_cutline(poly).unwrap().notches.len(),1);
            }
        }
    }

    #[test]
    fn sewn_recompute_rejects_ease_mismatch_and_broken_notch_correspondence() {
        let overrides = BTreeMap::from([("neck_distance".into(),380.)]);
        let mut ease = sewn_fixture();
        ease.template.seams[0].allow_ease = true;
        ease.grade_run.as_mut().unwrap().base_template = ease.template.clone();
        for grade in &mut ease.grade_run.as_mut().unwrap().graded_templates {
            grade.seams = ease.template.seams.clone();
        }
        ease.native_point_bindings.as_mut().unwrap().source_template = ease.template.clone();
        assert!(recompute_native_six_size_measurement20261027(&ease,&overrides)
            .unwrap_err().contains("allow_ease:false"));

        let mut mismatch = sewn_fixture();
        mismatch.grade_run.as_mut().unwrap().graded_templates[0].panels[1]
            .polygon.as_mut().unwrap().points[1].x += 0.02;
        assert!(recompute_native_six_size_measurement20261027(&mismatch,&overrides).is_err());

        let mut notch = sewn_fixture();
        let back_notches = {
            let back = notch.template.panels[1].polygon.as_mut().unwrap();
            back.notches.clear();
            back.notches.insert(back.edges[0].clone(),
                vec![crate::garment::polygon::EdgeNotch {t:0.4,depth_m:0.004}]);
            back.notches.clone()
        };
        notch.grade_run.as_mut().unwrap().base_template = notch.template.clone();
        for grade in &mut notch.grade_run.as_mut().unwrap().graded_templates {
            grade.panels[1].polygon.as_mut().unwrap().notches = back_notches.clone();
        }
        notch.native_point_bindings.as_mut().unwrap().source_template = notch.template.clone();
        assert!(recompute_native_six_size_measurement20261027(&notch,&overrides).is_err());
    }

    #[test]
    fn six_size_native_cut_notches_follow_recomputed_stitch_boundaries() {
        let project = industrial_fixture();
        let source_snapshot = serde_json::to_value(&project).unwrap();
        let (base, run, graph, _) = recompute_native_six_size_measurement20261027(
            &project, &BTreeMap::from([("neck_distance".into(), 80.)])).unwrap();
        assert_eq!(serde_json::to_value(&project).unwrap(), source_snapshot);
        assert!(graph.source_matches(&base));
        run.validate(&base).unwrap();
        for (index, template) in run.graded_templates.iter().enumerate() {
            for (panel_index, panel) in template.panels.iter().enumerate() {
                let poly = panel.polygon.as_ref().unwrap();
                let old = project.grade_run.as_ref().unwrap().graded_templates[index]
                    .panels[panel_index].polygon.as_ref().unwrap();
                assert_eq!(poly.edges, old.edges);
                assert_eq!(poly.notches, old.notches);
                assert_eq!(poly.seam_allowances, old.seam_allowances);
                let before_cut = production_cutline(old).unwrap();
                let after_cut = production_cutline(poly).unwrap();
                assert!(after_cut.area_m2 > 0. && after_cut.perimeter_m.is_finite());
                assert_eq!(after_cut.notches.len(), 1);
                let name = &poly.edges[0];
                let before = &before_cut.notches[0];
                let after = &after_cut.notches[0];
                assert_eq!(after.edge_id, *name);
                assert_eq!(after.t, 0.45);
                assert_eq!(after.depth_m, 0.004);
                assert!((after.cut_start - before.cut_start).length() > 1e-5);
                verify_industrial(poly).unwrap();
            }
        }
    }

    #[test]
    fn fails_closed_for_missing_allowance_invalid_depth_and_stale_industrial_graph() {
        let overrides = BTreeMap::from([("neck_distance".into(), 80.)]);
        let mut missing = industrial_fixture();
        let edge = missing.template.panels[0].polygon.as_ref().unwrap().edges[0].clone();
        missing.template.panels[0].polygon.as_mut().unwrap().seam_allowances.remove(&edge);
        assert!(recompute_native_six_size_measurement20261027(&missing, &overrides).is_err());

        let mut deep = industrial_fixture();
        for panel in &mut deep.template.panels {
            let poly = panel.polygon.as_mut().unwrap();
            let edge = poly.edges[0].clone();
            poly.notches.get_mut(&edge).unwrap()[0].depth_m = 0.03;
        }
        let run = deep.grade_run.as_mut().unwrap();
        run.base_template = deep.template.clone();
        for template in &mut run.graded_templates {
            for panel in &mut template.panels {
                let source = deep.template.panels.iter().find(|p| p.id == panel.id).unwrap();
                panel.polygon.as_mut().unwrap().notches = source.polygon.as_ref().unwrap().notches.clone();
            }
        }
        deep.native_point_bindings.as_mut().unwrap().source_template = deep.template.clone();
        assert!(recompute_native_six_size_measurement20261027(&deep, &overrides).is_err());

        let mut stale = industrial_fixture();
        let polygon = stale.template.panels[0].polygon.as_mut().unwrap();
        let edge = polygon.edges[0].clone();
        polygon.notches.get_mut(&edge).unwrap()[0].t = 0.53;
        assert!(!stale.native_point_bindings.as_ref().unwrap().source_matches(&stale.template));
        assert!(recompute_native_six_size_measurement20261027(&stale, &overrides).is_err());
    }

    #[test]
    fn moves_two_panels_and_preserves_each_six_size_offset() {
        let project = fixture();
        let overrides = BTreeMap::from([("neck_distance".into(), 80.)]);
        let (base, run, graph, report) =
            recompute_native_six_size_measurement20261027(&project, &overrides).unwrap();
        assert_eq!(report["format"], "exo-native-reactive-size-run.v1");
        assert_eq!(report["changedPanels"], 2);
        assert_eq!(report["changedBindings"], 3);
        assert_eq!(report["bySize"].as_array().unwrap().len(), 6);
        let front = base
            .panels
            .iter()
            .find(|p| p.id == "front")
            .unwrap()
            .polygon
            .as_ref()
            .unwrap();
        assert!((front.points[2] - front.points[1] - DVec2::new(0.08, 0.)).length() < 1e-9);
        assert_eq!(report["manufacturerApproved"], false);
        assert!(graph.source_matches(&base));
        run.validate(&base).unwrap();
        for (i, grade) in run.graded_templates.iter().enumerate() {
            for panel in &grade.panels {
                let index = base.panels.iter().position(|p| p.id == panel.id).unwrap();
                let old_base = &project.template.panels[index]
                    .polygon
                    .as_ref()
                    .unwrap()
                    .points;
                let old_grade = &project.grade_run.as_ref().unwrap().graded_templates[i].panels
                    [index]
                    .polygon
                    .as_ref()
                    .unwrap()
                    .points;
                let new_base = &base.panels[index].polygon.as_ref().unwrap().points;
                let new_grade = &panel.polygon.as_ref().unwrap().points;
                for k in 0..new_base.len() {
                    assert!(
                        (new_grade[k] - new_base[k] - (old_grade[k] - old_base[k])).length() < 1e-9
                    );
                }
            }
        }
    }

    #[test]
    fn rejects_attached_panel_and_stale_graph() {
        let overrides = BTreeMap::from([("neck_distance".into(), 80.)]);
        let mut project = fixture();
        project.template.panels[0]
            .polygon
            .as_mut()
            .unwrap()
            .annotations
            .push(crate::garment::polygon::PatternAnnotation {
                id: "note".into(),
                text: "attachment".into(),
                position: DVec2::ZERO,
            });
        project.grade_run.as_mut().unwrap().base_template = project.template.clone();
        for template in &mut project.grade_run.as_mut().unwrap().graded_templates {
            template.panels[0].polygon.as_mut().unwrap().annotations = project.template.panels[0]
                .polygon
                .as_ref()
                .unwrap()
                .annotations
                .clone();
        }
        project
            .native_point_bindings
            .as_mut()
            .unwrap()
            .source_template = project.template.clone();
        project
            .grade_run
            .as_ref()
            .unwrap()
            .validate(&project.template)
            .unwrap();
        assert!(recompute_native_six_size_measurement20261027(&project, &overrides).is_err());
        let mut stale = fixture();
        stale.native_point_bindings.as_mut().unwrap().bindings[1]
            .depends_on
            .push("front_neck".into());
        assert!(recompute_native_six_size_measurement20261027(&stale, &overrides).is_err());
    }

    #[test]
    fn rejects_stale_saved_target_with_consistent_catalog_and_source_snapshot() {
        let mut project = fixture();
        let old = project.template.panels[0].polygon.as_ref().unwrap().points[1];
        // Tampering all source snapshots and six grades consistently passes
        // their structural validation, but violates the installed point rule.
        let wrong = old + DVec2::new(0.00025, 0.);
        project.template.panels[0].polygon.as_mut().unwrap().points[1] = wrong;
        let run = project.grade_run.as_mut().unwrap();
        run.base_template = project.template.clone();
        for template in &mut run.graded_templates {
            template.panels[0].polygon.as_mut().unwrap().points[1].x += 0.00025;
        }
        project.native_point_bindings.as_mut().unwrap().source_template = project.template.clone();
        run.validate(&project.template).unwrap();
        let result = recompute_native_six_size_measurement20261027(
            &project, &BTreeMap::from([("neck_distance".into(), 80.)]),
        );
        assert!(result.unwrap_err().contains("does not match source geometry"));
    }

    #[test]
    fn rejects_inconsistent_saved_dependent_even_if_direct_roots_are_valid() {
        let mut project = fixture();
        let original = project.template.panels[0].polygon.as_ref().unwrap().points[2];
        // The direct roots remain valid. Only the chained dependent drifts.
        project.template.panels[0].polygon.as_mut().unwrap().points[2] =
            original + DVec2::new(0.00025, 0.);
        let run = project.grade_run.as_mut().unwrap();
        run.base_template = project.template.clone();
        for template in &mut run.graded_templates {
            template.panels[0].polygon.as_mut().unwrap().points[2].x += 0.00025;
        }
        project.native_point_bindings.as_mut().unwrap().source_template = project.template.clone();
        run.validate(&project.template).unwrap();
        let result = recompute_native_six_size_measurement20261027(
            &project, &BTreeMap::from([("neck_distance".into(), 80.)]),
        );
        assert!(result.unwrap_err().contains("does not match source geometry"));
    }

    #[test]
    fn selective_single_piece_preserves_other_sizes_exactly_and_repeats() {
        let mut project = industrial_fixture();
        let graph = project.native_point_bindings.as_mut().unwrap();
        graph.measurements.insert("back_distance".into(),
            NativeDraftMeasurement::Number(76.321687612));
        for rule in &mut graph.bindings {
            if rule.panel_id == "back" { rule.distance_formula = "back_distance".into(); }
        }
        for value in [80., 82., 79.] {
            let original = serde_json::to_value(&project).unwrap();
            let (base, run, graph, report) = recompute_native_six_size_measurement20261027(
                &project, &BTreeMap::from([("neck_distance".into(), value)])).unwrap();
            assert_eq!(serde_json::to_value(&project).unwrap(), original);
            assert_eq!(report["changedPanels"], 1);
            assert_eq!(report["changedBindings"], 2);
            assert_eq!(report["panelIds"], serde_json::json!(["front"]));
            assert_eq!(report["bySize"].as_array().unwrap().len(), 6);
            for (i, sized) in run.graded_templates.iter().enumerate() {
                for piece in &sized.panels {
                    let old = project.grade_run.as_ref().unwrap().graded_templates[i]
                        .panels.iter().find(|p|p.id==piece.id).unwrap();
                    if piece.id != "front" {
                        assert_eq!(serde_json::to_value(piece).unwrap(), serde_json::to_value(old).unwrap());
                    } else {
                        assert_ne!(piece.polygon.as_ref().unwrap().points, old.polygon.as_ref().unwrap().points);
                        verify_industrial(piece.polygon.as_ref().unwrap()).unwrap();
                    }
                }
            }
            assert!(graph.source_matches(&base));
            project.template=base; project.grade_run=Some(run); project.native_point_bindings=Some(graph);
        }
        assert!(recompute_native_six_size_measurement20261027(
            &project, &BTreeMap::from([("neck_distance".into(),79.)])).unwrap_err()
            .contains("at least one changed"));
    }

    #[test]
    fn single_bound_piece_is_supported_but_unbalanced_sewn_edit_is_not() {
        let mut project = fixture();
        project.native_point_bindings.as_mut().unwrap().bindings.retain(|r|r.panel_id=="front");
        let (_, _, _, report) = recompute_native_six_size_measurement20261027(
            &project, &BTreeMap::from([("neck_distance".into(),80.)])).unwrap();
        assert_eq!(report["changedPanels"],1);
        let mut sewn = sewn_fixture();
        sewn.native_point_bindings.as_mut().unwrap().bindings.retain(|r|r.panel_id=="front");
        let original=serde_json::to_value(&sewn).unwrap();
        assert!(recompute_native_six_size_measurement20261027(
            &sewn, &BTreeMap::from([("neck_distance".into(),380.)])).is_err());
        assert_eq!(serde_json::to_value(&sewn).unwrap(),original);
    }

    #[test]
    fn computed_formula_drives_two_panels_and_all_six_sizes_without_allowing_formula_override() {
        use crate::fitting::NativeDraftMeasurementDefinition;
        let mut project=fixture();
        let graph=project.native_point_bindings.as_mut().unwrap();
        graph.measurements.remove("neck_distance");
        graph.measurements.insert("half_neck".into(),
            NativeDraftMeasurement::Number(76.321687612/2.));
        graph.measurements.insert("neck_distance".into(),
            NativeDraftMeasurement::Definition(NativeDraftMeasurementDefinition{
                formula:Some("half_neck * 2".into()),value_mm:None}));
        let original=serde_json::to_value(&project).unwrap();
        let (base,grades,next,report)=recompute_native_six_size_measurement20261027(
            &project,&BTreeMap::from([("half_neck".into(),40.)])).unwrap();
        assert_eq!(serde_json::to_value(&project).unwrap(),original);
        assert!(next.source_matches(&base));
        grades.validate(&base).unwrap();
        assert_eq!(report["bySize"].as_array().unwrap().len(),6);
        assert_eq!(next.measurements.get("half_neck").and_then(|m|match m {
            NativeDraftMeasurement::Number(n)=>Some(*n),_=>None}),Some(40.));
        for (old,new) in project.grade_run.as_ref().unwrap().graded_templates.iter()
            .zip(&grades.graded_templates) {
            for panel_id in ["front","back"] {
                let x=|template:&GarmentTemplate|template.panels.iter()
                    .find(|p|p.id==panel_id).unwrap().polygon.as_ref().unwrap().points[1];
                assert!(x(new).distance(x(old))>0.003);
            }
        }
        assert!(recompute_native_six_size_measurement20261027(
            &project,&BTreeMap::from([("neck_distance".into(),90.)])).is_err());
        let mut cycle=project.clone();
        cycle.native_point_bindings.as_mut().unwrap().measurements.insert("half_neck".into(),
            NativeDraftMeasurement::Definition(NativeDraftMeasurementDefinition{
                formula:Some("neck_distance + 1".into()),value_mm:None}));
        assert!(recompute_native_six_size_measurement20261027(
            &cycle,&BTreeMap::from([("half_neck".into(),40.)])).is_err());
    }
}
