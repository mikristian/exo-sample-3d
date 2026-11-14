//! Source-linked production/3D piece-selection review, schema v1.
//! A quantity-two panel is a review request, not an instantiated mirrored panel.
use crate::garment::GarmentTemplate;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VariantPiece {
    pub panel_id: String,
    pub fabric_id: String,
    pub production: bool,
    #[serde(rename = "sendTo3D")]
    pub send_to_3d: bool,
    pub quantity: u8,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub substitute_panel_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PersistedPieceVariant {
    pub version: u32,
    pub source_template: GarmentTemplate,
    pub pieces: Vec<VariantPiece>,
}

impl PersistedPieceVariant {
    /// Validates persistence and returns a conservative review receipt.
    /// Valid selection never authorizes a physical production or factory release.
    pub fn validate(&self, template: &GarmentTemplate) -> Result<Value, String> {
        // Full validation is mandatory at storage/import boundaries.
        let review = self.review_without_compile(template)?;
        template.compile().map_err(|e| format!("Invalid authoritative source template: {e}"))?;
        Ok(review)
    }

    /// Rechecks source-linked selection for frequent snapshot/solver reads.
    /// Caller must have fully validated the authoritative template at load/store.
    /// This shares all variant rules with `validate` but avoids mesh compilation.
    pub fn review_without_compile(&self, template: &GarmentTemplate) -> Result<Value, String> {
        if self.version != 1 {
            return Err("Unsupported piece variant version: expected 1".into());
        }
        if self.pieces.is_empty() || self.pieces.len() > 128 || self.pieces.len() != template.panels.len() {
            return Err("Piece variant must contain exactly all 1..128 authored panels".into());
        }
        // Compare the exact serialized template, including panel order, fabric data,
        // seams, placement, and drafting metadata. Revalidate on every reopen/edit.
        let source = serde_json::to_vec(&self.source_template).map_err(|e| e.to_string())?;
        let current = serde_json::to_vec(template).map_err(|e| e.to_string())?;
        if source != current {
            return Err("Stale piece variant sourceTemplate: authoritative template changed".into());
        }
        let panel_fabrics: BTreeMap<&str, &str> = template.panels.iter()
            .map(|p| (p.id.as_str(), p.fabric.as_str())).collect();
        let fabric_ids: BTreeSet<&str> = template.fabrics.iter().map(|f| f.id.as_str()).collect();
        let mut seen = BTreeSet::new();
        let mut production = 0usize;
        let mut three_d = 0usize;
        let mut paired = Vec::new();
        for piece in &self.pieces {
            let expected_fabric = panel_fabrics.get(piece.panel_id.as_str())
                .ok_or_else(|| format!("Unknown piece panelId: {}", piece.panel_id))?;
            if !seen.insert(piece.panel_id.as_str()) {
                return Err(format!("Duplicate piece panelId: {}", piece.panel_id));
            }
            if !fabric_ids.contains(piece.fabric_id.as_str()) || piece.fabric_id != *expected_fabric {
                return Err(format!("Fabric mismatch for piece {}", piece.panel_id));
            }
            if !(1..=2).contains(&piece.quantity) {
                return Err(format!("Unsupported quantity for piece {}: expected 1 or 2", piece.panel_id));
            }
            if piece.substitute_panel_id.is_some() {
                return Err(format!("Unwired substitutePanelId on piece {}", piece.panel_id));
            }
            production += usize::from(piece.production);
            three_d += usize::from(piece.send_to_3d);
            if piece.quantity == 2 {
                paired.push(piece.panel_id.clone());
            }
        }
        if seen.len() != template.panels.len() || template.panels.iter().any(|p| !seen.contains(p.id.as_str())) {
            return Err("Missing authored panel in piece variant".into());
        }
        if production == 0 {
            return Err("At least one production piece is required".into());
        }
        if three_d == 0 {
            return Err("At least one sendTo3D piece is required".into());
        }
        let included: BTreeSet<&str> = self.pieces.iter().filter(|p| p.send_to_3d)
            .map(|p| p.panel_id.as_str()).collect();
        for seam in &template.seams {
            if !included.contains(seam.a.panel.as_str()) || !included.contains(seam.b.panel.as_str()) {
                return Err(format!("Sewn seam {} requires both referenced panels in sendTo3D", seam.id));
            }
        }
        let ready_for_3d = paired.is_empty();
        let warnings: Vec<String> = if paired.is_empty() {
            Vec::new()
        } else {
            vec![format!("Quantity 2 requires explicit two-instance geometry and sewing review for: {}", paired.join(", "))]
        };
        Ok(json!({
            "version": 1,
            "valid": true,
            "structurallyValid": true,
            "readyFor3D": ready_for_3d,
            "factoryAuthorized": false,
            "productionAuthorized": false,
            "twoInstanceGeometryGenerated": false,
            "sourceLinked": true,
            "pieceCount": self.pieces.len(),
            "productionPieceCount": production,
            "sendTo3DPieceCount": three_d,
            "pairedQuantityPanelIds": paired,
            "warnings": warnings,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> (GarmentTemplate, PersistedPieceVariant) {
        let template = GarmentTemplate::two_panel_demo();
        let pieces = template.panels.iter().map(|p| VariantPiece {
            panel_id: p.id.clone(), fabric_id: p.fabric.clone(),
            production: true, send_to_3d: true, quantity: 1,
            substitute_panel_id: None,
        }).collect();
        let variant = PersistedPieceVariant { version: 1, source_template: template.clone(), pieces };
        (template, variant)
    }

    #[test]
    fn valid_source_linked_selection_and_json_roundtrip() {
        let (template, variant) = fixture();
        let data = serde_json::to_string(&variant).unwrap();
        assert!(data.contains("sourceTemplate"));
        assert!(data.contains("sendTo3D"));
        let loaded: PersistedPieceVariant = serde_json::from_str(&data).unwrap();
        let receipt = loaded.validate(&template).unwrap();
        assert_eq!(receipt["readyFor3D"], true);
        assert_eq!(receipt["factoryAuthorized"], false);
    }

    #[test]
    fn stale_source_rejected_even_for_metadata_edit() {
        let (mut template, variant) = fixture();
        template.name.push_str(" changed");
        assert!(variant.validate(&template).unwrap_err().contains("Stale"));
    }

    #[test]
    fn duplicate_and_missing_panel_rejected() {
        let (template, mut variant) = fixture();
        variant.pieces[1].panel_id = variant.pieces[0].panel_id.clone();
        assert!(variant.validate(&template).unwrap_err().contains("Duplicate"));
        variant.pieces.pop();
        assert!(variant.validate(&template).unwrap_err().contains("exactly"));
    }

    #[test]
    fn sewn_panel_excluded_from_3d_rejected() {
        let (template, mut variant) = fixture();
        variant.pieces[1].send_to_3d = false;
        assert!(variant.validate(&template).unwrap_err().contains("Sewn seam"));
    }

    #[test]
    fn fabric_mismatch_rejected() {
        let (template, mut variant) = fixture();
        variant.pieces[0].fabric_id = "unknown".into();
        assert!(variant.validate(&template).unwrap_err().contains("Fabric mismatch"));
    }

    #[test]
    fn quantity_two_persists_as_review_with_blocked_readiness() {
        let (template, mut variant) = fixture();
        variant.pieces[0].quantity = 2;
        let receipt = variant.validate(&template).unwrap();
        assert_eq!(receipt["structurallyValid"], true);
        assert_eq!(receipt["readyFor3D"], false);
        assert_eq!(receipt["twoInstanceGeometryGenerated"], false);
        assert_eq!(receipt["pairedQuantityPanelIds"][0], "left");
        assert_eq!(receipt["warnings"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn unknown_source_and_unwired_substitute_rejected() {
        let (template, mut variant) = fixture();
        variant.source_template.name.push_str(" spoof");
        assert!(variant.validate(&template).unwrap_err().contains("Stale"));
        variant.source_template = template.clone();
        variant.pieces[0].substitute_panel_id = Some("right".into());
        assert!(variant.validate(&template).unwrap_err().contains("Unwired"));
    }

    #[test]
    fn invalid_quantity_version_and_missing_required_flags_rejected() {
        let (template, mut variant) = fixture();
        variant.version = 2;
        assert!(variant.validate(&template).unwrap_err().contains("version"));
        variant.version = 1;
        variant.pieces[0].quantity = 3;
        assert!(variant.validate(&template).unwrap_err().contains("quantity"));
        variant.pieces[0].quantity = 1;
        for piece in &mut variant.pieces { piece.production = false; }
        assert!(variant.validate(&template).unwrap_err().contains("production"));
        for piece in &mut variant.pieces { piece.production = true; piece.send_to_3d = false; }
        assert!(variant.validate(&template).unwrap_err().contains("sendTo3D"));
    }

    #[test]
    fn serde_rejects_unknown_fields() {
        let (_template, variant) = fixture();
        let mut value = serde_json::to_value(&variant).unwrap();
        value["pieces"][0]["phantomMirror"] = json!(true);
        assert!(serde_json::from_value::<PersistedPieceVariant>(value).is_err());
    }

    #[test]
    fn cheap_review_matches_full_validation_for_valid_and_stale_source() {
        let (mut template, variant) = fixture();
        assert_eq!(variant.review_without_compile(&template).unwrap(), variant.validate(&template).unwrap());
        template.name.push_str(" stale");
        assert_eq!(variant.review_without_compile(&template).unwrap_err(), variant.validate(&template).unwrap_err());
    }
}
