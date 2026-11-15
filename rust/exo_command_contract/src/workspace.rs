//! Stage A: validated schema for React -> authenticated EXO Rust / ClothCraft RPC.
//!
//! The existing native session already implements many handlers. This module
//! provides a strictly scoped, tested contract for the first connected routes.
//! It does not claim all React/V2 JavaScript tools have Rust parity. Only add a
//! route after the actual native handler and an end-to-end button test exist.
use serde_json::Value;

pub const JS_MAX_SAFE_REVISION: u64 = 9_007_199_254_740_991;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NativeRoute {
    Read,
    Edit,
    Simulation,
    Persistence,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CheckedWorkspaceCommand<'a> {
    pub op: &'a str,
    pub revision: Option<u64>,
    pub route: NativeRoute,
}

pub fn known_native_route(op: &str) -> Option<NativeRoute> {
    Some(match op {
        "snapshot" | "grade-run-status" | "grade-run-cutlines" => NativeRoute::Read,
        "open" | "save" => NativeRoute::Persistence,
        "edit" | "edit-batch" | "undo" | "redo" | "set-property"
        | "grade-run-activate" | "grade-run-restore" => NativeRoute::Edit,
        "pause" | "step" | "reset" | "grab" => NativeRoute::Simulation,
        _ => return None,
    })
}

/// The caller supplies the last known Rust revision. The canonical Rust
/// session must independently perform revision CAS and geometric validation.
pub fn check_native_workspace_command<'a>(
    request: &'a Value,
    expected_revision: Option<u64>,
) -> Result<CheckedWorkspaceCommand<'a>, String> {
    let map = request
        .as_object()
        .ok_or("Native workspace command must be a JSON object")?;
    let op = map
        .get("op")
        .and_then(Value::as_str)
        .ok_or("Native workspace command must include a string op")?;
    if op.is_empty()
        || op.len() > 81
        || !op.as_bytes()[0].is_ascii_lowercase()
        || !op.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-'
        })
    {
        return Err("Malformed native workspace operation".into());
    }
    let route = known_native_route(op).ok_or_else(|| {
        format!("Native operation {op:?} is not yet in the verified contract")
    })?;
    let revision = match map.get("revision") {
        None => None,
        Some(value) => {
            let revision = value
                .as_u64()
                .ok_or("Native workspace revision must be an unsigned integer")?;
            if revision > JS_MAX_SAFE_REVISION {
                return Err("Native workspace revision exceeds JavaScript safe integer".into());
            }
            Some(revision)
        }
    };
    if !matches!(op, "snapshot" | "save" | "pause" | "open") {
        if let Some(expected) = expected_revision {
            if expected > JS_MAX_SAFE_REVISION {
                return Err("Expected Rust revision exceeds JavaScript safe integer".into());
            }
            if let Some(actual) = revision {
                if actual != expected {
                    return Err("Stale document revision; reload current Rust snapshot".into());
                }
            }
        }
        if revision.is_none() {
            return Err("Versioned native command requires a Rust revision".into());
        }
    }
    match op {
        "edit" => {
            if !map.get("command").is_some_and(Value::is_object) {
                return Err("Rust edit must provide a command object".into());
            }
        }
        "edit-batch" => {
            let cmds = map
                .get("commands")
                .and_then(Value::as_array)
                .ok_or("Rust edit-batch must provide commands")?;
            if cmds.is_empty() || cmds.len() > 256 || !cmds.iter().all(Value::is_object) {
                return Err("Rust edit-batch must have 1–256 command objects".into());
            }
        }
        "grade-run-activate" => {
            let size = map
                .get("size")
                .and_then(Value::as_str)
                .ok_or("Graded size must be a string")?;
            if size.is_empty() || size.len() > 64 || size.chars().any(char::is_control) {
                return Err("Graded size is not a valid printable 1–64 byte label".into());
            }
        }
        _ => {}
    }
    Ok(CheckedWorkspaceCommand { op, revision, route })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn native_snapshot_and_save_require_no_revision() {
        for op in ["snapshot", "save", "pause", "open"] {
            let packet = json!({"op":op});
            let result = check_native_workspace_command(&packet, None).unwrap();
            assert_eq!(result.op, op);
            assert!(result.revision.is_none());
        }
        let stale_snapshot = json!({"op":"snapshot","revision":1});
        assert!(check_native_workspace_command(&stale_snapshot, Some(2)).is_ok());
    }

    #[test]
    fn authenticated_edit_grade_and_sew_commands_keep_revision() {
        for packet in [
            json!({"op":"edit","revision":6,"command":{"kind":"MovePoint","point":0}}),
            json!({"op":"edit-batch","revision":6,"commands":[{"kind":"BoardTransform"}]}),
            json!({"op":"undo","revision":6}),
            json!({"op":"redo","revision":6}),
            json!({"op":"set-property","revision":6,"target":"fabric","field":"name","value":"Cotton"}),
            json!({"op":"grade-run-activate","revision":6,"size":"XXL"}),
            json!({"op":"grade-run-restore","revision":6}),
        ] {
            let validated = check_native_workspace_command(&packet, Some(6)).unwrap();
            assert_eq!(validated.route, NativeRoute::Edit);
            assert_eq!(validated.revision, Some(6));
        }
    }

    #[test]
    fn rejects_unsafe_revisions_and_stale_edits() {
        for request in [
            json!({"op":"undo","revision":-1}),
            json!({"op":"undo","revision":1.5}),
            json!({"op":"undo","revision":JS_MAX_SAFE_REVISION+1}),
            json!({"op":"undo","revision":"1"}),
            json!({"op":"undo"}),
        ] {
            assert!(check_native_workspace_command(&request, Some(0)).is_err());
        }
        assert!(check_native_workspace_command(
            &json!({"op":"undo","revision":7}),Some(6)
        ).unwrap_err().contains("Stale"));
    }

    #[test]
    fn rejects_unknown_or_deceptively_named_commands() {
        for op in ["../workspace", "evil_command", "grade-run-not-yet-ported", "", "EDIT"] {
            assert!(check_native_workspace_command(
                &json!({"op":op,"revision":0}),Some(0)
            ).is_err());
        }
        assert!(check_native_workspace_command(&json!([]),None).is_err());
    }

    #[test]
    fn refuses_invalid_bulk_edits_and_grading_labels() {
        assert!(check_native_workspace_command(
            &json!({"op":"edit","revision":0,"command":null}),Some(0)
        ).is_err());
        assert!(check_native_workspace_command(
            &json!({"op":"edit-batch","revision":0,"commands":[]}),Some(0)
        ).is_err());
        for label in ["", "XL\u{0000}", "ABCDEFGHIJKLMNOPQRSTUVWXYABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ"] {
            assert!(check_native_workspace_command(
                &json!({"op":"grade-run-activate","revision":0,"size":label}),Some(0)
            ).is_err());
        }
    }

    #[test]
    fn classifies_native_simulation_separately_from_editing() {
        assert_eq!(known_native_route("open"), Some(NativeRoute::Persistence));
        assert_eq!(known_native_route("save"), Some(NativeRoute::Persistence));
        for op in ["step", "reset", "grab"] {
            assert_eq!(known_native_route(op), Some(NativeRoute::Simulation));
        }
        assert_eq!(known_native_route("topology-snapshot-only-in-js"),None);
    }
}
