//! Read-only industrial station propagation proof over an authored native six-size grade.
//!
//! This module validates physical stitch-edge samples, notch arclength stations,
//! curve identities and allowance normals. With sewn attachments, it also
//! requires a separately measured six-size paired-seam station audit. No
//! cutter output or mutable transaction is implied by successful verification.
use crate::fitting::PersistedGradeRun;
use crate::garment::polygon::PolygonPattern;
use crate::garment::GarmentTemplate;
use crate::garment::seam::{BoundaryRef, SeamSpec};
use glam::DVec2;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[cfg(test)]
const EXPECTED: [&str; 6] = ["XS", "S", "M", "L", "XL", "XXL"];
const GEOMETRIC_EPS: f64 = 1e-9;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeNotchStationProof {
    pub index: usize,
    pub fraction: f64,
    pub seam_arclength_m: f64,
    pub depth_m: f64,
    pub stitch_position_m: [f64; 2],
    pub outward_normal: [f64; 2],
    pub marker_end_m: [f64; 2],
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeEdgeIndustrialProof {
    pub edge_id: String,
    pub physical_seam_arclength_m: f64,
    pub cubic_control_points_m: Option<[[f64; 2]; 2]>,
    pub free_curve_point_ids: Vec<String>,
    pub allowance_m: Option<f64>,
    pub min_allowance_normal_alignment: Option<f64>,
    pub notches: Vec<NativeNotchStationProof>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSizeIndustrialProof {
    pub size: String,
    pub panel_id: String,
    pub edges: Vec<NativeEdgeIndustrialProof>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeIndustrialSixSizeProof {
    pub format: String,
    pub source_panel_id: String,
    pub base_size: String,
    pub sizes: Vec<NativeSizeIndustrialProof>,
    pub manufacturer_approved: bool,
    pub paired_sewing_verified: bool,
}

fn pair(point: DVec2) -> [f64; 2] { [point.x, point.y] }

fn station(samples: &[DVec2], fraction: f64) -> Result<(DVec2, DVec2, f64), String> {
    if !fraction.is_finite() || !(0.0..=1.0).contains(&fraction) {
        return Err("Invalid physical boundary station".into());
    }
    let distances: Vec<f64> = samples.windows(2).map(|w| w[0].distance(w[1])).collect();
    if distances.is_empty() || distances.iter().any(|d| !d.is_finite() || *d <= GEOMETRIC_EPS) {
        return Err("Degenerate sampled boundary segment".into());
    }
    let total: f64 = distances.iter().sum();
    if !total.is_finite() || total <= GEOMETRIC_EPS || total > 100. {
        return Err("Unsafe physical seam arclength".into());
    }
    let required = total * fraction;
    let mut traveled = 0.0;
    for (i, span) in distances.iter().enumerate() {
        if traveled + span >= required - 1e-12 || i + 1 == distances.len() {
            let t = ((required - traveled) / span).clamp(0., 1.);
            let tangent = (samples[i + 1] - samples[i]) / span;
            return Ok((samples[i].lerp(samples[i + 1], t), DVec2::new(tangent.y, -tangent.x), total));
        }
        traveled += span;
    }
    Err("Physical station could not be resolved".into())
}

fn physical_edge(poly: &PolygonPattern, index: usize) -> Result<NativeEdgeIndustrialProof, String> {
    let edge_id = poly.edges.get(index).ok_or("Missing named boundary")?.clone();
    let samples = poly.edge_points(index)?;
    if samples.iter().any(|p| !p.is_finite()) {
        return Err(format!("Nonfinite sampled geometry on {edge_id}"));
    }
    let (_, _, total) = station(&samples, 0.5)?;
    let allowance = poly.seam_allowances.get(&edge_id).copied();
    let alignment = if let Some(width) = allowance {
        if !width.is_finite() || !(0.0..=0.5).contains(&width) || width <= 0. {
            return Err(format!("Invalid seam allowance on {edge_id}"));
        }
        let guide = poly.allowance_guide(&edge_id)?.ok_or("Missing allowance guide")?;
        if guide.len() != samples.len() { return Err("Allowance guide topology mismatch".into()); }
        let mut min = 1.0_f64;
        for (i, (stitch, offset)) in samples.iter().zip(&guide).enumerate() {
            let chord = if i == 0 { samples[1] - samples[0] }
                else if i + 1 == samples.len() { samples[i] - samples[i - 1] }
                else { samples[i + 1] - samples[i - 1] };
            if !chord.is_finite() || chord.length_squared() <= 1e-20 {
                return Err(format!("Degenerate allowance normal on {edge_id}"));
            }
            let normal = DVec2::new(chord.y, -chord.x).normalize();
            let delta = *offset - *stitch;
            if !delta.is_finite() || (delta.length() - width).abs() > 1e-8 {
                return Err(format!("Allowance offset does not preserve width on {edge_id}"));
            }
            let dot = delta.normalize().dot(normal);
            if !dot.is_finite() || dot < 1. - 1e-8 {
                return Err(format!("Allowance normal changes direction on {edge_id}"));
            }
            min = min.min(dot);
        }
        Some(min)
    } else { None };
    let mut notches = vec![];
    let mut previous = 0.0;
    for (index, notch) in poly.notches.get(&edge_id).into_iter().flatten().enumerate() {
        if !notch.t.is_finite() || notch.t <= previous || notch.t >= 1.
            || !notch.depth_m.is_finite() || notch.depth_m <= 0.
            || notch.depth_m > 0.2 {
            return Err(format!("Invalid, unordered or unsafe notch on {edge_id}"));
        }
        let (position, normal, _) = station(&samples, notch.t)?;
        let [actual_start, actual_end] = poly.notch_segment(&edge_id, notch)?;
        let expected_end = position + normal * notch.depth_m;
        if position.distance(actual_start) > 1e-8 || actual_end.distance(expected_end) > 1e-8 {
            return Err(format!("Native notch differs from sampled physical station on {edge_id}"));
        }
        if notch.t * total <= 1e-6 || (1. - notch.t) * total <= 1e-6 {
            return Err(format!("Notch station touches endpoint on {edge_id}"));
        }
        notches.push(NativeNotchStationProof {
            index, fraction: notch.t, seam_arclength_m: notch.t * total,
            depth_m: notch.depth_m, stitch_position_m: pair(position),
            outward_normal: pair(normal), marker_end_m: pair(expected_end),
        });
        previous = notch.t;
    }
    let free_curve_point_ids = poly.free_curve_points.get(&edge_id)
        .map(|knots| knots.iter().map(|p| p.id.clone()).collect()).unwrap_or_default();
    Ok(NativeEdgeIndustrialProof {
        edge_id: edge_id.clone(), physical_seam_arclength_m: total,
        cubic_control_points_m: poly.curves.get(&edge_id).map(|points| [pair(points[0]), pair(points[1])]),
        free_curve_point_ids, allowance_m: allowance,
        min_allowance_normal_alignment: alignment, notches,
    })
}

/// Proves industrial metadata geometry for one source-linked native grade run.
/// Sewn templates are accepted ONLY when all six physical sewing intervals,
/// paired notch stations and sewing references pass the independent native
/// sewn-balance audit with no unallocated ease. This does not approve cutting.
/// A fully validated project remains untouched on any failure.
pub fn verify_native_linked_industrial_six_size20261027(
    run: &PersistedGradeRun, active: &GarmentTemplate, panel_id: &str,
) -> Result<NativeIndustrialSixSizeProof, String> {
    if panel_id.is_empty() { return Err("Panel id required".into()); }
    run.validate(active)?;
    let paired_sewing_verified = if active.seams.is_empty() {
        if run.graded_templates.iter().any(|t| !t.seams.is_empty()) {
            return Err("Grade sizes contain unattached sewing metadata".into());
        }
        false
    } else {
        let paired = audit_native_six_size_sewn_balance20261027(run, active)?;
        if paired.ease_review_required || paired.sizes.len() != run.sizes.len() || paired.sizes.iter().any(|size|
            size.seams.len() != active.seams.len() || size.seams.iter().any(|seam|
                seam.requires_ease_review || !seam.mismatch_m.is_finite() || seam.mismatch_m > 1e-5
            )) {
            return Err("Sewn industrial station proof requires every named size's exact paired sewing alignments".into());
        }
        true
    };
    let base = active.panels.iter().find(|p| p.id == panel_id)
        .ok_or("Source panel identity missing")?.polygon.as_ref()
        .ok_or("Native industrial proof requires an authored polygon")?;
    if !base.holes.is_empty() || !base.lines.is_empty() {
        return Err("Internal holes and sewing paths are unsupported industrial attachments".into());
    }
    if base.seam_allowances.is_empty() && base.notches.is_empty() {
        return Err("No industrial allowance or notch metadata to propagate".into());
    }
    let source_edge_ids: BTreeSet<_> = base.edges.iter().collect();
    if base.edges.len() != source_edge_ids.len() {
        return Err("Duplicate authored source edge identities".into());
    }
    let mut sizes = Vec::with_capacity(run.sizes.len());
    for (size, template) in run.sizes.iter().zip(&run.graded_templates) {
        let poly = template.panels.iter().find(|p| p.id == panel_id)
            .ok_or_else(|| format!("Missing authored panel {panel_id} in {size}"))?
            .polygon.as_ref().ok_or("Missing polygon in size run")?;
        if poly.edges != base.edges || poly.vertex_ids != base.vertex_ids
            || poly.free_curve_points.keys().collect::<Vec<_>>() != base.free_curve_points.keys().collect::<Vec<_>>()
            || poly.notches != base.notches || poly.seam_allowances != base.seam_allowances {
            return Err(format!("Industrial metadata/edge identity changed in {size}"));
        }
        let mut edges = Vec::with_capacity(poly.edges.len());
        for index in 0..poly.edges.len() {
            let proof = physical_edge(poly, index).map_err(|e| format!("{size}: {e}"))?;
            let knots: Vec<String> = base.free_curve_points.get(&proof.edge_id)
                .map(|v| v.iter().map(|p| p.id.clone()).collect()).unwrap_or_default();
            if knots != proof.free_curve_point_ids {
                return Err(format!("Authored free curve point IDs changed in {size}"));
            }
            edges.push(proof);
        }
        sizes.push(NativeSizeIndustrialProof { size: size.clone(), panel_id: panel_id.into(), edges });
    }
    Ok(NativeIndustrialSixSizeProof {
        format: if run.schema_version==1 {"exo-native-linked-industrial-six-size-proof.v1"} else {"exo-native-linked-industrial-named-sizes-proof.v2"}.into(),
        source_panel_id: panel_id.into(), base_size: run.base_size.clone(),
        sizes, manufacturer_approved: false, paired_sewing_verified,
    })
}

/// A disposable authored candidate with a full per-size physical station proof.
/// Nothing in this structure commits to a session, a factory cutline or a sewn seam.
#[derive(Clone, Debug)]
pub struct NativeLinkedIndustrialRegenerationCandidate {
    pub new_base_template: GarmentTemplate,
    pub new_grade_run: PersistedGradeRun,
    pub proof: NativeIndustrialSixSizeProof,
}

/// Regenerate the target polygon's six graded geometries from a revised base.
/// The old size-specific point offsets are retained exactly. The new curve
/// controls are authored in the new base and are graded by endpoint-offset
/// blending, as enforced by `PersistedGradeRun::validate`.
pub fn preview_native_linked_industrial_regeneration20261027(
    old_run: &PersistedGradeRun,
    old_base: &GarmentTemplate,
    new_base: &GarmentTemplate,
    panel_id: &str,
) -> Result<NativeLinkedIndustrialRegenerationCandidate, String> {
    // Inspect existing geometry first, including physical industrial attachments.
    verify_native_linked_industrial_six_size20261027(old_run, old_base, panel_id)?;
    if !new_base.seams.is_empty() {
        return Err("Sewing attachment unsupported: paired sewing alignment must be verified".into());
    }
    let metadata = |template: &GarmentTemplate| -> Result<serde_json::Value, String> {
        let mut encoded = serde_json::to_value(template).map_err(|e| e.to_string())?;
        let panels = encoded.get_mut("panels").and_then(serde_json::Value::as_array_mut)
            .ok_or("Invalid authored template panels")?;
        for panel in panels {
            let Some(polygon) = panel.get_mut("polygon").and_then(serde_json::Value::as_object_mut) else {
                continue;
            };
            polygon.remove("points");
            polygon.remove("curves");
            polygon.remove("free_curve_points");
        }
        Ok(encoded)
    };
    if metadata(old_base)? != metadata(new_base)? {
        return Err("Revised base changes industrial attachments or nongeometry metadata".into());
    }
    let old_panel = old_base.panels.iter().find(|p| p.id == panel_id)
        .ok_or("Source panel missing")?.polygon.as_ref().ok_or("Source polygon missing")?;
    let new_panel = new_base.panels.iter().find(|p| p.id == panel_id)
        .ok_or("Revised panel missing")?.polygon.as_ref().ok_or("Revised polygon missing")?;
    if old_panel.edges != new_panel.edges || old_panel.points.len() != new_panel.points.len()
        || old_panel.curves.keys().ne(new_panel.curves.keys())
        || old_panel.free_curve_points.keys().ne(new_panel.free_curve_points.keys()) {
        return Err("Curve or boundary topology changed".into());
    }
    // This dedicated candidate applies a single explicitly named panel edit.
    // Reject coordinate changes to other panels instead of silently dropping them.
    for (previous, revised) in old_base.panels.iter().zip(&new_base.panels) {
        if previous.id != revised.id { return Err("Panel ordering changed".into()); }
        if previous.id != panel_id && serde_json::to_value(previous).map_err(|e| e.to_string())?
            != serde_json::to_value(revised).map_err(|e| e.to_string())? {
            return Err("Revision changes an unselected panel".into());
        }
    }
    for (edge, old_knots) in &old_panel.free_curve_points {
        let updated = new_panel.free_curve_points.get(edge).ok_or("Missing authored curve knots")?;
        if old_knots.len() != updated.len() {
            return Err("Free curve point topology changed".into());
        }
        for (old, new) in old_knots.iter().zip(updated) {
            if old.id != new.id || old.t != new.t || old.mirror_group != new.mirror_group {
                return Err("Authored free curve knot identity changed".into());
            }
        }
    }
    let mut run = old_run.clone();
    run.base_template = new_base.clone();
    for (index, template) in run.graded_templates.iter_mut().enumerate() {
        let old_grade = old_run.graded_templates[index].panels.iter().find(|p| p.id == panel_id)
            .ok_or("Old size panel missing")?.polygon.as_ref().ok_or("Old size polygon missing")?;
        let mut candidate = new_panel.clone();
        for (point, (old_point, graded_point)) in candidate.points.iter_mut()
            .zip(old_panel.points.iter().zip(&old_grade.points)) {
            *point += *graded_point - *old_point;
            if !point.is_finite() { return Err("Regenerated point is nonfinite".into()); }
        }
        for (edge_index, edge_id) in candidate.edges.iter().enumerate() {
            let start = candidate.points[edge_index] - new_panel.points[edge_index];
            let next = (edge_index + 1) % candidate.points.len();
            let end = candidate.points[next] - new_panel.points[next];
            if let Some(controls) = candidate.curves.get_mut(edge_id) {
                controls[0] += (start * 2. + end) / 3.;
                controls[1] += (start + end * 2.) / 3.;
            }
            if let Some(knots) = candidate.free_curve_points.get_mut(edge_id) {
                for knot in knots {
                    let blend = start * (1. - knot.t) + end * knot.t;
                    knot.position += blend;
                    let slope = end - start;
                    for derivative in [&mut knot.derivative, &mut knot.derivative_in, &mut knot.derivative_out] {
                        if let Some(value) = derivative { *value += slope; }
                    }
                }
            }
        }
        let polygon = template.panels.iter_mut().find(|p| p.id == panel_id)
            .ok_or("Size panel missing")?.polygon.as_mut().ok_or("Size polygon missing")?;
        *polygon = candidate;
    }
    // Base size must contain the exact revised authored geometry.
    run.validate(new_base)?;
    let proof = verify_native_linked_industrial_six_size20261027(&run, new_base, panel_id)?;
    Ok(NativeLinkedIndustrialRegenerationCandidate {
        new_base_template: new_base.clone(), new_grade_run: run, proof,
    })
}

/// Read-only length and authored station audit. Ease is never silently accepted:
/// unequal intervals with `allow_ease` are returned as review-required.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSewnSideProof {
    pub panel_id: String,
    pub edge_id: String,
    pub interval: [f64; 2],
    pub reversed: bool,
    pub full_sewline_m: f64,
    pub sewn_interval_m: f64,
    pub cubic_controls_m: Option<[[f64; 2]; 2]>,
    pub free_curve_point_ids: Vec<String>,
    pub notch_positions_m: Vec<[f64; 2]>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSewnSeamProof {
    pub seam_id: String,
    pub a: NativeSewnSideProof,
    pub b: NativeSewnSideProof,
    pub allow_ease: bool,
    pub notch_interval_lengths_m: Vec<[f64; 2]>,
    pub mismatch_m: f64,
    pub requires_ease_review: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSewnSizeAudit {
    pub size: String,
    pub seams: Vec<NativeSewnSeamProof>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSixSizeSewnAudit {
    pub format: String,
    pub sizes: Vec<NativeSewnSizeAudit>,
    pub ease_review_required: bool,
    pub factory_approved: bool,
    pub joined_curve_mutation: bool,
}

fn sewn_side(template: &GarmentTemplate, reference: &BoundaryRef, reversed: bool)
    -> Result<NativeSewnSideProof, String>
{
    let edge = reference.edge.as_deref().ok_or("Sewing requires named polygon edge reference")?;
    let panel = template.panels.iter().find(|p| p.id == reference.panel)
        .ok_or("Sewing references unknown panel")?;
    let poly = panel.polygon.as_ref().ok_or("Sewing requires authored polygon")?;
    let index = poly.edges.iter().position(|name| name == edge)
        .ok_or("Sewing references unknown named edge")?;
    let [start,end] = reference.range;
    if !start.is_finite() || !end.is_finite() || start < 0. || end > 1.
        || end - start <= 1e-9 { return Err("Invalid sewing interval".into()); }
    let sampled = poly.edge_points(index)?;
    let (_, _, total) = station(&sampled, 0.5)?;
    let sewn = total * (end - start);
    let mut positions = Vec::new();
    for notch in poly.notches.get(edge).into_iter().flatten() {
        if notch.t > start + 1e-9 && notch.t < end - 1e-9 {
            let (point,_,_) = station(&sampled,notch.t)?;
            positions.push(pair(point));
        }
    }
    Ok(NativeSewnSideProof {
        panel_id: reference.panel.clone(),edge_id:edge.into(),interval:reference.range,
        reversed,full_sewline_m:total,sewn_interval_m:sewn,
        cubic_controls_m:poly.curves.get(edge).map(|c|[pair(c[0]),pair(c[1])]),
        free_curve_point_ids:poly.free_curve_points.get(edge).map(|p|p.iter().map(|k|k.id.clone()).collect()).unwrap_or_default(),
        notch_positions_m:positions,
    })
}

fn sewn_seam(template:&GarmentTemplate, seam:&SeamSpec) -> Result<NativeSewnSeamProof,String> {
    const TOLERANCE_M: f64 = 1e-5; // Matches the native compiled-seam sampling tolerance.
    if !seam.stiffness.is_finite() || seam.stiffness <= 0. {
        return Err(format!("Seam {} has invalid stiffness",seam.id));
    }
    let a = sewn_side(template,&seam.a,false)?;
    let b = sewn_side(template,&seam.b,seam.reverse_b)?;
    // Authored edge notches are physical arclength stations. When present in
    // a sewn interval, each must have an explicit ordered seam correspondence.
    let stations = |reference:&BoundaryRef, reverse:bool| -> Result<Vec<f64>,String> {
        let panel=template.panels.iter().find(|p|p.id==reference.panel)
            .ok_or("Notch references missing panel")?;
        let poly=panel.polygon.as_ref().ok_or("Notch references missing polygon")?;
        let edge=reference.edge.as_deref().ok_or("Notch reference missing named edge")?;
        let mut values=Vec::new();
        for notch in poly.notches.get(edge).into_iter().flatten() {
            if !notch.t.is_finite() || notch.t<=0. || notch.t>=1. {
                return Err("Invalid authored physical notch station".into());
            }
            if notch.t>reference.range[0]+1e-9 && notch.t<reference.range[1]-1e-9 {
                let fraction=(notch.t-reference.range[0])/(reference.range[1]-reference.range[0]);
                values.push(if reverse {1.-fraction} else {fraction});
            }
        }
        values.sort_by(f64::total_cmp);
        Ok(values)
    };
    let authored_a=stations(&seam.a,false)?;
    let authored_b=stations(&seam.b,seam.reverse_b)?;
    let authored_match = |actual:&[f64], paired:Vec<f64>| {
        actual.len()==paired.len() && actual.iter().zip(paired)
            .all(|(first,second)|(*first-second).abs()<=1e-6)
    };
    if !authored_a.is_empty() || !authored_b.is_empty() {
        if !authored_match(&authored_a,seam.notches.iter().map(|n|n[0]).collect())
            || !authored_match(&authored_b,seam.notches.iter().map(|n|n[1]).collect()) {
            return Err(format!("Seam {} physical authored notches lack matching sewn correspondences",seam.id));
        }
    }
    let mut intervals = Vec::with_capacity(seam.notches.len()+1);
    let mut prior = [0.,0.];
    let mut review = false;
    for notch in seam.notches.iter().copied().chain(std::iter::once([1.,1.])) {
        if notch.iter().any(|v|!v.is_finite() || *v <= 0. || *v > 1.)
            || notch[0] <= prior[0]+1e-9 || notch[1] <= prior[1]+1e-9 {
            return Err(format!("Seam {} has invalid physical notch correspondence",seam.id));
        }
        let pair = [(notch[0]-prior[0])*a.sewn_interval_m,
            (notch[1]-prior[1])*b.sewn_interval_m];
        if (pair[0]-pair[1]).abs()>TOLERANCE_M {
            if !seam.allow_ease {
                return Err(format!("Seam {} unequal sewn notch intervals without ease",seam.id));
            }
            review = true;
        }
        intervals.push(pair);
        prior=notch;
    }
    let mismatch=(a.sewn_interval_m-b.sewn_interval_m).abs();
    if mismatch>TOLERANCE_M {
        if !seam.allow_ease { return Err(format!("Seam {} unequal sewn lengths without ease",seam.id)); }
        review=true;
    }
    Ok(NativeSewnSeamProof {seam_id:seam.id.clone(),a,b,allow_ease:seam.allow_ease,
        notch_interval_lengths_m:intervals,mismatch_m:mismatch,requires_ease_review:review})
}

/// Check actual persisted six-size seam references against sampled physical
/// material contours. This does not generate sewing or industrial cut geometry.
pub fn audit_native_six_size_sewn_balance20261027(
    run:&PersistedGradeRun,active:&GarmentTemplate,
) -> Result<NativeSixSizeSewnAudit,String> {
    run.validate(active)?;
    if active.seams.is_empty() {return Err("No authored sewn seams to audit".into());}
    let mut sizes=Vec::with_capacity(run.sizes.len());
    let mut review=false;
    for (size,template) in run.sizes.iter().zip(&run.graded_templates) {
        let mut seams=Vec::with_capacity(template.seams.len());
        for seam in &template.seams {
            let verified=sewn_seam(template,seam).map_err(|e|format!("Size {size}: {e}"))?;
            review |=verified.requires_ease_review;
            seams.push(verified);
        }
        sizes.push(NativeSewnSizeAudit {size:size.clone(),seams});
    }
    Ok(NativeSixSizeSewnAudit {format:if run.schema_version==1 {"exo-native-six-size-sewn-balance-audit.v1"} else {"exo-native-named-size-sewn-balance-audit.v2"}.into(),
        sizes,ease_review_required:review,factory_approved:false,joined_curve_mutation:false})
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn named_size_v2_verifies_real_physical_stations_and_rejects_missing_features() {
        let (active, mut run) = fixture(true);
        run.schema_version = 2;
        run.sizes = ["2", "4", "6", "8"].iter().map(|s| s.to_string()).collect();
        run.base_size = "6".into();
        run.graded_templates = vec![active.clone(); 4];
        run.size_correspondence.insert("US12".into(), "8".into());
        let proof = verify_native_linked_industrial_six_size20261027(&run, &active, "front").unwrap();
        assert_eq!(proof.format, "exo-native-linked-industrial-named-sizes-proof.v2");
        assert_eq!(proof.sizes.len(), 4);
        assert!(proof.sizes.iter().all(|size| size.edges.iter().any(|edge|
            edge.allowance_m.is_some() || !edge.notches.is_empty())));
        assert!(!proof.manufacturer_approved);
        let mut forged = run.clone();
        forged.graded_templates[3].panels.iter_mut().find(|p| p.id=="front").unwrap()
            .polygon.as_mut().unwrap().notches.clear();
        assert!(verify_native_linked_industrial_six_size20261027(&forged, &active, "front").is_err());
        let mut missing = run.clone();
        missing.graded_templates.pop();
        assert!(verify_native_linked_industrial_six_size20261027(&missing, &active, "front").is_err());
    }
    use crate::garment::polygon::EdgeNotch;
    use crate::garment::shapes::{primitive, Primitive};
    use crate::garment::meshing::MeshingSettings;

    fn fixture(curved: bool) -> (GarmentTemplate, PersistedGradeRun) {
        let mut template = crate::garment::presets::basic(crate::garment::presets::GarmentKind::Tshirt, 0);
        template.seams.clear();
        let panel = template.panels.iter_mut().find(|p| p.id == "front").unwrap();
        let mut p = primitive(Primitive::Rectangle, DVec2::new(0.5, 0.7), 0., MeshingSettings::default()).unwrap();
        for point in &mut p.points { point.x += 0.03; point.y += 0.06; }
        p.edges = vec!["neck".into(), "side".into(), "hem".into(), "fold".into()];
        p.vertex_ids.insert("neck".into(), "corner_A".into());
        p.seam_allowances.insert("neck".into(), 0.012);
        p.notches.insert("neck".into(), vec![EdgeNotch {t:0.25, depth_m:0.004}, EdgeNotch {t:0.7, depth_m:0.004}]);
        if curved { p.curves.insert("neck".into(), [DVec2::new(0.19, 0.03), DVec2::new(0.35, 0.03)]); }
        panel.polygon = Some(p.clone());
        panel.pattern.width = 0.65;
        panel.pattern.height = 0.85;
        let mut templates = vec![template.clone();6];
        for (index, graded) in templates.iter_mut().enumerate() {
            if index == 2 { continue }
            let shape = graded.panels.iter_mut().find(|p| p.id == "front").unwrap().polygon.as_mut().unwrap();
            let start_delta = DVec2::new((index as f64 - 2.) * 0.002, 0.);
            let end_delta = DVec2::new((index as f64 - 2.) * 0.004, 0.);
            shape.points[0] += start_delta;
            shape.points[1] += end_delta;
            if let Some(controls) = shape.curves.get_mut("neck") {
                controls[0] += (start_delta * 2. + end_delta) / 3.;
                controls[1] += (start_delta + end_delta * 2.) / 3.;
            }
        }
        let run = PersistedGradeRun {schema_version:1,
            sizes:EXPECTED.iter().map(|s|s.to_string()).collect(), base_size:"M".into(),
            base_template:template.clone(), graded_templates:templates,size_correspondence: Default::default(), pom_specs:vec![]};
        (template,run)
    }

    #[test]
    fn proves_exact_six_size_curves_notches_and_normals() {
        let (active, run) = fixture(true);
        let proof = verify_native_linked_industrial_six_size20261027(&run, &active,"front").unwrap();
        assert_eq!(proof.sizes.len(), 6);
        assert_eq!(proof.sizes.iter().map(|s|s.size.as_str()).collect::<Vec<_>>(), EXPECTED);
        for size in &proof.sizes {
            let edge = &size.edges[0];
            assert_eq!(edge.edge_id, "neck");
            assert!(edge.cubic_control_points_m.is_some());
            assert_eq!(edge.notches.len(), 2);
            assert!((edge.notches[0].seam_arclength_m / edge.physical_seam_arclength_m - 0.25).abs()<1e-12);
            assert!(edge.min_allowance_normal_alignment.unwrap()>0.999999);
        }
        assert!(!proof.manufacturer_approved && !proof.paired_sewing_verified);
    }

    #[test]
    fn proves_straight_station_positions_and_width() {
        let (active, run) = fixture(false);
        let proof = verify_native_linked_industrial_six_size20261027(&run,&active,"front").unwrap();
        let edge = &proof.sizes[2].edges[0];
        assert!((edge.physical_seam_arclength_m - 0.5).abs()<1e-10);
        assert!((edge.notches[0].stitch_position_m[0] - 0.155).abs()<1e-10);
        assert_eq!(edge.allowance_m, Some(0.012));
    }

    #[test]
    fn rejects_stale_curve_control_and_grade_metadata() {
        let (active, mut run) = fixture(true);
        run.graded_templates[0].panels[0].polygon.as_mut().unwrap()
            .curves.get_mut("neck").unwrap()[0].x += 0.01;
        assert!(verify_native_linked_industrial_six_size20261027(&run,&active,"front").is_err());
        let (_, mut run) = fixture(true);
        run.graded_templates[1].panels[0].polygon.as_mut().unwrap()
            .seam_allowances.insert("neck".into(),0.02);
        assert!(verify_native_linked_industrial_six_size20261027(&run,&active,"front").is_err());
    }

    #[test]
    fn rejects_unsafe_notch_and_missing_size() {
        let (mut active, mut run) = fixture(false);
        active.panels[0].polygon.as_mut().unwrap().notches.get_mut("neck").unwrap()[0].t = 1e-9;
        run.base_template = active.clone();
        for t in &mut run.graded_templates {t.panels[0].polygon.as_mut().unwrap().notches.get_mut("neck").unwrap()[0].t = 1e-9;}
        assert!(verify_native_linked_industrial_six_size20261027(&run,&active,"front").is_err());
        let (active, mut run) = fixture(false);
        run.sizes[5] = "XXXL".into();
        assert!(verify_native_linked_industrial_six_size20261027(&run,&active,"front").is_err());
    }

    #[test]
    fn rejects_unresolved_sewing_attachment_references() {
        let (mut active, mut run) = fixture(false);
        let seam = crate::garment::presets::basic(crate::garment::presets::GarmentKind::Tshirt,0).seams[0].clone();
        active.seams.push(seam.clone());
        run.base_template.seams.push(seam.clone());
        for t in &mut run.graded_templates { t.seams.push(seam.clone()); }
        let error = verify_native_linked_industrial_six_size20261027(&run,&active,"front").unwrap_err();
        assert!(!error.is_empty(), "Incomplete sewing must never be treated as paired")
    }

    #[test]
    fn regenerates_curved_industrial_six_sizes_with_exact_offsets() {
        let (source, run) = fixture(true);
        let mut revised = source.clone();
        let polygon = revised.panels[0].polygon.as_mut().unwrap();
        polygon.points[0].x += 0.006;
        polygon.points[1].x += 0.008;
        let handles = polygon.curves.get_mut("neck").unwrap();
        handles[0].y -= 0.006;
        handles[1].y -= 0.004;
        let polygon = polygon.clone();
        let handles = polygon.curves["neck"];
        let candidate = preview_native_linked_industrial_regeneration20261027(
            &run, &source, &revised, "front").unwrap();
        assert_eq!(candidate.proof.sizes.len(), 6);
        assert_eq!(candidate.proof.sizes[2].edges[0].allowance_m, Some(0.012));
        for (index, template) in candidate.new_grade_run.graded_templates.iter().enumerate() {
            let shape = template.panels[0].polygon.as_ref().unwrap();
            let old = run.graded_templates[index].panels[0].polygon.as_ref().unwrap();
            let old_base = source.panels[0].polygon.as_ref().unwrap();
            for point in 0..shape.points.len() {
                let delta = shape.points[point] - polygon.points[point];
                assert!((delta - (old.points[point] - old_base.points[point])).length()<1e-10);
            }
            assert_eq!(shape.notches, polygon.notches);
            assert_eq!(shape.seam_allowances, polygon.seam_allowances);
            let start = shape.points[0] - polygon.points[0];
            let end = shape.points[1] - polygon.points[1];
            let graded = shape.curves["neck"];
            assert!((graded[0] - (handles[0] + (start * 2. + end)/3.)).length()<1e-10);
            assert!((graded[1] - (handles[1] + (start + end * 2.)/3.)).length()<1e-10);
        }
        assert!(!candidate.proof.manufacturer_approved);
    }

    #[test]
    fn refuses_curve_inventory_or_industrial_metadata_changes() {
        let (source, run) = fixture(true);
        let mut changed_curve = source.clone();
        changed_curve.panels[0].polygon.as_mut().unwrap().curves.clear();
        assert!(preview_native_linked_industrial_regeneration20261027(
            &run,&source,&changed_curve,"front").is_err());
        let mut changed_notch = source.clone();
        changed_notch.panels[0].polygon.as_mut().unwrap().notches.get_mut("neck").unwrap()[0].t = 0.3;
        assert!(preview_native_linked_industrial_regeneration20261027(
            &run,&source,&changed_notch,"front").is_err());
        let mut changed_sewing = source.clone();
        changed_sewing.seams.push(crate::garment::presets::basic(
            crate::garment::presets::GarmentKind::Tshirt,0).seams[0].clone());
        assert!(preview_native_linked_industrial_regeneration20261027(
            &run,&source,&changed_sewing,"front").is_err());
    }

    fn sewn_fixture(curved:bool,ease:bool) -> (GarmentTemplate,PersistedGradeRun) {
        let (mut active,_) = fixture(curved);
        let front=active.panels[0].polygon.as_ref().unwrap().clone();
        active.panels[1].polygon=Some(front);
        active.panels[1].pattern.width=active.panels[0].pattern.width;
        active.panels[1].pattern.height=active.panels[0].pattern.height;
        let mut seam=crate::garment::presets::basic(
            crate::garment::presets::GarmentKind::Tshirt,0).seams[0].clone();
        seam.id="joined-neck".into();
        seam.a.panel="front".into();
        seam.a.edge=Some("neck".into());
        seam.b.panel="back".into();
        seam.b.edge=Some("neck".into());
        seam.a.range=[0.1,0.9];
        seam.b.range=[0.1,0.9];
        seam.reverse_b=true;
        seam.notches=vec![[0.1875,0.1875],[0.75,0.75]];
        active.panels[1].polygon.as_mut().unwrap().notches.remove("neck");
        active.panels[0].polygon.as_mut().unwrap().notches.remove("neck");
        seam.allow_ease=ease;
        active.seams=vec![seam];
        let mut grades=vec![active.clone();6];
        for (i,graded) in grades.iter_mut().enumerate() {
            if i==2 {continue;}
            let shift=DVec2::new((i as f64-2.)*0.001,0.);
            for panel in &mut graded.panels {
                let poly=panel.polygon.as_mut().unwrap();
                for point in &mut poly.points {*point+=shift;}
                for handles in poly.curves.values_mut() {for point in handles {*point+=shift;}}
            }
        }
        let run=PersistedGradeRun {schema_version:1,sizes:EXPECTED.iter().map(|s|s.to_string()).collect(),
            base_size:"M".into(),base_template:active.clone(),graded_templates:grades,size_correspondence: Default::default(), pom_specs:vec![]};
        (active,run)
    }

    #[test]
    fn sewn_audit_accepts_straight_and_curved_two_piece_six_sizes() {
        for curved in [false,true] {
            let (active,run)=sewn_fixture(curved,false);
            let report=audit_native_six_size_sewn_balance20261027(&run,&active).unwrap();
            assert_eq!(report.sizes.len(),6);
            assert!(!report.ease_review_required);
            for size in &report.sizes {
                let seam=&size.seams[0];
                assert_eq!(seam.a.panel_id,"front");
                assert_eq!(seam.b.panel_id,"back");
                assert!(seam.b.reversed);
                assert!(seam.mismatch_m<1e-9);
                assert_eq!(seam.notch_interval_lengths_m.len(),3);
                assert_eq!(seam.a.cubic_controls_m.is_some(),curved);
            }
            assert!(!report.factory_approved);
        }
    }

    #[test]
    fn industrial_stations_require_exact_six_size_paired_sewing() {
        for curved in [false,true] {
            let (active,run)=sewn_fixture(curved,false);
            let checked=verify_native_linked_industrial_six_size20261027(&run,&active,"front").unwrap();
            assert_eq!(checked.sizes.len(),6);
            assert!(checked.paired_sewing_verified);
            assert!(!checked.manufacturer_approved);
            assert_eq!(checked.sizes[2].edges[0].allowance_m,Some(0.012));
        }
        let (mut active,mut run)=sewn_fixture(false,false);
        active.seams[0].b.range=[0.1,0.8];
        run.base_template=active.clone();
        for sized in &mut run.graded_templates {sized.seams=active.seams.clone();}
        assert!(verify_native_linked_industrial_six_size20261027(&run,&active,"front").is_err());
        active.seams[0].allow_ease=true;
        run.base_template=active.clone();
        for sized in &mut run.graded_templates {sized.seams=active.seams.clone();}
        assert!(verify_native_linked_industrial_six_size20261027(&run,&active,"front").is_err(),
            "An unallocated physical sewing ease mismatch cannot be industrially accepted");
    }

    #[test]
    fn sewn_audit_rejects_uneased_mismatch_and_reports_explicit_ease() {
        let (mut active,mut run)=sewn_fixture(false,false);
        active.seams[0].b.range=[0.1,0.8];
        active.seams[0].notches=vec![[0.1875,0.1875],[0.75,0.75]];
        run.base_template=active.clone();
        for t in &mut run.graded_templates {t.seams=active.seams.clone();}
        assert!(audit_native_six_size_sewn_balance20261027(&run,&active).is_err());
        active.seams[0].allow_ease=true;
        run.base_template=active.clone();
        for t in &mut run.graded_templates {t.seams=active.seams.clone();}
        let review=audit_native_six_size_sewn_balance20261027(&run,&active).unwrap();
        assert!(review.ease_review_required);
        assert!(review.sizes.iter().all(|s|s.seams[0].requires_ease_review));
    }

    #[test]
    fn sewn_audit_rejects_bad_named_references_and_wrong_size() {
        let (mut active,mut run)=sewn_fixture(true,false);
        active.seams[0].b.edge=Some("missing".into());
        run.base_template=active.clone();
        for t in &mut run.graded_templates {t.seams=active.seams.clone();}
        assert!(audit_native_six_size_sewn_balance20261027(&run,&active).is_err());
        let (active,mut run)=sewn_fixture(true,false);
        run.sizes[4]="XXXL".into();
        assert!(audit_native_six_size_sewn_balance20261027(&run,&active).is_err());
    }
}
