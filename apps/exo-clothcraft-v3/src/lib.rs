//! EXO V3: Rust owns the editable garment and all successful authoring edits.
//! Frontends must never write their own divergent version of the garment.
use glam::DVec2;
use marvelous_cloth::{
    authoring::{self, Command, History},
    garment::{
        CompiledGarment, GarmentTemplate,
        meshing::MeshingSettings,
        presets::{self, GarmentKind},
        seam::{BoundaryRef, Side},
    },
};
use std::{fs, io::Write, path::Path};

pub struct Document {
    pub template: GarmentTemplate,
    /// Derived by the *same* validated Rust authoring operation that committed
    /// the current template. Native 2D and 3D viewers share this one source.
    pub compiled: CompiledGarment,
    pub history: History,
    pub revision: u64,
    pub dirty: bool,
}

impl Document {
    pub fn new(kind: GarmentKind) -> Result<Self, String> {
        let template = presets::basic(kind, 0);
        let compiled = template.compile()?;
        Ok(Self {
            template,
            compiled,
            history: History::default(),
            revision: 0,
            dirty: false,
        })
    }

    pub fn apply(&mut self, command: Command) -> Result<Option<String>, String> {
        // Native authoring validates and compiles before a state mutation.
        // An error cannot add history or change the live garment.
        let edit = authoring::apply(&self.template, command)?;
        self.history.record(self.template.clone());
        self.template = edit.template;
        self.compiled = edit.garment;
        self.revision += 1;
        self.dirty = true;
        Ok(edit.selected)
    }

    pub fn add_rectangle(
        &mut self,
        width_mm: f64,
        height_mm: f64,
    ) -> Result<Option<String>, String> {
        if !width_mm.is_finite()
            || !height_mm.is_finite()
            || !(5.0..=10_000.0).contains(&width_mm)
            || !(5.0..=10_000.0).contains(&height_mm)
        {
            return Err("Rectangle dimensions must be between 5 and 10,000 mm".into());
        }
        let width = width_mm / 1000.;
        let height = height_mm / 1000.;
        self.apply(Command::Polygon {
            points: vec![
                DVec2::ZERO,
                DVec2::new(width, 0.),
                DVec2::new(width, height),
                DVec2::new(0., height),
            ],
            tangents: vec![],
            meshing: MeshingSettings::default(),
            fabric: self.template.fabrics[0].id.clone(),
            replace: false,
        })
    }

    pub fn move_anchor(
        &mut self,
        panel: &str,
        index: usize,
        x_mm: f64,
        y_mm: f64,
    ) -> Result<Option<String>, String> {
        if !x_mm.is_finite() || !y_mm.is_finite() {
            return Err("Coordinates must be finite".into());
        }
        self.apply(Command::Anchor {
            panel: panel.into(),
            anchor: index,
            position: DVec2::new(x_mm / 1000., y_mm / 1000.),
        })
    }

    pub fn restore(&mut self, redo: bool) -> Result<(), String> {
        let edit = self.history.restore(&self.template, redo)?;
        self.template = edit.template;
        self.compiled = edit.garment;
        self.revision += 1;
        self.dirty = true;
        Ok(())
    }

    pub fn load(path: &Path) -> Result<Self, String> {
        let template = GarmentTemplate::load(path)?;
        let compiled = template.compile()?;
        Ok(Self {
            template,
            compiled,
            history: History::default(),
            revision: 0,
            dirty: false,
        })
    }

    /// Create one exact, full-length seam on two existing named boundaries.
    /// Rust validates ownership, length compatibility and the complete
    /// compiled geometry before committing a document revision.
    pub fn sew_named_edges(
        &mut self,
        panel_a: &str,
        edge_a: &str,
        panel_b: &str,
        edge_b: &str,
        reverse: bool,
    ) -> Result<(), String> {
        let exists = |panel_id: &str, edge_id: &str| {
            self.template.panels.iter().any(|panel| {
                panel.id == panel_id
                    && panel
                        .polygon
                        .as_ref()
                        .is_some_and(|polygon| polygon.edges.iter().any(|id| id == edge_id))
            })
        };
        if !exists(panel_a, edge_a) || !exists(panel_b, edge_b) {
            return Err("Select two existing native named panel boundaries".into());
        }
        if panel_a == panel_b && edge_a == edge_b {
            return Err("Cannot sew a material boundary to itself".into());
        }
        let boundary = |panel: &str, edge: &str| BoundaryRef {
            panel: panel.into(),
            side: Side::Top, // Legacy side is ignored for named v2 boundaries.
            edge: Some(edge.into()),
            range: [0., 1.],
        };
        self.apply(Command::Sew {
            a: boundary(panel_a, edge_a),
            b: boundary(panel_b, edge_b),
            reverse,
            ease: false, // No silent gathering when lengths differ.
        })?;
        Ok(())
    }

    pub fn remove_seam(&mut self, id: &str) -> Result<(), String> {
        self.apply(Command::RemoveSeam { seam: id.into() })?;
        Ok(())
    }

    /// Read-only proof that views and persisted model are synchronized.
    /// Never reconstruct a model from rendering geometry.
    pub fn verify_compiled(&self) -> Result<(), String> {
        let fresh = self.template.compile()?;
        if fresh.mesh.uv != self.compiled.mesh.uv
            || fresh
                .mesh
                .triangles
                .iter()
                .map(|tri| tri.vertices)
                .collect::<Vec<_>>()
                != self
                    .compiled
                    .mesh
                    .triangles
                    .iter()
                    .map(|tri| tri.vertices)
                    .collect::<Vec<_>>()
            || fresh.initial_state.x != self.compiled.initial_state.x
            || fresh
                .seams
                .iter()
                .map(|seam| (&seam.id, seam.lengths, seam.samples.len()))
                .collect::<Vec<_>>()
                != self
                    .compiled
                    .seams
                    .iter()
                    .map(|seam| (&seam.id, seam.lengths, seam.samples.len()))
                    .collect::<Vec<_>>()
            || fresh.panels.len() != self.compiled.panels.len()
        {
            return Err("Compiled garment is not in sync with the native document".into());
        }
        Ok(())
    }

    /// Persist an ordinary ClothCraft template, not an incompatible EXO wrapper.
    /// Atomic replacement ensures failures never truncate the existing document.
    /// Undo history is currently in-memory and intentionally not advertised as durable.
    pub fn save(&mut self, path: &Path) -> Result<(), String> {
        self.template.compile()?;
        let parent = path
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or(Path::new("."));
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
        serde_json::to_writer_pretty(&mut temp, &self.template).map_err(|e| e.to_string())?;
        temp.flush().map_err(|e| e.to_string())?;
        temp.as_file().sync_all().map_err(|e| e.to_string())?;
        temp.persist(path).map_err(|e| e.to_string())?;
        self.dirty = false;
        Ok(())
    }
}

pub fn panel_contour(panel: &marvelous_cloth::garment::template::Panel) -> Vec<DVec2> {
    if let Some(polygon) = &panel.polygon {
        // Use the same bounded Bézier sampling as native material geometry,
        // including independently edited curve points. Never substitute the
        // polygon's straight vertex chords for curved production cutlines.
        let mut contour = Vec::new();
        for index in 0..polygon.edges.len() {
            let Ok(samples) = polygon.edge_points(index) else {
                return polygon.points.clone();
            };
            contour.extend(samples.into_iter().skip(usize::from(index > 0)));
        }
        if contour.len() >= 3 {
            return contour;
        }
        return polygon.points.clone();
    }
    let width = panel.pattern.width;
    let height = panel.pattern.height;
    vec![
        DVec2::ZERO,
        DVec2::new(width, 0.),
        DVec2::new(width, height),
        DVec2::new(0., height),
    ]
}

pub fn panel_anchors(panel: &marvelous_cloth::garment::template::Panel) -> Vec<DVec2> {
    panel
        .polygon
        .as_ref()
        .map(|poly| poly.points.clone())
        .unwrap_or_else(|| {
            let width = panel.pattern.width;
            let height = panel.pattern.height;
            vec![
                DVec2::ZERO,
                DVec2::new(width, 0.),
                DVec2::new(width, height),
                DVec2::new(0., height),
            ]
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use marvelous_cloth::authoring::Command;

    #[test]
    fn native_edit_undo_redo_and_compile_are_one_authority() {
        let mut doc = Document::new(GarmentKind::Tshirt).unwrap();
        doc.verify_compiled().unwrap();
        let start = doc.template.panels.len();
        doc.add_rectangle(300., 400.).unwrap();
        assert_eq!(doc.template.panels.len(), start + 1);
        assert_eq!(doc.revision, 1);
        doc.verify_compiled().unwrap();
        doc.restore(false).unwrap();
        assert_eq!(doc.template.panels.len(), start);
        doc.verify_compiled().unwrap();
        doc.restore(true).unwrap();
        assert_eq!(doc.template.panels.len(), start + 1);
        assert_eq!(doc.revision, 3);
        doc.verify_compiled().unwrap();
    }

    #[test]
    fn rejected_operation_does_not_mutate_or_add_undo() {
        let mut doc = Document::new(GarmentKind::Dress).unwrap();
        let before = serde_json::to_vec(&doc.template).unwrap();
        assert!(doc.add_rectangle(0., 250.).is_err());
        assert!(
            doc.apply(Command::RemovePanel {
                panel: "missing".into()
            })
            .is_err()
        );
        assert_eq!(serde_json::to_vec(&doc.template).unwrap(), before);
        assert_eq!(doc.revision, 0);
        assert!(!doc.history.can_undo());
        doc.verify_compiled().unwrap();
    }

    #[test]
    fn saves_native_clothcraft_format_and_reopens_without_loss() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("project.json");
        let mut doc = Document::new(GarmentKind::Tshirt).unwrap();
        doc.add_rectangle(275., 300.).unwrap();
        doc.save(&target).unwrap();
        assert!(!doc.dirty);
        let loaded = Document::load(&target).unwrap();
        assert_eq!(loaded.template.format, "marvelous-cloth-template");
        assert_eq!(loaded.template.panels.len(), doc.template.panels.len());
        assert_eq!(
            serde_json::to_value(&loaded.template).unwrap(),
            serde_json::to_value(&doc.template).unwrap()
        );
        loaded.verify_compiled().unwrap();
    }

    #[test]
    fn invalid_load_cannot_damage_live_document() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("project.json");
        fs::write(&target, "{ bad input").unwrap();
        let mut live = Document::new(GarmentKind::Tshirt).unwrap();
        let before = serde_json::to_value(&live.template).unwrap();
        if let Ok(next) = Document::load(&target) {
            live = next;
        }
        assert_eq!(serde_json::to_value(&live.template).unwrap(), before);
        live.verify_compiled().unwrap();
    }

    #[test]
    fn sewing_is_one_native_document_revision_with_compiled_stitches_and_history() {
        let mut doc = Document::new(GarmentKind::Tshirt).unwrap();
        let source = doc.add_rectangle(280., 380.).unwrap().unwrap();
        let duplicate = doc
            .apply(Command::Duplicate {
                panel: source.clone(),
            })
            .unwrap()
            .unwrap();
        let seam_count = doc.template.seams.len();
        let source_edge = doc
            .template
            .panels
            .iter()
            .find(|p| p.id == source)
            .unwrap()
            .polygon
            .as_ref()
            .unwrap()
            .edges[0]
            .clone();
        let target_edge = doc
            .template
            .panels
            .iter()
            .find(|p| p.id == duplicate)
            .unwrap()
            .polygon
            .as_ref()
            .unwrap()
            .edges[0]
            .clone();
        let revision_before = doc.revision;

        doc.sew_named_edges(&source, &source_edge, &duplicate, &target_edge, false)
            .unwrap();
        assert_eq!(doc.revision, revision_before + 1);
        assert_eq!(doc.template.seams.len(), seam_count + 1);
        assert_eq!(doc.compiled.seams.len(), seam_count + 1);
        assert!(!doc.compiled.seams.last().unwrap().samples.is_empty());
        doc.verify_compiled().unwrap();

        let seam_id = doc.template.seams.last().unwrap().id.clone();
        let geometry = doc.compiled.mesh.uv.clone();
        let revision_before_bad = doc.revision;
        assert!(
            doc.sew_named_edges(&source, &source_edge, &duplicate, &target_edge, false)
                .is_err()
        );
        assert_eq!(doc.revision, revision_before_bad);
        assert_eq!(doc.template.seams.len(), seam_count + 1);
        assert_eq!(doc.compiled.mesh.uv, geometry);

        doc.restore(false).unwrap();
        assert_eq!(doc.compiled.seams.len(), seam_count);
        doc.restore(true).unwrap();
        assert_eq!(doc.template.seams.last().unwrap().id, seam_id);
        doc.remove_seam(&seam_id).unwrap();
        assert_eq!(doc.compiled.seams.len(), seam_count);
        doc.restore(false).unwrap();
        assert_eq!(doc.compiled.seams.len(), seam_count + 1);
        doc.verify_compiled().unwrap();
    }

    #[test]
    fn native_seams_and_compiled_mesh_survive_save_and_cold_reopen() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("v3-sewn.json");
        let mut doc = Document::new(GarmentKind::Dress).unwrap();
        let a = doc.add_rectangle(260., 370.).unwrap().unwrap();
        let b = doc
            .apply(Command::Duplicate { panel: a.clone() })
            .unwrap()
            .unwrap();
        let edge = doc
            .template
            .panels
            .iter()
            .find(|p| p.id == a)
            .unwrap()
            .polygon
            .as_ref()
            .unwrap()
            .edges[1]
            .clone();
        doc.sew_named_edges(&a, &edge, &b, &edge, false).unwrap();
        let current_seams = doc.compiled.seams.len();
        let current_vertices = doc.compiled.initial_state.x.clone();
        doc.save(&path).unwrap();
        let reopened = Document::load(&path).unwrap();
        assert_eq!(reopened.compiled.seams.len(), current_seams);
        assert_eq!(reopened.compiled.initial_state.x, current_vertices);
        reopened.verify_compiled().unwrap();
        assert!(!reopened.history.can_undo()); // History is intentionally not durable yet.
    }

    #[test]
    fn editing_rust_anchor_updates_both_material_and_placed_3d_mesh() {
        let mut doc = Document::new(GarmentKind::Dress).unwrap();
        let id = doc.add_rectangle(300., 400.).unwrap().unwrap();
        let old_uv = doc.compiled.mesh.uv.clone();
        let old_3d = doc.compiled.initial_state.x.clone();
        doc.move_anchor(&id, 2, 320., 400.).unwrap();
        assert_ne!(doc.compiled.mesh.uv, old_uv);
        assert_ne!(doc.compiled.initial_state.x, old_3d);
        assert_eq!(
            doc.template
                .panels
                .iter()
                .find(|p| p.id == id)
                .unwrap()
                .polygon
                .as_ref()
                .unwrap()
                .points[2],
            DVec2::new(0.32, 0.4)
        );
        doc.verify_compiled().unwrap();
        doc.restore(false).unwrap();
        assert_eq!(doc.compiled.mesh.uv, old_uv);
        assert_eq!(doc.compiled.initial_state.x, old_3d);
        doc.verify_compiled().unwrap();
        doc.restore(true).unwrap();
        doc.verify_compiled().unwrap();
    }
}
