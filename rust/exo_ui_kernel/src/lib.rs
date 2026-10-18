//! POM measurement annotation anchor in the same SVG coordinate space as endpoints.
//! No rendering, DOM dependency, allocations, or platform-specific code.

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Point { pub x: f64, pub y: f64 }

/// Move from the midpoint along the left-hand unit normal of the measured
/// segment, then apply a screen-coordinate offset. For a horizontal POM line
/// drawn left-to-right, a positive normal offset moves the label upward.
/// Invalid inputs or a degenerate segment return None.
pub fn pom_label_anchor(a: Point, b: Point, normal_offset: f64, dx: f64, dy: f64) -> Option<Point> {
    if ![a.x, a.y, b.x, b.y, normal_offset, dx, dy].iter().all(|n| n.is_finite()) { return None; }
    let vx = b.x - a.x;
    let vy = b.y - a.y;
    let length = vx.hypot(vy);
    if !length.is_finite() || length <= 1e-12 { return None; }
    let x = a.x + vx * 0.5 - (vy / length) * normal_offset + dx;
    let y = a.y + vy * 0.5 + (vx / length) * -normal_offset + dy;
    if x.is_finite() && y.is_finite() { Some(Point { x, y }) } else { None }
}

#[no_mangle]
pub extern "C" fn exo_pom_abi_version() -> u32 { 1 }

#[no_mangle]
pub extern "C" fn exo_pom_label_x(ax:f64, ay:f64, bx:f64, by:f64, normal:f64, dx:f64, dy:f64) -> f64 {
    pom_label_anchor(Point{x:ax,y:ay}, Point{x:bx,y:by},normal,dx,dy).map_or(f64::NAN, |p| p.x)
}

#[no_mangle]
pub extern "C" fn exo_pom_label_y(ax:f64, ay:f64, bx:f64, by:f64, normal:f64, dx:f64, dy:f64) -> f64 {
    pom_label_anchor(Point{x:ax,y:ay}, Point{x:bx,y:by},normal,dx,dy).map_or(f64::NAN, |p| p.y)
}

/// Return the horizontal crossing of an oriented material boundary segment.
/// `NaN` denotes no crossing. Horizontal segments near the line return their
/// minimum endpoint X; callers still consider both endpoints for full spans.
pub fn horizontal_crossing(a:Point,b:Point,y:f64)->Option<f64>{
    if ![a.x,a.y,b.x,b.y,y].iter().all(|n|n.is_finite()){return None;}
    if (a.y-b.y).abs()<1e-6 {
        return if (y-a.y).abs()<0.01 {Some(a.x.min(b.x))} else {None};
    }
    if y<a.y.min(b.y) || y>a.y.max(b.y) {return None;}
    let x=a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y);
    x.is_finite().then_some(x)
}

#[no_mangle]
pub extern "C" fn exo_pom_horizontal_crossing(ax:f64,ay:f64,bx:f64,by:f64,y:f64)->f64{
    horizontal_crossing(Point{x:ax,y:ay},Point{x:bx,y:by},y).unwrap_or(f64::NAN)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn horizontal_crossing_geometry(){
        assert_eq!(horizontal_crossing(p(0.,0.),p(10.,10.),5.),Some(5.));
        assert_eq!(horizontal_crossing(p(0.,10.),p(10.,0.),5.),Some(5.));
        assert_eq!(horizontal_crossing(p(0.,0.),p(10.,0.),0.),Some(0.));
        assert_eq!(horizontal_crossing(p(0.,0.),p(10.,0.),3.),None);
        assert_eq!(horizontal_crossing(p(0.,0.),p(10.,10.),20.),None);
        assert!(exo_pom_horizontal_crossing(0.,0.,10.,10.,20.).is_nan());
    }
    fn p(x:f64,y:f64)->Point {Point{x,y}}
    #[test] fn horizontal_pom() {
        assert_eq!(pom_label_anchor(p(0.,10.),p(20.,10.),2.,3.,-1.),Some(p(13.,7.)));
    }
    #[test] fn vertical_and_reversal() {
        assert_eq!(pom_label_anchor(p(4.,0.),p(4.,10.),2.,0.,0.),Some(p(2.,5.)));
        assert_eq!(pom_label_anchor(p(4.,10.),p(4.,0.),2.,0.,0.),Some(p(6.,5.)));
    }
    #[test] fn translation_invariance() {
        let a=p(2.,4.);let b=p(8.,12.);
        let first=pom_label_anchor(a,b,3.,1.,-2.).unwrap();
        let shifted=pom_label_anchor(p(a.x+100.,a.y-50.),p(b.x+100.,b.y-50.),3.,1.,-2.).unwrap();
        assert!((shifted.x-first.x-100.).abs()<1e-12);
        assert!((shifted.y-first.y+50.).abs()<1e-12);
    }
    #[test] fn reject_invalid_and_degenerate() {
        assert_eq!(pom_label_anchor(p(1.,1.),p(1.,1.),2.,0.,0.),None);
        assert_eq!(pom_label_anchor(p(f64::NAN,1.),p(2.,1.),2.,0.,0.),None);
        assert!(exo_pom_label_x(1.,1.,1.,1.,2.,0.,0.).is_nan());
    }
}
