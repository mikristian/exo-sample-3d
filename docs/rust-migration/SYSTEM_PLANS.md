# System-by-system Rust migration plans (41 systems)

These plans extend the [existing 2026-11-14 full-system audit](../reports/EXO_V2_RUST_ALL_SYSTEMS_PLAN_20261114.md). They are *reviewable proposed work*, not finished migrations. The first-PR slice is deliberately smaller than the long-term migration target.

**Source:** Git 985bc9a8e5031a9fa02666a44390802aff8e04ce. **Numbers:** legacy mapped production-code LOC, not functional implementation or accepted upstream coverage.

<a id="sys-37"></a>
## 01. EXO-RUST-037 — Native Rust engine shared core (P0)

**Legacy code composition:** 94.9% Rust = 447 Rust LOC / 471 mapped LOC across 7 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** None. **Phase:** F0 Core contracts.

**Concrete EXO files to inspect first:** `rust/exo_ui_kernel/src/lib.rs`; `rust/exo_material_guide_kernel/src/lib.rs`; `rust/exo_core_math_kernel/src/lib.rs`; `rust/exo_selection_metrics_kernel/src/lib.rs`; `rust/exo_anchor_kernel/src/lib.rs`; `src/core/garmentPreviewPaging.js`; `rust/exo_preview_offset_kernel/src/lib.rs`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `lib.rs, fitting.rs, solver.rs, garment/mod.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Pin clean upstream ClothCraft SHA in EXO adapter and prove clean upstream Cargo tests; isolate all EXO patches outside upstream-owned files.

**Full migration target:** Pin the clean erythrofr upstream commit as an auditable Rust dependency. Separate EXO extensions via adapter crate and explicit feature flags; reconcile dirty local modifications before integration; prepare upstreamable patches individually.

**Required positive and negative tests:** Clean upstream Cargo tests + EXO adapter tests; API/serde compatibility, identical units, original upstream editor opens base fixture; no source copying without provenance.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-01"></a>
## 02. EXO-RUST-001 — Project model / source-of-truth (P0)

**Legacy code composition:** 1.6% Rust = 54 Rust LOC / 3,277 mapped LOC across 32 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-037](#sys-37). **Phase:** F0 Core contracts.

**Concrete EXO files to inspect first:** `src/data/defaultProject.js`; `native_cpp/core/garment_document.cpp`; `src/core/project.js`; `native_cpp/core/clothcraft_export.cpp`; `native_cpp/core/native_simulation_payload_builder.cpp`; `native_cpp/core/pattern_mesh.cpp`; `native_cpp/core/native_payload.cpp`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `project.rs, fitting.rs, authoring.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Introduce serde-versioned ExoGarmentV2 read/validate-only adapter; roundtrip one tee with stable panel/edge IDs and explicit mm/SI conversion.

**Full migration target:** Define versioned ExoGarmentV2 with stable piece/edge/size IDs, SI units and serde migrations. Make Rust the only committed mutation owner; map existing C++ and JS documents through adapters without stripping metadata.

**Required positive and negative tests:** Open legacy and new projects; change a curve, reload, compare serialized schema and unchanged seam IDs; reject stale or future schema atomically.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-33"></a>
## 03. EXO-RUST-033 — API / processes / transport (P0)

**Legacy code composition:** 23.0% Rust = 1,630 Rust LOC / 7,093 mapped LOC across 64 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-037](#sys-37). **Phase:** F0 Core contracts.

**Concrete EXO files to inspect first:** `native_cpp/cli/main.cpp`; `integrations/clothcraft/exo-session.rs`; `integrations/clothcraft/server.mjs`; `ppf_backend/server.mjs`; `integrations/clothcraft/rust-mcp-server/src/main.rs`; `integrations/clothcraft/runtime-provenance.mjs`; `src/core/backends/nativeServiceBackend.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `bin/exo-session.rs, lib.rs, project.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Create strict versioned Rust RPC envelope (revision, command-id, origin, auth, errors); shadow current Node bridge on representative fixture.

**Full migration target:** Create a versioned typed Rust command/RPC boundary between EXO and marvelous-cloth; migrate Node decision logic and transport through a compatibility shim while pairing Rust binaries to source hashes.

**Required positive and negative tests:** Browser/desktop IPC schema tests, credential/origin checks, backpressure, transport errors, native ABI probes, full real edit/save/reopen across subprocess restart.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-29"></a>
## 04. EXO-RUST-029 — Persistence / undo / history / restore (P0)

**Legacy code composition:** 4.0% Rust = 98 Rust LOC / 2,469 mapped LOC across 18 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-033](#sys-33). **Phase:** F0 Core contracts.

**Concrete EXO files to inspect first:** `integrations/clothcraft/workspace.mjs`; `integrations/clothcraft/nativeMirrorTransaction20261030.mjs`; `src/core/nativeGradeSidecarCodec.js`; `src/core/accumarkNativeGradedTemplateTransaction20261024.js`; `src/core/modarisNativeSixSizeDependencyTransaction20261027.js`; `src/core/projectRestore.js`; `src/core/nativeGradeCanonicalSizeTransaction20261028.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `authoring.rs, project.rs, bin/exo-session.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Implement atomic edit + undo/redo Rust journal for one curve-control transaction; verify crash/reopen, stale revision and no partial commits.

**Full migration target:** Make one Rust revisioned transaction/event journal authoritative for CAD, grade, sewing, materials and exports; provide safe crash-consistent save/undo/redo and schema migration.

**Required positive and negative tests:** Real UI mixed-draft/native history command sends Rust undo/redo; power-failure injection, cold restart, file hash and history recovery; no original project overwritten.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-03"></a>
## 05. EXO-RUST-003 — Curves, freehand and geometry (P1)

**Legacy code composition:** 30.0% Rust = 770 Rust LOC / 2,567 mapped LOC across 29 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-033](#sys-33), [EXO-RUST-037](#sys-37). **Phase:** F1 2D CAD.

**Concrete EXO files to inspect first:** `src/core/nativeFreeCurvePoints.js`; `src/core/vectorPatternBezier.js`; `rust/exo_geometry_kernel/src/lib.rs`; `src/core/rustGeometryKernel.js`; `src/core/modarisDerivedContour20261027.js`; `src/core/advancedCadCurveHandle20261024_1423.js`; `src/core/advancedCadGradedCurveQA20261024_1423.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `garment/curves.rs, garment/precision_curve_20261030.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Implement cubic Bézier arc-length/tangent and offset golden fixtures in existing Rust geometry kernel, compare JS/C++ at declared tolerances.

**Full migration target:** Consolidate Bézier, freehand smoothing, arc length, tangent and offset logic. Remove duplicated JS/C++ results only after Rust exact-coordinate and tolerance parity.

**Required positive and negative tests:** Curve closure, tangency, area and sampled lengths match independent numerical oracles; preserve shape and control-point IDs after save/reopen.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-05"></a>
## 06. EXO-RUST-005 — Parametric references / formulas (P1)

**Legacy code composition:** 0.0% Rust = 0 Rust LOC / 1,493 mapped LOC across 10 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-003](#sys-03), [EXO-RUST-029](#sys-29). **Phase:** F1 2D CAD.

**Concrete EXO files to inspect first:** `src/core/modarisNativeFreeKnotReactiveWitness20261027.js`; `src/core/nativeParametricPoint20261023.js`; `src/core/modarisNativeIndustrialReactiveWitness20261027.js`; `src/core/nativeParametricFormula20261023.js`; `src/core/modarisNativeReferenceRecompute20261027.js`; `src/core/modarisNativeCrossPieceReference20261027.js`; `src/core/accumarkReferencePieceExtraction20261024_1341.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `native_reference_recompute_20261027.rs, native_cross_piece_link_20261030.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Build Rust formula DAG cycle/unit detection for a sleeve-to-armhole cross-piece dependency; preserve stable object links.

**Full migration target:** Make the Rust parameter dependency DAG authoritative for point formulas, cross-panel references, unit-aware constraints and selective regeneration. Eliminate detached JS recalculation.

**Required positive and negative tests:** Cycle and unit-error negative tests; changing an armhole formula deterministically updates sleeve, facing and every graded derivative; cold reopen preserves graph.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-07"></a>
## 07. EXO-RUST-007 — Measurements / POM / body charts (P1)

**Legacy code composition:** 5.0% Rust = 93 Rust LOC / 1,865 mapped LOC across 19 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-005](#sys-05). **Phase:** F1 2D CAD.

**Concrete EXO files to inspect first:** `src/core/measurements.js`; `native_cpp/core/measurement_export.cpp`; `src/core/modarisNativeMultiPanelMeasurementCommit20261030.js`; `src/core/modarisNativeMeasurementCommit20261027.js`; `src/core/vectorcraftPenDimensions20261025.js`; `src/core/seamlyMeasurements.js`; `src/core/nativeGradeFactoryMeasurementMatrix20261025.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `native_measurement_formulas_20261027.rs, native_multi_panel_measurement_20261030.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Port one POM curve measurement formula with named-size values and reject orphan references and invalid units.

**Full migration target:** Port POM definitions, body-size chart formulas, dimension rulers and chart recomputation into canonical Rust SI-unit records with explicit target references.

**Required positive and negative tests:** Compare known POMs on tee/trousers in every size, including curved garment landmarks; invalid units, orphan targets and circular charts fail closed.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-02"></a>
## 08. EXO-RUST-002 — Drafting primitives and snapping (P1)

**Legacy code composition:** 4.8% Rust = 134 Rust LOC / 2,815 mapped LOC across 33 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-003](#sys-03), [EXO-RUST-033](#sys-33). **Phase:** F1 2D CAD.

**Concrete EXO files to inspect first:** `src/core/draftingTopology.js`; `src/core/draftingUnfold.js`; `src/core/draftingPrecision.js`; `native_cpp/core/drafting_snapping.cpp`; `src/core/draftingSnapping.js`; `native_cpp/core/drafting_precision.cpp`; `src/core/accumarkLineConstruction20261024_1341.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `authoring/geometry.rs, garment/curves.rs, math.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Route one interactive snap/measure command through Rust geometry to React while leaving rendering and pointer input in JS.

**Full migration target:** Move intersections, ruler construction, snaps, constraints and high-DPI coordinate conversion into a typed Rust geometry API. React pointer interactions become commands, not independent math.

**Required positive and negative tests:** Millimetre-golden geometric fixtures at multiple zoom/DPI; invalid/nonfinite inputs reject; traced pointer command equals Rust result and undo works.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-04"></a>
## 09. EXO-RUST-004 — Topology / split / unfold / mirror (P1)

**Legacy code composition:** 14.6% Rust = 154 Rust LOC / 1,058 mapped LOC across 12 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-003](#sys-03), [EXO-RUST-029](#sys-29). **Phase:** F1 2D CAD.

**Concrete EXO files to inspect first:** `src/core/accumarkCurvedSourceRigidTransform20261024_1400.js`; `blender_bridge/tune_ppf_shoulder_folds.py`; `src/core/gradedStraightEdgeSplit20261024_1453.js`; `src/core/accumarkPieceRigidActions20261024_1341.js`; `rust/exo_split_kernel/src/lib.rs`; `src/core/appLinkedMirror20261030.mjs`; `src/core/rustSplitKernel.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `ogc/topology.rs, garment/polygon.rs, authoring.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Implement reversible split/mirror on a curved panel with preserved seam/notch links across undo/reopen.

**Full migration target:** Implement atomic cut, split, merge, mirror and unfold transactions on the canonical Rust panel graph; remap seam links, notches and allowances using stable IDs.

**Required positive and negative tests:** Self-intersections and orphan references fail without mutation; reversible mirrored curved panel works across undo/redo and six graded sizes.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-06"></a>
## 10. EXO-RUST-006 — Pattern grading / size runs (P1)

**Legacy code composition:** 3.5% Rust = 260 Rust LOC / 7,408 mapped LOC across 62 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-003](#sys-03), [EXO-RUST-005](#sys-05), [EXO-RUST-007](#sys-07), [EXO-RUST-029](#sys-29). **Phase:** F1 2D CAD.

**Concrete EXO files to inspect first:** `src/core/grading.js`; `src/core/nativeGradingPOM20261025.js`; `native_cpp/core/grading.cpp`; `src/core/nativeGradeIndependentReviewEvidence20261027.js`; `rust/exo_grading_kernel/src/lib.rs`; `src/core/nativeGradingPhysicalSampleReview20261026.js`; `src/core/jeans501WaistGradeCandidate.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `native_six_size_recompute_20261027.rs, grade_pom_audit_20261027.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Connect one six-size graded tee to native Rust grading via UI RPC; compare each control point, grade rule and saved size.

**Full migration target:** Integrate Rust WASM/native size transforms into one graded master with named size correspondence, graded Bézier controls, persistent grade rules and activation from real editor controls.

**Required positive and negative tests:** Six nonuniform named sizes plus 24-size stress; independent coordinate checks; UI save/undo/redo/reopen; no size-rule drift in CUT/DXF.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-10"></a>
## 11. EXO-RUST-010 — Allowance / notch / cutline (P1)

**Legacy code composition:** 4.5% Rust = 142 Rust LOC / 3,170 mapped LOC across 29 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-003](#sys-03), [EXO-RUST-004](#sys-04), [EXO-RUST-006](#sys-06). **Phase:** F1 2D CAD.

**Concrete EXO files to inspect first:** `src/core/physicalCutOverlapPreflight20261023_2000.mjs`; `src/core/industrialCutterQualification20261028.mjs`; `src/core/approvedGradedNotchGeometry20261023_1600.js`; `src/core/gradedNotchIntervalAudit.js`; `src/core/approvedNotchGeometry20261023_1500.js`; `src/core/industrialAamaAllowanceOffset20261028.mjs`; `src/core/industrialAllowanceLinks20261027.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `garment/cutline.rs, garment/precision_curve_20261030.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Move one edge-linked seam allowance and notch offset operation into Rust and verify 100-mm printed scale.

**Full migration target:** Make Rust seam allowances, corner treatments, cut/stitch offsets, notch/drill placement and fold markers canonical by edge/size ID.

**Required positive and negative tests:** No inverted corner or self-overlap; notches remain attached when curved edges change; 100-mm scale export and negative cutter preflight.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-08"></a>
## 12. EXO-RUST-008 — Sewing / seam matching (P1)

**Legacy code composition:** 9.0% Rust = 316 Rust LOC / 3,508 mapped LOC across 33 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-004](#sys-04), [EXO-RUST-006](#sys-06), [EXO-RUST-010](#sys-10). **Phase:** F2 Sewing and meshing.

**Concrete EXO files to inspect first:** `integrations/clothcraft/seam-prediction-research-20261102.py`; `src/core/backends/nativeSeamCandidateGate.js`; `src/core/gradedComplexSeamConstructionAcceptance20261024_1501.js`; `src/core/industrialGradedSeamCorrection20261024_1516.js`; `native_cpp/core/cloth_seam_constraints.cpp`; `src/core/sewingMismatchRepair20261024.js`; `src/core/industrialSixSizeSeamContinuity20261024.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `garment/seam.rs, atelier/seam_links.rs, authoring.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Implement an authoritative Rust seam-pair command with directed partial intervals and malformed edge rejection.

**Full migration target:** Unify seam endpoint, direction, partial seam, easing and stitch sequencing in Rust. Remove alternate JS/C++ sewing authority only when linked seams survive remesh and grade.

**Required positive and negative tests:** Closed/open-zipper fixtures and seam-length tolerance; sew/edit/undo/reopen; report unmatched intervals and invalid sewing instead of covering them visually.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-11"></a>
## 13. EXO-RUST-011 — Cloth mesh / tessellation (P1)

**Legacy code composition:** 16.9% Rust = 196 Rust LOC / 1,161 mapped LOC across 19 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-008](#sys-08), [EXO-RUST-010](#sys-10). **Phase:** F2 Sewing and meshing.

**Concrete EXO files to inspect first:** `native_cpp/core/cloth_meshing_pipeline.cpp`; `native_cpp/core/quality_triangulation.cpp`; `src/core/physics/qualityTriangulation.js`; `native_cpp/core/cloth_meshing.cpp`; `src/core/physics/restMeshFidelityResearch.js`; `rust/exo_foam_triangulation_kernel/src/lib.rs`; `src/core/clothMeshing.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `garment/meshing.rs, garment/embedding.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Compile a named-size seam-linked tee panel to stable Rust mesh IDs/UV; compare triangle area, winding and seam endpoints.

**Full migration target:** Compile the Rust panel/seam graph into deterministic triangles, UV/grain mapping, material and vertex IDs, remeshing policies and incremental invalidation.

**Required positive and negative tests:** Mesh area/normal quality and boundary/seam invariants on tee, pants and jacket; source IDs survive tessellation changes; no orphan sewing endpoints.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-16"></a>
## 14. EXO-RUST-016 — Fabric mechanics / materials (P1)

**Legacy code composition:** 8.6% Rust = 262 Rust LOC / 3,052 mapped LOC across 30 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-011](#sys-11). **Phase:** F3 Simulation and 3D.

**Concrete EXO files to inspect first:** `src/core/clothcraftFabrics.js`; `src/core/clothcraftFabricSurface.js`; `src/core/modarisFabricBoundChart20261027.js`; `src/data/polyhavenFabricAssignments.js`; `rust/exo_fabric_kernel/src/calibration.rs`; `src/core/fabricAssetRegistry.js`; `src/core/fabricEvidenceCalibration.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `fabrics.rs, model.rs, vbd.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Create typed mechanical fabric schema (density, warp/weft, bending, thickness, friction) with SI normalization and cross-API tests.

**Full migration target:** Canonicalize fabric stiffness, density, bending, friction, warp/weft and thickness in Rust with SI units and per-panel grain alignment. Keep optical controls separate.

**Required positive and negative tests:** Fabric measured swatches versus calibrated drape tests; mechanical edits invalidate solver state, optical edits do not; unit conversion roundtrips.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-23"></a>
## 15. EXO-RUST-023 — DXF / CAD interop (P1)

**Legacy code composition:** 0.3% Rust = 33 Rust LOC / 11,648 mapped LOC across 90 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-003](#sys-03), [EXO-RUST-006](#sys-06), [EXO-RUST-010](#sys-10). **Phase:** F5 Factory and exports.

**Concrete EXO files to inspect first:** `src/core/dxf.js`; `src/core/modarisConnectedDevelopmentReceiver20261101.js`; `native_cpp/core/dxf_import.cpp`; `src/core/modarisToolbarCatalog20261028.js`; `integrations/clothcraft/valentinaUniversalSeamlyBridge20261031.mjs`; `native_cpp/core/construction_dxf.cpp`; `src/core/modaris2DGradeDraftJournal20261029.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `garment/export.rs, garment/curves.rs, project.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Roundtrip one known DXF/AAMA/ASTM multi-size pattern with units, curves, grain, notches and seam IDs; external viewer check.

**Full migration target:** Use a Rust DXF import/export layer with declared AAMA/ASTM flavor, layers, physical units, annotations and reliable curve approximation. Keep original importer as conformance fixture.

**Required positive and negative tests:** Roundtrip in licensed receiving CAD and re-export without measured POM/grade drift; malformed/duplicate entities reject; cutter acceptance remains external.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-15"></a>
## 16. EXO-RUST-015 — Avatar / pose / animation (P1)

**Legacy code composition:** 0.0% Rust = 0 Rust LOC / 794 mapped LOC across 11 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01). **Phase:** F3 Simulation and 3D.

**Concrete EXO files to inspect first:** `src/core/avatarWornTeeDisplay.js`; `src/core/avatarWalkPreview20261025.js`; `native_cpp/core/avatar_surface_correction.cpp`; `integrations/clothcraft/attach-exo-skeletal-walk-to-clothed-glb-20261102.py`; `src/core/exoAvatarRenderedMediaRights20261102.js`; `src/data/avatarWornTeeNativeProject.js`; `src/core/exoAvatarHairStyling20261102.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `avatar.rs, fitting.rs, render.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Add public-license neutral avatar landmark and pose proxy transfer to Rust with metric scale and normal/orientation checks.

**Full migration target:** Define Rust avatar geometry, landmarks, skeleton/pose sampling, collision proxies and animation transport; retain license provenance and isolate presentation controls.

**Required positive and negative tests:** GLB/OBJ import normals/scale, two body sizes, multiple poses and swept collision; never ship private avatar or assume a visible mesh equals collision source.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-12"></a>
## 17. EXO-RUST-012 — Cloth physics and solver (P2)

**Legacy code composition:** 3.2% Rust = 505 Rust LOC / 15,839 mapped LOC across 89 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-011](#sys-11), [EXO-RUST-016](#sys-16), [EXO-RUST-033](#sys-33). **Phase:** F3 Simulation and 3D.

**Concrete EXO files to inspect first:** `src/core/physics.js`; `native_backend/src/garment_xpbd_cli.cpp`; `blender_bridge/ppf_run_configured.py`; `src/core/backends/ppfPayload.js`; `blender_bridge/ppf_prepare_scene.py`; `src/core/backends/nativeSleeveCoupledCandidateAdmissionResearch20261025.js`; `blender_bridge/ppf_body_tee_pipeline.py`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `solver.rs, vbd.rs, gpu_vbd.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Use upstream Rust VBD CPU reference with GPU feature-gated comparison and deterministic multi-frame strain/energy telemetry.

**Full migration target:** Consolidate cloth stepping and constraint material parameters behind one Rust solver contract with CPU reference and feature-gated GPU; retain isolated legacy benchmarks until acceptance.

**Required positive and negative tests:** Multiple garment classes, long-run energy/strain traces, deterministic CPU controls, CPU/GPU tolerance cases and real executable ABI; no false certified-fit status.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-13"></a>
## 18. EXO-RUST-013 — Collision / contact / penetration (P2)

**Legacy code composition:** 9.4% Rust = 487 Rust LOC / 5,157 mapped LOC across 54 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-011](#sys-11), [EXO-RUST-012](#sys-12), [EXO-RUST-015](#sys-15). **Phase:** F3 Simulation and 3D.

**Concrete EXO files to inspect first:** `src/core/backends/nativeCoupledClothContactResearch.js`; `src/core/backends/nativeIntrapanelContactResearch.js`; `src/core/backends/nativeSleeveCreaseQualityContactResearch20261025.js`; `rust/exo_self_collision_pass_kernel/src/lib.rs`; `src/core/accumarkMarkerRulerInkClearance20261024.mjs`; `src/core/physics/selfCollision.js`; `rust/exo_self_collision_kernel/src/w11_spatial_candidates.rs`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `contact.rs, ogc/mod.rs, ogc/bvh.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Implement two moving-body contact fixtures with penetration depth/CCD negative cases and verified solver provenance.

**Full migration target:** Use Rust OGC/BVH broadphase, self/contact and CCD where independently proven. Define collision masks, thickness, skin/body clearances and temporal consistency.

**Required positive and negative tests:** Two-frame and long-run cloth/body plus cloth/cloth tests on moving avatars; negative inverted normals and tunnelling; measured penetrations with thresholds.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-14"></a>
## 19. EXO-RUST-014 — Garment fit / stage / drape (P2)

**Legacy code composition:** 2.9% Rust = 185 Rust LOC / 6,460 mapped LOC across 53 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-011](#sys-11), [EXO-RUST-012](#sys-12), [EXO-RUST-013](#sys-13), [EXO-RUST-015](#sys-15). **Phase:** F3 Simulation and 3D.

**Concrete EXO files to inspect first:** `blender_bridge/import_garment.py`; `blender_bridge/finish_501_lightwash.py`; `blender_bridge/nonrigid_ppf_assembly.py`; `native_cpp/core/seam_assembly_advanced.cpp`; `blender_bridge/build_501_onbody_reference.py`; `src/core/sewingAssemblyWorkflow20261024.js`; `src/core/backends/seamAssembly.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `fitting.rs, avatar.rs, atelier/workspace.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Persist and replay native garment pose/drape initialization; invalidate stale mesh on controlled 2D change.

**Full migration target:** Move fitting state, staging transforms, panel initialization and drape caches to versioned Rust records; optional Blender scripts remain offline reference tools.

**Required positive and negative tests:** Saved garment repositioned and replayed identically, no float-up or ghosted caches; source edit invalidates stage/fit snapshots; multi-pose review.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-22"></a>
## 20. EXO-RUST-022 — Marker layout / nesting / yield (P2)

**Legacy code composition:** 5.2% Rust = 226 Rust LOC / 4,352 mapped LOC across 34 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-006](#sys-06), [EXO-RUST-010](#sys-10), [EXO-RUST-023](#sys-23). **Phase:** F5 Factory and exports.

**Concrete EXO files to inspect first:** `src/core/accumarkMarkerProduction20261023.js`; `integrations/clothcraft/native-verified-single-ply-roll-plan-run44.mjs`; `native_cpp/core/marker_layout.cpp`; `src/core/accumarkMarkerPlotParity20261024.mjs`; `src/core/markerArtifacts.js`; `rust/exo_marker_kernel/src/lib.rs`; `native_cpp/core/marker_pdf.cpp`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `garment/polygon.rs, garment/cutline.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Build one deterministic marker nesting job with 6-size ratios, grain and fabric-width nonoverlap constraints.

**Full migration target:** Build deterministic Rust marker/nesting engines for fabric width, grain, size ratios, quantities and defect constraints, with explicit industrial output revision.

**Required positive and negative tests:** Marker does not overlap/out-of-bounds; roll, grain and defect cases reject invalid orders; compare independently measured utilization and cutter-ready layout.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-24"></a>
## 21. EXO-RUST-024 — SVG / PDF / physical plot (P2)

**Legacy code composition:** 2.6% Rust = 39 Rust LOC / 1,473 mapped LOC across 18 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-010](#sys-10), [EXO-RUST-022](#sys-22), [EXO-RUST-023](#sys-23). **Phase:** F5 Factory and exports.

**Concrete EXO files to inspect first:** `src/core/printLayout20261025.js`; `native_cpp/core/marker_svg.cpp`; `src/core/techPackSvgToNativePaths20261031.js`; `src/core/accumarkPrintedPageRegistration20261024.mjs`; `src/core/svgPatternImport.js`; `src/core/accumarkMarkerSafePageBreaks20261024.mjs`; `src/core/printPatternAppearance20261025.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `garment/export.rs, garment/cutline.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Generate one externally measurable 100-mm plot/SVG/PDF from canonical Rust pattern; check clipping and scale.

**Full migration target:** Generate plotted SVG/PDF tiles from one Rust geometry source, including 100-mm X/Y rulers, print boundaries, notch styles and page join marks.

**Required positive and negative tests:** Independently measure printed X/Y 100-mm scale, page alignment and all graded pattern dimensions; invalid scale/unit must fail preflight.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-25"></a>
## 22. EXO-RUST-025 — Factory preflight / measurement QA (P2)

**Legacy code composition:** 3.6% Rust = 130 Rust LOC / 3,635 mapped LOC across 37 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-006](#sys-06), [EXO-RUST-008](#sys-08), [EXO-RUST-010](#sys-10), [EXO-RUST-023](#sys-23), [EXO-RUST-024](#sys-24). **Phase:** F5 Factory and exports.

**Concrete EXO files to inspect first:** `src/core/industrialSignedNotchReceivingGate20261030.mjs`; `native_cpp/core/production_preflight.cpp`; `src/core/industrialReceivingRegistryVersionFloor20261029.mjs`; `src/core/factorySampleApproval.js`; `src/core/industrialReceivingSignedEvidence20261028.mjs`; `src/core/productionPreflight.js`; `src/core/industrialReceivingEntityInventory20261028.mjs`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `garment/diagnostics.rs, garment/cutline.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Fail closed on invalid size, cutter, marker or seam audit; signed readiness only after independent geometry and export evidence.

**Full migration target:** Move production preflight to fail-closed Rust with exact source revision, size run, seam allowances, POM tolerances, geometric validity and external approval flags.

**Required positive and negative tests:** Mutation/stale-hash tests reject altered source and forged factory status; independent technician measured approval required for true manufacturerReady.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-18"></a>
## 23. EXO-RUST-018 — Hardware / fastener / trims (P2)

**Legacy code composition:** 0.0% Rust = 0 Rust LOC / 877 mapped LOC across 11 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-008](#sys-08), [EXO-RUST-014](#sys-14). **Phase:** F4 Materials and assets.

**Concrete EXO files to inspect first:** `src/data/hardwarePresets.js`; `src/core/clo7NativeHardwareActions.js`; `src/core/importedCloHardware3D.js`; `native_cpp/core/trims.cpp`; `src/core/trims.js`; `src/data/cloImportedHardwareCatalog.js`; `src/core/appHardwarePresetValues20261030.mjs`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `fitting.rs, garment/seam.rs, render.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Model one zipper/trim anchor in the Rust garment document; verify shift under grading, mesh and reopening.

**Full migration target:** Represent buttons, zippers, trims, hardware anchors and size-specific placements as Rust project entities; use upstream geometry/render surfaces for actual attachment.

**Required positive and negative tests:** Zipper teeth and fastener position persist through grade, cut and undo; invalid detached anchors fail; renderer and BOM share the same hardware identity.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-27"></a>
## 24. EXO-RUST-027 — Techpacks / BOM / specification (P2)

**Legacy code composition:** 2.8% Rust = 218 Rust LOC / 7,894 mapped LOC across 94 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-007](#sys-07), [EXO-RUST-018](#sys-18), [EXO-RUST-022](#sys-22). **Phase:** F5 Factory and exports.

**Concrete EXO files to inspect first:** `src/core/techPackWorkspacePrint.js`; `src/core/techPackPageComposer.js`; `src/core/techpack-spreadsheet/exporterXlsx.js`; `src/core/techPackVectorPathTools20261031.js`; `src/core/techpack-spreadsheet/gridcraftTableCommands20261030.js`; `src/core/techPackVisualThemes20261031.js`; `native_cpp/core/tech_pack_export.cpp`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `project.rs, fitting.rs, garment/export.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Export a Rust-backed spec/BOM/POM for the same pattern revision, with no missing sizes or orphan material links.

**Full migration target:** Model BOM, techpack measurements, construction diagrams and spec sheets in Rust data contracts, with a native Rust page editor eventually replacing React composition.

**Required positive and negative tests:** Techpack, grade and BOM share revision, quantities and materials; XLSX/PDF/JSON parity; reopen a document without lost assets or inline controls.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-09"></a>
## 25. EXO-RUST-009 — Darts / pleats / facings (P2)

**Legacy code composition:** 0.0% Rust = 0 Rust LOC / 824 mapped LOC across 8 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-003](#sys-03), [EXO-RUST-004](#sys-04), [EXO-RUST-005](#sys-05), [EXO-RUST-008](#sys-08). **Phase:** F2 Sewing and meshing.

**Concrete EXO files to inspect first:** `src/core/accumarkLinkedFacing20261027.js`; `src/core/nativePhysicalPleat20261025.js`; `blender_bridge/refine_501_cuffs_and_shoes.py`; `blender_bridge/finalize_501_hem_material_v12.py`; `blender_bridge/project_501_hem_stitches_to_surface.py`; `src/core/nativeDartPrecision20261023.js`; `src/core/experimentalDartGeometry20261023.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `authoring.rs, garment/shapes.rs, garment/seam.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Port one dart transfer and mirrored pleat/facing state with panel graph links and reversible undo.

**Full migration target:** Add explicit Rust darts, tuck, pleat, facing and fold construction entities, orientation rules and reversible pattern transfers with derivative links.

**Required positive and negative tests:** Dart transfer and curved facing reconstruct after change, split, undo and grading; no silently discarded sewing marks or material groups.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-21"></a>
## 26. EXO-RUST-021 — 3D export and scene assets (P2)

**Legacy code composition:** 0.0% Rust = 0 Rust LOC / 351 mapped LOC across 5 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-011](#sys-11). **Phase:** F4 Materials and assets.

**Concrete EXO files to inspect first:** `native_cpp/core/gltf_export.cpp`; `native_cpp/core/obj_export.cpp`; `src/data/stagePresets.js`; `native_cpp/core/gltf_export.hpp`; `native_cpp/core/obj_export.hpp`.
**Tracked examples:** 5/5 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `garment/export.rs, project.rs, render.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Port one canonical-mesh OBJ/glTF exporter path and independently validate normals/UV/units in an external reader.

**Full migration target:** Replace duplicate C++ OBJ/glTF exporters with canonical Rust geometry serializations preserving scale, materials, winding, texture paths and revision metadata.

**Required positive and negative tests:** External glTF/OBJ viewers load test meshes; roundtrip metric scale, normal orientation and UV; no stale simulation mesh or missing asset claims.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-30"></a>
## 27. EXO-RUST-030 — Libraries / templates / presets (P2)

**Legacy code composition:** 0.0% Rust = 0 Rust LOC / 4,251 mapped LOC across 33 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-007](#sys-07), [EXO-RUST-033](#sys-33). **Phase:** F4 Materials and assets.

**Concrete EXO files to inspect first:** `src/data/templates.js`; `src/core/projectFileLibrary.js`; `src/core/garmentCode.js`; `src/core/accumarkCommandParityCatalog20261024.js`; `src/data/jeans501.js`; `src/core/nativeGradeCatalogBridge20261025.js`; `src/core/exoTemplateSeamTrueing20261102.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `garment/presets.rs, project.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Create rights-aware Rust library index for one public template with hash, provenance, missing-file states and explicit schema.

**Full migration target:** Port catalog search/indexing, provenance, license records and reusable template validation into Rust; keep pure media asset listings declarative where appropriate.

**Required positive and negative tests:** Deterministic asset catalog, valid relative paths, duplicate-ID rules and backward-compatible template instantiate/grade/reopen; no unlicensed bundled content.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-39"></a>
## 28. EXO-RUST-039 — Workspace commands / tools / preferences (P2)

**Legacy code composition:** 4.9% Rust = 108 Rust LOC / 2,208 mapped LOC across 35 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-029](#sys-29), [EXO-RUST-033](#sys-33), [EXO-RUST-037](#sys-37). **Phase:** F6 Agents, tools and platform.

**Concrete EXO files to inspect first:** `src/core/themePresetManager.js`; `src/core/clo7NativeToolCapabilities.js`; `src/core/cloPropertyCommands.js`; `src/core/exoSettingsColorPresets20261028.js`; `src/core/studioCustomization.js`; `src/data/clo7ToolbarOrder.js`; `rust/exo_command_contract/src/lib.rs`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `atelier/workspace.rs, authoring.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Map one tool preference/shortcut and command dispatch through typed Rust actions while retaining React inspector UI.

**Full migration target:** Recreate tools, keymaps, property inspectors, customization and command routing in egui Rust; persist user preferences in versioned Rust schema.

**Required positive and negative tests:** Input-equivalence tests for select, draw, grade, seam and undo; keyboard shortcut collisions and restored layout/theme after relaunch.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-31"></a>
## 29. EXO-RUST-031 — Image digitizing / vision / references (P2)

**Legacy code composition:** 0.0% Rust = 0 Rust LOC / 742 mapped LOC across 8 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-002](#sys-02), [EXO-RUST-003](#sys-03), [EXO-RUST-033](#sys-33). **Phase:** F6 Agents, tools and platform.

**Concrete EXO files to inspect first:** `src/core/exoGarmentPhotoReference20261102.js`; `integrations/clothcraft/pattern-source-geometry-20261102.py`; `src/core/accumarkPhotoDigitize20261024.js`; `src/core/exoLocalPhotoVisionClient20261102.js`; `src/core/accumarkDigitizing20261023.js`; `src/core/referenceImageDrop20261028.js`; `src/core/referenceImageImportGate20261029.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `authoring/geometry.rs, garment/curves.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Digitize one calibration ruler image to metric pattern points with error envelope and manual user confirmation.

**Full migration target:** Expose Rust image-to-pattern measured vector intake with perspective/scale calibration; keep optional OCR/ML service as isolated auxiliary with provenance.

**Required positive and negative tests:** Reference photo with verified calibration produces a valid Rust source contour; wrong units, untrusted image and orphan marks fail without mutating user pattern.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-34"></a>
## 30. EXO-RUST-034 — Collaboration / security / sync (P2)

**Legacy code composition:** 17.3% Rust = 151 Rust LOC / 871 mapped LOC across 7 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-029](#sys-29), [EXO-RUST-033](#sys-33). **Phase:** F6 Agents, tools and platform.

**Concrete EXO files to inspect first:** `integrations/clothcraft/collaboration.mjs`; `rust/exo_collaboration_sse_kernel/src/lib.rs`; `src/core/projectCollaborationClient.js`; `src/core/patternVisualTokens.js`; `src/core/rustCollaborationSseKernel.js`; `integrations/clothcraft/agent-key-store.mjs`; `integrations/clothcraft/workspace-auth.mjs`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `project.rs, authoring.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Require revision-aware, permission-checked Rust collaboration merge for two conflicting editing sessions; reject stale ops.

**Full migration target:** Move authoritative permissions, optimistic-lock source revisions and collaboration merge validation to Rust; retain any UI presence and rendering in the client.

**Required positive and negative tests:** Concurrent edit collision/rollback cases, privilege-denied mutation, stale revision, secure secrets, deterministic merge and authorization negative fixtures.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-36"></a>
## 31. EXO-RUST-036 — Native Rust editor / backend UI glue (P2)

**Legacy code composition:** 0.0% Rust = 0 Rust LOC / 0 mapped LOC across 0 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-002](#sys-02), [EXO-RUST-029](#sys-29), [EXO-RUST-033](#sys-33), [EXO-RUST-037](#sys-37). **Phase:** F7 Rust-native UI.

**Concrete EXO files to inspect first:** No EXO first-party source mapped in legacy audit.
**Tracked examples:** 0/0 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `atelier.rs, atelier/workspace.rs, editor.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Prototype one upstream egui 2D authoring tool against the same Rust document with mouse/snap/screenshot parity.

**Full migration target:** Adopt and extend upstream egui authoring interactions as EXO's Rust-native interface, mapping current 2D/3D and inspector commands to Rust canonical document without duplicating geometry authority.

**Required positive and negative tests:** Keyboard/mouse/touch smoke, undo transaction parity, screenshots and accessibility audit; editable tee and hood; no regression in EXO save/reopen or solver state.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-20"></a>
## 32. EXO-RUST-020 — Foam / padding / trapunto (P3)

**Legacy code composition:** 24.7% Rust = 141 Rust LOC / 570 mapped LOC across 5 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-008](#sys-08), [EXO-RUST-011](#sys-11), [EXO-RUST-012](#sys-12), [EXO-RUST-016](#sys-16). **Phase:** F4 Materials and assets.

**Concrete EXO files to inspect first:** `src/core/foamPaddingGeometry.js`; `rust/exo_foam_kernel/src/lib.rs`; `src/core/foamCompressionModel.js`; `src/core/rustFoamKernel.js`; `src/core/foamPaddingPatternExport.js`.
**Tracked examples:** 5/5 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `garment/meshing.rs, fabrics.rs, vbd.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Port one foam/trapunto loft and compression record as Rust parametric layer with seam-linked thickness semantics.

**Full migration target:** Merge foam/trapunto kernel math into the Rust garment representation; attach padding/loft sections and physical thickness semantics per panel with reversible edits.

**Required positive and negative tests:** Padding seam and loft retention in grading, mesh, material and production records; negative zero-thickness/invalid loft controls and visual cross-checks.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-17"></a>
## 33. EXO-RUST-017 — Fabric visuals / textures / PBR (P3)

**Legacy code composition:** 14.4% Rust = 242 Rust LOC / 1,682 mapped LOC across 22 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-016](#sys-16), [EXO-RUST-021](#sys-21), [EXO-RUST-036](#sys-36). **Phase:** F4 Materials and assets.

**Concrete EXO files to inspect first:** `src/core/textileProcedurals.js`; `src/core/clothWashProcedurals.js`; `src/core/clothWashImage.js`; `rust/exo_pbr_pixels_kernel/src/lib.rs`; `src/core/fabricPbrAppearance.js`; `native_cpp/core/fabric_pbr_pixels.cpp`; `src/data/fabricTextureLibrarySources.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `render.rs, fabrics.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Share one Rust material parameter/PBR record with existing Three frontend and upstream wgpu preview without solver reset.

**Full migration target:** Port reproducible texture transforms, scan metadata and material asset validation to Rust where measurable; bind Rust material records into wgpu shaders instead of mirroring entire CSS/JS shader code.

**Required positive and negative tests:** Golden pixels and color-space/UV scale checks on named PBR swatches; offline renderer and native UI agree on fabric assignment; no visual claim of mechanical calibration.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-19"></a>
## 34. EXO-RUST-019 — Garment print graphics / embroidery (P3)

**Legacy code composition:** 0.0% Rust = 0 Rust LOC / 405 mapped LOC across 1 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-011](#sys-11), [EXO-RUST-017](#sys-17), [EXO-RUST-027](#sys-27). **Phase:** F4 Materials and assets.

**Concrete EXO files to inspect first:** `src/core/nativeGarmentGraphics.js`.
**Tracked examples:** 1/1 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `fitting.rs, garment/embedding.rs, render.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Attach one artwork/embroidery placement to pattern IDs and verify projection after grade and remeshing.

**Full migration target:** Define attached print/embroidery placement geometry, scalable projection anchors and artwork asset hashes as Rust-editable project data; keep texture compositing in Rust/wgpu.

**Required positive and negative tests:** Artwork orientation, print repeat and location survive mesh regeneration, grading and save/reopen; no unresolved asset path escapes export bundle.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-26"></a>
## 35. EXO-RUST-026 — Production packages / factory orders (P3)

**Legacy code composition:** 0.0% Rust = 0 Rust LOC / 8,746 mapped LOC across 69 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-022](#sys-22), [EXO-RUST-023](#sys-23), [EXO-RUST-024](#sys-24), [EXO-RUST-025](#sys-25), [EXO-RUST-027](#sys-27). **Phase:** F5 Factory and exports.

**Concrete EXO files to inspect first:** `src/core/factoryPackage.js`; `integrations/clothcraft/native-verified-cutroom-intake-run44.mjs`; `src/core/factoryZipMetadataGuard20261024_0400.mjs`; `src/core/industrialSignedFactoryZipIsolated20261030.mjs`; `src/core/nativeVerifiedProductionOrderClient20261029.js`; `src/core/factoryZipIndependentRasterHardened20261024_1854.py`; `integrations/clothcraft/native-verified-order-handoff-run36-20261029.mjs`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `project.rs, garment/export.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Produce one revision-locked, fail-closed multi-size factory package with every file referenced by content hash.

**Full migration target:** Package signed/hash-checked factory manifests in Rust with immutable pattern revision, BOM, grade, cut order, materials, labels and audit trail; no JS sole-source ZIP authority.

**Required positive and negative tests:** Byte/content checksum verification, cross-file source identity, safe ZIP names, negative altered count/material; cutter signoff required before cuttingAuthorized=true.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-28"></a>
## 36. EXO-RUST-028 — Cost / pricing / estimates (P3)

**Legacy code composition:** 21.6% Rust = 107 Rust LOC / 495 mapped LOC across 6 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-016](#sys-16), [EXO-RUST-022](#sys-22), [EXO-RUST-027](#sys-27). **Phase:** F5 Factory and exports.

**Concrete EXO files to inspect first:** `native_cpp/core/fabric_cost.cpp`; `src/core/rustFabricCostKernel.js`; `rust/exo_fabric_cost_kernel/src/lib.rs`; `src/core/productionCost.js`; `rust/exo_fabric_cost_kernel/build.mjs`; `native_cpp/core/fabric_cost.hpp`.
**Tracked examples:** 6/6 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `fabrics.rs, garment/export.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Generate material yield + quantity cost estimates from verified Rust marker/BOM records, handle units and invalid pricing.

**Full migration target:** Replace JS/C++ cost arithmetic with Rust deterministic fabric yield, trim/labor cost and price revision logic linked to marker and BOM versions.

**Required positive and negative tests:** Numerical and currency-rounding fixtures, lot/roll sensitivity and formula undo; no quote from a superseded marker or bill of materials.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-32"></a>
## 37. EXO-RUST-032 — AI assistant / generation / automation (P3)

**Legacy code composition:** 0.0% Rust = 0 Rust LOC / 3,828 mapped LOC across 29 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-029](#sys-29), [EXO-RUST-033](#sys-33), [EXO-RUST-025](#sys-25). **Phase:** F6 Agents, tools and platform.

**Concrete EXO files to inspect first:** `src/core/exoCompanionExperience20261102.js`; `src/core/exoCompanionVoice20261102.js`; `integrations/clothcraft/agent-api.mjs`; `src/core/exoCompanionCharacterPreferences20261102.js`; `src/core/exoCompanionCommands20261102.js`; `integrations/clothcraft/pattern-synthesis-model-20261102.py`; `src/core/exoTextSketchPatternCandidate20261102.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `authoring.rs, project.rs, bin/exo-session.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Route one AI draft proposal through Rust preview/diff/approve; prove refusal of untrusted factory/FS commands.

**Full migration target:** Wrap AI-generated drafts/commands through typed Rust capabilities and preview/diff approval; never let model output directly bypass document, factory or license checks.

**Required positive and negative tests:** Hostile or malformed agent commands reject; generated sewing proposal requires acceptance; no factory-ready flags or raw file writes from model output.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-35"></a>
## 38. EXO-RUST-035 — Diagnostics / performance / misc (P3)

**Legacy code composition:** 0.0% Rust = 0 Rust LOC / 221 mapped LOC across 5 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-012](#sys-12), [EXO-RUST-025](#sys-25), [EXO-RUST-033](#sys-33). **Phase:** F6 Agents, tools and platform.

**Concrete EXO files to inspect first:** `src/core/accumarkSewlineMismatchDiagnostic20261023.js`; `src/core/sewingLengthDiagnostics.js`; `ppf_backend/stagingDiagnostics.mjs`; `blender_bridge/inspect_fit_scene.py`; `ppf_backend/processStatus.mjs`.
**Tracked examples:** 5/5 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `solver.rs, garment/diagnostics.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Capture structured per-stage Rust simulation and export telemetry; differentiate safety failure from test pass.

**Full migration target:** Expose Rust structured timing, solver/geometry diagnostics, invariants and provenance logs with optional tracing streams. Keep cross-language QA harnesses until conversion evidence closes.

**Required positive and negative tests:** Trace links source/size/solver/schema/commit; performance baselines across machines with no hidden green status for failed collision/plot/grade gates.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-38"></a>
## 39. EXO-RUST-038 — Unclassified JS business logic (P3)

**Legacy code composition:** 0.0% Rust = 0 Rust LOC / 9,221 mapped LOC across 108 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-001](#sys-01), [EXO-RUST-033](#sys-33), [EXO-RUST-039](#sys-39). **Phase:** F6 Agents, tools and platform.

**Concrete EXO files to inspect first:** `src/core/backends/nativePayload.js`; `src/core/manufacturingReleaseReadiness.js`; `src/core/backends/nativeFoundationTeeHingedBodyConstraintInventory20261025.js`; `src/core/industrialPatternQA.js`; `src/core/backends/nativeCreaseRepairCandidateGate20261024.js`; `src/core/nativePatternConstraintBindings20261023.js`; `src/core/createStageEnvironment.js`.
**Tracked examples:** 7/7 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `lib.rs, authoring.rs, project.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Classify every currently-unmapped JS core module as Rust-authoritative, presentation-only or dead-with-proof, with import evidence.

**Full migration target:** Trace unclassified JS imports and actual runtime calls. Assign every command to a Rust module or mark pure presentation and remove only proven dead duplicates; preserve tests.

**Required positive and negative tests:** 100% of 108 classified source files have reviewed ownership ledger, deterministic Rust migration or documented UI-only retention; never delete on filename alone.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-40"></a>
## 40. EXO-RUST-040 — macOS native host / lifecycle (P3)

**Legacy code composition:** 0.0% Rust = 0 Rust LOC / 3,680 mapped LOC across 5 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-033](#sys-33), [EXO-RUST-036](#sys-36), [EXO-RUST-037](#sys-37). **Phase:** F7 Rust-native UI.

**Concrete EXO files to inspect first:** `integrations/clothcraft/macos/clo-inspector-bridge/main.swift`; `integrations/clothcraft/macos/EXOClothCraftWorkspaceV2.swift`; `integrations/clothcraft/macos/EXOClothCraftWorkspace.swift`; `integrations/clothcraft/macos/EXOClothCraft.swift`; `integrations/clothcraft/macos/vision-hand-landmarks.swift`.
**Tracked examples:** 5/5 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `main.rs, editor.rs, render.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Produce a source-built egui/wgpu macOS lifecycle prototype in isolation, comparing WebKit parity; no production app replacement.

**Full migration target:** Replace Swift WKWebView shell only after Rust-native eframe/wgpu packaging handles windows, menu, dialogs, file access, GPU startup and safe lifecycle; keep limited native OS FFI when unavoidable.

**Required positive and negative tests:** Clean Apple Silicon macOS installer and Windows/Linux smoke, open/save/reopen, cancellation and GPU recovery; codesign/notarization, rollback and bundle/source parity.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).

<a id="sys-41"></a>
## 41. EXO-RUST-041 — Other backend source (P3)

**Legacy code composition:** 0.0% Rust = 0 Rust LOC / 539 mapped LOC across 5 file assignments. This does not measure runtime authority or feature completeness.

**Dependency gates:** [EXO-RUST-027](#sys-27), [EXO-RUST-033](#sys-33), [EXO-RUST-038](#sys-38). **Phase:** F6 Agents, tools and platform.

**Concrete EXO files to inspect first:** `techpack-studio/src/model.js`; `integrations/clo_sdk/cli.mjs`; `integrations/clo_sdk/plan_501_arrangement.py`; `techpack-studio/src/visualModel.js`; `src/hooks/useNativeWorkspaceRequest.js`.
**Tracked examples:** 5/5 at the referenced public Git revision.

**Proposed upstream ClothCraft attachment:** `lib.rs, project.rs`. This is a mapping hypothesis, not an upstream-approved integration.

**First reviewable PR slice:** Inventory remaining techpack/SDK integration scripts, source rights and tests before moving any operation to a Rust API.

**Full migration target:** Inventory miscellaneous integration and techpack-studio backends; assign Rust service boundaries or discard only evidence-proven abandoned prototypes.

**Required positive and negative tests:** Each remaining file has owner, dependency, test fixture, license classification and native replacement or documented noncritical presentation exception.

**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.

**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).
