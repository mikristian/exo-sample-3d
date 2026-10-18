#[no_mangle]
pub extern "C" fn exo_grading_abi_version() -> u32 { 1 }

/// One component of the existing point grader. Bounds and designer overrides
/// are resolved by the JS document layer, which retains all point metadata.
fn grade_component(x: f64, y: f64, min_x: f64, max_x: f64,
                   min_y: f64, max_y: f64, offset: f64,
                   width: f64, length: f64, horizontal: bool) -> f64 {
    let center = (min_x + max_x) * 0.5;
    let height = (max_y - min_y).max(1.0);
    let normalized_y = (y - min_y) / height;
    if horizontal {
        x + (if x == center { 0.0 } else { (x - center).signum() }) * (width * offset) * 0.5
            * (0.55 + 0.45 * (1.0 - normalized_y))
    } else {
        y - (length * offset) * (1.0 - normalized_y)
    }
}

#[no_mangle]
pub extern "C" fn exo_grade_point_x(x:f64,y:f64,min_x:f64,max_x:f64,min_y:f64,max_y:f64,offset:f64,width:f64,length:f64)->f64 {
    grade_component(x,y,min_x,max_x,min_y,max_y,offset,width,length,true)
}
#[no_mangle]
pub extern "C" fn exo_grade_point_y(x:f64,y:f64,min_x:f64,max_x:f64,min_y:f64,max_y:f64,offset:f64,width:f64,length:f64)->f64 {
    grade_component(x,y,min_x,max_x,min_y,max_y,offset,width,length,false)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn vertical_and_designer_neutral() {
        assert_eq!(exo_grade_point_x(0.,0.,-10.,10.,0.,20.,2.,3.,1.2),0.);
        assert!((exo_grade_point_y(4.,0.,-10.,10.,0.,20.,2.,3.,1.2)+2.4).abs()<1e-12);
        assert!((exo_grade_point_y(4.,20.,-10.,10.,0.,20.,2.,3.,1.2)-20.).abs()<1e-12);
    }
}
