//! The first EXO V3 desktop surface: native egui, with ClothCraft Rust as the
//! *only* editable garment model. No JavaScript, HTTP bridge or duplicate DOM.
mod viewport;

use eframe::egui::{self, Align2, Color32, FontId, Pos2, Rect, Stroke, Vec2};
use exo_clothcraft_v3::{Document, panel_anchors, panel_contour};
use glam::DVec2;
use marvelous_cloth::{authoring::Command, garment::presets::GarmentKind};
use std::path::PathBuf;

fn default_file() -> String {
    std::env::var("HOME")
        .map(|home| format!("{home}/Documents/EXO ClothCraft V3/untitled.json"))
        .unwrap_or_else(|_| "untitled.json".into())
}

fn in_polygon(point: Pos2, polygon: &[Pos2]) -> bool {
    if polygon.len() < 3 {
        return false;
    }
    let mut inside = false;
    for i in 0..polygon.len() {
        let a = polygon[i];
        let b = polygon[(i + 1) % polygon.len()];
        if (a.y > point.y) != (b.y > point.y) {
            let intersection = a.x + (point.y - a.y) * (b.x - a.x) / (b.y - a.y);
            if point.x < intersection {
                inside = !inside;
            }
        }
    }
    inside
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum ViewMode {
    Split,
    TwoD,
    ThreeD,
}

struct V3App {
    document: Document,
    selected: Option<String>,
    anchor: usize,
    anchor_x_mm: f64,
    anchor_y_mm: f64,
    width_mm: f64,
    height_mm: f64,
    path: String,
    status: String,
    replace_confirmed: bool,
    view_mode: ViewMode,
    orbit_yaw: f64,
    orbit_pitch: f64,
    orbit_zoom: f64,
    sew_a_panel: String,
    sew_a_edge: String,
    sew_b_panel: String,
    sew_b_edge: String,
    sew_reverse: bool,
}

impl Default for V3App {
    fn default() -> Self {
        let document = Document::new(GarmentKind::Tshirt).expect("built-in Rust T-shirt template");
        let selected = document.template.panels.first().map(|p| p.id.clone());
        let mut app = Self {
            document,
            selected,
            anchor: 0,
            anchor_x_mm: 0.,
            anchor_y_mm: 0.,
            width_mm: 300.,
            height_mm: 400.,
            path: default_file(),
            status: "V3 native Rust garment document ready · prototype, not factory-certified"
                .into(),
            replace_confirmed: false,
            view_mode: ViewMode::Split,
            orbit_yaw: 0.3,
            orbit_pitch: -0.08,
            orbit_zoom: 1.,
            sew_a_panel: "front".into(),
            sew_a_edge: "hem".into(),
            sew_b_panel: "back".into(),
            sew_b_edge: "hem".into(),
            sew_reverse: false,
        };
        app.sync_anchor();
        app
    }
}

impl V3App {
    fn selected_panel(&self) -> Option<&marvelous_cloth::garment::template::Panel> {
        self.document
            .template
            .panels
            .iter()
            .find(|panel| Some(&panel.id) == self.selected.as_ref())
    }

    fn sync_anchor(&mut self) {
        if let Some(point) = self
            .selected_panel()
            .and_then(|p| panel_anchors(p).get(self.anchor).copied())
        {
            self.anchor_x_mm = point.x * 1000.;
            self.anchor_y_mm = point.y * 1000.;
        }
    }

    fn choose(&mut self, panel: String) {
        self.selected = Some(panel);
        self.anchor = 0;
        self.sync_anchor();
    }

    fn sync_sewing_selection(&mut self) {
        let options: Vec<_> = self
            .document
            .template
            .panels
            .iter()
            .filter_map(|p| {
                p.polygon
                    .as_ref()
                    .map(|poly| (p.id.clone(), poly.edges.clone()))
            })
            .filter(|(_, edges)| !edges.is_empty())
            .collect();
        if options.is_empty() {
            return;
        }
        for (panel, edge, fallback) in [
            (&mut self.sew_a_panel, &mut self.sew_a_edge, 0),
            (
                &mut self.sew_b_panel,
                &mut self.sew_b_edge,
                options.len().saturating_sub(1),
            ),
        ] {
            if let Some((_, edges)) = options.iter().find(|(id, _)| id == panel) {
                if !edges.contains(edge) {
                    *edge = edges[0].clone();
                }
            } else {
                *panel = options[fallback].0.clone();
                *edge = options[fallback].1[0].clone();
            }
        }
    }

    fn change(
        &mut self,
        operation: impl FnOnce(&mut Document) -> Result<Option<String>, String>,
        label: &str,
    ) {
        match operation(&mut self.document) {
            Ok(selected) => {
                if let Some(panel) = selected {
                    self.choose(panel);
                }
                self.status = format!("{label} · Rust revision {}", self.document.revision);
                self.replace_confirmed = false;
                self.sync_sewing_selection();
            }
            Err(error) => self.status = format!("{label} refused; document unchanged: {error}"),
        }
    }

    fn replace(&mut self, incoming: Result<Document, String>, label: &str) {
        if self.document.dirty && !self.replace_confirmed {
            self.status = "Unsaved edits: check 'Allow replacing unsaved document' before opening a different garment".into();
            return;
        }
        match incoming {
            Ok(document) => {
                self.document = document;
                self.selected = self.document.template.panels.first().map(|p| p.id.clone());
                self.anchor = 0;
                self.sync_anchor();
                self.replace_confirmed = false;
                self.sync_sewing_selection();
                self.status = format!("{label} · Rust document validated");
            }
            Err(error) => {
                self.status = format!("{label} refused; current garment preserved: {error}")
            }
        }
    }

    fn file_bar(&mut self, ui: &mut egui::Ui) {
        ui.horizontal_wrapped(|ui| {
            ui.heading("EXO / CLOTHCRAFT");
            ui.strong("V3");
            ui.separator();
            ui.label("NATIVE RUST STUDIO");
            ui.separator();
            if ui.button("New T-shirt").clicked() {
                self.replace(Document::new(GarmentKind::Tshirt), "New T-shirt");
            }
            if ui.button("New dress").clicked() {
                self.replace(Document::new(GarmentKind::Dress), "New dress");
            }
            ui.separator();
            if ui
                .add_enabled(self.document.history.can_undo(), egui::Button::new("Undo"))
                .clicked()
            {
                self.history(false);
            }
            if ui
                .add_enabled(self.document.history.can_redo(), egui::Button::new("Redo"))
                .clicked()
            {
                self.history(true);
            }
            if ui.button("Save native JSON").clicked() {
                match self.document.save(&PathBuf::from(&self.path)) {
                    Ok(()) => {
                        self.status = format!("Saved native ClothCraft template: {}", self.path)
                    }
                    Err(error) => {
                        self.status = format!("Save failed; unsaved garment retained: {error}")
                    }
                }
            }
            if ui.button("Open native JSON").clicked() {
                if self.document.dirty && !self.replace_confirmed {
                    self.status =
                        "Confirm replacing unsaved work before opening another file".into();
                } else {
                    self.replace(Document::load(&PathBuf::from(&self.path)), "Open file");
                }
            }
        });
        ui.horizontal(|ui| {
            ui.label("Project path");
            ui.add(egui::TextEdit::singleline(&mut self.path).desired_width(500.));
            ui.checkbox(
                &mut self.replace_confirmed,
                "Allow replacing unsaved document",
            );
            if self.document.dirty {
                ui.colored_label(Color32::YELLOW, "Unsaved changes");
            }
        });
        ui.horizontal(|ui| {
            ui.label("Views:");
            ui.selectable_value(&mut self.view_mode, ViewMode::Split, "2D + 3D");
            ui.selectable_value(&mut self.view_mode, ViewMode::TwoD, "2D only");
            ui.selectable_value(&mut self.view_mode, ViewMode::ThreeD, "3D only");
            ui.separator();
            ui.label("3D zoom");
            ui.add(egui::Slider::new(&mut self.orbit_zoom, 0.35..=2.5).show_value(false));
        });
    }

    fn history(&mut self, redo: bool) {
        let label = if redo { "Redo" } else { "Undo" };
        match self.document.restore(redo) {
            Ok(()) => {
                if self.selected_panel().is_none() {
                    self.selected = self.document.template.panels.first().map(|p| p.id.clone());
                }
                self.anchor = 0;
                self.sync_anchor();
                self.sync_sewing_selection();
                self.status = format!(
                    "{label} completed in Rust · revision {}",
                    self.document.revision
                );
            }
            Err(error) => self.status = format!("{label} refused: {error}"),
        }
    }

    fn toolbar(&mut self, ui: &mut egui::Ui) {
        ui.heading("Pattern tools");
        ui.label("Working native Rust actions");
        ui.separator();
        ui.horizontal(|ui| {
            ui.label("Width (mm)");
            ui.add(
                egui::DragValue::new(&mut self.width_mm)
                    .speed(1.)
                    .range(5. ..=10_000.),
            );
        });
        ui.horizontal(|ui| {
            ui.label("Height (mm)");
            ui.add(
                egui::DragValue::new(&mut self.height_mm)
                    .speed(1.)
                    .range(5. ..=10_000.),
            );
        });
        if ui.button("+ Add rectangle panel").clicked() {
            let (width, height) = (self.width_mm, self.height_mm);
            self.change(|d| d.add_rectangle(width, height), "Add rectangle");
        }
        let selected = self.selected.clone();
        let enabled = selected.is_some();
        if ui
            .add_enabled(enabled, egui::Button::new("Duplicate selected panel"))
            .clicked()
        {
            let id = selected.unwrap();
            self.change(
                |d| d.apply(Command::Duplicate { panel: id }),
                "Duplicate panel",
            );
        }
        let selected = self.selected.clone();
        let can_remove = self.document.template.panels.len() > 1 && selected.is_some();
        if ui
            .add_enabled(can_remove, egui::Button::new("Remove selected panel"))
            .clicked()
        {
            let id = selected.unwrap();
            self.change(
                |d| d.apply(Command::RemovePanel { panel: id }),
                "Remove panel",
            );
            if self.selected_panel().is_none() {
                self.selected = self.document.template.panels.first().map(|p| p.id.clone());
            }
        }
        ui.separator();
        egui::CollapsingHeader::new("Sewing · real Rust seams")
            .default_open(true)
            .show(ui, |ui| self.sewing_tools(ui));
        ui.separator();
        ui.strong("Not yet migrated to V3");
        for label in [
            "Advanced grading",
            "3D simulation viewport",
            "Marker nesting",
            "Factory-approved cutlines",
        ] {
            ui.add_enabled(
                false,
                egui::Button::new(label).min_size(Vec2::new(180., 26.)),
            )
            .on_disabled_hover_text("Planned: requires shared Rust command integration and QA");
        }
        ui.label("Disabled tools are roadmap items, not simulated operations.");
    }

    fn sewing_tools(&mut self, ui: &mut egui::Ui) {
        self.sync_sewing_selection();
        let options: Vec<(String, Vec<String>)> = self
            .document
            .template
            .panels
            .iter()
            .filter_map(|panel| {
                panel
                    .polygon
                    .as_ref()
                    .map(|polygon| (panel.id.clone(), polygon.edges.clone()))
            })
            .collect();
        for (label, panel, edge) in [
            ("A", &mut self.sew_a_panel, &mut self.sew_a_edge),
            ("B", &mut self.sew_b_panel, &mut self.sew_b_edge),
        ] {
            ui.strong(format!("Boundary {label}"));
            egui::ComboBox::from_id_salt(format!("sew-panel-{label}"))
                .selected_text(panel.as_str())
                .width(190.)
                .show_ui(ui, |ui| {
                    for (id, _) in &options {
                        ui.selectable_value(panel, id.clone(), id);
                    }
                });
            if let Some((_, edges)) = options.iter().find(|(id, _)| id == panel) {
                if !edges.contains(edge) && !edges.is_empty() {
                    *edge = edges[0].clone();
                }
                egui::ComboBox::from_id_salt(format!("sew-edge-{label}"))
                    .selected_text(edge.as_str())
                    .width(190.)
                    .show_ui(ui, |ui| {
                        for id in edges {
                            ui.selectable_value(edge, id.clone(), id);
                        }
                    });
            }
        }
        ui.checkbox(&mut self.sew_reverse, "Reverse B stitch direction");
        ui.small("Full edges, equal rest lengths. Rust rejects overlaps and invalid sewing.");
        let enabled = !self.sew_a_panel.is_empty()
            && !self.sew_b_panel.is_empty()
            && self.sew_a_panel != self.sew_b_panel;
        if ui
            .add_enabled(enabled, egui::Button::new("+ Sew selected edges"))
            .clicked()
        {
            let a = (self.sew_a_panel.clone(), self.sew_a_edge.clone());
            let b = (self.sew_b_panel.clone(), self.sew_b_edge.clone());
            let reverse = self.sew_reverse;
            self.change(
                |document| {
                    document
                        .sew_named_edges(&a.0, &a.1, &b.0, &b.1, reverse)
                        .map(|()| None)
                },
                "Create native seam",
            );
        }
    }

    fn inspector(&mut self, ui: &mut egui::Ui) {
        ui.heading("Native garment document");
        ui.label(format!(
            "{} panels · {} seams",
            self.document.template.panels.len(),
            self.document.template.seams.len()
        ));
        ui.label(format!("Rust revision: {}", self.document.revision));
        ui.separator();
        ui.strong("Pattern pieces");
        let panels: Vec<_> = self
            .document
            .template
            .panels
            .iter()
            .map(|p| (p.id.clone(), p.name.clone()))
            .collect();
        for (id, name) in panels {
            if ui
                .selectable_label(
                    self.selected.as_ref() == Some(&id),
                    format!("{name} ({id})"),
                )
                .clicked()
            {
                self.choose(id);
            }
        }
        ui.separator();
        if let Some(panel) = self.selected_panel() {
            let id = panel.id.clone();
            let points = panel_anchors(panel);
            let editable = panel.polygon.is_some();
            ui.strong(format!("Edit material points · {}", id));
            if !editable {
                ui.label("This panel uses a legacy rectangle; anchors are not editable here.");
            } else {
                egui::ComboBox::from_label("Anchor")
                    .selected_text(format!("Point {}", self.anchor + 1))
                    .show_ui(ui, |ui| {
                        for index in 0..points.len() {
                            if ui
                                .selectable_value(
                                    &mut self.anchor,
                                    index,
                                    format!("Point {}", index + 1),
                                )
                                .changed()
                            {
                                let point = points[index];
                                self.anchor_x_mm = point.x * 1000.;
                                self.anchor_y_mm = point.y * 1000.;
                            }
                        }
                    });
                ui.horizontal(|ui| {
                    ui.label("X mm");
                    ui.add(egui::DragValue::new(&mut self.anchor_x_mm).speed(0.5));
                    ui.label("Y mm");
                    ui.add(egui::DragValue::new(&mut self.anchor_y_mm).speed(0.5));
                });
                if ui.button("Apply point edit in Rust").clicked() {
                    let (index, x, y) = (self.anchor, self.anchor_x_mm, self.anchor_y_mm);
                    self.change(|d| d.move_anchor(&id, index, x, y), "Move point");
                }
            }
        }
        ui.separator();
        ui.strong("Native sewing graph");
        ui.small("Each seam is stored in the same Rust garment and compiled mesh.");
        let seams: Vec<_> = self
            .document
            .template
            .seams
            .iter()
            .map(|seam| {
                (
                    seam.id.clone(),
                    seam.a.panel.clone(),
                    seam.a.edge.clone(),
                    seam.b.panel.clone(),
                    seam.b.edge.clone(),
                )
            })
            .collect();
        egui::ScrollArea::vertical()
            .id_salt("native-seams")
            .max_height(220.)
            .show(ui, |ui| {
                for (id, a, ae, b, be) in seams {
                    ui.horizontal_wrapped(|ui| {
                        ui.small(format!(
                            "{a}/{} → {b}/{}",
                            ae.as_deref().unwrap_or("side"),
                            be.as_deref().unwrap_or("side"),
                        ));
                        if ui.small_button("Remove").clicked() {
                            self.change(
                                |document| document.remove_seam(&id).map(|()| None),
                                "Remove native seam",
                            );
                        }
                    });
                }
            });
        ui.separator();
        ui.label("Units: screen / mm · Rust / metres");
        ui.label("Compiled geometry is validated before committing every operation.");
        ui.label("History: current session only; reopen starts new history.");
    }

    fn board(&mut self, ui: &mut egui::Ui) {
        ui.heading("2D pattern workspace");
        ui.label("Native material contours · orange = sewn boundaries · click a piece to select");
        let available = ui.available_size();
        let (area, response) = ui.allocate_exact_size(
            Vec2::new(available.x.max(100.), available.y.max(100.)),
            egui::Sense::click(),
        );
        let painter = ui.painter_at(area);
        painter.rect_filled(area, 0., Color32::from_rgb(17, 22, 29));

        let mut shapes = Vec::new();
        let mut min = DVec2::splat(f64::INFINITY);
        let mut max = DVec2::splat(f64::NEG_INFINITY);
        for (index, panel) in self.document.template.panels.iter().enumerate() {
            let origin = panel
                .layout_2d
                .unwrap_or(DVec2::new(index as f64 * 1.16, 0.));
            let points: Vec<_> = panel_contour(panel)
                .into_iter()
                .map(|point| point + origin)
                .collect();
            for point in &points {
                min = min.min(*point);
                max = max.max(*point);
            }
            shapes.push((panel.id.clone(), panel.name.clone(), points));
        }
        if shapes.is_empty() || !min.is_finite() || !max.is_finite() {
            return;
        }
        let padding = 50.;
        let width = (max.x - min.x).max(0.1);
        let height = (max.y - min.y).max(0.1);
        let scale = ((area.width() - padding * 2.).max(10.) as f64 / width)
            .min((area.height() - padding * 2.).max(10.) as f64 / height);
        let point_to_screen = |p: DVec2| -> Pos2 {
            Pos2::new(
                (area.left() as f64 + padding as f64 + (p.x - min.x) * scale) as f32,
                (area.top() as f64 + padding as f64 + (p.y - min.y) * scale) as f32,
            )
        };
        let click = if response.clicked() {
            response.interact_pointer_pos()
        } else {
            None
        };
        let mut clicked_panel = None;
        for (id, name, points) in &shapes {
            if points.len() < 3 {
                continue;
            }
            let screen: Vec<_> = points.iter().copied().map(point_to_screen).collect();
            let selected = self.selected.as_ref() == Some(id);
            let color = if selected {
                Color32::from_rgb(118, 204, 245)
            } else {
                Color32::from_rgb(155, 171, 185)
            };
            painter.add(egui::Shape::closed_line(
                screen.clone(),
                Stroke::new(if selected { 2.5 } else { 1.4 }, color),
            ));
            // Show the persisted named-edge seam graph in the 2D board. These
            // are only guides; all actual sewing is compiled in Rust.
            if let Some(panel) = self.document.template.panels.iter().find(|p| &p.id == id)
                && let Some(poly) = &panel.polygon
            {
                let panel_index = self
                    .document
                    .template
                    .panels
                    .iter()
                    .position(|p| &p.id == id)
                    .unwrap_or(0);
                let origin = panel
                    .layout_2d
                    .unwrap_or(DVec2::new(panel_index as f64 * 1.16, 0.));
                for (index, edge) in poly.edges.iter().enumerate() {
                    let sewn = self.document.template.seams.iter().any(|seam| {
                        (seam.a.panel == *id && seam.a.edge.as_deref() == Some(edge.as_str()))
                            || (seam.b.panel == *id
                                && seam.b.edge.as_deref() == Some(edge.as_str()))
                    });
                    if sewn && let Ok(samples) = poly.edge_points(index) {
                        painter.add(egui::Shape::line(
                            samples
                                .into_iter()
                                .map(|p| point_to_screen(p + origin))
                                .collect(),
                            Stroke::new(3.2, Color32::from_rgb(239, 159, 106)),
                        ));
                    }
                }
            }
            if selected {
                for p in &screen {
                    painter.circle_filled(*p, 3.5, color);
                }
            }
            let bounds = Rect::from_points(&screen);
            painter.text(
                bounds.center(),
                Align2::CENTER_CENTER,
                name,
                FontId::proportional(12.),
                color,
            );
            if let Some(click) = click {
                if in_polygon(click, &screen) {
                    clicked_panel = Some(id.clone());
                }
            }
        }
        if let Some(panel) = clicked_panel {
            self.choose(panel);
        }
        painter.text(
            area.left_top() + Vec2::new(15., 15.),
            Align2::LEFT_TOP,
            format!(
                "Rust document · {} panels · revision {}",
                shapes.len(),
                self.document.revision
            ),
            FontId::monospace(12.),
            Color32::from_gray(175),
        );
    }
}

impl eframe::App for V3App {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        ui.ctx().set_visuals(egui::Visuals::dark());
        self.file_bar(ui);
        ui.separator();

        // egui 0.36 uses one root Ui instead of the former Context panels.
        // Reserve a wide central drafting surface while keeping both tool
        // columns stable, independent of how many features are implemented.
        let available = ui.available_size();
        let height = (available.y - 62.).max(230.);
        let center_width = (available.x - 235. - 305. - 32.).max(180.);
        ui.horizontal(|ui| {
            ui.allocate_ui(Vec2::new(235., height), |ui| {
                egui::ScrollArea::vertical()
                    .id_salt("tool-scroll")
                    .show(ui, |ui| self.toolbar(ui));
            });
            ui.separator();
            ui.allocate_ui(Vec2::new(center_width, height), |ui| match self.view_mode {
                ViewMode::TwoD => self.board(ui),
                ViewMode::ThreeD => {
                    if let Some(panel) = viewport::show(
                        ui,
                        &self.document,
                        self.selected.as_deref(),
                        &mut self.orbit_yaw,
                        &mut self.orbit_pitch,
                        self.orbit_zoom,
                    ) {
                        self.choose(panel);
                    }
                }
                ViewMode::Split => {
                    let pane_width = ((center_width - 12.) * 0.5).max(88.);
                    ui.horizontal(|ui| {
                        ui.allocate_ui(Vec2::new(pane_width, height), |ui| self.board(ui));
                        ui.separator();
                        ui.allocate_ui(Vec2::new(pane_width, height), |ui| {
                            if let Some(panel) = viewport::show(
                                ui,
                                &self.document,
                                self.selected.as_deref(),
                                &mut self.orbit_yaw,
                                &mut self.orbit_pitch,
                                self.orbit_zoom,
                            ) {
                                self.choose(panel);
                            }
                        });
                    });
                }
            });
            ui.separator();
            ui.allocate_ui(Vec2::new(305., height), |ui| {
                egui::ScrollArea::vertical()
                    .id_salt("inspector-scroll")
                    .show(ui, |ui| self.inspector(ui));
            });
        });
        ui.separator();
        ui.label(&self.status);
        ui.small("EXO V3 prototype · native Rust authoring · no simulation or factory-release certification");
    }
}

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1500., 930.])
            .with_min_inner_size([1100., 650.]),
        ..Default::default()
    };
    eframe::run_native(
        "EXO ClothCraft Studio V3 · Native Rust",
        options,
        Box::new(|_| Ok(Box::new(V3App::default()))),
    )
}
