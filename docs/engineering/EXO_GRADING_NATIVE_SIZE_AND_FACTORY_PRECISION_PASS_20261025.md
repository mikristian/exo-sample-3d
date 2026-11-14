# EXO V2 grading: native size and factory precision pass — 2026-10-25

## Completed engineering changes

- **Native Rust catalog identity** — `research/oss/clothcraft/src/fitting.rs` rejects saved XS–XXL variants that rewrite ungraded panel metadata. Grain, placement, notches, allowances, internal lines, annotations, physical measurements and mesh settings must remain source-identical. A direct native payload cannot bypass this merely because its six templates compile.
- **Deterministic cubic/free-curve grading** — Rust verifies that existing Bézier controls and free-curve knots follow the endpoint displacement interpolation of independent point rules, with stable knot identity and the expected derivative displacement. Added negative Rust tests for modified production metadata and invented curves.
- **Faster size switching** — `research/oss/clothcraft/src/bin/exo-session.rs` reuses the grade catalog validation performed when a project is loaded or committed. Each activated size still compiles atomically before modifying the active scene. `integrations/clothcraft/workspace.mjs` preserves the original project before the first activation and avoids redundant saves when changing between already-active graded sizes.
- **Project reopen workflow** — `src/components/ClothCraftWorkspace.jsx` automatically checks the current Rust catalog against the exact source revision, recovered point rules and POM definitions, so an already saved catalog can be presented as such after reopen. A browser-only rule sidecar never proves persistence.
- **Independent geometry QA** — Source QA now rejects ultra-short physical edges, invalid panel inventories, incomplete/duplicate size coverage and ambiguous identity checks.
- **Industrial DXF strictness** — The local DXF checker rejects unauthorized bulges, line/vertex widths, thickness, extrusion, nonplanar coordinates and unsupported geometry on manufacturing layers, even where obvious contour vertices remain unchanged.

## Verification performed

- **388/388 grading-related JavaScript tests passed** with no skips or failures across 74 files.
- `node --check integrations/clothcraft/workspace.mjs` passed.
- JSX syntax parse of `src/components/ClothCraftWorkspace.jsx` passed.
- Read-only `rustfmt --edition 2024 --emit stdout` parsed both modified Rust sources successfully.

## What this does not prove

Rust changes are in the local `research/oss/clothcraft` checkout, which is ignored by the outer EXO Git repository; they have not been rebuilt into the installed macOS executable. Native Rust unit tests and interactive 2D/3D performance benchmarks were not run because storage had fallen to roughly 315 MiB free. This pass has **no measured 100× speedup** and no external factory certification.

Remaining industrial gates include a fully installed native build and save/reopen/six-size activation smoke test, receiving CAD roundtrip against an independently implemented importer, accurate graded cut/allowance and marking semantics for unsupported contours, 1:1 plotted dimensional comparisons, all-size sewn sample checks, and factory device authorization. Neither test-suite green status nor a locally generated DXF grants production approval.
