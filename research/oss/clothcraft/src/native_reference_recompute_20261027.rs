//! Qualified authoritative 2D reference-anchor recomputation. This is an
//! executable *subset*, not the general Modaris dependency/grade graph.
//! The entire native edit is compiled before the session records Undo.
use crate::{
    authoring::{self, Command, Edit},
    fitting::{NativeDraftMeasurement, NativeDraftPointBindings, NativeDraftPointRule},
    garment::template::GarmentTemplate,
};
use glam::DVec2;
use std::collections::{BTreeMap, BTreeSet};
use crate::native_measurement_formulas_20261027::evaluate_native_measurements_20261027;

fn safe_contour(points: &[DVec2]) -> Result<f64, String> {
    if points.len() < 3
        || points.len() > 128
        || points
            .iter()
            .any(|p| !p.is_finite() || p.abs().max_element() > 10.0)
    {
        return Err("Native reactive contour exceeds qualified finite point bounds".into());
    }
    let n = points.len();
    let mut twice_area = 0.0;
    for i in 0..n {
        let a = points[i];
        let b = points[(i + 1) % n];
        if a.distance(b) < 1e-6 {
            return Err("Native reactive contour has collapsed edge".into());
        }
        twice_area += a.perp_dot(b);
        for j in (i + 2)..n {
            if i == 0 && j == n - 1 {
                continue;
            }
            let c = points[j];
            let d = points[(j + 1) % n];
            let cross = |x: DVec2, y: DVec2, z: DVec2| (y - x).perp_dot(z - x);
            let (u, v, w, z) = (
                cross(a, b, c),
                cross(a, b, d),
                cross(c, d, a),
                cross(c, d, b),
            );
            // Nonadjacent boundary contact, not merely strict crossing, is unsafe.
            let on = |x: DVec2, y: DVec2, p: DVec2| {
                cross(x, y, p).abs() < 1e-10 && (p - x).dot(p - y) <= 1e-12
            };
            if (u * v < -1e-18 && w * z < -1e-18)
                || on(a, b, c)
                || on(a, b, d)
                || on(c, d, a)
                || on(c, d, b)
            {
                return Err("Native reactive contour self-intersects or touches".into());
            }
        }
    }
    if !twice_area.is_finite() || twice_area.abs() < 2e-9 {
        return Err("Native reactive contour has negligible area".into());
    }
    Ok(twice_area.signum())
}

fn direct_mm(rule: &NativeDraftPointRule, graph: &NativeDraftPointBindings) -> Result<f64, String> {
    // Intentionally no JS expression interpretation or silent approximation.
    // The broader saved v1 graph permits computed expressions; this first
    // native operation accepts only a direct, named numeric measurement.
    let value = graph
        .measurements
        .get(rule.distance_formula.as_str())
        .ok_or("Native reactive operation requires a named direct measurement")?;
    let mm = match value {
        NativeDraftMeasurement::Number(n) => *n,
        NativeDraftMeasurement::Definition(def) if def.formula.is_none() => {
            def.value_mm.ok_or("Missing direct native measurement")?
        }
        _ => return Err(
            "Computed measurement requires a native formula solver; refusing automatic recompute"
                .into(),
        ),
    };
    if !mm.is_finite() || mm.abs() > 5000.0 {
        return Err("Native reactive distance exceeds ±5000 mm".into());
    }
    Ok(mm / 1000.0)
}

fn point_position(
    rule: &NativeDraftPointRule,
    points: &[DVec2],
    graph: &NativeDraftPointBindings,
) -> Result<DVec2, String> {
    let distance = direct_mm(rule, graph)?;
    point_position_at_distance(rule, points, distance)
}

fn point_position_at_distance(
    rule: &NativeDraftPointRule,
    points: &[DVec2],
    distance: f64,
) -> Result<DVec2, String> {
    let a = *points.get(rule.a).ok_or("Unknown native reference A")?;
    let result = match rule.mode.as_str() {
        "polar" => {
            let angle = rule.angle_deg.unwrap_or(0.0).to_radians();
            a + DVec2::new(angle.cos(), angle.sin()) * distance
        }
        "along" | "normal" => {
            let b = *points.get(rule.b).ok_or("Unknown native reference B")?;
            let delta = b - a;
            if delta.length_squared() < 1e-12 {
                return Err("Native reactive reference direction has zero length".into());
            }
            let unit = delta.normalize();
            let direction = if rule.mode == "normal" {
                DVec2::new(-unit.y, unit.x)
            } else {
                unit
            };
            a + direction * distance
        }
        _ => return Err("Unsupported native reactive point construction".into()),
    };
    if !result.is_finite() || result.abs().max_element() > 10.0 {
        return Err("Native reactive target exceeds material coordinate bounds".into());
    }
    Ok(result)
}

fn point_position_from_values(
    rule: &NativeDraftPointRule,
    points: &[DVec2],
    values: &BTreeMap<String, f64>,
) -> Result<DVec2, String> {
    let mm = *values.get(&rule.distance_formula)
        .ok_or("Native point distance must name a saved measurement")?;
    if !mm.is_finite() || mm.abs() > 5000.0 {
        return Err("Computed native point distance exceeds ±5000 mm".into());
    }
    point_position_at_distance(rule, points, mm / 1000.0)
}

/// Change one directly authored measurement, then solve its native point rules
/// in dependency order. The persisted source and all target coordinates remain
/// Rust-owned. This deliberately accepts only detached, straight, one-panel
/// constructions whose existing bound points satisfy every saved rule.
pub fn recompute_native_reference_measurement_20261027(
    template: &GarmentTemplate,
    graph: &NativeDraftPointBindings,
    measurement: &str,
    expected_mm: f64,
    value_mm: f64,
) -> Result<(Edit, NativeDraftPointBindings, Vec<String>), String> {
    graph.valid_against(template)?;
    if !graph.source_matches(template) {
        return Err("Stored native point graph is stale relative to authored template".into());
    }
    if !expected_mm.is_finite() || !value_mm.is_finite()
        || expected_mm.abs() > 5000.0 || value_mm.abs() > 5000.0
        || (expected_mm - value_mm).abs() < 1e-8
    {
        return Err("Invalid, excessive or unchanged direct native measurement".into());
    }
    let previous = graph.measurements.get(measurement)
        .ok_or("Unknown direct native measurement")?;
    let current = match previous {
        NativeDraftMeasurement::Number(n) => *n,
        NativeDraftMeasurement::Definition(def) if def.formula.is_none() =>
            def.value_mm.ok_or("Missing direct native measurement")?,
        _ => return Err("Computed measurement cannot be directly edited".into()),
    };
    if current != expected_mm {
        return Err("Direct measurement differs from expected original value".into());
    }
    // Evaluate the *entire* installed worksheet before any edit. This also
    // detects broken, cyclic or unsupported formulas not bound to a point.
    let original_values = evaluate_native_measurements_20261027(&graph.measurements)?;
    let panel_id = &graph.bindings[0].panel_id;
    if graph.bindings.iter().any(|b| b.panel_id != *panel_id)
        || template.panels.iter().filter(|p| p.id == *panel_id).count() != 1
    {
        return Err("Native measurement recompute requires one uniquely named panel".into());
    }
    if template.seams.iter().any(|s| s.a.panel == *panel_id || s.b.panel == *panel_id) {
        return Err("Sewn panel cannot use qualified native measurement recompute".into());
    }
    let panel = template.panels.iter().find(|p| p.id == *panel_id).unwrap();
    let poly = panel.polygon.as_ref().ok_or("Native bound panel has no polygon")?;
    if !panel.pins.is_empty() || !panel.pin_points.is_empty()
        || !poly.curves.is_empty() || !poly.free_curve_points.is_empty()
        || !poly.vertex_ids.is_empty() || !poly.vertex_mirror_groups.is_empty()
        || !poly.holes.is_empty() || !poly.lines.is_empty()
        || !poly.target_lengths.is_empty() || !poly.notches.is_empty()
        || !poly.seam_allowances.is_empty() || !poly.annotations.is_empty()
        || !poly.measurements.is_empty()
    {
        return Err("Attached native geometry or manufacturing metadata requires a broader solver".into());
    }
    let winding = safe_contour(&poly.points)?;
    let by_target: BTreeMap<usize, &NativeDraftPointRule> = graph.bindings.iter()
        .map(|b| (b.point_index, b)).collect();
    let by_id: BTreeMap<&str, &NativeDraftPointRule> = graph.bindings.iter()
        .map(|b| (b.id.as_str(), b)).collect();
    let mut remaining: BTreeSet<&str> = by_id.keys().copied().collect();
    let mut resolved = BTreeSet::new();
    let mut ordered = Vec::new();
    while !remaining.is_empty() {
        let id = remaining.iter().find(|id| by_id.get(**id).is_some_and(|b|
            b.depends_on.iter().all(|dep| resolved.contains(dep.as_str()))))
            .copied().ok_or("Unresolved native measurement dependency cycle")?;
        remaining.remove(id);
        resolved.insert(id);
        ordered.push(by_id[id]);
    }
    // Verify the entire installed graph against the native geometry BEFORE
    // changing even one numeric input. A tampered/stale target must never be
    // silently 'fixed' by an unrelated measurement edit.
    for rule in &ordered {
        if rule.a == rule.point_index || rule.b == rule.point_index {
            return Err("Self-referential native measurement construction".into());
        }
        let used = if rule.mode == "polar" { vec![rule.a] } else { vec![rule.a, rule.b] };
        let expected_deps: BTreeSet<&str> = used.iter()
            .filter_map(|index| by_target.get(index).map(|b| b.id.as_str())).collect();
        let declared: BTreeSet<&str> = rule.depends_on.iter().map(String::as_str).collect();
        if expected_deps != declared {
            return Err("Native measurement dependencies differ from bound reference anchors".into());
        }
        let existing = point_position_from_values(rule, &poly.points, &original_values)?;
        if poly.points[rule.point_index].distance(existing) > 1e-8 {
            return Err("Native bound target geometry drifts from installed measurement rule".into());
        }
    }
    let mut rebased = graph.clone();
    let amended = rebased.measurements.get_mut(measurement).unwrap();
    match amended {
        NativeDraftMeasurement::Number(n) => *n = value_mm,
        NativeDraftMeasurement::Definition(def) => def.value_mm = Some(value_mm),
    }
    let changed_values = evaluate_native_measurements_20261027(&rebased.measurements)?;
    if !graph.bindings.iter().any(|rule| {
        original_values.get(&rule.distance_formula) != changed_values.get(&rule.distance_formula)
    }) {
        return Err("Direct measurement does not affect a qualified native bound target".into());
    }
    let mut points = poly.points.clone();
    let mut edits = Vec::new();
    let mut changed = Vec::new();
    for rule in &ordered {
        let next = point_position_from_values(rule, &points, &changed_values)?;
        if points[rule.point_index].distance(next) > 1e-8 {
            if edits.len() == 32 {
                return Err("Native measurement AnchorGroup exceeds 32 point edits".into());
            }
            points[rule.point_index] = next;
            edits.push((rule.point_index, next));
            changed.push(rule.id.clone());
        }
    }
    if edits.is_empty() {
        return Err("Measurement change causes no native target geometry change".into());
    }
    if safe_contour(&points)? != winding {
        return Err("Native measurement edit reverses contour winding".into());
    }
    for rule in &ordered {
        if points[rule.point_index].distance(point_position_from_values(rule, &points, &changed_values)?) > 1e-8 {
            return Err("Final native measurement construction is inconsistent".into());
        }
    }
    let edit = authoring::apply(template, Command::AnchorGroup {
        panel: panel_id.clone(), edits,
    })?;
    rebased.source_template = edit.template.clone();
    rebased.valid_against(&edit.template)?;
    Ok((edit, rebased, changed))
}

/// A caller supplies only the source anchor, expected original and destination.
/// Rust owns every dependent point computation and persists its rebased rules.
/// Refuses sewn/graded/curved/industrial attachments and computed expressions.
pub fn recompute_native_reference_anchor_20261027(
    template: &GarmentTemplate,
    graph: &NativeDraftPointBindings,
    panel_id: &str,
    source_index: usize,
    expected: DVec2,
    destination: DVec2,
) -> Result<(Edit, NativeDraftPointBindings, Vec<String>), String> {
    graph.valid_against(template)?;
    if !graph.source_matches(template) {
        return Err("Stored native point graph is stale relative to authored template".into());
    }
    if !expected.is_finite()
        || !destination.is_finite()
        || destination.abs().max_element() > 10.0
        || expected.distance(destination) < 1e-8
    {
        return Err("Invalid or unchanged native reference source edit".into());
    }
    if template.panels.iter().filter(|p| p.id == panel_id).count() != 1 {
        return Err("Native reactive operation requires one uniquely named panel".into());
    }
    if template
        .seams
        .iter()
        .any(|s| s.a.panel == panel_id || s.b.panel == panel_id)
    {
        return Err("Sewn panel cannot use qualified native reactive recompute".into());
    }
    let panel = template.panels.iter().find(|p| p.id == panel_id).unwrap();
    let poly = panel
        .polygon
        .as_ref()
        .ok_or("Native reactive panel has no editable polygon")?;
    if !panel.pins.is_empty()
        || !panel.pin_points.is_empty()
        || !poly.curves.is_empty()
        || !poly.free_curve_points.is_empty()
        || !poly.vertex_ids.is_empty()
        || !poly.vertex_mirror_groups.is_empty()
        || !poly.holes.is_empty()
        || !poly.lines.is_empty()
        || !poly.target_lengths.is_empty()
        || !poly.notches.is_empty()
        || !poly.seam_allowances.is_empty()
        || !poly.annotations.is_empty()
        || !poly.measurements.is_empty()
    {
        return Err(
            "Attached native geometry or manufacturing metadata requires a broader solver".into(),
        );
    }
    let sign = safe_contour(&poly.points)?;
    if source_index >= poly.points.len() || poly.points[source_index] != expected {
        return Err("Native source anchor differs from expected original coordinate".into());
    }
    if graph
        .bindings
        .iter()
        .any(|b| b.panel_id != panel_id || b.point_index == source_index)
    {
        return Err(
            "Qualified native graph requires one panel and an unbound source anchor".into(),
        );
    }
    let by_target: BTreeMap<usize, &NativeDraftPointRule> = graph
        .bindings
        .iter()
        .map(|rule| (rule.point_index, rule))
        .collect();
    let by_id: BTreeMap<&str, &NativeDraftPointRule> = graph
        .bindings
        .iter()
        .map(|rule| (rule.id.as_str(), rule))
        .collect();
    let mut remaining: BTreeSet<&str> = by_id.keys().copied().collect();
    let mut resolved = BTreeSet::new();
    let mut order = Vec::new();
    while !remaining.is_empty() {
        let ready = remaining
            .iter()
            .find(|id| {
                by_id.get(**id).is_some_and(|rule| {
                    rule.depends_on
                        .iter()
                        .all(|dep| resolved.contains(dep.as_str()))
                })
            })
            .copied()
            .ok_or("Unresolved native point dependency cycle")?;
        remaining.remove(ready);
        resolved.insert(ready);
        order.push(by_id[ready]);
    }
    let mut working = poly.points.clone();
    working[source_index] = destination;
    let mut edits = vec![(source_index, destination)];
    let mut changed = Vec::new();
    for rule in &order {
        if rule.a == rule.point_index || rule.b == rule.point_index {
            return Err(
                "Self-referential native construction is not qualified for recompute".into(),
            );
        }
        let used = if rule.mode == "polar" {
            vec![rule.a]
        } else {
            vec![rule.a, rule.b]
        };
        let expected_deps: BTreeSet<&str> = used
            .iter()
            .filter_map(|index| by_target.get(index).map(|b| b.id.as_str()))
            .collect();
        let declared: BTreeSet<&str> = rule.depends_on.iter().map(String::as_str).collect();
        if expected_deps != declared {
            return Err(
                "Native reactive reference dependencies must exactly match bound input anchors"
                    .into(),
            );
        }
        let next = point_position(rule, &working, graph)?;
        if working[rule.point_index].distance(next) >= 1e-8 {
            if edits.len() == 32 {
                return Err("Native reactive AnchorGroup exceeds 32 point edits".into());
            }
            working[rule.point_index] = next;
            edits.push((rule.point_index, next));
            changed.push(rule.id.clone());
        }
    }
    if safe_contour(&working)? != sign {
        return Err("Native reactive edit reverses contour winding".into());
    }
    for rule in &order {
        if working[rule.point_index].distance(point_position(rule, &working, graph)?) > 1e-8 {
            return Err(
                "Native reactive point dependencies are not satisfied in final geometry".into(),
            );
        }
    }
    let edit = authoring::apply(
        template,
        Command::AnchorGroup {
            panel: panel_id.into(),
            edits,
        },
    )?;
    let mut rebased = graph.clone();
    rebased.source_template = edit.template.clone();
    rebased.valid_against(&edit.template)?;
    Ok((edit, rebased, changed))
}
