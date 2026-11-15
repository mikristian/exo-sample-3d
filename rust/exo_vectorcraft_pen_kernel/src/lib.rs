//! VectorCraft-derived EXO Pen math, source commit 73f40e3 (MIT OR Apache-2.0).
//! Adaptation of upstream Anchor::set_handle and cubic geometry to EXO metres.
//! Real-time React WASM preview only: a committed garment requires native RPC.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}
impl Point {
    fn finite(self) -> bool {
        self.x.is_finite() && self.y.is_finite()
    }
    fn distance(self, b: Self) -> f64 {
        (self.x - b.x).hypot(self.y - b.y)
    }
}
fn mix(a: Point, b: Point, t: f64) -> Point {
    Point {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
    }
}
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CubicPosition {
    pub p: Point,
    pub left: Point,
    pub right: Point,
}
pub fn pen_tangent(a: Point, b: Point, shift: bool, alt: bool, threshold: f64) -> Option<Point> {
    if !a.finite() || !b.finite() || !threshold.is_finite() || threshold < 0. {
        return None;
    }
    if alt {
        return Some(Point { x: 0., y: 0. });
    }
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let len = dx.hypot(dy);
    if !len.is_finite() {
        return None;
    }
    if len <= threshold {
        return Some(Point { x: 0., y: 0. });
    }
    if !shift {
        return Some(Point { x: dx, y: dy });
    }
    // JS Math.round uses floor(x+0.5), including negative-angle ties.
    let q = std::f64::consts::FRAC_PI_4;
    let angle = (dy.atan2(dx) / q + 0.5).floor() * q;
    let p = Point {
        x: len * angle.cos(),
        y: len * angle.sin(),
    };
    p.finite().then_some(p)
}
pub fn cubic_at(a: Point, b: Point, ta: Point, tb: Point, t: f64) -> Option<CubicPosition> {
    if !a.finite()
        || !b.finite()
        || !ta.finite()
        || !tb.finite()
        || !t.is_finite()
        || !(0.0..=1.0).contains(&t)
    {
        return None;
    }
    let p1 = Point {
        x: a.x + ta.x,
        y: a.y + ta.y,
    };
    let p2 = Point {
        x: b.x - tb.x,
        y: b.y - tb.y,
    };
    let x = mix(a, p1, t);
    let y = mix(p1, p2, t);
    let z = mix(p2, b, t);
    let left = mix(x, y, t);
    let right = mix(y, z, t);
    let p = mix(left, right, t);
    (p.finite() && left.finite() && right.finite()).then_some(CubicPosition { p, left, right })
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AnchorKind {
    Corner,
    Smooth,
}
pub fn anchor_kind(p: Point, h_in: Point, h_out: Point) -> Option<AnchorKind> {
    if !p.finite() || !h_in.finite() || !h_out.finite() {
        return None;
    }
    let (ix, iy) = (h_in.x - p.x, h_in.y - p.y);
    let (ox, oy) = (h_out.x - p.x, h_out.y - p.y);
    let a = ix.hypot(iy);
    let b = ox.hypot(oy);
    if !a.is_finite() || !b.is_finite() {
        return None;
    }
    if a <= 1e-9 || b <= 1e-9 {
        return Some(AnchorKind::Corner);
    }
    let (ix, iy, ox, oy) = (ix / a, iy / a, ox / b, oy / b);
    Some(
        if (ix * oy - iy * ox).abs() <= 1e-6 && ix * ox + iy * oy < 0. {
            AnchorKind::Smooth
        } else {
            AnchorKind::Corner
        },
    )
}
pub fn mirror_opposite(p: Point, other: Point, moved: Point) -> Option<Point> {
    if !p.finite() || !other.finite() || !moved.finite() {
        return None;
    }
    let len = p.distance(other);
    let dir = Point {
        x: p.x - moved.x,
        y: p.y - moved.y,
    };
    let mag = dir.x.hypot(dir.y);
    if !len.is_finite() || !mag.is_finite() {
        return None;
    }
    if mag <= 1e-9 {
        return Some(other);
    }
    let out = Point {
        x: p.x + dir.x * len / mag,
        y: p.y + dir.y * len / mag,
    };
    out.finite().then_some(out)
}
#[unsafe(no_mangle)]
pub extern "C" fn exo_vectorcraft_pen_abi_version() -> u32 {
    1
}
#[unsafe(no_mangle)]
pub extern "C" fn exo_pen_tangent_component(
    sx: f64,
    sy: f64,
    cx: f64,
    cy: f64,
    flags: u32,
    threshold: f64,
    axis: u32,
) -> f64 {
    if axis > 1 || flags > 3 {
        return f64::NAN;
    }
    let p = pen_tangent(
        Point { x: sx, y: sy },
        Point { x: cx, y: cy },
        flags & 1 != 0,
        flags & 2 != 0,
        threshold,
    );
    match (p, axis) {
        (Some(p), 0) => p.x,
        (Some(p), 1) => p.y,
        _ => f64::NAN,
    }
}
#[unsafe(no_mangle)]
pub extern "C" fn exo_pen_cubic_component(
    ax: f64,
    ay: f64,
    bx: f64,
    by: f64,
    tax: f64,
    tay: f64,
    tbx: f64,
    tby: f64,
    t: f64,
    axis: u32,
) -> f64 {
    let c = cubic_at(
        Point { x: ax, y: ay },
        Point { x: bx, y: by },
        Point { x: tax, y: tay },
        Point { x: tbx, y: tby },
        t,
    );
    match (c, axis) {
        (Some(c), 0) => c.p.x,
        (Some(c), 1) => c.p.y,
        (Some(c), 2) => c.left.x,
        (Some(c), 3) => c.left.y,
        (Some(c), 4) => c.right.x,
        (Some(c), 5) => c.right.y,
        _ => f64::NAN,
    }
}
#[unsafe(no_mangle)]
pub extern "C" fn exo_pen_anchor_kind(px: f64, py: f64, ix: f64, iy: f64, ox: f64, oy: f64) -> u32 {
    match anchor_kind(
        Point { x: px, y: py },
        Point { x: ix, y: iy },
        Point { x: ox, y: oy },
    ) {
        Some(AnchorKind::Corner) => 0,
        Some(AnchorKind::Smooth) => 1,
        None => 2,
    }
}
#[unsafe(no_mangle)]
pub extern "C" fn exo_pen_opposing_handle_component(
    px: f64,
    py: f64,
    ox: f64,
    oy: f64,
    mx: f64,
    my: f64,
    axis: u32,
) -> f64 {
    if axis > 1 {
        return f64::NAN;
    }
    match mirror_opposite(
        Point { x: px, y: py },
        Point { x: ox, y: oy },
        Point { x: mx, y: my },
    ) {
        Some(p) => {
            if axis == 0 {
                p.x
            } else {
                p.y
            }
        }
        None => f64::NAN,
    }
}

pub fn closest_cubic_parameter(
    a: Point,
    b: Point,
    ta: Point,
    tb: Point,
    target: Point,
) -> Option<f64> {
    if !a.finite() || !b.finite() || !ta.finite() || !tb.finite() || !target.finite() {
        return None;
    }
    let mut best_t = 0.5;
    let mut best = f64::INFINITY;
    for k in 1..64 {
        let t = k as f64 / 64.0;
        let d = cubic_at(a, b, ta, tb, t)?.p.distance(target);
        if d < best {
            best = d;
            best_t = t
        }
    }
    let mut low = (best_t - 1.0 / 64.0).max(0.001);
    let mut high = (best_t + 1.0 / 64.0).min(0.999);
    for _ in 0..15 {
        let u = (2.0 * low + high) / 3.0;
        let v = (low + 2.0 * high) / 3.0;
        let du = cubic_at(a, b, ta, tb, u)?.p.distance(target);
        let dv = cubic_at(a, b, ta, tb, v)?.p.distance(target);
        if du < dv { high = v } else { low = u }
    }
    Some((low + high) / 2.0)
}
#[unsafe(no_mangle)]
pub extern "C" fn exo_pen_nearest_cubic_parameter(
    ax: f64,
    ay: f64,
    bx: f64,
    by: f64,
    tax: f64,
    tay: f64,
    tbx: f64,
    tby: f64,
    px: f64,
    py: f64,
) -> f64 {
    closest_cubic_parameter(
        Point { x: ax, y: ay },
        Point { x: bx, y: by },
        Point { x: tax, y: tay },
        Point { x: tbx, y: tby },
        Point { x: px, y: py },
    )
    .unwrap_or(f64::NAN)
}
#[cfg(test)]
mod nearest_tests {
    use super::*;
    #[test]
    fn cubic_nearest_tracks_real_curve_and_rejects_non_finite() {
        let a = Point { x: 0., y: 0. };
        let b = Point { x: 0.32, y: 0.06 };
        let ta = Point { x: 0.06, y: 0.09 };
        let tb = Point { x: 0.04, y: -0.06 };
        let mid = cubic_at(a, b, ta, tb, 0.5).unwrap().p;
        let t = closest_cubic_parameter(a, b, ta, tb, mid).unwrap();
        assert!((t - 0.5).abs() < 0.0002, "{t}");
        assert!(
            exo_pen_nearest_cubic_parameter(
                0.,
                0.,
                0.32,
                0.06,
                0.06,
                0.09,
                0.04,
                -0.06,
                0.0,
                f64::NAN
            )
            .is_nan()
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn p(x: f64, y: f64) -> Point {
        Point { x, y }
    }
    fn near(a: f64, b: f64) {
        assert!((a - b).abs() < 1e-12, "{a} vs {b}")
    }
    #[test]
    fn click_drag_alt_threshold() {
        assert_eq!(
            pen_tangent(p(0., 0.), p(0.001, 0.), false, false, 0.002),
            Some(p(0., 0.))
        );
        assert_eq!(
            pen_tangent(p(0., 0.), p(1., 2.), false, false, 0.002),
            Some(p(1., 2.))
        );
        assert_eq!(
            pen_tangent(p(0., 0.), p(1., 2.), false, true, 0.002),
            Some(p(0., 0.))
        );
        assert!(pen_tangent(p(0., 0.), p(f64::NAN, 0.), false, false, 0.002).is_none());
    }
    #[test]
    fn shift_snaps() {
        let a = pen_tangent(p(0., 0.), p(2., 1.), true, false, 0.002).unwrap();
        near(a.x, a.y);
        let b = pen_tangent(p(0., 0.), p(-2., -1.), true, false, 0.002).unwrap();
        near(b.x, b.y);
    }
    #[test]
    fn cubic_matches_vectorcraft() {
        let c = cubic_at(p(0., 0.), p(2., 2.), p(1., 0.), p(0., 1.), 0.5).unwrap();
        near(c.p.x, 1.375);
        near(c.p.y, 0.625);
        assert!(cubic_at(p(0., 0.), p(1., 1.), p(0., 0.), p(0., 0.), f64::NAN).is_none());
    }
    #[test]
    fn mm_scale_corner() {
        assert_eq!(
            anchor_kind(p(0., 0.), p(-0.04, 0.), p(0.08, 0.)),
            Some(AnchorKind::Smooth)
        );
        assert_eq!(
            anchor_kind(p(0., 0.), p(-0.001, 0.), p(0.001, 0.001)),
            Some(AnchorKind::Corner)
        );
        assert_eq!(
            anchor_kind(p(0., 0.), p(-0.001, 0.), p(0.001, 1e-10)),
            Some(AnchorKind::Smooth)
        );
    }
    #[test]
    fn opposing_handle_length() {
        let out = mirror_opposite(p(0., 0.), p(-0.04, 0.), p(0., 0.12)).unwrap();
        near(out.x, 0.);
        near(out.y, -0.04);
        assert_eq!(
            mirror_opposite(p(0., 0.), p(-0.04, 0.), p(0., 0.)),
            Some(p(-0.04, 0.))
        );
    }
    #[test]
    fn abi_rejects_bad_input() {
        assert_eq!(exo_vectorcraft_pen_abi_version(), 1);
        assert_eq!(exo_pen_anchor_kind(0., 0., -0.04, 0., 0.08, 0.), 1);
        assert_eq!(exo_pen_anchor_kind(0., 0., f64::NAN, 0., 0.08, 0.), 2);
        assert_eq!(exo_pen_tangent_component(0., 0., 1., 2., 0, 0.002, 0), 1.);
        assert!(exo_pen_tangent_component(0., 0., 1., 2., 0, 0.002, 2).is_nan());
        assert!(exo_pen_cubic_component(0., 0., 1., 1., 0., 0., 0., 0., 0.5, 6).is_nan());
    }
}
