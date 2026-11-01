# EXO V2 grading precision loop — 2026-10-25

## Implemented in this loop

1. `accumarkNativeRuleSizeQA20261023.js` now calculates each size's contour perimeter using `nativeRustEdgeLength20261023`, matching the native cubic subdivision method (0.25 mm flattening threshold). The fixed-station contour remains the basis for approximate area, bounds, and intersection inspection. The previous chord-length sum is retained explicitly as `sampledPerimeterMm` for diagnostic comparison; it is no longer the reported sewn contour perimeter. Unsupported or unresolvable edges block QA and cause `perimeterMm: null`, preventing an incomplete edge sum from appearing to be a measured length.
2. `accumarkNativeGradedTemplateTransaction20261024.js` retains six-size draft catalog support for genuinely unsown `seams: []` templates while requiring all-size physical seam validation for templates with sewn relationships. Malformed non-array seam metadata is rejected.
3. `nativeGradeCatalogBridge20261025.js` checks every recovered or reported graded template against the entire current panel inventory, nonpoint polygon metadata and ungraded template attributes; an altered notch, seam, curve control, or size-specific panel field cannot be silently accepted as the committed point-rule set.
4. `nativeGradingReleaseGate20261025.js` requires claimed industrial evidence to pin the full source template because the legacy rule fingerprint does not cover authored seam/notch/allowance changes. Manufacturing and cutting authorization remain **false** pending independent proof.
5. `accumarkGradedDxfRoundtripAudit20261023.js` compares complete, oriented physical notch LINE geometry with authored references. A receiver artifact with correct notch count and depth but altered physical station or inverted cut direction now fails.

## Verification

`rg --files src/core | rg -i '(grad|graded|pom).*\.test\.mjs$' | xargs node --test --test-concurrency=2 --test-reporter=spec`

Result: **382 passed, 0 failed, 0 skipped**, across 74 grading-related test files. Targeted regressions include six-size curved perimeter metrology, nonresolvable free-curve edges, unsown catalog persistence, malformed seam metadata, graded catalog tampering and reversed physical DXF notch cuts.

## Engineering limits and release conditions

- The six-size catalog can be persisted to the native project, but selecting a size does not yet recompile the actual Rust simulation/rest mesh for that size. Full multi-size 3D drape, size-specific avatar fitting and undoable activation need a real native runtime operation.
- The per-size **physical CUT** flow is still incomplete for curved contours, authored holes/internal lines, seam allowances, notches, grain/fold and many sewn assemblies. A source preview or current-base-size DXF cannot certify the six-size output.
- Curve-area and intersection inspections still sample the contour; the native-aligned perimeter result is not a certified tolerance measurement or independent geometric oracle.
- No independent Optitex/Gerber/Lectra receiving-CAD import, plotted 1:1 dimensional inspection, marker/cutter approval, sewing sample, patternmaker signoff or factory receiver acceptance was performed in this loop. Factory status remains **blocked**, even when source geometry checks pass.
- Disk free space was about **358 MiB** at the end of the code/test loop; no Rust rebuild, new install or disk-heavy native service integration test was attempted.

Next completion gates: (1) atomic native size activation and full rest-mesh/seam/cloth rebuild; (2) complete physical marking/allowance propagation across every size; (3) industrial exchange independently measured in receiving CAD; (4) physical sewn-sample signoff and cut-room machine compatibility checks. None can be substituted with self-reported flags or source-only test success.
