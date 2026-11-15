# Read-only engineering findings and migration blockers

**Review baseline:** EXO GitHub `985bc9a8e5031a9fa02666a44390802aff8e04ce`. This note was assembled from public, committed source and older EXO QA records; **no new builds, GPU experiments, physical garment tests or upstream claims were run** to establish the findings below. Existing QA records are dated and cannot be silently promoted to a new commit's acceptance.

## Confirmed architecture boundaries

| Area | Current public source evidence | Migration implication |
|---|---|---|
| AppKit/WKWebView desktop | `integrations/clothcraft/macos/EXOClothCraftWorkspaceV2.swift` launches a local web/UI bridge and checks runtime provenance. | Keep Swift lifecycle/auth/file dialogs operational while Rust engineering commands migrate. A Rust egui shell is a later optional parity project. |
| React/Three.js presentation | `src/App.jsx`, `src/components/ClothCraftWorkspace.jsx`, `src/components/ClothCraftSceneV2.jsx` render/edit and preview the app. | Leave styling, direct manipulation and rendering on JS until a verified Rust command/document API supports every edit. A React file does not itself need conversion to Rust to gain Rust calculation authority. |
| Document and history | `src/core/project.js`, `projectRestore.js`, `nativeProjectLibraryBridge.js`, and `scopedNativeGradeHistory20261112.js`. The latter explicitly says separate grade/catalog undo journals are **not** a single ordered journal and insists on revision witnesses. | **High risk / P0:** do not combine history journals casually. One versioned Rust transaction owner and cold restart/undo checks must precede deleting JS project authority. |
| Sewing / numerical geometry | `src/core/clothcraft2dGeometry.js`, `freeSewingGeometry.js`, `native_cpp/core/native_seam_assembly.cpp`, `native_cpp/core/cloth_meshing_pipeline.cpp`, multiple first-party `rust/exo_*_kernel/src/lib.rs`. | Build golden fixtures and a shared Rust panel/edge/seam ID contract. Verify that runtime commands actually call the candidate Rust kernel and do not shadow results with JS/C++. |
| Grading/POM | `src/core/grading.js`, `measurements.js`, `native_cpp/core/grading.cpp`, existing Rust grading kernel, server/native bridges. | Grade a genuinely nonuniform six-size tee through the UI; compare every material-space coordinate and serialize grade rules, seam/notch references and revisions. |
| DXF / industrial interchange | `native_cpp/core/dxf_import.cpp` has explicit code notes saying DXF closed outlines and drafting marks are supported but a native ASTM sewing graph is **not reconstructed**. | **High risk / P1:** do not advertise generic DXF import as full AAMA/ASTM interoperability. Need independently sourced industrial fixture and external viewer/plotter checks. |
| Cloth physics | Upstream ClothCraft `solver.rs`, `vbd.rs`, `contact.rs`, `ogc/`; EXO C++/JavaScript physics and PPF bridges also exist. | Retain CPU reference and negative contact tests, pin and separate upstream changes. Native GPU capability flags and one-step smoke do not prove long-run physical fit or solver equivalence. |
| AI command layer | `src/core/assistantActions.js`, `exoAssistantPlanner20261102.js`, and `integrations/clothcraft/agent-api.mjs`. | Keep model interactions proposal-only and non-authoritative; Rust accepts validated, permission-scoped edits only after an explicit review/approval command. |
| Materials and factory | `src/core/importedCloMaterial.js`, `nativePatternExportPreparation.js`, `productionPreflight.js`, `techPackHtmlExport.js`, `techpack-spreadsheet/exporterXlsx.js`. | Migrate canonical fabric/mechanical and engineering export records; continue rendering/composing PDF/XLSX in suitable presentation libraries until parity tests exist. |

## Source organization and scale

- A public Git tree enumeration found **71 tracked `Cargo.toml` manifests** across the entire repository. A narrower engine/first-party inspection found many independent Rust/WASM kernels; their presence is **not** a count of active/exercised EXO systems. The dashboard's 99 first-party `.rs` source files and 73 upstream-derived `.rs` source files use a different declared source-only scope from Cargo manifest enumeration.
- `src/core/` contains many independent JS modules, historical parity fixtures, attempts and tests. Avoid mass-deleting or treating every `.js` as production authority; the 41-system plan deliberately includes an unclassified-code ownership audit (`EXO-RUST-038`).
- The existing November 14 macOS candidate QA confirms a source-built separate application and independently verified runtime hashes. It also reports 59 bundled WASM files of which only five principal crates were independently rebuilt in that work (four byte-matched, geometry differed); **this is a provenance gap**, not a 54-module failure count. Do not mark 59/59 verified.
- The existing reports explicitly do **not** prove bit-for-bit reproduction of the private installed EXO app or garment-factory physical/industrial accuracy. A research dashboard cannot replace these release gates.

## Specific integration risks and falsifiable tests

**R1 — Dual project authorities:** Moving a curve in React, C++, and Rust can appear correct in one screenshot while producing distinct revision histories. **Test:** one authored parametric edit, six sizes, Undo→Redo→Save→cold Reopen, then compare stable panel/edge/seam IDs, command revisions and all output coordinates. Reject stale/future schema and unauthorized writers.

**R2 — Geometry/meshing invalidation:** Pattern rest shape is in metres in ClothCraft; EXO CAD often presents millimetres. **Test:** draw two curves and linked seams, edit curvature, roundtrip 100-mm reference, rebuild the mesh and inspect source edges/UVs. Optical material changes should not reset physical state; physical fabric or topology edits must invalidate the relevant caches.

**R3 — Sewn cloth physical correctness:** A VBD/OGC step returning `ok:true` is not solver/fit validation. **Test:** matched CPU reference, finite-difference internal forces, 200- and 1000-frame drape/pull-release traces, minimum separation/penetration, energy/strain/complete-step timing and a deliberate CCD failure fixture; keep GPU opt-in.

**R4 — Industrial DXF/ASTM:** Existing source warns that ASTM blocks and sewing graph are not reconstructed. **Test:** externally authored AAMA/ASTM sample through import/edit/export, independent CAD viewer plus physical scale and a negative orphan-notch/cutline/cutter gate. Manufacturing readiness is false unless independently qualified.

**R5 — License and source provenance:** EXO first-party source has GPL-3.0-only notices while upstream ClothCraft is MIT. Keep original MIT notices and source SHA; do not assume every third-party library, scan, model, native binary, WASM bundle or manufacturer's CLO resource is redistributable. No proprietary CLO3D media or personal developer paths in the public research pack.

**R6 — Rust UI rewrite too early:** The existing React/Three/WebKit UI is a functioning first-party product layer. **Test before replacing:** keyboard/pointer modes, 2D/3D split, actual editable tee, grade, sewing tools, save/reopen, layout preferences, material preview and screenshots on clean Mac. Until then preserve the frontend and move deterministic domain logic behind Rust APIs.

## Claims that are *not* supported by this research pack

- “EXO is X% migrated to Rust.” Only source-language percentages are measured; functional migration completion is unknown.
- “ClothCraft upstream has accepted these 41 tasks.” These are EXO-proposed task IDs; follow upstream's accepted claim flow separately.
- “All WASM and native binaries are exactly reproducible.” Existing QA has explicit unresolved mismatches/coverage.
- “The exported garment is physical-fit certified or AAMA/ASTM compliant.” External evidence has not been established.
- “All installed private EXO app files are on GitHub.” Media/licensing and compiled/runtime parity boundaries remain.

**Recommended next independent proof:** a single source-pinned EXO/ClothCraft adapter and atomic Rust document transaction for a real six-size tee, with explicit existing JS/C++ parity and a saved/reopened native desktop UI demonstration. This validates the direction of the rewrite before recruiting many agents for dependent subsystems.
