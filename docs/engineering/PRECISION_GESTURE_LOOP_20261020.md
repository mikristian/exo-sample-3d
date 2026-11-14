# EXO ClothCraft Studio V2 — precision gesture loop, 2026-10-20

## Scope and implementation
Preserved latest committed manufacturing/dart work at 58a7d86. Fixed the 2D editor's 2 mm pointer-up dead zone: curve controls and material vertices now use a 1 micrometre numerical tolerance; board navigation retains its old threshold. The change is in src/components/ClothCraftBoardV2.jsx.

The regression reproduced the bug before editing: after a 16 mm station drag, a further 0.5 mm horizontal / 0.25 mm vertical knot drag was silently lost. After the fix the full 16.5 mm / 0.25 mm movement reaches native Shape, Rust contour, and the 3D renderer.

The old absolute-coordinate regression incorrectly assumed Rust keeps the local origin fixed. Rust normalizes panel bounds. Both regressions now compare movement relative to an unchanged material anchor, which removes translation without hiding physical deformation. No Rust geometry was changed.

## Verification
- All four front/back left/right edges: browser gestures -> Apply -> Rust Shape -> corresponding 3D boundary and renderer revision. Sampled maximum contour errors: front-left 0.174515 mm; front-right 0.159281 mm; back-left 0.174516 mm; back-right 0.159282 mm.
- Repeated knot and both tangent drags, Escape/pointer cancellation, frozen zoom during drag, explicit Apply, discard after ease, undo/redo, and save/reopen pass.
- Installed QA bundle at 1280 px: back-right precision regression passes; maximum sampled contour error 0.158577 mm.
- 12 existing focused core tests pass. Vite build passes (existing bundle-size advisory).
- Read-only reopened QA app smoke passes, including 2D/3D and dart inspector markers. Reviewed split-view screenshot; this is pre-drape geometry, not a settled-fit test.

## Delivery and evidence
Updated and reopened ~/Applications/EXO ClothCraft Studio V2 QA.app. Saved/paused its QA garment, backed up its web resources, installed frontend assets, and verified ad-hoc code signature. Native solver was not replaced. Production EXO ClothCraft Studio V2.app and original production garment were not modified. Nothing was published to GitHub.

Remote project: ~/Chat On Steroids Workspace/exo-clothcraft-v2.
Evidence: docs/qa/precision-loop-20261020/ (four edge logs/screenshots, installed-narrow.log, core-tests.log, build.log, install-report.json, installed-smoke/verification.json, installed-web-backup/).
Tests: integrations/clothcraft/qa-v2-precision-loop-20261020.mjs and qa-installed-precision-reopen-20261020.mjs. Existing qa-v2-side-gestures-20261020.mjs has its origin-normalization assertion corrected.

## Remaining scope
This loop does not certify drape/fit or introduce folded darts. Existing Apply still enables sewing ease before issuing Shape as separate native operations; atomic seam-plus-shape transaction remains a separate next improvement. No native REA analysis provider was configured or claimed; existing saved REA static evidence remains available.
