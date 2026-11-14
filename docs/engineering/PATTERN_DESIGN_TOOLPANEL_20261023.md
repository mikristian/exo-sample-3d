# EXO V2 full-view Pattern Design toolpanel — 2026-10-23

## Delivered
Original EXO left toolpanel in native 2D full view: 22 working command bindings grouped under Points, Construct, Piece, Grade, Verify. Searchable tool picker with empty state and Escape close. Distinct original pen, pencil, internal line, dart and pleat icons. Existing industrial grading controls preserved. Removed a stray visible JSX brace detected during build.

## Reference scope
Reviewed saved Seamly2D source taxonomy/license and public AccuMark PDS command catalog/engineering research. No vendor implementation or icon assets copied. This is reference-informed command organization, NOT an exact AccuMark version-specific replica, Seamly constraint engine port, or proof of full grading parity. Target AccuMark version/layout was requested optionally; no answer yet. Richer numeric intersection construction, linked native multisize grading and holes/internal-line grading remain beyond this toolbar change.

## Verification
Disposable native/browser workflow passes: 22 entries, six native editing-mode transitions, search/no-match/numeric construction, manual/custom-step grading, save/reopen, SVG physical-scale reference export. No browser errors. Frontend production build passes (existing large-chunk advisory). Installed regular V2 app, saved garment first, backed up index/WASM, verified code signature, reopened. Native binary and saved garment template hashes unchanged. Installed read-only 1100x760 browser smoke checks grading, tiled print, missing assets and no project mutations.

## Locations on Blender Mac
Source: Chat On Steroids Workspace/exo-clothcraft-v2/src/components/PatternDesignToolPanel.{jsx,css} and src/App.jsx.
QA: docs/qa/toolpanel-20261023 and docs/qa/toolpanel-release-20261023.
Installed: Applications/EXO ClothCraft Studio V2.app.
Backup: docs/qa/toolpanel-release-20261023/installed-web-backup (old hashed assets retained).
