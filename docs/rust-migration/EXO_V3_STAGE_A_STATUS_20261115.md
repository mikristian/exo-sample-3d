# EXO V3 41-system React/Rust/ClothCraft conversion status

Date: 2026-11-15; baseline EXO GitHub commit 7a06468f037292fd02161b268ff4a8ef7b61f77c.

Scope: existing active EXO functionality first, keep React unchanged, migrate authoritative backends to Rust/ClothCraft, then gradually migrate UI.

No system is currently marked full per-button Rust parity. Existing Rust code, 2D/3D simulation smokes, and historical source-language percentages are not complete feature-conversion metrics.

The V3 React Hybrid today launches the exact V2 React interface and V2-derived Rust/ClothCraft exo-session. The separate native egui V3 is not yet the same canonical garment backend.

New Expansion source change: native React request hook now dispatches through validated command serializer; 4 JavaScript and 10 Rust command-contract tests passed. This source change has not been installed into the already-running V3 hybrid preview.

Observed static native request calls in ClothCraftWorkspace.jsx: 99 occurrences with 46 distinct literal op names. Dynamic commands and UI events are NOT included, so no total-button count is claimed.

Literal ops: bindings-clear, bindings-grade-regenerate, bindings-grade-regenerate-preview, bindings-store, edit, edit-batch, edit-seam, edit-seam-ends, fabric-grade-envelope-inspect, fabric-grade-envelope-store, facing-dependency-install, facing-dependency-preview, grade-notch-commit, grade-pattern, grade-run-clear, grade-run-commit, grade-run-cutlines, grade-run-industrial-audit, grade-run-pom-audit, grade-run-sewing-balance-audit, grade-run-status, graphics-set, hardware-set, line-spec, open, pattern-audit, pause, piece-variant-clear, piece-variant-instance-activate, piece-variant-instance-preview, piece-variant-instance-restore, piece-variant-store, play, pleat-guides, pose-panel, production-cutlines, recover-off-body, reset, save, select-avatar, set-property, snapshot, step, trace-contour, tuck-fold-sew-batch, undo.

Six-size tee Rust physics remains physically rejected (large seam gap/excess strain); migrated source does not certify garment fit.

| ID | Priority | System | Status |
|---|---|---|---|
| EXO-RUST-037 | P0 | Native Rust engine shared core | PARTIAL_EXISTING_RUST |
| EXO-RUST-001 | P0 | Project model / source-of-truth | BLOCKED_CANONICAL_MODEL |
| EXO-RUST-033 | P0 | API / processes / transport | IN_PROGRESS_TYPED_BRIDGE |
| EXO-RUST-029 | P0 | Persistence / undo / history / restore | PARTIAL_EXISTING_RUST |
| EXO-RUST-003 | P1 | Curves, freehand and geometry | NOT_VERIFIED |
| EXO-RUST-005 | P1 | Parametric references / formulas | NOT_VERIFIED |
| EXO-RUST-007 | P1 | Measurements / POM / body charts | NOT_VERIFIED |
| EXO-RUST-002 | P1 | Drafting primitives and snapping | NOT_VERIFIED |
| EXO-RUST-004 | P1 | Topology / split / unfold / mirror | NOT_VERIFIED |
| EXO-RUST-006 | P1 | Pattern grading / size runs | PARTIAL_EXISTING_RUST |
| EXO-RUST-010 | P1 | Allowance / notch / cutline | PARTIAL_EXISTING_RUST |
| EXO-RUST-008 | P1 | Sewing / seam matching | PARTIAL_EXISTING_RUST |
| EXO-RUST-011 | P1 | Cloth mesh / tessellation | PARTIAL_EXISTING_RUST |
| EXO-RUST-016 | P1 | Fabric mechanics / materials | NOT_VERIFIED |
| EXO-RUST-023 | P1 | DXF / CAD interop | PARTIAL_EXISTING_RUST |
| EXO-RUST-015 | P1 | Avatar / pose / animation | NOT_VERIFIED |
| EXO-RUST-012 | P2 | Cloth physics and solver | RUST_PHYSICAL_FIT_FAIL |
| EXO-RUST-013 | P2 | Collision / contact / penetration | PARTIAL_EXPERIMENTAL |
| EXO-RUST-014 | P2 | Garment fit / stage / drape | PHYSICAL_FIT_BLOCKED |
| EXO-RUST-022 | P2 | Marker layout / nesting / yield | NOT_VERIFIED |
| EXO-RUST-024 | P2 | SVG / PDF / physical plot | NOT_VERIFIED |
| EXO-RUST-025 | P2 | Factory preflight / measurement QA | PARTIAL_EXISTING_RUST |
| EXO-RUST-018 | P2 | Hardware / fastener / trims | NOT_VERIFIED |
| EXO-RUST-027 | P2 | Techpacks / BOM / specification | NOT_VERIFIED |
| EXO-RUST-009 | P2 | Darts / pleats / facings | NOT_VERIFIED |
| EXO-RUST-021 | P2 | 3D export and scene assets | NOT_VERIFIED |
| EXO-RUST-030 | P2 | Libraries / templates / presets | NOT_VERIFIED |
| EXO-RUST-039 | P2 | Workspace commands / tools / preferences | PARTIAL_REACT_RUST_BRIDGE |
| EXO-RUST-031 | P2 | Image digitizing / vision / references | NOT_VERIFIED |
| EXO-RUST-034 | P2 | Collaboration / security / sync | NOT_VERIFIED |
| EXO-RUST-036 | P2 | Native Rust editor / backend UI glue | DEFER_UNTIL_RUST_BACKEND_PASSES |
| EXO-RUST-020 | P3 | Foam / padding / trapunto | NOT_VERIFIED |
| EXO-RUST-017 | P3 | Fabric visuals / textures / PBR | NOT_VERIFIED |
| EXO-RUST-019 | P3 | Garment print graphics / embroidery | NOT_VERIFIED |
| EXO-RUST-026 | P3 | Production packages / factory orders | NOT_VERIFIED |
| EXO-RUST-028 | P3 | Cost / pricing / estimates | NOT_VERIFIED |
| EXO-RUST-032 | P3 | AI assistant / generation / automation | NOT_VERIFIED |
| EXO-RUST-035 | P3 | Diagnostics / performance / misc | NOT_VERIFIED |
| EXO-RUST-038 | P3 | Unclassified JS business logic | NOT_VERIFIED |
| EXO-RUST-040 | P3 | macOS native host / lifecycle | DEFER_UNTIL_RUST_BACKEND_PASSES |
| EXO-RUST-041 | P3 | Other backend source | NOT_VERIFIED |

## Required next gates

1. One authoritative versioned Rust garment document shared by EXO and ClothCraft. Stable piece, seam, grade IDs and units; verified V2 import and cold-open Undo/Redo.
2. Complete per-UI-button inventory and move each actual drafting, grading, sewing, measuring and manufacturing computation to Rust.
3. Test each command via React -> authenticated Rust RPC -> same revised garment/mesh -> save/reopen/Undo/Redo, including malformed and stale input.
4. Validate mesh, real ClothCraft solver and independent factory receiver/physical fit gates separately. Current physical tee fit is a known rejection.
5. Only after Stage A passes, convert React screens incrementally into Rust egui/wgpu views.

Machine-readable status: EXO_V3_41_SYSTEM_RUST_STATUS_20261115.csv. Regenerate: python3 scripts/qa_exo_v3_backend_inventory_20261115.py --write; verify: --check.
