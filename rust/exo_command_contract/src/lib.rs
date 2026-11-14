//! Native grading request contract for EXO's existing `exo-session` bridge.
//! This is a narrowly scoped first step: it does NOT own grading algorithms,
//! response schemas, saved documents, or React presentation. The schema is
//! deliberately aligned with the actual session branches in
//! research/oss/clothcraft/src/bin/exo-session.rs.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Isolated Rust request schema mirroring the existing `exo-session` JSON
/// handlers. Until the native executable imports this crate, it is a checked
/// contract mirror, not a second authoritative runtime. Exported TypeScript
/// is generated into `bindings/` by ts-rs; do not hand-edit it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "op", deny_unknown_fields)]
#[ts(export)]
pub enum ExoGradeCommandV1 {
    #[serde(rename = "grade-run-status")]
    GradeRunStatus { #[ts(type = "number")] revision: u64 },
    #[serde(rename = "grade-run-cutlines")]
    GradeRunCutlines { #[ts(type = "number")] revision: u64 },
    #[serde(rename = "grade-run-activate")]
    GradeRunActivate { #[ts(type = "number")] revision: u64, size: String },
    #[serde(rename = "grade-run-restore")]
    GradeRunRestore { #[ts(type = "number")] revision: u64 },
}

impl ExoGradeCommandV1 {
    /// Browser Number / JSON cannot represent all u64 values losslessly.
    pub fn validate(&self) -> Result<(), &'static str> {
        let (revision, size) = match self {
            Self::GradeRunStatus { revision }
            | Self::GradeRunCutlines { revision }
            | Self::GradeRunRestore { revision } => (*revision, None),
            Self::GradeRunActivate { revision, size } => (*revision, Some(size.as_str())),
        };
        if revision > 9_007_199_254_740_991 {
            return Err("revision cannot be represented exactly in JavaScript");
        }
        if let Some(size) = size {
            if size.is_empty()
                || size.len() > 64
                || size.chars().any(|ch| ch.is_control())
            {
                return Err("size must be a short printable non-empty label");
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn activate_serializes_exact_existing_native_session_shape() {
        let request = ExoGradeCommandV1::GradeRunActivate {
            revision: 7,
            size: "XL".into(),
        };
        request.validate().unwrap();
        assert_eq!(
            serde_json::to_value(&request).unwrap(),
            json!({"op":"grade-run-activate","revision":7,"size":"XL"})
        );
        assert_eq!(
            serde_json::from_value::<ExoGradeCommandV1>(
                json!({"op":"grade-run-activate","revision":7,"size":"XL"})
            )
            .unwrap(),
            request
        );
    }

    #[test]
    fn status_cutline_and_restore_shapes() {
        for (op, request) in [
            ("grade-run-status", ExoGradeCommandV1::GradeRunStatus { revision: 0 }),
            ("grade-run-cutlines", ExoGradeCommandV1::GradeRunCutlines { revision: 0 }),
            ("grade-run-restore", ExoGradeCommandV1::GradeRunRestore { revision: 0 }),
        ] {
            request.validate().unwrap();
            assert_eq!(serde_json::to_value(request).unwrap(), json!({"op":op,"revision":0}));
        }
    }

    #[test]
    fn rejects_extraneous_fields_and_wrong_types() {
        assert!(serde_json::from_value::<ExoGradeCommandV1>(
            json!({"op":"grade-run-activate","revision":7,"size":"XL","unexpected":1})
        ).is_err());
        assert!(serde_json::from_value::<ExoGradeCommandV1>(
            json!({"op":"grade-run-activate","revision":-1,"size":"XL"})
        ).is_err());
        assert!(serde_json::from_value::<ExoGradeCommandV1>(
            json!({"op":"grade-run-no-such-op","revision":0})
        ).is_err());
        assert!(ExoGradeCommandV1::GradeRunActivate {
            revision: 1,
            size: "\u{0000}".into()
        }.validate().is_err());
        assert!(ExoGradeCommandV1::GradeRunStatus {
            revision: 9_007_199_254_740_992
        }.validate().is_err());
    }
}
