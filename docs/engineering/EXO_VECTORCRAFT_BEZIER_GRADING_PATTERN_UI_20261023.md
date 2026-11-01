# EXO ClothCraft Studio V2 — VectorCraft-style Bézier pen and on-pattern grading

Implemented and installed 2026-10-23 in `~/Applications/EXO ClothCraft Studio V2.app` (bundle `com.mikristian.exo.clothcraft.workspace.v2`).

## Native Bézier pattern pen

- Reuses and extends the existing independently licensed VectorCraft anchor/handle algorithms from `src/core/vectorcraftAnchorPort.js`, not third-party editor UI artwork. The repository retains upstream license notices at `research/oss/vectorcraft/`.
- The native 2D `vector-pen` tool paints the actual cubic path during authoring using `penCubicPath` instead of a polyline that falsely suggested straight contours. It also previews the next cubic from the most recent anchor to the cursor.
- Click produces a corner. Press/drag creates a mirrored, smoothly connected tangent, displayed as two visible handles; Shift constrains to 45° increments, Option produces a corner; click the first anchor to close, Enter finishes, Escape discards.
- The live curve is authored through the existing native `onPolygon(points,tangents)` Polygon contract, preserving metre-scale material geometry and Rust Undo.
- Existing Edit Curve mode already supports distinct incoming and outgoing tangent editing on an authored shape; the initial native Polygon authoring contract carries one symmetrical tangent per anchor. Full independent two-handle authoring and Illustrator feature parity are separate future work.

## Grading directly on the pattern

- Legacy EXO 2D draft `PatternEditor` now has a **Show grade points directly on pattern** toggle in Production. The overlay reads the actual `gradeProject` size run and displays clickable point indices, an explicit base-to-preview X/Y delta in centimetres, and multiple size points when the grade nest is enabled. It uses a separate read-only selection to avoid accidentally applying a coordinate edit to a graded snapshot.
- Native ClothCraft grading has a new before/after on-paper overlay during the A16/A17 grading dialog. It displays a dashed existing contour, proposed amber contour, individual grade vectors and point labels. Nothing is committed until Apply Grading sends the existing Rust `grade-pattern` command.
- The native affine proposal follows `integrations/clothcraft/exo-session.rs` (the actual Rust `graded_polygon` contract). Straight-edged panels with verified compiled boundary bounds are tagged `accuracy:'exact'`. Curved panels, where Rust uses its own 0.25 mm flattened edge bounds, use checked compiled UV contour extents and are explicitly tagged `accuracy:'approximate'`; a numerical maximum error is not invented. Missing or malformed topology/curve data prevents the preview.
- Native named-edge cubic and free Hermite knot paths are sampled for SVG presentation; curves, cubic controls and free-point derivative vectors are preserved in the uncommitted proposal.
- Native Rust grading currently edits one panel by a width/height affine change; it is not the same operation as the separate six-size JavaScript industrial grade rules. The overlay does not fabricate additional native size runs.

## Verification completed

- Focused pen, geometry renderer and native proposal tests: **13 passed, 0 failed**.
- App bundled successfully by esbuild. Incremental Vite native UI build compiled **2,150 modules** into about **5.2 MiB** of hashed assets.
- Installer backed up the app entry point and verified native bundle signature, executable identity, all hashed assets, UI feature markers and embedded Rust bridge address. Installed front-end assets are `index-DL447XkR.js` and `index-GIxji0Gd.css`.
- Native Rust smoke: **2 panels, 4,706 triangles**, CPU VBD + OGC ready, zero page errors, zero wrong-port requests and zero texture warnings.
- Installed native UI pen gesture smoke: **two temporary anchors, two cubic path segments, live guide visible**, Escape cleaned up all temporary points, document revision unchanged, zero JavaScript page errors.
- Installed grading modal read-only smoke: both current `front` and `back` panels showed a live SVG grading overlay, both correctly tagged `approximate`; zero JavaScript page errors. No grade was applied to the user's garment.
- Previous 2D tool catalog smoke continued passing with 33 functions, 116 references, grading editor, QA/marker, named rules and digitizing.

## Remaining constraints

Full Illustrator/VectorCraft editing parity requires native Polygon support for separate incoming and outgoing authoring handles at each vertex. Native all-size grading remains a separate project from the current single-panel affine grade, particularly seam-linked global rule solving and graded notch integrity. A manufacturing-ready claim requires an independent receiving CAD and factory pattern/plot verification. These additions preserve project data and current native binaries.
