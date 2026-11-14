# 2D pencil and dart: manufacturing acceptance gate

Current coverage: `node --test src/core/pencilDartManufacturingAcceptance.test.mjs` checks physical units, stroke endpoints, prominent corners, finite Bezier controls, deterministic fit, UI gesture wiring, and the straight-edge cut-and-sew dart's intake/depth arithmetic. These checks alone do not approve a factory pattern. The UI currently commits a pencil stroke via `onPolygon`, and darts via Rust `DartCutSew`.

## Required acceptance checks before factory approval

1. **Pencil input:** pen/mouse drag, short taps, pointer cancellation and lost capture must preserve prior edited patterns, permit undo/redo, and create exactly one intentional transaction per completed stroke. Verify at 100%, 200%, and 400% zoom and under canvas rotation. Capture source sampling/provenance and fitting tolerance alongside committed geometry.
2. **Geometry:** raw sample to reconstructed cutline maximum deviation must meet an explicitly specified per-piece physical tolerance (proposed **0.5 mm for critical cutlines**, to be confirmed by patternmaker/factory). Sample the *cubic curve itself*, not merely fitted knots; verify no overshoot, self-crossing, zero-length segment, reversal, or invalid closure. Require independent end-to-end native Rust validation. A 64-knot budget can violate this tolerance for dense strokes; either refuse the commit or retain additional knots rather than silently degrade measurement accuracy.
3. **Topology:** every new pencil polygon must have valid winding, minimum edge length, finite closed boundary, no holes inadvertently bridged, and stable point/edge references. Smoothing/undo/redo must preserve existing seam, notch, drill, allowance, grading and internal-line associations.
4. **Darts:** validate material-side orientation and that the apex is strictly inside the chosen panel; reject crossing an existing cutline, seam, notch or dart. Verify commanded intake, depth, leg length, sewn convergence, seam allowance migration, and no unintended wedge beyond design intent. Current straight, unsewn-edge `DartCutSew` removes a wedge and stitches the cut legs; folded uncut darts require separate engineering and approval.
5. **Grading and manufacturing files:** walk both dart legs at each graded size, check intersection/clearance, notch and allowance registration, and verify DXF/AAMA/ASTM round trips through actual receiving CAD software. Compare printed scale to calibrated physical measurements and sew a sample for patternmaker signoff.

## Release disposition

`DEVELOPMENT_ONLY_FACTORY_APPROVAL_REQUIRED` until geometric error sampling, native transaction/integration tests, graded size-run checks, CAD receiver interoperability and a physical sample are independently verified. The source/UI wiring assertions in this test suite are regression tripwires, not a substitute for runtime gesture QA.
