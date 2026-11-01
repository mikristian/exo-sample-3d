//! Physical, temporary 3D instances for source-linked piece variants.
//! Derived geometry is a translated second instance, never a mirror or factory cut.
use crate::{fitting::FittingProject, garment::GarmentTemplate};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

pub fn compile_native_variant_instances_20261027(
    project: &FittingProject,
) -> Result<(GarmentTemplate, Value), String> {
    let source = &project.template;
    let variant = project
        .piece_variant
        .as_ref()
        .ok_or("No saved piece_variant for native 3D instance selection")?;
    variant.validate(source)?;
    let sewn: BTreeSet<&str> = source
        .seams
        .iter()
        .flat_map(|s| [s.a.panel.as_str(), s.b.panel.as_str()])
        .collect();
    let mut derived = source.clone();
    derived.panels.clear();
    let choices: BTreeMap<&str, _> = variant
        .pieces
        .iter()
        .map(|p| (p.panel_id.as_str(), p))
        .collect();
    let originals: BTreeSet<&str> = source.panels.iter().map(|p| p.id.as_str()).collect();
    let mut ids = originals
        .iter()
        .map(|s| (*s).to_owned())
        .collect::<BTreeSet<_>>();
    let mut instances = Vec::new();
    for panel in &source.panels {
        let choice = choices
            .get(panel.id.as_str())
            .ok_or_else(|| format!("Missing variant selection for {}", panel.id))?;
        if choice.substitute_panel_id.is_some() {
            return Err(format!("Unsupported substitutePanelId for {}", panel.id));
        }
        if !choice.send_to_3d {
            if sewn.contains(panel.id.as_str()) {
                return Err(format!("Cannot exclude sewn panel {}", panel.id));
            }
            continue;
        }
        derived.panels.push(panel.clone());
        let mut physical_ids = vec![panel.id.clone()];
        if choice.quantity == 2 {
            if sewn.contains(panel.id.as_str()) {
                return Err(format!(
                    "Sewn quantity 2 needs seam remapping: {}",
                    panel.id
                ));
            }
            let id = format!("{}__3d_instance_2", panel.id);
            if id.len() > 80 || !ids.insert(id.clone()) {
                return Err(format!(
                    "Unsafe or colliding derived panel ID for {}",
                    panel.id
                ));
            }
            let mut second = panel.clone();
            second.id = id.clone();
            second.name = format!("{} (3D instance 2)", panel.name);
            // An independent physical placement; rest UV, fabric, pins, and grain remain exact.
            // Place alongside the source's local extent to avoid initial mesh overlap.
            let width = panel.pattern.width.max(0.0);
            second.placement.translation.x += width + 0.25;
            if !second.placement.translation.is_finite() {
                return Err(format!("Non-finite instance placement for {}", panel.id));
            }
            derived.panels.push(second);
            physical_ids.push(id);
        }
        instances.push(
            json!({"sourcePanelId": panel.id, "physicalPanelIds": physical_ids,
            "quantity": choice.quantity}),
        );
    }
    if derived.panels.is_empty() || derived.panels.len() > 128 {
        return Err("3D instance panel count must be 1..128".into());
    }
    let compiled = derived.compile()?;
    if compiled.panels.len() != derived.panels.len()
        || compiled
            .panels
            .iter()
            .any(|p| p.vertices.is_empty() || p.triangles.is_empty())
    {
        return Err("Compiled 3D instances lack physical mesh vertices or triangles".into());
    }
    if compiled
        .mesh
        .masses
        .iter()
        .any(|m| !m.is_finite() || *m <= 0.0)
    {
        return Err("Compiled 3D instances have invalid physical masses".into());
    }
    if compiled.seams.len() != source.seams.len() {
        return Err("Derived 3D instances changed authored sewing".into());
    }
    let fabricated = derived.panels.len() > instances.len();
    let receipt = json!({
        "sourceLinked": true, "temporary3DSelection": true,
        "instances": instances, "physicalScenePanelCount": compiled.panels.len(),
        "physicalVertexCount": compiled.mesh.uv.len(),
        "physicalTriangleCount": compiled.mesh.triangles.len(),
        "physicalSeamCount": compiled.seams.len(),
        "fabricatedInstances": fabricated,
        "mirroredInstancesProven": false, "assemblyCertified": false,
        "factoryApproved": false,
    });
    Ok((derived, receipt))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        garment::{presets::GarmentKind, GarmentTemplate},
        native_piece_variant_20261027::{PersistedPieceVariant, VariantPiece},
    };
    use std::path::PathBuf;

    fn fixture() -> FittingProject {
        let mut project =
            FittingProject::basic(GarmentKind::Tshirt, 3, PathBuf::from("avatar.obj"));
        let mut template = GarmentTemplate::two_panel_demo();
        let mut extra = template.panels[0].clone();
        extra.id = "unsewn".into();
        extra.name = "Unsewn extra".into();
        extra.placement.translation.x = 2.0;
        template.panels.push(extra);
        let pieces = template
            .panels
            .iter()
            .map(|p| VariantPiece {
                panel_id: p.id.clone(),
                fabric_id: p.fabric.clone(),
                production: true,
                send_to_3d: true,
                quantity: if p.id == "unsewn" { 2 } else { 1 },
                substitute_panel_id: None,
            })
            .collect();
        project.piece_variant = Some(PersistedPieceVariant {
            version: 1,
            source_template: template.clone(),
            pieces,
        });
        project.template = template;
        project
    }

    #[test]
    fn real_second_mesh_and_unmodified_authored_base() {
        let project = fixture();
        let original = serde_json::to_value(&project.template).unwrap();
        let (template, receipt) = compile_native_variant_instances_20261027(&project).unwrap();
        assert_eq!(serde_json::to_value(&project.template).unwrap(), original);
        assert_eq!(receipt["fabricatedInstances"], true);
        assert_eq!(receipt["physicalScenePanelCount"], 4);
        assert_eq!(receipt["physicalSeamCount"], 1);
        assert_eq!(receipt["factoryApproved"], false);
        let mesh = template.compile().unwrap();
        let a = mesh.panels.iter().find(|p| p.id == "unsewn").unwrap();
        let b = mesh
            .panels
            .iter()
            .find(|p| p.id == "unsewn__3d_instance_2")
            .unwrap();
        assert_eq!(a.vertices.len(), b.vertices.len());
        assert_eq!(a.triangles.len(), b.triangles.len());
        assert!(a.vertices.len() > 0 && a.triangles.len() > 0);
        for (i, j) in a.vertices.clone().zip(b.vertices.clone()) {
            assert_eq!(mesh.mesh.uv[i], mesh.mesh.uv[j]);
            assert_eq!(mesh.mesh.masses[i], mesh.mesh.masses[j]);
            assert!((mesh.initial_state.x[j].x - mesh.initial_state.x[i].x - 0.65).abs() < 1e-9);
        }
        assert_eq!(mesh.seams.len(), 1);
    }

    #[test]
    fn excludes_only_unsewn_and_blocks_sewn_quantity_two() {
        let mut project = fixture();
        project.piece_variant.as_mut().unwrap().pieces[2].send_to_3d = false;
        let (selected, receipt) = compile_native_variant_instances_20261027(&project).unwrap();
        assert_eq!(selected.panels.len(), 2);
        assert_eq!(receipt["fabricatedInstances"], false);
        project.piece_variant.as_mut().unwrap().pieces[0].quantity = 2;
        assert!(compile_native_variant_instances_20261027(&project)
            .unwrap_err()
            .contains("Sewn quantity"));
    }

    #[test]
    fn rejects_collisions_stale_fabric_and_capacity() {
        let mut p = fixture();
        let mut collision = p.template.panels[2].clone();
        collision.id = "unsewn__3d_instance_2".into();
        p.template.panels.push(collision.clone());
        let variant = p.piece_variant.as_mut().unwrap();
        variant.source_template = p.template.clone();
        variant.pieces.push(VariantPiece {
            panel_id: collision.id,
            fabric_id: collision.fabric,
            production: true,
            send_to_3d: true,
            quantity: 1,
            substitute_panel_id: None,
        });
        assert!(compile_native_variant_instances_20261027(&p)
            .unwrap_err()
            .contains("colliding"));
        let mut stale = fixture();
        stale.template.name.push_str("changed");
        assert!(compile_native_variant_instances_20261027(&stale)
            .unwrap_err()
            .contains("Stale"));
        let mut fabric = fixture();
        fabric.piece_variant.as_mut().unwrap().pieces[2].fabric_id = "bad".into();
        assert!(compile_native_variant_instances_20261027(&fabric)
            .unwrap_err()
            .contains("Fabric mismatch"));
        let mut capacity = fixture();
        while capacity.template.panels.len() < 128 {
            let mut panel = capacity.template.panels[2].clone();
            panel.id = format!("extra_{}", capacity.template.panels.len());
            capacity.template.panels.push(panel);
        }
        let v = capacity.piece_variant.as_mut().unwrap();
        v.source_template = capacity.template.clone();
        v.pieces = capacity
            .template
            .panels
            .iter()
            .map(|panel| VariantPiece {
                panel_id: panel.id.clone(),
                fabric_id: panel.fabric.clone(),
                production: true,
                send_to_3d: true,
                quantity: if panel.id == "unsewn" { 2 } else { 1 },
                substitute_panel_id: None,
            })
            .collect();
        assert!(compile_native_variant_instances_20261027(&capacity)
            .unwrap_err()
            .contains("1..128"));
    }
}
