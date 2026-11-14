# EXO ClothCraft Studio V2 — Backend source-language inventory (2026-11-14)

Working-tree HEAD: `53041a6` (dirty/uncommitted source is included). Backend-related first-party code-like scope: 1312 mapped source files including upstream-derived native Rust engine, 138,170 EXO-code-scope lines; native engine separately 33,918 Rust lines.

## Important interpretation

This is a file-path/name-based **source composition inventory** only. It does not prove runtime ownership, feature completion, or Rust implementation parity. Native Rust engine under `research/oss/clothcraft` is separately listed; it may be upstream-derived. `src/App.jsx`, `src/components/`, and other UI-side application logic are excluded intentionally. A dated research/prototype module may not be active. Browser import reachability is only a proxy; dynamic/injected modules need follow-up.

First-party-like scoped source shares: C++ 13,824 lines (10.0%), JS 104,670 lines (75.8%), Python 8,868 lines (6.4%), Rust 7,128 lines (5.2%), Swift 3,680 lines (2.7%).

## Breakdown

| # | Backend system | Files | JS % | Rust % | C/C++ % | Python % | EXO-scoped source lines | Additional native Rust engine lines |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 01 | Project model / source-of-truth | 32 | 34.1% | 1.6% | 64.2% | 0.0% | 3,277 | 0 |
| 02 | Drafting primitives and snapping | 33 | 64.4% | 4.8% | 29.2% | 1.7% | 2,815 | 327 |
| 03 | Curves, freehand and geometry | 29 | 70.0% | 30.0% | 0.0% | 0.0% | 2,567 | 232 |
| 04 | Topology / split / unfold / mirror | 12 | 71.0% | 14.6% | 0.0% | 14.5% | 1,058 | 53 |
| 05 | Parametric references / formulas | 10 | 100.0% | 0.0% | 0.0% | 0.0% | 1,493 | 1,473 |
| 06 | Pattern grading / size runs | 62 | 89.6% | 3.5% | 6.9% | 0.0% | 7,408 | 298 |
| 07 | Measurements / POM / body charts | 19 | 82.9% | 5.0% | 12.1% | 0.0% | 1,865 | 666 |
| 08 | Sewing / seam matching | 33 | 73.1% | 9.0% | 9.5% | 8.4% | 3,508 | 589 |
| 09 | Darts / pleats / facings | 8 | 53.6% | 0.0% | 0.0% | 46.4% | 824 | 0 |
| 10 | Allowance / notch / cutline | 29 | 91.5% | 4.5% | 4.0% | 0.0% | 3,170 | 304 |
| 11 | Cloth mesh / tessellation | 19 | 43.7% | 16.9% | 39.4% | 0.0% | 1,161 | 371 |
| 12 | Cloth physics and solver | 89 | 65.9% | 3.2% | 11.8% | 19.1% | 15,839 | 1,820 |
| 13 | Collision / contact / penetration | 54 | 77.7% | 9.4% | 11.3% | 1.5% | 5,157 | 89 |
| 14 | Garment fit / stage / drape | 53 | 31.9% | 2.9% | 12.6% | 52.7% | 6,460 | 1,414 |
| 15 | Avatar / pose / animation | 11 | 69.6% | 0.0% | 17.1% | 13.2% | 794 | 461 |
| 16 | Fabric mechanics / materials | 30 | 88.9% | 8.6% | 2.5% | 0.0% | 3,052 | 878 |
| 17 | Fabric visuals / textures / PBR | 22 | 62.0% | 14.4% | 23.7% | 0.0% | 1,682 | 0 |
| 18 | Hardware / fastener / trims | 11 | 86.2% | 0.0% | 13.8% | 0.0% | 877 | 0 |
| 19 | Garment print graphics / embroidery | 1 | 100.0% | 0.0% | 0.0% | 0.0% | 405 | 0 |
| 20 | Foam / padding / trapunto | 5 | 75.3% | 24.7% | 0.0% | 0.0% | 570 | 0 |
| 21 | 3D export and scene assets | 5 | 7.7% | 0.0% | 92.3% | 0.0% | 351 | 0 |
| 22 | Marker layout / nesting / yield | 34 | 82.4% | 5.2% | 12.4% | 0.0% | 4,352 | 0 |
| 23 | DXF / CAD interop | 90 | 89.9% | 0.3% | 9.8% | 0.0% | 11,648 | 0 |
| 24 | SVG / PDF / physical plot | 18 | 80.9% | 2.6% | 16.4% | 0.0% | 1,473 | 0 |
| 25 | Factory preflight / measurement QA | 37 | 86.8% | 3.6% | 9.7% | 0.0% | 3,635 | 0 |
| 26 | Production packages / factory orders | 69 | 91.2% | 0.0% | 3.3% | 5.5% | 8,746 | 0 |
| 27 | Techpacks / BOM / specification | 94 | 91.7% | 2.8% | 5.6% | 0.0% | 7,894 | 0 |
| 28 | Cost / pricing / estimates | 6 | 45.3% | 21.6% | 33.1% | 0.0% | 495 | 0 |
| 29 | Persistence / undo / history / restore | 18 | 93.6% | 4.0% | 0.0% | 2.5% | 2,469 | 0 |
| 30 | Libraries / templates / presets | 33 | 93.0% | 0.0% | 3.2% | 3.8% | 4,251 | 952 |
| 31 | Image digitizing / vision / references | 8 | 79.9% | 0.0% | 0.0% | 20.1% | 742 | 0 |
| 32 | AI assistant / generation / automation | 29 | 95.2% | 0.0% | 0.0% | 4.8% | 3,828 | 0 |
| 33 | API / processes / transport | 64 | 53.3% | 23.0% | 20.5% | 3.2% | 7,093 | 4,240 |
| 34 | Collaboration / security / sync | 7 | 82.7% | 17.3% | 0.0% | 0.0% | 871 | 0 |
| 35 | Diagnostics / performance / misc | 5 | 94.6% | 0.0% | 0.0% | 5.4% | 221 | 28 |
| 36 | Native Rust editor / backend UI glue | 0 | 0.0% | 0.0% | 0.0% | 0.0% | 0 | 5,960 |
| 37 | Native Rust engine shared core | 7 | 5.1% | 94.9% | 0.0% | 0.0% | 471 | 13,438 |
| 38 | Unclassified JS business logic | 108 | 100.0% | 0.0% | 0.0% | 0.0% | 9,221 | 0 |
| 39 | Workspace commands / tools / preferences | 35 | 87.5% | 4.9% | 7.6% | 0.0% | 2,208 | 325 |
| 40 | macOS native host / lifecycle | 5 | 0.0% | 0.0% | 0.0% | 0.0% | 3,680 | 0 |
| 41 | Other backend source | 5 | 81.8% | 0.0% | 0.0% | 18.2% | 539 | 0 |

## Per-system source file evidence

### 01 Project model / source-of-truth
EXO code-like files: 32; code lines: 3,277; static-linked JS lines: 956; filename-flagged exploratory/review lines: 162.
Representative source: `src/data/defaultProject.js`, `native_cpp/core/garment_document.cpp`, `src/core/project.js`, `native_cpp/core/clothcraft_export.cpp`, `native_cpp/core/native_simulation_payload_builder.cpp`, `native_cpp/core/pattern_mesh.cpp`, `native_cpp/core/native_payload.cpp`

### 02 Drafting primitives and snapping
EXO code-like files: 33; code lines: 2,815; static-linked JS lines: 1,083; filename-flagged exploratory/review lines: 91.
Representative source: `src/core/draftingTopology.js`, `src/core/draftingUnfold.js`, `src/core/draftingPrecision.js`, `native_cpp/core/drafting_snapping.cpp`, `src/core/draftingSnapping.js`, `native_cpp/core/drafting_precision.cpp`, `src/core/accumarkLineConstruction20261024_1341.js`
Native Rust engine dependency: `research/oss/clothcraft/src/atelier/drafting_ui.rs`

### 03 Curves, freehand and geometry
EXO code-like files: 29; code lines: 2,567; static-linked JS lines: 776; filename-flagged exploratory/review lines: 79.
Representative source: `src/core/nativeFreeCurvePoints.js`, `src/core/vectorPatternBezier.js`, `rust/exo_geometry_kernel/src/lib.rs`, `src/core/rustGeometryKernel.js`, `src/core/modarisDerivedContour20261027.js`, `src/core/advancedCadCurveHandle20261024_1423.js`, `src/core/advancedCadGradedCurveQA20261024_1423.js`
Native Rust engine dependency: `research/oss/clothcraft/src/garment/precision_curve_20261030.rs`, `research/oss/clothcraft/src/garment/curves.rs`

### 04 Topology / split / unfold / mirror
EXO code-like files: 12; code lines: 1,058; static-linked JS lines: 238; filename-flagged exploratory/review lines: 11.
Representative source: `src/core/accumarkCurvedSourceRigidTransform20261024_1400.js`, `blender_bridge/tune_ppf_shoulder_folds.py`, `src/core/gradedStraightEdgeSplit20261024_1453.js`, `src/core/accumarkPieceRigidActions20261024_1341.js`, `rust/exo_split_kernel/src/lib.rs`, `src/core/appLinkedMirror20261030.mjs`, `src/core/rustSplitKernel.js`
Native Rust engine dependency: `research/oss/clothcraft/src/ogc/topology.rs`

### 05 Parametric references / formulas
EXO code-like files: 10; code lines: 1,493; static-linked JS lines: 0; filename-flagged exploratory/review lines: 1,104.
Representative source: `src/core/modarisNativeFreeKnotReactiveWitness20261027.js`, `src/core/nativeParametricPoint20261023.js`, `src/core/modarisNativeIndustrialReactiveWitness20261027.js`, `src/core/nativeParametricFormula20261023.js`, `src/core/modarisNativeReferenceRecompute20261027.js`, `src/core/modarisNativeCrossPieceReference20261027.js`, `src/core/accumarkReferencePieceExtraction20261024_1341.js`
Native Rust engine dependency: `research/oss/clothcraft/src/native_facing_dependency_20261027.rs`, `research/oss/clothcraft/src/native_reference_recompute_20261027.rs`, `research/oss/clothcraft/src/native_cross_piece_link_20261030.rs`

### 06 Pattern grading / size runs
EXO code-like files: 62; code lines: 7,408; static-linked JS lines: 1,828; filename-flagged exploratory/review lines: 887.
Representative source: `src/core/grading.js`, `src/core/nativeGradingPOM20261025.js`, `native_cpp/core/grading.cpp`, `src/core/nativeGradeIndependentReviewEvidence20261027.js`, `rust/exo_grading_kernel/src/lib.rs`, `src/core/nativeGradingPhysicalSampleReview20261026.js`, `src/core/jeans501WaistGradeCandidate.js`
Native Rust engine dependency: `research/oss/clothcraft/src/grade_pom_audit_20261027.rs`

### 07 Measurements / POM / body charts
EXO code-like files: 19; code lines: 1,865; static-linked JS lines: 627; filename-flagged exploratory/review lines: 0.
Representative source: `src/core/measurements.js`, `native_cpp/core/measurement_export.cpp`, `src/core/modarisNativeMultiPanelMeasurementCommit20261030.js`, `src/core/modarisNativeMeasurementCommit20261027.js`, `src/core/vectorcraftPenDimensions20261025.js`, `src/core/seamlyMeasurements.js`, `src/core/nativeGradeFactoryMeasurementMatrix20261025.js`
Native Rust engine dependency: `research/oss/clothcraft/src/native_measurement_formulas_20261027.rs`, `research/oss/clothcraft/src/native_multi_panel_measurement_20261030.rs`

### 08 Sewing / seam matching
EXO code-like files: 33; code lines: 3,508; static-linked JS lines: 558; filename-flagged exploratory/review lines: 533.
Representative source: `integrations/clothcraft/seam-prediction-research-20261102.py`, `src/core/backends/nativeSeamCandidateGate.js`, `src/core/gradedComplexSeamConstructionAcceptance20261024_1501.js`, `src/core/industrialGradedSeamCorrection20261024_1516.js`, `native_cpp/core/cloth_seam_constraints.cpp`, `src/core/sewingMismatchRepair20261024.js`, `src/core/industrialSixSizeSeamContinuity20261024.js`
Native Rust engine dependency: `research/oss/clothcraft/src/garment/seam.rs`, `research/oss/clothcraft/src/atelier/seam_links.rs`, `research/oss/clothcraft/src/atelier/seams_ui.rs`

### 09 Darts / pleats / facings
EXO code-like files: 8; code lines: 824; static-linked JS lines: 0; filename-flagged exploratory/review lines: 65.
Representative source: `src/core/accumarkLinkedFacing20261027.js`, `src/core/nativePhysicalPleat20261025.js`, `blender_bridge/refine_501_cuffs_and_shoes.py`, `blender_bridge/finalize_501_hem_material_v12.py`, `blender_bridge/project_501_hem_stitches_to_surface.py`, `src/core/nativeDartPrecision20261023.js`, `src/core/experimentalDartGeometry20261023.js`

### 10 Allowance / notch / cutline
EXO code-like files: 29; code lines: 3,170; static-linked JS lines: 1,601; filename-flagged exploratory/review lines: 168.
Representative source: `src/core/physicalCutOverlapPreflight20261023_2000.mjs`, `src/core/industrialCutterQualification20261028.mjs`, `src/core/approvedGradedNotchGeometry20261023_1600.js`, `src/core/gradedNotchIntervalAudit.js`, `src/core/approvedNotchGeometry20261023_1500.js`, `src/core/industrialAamaAllowanceOffset20261028.mjs`, `src/core/industrialAllowanceLinks20261027.js`
Native Rust engine dependency: `research/oss/clothcraft/src/garment/cutline.rs`

### 11 Cloth mesh / tessellation
EXO code-like files: 19; code lines: 1,161; static-linked JS lines: 0; filename-flagged exploratory/review lines: 93.
Representative source: `native_cpp/core/cloth_meshing_pipeline.cpp`, `native_cpp/core/quality_triangulation.cpp`, `src/core/physics/qualityTriangulation.js`, `native_cpp/core/cloth_meshing.cpp`, `src/core/physics/restMeshFidelityResearch.js`, `rust/exo_foam_triangulation_kernel/src/lib.rs`, `src/core/clothMeshing.js`
Native Rust engine dependency: `research/oss/clothcraft/src/garment/meshing.rs`

### 12 Cloth physics and solver
EXO code-like files: 89; code lines: 15,839; static-linked JS lines: 152; filename-flagged exploratory/review lines: 6,409.
Representative source: `src/core/physics.js`, `native_backend/src/garment_xpbd_cli.cpp`, `blender_bridge/ppf_run_configured.py`, `src/core/backends/ppfPayload.js`, `blender_bridge/ppf_prepare_scene.py`, `src/core/backends/nativeSleeveCoupledCandidateAdmissionResearch20261025.js`, `blender_bridge/ppf_body_tee_pipeline.py`
Native Rust engine dependency: `research/oss/clothcraft/src/solver.rs`, `research/oss/clothcraft/src/gpu_vbd.rs`, `research/oss/clothcraft/src/vbd.rs`

### 13 Collision / contact / penetration
EXO code-like files: 54; code lines: 5,157; static-linked JS lines: 341; filename-flagged exploratory/review lines: 3,089.
Representative source: `src/core/backends/nativeCoupledClothContactResearch.js`, `src/core/backends/nativeIntrapanelContactResearch.js`, `src/core/backends/nativeSleeveCreaseQualityContactResearch20261025.js`, `rust/exo_self_collision_pass_kernel/src/lib.rs`, `src/core/accumarkMarkerRulerInkClearance20261024.mjs`, `src/core/physics/selfCollision.js`, `rust/exo_self_collision_kernel/src/w11_spatial_candidates.rs`
Native Rust engine dependency: `research/oss/clothcraft/src/contact.rs`

### 14 Garment fit / stage / drape
EXO code-like files: 53; code lines: 6,460; static-linked JS lines: 811; filename-flagged exploratory/review lines: 338.
Representative source: `blender_bridge/import_garment.py`, `blender_bridge/finish_501_lightwash.py`, `blender_bridge/nonrigid_ppf_assembly.py`, `native_cpp/core/seam_assembly_advanced.cpp`, `blender_bridge/build_501_onbody_reference.py`, `src/core/sewingAssemblyWorkflow20261024.js`, `src/core/backends/seamAssembly.js`
Native Rust engine dependency: `research/oss/clothcraft/src/fitting.rs`

### 15 Avatar / pose / animation
EXO code-like files: 11; code lines: 794; static-linked JS lines: 69; filename-flagged exploratory/review lines: 0.
Representative source: `src/core/avatarWornTeeDisplay.js`, `src/core/avatarWalkPreview20261025.js`, `native_cpp/core/avatar_surface_correction.cpp`, `integrations/clothcraft/attach-exo-skeletal-walk-to-clothed-glb-20261102.py`, `src/core/exoAvatarRenderedMediaRights20261102.js`, `src/data/avatarWornTeeNativeProject.js`, `src/core/exoAvatarHairStyling20261102.js`
Native Rust engine dependency: `research/oss/clothcraft/src/avatar.rs`

### 16 Fabric mechanics / materials
EXO code-like files: 30; code lines: 3,052; static-linked JS lines: 644; filename-flagged exploratory/review lines: 244.
Representative source: `src/core/clothcraftFabrics.js`, `src/core/clothcraftFabricSurface.js`, `src/core/modarisFabricBoundChart20261027.js`, `src/data/polyhavenFabricAssignments.js`, `rust/exo_fabric_kernel/src/calibration.rs`, `src/core/fabricAssetRegistry.js`, `src/core/fabricEvidenceCalibration.js`
Native Rust engine dependency: `research/oss/clothcraft/src/native_fabric_grade_chart_20261027.rs`, `research/oss/clothcraft/src/fabrics.rs`, `research/oss/clothcraft/src/atelier/fabrics_ui.rs`

### 17 Fabric visuals / textures / PBR
EXO code-like files: 22; code lines: 1,682; static-linked JS lines: 382; filename-flagged exploratory/review lines: 0.
Representative source: `src/core/textileProcedurals.js`, `src/core/clothWashProcedurals.js`, `src/core/clothWashImage.js`, `rust/exo_pbr_pixels_kernel/src/lib.rs`, `src/core/fabricPbrAppearance.js`, `native_cpp/core/fabric_pbr_pixels.cpp`, `src/data/fabricTextureLibrarySources.js`

### 18 Hardware / fastener / trims
EXO code-like files: 11; code lines: 877; static-linked JS lines: 602; filename-flagged exploratory/review lines: 0.
Representative source: `src/data/hardwarePresets.js`, `src/core/clo7NativeHardwareActions.js`, `src/core/importedCloHardware3D.js`, `native_cpp/core/trims.cpp`, `src/core/trims.js`, `src/data/cloImportedHardwareCatalog.js`, `src/core/appHardwarePresetValues20261030.mjs`

### 19 Garment print graphics / embroidery
EXO code-like files: 1; code lines: 405; static-linked JS lines: 0; filename-flagged exploratory/review lines: 0.
Representative source: `src/core/nativeGarmentGraphics.js`

### 20 Foam / padding / trapunto
EXO code-like files: 5; code lines: 570; static-linked JS lines: 0; filename-flagged exploratory/review lines: 0.
Representative source: `src/core/foamPaddingGeometry.js`, `rust/exo_foam_kernel/src/lib.rs`, `src/core/foamCompressionModel.js`, `src/core/rustFoamKernel.js`, `src/core/foamPaddingPatternExport.js`

### 21 3D export and scene assets
EXO code-like files: 5; code lines: 351; static-linked JS lines: 27; filename-flagged exploratory/review lines: 0.
Representative source: `native_cpp/core/gltf_export.cpp`, `native_cpp/core/obj_export.cpp`, `src/data/stagePresets.js`, `native_cpp/core/gltf_export.hpp`, `native_cpp/core/obj_export.hpp`

### 22 Marker layout / nesting / yield
EXO code-like files: 34; code lines: 4,352; static-linked JS lines: 1,916; filename-flagged exploratory/review lines: 139.
Representative source: `src/core/accumarkMarkerProduction20261023.js`, `integrations/clothcraft/native-verified-single-ply-roll-plan-run44.mjs`, `native_cpp/core/marker_layout.cpp`, `src/core/accumarkMarkerPlotParity20261024.mjs`, `src/core/markerArtifacts.js`, `rust/exo_marker_kernel/src/lib.rs`, `native_cpp/core/marker_pdf.cpp`

### 23 DXF / CAD interop
EXO code-like files: 90; code lines: 11,648; static-linked JS lines: 5,339; filename-flagged exploratory/review lines: 1,514.
Representative source: `src/core/dxf.js`, `src/core/modarisConnectedDevelopmentReceiver20261101.js`, `native_cpp/core/dxf_import.cpp`, `src/core/modarisToolbarCatalog20261028.js`, `integrations/clothcraft/valentinaUniversalSeamlyBridge20261031.mjs`, `native_cpp/core/construction_dxf.cpp`, `src/core/modaris2DGradeDraftJournal20261029.js`

### 24 SVG / PDF / physical plot
EXO code-like files: 18; code lines: 1,473; static-linked JS lines: 450; filename-flagged exploratory/review lines: 20.
Representative source: `src/core/printLayout20261025.js`, `native_cpp/core/marker_svg.cpp`, `src/core/techPackSvgToNativePaths20261031.js`, `src/core/accumarkPrintedPageRegistration20261024.mjs`, `src/core/svgPatternImport.js`, `src/core/accumarkMarkerSafePageBreaks20261024.mjs`, `src/core/printPatternAppearance20261025.js`

### 25 Factory preflight / measurement QA
EXO code-like files: 37; code lines: 3,635; static-linked JS lines: 998; filename-flagged exploratory/review lines: 285.
Representative source: `src/core/industrialSignedNotchReceivingGate20261030.mjs`, `native_cpp/core/production_preflight.cpp`, `src/core/industrialReceivingRegistryVersionFloor20261029.mjs`, `src/core/factorySampleApproval.js`, `src/core/industrialReceivingSignedEvidence20261028.mjs`, `src/core/productionPreflight.js`, `src/core/industrialReceivingEntityInventory20261028.mjs`

### 26 Production packages / factory orders
EXO code-like files: 69; code lines: 8,746; static-linked JS lines: 3,156; filename-flagged exploratory/review lines: 432.
Representative source: `src/core/factoryPackage.js`, `integrations/clothcraft/native-verified-cutroom-intake-run44.mjs`, `src/core/factoryZipMetadataGuard20261024_0400.mjs`, `src/core/industrialSignedFactoryZipIsolated20261030.mjs`, `src/core/nativeVerifiedProductionOrderClient20261029.js`, `src/core/factoryZipIndependentRasterHardened20261024_1854.py`, `integrations/clothcraft/native-verified-order-handoff-run36-20261029.mjs`

### 27 Techpacks / BOM / specification
EXO code-like files: 94; code lines: 7,894; static-linked JS lines: 354; filename-flagged exploratory/review lines: 0.
Representative source: `src/core/techPackWorkspacePrint.js`, `src/core/techPackPageComposer.js`, `src/core/techpack-spreadsheet/exporterXlsx.js`, `src/core/techPackVectorPathTools20261031.js`, `src/core/techpack-spreadsheet/gridcraftTableCommands20261030.js`, `src/core/techPackVisualThemes20261031.js`, `native_cpp/core/tech_pack_export.cpp`

### 28 Cost / pricing / estimates
EXO code-like files: 6; code lines: 495; static-linked JS lines: 188; filename-flagged exploratory/review lines: 0.
Representative source: `native_cpp/core/fabric_cost.cpp`, `src/core/rustFabricCostKernel.js`, `rust/exo_fabric_cost_kernel/src/lib.rs`, `src/core/productionCost.js`, `rust/exo_fabric_cost_kernel/build.mjs`, `native_cpp/core/fabric_cost.hpp`

### 29 Persistence / undo / history / restore
EXO code-like files: 18; code lines: 2,469; static-linked JS lines: 1,307; filename-flagged exploratory/review lines: 0.
Representative source: `integrations/clothcraft/workspace.mjs`, `integrations/clothcraft/nativeMirrorTransaction20261030.mjs`, `src/core/nativeGradeSidecarCodec.js`, `src/core/accumarkNativeGradedTemplateTransaction20261024.js`, `src/core/modarisNativeSixSizeDependencyTransaction20261027.js`, `src/core/projectRestore.js`, `src/core/nativeGradeCanonicalSizeTransaction20261028.js`

### 30 Libraries / templates / presets
EXO code-like files: 33; code lines: 4,251; static-linked JS lines: 2,779; filename-flagged exploratory/review lines: 97.
Representative source: `src/data/templates.js`, `src/core/projectFileLibrary.js`, `src/core/garmentCode.js`, `src/core/accumarkCommandParityCatalog20261024.js`, `src/data/jeans501.js`, `src/core/nativeGradeCatalogBridge20261025.js`, `src/core/exoTemplateSeamTrueing20261102.js`
Native Rust engine dependency: `research/oss/clothcraft/src/garment/template.rs`, `research/oss/clothcraft/src/garment/presets.rs`, `research/oss/clothcraft/src/bin/cloth-template.rs`

### 31 Image digitizing / vision / references
EXO code-like files: 8; code lines: 742; static-linked JS lines: 0; filename-flagged exploratory/review lines: 312.
Representative source: `src/core/exoGarmentPhotoReference20261102.js`, `integrations/clothcraft/pattern-source-geometry-20261102.py`, `src/core/accumarkPhotoDigitize20261024.js`, `src/core/exoLocalPhotoVisionClient20261102.js`, `src/core/accumarkDigitizing20261023.js`, `src/core/referenceImageDrop20261028.js`, `src/core/referenceImageImportGate20261029.js`

### 32 AI assistant / generation / automation
EXO code-like files: 29; code lines: 3,828; static-linked JS lines: 791; filename-flagged exploratory/review lines: 399.
Representative source: `src/core/exoCompanionExperience20261102.js`, `src/core/exoCompanionVoice20261102.js`, `integrations/clothcraft/agent-api.mjs`, `src/core/exoCompanionCharacterPreferences20261102.js`, `src/core/exoCompanionCommands20261102.js`, `integrations/clothcraft/pattern-synthesis-model-20261102.py`, `src/core/exoTextSketchPatternCandidate20261102.js`

### 33 API / processes / transport
EXO code-like files: 64; code lines: 7,093; static-linked JS lines: 2,977; filename-flagged exploratory/review lines: 164.
Representative source: `native_cpp/cli/main.cpp`, `integrations/clothcraft/exo-session.rs`, `integrations/clothcraft/server.mjs`, `ppf_backend/server.mjs`, `integrations/clothcraft/rust-mcp-server/src/main.rs`, `integrations/clothcraft/runtime-provenance.mjs`, `src/core/backends/nativeServiceBackend.js`
Native Rust engine dependency: `research/oss/clothcraft/src/bin/exo-session.rs`

### 34 Collaboration / security / sync
EXO code-like files: 7; code lines: 871; static-linked JS lines: 603; filename-flagged exploratory/review lines: 0.
Representative source: `integrations/clothcraft/collaboration.mjs`, `rust/exo_collaboration_sse_kernel/src/lib.rs`, `src/core/projectCollaborationClient.js`, `src/core/patternVisualTokens.js`, `src/core/rustCollaborationSseKernel.js`, `integrations/clothcraft/agent-key-store.mjs`, `integrations/clothcraft/workspace-auth.mjs`

### 35 Diagnostics / performance / misc
EXO code-like files: 5; code lines: 221; static-linked JS lines: 36; filename-flagged exploratory/review lines: 0.
Representative source: `src/core/accumarkSewlineMismatchDiagnostic20261023.js`, `src/core/sewingLengthDiagnostics.js`, `ppf_backend/stagingDiagnostics.mjs`, `blender_bridge/inspect_fit_scene.py`, `ppf_backend/processStatus.mjs`
Native Rust engine dependency: `research/oss/clothcraft/src/garment/diagnostics.rs`

### 36 Native Rust editor / backend UI glue
EXO code-like files: 0; code lines: 0; static-linked JS lines: 0; filename-flagged exploratory/review lines: 0.
Native Rust engine dependency: `research/oss/clothcraft/src/atelier/board.rs`, `research/oss/clothcraft/src/atelier/icons.rs`, `research/oss/clothcraft/src/atelier/authoring_ui.rs`

### 37 Native Rust engine shared core
EXO code-like files: 7; code lines: 471; static-linked JS lines: 0; filename-flagged exploratory/review lines: 0.
Representative source: `rust/exo_ui_kernel/src/lib.rs`, `rust/exo_material_guide_kernel/src/lib.rs`, `rust/exo_core_math_kernel/src/lib.rs`, `rust/exo_selection_metrics_kernel/src/lib.rs`, `rust/exo_anchor_kernel/src/lib.rs`, `src/core/garmentPreviewPaging.js`, `rust/exo_preview_offset_kernel/src/lib.rs`
Native Rust engine dependency: `research/oss/clothcraft/src/authoring.rs`, `research/oss/clothcraft/src/native_six_size_recompute_20261027.rs`, `research/oss/clothcraft/src/render.rs`

### 38 Unclassified JS business logic
EXO code-like files: 108; code lines: 9,221; static-linked JS lines: 2,711; filename-flagged exploratory/review lines: 1,347.
Representative source: `src/core/backends/nativePayload.js`, `src/core/manufacturingReleaseReadiness.js`, `src/core/backends/nativeFoundationTeeHingedBodyConstraintInventory20261025.js`, `src/core/industrialPatternQA.js`, `src/core/backends/nativeCreaseRepairCandidateGate20261024.js`, `src/core/nativePatternConstraintBindings20261023.js`, `src/core/createStageEnvironment.js`

### 39 Workspace commands / tools / preferences
EXO code-like files: 35; code lines: 2,208; static-linked JS lines: 1,097; filename-flagged exploratory/review lines: 0.
Representative source: `src/core/themePresetManager.js`, `src/core/clo7NativeToolCapabilities.js`, `src/core/cloPropertyCommands.js`, `src/core/exoSettingsColorPresets20261028.js`, `src/core/studioCustomization.js`, `src/data/clo7ToolbarOrder.js`, `rust/exo_command_contract/src/lib.rs`
Native Rust engine dependency: `research/oss/clothcraft/src/atelier/settings.rs`

### 40 macOS native host / lifecycle
EXO code-like files: 5; code lines: 3,680; static-linked JS lines: 0; filename-flagged exploratory/review lines: 0.
Representative source: `integrations/clothcraft/macos/clo-inspector-bridge/main.swift`, `integrations/clothcraft/macos/EXOClothCraftWorkspaceV2.swift`, `integrations/clothcraft/macos/EXOClothCraftWorkspace.swift`, `integrations/clothcraft/macos/EXOClothCraft.swift`, `integrations/clothcraft/macos/vision-hand-landmarks.swift`

### 41 Other backend source
EXO code-like files: 5; code lines: 539; static-linked JS lines: 279; filename-flagged exploratory/review lines: 0.
Representative source: `techpack-studio/src/model.js`, `integrations/clo_sdk/cli.mjs`, `integrations/clo_sdk/plan_501_arrangement.py`, `techpack-studio/src/visualModel.js`, `src/hooks/useNativeWorkspaceRequest.js`

## Known omissions
- React UI logic and state across `src/App.jsx` and `src/components/` (not separable by source file name); converting all backend requires extracting relevant actions from these components.
- Tests, QA, generated WASM, vendor assets, subrepo clones and dated historical Rust-session snapshots deliberately excluded from percentages.
- Several systems contain many exploratory implementations whose presence should not be treated as production ownership.
- Line counts count header declarations and duplicate implementations; they do not weight capability complexity or identify the deployed process.
- A conversion-completion percentage requires execution-trace provenance, accepted semantic contracts and regression tests, not just source language.

## Conversion work ordered by system

Items tagged `Keep` are excluded from the initial Rust-first backend conversion. This is an engineering work inventory, not a certified percentage-complete measurement.

### 01 Project model / source-of-truth
**Purpose:** Define panels, fabrics, seams, stable IDs and authoritative edits.
**Rust-first action:** Finish one Rust document schema, transactions and compatibility reader. Retire duplicate JS/C++ model writes.
**Priority:** P0

### 02 Drafting primitives and snapping
**Purpose:** Points, straight lines, rulers, projections, snapping and numeric construction.
**Rust-first action:** Move exact arithmetic and validation into Rust; retain display and pointer events in React.
**Priority:** P1

### 03 Curves, freehand and geometry
**Purpose:** Control points, cubic curves, freehand fitting and material-length measurements.
**Rust-first action:** Unify curve, intersection and length calculations in Rust, audit WASM fallback paths and parity.
**Priority:** P1

### 04 Topology / split / unfold / mirror
**Purpose:** Split, mirror, unfold, boolean edits and transformations of pattern pieces.
**Rust-first action:** Make Rust own topology changes and preserve seam/measurement references, Undo and reopen.
**Priority:** P1

### 05 Parametric references / formulas
**Purpose:** Formula dependencies, cross-piece constructions, and automatic recomputation.
**Rust-first action:** One versioned Rust dependency graph, cycle checking, invalidation and atomic recalculation.
**Priority:** P1

### 06 Pattern grading / size runs
**Purpose:** Rules, point deltas, size correspondence, chart and pattern size runs.
**Rust-first action:** Finish canonical Rust grade operations, per-size persistence, Rust/EXO UI routing and independent production fixtures.
**Priority:** P1

### 07 Measurements / POM / body charts
**Purpose:** Named garment/body measurements, rulers, size charts and measurement history.
**Rust-first action:** Rust owns physical units, stable targets, referenced points and per-size recalculation.
**Priority:** P1

### 08 Sewing / seam matching
**Purpose:** Connects boundaries with direction, easing, notches and partial seams.
**Rust-first action:** Single Rust sewing contract and compiler; eliminate alternate JS/C++ sewing authorities.
**Priority:** P1

### 09 Darts / pleats / facings
**Purpose:** Darts, pleats, facings, folds, tucks and sewing-related transformations.
**Rust-first action:** Add validated Rust construction operations and separate visual annotations from physically cut geometry.
**Priority:** P2

### 10 Allowance / notch / cutline
**Purpose:** Seam allowances, notches, drill holes, cutter boundaries, sewing-line offsets.
**Rust-first action:** Move precise cutting geometry, joins and boundary references into Rust with negative cases.
**Priority:** P1

### 11 Cloth mesh / tessellation
**Purpose:** Panel tessellation, quality metrics, remeshing and particle mapping.
**Rust-first action:** One Rust meshing/compilation path; preserve material IDs, constraints and drape invalidation.
**Priority:** P1

### 12 Cloth physics and solver
**Purpose:** VBD/OGC, PBD/XPBD research, constraints, stiffness, stepping and time state.
**Rust-first action:** Keep a validated Rust production solver; remove competing browser/C++ authority only after equivalent collision tests.
**Priority:** P0

### 13 Collision / contact / penetration
**Purpose:** Body penetrations, swept contacts, exclusions, inter-panel and self intersections.
**Rust-first action:** Qualify Rust OGC/contact for multi-frame garments, identical fixtures and CPU/GPU parity.
**Priority:** P0

### 14 Garment fit / stage / drape
**Purpose:** Initial panel stage positions, auto-fit, cloth drape transfer, fitting scenes.
**Rust-first action:** Move reproducible garment fitting transforms/state ownership to Rust; optional Blender Python remains external.
**Priority:** P1

### 15 Avatar / pose / animation
**Purpose:** OBJ/glTF/GLB import, landmarks, collider identity, body poses and motion.
**Rust-first action:** Rust validates geometry and physics ownership; keep presentation animation in Three.js, Blender helpers optional.
**Priority:** P1

### 16 Fabric mechanics / materials
**Purpose:** Directional stiffness, density, thickness, stretch, bending and calibration data.
**Rust-first action:** Rust canonical mechanics and unit conversion; physically calibrate on measured fabrics.
**Priority:** P1

### 17 Fabric visuals / textures / PBR
**Purpose:** Texture data, fabric scan color, normal/roughness, optical/pixel transforms.
**Rust-first action:** Rust only for expensive deterministic processing; Three.js shader/visual display remains UI.
**Priority:** P3

### 18 Hardware / fastener / trims
**Purpose:** Zippers, buttons, buttonholes, fasteners, trim definitions and placement metadata.
**Rust-first action:** Persist placement and geometry in Rust; keep 3D decorative rendering in Three.js.
**Priority:** P2

### 19 Garment print graphics / embroidery
**Purpose:** Print graphics, logos, surface placement and persistence.
**Rust-first action:** Rust stores anchored, editable print geometry and history; React/Three paints final surface.
**Priority:** P2

### 20 Foam / padding / trapunto
**Purpose:** Quilted padding, foam response, loft and compression.
**Rust-first action:** Port validated manufacturing geometry/mechanics when actually used; keep UI preview separate.
**Priority:** P3

### 21 3D export and scene assets
**Purpose:** OBJ/glTF/GLB exports, mesh assets and scene interchange.
**Rust-first action:** Rust owns reproducible output geometry/format checking; Three.js continues rendering.
**Priority:** P2

### 22 Marker layout / nesting / yield
**Purpose:** Lays graded cutting pieces on rolls by grain, size, repeat and quantity.
**Rust-first action:** Rust deterministic nesting/yardage optimizer and constraint validation with independent cutter fixtures.
**Priority:** P1

### 23 DXF / CAD interop
**Purpose:** DXF and AAMA/ASTM-style CAD exchange; Modaris, Optitex, Seamly, Valentina experiments.
**Rust-first action:** Rust import/export model and strict units/layers/ref validation; independently round-trip in compatible CAD.
**Priority:** P1

### 24 SVG / PDF / physical plot
**Purpose:** SVG, print/PDF tiling, physical scale, registration and page layout.
**Rust-first action:** Rust authoritative output geometry and PDF/plot protocol; physical measurement validation.
**Priority:** P1

### 25 Factory preflight / measurement QA
**Purpose:** Validates dimensions, cutting geometry, source trust and production qualification.
**Rust-first action:** Rust fail-closed manufacturing validators; preserve traceable error diagnostics and physical gates.
**Priority:** P1

### 26 Production packages / factory orders
**Purpose:** Factory package/ZIP manifest, cutting order, roll plan, outputs and provenance.
**Rust-first action:** Rust immutable source manifests, content hashes, size/fabric quantities and safe packaged exports.
**Priority:** P1

### 27 Techpacks / BOM / specification
**Purpose:** Construction specification, BOM, POM, techpack sheets and factory technical data.
**Rust-first action:** Rust owns calculations and schema/export; React retains editable page and board presentation.
**Priority:** P2

### 28 Cost / pricing / estimates
**Purpose:** Material quantities, fabrication estimates, production costs and price formulas.
**Rust-first action:** Rust deterministic, versioned costing inputs/output; avoid migrating purely cosmetic price UI.
**Priority:** P2

### 29 Persistence / undo / history / restore
**Purpose:** Revision, save/open, undo/redo, file schema migration, journal recovery.
**Rust-first action:** Finish Rust transaction/state ownership, exact binary ABI and rollback; do not corrupt legacy projects.
**Priority:** P0

### 30 Libraries / templates / presets
**Purpose:** Garment presets, reusable pattern libraries, fabric/material catalogs and file selection.
**Rust-first action:** Rust owns validated persistence/index/search when needed; static UI catalogs can remain JS/JSON.
**Priority:** P2

### 31 Image digitizing / vision / references
**Purpose:** Interprets reference images, extracted contours, markers and physical scale.
**Rust-first action:** Keep optional ML pipeline where appropriate; send validated vector geometry and identity to Rust.
**Priority:** P3

### 32 AI assistant / generation / automation
**Purpose:** Pattern assistants, generated drafts, workflows, voice and local model clients.
**Rust-first action:** Rust-validate every proposed garment edit; retain external AI model/tool adapters as supported services.
**Priority:** P3

### 33 API / processes / transport
**Purpose:** Node HTTP routes, Rust session process, local RPC, native bridge and MCP.
**Rust-first action:** One bounded versioned Rust service/IPC contract; migrate Node business routes incrementally.
**Priority:** P0

### 34 Collaboration / security / sync
**Purpose:** Sharing, synchronization, permissions, optimistic conflict checks and SSE.
**Rust-first action:** Rust authoritative revisions, access checks and sync protocol; validate adversarial cases.
**Priority:** P2

### 35 Diagnostics / performance / misc
**Purpose:** Performance counters, quality reporting, source provenance and error paths.
**Rust-first action:** Keep testing harnesses cross-language; integrate Rust operational metrics and release gates.
**Priority:** P2

### 36 Native Rust editor / backend UI glue
**Purpose:** Existing independent Rust/egui workspace and tool handling.
**Rust-first action:** NOT required for Rust-first EXO; avoid rewriting the preserved React editor in Phase 1.
**Priority:** Keep

### 37 Native Rust engine shared core
**Purpose:** Shared Rust fitting, model, solver and authoring modules already under development.
**Rust-first action:** Stabilize API, source provenance, tests and authoritative integration rather than automatically translating again.
**Priority:** P0

### 38 Unclassified JS business logic
**Purpose:** Other unassigned business logic whose ownership cannot safely be inferred from names.
**Rust-first action:** Audit imports and feature actions manually; then assign exact authority or explicitly remove unused code.
**Priority:** Audit

### 39 Workspace commands / tools / preferences
**Purpose:** Tool command registry, inspector actions, preferences, keyboard operations and state.
**Rust-first action:** Rust owns persisted commands and Undo; React remains responsible for display and transient UI state.
**Priority:** P1

### 40 macOS native host / lifecycle
**Purpose:** Swift/AppKit/WKWebView launch, permissions, process lifecycle and platform shell.
**Rust-first action:** Keep as thin, reviewed OS adapter in Rust-first phase; a later Rust-native shell is optional.
**Priority:** Keep

### 41 Other backend source
**Purpose:** Additional integration files without reliable primary classification.
**Rust-first action:** Review individually before assigning migration or deleting duplicates.
**Priority:** Audit
