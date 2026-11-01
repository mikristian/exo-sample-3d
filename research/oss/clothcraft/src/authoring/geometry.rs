//! Geometry edits are committed by the parent's compile-before-install transaction.
use super::*;
use crate::garment::{seam::Side, shapes};

/// Split a simple cutline with a straight, open pen stroke. Keep the old
/// garment transaction intact until both new panels compile successfully.
pub(super) fn shape_builder_split(
    t: &mut GarmentTemplate, panel: &str, stroke: &[DVec2],
) -> Result<String, String> {
    if stroke.len() != 2 || stroke.iter().any(|p| !p.is_finite())
        || (stroke[1] - stroke[0]).length() < 1e-6 {
        return Err("ShapeBuilder requires two distinct finite Pen points".into());
    }
    let index = t.panels.iter().position(|p| p.id == panel).ok_or("Panel not found")?;
    let resolved_layout = layout(t, index);
    let original = t.panels[index].clone();
    let poly = original.polygon.as_ref().ok_or("ShapeBuilder requires a polygon panel")?;
    if t.seams.iter().any(|s| s.a.panel == panel || s.b.panel == panel)
        || !original.pins.is_empty() || !original.pin_points.is_empty()
        || !poly.holes.is_empty() || !poly.lines.is_empty()
        || !poly.curves.is_empty() || !poly.free_curve_points.is_empty()
        || !poly.target_lengths.is_empty() || !poly.notches.is_empty()
        || !poly.seam_allowances.is_empty() || !poly.annotations.is_empty()
        || !poly.measurements.is_empty() || !poly.vertex_ids.is_empty()
        || !poly.vertex_mirror_groups.is_empty()
    {
        return Err("ShapeBuilder cannot safely remap this panel's sewing, curves or manufacturing metadata".into());
    }
    let n = poly.points.len();
    if n < 3 || poly.edges.len() != n { return Err("Invalid source contour".into()); }
    let direction = stroke[1] - stroke[0];
    let mut hits: Vec<(usize, f64, f64, DVec2)> = vec![];
    for i in 0..n {
        let a = poly.points[i];
        let b = poly.points[(i + 1) % n];
        if !a.is_finite() || !b.is_finite() { return Err("Invalid contour coordinates".into()); }
        let edge = b - a;
        let denom = direction.perp_dot(edge);
        if denom.abs() < 1e-12 { continue; }
        let displacement = a - stroke[0];
        let along_stroke = displacement.perp_dot(edge) / denom;
        let along_edge = displacement.perp_dot(direction) / denom;
        if (-1e-9..=1. + 1e-9).contains(&along_stroke)
            && (1e-7..1. - 1e-7).contains(&along_edge) {
            hits.push((i, along_stroke, along_edge, stroke[0] + direction * along_stroke));
        }
    }
    if hits.len() != 2 || hits[0].0 == hits[1].0
        || (hits[0].3 - hits[1].3).length() < 1e-5 {
        return Err("ShapeBuilder stroke must cross exactly two distinct edges away from vertices".into());
    }
    hits.sort_by_key(|h| h.0);
    let mut built = Vec::with_capacity(2);
    for (start, end) in [(0, 1), (1, 0)] {
        let (first_edge, _, _, first_pos) = hits[start];
        let (last_edge, _, _, last_pos) = hits[end];
        let mut points = vec![first_pos];
        let mut edges = vec![format!("{}_sb_enter", poly.edges[first_edge])];
        let mut i = (first_edge + 1) % n;
        while i != (last_edge + 1) % n {
            points.push(poly.points[i]);
            edges.push(poly.edges[i].clone());
            i = (i + 1) % n;
        }
        points.push(last_pos);
        // The last boundary closes along the newly created physical cut.
        edges.push(format!("shape_builder_cut_{}", start + 1));
        // Source contour is CCW and the cut traversal can only preserve that order.
        if points.len() < 3 || crate::garment::domain::area(&points) < 1e-10 {
            return Err("ShapeBuilder would create a degenerate contour".into());
        }
        let mut candidate = original.clone();
        // Resolve the source's implicit board layout before normalizing the
        // cropped contour; otherwise non-first panels jump to board origin.
        candidate.layout_2d = Some(resolved_layout);
        candidate.polygon.as_mut().unwrap().points = points;
        candidate.polygon.as_mut().unwrap().edges = edges;
        if start == 1 {
            candidate.id = unused_id("panel", t.panels.iter().map(|p| p.id.clone()));
            candidate.name = format!("{} split", original.name);
        }
        normalize(&mut candidate);
        built.push(candidate);
    }
    t.panels[index] = built.remove(0);
    t.panels.push(built.remove(0));
    Ok(panel.into())
}

#[cfg(test)]
mod shape_builder_tests {
    use super::*;
    use crate::garment::presets::{basic, GarmentKind};

    fn rectangle_template() -> GarmentTemplate {
        let mut t = basic(GarmentKind::Tshirt, 0);
        t.panels.truncate(1);
        t.seams.clear();
        let p = &mut t.panels[0];
        p.pins.clear();
        p.pin_points.clear();
        p.polygon = Some(shapes::primitive(
            Primitive::Rectangle, DVec2::new(0.4, 0.6), 180.,
            Default::default(),
        ).unwrap());
        p.pattern.width = 0.4;
        p.pattern.height = 0.6;
        t
    }

    #[test]
    fn open_stroke_creates_two_closed_cut_contours_without_losing_material_area() {
        let mut t = rectangle_template();
        let name = t.panels[0].id.clone();
        let original = crate::garment::domain::area(&t.panels[0].polygon.as_ref().unwrap().points);
        shape_builder_split(&mut t, &name, &[DVec2::new(-0.1, 0.3), DVec2::new(0.5, 0.3)]).unwrap();
        assert_eq!(t.panels.len(), 2);
        let total: f64 = t.panels.iter().map(|p| {
            let poly = p.polygon.as_ref().unwrap();
            assert_eq!(poly.points.len(), poly.edges.len());
            assert!(poly.edges.iter().any(|e| e.starts_with("shape_builder_cut_")));
            crate::garment::domain::area(&poly.points)
        }).sum();
        assert!((original - total).abs() < 1e-10);
    }

    #[test]
    fn annotated_panel_and_uncrossed_stroke_fail_without_mutation() {
        let mut t = rectangle_template();
        let name = t.panels[0].id.clone();
        let before = serde_json::to_string(&t).unwrap();
        assert!(shape_builder_split(&mut t, &name, &[DVec2::ZERO, DVec2::new(0.2, 0.3)]).is_err());
        assert_eq!(before, serde_json::to_string(&t).unwrap());
        t.panels[0].polygon.as_mut().unwrap().annotations.push(PatternAnnotation {
            id: "keep".into(), text: "cut on fold".into(), position: DVec2::ZERO,
        });
        let before = serde_json::to_string(&t).unwrap();
        assert!(shape_builder_split(&mut t, &name, &[DVec2::new(-0.1, 0.3), DVec2::new(0.5, 0.3)]).is_err());
        assert_eq!(before, serde_json::to_string(&t).unwrap());
    }

    #[test]
    fn splitting_nonfirst_panel_preserves_implicit_board_layout() {
        let mut t = rectangle_template();
        let mut second = t.panels[0].clone();
        second.id = "other".into();
        second.name = "other".into();
        second.layout_2d = None;
        t.panels.push(second);
        let original_layout = layout(&t, 1);
        assert!(original_layout.length() > 1e-6);
        shape_builder_split(&mut t, "other", &[
            DVec2::new(-0.1, 0.3), DVec2::new(0.5, 0.3),
        ]).unwrap();
        assert_eq!(t.panels.len(), 3);
        for panel in t.panels.iter().filter(|p| p.id == "other" || p.name == "other split") {
            let origin = panel.layout_2d.expect("split panels must have resolved layout");
            // Both halves begin at their cropped local minimum; converting
            // back to source board coordinates must retain source placement.
            assert!((origin.x - original_layout.x).abs() < 1e-9);
            assert!((origin.y - original_layout.y).abs() < 1e-9 ||
                (origin.y - original_layout.y - 0.3).abs() < 1e-9);
        }
    }
}

pub(super) fn add_polygon(
    t: &mut GarmentTemplate,
    polygon: PolygonPattern,
    origin: DVec2,
    fabric: String,
    replace: bool,
) -> Result<String, String> {
    if !origin.is_finite() {
        return Err("Position 2D invalide".into());
    }
    let id = unused_id("panel", t.panels.iter().map(|p| p.id.clone()));
    let placement = if let Some(p) = t.panels.first().filter(|_| !replace) {
        let delta = origin - layout(t, 0);
        Placement {
            translation: p.placement.translation + DVec3::new(delta.x, -delta.y, 0.12),
            ..Default::default()
        }
    } else {
        Placement {
            translation: DVec3::new(-0.25, 1.5, 0.45),
            ..Default::default()
        }
    };
    if replace {
        t.panels.clear();
        t.seams.clear();
        t.name = "Custom garment".into();
    }
    let mut p = Panel {
        id: id.clone(),
        name: id.clone(),
        pattern: Pattern {
            width: 1.,
            height: 1.,
            nx: 1,
            ny: 1,
        },
        polygon: Some(polygon),
        fabric,
        grain_degrees: 90.,
        placement,
        pins: vec![],
        pin_points: vec![],
        layout_2d: Some(origin),
        layout_rotation_degrees: 0.,
    };
    normalize(&mut p);
    t.panels.push(p);
    t.version = 2;
    Ok(id)
}

pub(super) fn mirror(
    t: &mut GarmentTemplate,
    id: &str,
    axis: MirrorAxis,
    copy_side: Option<i8>,
) -> Result<String, String> {
    if copy_side.is_some_and(|s| s != -1 && s != 1) {
        return Err("Sens de miroir invalide".into());
    }
    let index = t
        .panels
        .iter()
        .position(|p| p.id == id)
        .ok_or("Panneau absent")?;
    let mut p = t.panels[index].clone();
    p.layout_2d = Some(layout(t, index));
    let poly = p
        .polygon
        .as_mut()
        .ok_or("Miroir : panneau polygonal v2 requis")?;
    let reversed: std::collections::BTreeSet<_> = poly
        .edges
        .iter()
        .chain(poly.holes.iter().flat_map(|h| &h.edges))
        .cloned()
        .collect();
    shapes::mirror(poly, axis, DVec2::new(p.pattern.width, p.pattern.height));
    for pin in &mut p.pin_points {
        match axis {
            MirrorAxis::X => pin.x = p.pattern.width - pin.x,
            MirrorAxis::Y => pin.y = p.pattern.height - pin.y,
        }
    }
    p.grain_degrees = match axis {
        MirrorAxis::X => 180. - p.grain_degrees,
        MirrorAxis::Y => -p.grain_degrees,
    }
    .rem_euclid(180.);
    if let Some(side) = copy_side {
        p.id = unused_id("panel", t.panels.iter().map(|p| p.id.clone()));
        p.name = format!("{} miroir", p.name);
        let delta = match axis {
            MirrorAxis::X => DVec2::new(p.pattern.width + 0.05, 0.),
            MirrorAxis::Y => DVec2::new(0., p.pattern.height + 0.05),
        } * side as f64;
        p.layout_2d = Some(layout(t, index) + rotate_2d(delta, p.layout_rotation_degrees));
        p.placement.translation = p.placement.transform(DVec3::new(delta.x, -delta.y, 0.));
        let id = p.id.clone();
        t.panels.push(p);
        Ok(id)
    } else {
        for s in &mut t.seams {
            let mut flip_a = false;
            for (i, r) in [&mut s.a, &mut s.b].into_iter().enumerate() {
                if r.panel == id && r.edge.as_ref().is_some_and(|n| reversed.contains(n)) {
                    r.range = [1. - r.range[1], 1. - r.range[0]];
                    s.reverse_b = !s.reverse_b;
                    flip_a |= i == 0;
                }
            }
            if flip_a {
                for n in &mut s.notches {
                    *n = [1. - n[0], 1. - n[1]];
                }
                s.notches.reverse();
            }
        }
        t.panels[index] = p;
        Ok(id.into())
    }
}

pub(super) fn boolean(
    t: &mut GarmentTemplate,
    a: &str,
    b: &str,
    op: BooleanOp,
    keep_tool: bool,
) -> Result<String, String> {
    if a == b {
        return Err("Choisir deux panneaux distincts".into());
    }
    let ai = t
        .panels
        .iter()
        .position(|p| p.id == a)
        .ok_or("Panneau A absent")?;
    let bi = t
        .panels
        .iter()
        .position(|p| p.id == b)
        .ok_or("Panneau B absent")?;
    for id in [a, b] {
        let p = t.panels.iter().find(|p| p.id == id).unwrap();
        if t.seams.iter().any(|s| s.a.panel == id || s.b.panel == id)
            || !p.pins.is_empty()
            || !p.pin_points.is_empty()
            || p.polygon
                .as_ref()
                .is_some_and(|p| !p.lines.is_empty() || !p.target_lengths.is_empty()
                    || !p.measurements.is_empty())
        {
            return Err("Boolean operands must have no seams, pins, internal lines or target lengths; clear those relations first".into());
        }
    }
    let original = t.panels[ai].clone();
    let ap = original
        .polygon
        .as_ref()
        .ok_or("Panneau A polygonal v2 requis")?;
    let mut bp = t.panels[bi]
        .polygon
        .clone()
        .ok_or("Panneau B polygonal v2 requis")?;
    let into_a = |v: DVec2| {
        rotate_2d(
            layout(t, bi) + rotate_2d(v, t.panels[bi].layout_rotation_degrees) - layout(t, ai),
            -original.layout_rotation_degrees,
        )
    };
    for p in bp.points.iter_mut().chain(bp.curves.values_mut().flatten()) {
        *p = into_a(*p);
    }
    for h in &mut bp.holes {
        for p in &mut h.points {
            *p = into_a(*p);
        }
    }
    let polygons = shapes::boolean(ap, &bp, op)?;
    let origin = layout(t, ai);
    t.panels.retain(|p| p.id != a && (keep_tool || p.id != b));
    for (i, polygon) in polygons.into_iter().enumerate() {
        let mut p = original.clone();
        p.id = if i == 0 {
            a.into()
        } else {
            unused_id("panel", t.panels.iter().map(|p| p.id.clone()))
        };
        p.name = format!("{} · booléen {}", original.name, i + 1);
        p.layout_2d = Some(origin);
        p.polygon = Some(polygon);
        normalize(&mut p);
        t.panels.push(p);
    }
    Ok(a.into())
}

pub(super) fn ruffle(
    t: &mut GarmentTemplate,
    panel: &str,
    line: &str,
    width: f64,
    ratio: f64,
) -> Result<String, String> {
    if !ratio.is_finite()
        || !(1. ..=4.).contains(&ratio)
        || !width.is_finite()
        || !(0.005..=1.).contains(&width)
    {
        return Err("Volant : largeur 5..1000 mm et ratio 1..4".into());
    }
    let index = t
        .panels
        .iter()
        .position(|p| p.id == panel)
        .ok_or("Panneau absent")?;
    let source = t.panels[index].clone();
    let poly = source.polygon.as_ref().ok_or("Panneau v2 requis")?;
    let path = poly
        .lines
        .iter()
        .find(|l| l.id == line)
        .ok_or("Sélectionner une ligne intérieure")?;
    if t.seams.iter().any(|s| {
        [&s.a, &s.b]
            .iter()
            .any(|r| r.panel == panel && r.edge.as_deref() == Some(line))
    }) {
        return Err("Ligne déjà cousue".into());
    }
    let points = path.samples()?;
    let length: f64 = points.windows(2).map(|p| p[0].distance(p[1])).sum();
    let polygon = shapes::primitive(
        Primitive::Rectangle,
        DVec2::new(length * ratio, width),
        180.,
        poly.meshing_settings(),
    )?;
    let origin = layout(t, index)
        + rotate_2d(
            DVec2::new(0., source.pattern.height + 0.08),
            source.layout_rotation_degrees,
        );
    let id = add_polygon(t, polygon, origin, source.fabric.clone(), false)?;
    let strip = t.panels.last_mut().unwrap();
    strip.name = format!("Volant de {}", source.name);
    strip.placement = source.placement.clone();
    strip.placement.translation =
        source
            .placement
            .transform(DVec3::new(points[0].x, -points[0].y, 0.05));
    t.seams.push(SeamSpec {
        id: unused_id("seam", t.seams.iter().map(|s| s.id.clone())),
        a: BoundaryRef {
            panel: panel.into(),
            side: Side::Top,
            edge: Some(line.into()),
            range: [0., 1.],
        },
        b: BoundaryRef {
            panel: id.clone(),
            side: Side::Top,
            edge: Some("edge_1".into()),
            range: [0., 1.],
        },
        reverse_b: false,
        allow_ease: true,
        notches: vec![],
        stiffness: 50_000.,
    });
    Ok(id)
}
