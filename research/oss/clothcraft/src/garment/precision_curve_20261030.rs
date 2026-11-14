//! Independent, read-only physical curve length bounds for 2D pattern QA.
//!
//! The native mesher intentionally measures a polyline approximation. This
//! module reports a second, tighter geometric measurement without changing
//! sewing, notches, printed cutlines, or the user's saved pattern coordinates.
//! It uses standard cubic subdivision and the elementary chord/control-polygon
//! length bounds; it is not a port of Valentina's GPL implementation.
use glam::DVec2;
use super::polygon::PolygonPattern;

/// Every real cubic arc length is inside [lower_m, upper_m].
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct LengthBounds {
    pub lower_m: f64,
    pub upper_m: f64,
}

impl LengthBounds {
    pub fn estimate_m(self) -> f64 { (self.lower_m + self.upper_m) * 0.5 }
    pub fn max_error_m(self) -> f64 { (self.upper_m - self.lower_m) * 0.5 }
}

fn halve(p: [DVec2; 4]) -> ([DVec2; 4], [DVec2; 4]) {
    let p01 = p[0].lerp(p[1], 0.5);
    let p12 = p[1].lerp(p[2], 0.5);
    let p23 = p[2].lerp(p[3], 0.5);
    let p012 = p01.lerp(p12, 0.5);
    let p123 = p12.lerp(p23, 0.5);
    let middle = p012.lerp(p123, 0.5);
    ([p[0], p01, p012, middle], [middle, p123, p23, p[3]])
}

/// Bound a cubic to a caller-specified *total* uncertainty in metres.
/// Degenerate, high-curvature and reversing cubics are supported, but exceeding
/// the finite subdivision budget is an error, never an invented exact length.
pub fn cubic_length_bounds(p: [DVec2; 4], tolerance_m: f64) -> Result<LengthBounds, String> {
    if p.iter().any(|point| !point.is_finite()) ||
        !tolerance_m.is_finite() || !(1e-9..=0.01).contains(&tolerance_m) {
        return Err("Invalid cubic or requested curve-length tolerance".into());
    }
    let mut stack = vec![(p, 0u8)];
    let mut lower = 0.0;
    let mut upper = 0.0;
    let mut divisions = 0usize;
    while let Some((segment, depth)) = stack.pop() {
        let chord = segment[0].distance(segment[3]);
        let polygon = segment.windows(2).map(|w| w[0].distance(w[1])).sum::<f64>();
        if !chord.is_finite() || !polygon.is_finite() || polygon + 1e-12 < chord {
            return Err("Unbounded cubic control polygon length".into());
        }
        // Divide the whole-curve error budget by each subdivision's parameter
        // interval. Every accepted leaf contributes at most its proportional
        // share, so the SUM of gaps cannot exceed the caller's tolerance.
        if polygon - chord <= tolerance_m / 2f64.powi(depth as i32) {
            lower += chord;
            upper += polygon;
            continue;
        }
        if depth == 20 || divisions >= 32768 {
            return Err("Cubic length precision subdivision budget exceeded".into());
        }
        divisions += 1;
        let (left, right) = halve(segment);
        stack.push((right, depth + 1));
        stack.push((left, depth + 1));
    }
    if !lower.is_finite() || !upper.is_finite() || upper + 1e-12 < lower {
        return Err("Nonfinite total cubic curve length".into());
    }
    Ok(LengthBounds { lower_m: lower, upper_m: upper })
}

/// Measure the exact authored Bézier spans of a named native pattern edge.
/// `tolerance_m` bounds the *entire edge's* upper/lower difference, including
/// any free-curve knots; the polygon itself is never mutated or re-meshed.
pub fn edge_length_bounds(
    polygon: &PolygonPattern, edge: &str, tolerance_m: f64,
) -> Result<LengthBounds, String> {
    if !tolerance_m.is_finite() || !(1e-9..=0.01).contains(&tolerance_m) {
        return Err("Invalid pattern-edge precision tolerance".into());
    }
    let index = polygon.edges.iter().position(|name| name == edge)
        .ok_or("Unknown native pattern edge")?;
    let spans = polygon.edge_cubic_spans(index)?;
    if spans.is_empty() || spans.len() > 256 {
        return Err("Invalid native curve span count".into());
    }
    let share = tolerance_m / spans.len() as f64;
    let mut bounds = LengthBounds { lower_m: 0., upper_m: 0. };
    for (_, cubic) in spans {
        let part = cubic_length_bounds(cubic, share)?;
        bounds.lower_m += part.lower_m;
        bounds.upper_m += part.upper_m;
    }
    if !bounds.lower_m.is_finite() || !bounds.upper_m.is_finite() ||
        bounds.upper_m - bounds.lower_m > tolerance_m + 1e-10 {
        return Err("Native pattern-edge length error exceeds requested tolerance".into());
    }
    Ok(bounds)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::garment::shapes;
    use crate::garment::shapes::Primitive;

    const TOL: f64 = 1e-5; // 0.01 millimetre total bound

    #[test]
    fn straight_and_reversing_cubics_have_truthful_length_bounds() {
        let line = [DVec2::ZERO, DVec2::new(0.1, 0.),
            DVec2::new(0.2, 0.), DVec2::new(0.3, 0.)];
        let bounds = cubic_length_bounds(line, TOL).unwrap();
        assert!((bounds.estimate_m() - 0.3).abs() < 1e-12);
        assert!(bounds.max_error_m() <= TOL * 0.5);
        let backtrack = [DVec2::ZERO, DVec2::new(0.1, 0.),
            DVec2::new(-0.1, 0.), DVec2::ZERO];
        let bounds = cubic_length_bounds(backtrack, TOL).unwrap();
        assert!(bounds.lower_m > 0.1);
        assert!(bounds.upper_m - bounds.lower_m <= TOL + 1e-12);
    }

    #[test]
    fn quarter_circle_bodice_curve_matches_independent_analytic_arc_length() {
        let k = 0.5522847498307936;
        let radius = 0.1;
        let curve = [DVec2::new(radius, 0.), DVec2::new(radius, k * radius),
            DVec2::new(k * radius, radius), DVec2::new(0., radius)];
        let bounds = cubic_length_bounds(curve, TOL).unwrap();
        let exact_circle = std::f64::consts::FRAC_PI_2 * radius;
        // Circular cubic approximation is not mathematically a perfect circle.
        assert!((bounds.estimate_m() - exact_circle).abs() < 3e-5);
        assert!(bounds.upper_m - bounds.lower_m <= TOL + 1e-12);
    }

    #[test]
    fn named_edge_precision_covers_actual_polygon_without_mutating_geometry() {
        let mut polygon = shapes::primitive(Primitive::Rectangle, DVec2::new(0.3, 0.4),
            180., Default::default()).unwrap();
        let edge = polygon.edges[0].clone();
        let a = polygon.points[0];
        let b = polygon.points[1];
        polygon.curves.insert(edge.clone(), [a + DVec2::new(0.05, -0.08),
            b + DVec2::new(-0.05, -0.08)]);
        let original = serde_json::to_string(&polygon).unwrap();
        let measured = edge_length_bounds(&polygon, &edge, TOL).unwrap();
        let sampled = polygon.edge_points(0).unwrap();
        let polyline = sampled.windows(2).map(|p| p[0].distance(p[1])).sum::<f64>();
        assert!(measured.estimate_m() > a.distance(b));
        assert!(measured.estimate_m() + TOL > polyline);
        assert!(measured.max_error_m() <= TOL * 0.5 + 1e-12);
        assert_eq!(serde_json::to_string(&polygon).unwrap(), original);
        assert!(edge_length_bounds(&polygon, "missing-edge", TOL).is_err());
    }

    #[test]
    fn broken_inputs_refuse_precision_claims() {
        let line = [DVec2::ZERO; 4];
        assert!(cubic_length_bounds(line, 0.).is_err());
        assert!(cubic_length_bounds(line, f64::NAN).is_err());
        let mut invalid = line;
        invalid[1].x = f64::INFINITY;
        assert!(cubic_length_bounds(invalid, TOL).is_err());
    }
}
