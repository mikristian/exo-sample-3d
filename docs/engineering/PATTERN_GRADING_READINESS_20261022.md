# Patternmaking and grading completion gates — 2026-10-22

## Goal and scope
Complete a defined, testable patternmaking and grading workflow independently of the unfinished 3D simulator. No aggregate 70%, 90%, or 100% claim is supported yet. This checklist separates source implementation, automated verification, installed delivery, and external physical acceptance.

## First implemented milestone
- Native grading UI accepts configurable width/height increments per size, including fractional millimetres and downward steps; the former fixed 20/10 mm defaults remain defaults, not hard-coded rules.
- Grading preflight rejects blank/nonfinite values, no-op, increments outside ±500 mm, collapsed/oversized resulting bounds, unsupported holes/internal lines, and unavailable native boundary data. Rust remains final validator.
- Before/after dimensions use compiled material UV boundaries, including curve lobes rather than only polygon corners. Preview is labelled an estimate, not an independent geometry certificate.
- Sewing relationship warning makes single-panel behavior explicit. This is not linked multisize grading or persistent point-rule authoring.
- Apply rechecks the current native revision after waiting for the lock, rejecting a stale review instead of applying it silently.
- SVG reference export now has physical width/height in millimetres, a numerically matching viewBox, a 100 × 100 mm calibration square, and actual-size printing instructions. The grading dialog exposes the export action because the full-shell Production selector is unavailable in the embedded workflow.
- The sheet exports applied current boundaries, not an unapplied grading proposal. It remains a reference without tiled pages, seam allowances or production approval.

## Completion gates still open
1. Persistent size sets and base size with named, per-point X/Y rules; nest overlay, per-size selection, rule copy/mirror, undo/redo and save/reopen. Reject invalid or missing size IDs.
2. Linked whole-garment grading transaction: all selected pieces, stable point/edge IDs, curves and independent tangents, holes, internal lines, darts, notches, grain, allowances and graphics. No unsupported references silently discarded.
3. Every size validates seam lengths/ease, POM targets and tolerances, contour validity, unit consistency and source revision; invalid outputs cannot be released as approved.
4. Production print/export: actual-size PDF/SVG, A4/Letter tiling with overlap/registration/page map, scale reference, seam/cutline distinction and size layers. Current export meets only the measured-reference subset.
5. Representative end-to-end fixtures: tee, trouser, curved/darted bodice, asymmetric panel, holes/internal markings; edit → grade size run → save/reopen → export → independent reimport; compare coordinates, POM, allowances, notches and seam identity.
6. Fresh installed QA/release verification and reproducible packaging. The source work here does not update either installed app.
7. Human/external physical acceptance: print at actual size, measure both axes of calibration square and selected POM, import into independent CAD/cutter software, verify named fixtures against explicit tolerances. Physical print/production acceptance cannot be inferred from generated files.

## Constraints and preservation
Blender Mac HEAD at review: 53041a6, extensive existing dirty source preserved. Workspace component hash checked against current remote before editing. Only the grading/export workspace surface, two new helpers and focused tests were changed. No solver edits, Rust compile, installed app replacement, saved garment modification or GitHub publication. Mac free space ~3.1 GiB remains below the migration project's 8 GiB compile gate; tests use existing native binary and temporary projects.

## Evidence
Remote: docs/qa/pattern-grading-20261022/; tests src/core/patternGradingPreflight.test.mjs and integrations/clothcraft/qa-pattern-grading-20261022.mjs. Existing integrations/clothcraft/qa-v2-unified-handoff-20261018.mjs passes real isolated HTTP edit/grade/history/reopen/handoff, including atomic invalid-edit rejection, stale revision rejection, and retained notch/allowance semantics. Exact current browser results are recorded separately in browser.log.

## Final observed results
All 5 focused module tests pass. Real Chrome browser workflow passes manual +17 mm grading, custom -12.5/-6.25 mm step, invalid-grade guards, native save/reopen, downloadable SVG XML with explicit millimetres/equal viewBox scale and 100 mm square; zero browser errors. Dialog screenshot visually inspected and controls fit. Native unified-handoff regression passes. Source whitespace check passes. No new production bundle or installed-app test was run due build headroom; these source-only results must not be reported as installed delivery.
