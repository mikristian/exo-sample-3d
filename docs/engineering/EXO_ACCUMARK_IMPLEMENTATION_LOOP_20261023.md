# EXO ClothCraft Studio V2 — AccuMark engineering implementation loop

Date: 2026-10-23. Installed native target: `~/Applications/EXO ClothCraft Studio V2.app`, bundle `com.mikristian.exo.clothcraft.workspace.v2`.

## Delivered in this implementation pass

| Engineering area | New source component or engine | Working scope |
|---|---|---|
| Multi-size constraints | `src/core/accumarkGradeConstraints20261023.js`, `src/components/AccuMarkConstraintControls.jsx` | Actual graded X/Y point rules from Match Line (X/Y/projected/XY), Keep Angle, Parallel, perimeter Intersection; bounded single-point solver; reports residuals across sizes |
| Point grading | `src/core/accumarkGradeRuleOperations20261023.js`, `src/components/AccuMarkEngineeringControls.jsx` | Signed physical edge-normal offsets per size, proportional grade distribution, smoothing with fixed base/endpoints, new intermediate named size through full industrial rule interpolation |
| Rule table library | `src/core/accumarkNamedGradeRuleLibrary20261023.js`, `src/components/AccuMarkNamedRules.jsx` | Capture, name/version, apply/detach, inspect references, import/export checksum-checked grade rule snapshots with nonuniform breaks; library is session-local until exported JSON is saved |
| Drafting geometry | `src/core/accumarkPatternOperations20261023.js`, `src/components/AccuMarkEngineeringControls.jsx` | Selected straight-edge vertex alterations, rigid slash/spread, constrained dart sector pivot with reversible operation and graded-size validation; deliberately rejects curves/attachments it cannot preserve |
| Marker production | `src/core/accumarkMarkerProduction20261023.js`, `src/components/AccuMarkProductionControls.jsx` | Per-size quantity expansion, bounded placement, grain/nap/width/spacing checks, unplaced issue reporting, meter/area/cost summaries, labelled unapproved SVG inspection plot |
| Physical plotting | Same production modules | Separate horizontal/vertical measured 100 mm ruler check with 0.5% tolerance; operator must physically measure printed page |
| Digitizing | `src/core/accumarkDigitizing20261023.js`, `src/components/AccuMarkDigitizingControls.jsx` | Convert explicitly entered observed contour coordinates into calibrated cm pieces using a two-anchor physical scale; winding, crossing, duplicate and metadata checks; no image auto-tracing/OCR |
| Workspace integration | `src/components/AccuMark2DLibrary.jsx`, `src/core/accumark2dCommandRegistry.js`, `src/App.jsx` | 33 searchable engineering contracts and 116 vendor research links. 30 entries route to existing EXO or limited new operations; reference-only: constrained numeric line construction, ERP integration and full 2D/3D semantic transfer. Connected routes do not establish complete vendor feature parity. |

The previously implemented industrial grading workbench, Rust solver, DXF exporter, sewline tools, factory QA and saved project workflow remain intact. Source mutations go through the established EXO undo state; core engines return defensive copies and report unsupported topology instead of silently dropping geometry.

## Verification actually performed

- Focused suites: **31 passed, 0 failed**, covering rule modes/size lines, negative constraints, immutable transforms, marker/cost/plot, digitizing, named versions and registry routing.
- Vite bundle and App esbuild compile: passed. Vite public references to existing cursor files are resolved by the installed app; no full public asset duplication needed.
- Browser UI smoke targeting the **installed native app's own internal server** at port 5386 passed: 33 functions, 116 help topics, 6 grading preview sizes, nested grading UI, advanced constraints, marker/plot controls, named rules and digitizing, zero JavaScript page errors.
- Native runtime smoke: native Rust ready (CPU VBD + OGC), two restored physical pattern panels, 4,706 mesh triangles, geometry and fabric WASM ABIs, full visible native 2D/3D app, no bad dev-port requests, page errors or texture warnings.
- Signed incremental V2 app update: existing native Swift executable, Rust session binary, private 3D assets and user projects preserved; app reopened successfully and remained frontmost.

Installed UI bundle: `index-DMLCXqEf.js` and `index-Z2rSyKmF.css`. Backup of prior native app entrypoint: `~/Library/Application Support/EXO-ClothCraft-Studio-V2/Backups/accumark-longloop-before-20261023-sjOjNUHN/index.html`.

## Known engineering limitations that remain

1. **Global simultaneous grading constraints:** the new solver recomputes one explicitly selected vertex at a time. Multi-point dependencies, propagation through complete curved seams, locked-rule conflict graphs and robust global solve still require implementation and independent fixtures.
2. **Industrial dart and fullness topology:** actual dart pivot/slash on straight, unattached polygons works within stated preconditions. Curved seam reparameterization, topological splits, internals, notches and sewing relation relocation are intentionally rejected.
3. **Grading production parity:** no independent licensed AccuMark/DXF receiver round-trip, all-size sample sew test or named factory signoff has been completed. An app-local operation must not be labelled Gerber or manufacturing certified.
4. **Marker nesting:** conservatively validated axis-aligned placement envelopes. No guaranteed global optimum, arbitrary fabric repeats, spread planning, pile lay strategy or production nesting engine acceptance.
5. **Digitizing:** manual coordinates and calibration only. Computer vision tracing from scanned photographs, raw hardware digitizer streaming and automatic semantic mark mapping are not implemented.
6. **Named rule libraries:** explicit JSON export/import is supported; cloud/global shared persistent catalogs and rights/version coordination remain outside this pass.
7. **Plotting:** a dimensioned SVG and test ruler are available for operator study. Plotter drivers, queue management, cutter protocols, and verified physical-scale equipment output remain external.
8. **ERP/PLM and complete 2D/3D parity:** current App has related existing tools, but the specifically researched integration contracts remain reference-only.
9. **Storage gate:** Mac has less than 25 GiB free. Performed only the ~5 MiB UI bundle update; skipped heavy Rust/Swift rebuilds, installs, asset duplication and repository cleanup.

These limits are source- and test-grounded. Neither this work nor the 116-source vendor catalogue represents every feature in licensed AccuMark.
