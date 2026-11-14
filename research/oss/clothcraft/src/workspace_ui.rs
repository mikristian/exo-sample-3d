//! Native, persistent workspace controls ported from V2's viewport layout and
//! panel visibility behavior. No React runtime, WebView, or JavaScript calls.
use eframe::egui;
use serde::{Deserialize, Serialize};
use std::{fs, io, path::Path};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum ViewLayout {
    #[default]
    #[serde(rename = "split")]
    Split,
    #[serde(rename = "3d")]
    ThreeD,
    #[serde(rename = "2d")]
    TwoD,
}

/// Explicit native editor actions, never evaluated as JavaScript callback text.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WorkspaceAction {
    SaveProject,
    LoadProject,
    Frame3D,
    ResetSimulation,
}

impl ViewLayout {
    pub const fn key(self) -> &'static str {
        match self {
            Self::Split => "split",
            Self::ThreeD => "3d",
            Self::TwoD => "2d",
        }
    }

    pub const fn label(self) -> &'static str {
        match self {
            Self::Split => "Side by side",
            Self::ThreeD => "3D focus",
            Self::TwoD => "2D focus",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct WorkspaceUi {
    pub layout: ViewLayout,
    pub palette_open: bool,
    pub inspector_open: bool,
    pub inspector_width: f32,
    pub viewport_split: f32,
    pub settings_open: bool,
}

impl Default for WorkspaceUi {
    fn default() -> Self {
        Self {
            layout: ViewLayout::Split,
            palette_open: true,
            inspector_open: true,
            inspector_width: 320.0,
            viewport_split: 0.5,
            settings_open: false,
        }
    }
}

impl WorkspaceUi {
    pub const FILE_NAME: &'static str = "workspace-ui.json";

    fn normalize(mut self) -> Self {
        if !self.inspector_width.is_finite() {
            self.inspector_width = 320.0;
        }
        if !self.viewport_split.is_finite() {
            self.viewport_split = 0.5;
        }
        self.inspector_width = self.inspector_width.clamp(260.0, 460.0);
        self.viewport_split = self.viewport_split.clamp(0.2, 0.8);
        self
    }

    pub fn load(path: &Path) -> Result<Self, String> {
        match fs::read(path) {
            Ok(bytes) => serde_json::from_slice::<Self>(&bytes)
                .map(Self::normalize)
                .map_err(|e| format!("Workspace settings invalid (not overwritten): {e}")),
            Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(Self::default()),
            Err(err) => Err(format!("Cannot read workspace settings: {err}")),
        }
    }

    pub fn save(&self, path: &Path) -> Result<(), String> {
        // Preserve a corrupt sidecar for manual inspection instead of silently
        // replacing it when a panel happens to resize during startup.
        if path.exists() {
            Self::load(path)?;
        }
        let parent = path
            .parent()
            .ok_or("Workspace settings directory missing")?;
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        let tmp = path.with_extension("json.tmp");
        let data =
            serde_json::to_vec_pretty(&self.clone().normalize()).map_err(|e| e.to_string())?;
        fs::write(&tmp, data).map_err(|e| e.to_string())?;
        fs::rename(&tmp, path).map_err(|e| e.to_string())
    }

    /// Keep the three layout values identical to the existing V2 configuration.
    pub fn layout_controls(&mut self, ui: &mut egui::Ui) {
        for candidate in [ViewLayout::Split, ViewLayout::ThreeD, ViewLayout::TwoD] {
            ui.selectable_value(&mut self.layout, candidate, candidate.label());
        }
    }

    pub fn menu(&mut self, ui: &mut egui::Ui) -> Option<WorkspaceAction> {
        ui.label("VIEWPORT LAYOUT");
        self.layout_controls(ui);
        ui.separator();
        ui.checkbox(&mut self.palette_open, "Left tool palette");
        ui.checkbox(&mut self.inspector_open, "Right property inspector");
        ui.separator();
        ui.checkbox(&mut self.settings_open, "Workspace settings panel");
        if ui.button("Restore workspace defaults").clicked() {
            *self = Self::default();
        }
        ui.separator();
        let actions = [
            ("Save garment project", WorkspaceAction::SaveProject),
            ("Load garment project", WorkspaceAction::LoadProject),
            ("Frame 3D camera", WorkspaceAction::Frame3D),
            ("Reset cloth simulation", WorkspaceAction::ResetSimulation),
        ];
        for (label, command) in actions {
            if ui.button(label).clicked() {
                ui.close();
                return Some(command);
            }
        }
        None
    }

    pub fn settings(&mut self, ui: &mut egui::Ui) {
        ui.heading("Native workspace settings");
        ui.label("2D and 3D viewport layout");
        egui::ComboBox::from_id_salt("exo-native-workspace-layout")
            .selected_text(self.layout.label())
            .show_ui(ui, |ui| self.layout_controls(ui));
        ui.checkbox(&mut self.palette_open, "Show left palette");
        ui.checkbox(&mut self.inspector_open, "Show property inspector");
        if self.inspector_open {
            ui.add(
                egui::Slider::new(&mut self.inspector_width, 260.0..=460.0).text("Inspector width"),
            );
        }
        if self.layout == ViewLayout::Split {
            ui.add(
                egui::Slider::new(&mut self.viewport_split, 0.2..=0.8).text("3D split fraction"),
            );
        }
        ui.small("Workspace changes are saved separately from garment geometry.");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_v2_split_workspace() {
        let s = WorkspaceUi::default();
        assert_eq!(s.layout.key(), "split");
        assert!(s.palette_open && s.inspector_open);
    }

    #[test]
    fn v2_layout_values_roundtrip() {
        for (layout, value) in [
            (ViewLayout::Split, "split"),
            (ViewLayout::ThreeD, "3d"),
            (ViewLayout::TwoD, "2d"),
        ] {
            assert_eq!(
                serde_json::to_string(&layout).unwrap(),
                format!("\"{value}\"")
            );
            assert_eq!(
                serde_json::from_str::<ViewLayout>(&format!("\"{value}\"")).unwrap(),
                layout
            );
        }
    }

    #[test]
    fn survives_disk_roundtrip_and_clamps_untrusted_widths() {
        let folder =
            std::env::temp_dir().join(format!("exo-workspace-test-{}-{}", std::process::id(), 907));
        let file = folder.join(WorkspaceUi::FILE_NAME);
        let mut s = WorkspaceUi {
            layout: ViewLayout::TwoD,
            palette_open: false,
            inspector_open: true,
            inspector_width: 999999.0,
            viewport_split: 0.99,
            settings_open: true,
        };
        s.save(&file).unwrap();
        let reloaded = WorkspaceUi::load(&file).unwrap();
        assert_eq!(reloaded.layout, ViewLayout::TwoD);
        assert!(!reloaded.palette_open);
        assert_eq!(reloaded.inspector_width, 460.0);
        assert_eq!(reloaded.viewport_split, 0.8);
        s.layout = ViewLayout::ThreeD;
        s.save(&file).unwrap();
        assert_eq!(WorkspaceUi::load(&file).unwrap().layout, ViewLayout::ThreeD);
        fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn missing_file_defaults_but_invalid_file_is_preserved() {
        let folder = std::env::temp_dir().join(format!(
            "exo-workspace-corruption-{}-{}",
            std::process::id(),
            908
        ));
        let file = folder.join(WorkspaceUi::FILE_NAME);
        assert_eq!(WorkspaceUi::load(&file).unwrap(), WorkspaceUi::default());
        fs::create_dir_all(&folder).unwrap();
        fs::write(&file, b"{not valid}").unwrap();
        assert!(WorkspaceUi::load(&file).is_err());
        assert_eq!(fs::read(&file).unwrap(), b"{not valid}");
        assert!(WorkspaceUi::default().save(&file).is_err());
        assert_eq!(fs::read(&file).unwrap(), b"{not valid}");
        fs::remove_dir_all(folder).unwrap();
    }
}
