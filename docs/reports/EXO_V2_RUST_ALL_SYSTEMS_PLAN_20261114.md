# EXO ClothCraft Studio V2 — full Rust conversion & upstream compatibility plan

**Baseline:** November 14, 2026 read-only source inventory. **Target:** one Rust engineering core and a Rust-native egui/wgpu interface, integrated compatibly with [`erythrofr/ClothCraft`](https://github.com/erythrofr/ClothCraft) instead of requiring an unreviewed upstream fork.

**This is a plan, not executed migration.** The first-party backend is 5.16% Rust by scoped source lines (7,128/138,170). Existing upstream-derived Rust engine 33,918 lines is separate. UI JSX/JS: 61,552 lines; CSS: 19,576 lines; 0% of this counted React/CSS UI is Rust.

## Upstream compatibility architecture

1. **Pin original upstream:** Treat local `research/oss/clothcraft` remote `origin` (`erythrofr/ClothCraft`) as canonical. Pin an audited commit, license and crate API. Its local worktree is dirty at the recorded checkpoint; first separate EXO-specific modifications and compare with a clean upstream checkout. Do not call local changes upstream-accepted.
2. **Separate adapters:** In EXO-owned Rust crates, depend on `marvelous-cloth` and adapt domain types through explicit versioned contracts. Upstream `project`, `authoring`, `garment`, `fitting`, `solver/vbd`, `ogc` and optional `render` are concrete attachments, not permission to rewrite the upstream tree wholesale.
3. **Preserve compatibility:** Use `serde` schema versions, exact IDs and SI units with mm conversions at export boundaries, typed RPC between app and core, stable metadata and feature flags for desktop/GPU. Keep an upstream-only test lane, an EXO adapter lane and production-UI lane.
4. **Rethink UI end-state:** Existing React/Three.js UI and Swift/WKWebView desktop shell stay available while migrating. The target for *every* UI system is Rust `eframe/egui` with upstream `wgpu`; use Rust OS bindings or minimal documented FFI where no pure Rust interface exists. Visual matching and interaction QA are separate acceptance gates.
5. **Do not confuse conversion with correctness:** Tests validate feature parity and Rust ownership, not factory approval or garment fit. Factory DXF/plot/CUT and physical cloth simulation retain independent external/measured acceptance gates.

## Dependency phases (gated, not promises)

- **F0 Core contracts** — Source identity, Rust/EXO adapter, canonical model, typed command transport, crash-safe history. First protect dirty trees and pin upstream. (4 backend systems)
- **F1 2D CAD** — Source geometry, parametric dependencies, grading, POM, allowances and precise interactive CAD behavior. (7 backend systems)
- **F2 Sewing and meshing** — Rust seam/constructive sewing and deterministic panel mesh compilation. (3 backend systems)
- **F3 Simulation and 3D** — Validated solver, contact, avatars, physical fabrics and garment fitting. (5 backend systems)
- **F4 Materials and assets** — Materials, PBR, trims, padding, library assets and 3D export. (6 backend systems)
- **F5 Factory and exports** — Industrial interchange, markers, plotting, tech packs, cost and manufacturing safety. (7 backend systems)
- **F6 Agents, tools and platform** — Agent safety, collaboration, diagnostics, ownership review and workspace commands. (7 backend systems)
- **F7 Rust-native UI** — Replace React/Three/WebKit UI with upstream-compatible egui/wgpu desktop after backend parity; keep old UI until full acceptance. (2 backend systems)

## Every backend system: target modules and tests

### 01. Project model / source-of-truth — F0 Core contracts
**Current source:** 32 mapped EXO files, 3,277 lines, **1.6% Rust by source**. Examples: `src/data/defaultProject.js`, `native_cpp/core/garment_document.cpp`, `src/core/project.js`.
**Upstream Rust attachment:** `project.rs, fitting.rs, authoring.rs`.
**Conversion work:** Define versioned ExoGarmentV2 with stable piece/edge/size IDs, SI units and serde migrations. Make Rust the only committed mutation owner; map existing C++ and JS documents through adapters without stripping metadata.
**Required verification:** Open legacy and new projects; change a curve, reload, compare serialized schema and unchanged seam IDs; reject stale or future schema atomically.
**Dependencies:** 37.

### 02. Drafting primitives and snapping — F1 2D CAD
**Current source:** 33 mapped EXO files, 2,815 lines, **4.8% Rust by source**. Examples: `src/core/draftingTopology.js`, `src/core/draftingUnfold.js`, `src/core/draftingPrecision.js`.
**Upstream Rust attachment:** `authoring/geometry.rs, garment/curves.rs, math.rs`.
**Conversion work:** Move intersections, ruler construction, snaps, constraints and high-DPI coordinate conversion into a typed Rust geometry API. React pointer interactions become commands, not independent math.
**Required verification:** Millimetre-golden geometric fixtures at multiple zoom/DPI; invalid/nonfinite inputs reject; traced pointer command equals Rust result and undo works.
**Dependencies:** 01, 03, 33.

### 03. Curves, freehand and geometry — F1 2D CAD
**Current source:** 29 mapped EXO files, 2,567 lines, **30.0% Rust by source**. Examples: `src/core/nativeFreeCurvePoints.js`, `src/core/vectorPatternBezier.js`, `rust/exo_geometry_kernel/src/lib.rs`.
**Upstream Rust attachment:** `garment/curves.rs, garment/precision_curve_20261030.rs`.
**Conversion work:** Consolidate Bézier, freehand smoothing, arc length, tangent and offset logic. Remove duplicated JS/C++ results only after Rust exact-coordinate and tolerance parity.
**Required verification:** Curve closure, tangency, area and sampled lengths match independent numerical oracles; preserve shape and control-point IDs after save/reopen.
**Dependencies:** 01, 33, 37.

### 04. Topology / split / unfold / mirror — F1 2D CAD
**Current source:** 12 mapped EXO files, 1,058 lines, **14.6% Rust by source**. Examples: `src/core/accumarkCurvedSourceRigidTransform20261024_1400.js`, `blender_bridge/tune_ppf_shoulder_folds.py`, `src/core/gradedStraightEdgeSplit20261024_1453.js`.
**Upstream Rust attachment:** `ogc/topology.rs, garment/polygon.rs, authoring.rs`.
**Conversion work:** Implement atomic cut, split, merge, mirror and unfold transactions on the canonical Rust panel graph; remap seam links, notches and allowances using stable IDs.
**Required verification:** Self-intersections and orphan references fail without mutation; reversible mirrored curved panel works across undo/redo and six graded sizes.
**Dependencies:** 01, 03, 29.

### 05. Parametric references / formulas — F1 2D CAD
**Current source:** 10 mapped EXO files, 1,493 lines, **0.0% Rust by source**. Examples: `src/core/modarisNativeFreeKnotReactiveWitness20261027.js`, `src/core/nativeParametricPoint20261023.js`, `src/core/modarisNativeIndustrialReactiveWitness20261027.js`.
**Upstream Rust attachment:** `native_reference_recompute_20261027.rs, native_cross_piece_link_20261030.rs`.
**Conversion work:** Make the Rust parameter dependency DAG authoritative for point formulas, cross-panel references, unit-aware constraints and selective regeneration. Eliminate detached JS recalculation.
**Required verification:** Cycle and unit-error negative tests; changing an armhole formula deterministically updates sleeve, facing and every graded derivative; cold reopen preserves graph.
**Dependencies:** 01, 03, 29.

### 06. Pattern grading / size runs — F1 2D CAD
**Current source:** 62 mapped EXO files, 7,408 lines, **3.5% Rust by source**. Examples: `src/core/grading.js`, `src/core/nativeGradingPOM20261025.js`, `native_cpp/core/grading.cpp`.
**Upstream Rust attachment:** `native_six_size_recompute_20261027.rs, grade_pom_audit_20261027.rs`.
**Conversion work:** Integrate Rust WASM/native size transforms into one graded master with named size correspondence, graded Bézier controls, persistent grade rules and activation from real editor controls.
**Required verification:** Six nonuniform named sizes plus 24-size stress; independent coordinate checks; UI save/undo/redo/reopen; no size-rule drift in CUT/DXF.
**Dependencies:** 01, 03, 05, 07, 29.

### 07. Measurements / POM / body charts — F1 2D CAD
**Current source:** 19 mapped EXO files, 1,865 lines, **5.0% Rust by source**. Examples: `src/core/measurements.js`, `native_cpp/core/measurement_export.cpp`, `src/core/modarisNativeMultiPanelMeasurementCommit20261030.js`.
**Upstream Rust attachment:** `native_measurement_formulas_20261027.rs, native_multi_panel_measurement_20261030.rs`.
**Conversion work:** Port POM definitions, body-size chart formulas, dimension rulers and chart recomputation into canonical Rust SI-unit records with explicit target references.
**Required verification:** Compare known POMs on tee/trousers in every size, including curved garment landmarks; invalid units, orphan targets and circular charts fail closed.
**Dependencies:** 01, 05.

### 08. Sewing / seam matching — F2 Sewing and meshing
**Current source:** 33 mapped EXO files, 3,508 lines, **9.0% Rust by source**. Examples: `integrations/clothcraft/seam-prediction-research-20261102.py`, `src/core/backends/nativeSeamCandidateGate.js`, `src/core/gradedComplexSeamConstructionAcceptance20261024_1501.js`.
**Upstream Rust attachment:** `garment/seam.rs, atelier/seam_links.rs, authoring.rs`.
**Conversion work:** Unify seam endpoint, direction, partial seam, easing and stitch sequencing in Rust. Remove alternate JS/C++ sewing authority only when linked seams survive remesh and grade.
**Required verification:** Closed/open-zipper fixtures and seam-length tolerance; sew/edit/undo/reopen; report unmatched intervals and invalid sewing instead of covering them visually.
**Dependencies:** 01, 04, 06, 10.

### 09. Darts / pleats / facings — F2 Sewing and meshing
**Current source:** 8 mapped EXO files, 824 lines, **0.0% Rust by source**. Examples: `src/core/accumarkLinkedFacing20261027.js`, `src/core/nativePhysicalPleat20261025.js`, `blender_bridge/refine_501_cuffs_and_shoes.py`.
**Upstream Rust attachment:** `authoring.rs, garment/shapes.rs, garment/seam.rs`.
**Conversion work:** Add explicit Rust darts, tuck, pleat, facing and fold construction entities, orientation rules and reversible pattern transfers with derivative links.
**Required verification:** Dart transfer and curved facing reconstruct after change, split, undo and grading; no silently discarded sewing marks or material groups.
**Dependencies:** 03, 04, 05, 08.

### 10. Allowance / notch / cutline — F1 2D CAD
**Current source:** 29 mapped EXO files, 3,170 lines, **4.5% Rust by source**. Examples: `src/core/physicalCutOverlapPreflight20261023_2000.mjs`, `src/core/industrialCutterQualification20261028.mjs`, `src/core/approvedGradedNotchGeometry20261023_1600.js`.
**Upstream Rust attachment:** `garment/cutline.rs, garment/precision_curve_20261030.rs`.
**Conversion work:** Make Rust seam allowances, corner treatments, cut/stitch offsets, notch/drill placement and fold markers canonical by edge/size ID.
**Required verification:** No inverted corner or self-overlap; notches remain attached when curved edges change; 100-mm scale export and negative cutter preflight.
**Dependencies:** 01, 03, 04, 06.

### 11. Cloth mesh / tessellation — F2 Sewing and meshing
**Current source:** 19 mapped EXO files, 1,161 lines, **16.9% Rust by source**. Examples: `native_cpp/core/cloth_meshing_pipeline.cpp`, `native_cpp/core/quality_triangulation.cpp`, `src/core/physics/qualityTriangulation.js`.
**Upstream Rust attachment:** `garment/meshing.rs, garment/embedding.rs`.
**Conversion work:** Compile the Rust panel/seam graph into deterministic triangles, UV/grain mapping, material and vertex IDs, remeshing policies and incremental invalidation.
**Required verification:** Mesh area/normal quality and boundary/seam invariants on tee, pants and jacket; source IDs survive tessellation changes; no orphan sewing endpoints.
**Dependencies:** 01, 08, 10.

### 12. Cloth physics and solver — F3 Simulation and 3D
**Current source:** 89 mapped EXO files, 15,839 lines, **3.2% Rust by source**. Examples: `src/core/physics.js`, `native_backend/src/garment_xpbd_cli.cpp`, `blender_bridge/ppf_run_configured.py`.
**Upstream Rust attachment:** `solver.rs, vbd.rs, gpu_vbd.rs`.
**Conversion work:** Consolidate cloth stepping and constraint material parameters behind one Rust solver contract with CPU reference and feature-gated GPU; retain isolated legacy benchmarks until acceptance.
**Required verification:** Multiple garment classes, long-run energy/strain traces, deterministic CPU controls, CPU/GPU tolerance cases and real executable ABI; no false certified-fit status.
**Dependencies:** 11, 16, 33.

### 13. Collision / contact / penetration — F3 Simulation and 3D
**Current source:** 54 mapped EXO files, 5,157 lines, **9.4% Rust by source**. Examples: `src/core/backends/nativeCoupledClothContactResearch.js`, `src/core/backends/nativeIntrapanelContactResearch.js`, `src/core/backends/nativeSleeveCreaseQualityContactResearch20261025.js`.
**Upstream Rust attachment:** `contact.rs, ogc/mod.rs, ogc/bvh.rs`.
**Conversion work:** Use Rust OGC/BVH broadphase, self/contact and CCD where independently proven. Define collision masks, thickness, skin/body clearances and temporal consistency.
**Required verification:** Two-frame and long-run cloth/body plus cloth/cloth tests on moving avatars; negative inverted normals and tunnelling; measured penetrations with thresholds.
**Dependencies:** 11, 12, 15.

### 14. Garment fit / stage / drape — F3 Simulation and 3D
**Current source:** 53 mapped EXO files, 6,460 lines, **2.9% Rust by source**. Examples: `blender_bridge/import_garment.py`, `blender_bridge/finish_501_lightwash.py`, `blender_bridge/nonrigid_ppf_assembly.py`.
**Upstream Rust attachment:** `fitting.rs, avatar.rs, atelier/workspace.rs`.
**Conversion work:** Move fitting state, staging transforms, panel initialization and drape caches to versioned Rust records; optional Blender scripts remain offline reference tools.
**Required verification:** Saved garment repositioned and replayed identically, no float-up or ghosted caches; source edit invalidates stage/fit snapshots; multi-pose review.
**Dependencies:** 01, 11, 12, 13, 15.

### 15. Avatar / pose / animation — F3 Simulation and 3D
**Current source:** 11 mapped EXO files, 794 lines, **0.0% Rust by source**. Examples: `src/core/avatarWornTeeDisplay.js`, `src/core/avatarWalkPreview20261025.js`, `native_cpp/core/avatar_surface_correction.cpp`.
**Upstream Rust attachment:** `avatar.rs, fitting.rs, render.rs`.
**Conversion work:** Define Rust avatar geometry, landmarks, skeleton/pose sampling, collision proxies and animation transport; retain license provenance and isolate presentation controls.
**Required verification:** GLB/OBJ import normals/scale, two body sizes, multiple poses and swept collision; never ship private avatar or assume a visible mesh equals collision source.
**Dependencies:** 01.

### 16. Fabric mechanics / materials — F3 Simulation and 3D
**Current source:** 30 mapped EXO files, 3,052 lines, **8.6% Rust by source**. Examples: `src/core/clothcraftFabrics.js`, `src/core/clothcraftFabricSurface.js`, `src/core/modarisFabricBoundChart20261027.js`.
**Upstream Rust attachment:** `fabrics.rs, model.rs, vbd.rs`.
**Conversion work:** Canonicalize fabric stiffness, density, bending, friction, warp/weft and thickness in Rust with SI units and per-panel grain alignment. Keep optical controls separate.
**Required verification:** Fabric measured swatches versus calibrated drape tests; mechanical edits invalidate solver state, optical edits do not; unit conversion roundtrips.
**Dependencies:** 01, 11.

### 17. Fabric visuals / textures / PBR — F4 Materials and assets
**Current source:** 22 mapped EXO files, 1,682 lines, **14.4% Rust by source**. Examples: `src/core/textileProcedurals.js`, `src/core/clothWashProcedurals.js`, `src/core/clothWashImage.js`.
**Upstream Rust attachment:** `render.rs, fabrics.rs`.
**Conversion work:** Port reproducible texture transforms, scan metadata and material asset validation to Rust where measurable; bind Rust material records into wgpu shaders instead of mirroring entire CSS/JS shader code.
**Required verification:** Golden pixels and color-space/UV scale checks on named PBR swatches; offline renderer and native UI agree on fabric assignment; no visual claim of mechanical calibration.
**Dependencies:** 16, 21, 36.

### 18. Hardware / fastener / trims — F4 Materials and assets
**Current source:** 11 mapped EXO files, 877 lines, **0.0% Rust by source**. Examples: `src/data/hardwarePresets.js`, `src/core/clo7NativeHardwareActions.js`, `src/core/importedCloHardware3D.js`.
**Upstream Rust attachment:** `fitting.rs, garment/seam.rs, render.rs`.
**Conversion work:** Represent buttons, zippers, trims, hardware anchors and size-specific placements as Rust project entities; use upstream geometry/render surfaces for actual attachment.
**Required verification:** Zipper teeth and fastener position persist through grade, cut and undo; invalid detached anchors fail; renderer and BOM share the same hardware identity.
**Dependencies:** 01, 08, 14.

### 19. Garment print graphics / embroidery — F4 Materials and assets
**Current source:** 1 mapped EXO files, 405 lines, **0.0% Rust by source**. Examples: `src/core/nativeGarmentGraphics.js`.
**Upstream Rust attachment:** `fitting.rs, garment/embedding.rs, render.rs`.
**Conversion work:** Define attached print/embroidery placement geometry, scalable projection anchors and artwork asset hashes as Rust-editable project data; keep texture compositing in Rust/wgpu.
**Required verification:** Artwork orientation, print repeat and location survive mesh regeneration, grading and save/reopen; no unresolved asset path escapes export bundle.
**Dependencies:** 01, 11, 17, 27.

### 20. Foam / padding / trapunto — F4 Materials and assets
**Current source:** 5 mapped EXO files, 570 lines, **24.7% Rust by source**. Examples: `src/core/foamPaddingGeometry.js`, `rust/exo_foam_kernel/src/lib.rs`, `src/core/foamCompressionModel.js`.
**Upstream Rust attachment:** `garment/meshing.rs, fabrics.rs, vbd.rs`.
**Conversion work:** Merge foam/trapunto kernel math into the Rust garment representation; attach padding/loft sections and physical thickness semantics per panel with reversible edits.
**Required verification:** Padding seam and loft retention in grading, mesh, material and production records; negative zero-thickness/invalid loft controls and visual cross-checks.
**Dependencies:** 08, 11, 12, 16.

### 21. 3D export and scene assets — F4 Materials and assets
**Current source:** 5 mapped EXO files, 351 lines, **0.0% Rust by source**. Examples: `native_cpp/core/gltf_export.cpp`, `native_cpp/core/obj_export.cpp`, `src/data/stagePresets.js`.
**Upstream Rust attachment:** `garment/export.rs, project.rs, render.rs`.
**Conversion work:** Replace duplicate C++ OBJ/glTF exporters with canonical Rust geometry serializations preserving scale, materials, winding, texture paths and revision metadata.
**Required verification:** External glTF/OBJ viewers load test meshes; roundtrip metric scale, normal orientation and UV; no stale simulation mesh or missing asset claims.
**Dependencies:** 01, 11.

### 22. Marker layout / nesting / yield — F5 Factory and exports
**Current source:** 34 mapped EXO files, 4,352 lines, **5.2% Rust by source**. Examples: `src/core/accumarkMarkerProduction20261023.js`, `integrations/clothcraft/native-verified-single-ply-roll-plan-run44.mjs`, `native_cpp/core/marker_layout.cpp`.
**Upstream Rust attachment:** `garment/polygon.rs, garment/cutline.rs`.
**Conversion work:** Build deterministic Rust marker/nesting engines for fabric width, grain, size ratios, quantities and defect constraints, with explicit industrial output revision.
**Required verification:** Marker does not overlap/out-of-bounds; roll, grain and defect cases reject invalid orders; compare independently measured utilization and cutter-ready layout.
**Dependencies:** 06, 10, 23.

### 23. DXF / CAD interop — F5 Factory and exports
**Current source:** 90 mapped EXO files, 11,648 lines, **0.3% Rust by source**. Examples: `src/core/dxf.js`, `src/core/modarisConnectedDevelopmentReceiver20261101.js`, `native_cpp/core/dxf_import.cpp`.
**Upstream Rust attachment:** `garment/export.rs, garment/curves.rs, project.rs`.
**Conversion work:** Use a Rust DXF import/export layer with declared AAMA/ASTM flavor, layers, physical units, annotations and reliable curve approximation. Keep original importer as conformance fixture.
**Required verification:** Roundtrip in licensed receiving CAD and re-export without measured POM/grade drift; malformed/duplicate entities reject; cutter acceptance remains external.
**Dependencies:** 01, 03, 06, 10.

### 24. SVG / PDF / physical plot — F5 Factory and exports
**Current source:** 18 mapped EXO files, 1,473 lines, **2.6% Rust by source**. Examples: `src/core/printLayout20261025.js`, `native_cpp/core/marker_svg.cpp`, `src/core/techPackSvgToNativePaths20261031.js`.
**Upstream Rust attachment:** `garment/export.rs, garment/cutline.rs`.
**Conversion work:** Generate plotted SVG/PDF tiles from one Rust geometry source, including 100-mm X/Y rulers, print boundaries, notch styles and page join marks.
**Required verification:** Independently measure printed X/Y 100-mm scale, page alignment and all graded pattern dimensions; invalid scale/unit must fail preflight.
**Dependencies:** 10, 22, 23.

### 25. Factory preflight / measurement QA — F5 Factory and exports
**Current source:** 37 mapped EXO files, 3,635 lines, **3.6% Rust by source**. Examples: `src/core/industrialSignedNotchReceivingGate20261030.mjs`, `native_cpp/core/production_preflight.cpp`, `src/core/industrialReceivingRegistryVersionFloor20261029.mjs`.
**Upstream Rust attachment:** `garment/diagnostics.rs, garment/cutline.rs`.
**Conversion work:** Move production preflight to fail-closed Rust with exact source revision, size run, seam allowances, POM tolerances, geometric validity and external approval flags.
**Required verification:** Mutation/stale-hash tests reject altered source and forged factory status; independent technician measured approval required for true manufacturerReady.
**Dependencies:** 01, 06, 08, 10, 23, 24.

### 26. Production packages / factory orders — F5 Factory and exports
**Current source:** 69 mapped EXO files, 8,746 lines, **0.0% Rust by source**. Examples: `src/core/factoryPackage.js`, `integrations/clothcraft/native-verified-cutroom-intake-run44.mjs`, `src/core/factoryZipMetadataGuard20261024_0400.mjs`.
**Upstream Rust attachment:** `project.rs, garment/export.rs`.
**Conversion work:** Package signed/hash-checked factory manifests in Rust with immutable pattern revision, BOM, grade, cut order, materials, labels and audit trail; no JS sole-source ZIP authority.
**Required verification:** Byte/content checksum verification, cross-file source identity, safe ZIP names, negative altered count/material; cutter signoff required before cuttingAuthorized=true.
**Dependencies:** 22, 23, 24, 25, 27.

### 27. Techpacks / BOM / specification — F5 Factory and exports
**Current source:** 94 mapped EXO files, 7,894 lines, **2.8% Rust by source**. Examples: `src/core/techPackWorkspacePrint.js`, `src/core/techPackPageComposer.js`, `src/core/techpack-spreadsheet/exporterXlsx.js`.
**Upstream Rust attachment:** `project.rs, fitting.rs, garment/export.rs`.
**Conversion work:** Model BOM, techpack measurements, construction diagrams and spec sheets in Rust data contracts, with a native Rust page editor eventually replacing React composition.
**Required verification:** Techpack, grade and BOM share revision, quantities and materials; XLSX/PDF/JSON parity; reopen a document without lost assets or inline controls.
**Dependencies:** 07, 18, 22.

### 28. Cost / pricing / estimates — F5 Factory and exports
**Current source:** 6 mapped EXO files, 495 lines, **21.6% Rust by source**. Examples: `native_cpp/core/fabric_cost.cpp`, `src/core/rustFabricCostKernel.js`, `rust/exo_fabric_cost_kernel/src/lib.rs`.
**Upstream Rust attachment:** `fabrics.rs, garment/export.rs`.
**Conversion work:** Replace JS/C++ cost arithmetic with Rust deterministic fabric yield, trim/labor cost and price revision logic linked to marker and BOM versions.
**Required verification:** Numerical and currency-rounding fixtures, lot/roll sensitivity and formula undo; no quote from a superseded marker or bill of materials.
**Dependencies:** 16, 22, 27.

### 29. Persistence / undo / history / restore — F0 Core contracts
**Current source:** 18 mapped EXO files, 2,469 lines, **4.0% Rust by source**. Examples: `integrations/clothcraft/workspace.mjs`, `integrations/clothcraft/nativeMirrorTransaction20261030.mjs`, `src/core/nativeGradeSidecarCodec.js`.
**Upstream Rust attachment:** `authoring.rs, project.rs, bin/exo-session.rs`.
**Conversion work:** Make one Rust revisioned transaction/event journal authoritative for CAD, grade, sewing, materials and exports; provide safe crash-consistent save/undo/redo and schema migration.
**Required verification:** Real UI mixed-draft/native history command sends Rust undo/redo; power-failure injection, cold restart, file hash and history recovery; no original project overwritten.
**Dependencies:** 01, 33.

### 30. Libraries / templates / presets — F4 Materials and assets
**Current source:** 33 mapped EXO files, 4,251 lines, **0.0% Rust by source**. Examples: `src/data/templates.js`, `src/core/projectFileLibrary.js`, `src/core/garmentCode.js`.
**Upstream Rust attachment:** `garment/presets.rs, project.rs`.
**Conversion work:** Port catalog search/indexing, provenance, license records and reusable template validation into Rust; keep pure media asset listings declarative where appropriate.
**Required verification:** Deterministic asset catalog, valid relative paths, duplicate-ID rules and backward-compatible template instantiate/grade/reopen; no unlicensed bundled content.
**Dependencies:** 01, 07, 33.

### 31. Image digitizing / vision / references — F6 Agents, tools and platform
**Current source:** 8 mapped EXO files, 742 lines, **0.0% Rust by source**. Examples: `src/core/exoGarmentPhotoReference20261102.js`, `integrations/clothcraft/pattern-source-geometry-20261102.py`, `src/core/accumarkPhotoDigitize20261024.js`.
**Upstream Rust attachment:** `authoring/geometry.rs, garment/curves.rs`.
**Conversion work:** Expose Rust image-to-pattern measured vector intake with perspective/scale calibration; keep optional OCR/ML service as isolated auxiliary with provenance.
**Required verification:** Reference photo with verified calibration produces a valid Rust source contour; wrong units, untrusted image and orphan marks fail without mutating user pattern.
**Dependencies:** 02, 03, 33.

### 32. AI assistant / generation / automation — F6 Agents, tools and platform
**Current source:** 29 mapped EXO files, 3,828 lines, **0.0% Rust by source**. Examples: `src/core/exoCompanionExperience20261102.js`, `src/core/exoCompanionVoice20261102.js`, `integrations/clothcraft/agent-api.mjs`.
**Upstream Rust attachment:** `authoring.rs, project.rs, bin/exo-session.rs`.
**Conversion work:** Wrap AI-generated drafts/commands through typed Rust capabilities and preview/diff approval; never let model output directly bypass document, factory or license checks.
**Required verification:** Hostile or malformed agent commands reject; generated sewing proposal requires acceptance; no factory-ready flags or raw file writes from model output.
**Dependencies:** 01, 29, 33, 25.

### 33. API / processes / transport — F0 Core contracts
**Current source:** 64 mapped EXO files, 7,093 lines, **23.0% Rust by source**. Examples: `native_cpp/cli/main.cpp`, `integrations/clothcraft/exo-session.rs`, `integrations/clothcraft/server.mjs`.
**Upstream Rust attachment:** `bin/exo-session.rs, lib.rs, project.rs`.
**Conversion work:** Create a versioned typed Rust command/RPC boundary between EXO and marvelous-cloth; migrate Node decision logic and transport through a compatibility shim while pairing Rust binaries to source hashes.
**Required verification:** Browser/desktop IPC schema tests, credential/origin checks, backpressure, transport errors, native ABI probes, full real edit/save/reopen across subprocess restart.
**Dependencies:** 01, 37.

### 34. Collaboration / security / sync — F6 Agents, tools and platform
**Current source:** 7 mapped EXO files, 871 lines, **17.3% Rust by source**. Examples: `integrations/clothcraft/collaboration.mjs`, `rust/exo_collaboration_sse_kernel/src/lib.rs`, `src/core/projectCollaborationClient.js`.
**Upstream Rust attachment:** `project.rs, authoring.rs`.
**Conversion work:** Move authoritative permissions, optimistic-lock source revisions and collaboration merge validation to Rust; retain any UI presence and rendering in the client.
**Required verification:** Concurrent edit collision/rollback cases, privilege-denied mutation, stale revision, secure secrets, deterministic merge and authorization negative fixtures.
**Dependencies:** 01, 29, 33.

### 35. Diagnostics / performance / misc — F6 Agents, tools and platform
**Current source:** 5 mapped EXO files, 221 lines, **0.0% Rust by source**. Examples: `src/core/accumarkSewlineMismatchDiagnostic20261023.js`, `src/core/sewingLengthDiagnostics.js`, `ppf_backend/stagingDiagnostics.mjs`.
**Upstream Rust attachment:** `solver.rs, garment/diagnostics.rs`.
**Conversion work:** Expose Rust structured timing, solver/geometry diagnostics, invariants and provenance logs with optional tracing streams. Keep cross-language QA harnesses until conversion evidence closes.
**Required verification:** Trace links source/size/solver/schema/commit; performance baselines across machines with no hidden green status for failed collision/plot/grade gates.
**Dependencies:** 12, 25, 33.

### 36. Native Rust editor / backend UI glue — F7 Rust-native UI
**Current source:** 0 mapped EXO files, 0 lines, **0.0% Rust by source**. Examples: .
**Upstream Rust attachment:** `atelier.rs, atelier/workspace.rs, editor.rs`.
**Conversion work:** Adopt and extend upstream egui authoring interactions as EXO's Rust-native interface, mapping current 2D/3D and inspector commands to Rust canonical document without duplicating geometry authority.
**Required verification:** Keyboard/mouse/touch smoke, undo transaction parity, screenshots and accessibility audit; editable tee and hood; no regression in EXO save/reopen or solver state.
**Dependencies:** 01, 02, 29, 33, 37.

### 37. Native Rust engine shared core — F0 Core contracts
**Current source:** 7 mapped EXO files, 471 lines, **94.9% Rust by source**. Examples: `rust/exo_ui_kernel/src/lib.rs`, `rust/exo_material_guide_kernel/src/lib.rs`, `rust/exo_core_math_kernel/src/lib.rs`.
**Upstream Rust attachment:** `lib.rs, fitting.rs, solver.rs, garment/mod.rs`.
**Conversion work:** Pin the clean erythrofr upstream commit as an auditable Rust dependency. Separate EXO extensions via adapter crate and explicit feature flags; reconcile dirty local modifications before integration; prepare upstreamable patches individually.
**Required verification:** Clean upstream Cargo tests + EXO adapter tests; API/serde compatibility, identical units, original upstream editor opens base fixture; no source copying without provenance.
**Dependencies:** none.

### 38. Unclassified JS business logic — F6 Agents, tools and platform
**Current source:** 108 mapped EXO files, 9,221 lines, **0.0% Rust by source**. Examples: `src/core/backends/nativePayload.js`, `src/core/manufacturingReleaseReadiness.js`, `src/core/backends/nativeFoundationTeeHingedBodyConstraintInventory20261025.js`.
**Upstream Rust attachment:** `lib.rs, authoring.rs, project.rs`.
**Conversion work:** Trace unclassified JS imports and actual runtime calls. Assign every command to a Rust module or mark pure presentation and remove only proven dead duplicates; preserve tests.
**Required verification:** 100% of 108 classified source files have reviewed ownership ledger, deterministic Rust migration or documented UI-only retention; never delete on filename alone.
**Dependencies:** 01, 33, 39.

### 39. Workspace commands / tools / preferences — F6 Agents, tools and platform
**Current source:** 35 mapped EXO files, 2,208 lines, **4.9% Rust by source**. Examples: `src/core/themePresetManager.js`, `src/core/clo7NativeToolCapabilities.js`, `src/core/cloPropertyCommands.js`.
**Upstream Rust attachment:** `atelier/workspace.rs, authoring.rs`.
**Conversion work:** Recreate tools, keymaps, property inspectors, customization and command routing in egui Rust; persist user preferences in versioned Rust schema.
**Required verification:** Input-equivalence tests for select, draw, grade, seam and undo; keyboard shortcut collisions and restored layout/theme after relaunch.
**Dependencies:** 29, 33, 37.

### 40. macOS native host / lifecycle — F7 Rust-native UI
**Current source:** 5 mapped EXO files, 3,680 lines, **0.0% Rust by source**. Examples: `integrations/clothcraft/macos/clo-inspector-bridge/main.swift`, `integrations/clothcraft/macos/EXOClothCraftWorkspaceV2.swift`, `integrations/clothcraft/macos/EXOClothCraftWorkspace.swift`.
**Upstream Rust attachment:** `main.rs, editor.rs, render.rs`.
**Conversion work:** Replace Swift WKWebView shell only after Rust-native eframe/wgpu packaging handles windows, menu, dialogs, file access, GPU startup and safe lifecycle; keep limited native OS FFI when unavoidable.
**Required verification:** Clean Apple Silicon macOS installer and Windows/Linux smoke, open/save/reopen, cancellation and GPU recovery; codesign/notarization, rollback and bundle/source parity.
**Dependencies:** 33, 36, 37.

### 41. Other backend source — F6 Agents, tools and platform
**Current source:** 5 mapped EXO files, 539 lines, **0.0% Rust by source**. Examples: `techpack-studio/src/model.js`, `integrations/clo_sdk/cli.mjs`, `integrations/clo_sdk/plan_501_arrangement.py`.
**Upstream Rust attachment:** `lib.rs, project.rs`.
**Conversion work:** Inventory miscellaneous integration and techpack-studio backends; assign Rust service boundaries or discard only evidence-proven abandoned prototypes.
**Required verification:** Each remaining file has owner, dependency, test fixture, license classification and native replacement or documented noncritical presentation exception.
**Dependencies:** 27, 33, 38.

## Rust-native UI conversion and exact measured scope

React UI scope: 220 JS/JSX source files (61,552 lines) plus 130 CSS files (19,576 lines), total 81,128 UI source/style lines. All are currently non-Rust in this counted UI scope. Upstream egui/atelier editor Rust is separately referenced and not included in this 0% figure.

| UI area (filename-classified) | Files | JS/JSX lines | CSS lines | All UI lines | Share of UI | Rust in this UI scope |
|---|---:|---:|---:|---:|---:|---:|
| Shell & primary workspaces | 7 | 18,906 | 148 | 19,054 | 23.49% | 0% |
| 3D viewport & simulation | 30 | 9,354 | 641 | 9,995 | 12.32% | 0% |
| Other UI components | 28 | 2,764 | 6,147 | 8,911 | 10.98% | 0% |
| Tech packs & specifications | 39 | 6,836 | 1,951 | 8,787 | 10.83% | 0% |
| Tools, inspectors & settings | 45 | 4,637 | 3,646 | 8,283 | 10.21% | 0% |
| CAD drawing & pattern editing | 42 | 4,793 | 1,350 | 6,143 | 7.57% | 0% |
| Factory & interchange | 43 | 3,909 | 1,916 | 5,825 | 7.18% | 0% |
| Sewing & construction | 31 | 2,176 | 1,484 | 3,660 | 4.51% | 0% |
| Grading & measurements | 21 | 2,277 | 923 | 3,200 | 3.94% | 0% |
| Libraries & references | 23 | 2,097 | 532 | 2,629 | 3.24% | 0% |
| Fabrics, trims & materials | 31 | 2,130 | 335 | 2,465 | 3.04% | 0% |
| AI & assistant | 10 | 1,673 | 503 | 2,176 | 2.68% | 0% |

### UI: Shell & primary workspaces
**Rust approach:** eframe/egui dock and workspace state; replace React app shell, navigation and multi-window layout with Rust commands and persisted geometry.
**Acceptance:** Match desktop 2D/3D split, tool access, preferences, file state and reopening; comparison screenshot and keyboard walkthrough.

### UI: 3D viewport & simulation
**Rust approach:** egui_wgpu / upstream render.rs; migrate all 3D view manipulation, solve playback, overlay legends and GPU memory handling while keeping solver independent of render.
**Acceptance:** Camera/picking/parity and stable CPU/GPU frame playback with versioned document, no ghost frame.

### UI: Other UI components
**Rust approach:** Audit every uncategorized UI file before assigning to egui widget groups, underlying Rust services or optional non-critical UI; inventory CSS theme tokens.
**Acceptance:** File-by-file 100% ownership and screenshot/interactions acceptance; no silent deletion.

### UI: Tech packs & specifications
**Rust approach:** Native egui techpack page editor driven by Rust BOM/POM/spec document; import visual page objects and responsive grids.
**Acceptance:** Export PDF/XLSX with same engineering content, page rendering and saved edit history.

### UI: Tools, inspectors & settings
**Rust approach:** Convert React inspectors, color/theme settings, commands, palettes, custom widgets to typed Rust egui state and persisted preferences.
**Acceptance:** All panel controls, shortcuts, customizations, undo routing and layout restoration tested.

### UI: CAD drawing & pattern editing
**Rust approach:** Create Rust 2D canvas using upstream authoring and egui painter with calibrated coordinate space, snapping and selection.
**Acceptance:** DPI/zoom/pointer/snap parity, millimeter ruler, multi-step undo and real sketch-to-pattern smoke.

### UI: Factory & interchange
**Rust approach:** Eg ui factory panels, DXF import/export dialogs, size marker controls and clear production safety flags backed by Rust validation.
**Acceptance:** UI cannot authorize invalid CUT; generated DXF/PDF and marker metadata match Rust project.

### UI: Sewing & construction
**Rust approach:** Use upstream atelier/seams_ui.rs and seam_links.rs to build native edge binding, stitch direction, sewing status and staged construction panels.
**Acceptance:** Real pointer seam connection, orphan rejection, cold reopen and sewn mesh view consistency.

### UI: Grading & measurements
**Rust approach:** Native egui grading table, six-size overlay, formula and POM inspectors bound directly to Rust master size run.
**Acceptance:** Real edit/Save/Undo/Redo on six distinct graded sizes, output coordinate equivalence.

### UI: Libraries & references
**Rust approach:** Rust catalog previews, template browser, searchable indexed file library, image import and provenance panel.
**Acceptance:** Source hash/rights displayed; valid file open, missing asset and migration behaviors tested.

### UI: Fabrics, trims & materials
**Rust approach:** Native color/fabric browser, physically meaningful material sliders and trim placement via egui/wgpu and Rust material records.
**Acceptance:** Optical-only change does not reset physics; mechanical edit does, with exact texture and visual QA.

### UI: AI & assistant
**Rust approach:** Native conversational/agent panel invokes validated Rust tool commands; keep ML services optional isolated integrations.
**Acceptance:** Review/diff before apply, unauthorized proposal rejection and no factory-ready claim from AI output.

## Global release gates and evidence

1. No repository-wide rewrite in one step: each migration unit is a module or transaction with traced current runtime ownership, source hash and accepted tests.
2. One shared project source of truth using versioned Rust structs, metres/kilograms/seconds/Newtons internally and explicit mm conversions at manufacturing/export boundaries.
3. Clean original erythrofr/ClothCraft baseline must build/test without EXO patches; EXO Rust adapters must build against pinned upstream APIs; upstream patch proposals stay separately reviewable.
4. For each system: golden source fixtures, JS/C++/Python-to-Rust parity where reference is reliable, malformed-input negatives, integrated UI command tests, undo/reopen and migration/recovery checks.
5. No tested source module automatically qualifies as active installed code; stage exact binary hashes, CPU/GPU feature metadata, new-app installer evidence and rollback.
6. Production exports need independent external CAD and measured print/cutter evidence; drape/fit needs physical and multi-frame contact acceptance; never infer certification from percentages.
7. Native UI migration captures feature inventory, interaction contracts, screenshots, keyboard access and persistency; current React desktop remains operational until Rust egui UI passes independent parity.
8. Every system and UI area gets a tracked owner, upstream compatibility version, acceptance reviewer, positive and negative tests; percent increases require durable proof of source/runtime migration.

## Source interpretation and initial benchmark

App code in combined scoped audit = 138,170 backend lines + 81,128 UI code/style lines = 219,298 source/style lines; within that scope UI contributes 36.99% of lines and backend 63.01%. These line shares are not man-hours, product-feature coverage, runnable Rust migration or vendor parity.

**First execution order:** Freeze backup and upstream ref; implement versioned adapter and history; then one six-size tee CAD-to-Rust-to-UI-to-CUT roundtrip; after the signed evidence, migrate upstream-compatible sewn mesh, solver, production exporters, UI widgets and distribution. Avoid rewriting legacy engine branches before end-to-end parity.
