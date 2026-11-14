//! Native 3D placement preview. Draws the *actual compiled ClothCraft mesh*
//! without browser/JavaScript state. It is deliberately NOT a cloth solver:
//! coordinates are from CompiledGarment::initial_state.
use eframe::egui::{self, Align2, Color32, FontId, Pos2, Stroke, Vec2};
use exo_clothcraft_v3::Document;
use glam::DVec3;

struct ScreenTriangle {
    screen: [Pos2; 3],
    depth: f64,
    panel_id: String,
    color: Color32,
    selected: bool,
}

fn shade(normal: DVec3, selected: bool, front: bool) -> Color32 {
    let light = DVec3::new(0.45, 0.8, 0.3).normalize();
    let amount = (0.38 + normal.dot(light).abs() * 0.53).clamp(0.0, 1.0);
    let base = if selected {
        [82., 177., 220.]
    } else if front {
        [110., 126., 148.]
    } else {
        [77., 94., 119.]
    };
    Color32::from_rgb(
        (base[0] * amount) as u8,
        (base[1] * amount) as u8,
        (base[2] * amount) as u8,
    )
}

fn within_triangle(p: Pos2, a: Pos2, b: Pos2, c: Pos2) -> bool {
    let cross = |u: Pos2, v: Pos2, w: Pos2| (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
    let d1 = cross(a, b, p);
    let d2 = cross(b, c, p);
    let d3 = cross(c, a, p);
    let has_negative = d1 < -0.01 || d2 < -0.01 || d3 < -0.01;
    let has_positive = d1 > 0.01 || d2 > 0.01 || d3 > 0.01;
    !(has_negative && has_positive)
}

/// Return an optionally clicked panel. Selection is UI-only, never a new
/// garment document. Rotate the preview with the mouse; all mesh vertices,
/// triangles and panel ranges come from the same current Rust revision.
pub fn show(
    ui: &mut egui::Ui,
    document: &Document,
    selected: Option<&str>,
    yaw: &mut f64,
    pitch: &mut f64,
    zoom: f64,
) -> Option<String> {
    ui.heading("3D garment · Rust mesh");
    ui.small("Rest/placement preview · drag to orbit · no cloth simulation");
    let available = ui.available_size();
    let (area, response) = ui.allocate_exact_size(
        Vec2::new(available.x.max(95.), available.y.max(90.)),
        egui::Sense::click_and_drag(),
    );
    let painter = ui.painter_at(area);
    painter.rect_filled(area, 0., Color32::from_rgb(16, 21, 29));
    if response.dragged() {
        let delta = response.drag_delta();
        *yaw += delta.x as f64 * 0.009;
        *pitch = (*pitch - delta.y as f64 * 0.009).clamp(-1.35, 1.35);
    }

    let garment = &document.compiled;
    let positions = &garment.initial_state.x;
    if positions.is_empty() {
        painter.text(
            area.center(),
            Align2::CENTER_CENTER,
            "No Rust mesh available",
            FontId::proportional(13.),
            Color32::GRAY,
        );
        return None;
    }
    let min = positions
        .iter()
        .copied()
        .fold(DVec3::splat(f64::INFINITY), |a, b| a.min(b));
    let max = positions
        .iter()
        .copied()
        .fold(DVec3::splat(f64::NEG_INFINITY), |a, b| a.max(b));
    let center = (min + max) * 0.5;
    let spread = (max - min).length().max(0.2);
    let view_scale = (area.width().min(area.height()) as f64 - 45.).max(20.) * zoom / spread;
    let (sy, cy) = yaw.sin_cos();
    let (sp, cp) = pitch.sin_cos();
    let to_view = |p: DVec3| -> (Pos2, f64) {
        let d = p - center;
        let x = cy * d.x + sy * d.z;
        let z = -sy * d.x + cy * d.z;
        let y = cp * d.y - sp * z;
        let depth = sp * d.y + cp * z;
        let position = area.center() + Vec2::new((x * view_scale) as f32, (-y * view_scale) as f32);
        (position, depth)
    };
    let vertices: Vec<_> = positions.iter().copied().map(to_view).collect();
    let mut triangles = Vec::<ScreenTriangle>::new();
    for (panel_index, panel) in garment.panels.iter().enumerate() {
        let selected_panel = selected == Some(panel.id.as_str());
        for triangle in &garment.mesh.triangles[panel.triangles.clone()] {
            let [a, b, c] = triangle.vertices;
            if [a, b, c].iter().any(|index| *index >= vertices.len()) {
                continue;
            }
            let points = [vertices[a].0, vertices[b].0, vertices[c].0];
            let normal = (positions[b] - positions[a])
                .cross(positions[c] - positions[a])
                .normalize_or_zero();
            triangles.push(ScreenTriangle {
                screen: points,
                depth: (vertices[a].1 + vertices[b].1 + vertices[c].1) / 3.,
                panel_id: panel.id.clone(),
                selected: selected_panel,
                color: shade(normal, selected_panel, panel_index % 2 == 0),
            });
        }
    }
    // Orthographic painter's-order preview. This intentionally does not claim
    // certified hidden-surface rendering or physically settled drape.
    triangles.sort_by(|a, b| a.depth.total_cmp(&b.depth));
    for triangle in &triangles {
        painter.add(egui::Shape::convex_polygon(
            triangle.screen.to_vec(),
            triangle.color,
            Stroke::new(
                if triangle.selected { 0.55 } else { 0.25 },
                if triangle.selected {
                    Color32::from_rgb(116, 215, 249)
                } else {
                    Color32::from_gray(95)
                },
            ),
        ));
    }
    painter.text(
        area.left_top() + Vec2::new(14., 12.),
        Align2::LEFT_TOP,
        format!(
            "NATIVE 3D · {} vertices / {} triangles · revision {}",
            positions.len(),
            garment.mesh.triangles.len(),
            document.revision
        ),
        FontId::monospace(10.),
        Color32::from_gray(190),
    );
    if response.clicked()
        && let Some(click) = response.interact_pointer_pos()
    {
        // Nearest visible triangle is last after depth-sort.
        return triangles.into_iter().rev().find_map(|triangle| {
            within_triangle(
                click,
                triangle.screen[0],
                triangle.screen[1],
                triangle.screen[2],
            )
            .then_some(triangle.panel_id)
        });
    }
    None
}
