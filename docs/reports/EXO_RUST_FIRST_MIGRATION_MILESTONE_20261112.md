# EXO ClothCraft Studio V2 — Rust-first engineering milestone

**Date:** 2026-11-12. **Source tree:** `~/Chat On Steroids Workspace/exo-clothcraft-v2` (Blender Mac). **User direction:** preserve React/Three.js interface; convert authoritative garment backend to tested Rust. **Result:** meaningful source/Native/UI verification and a source-matched **non-installable QA runtime stage**, **not** a complete Rust conversion or signed replacement application.

## Acceptance evidence

### Real React grading action

`scripts/qa-exo-grade-ui-real-20261112.mjs` launches one isolated headless browser, isolated current Vite/Node bridge, real compiled Rust `exo-session`, and a disposable document with a per-run workspace token. The real React grading button was clicked. Browser-captured `/workspace` receipts included `save`, `grade-run-commit ok revision=1`, and `grade-run-status ok revision=1`. Six persisted Rust grade templates were independently verified against the isolated native saved file; original garment geometry was unchanged. Exact current UI control is **Save grading catalog to Rust** inside **Native grading catalog**, superseding old test labels.

**Real history follow-up:** The isolated browser closed the grading modal and clicked a **visible, enabled, genuine React button** labeled `Undo latest 2D pattern or grading edit`. React sent a `snapshot` HTTP request for native revision 1, **not** an `undo` request. The UI displayed: `2D Undo/Redo blocked: Native and grading draft histories have ambiguous chronology. Use explicit grading-table Undo/Redo or save and reconcile the native document; global history is blocked.` Redo was disabled. This is the application's deliberate **fail-closed mixed-history safeguard**, not evidence of a Rust Undo bug. Native grade Undo/Redo was separately verified through the real Rust session. A fully connected user-visible history pass requires reconciling native and browser grading-draft history, or presenting safe separate explicit controls; do **not** bypass the guard simply to get a green test.

### Native engineering and manufacturing

`scripts/qa-rust-grading-connected-migration-20261112.mjs` uses exact SHA-checked Rust grading WASM mapped into real native Rust garment panel points. **336 coordinate comparisons**, **six size activations**, **seven malformed/stale input controls**, six Rust CUT size sets and **one verified native production-order handoff** passed. Initial CUT generation deliberately failed without explicit seam allowances; adding 12 mm seam allowance to all test edges permitted six-size CUT generation. Outdated source revisions for production order are rejected. Native Rust Undo removes the saved catalog, Redo restores all six templates, and saving verifies durability. No user garment or production source was edited.

`scripts/qa-exo-rust-first-multi-domain-20261112.mjs` passed **seven** discrete drafting, construction, sewing, marker/PDF/SVG, preflight, DXF notch, and grading-to-native manufacturing checks. A real compiled Rust native session separately passed seam edits, invalid/stale rejection, Undo/Redo, saved state, **cold reopen** and source pattern-audit with `manufacturerReady=false`. Existing security-hardened HTTP and verified native handoff reject obsolete uncredentialed/legacy QA scripts; do not remove those protections merely to get older tests green.

### Native current-source build / staged artifacts

`scripts/qa-exo-source-matched-candidate-20261112.mjs --build` freshly built the Rust metadata validator and static HTTP host from the present checkout with locked offline Cargo builds, source-input SHA fences and CLI negative controls.

`scripts/qa-exo-native-session-current-source-20261112.mjs --build` reused the existing development Cargo target. The first bounded build timed out after compiling additional dependencies without replacing the executable. A second bounded cache-reusing build succeeded; source input SHA fences remained identical and the native `--exo-capabilities` metadata/project-generation ABI probes passed. Its SHA-256 is `6a5ba512b4d7fc539a96d10a09c88f7eae20b15b8582259637fce921e36a9c64`. Only the *development* `target/debug/exo-session` was rebuilt; the installed macOS app executable and runtime were not changed.

The checked native candidates were copied alongside five checked Rust WASM modules into:

`release-artifacts/EXO-RustFirst-Staging-20261112-NOT-INSTALL/`

The pinned artifact manifest lives there and at `docs/reports/EXO_RUST_FIRST_STAGING_20261112.json`. `scripts/qa-exo-rust-first-staging-verify-20261112.mjs` verified **all eight artifact SHA-256 values**, native ABI capabilities, and two corrupted-manifest negative controls. All three native binaries have current-source Cargo build evidence. The five WASM binaries have valid exported ABI and matching recorded hashes, **but source-rebuild provenance for every current Rust/WASM source has not been proven**. These are not signed or notarized as a macOS app. Original source/installed-artifact comparison still reports three native installed mismatches because **installation was deliberately not performed**.

## Final local gate results

`node scripts/qa-exo-rust-first-release-gate-20261112.mjs` → **9 of 9 baseline checks PASS**.

`node scripts/qa-exo-rust-first-release-gate-20261112.mjs --require-ready` → **expected exit 1** because full native UI history acceptance, installed source parity, independent manufacturing certification, physical solver qualification, signed macOS package and rollback are outstanding.

No clean/rebase/reset/checkout was applied to the existing Git tree, which has thousands of concurrent changes. All new reports/scripts and the Rust contract source remain uncommitted until independently reviewed. The original installed `~/Applications/EXO ClothCraft Studio V2.app` and live user Node service/Chrome were preserved. The original user's garment/backup directories were not used for test writes.

## Next responsible steps

1. **Complete real grading history routing:** standalone UI history now demonstrably blocks mixed native/draft chronology as designed. Define and verify one authoritative chronological transaction model, or explicit separate native-vs-draft history UX that safely avoids ambiguity. Require real HTTP Undo/Redo receipts and cold-open parity before marking full UI history complete. Do not bypass deliberate guards.
2. **Qualify production geometry:** independently compare accepted multi-size, seam/notch, marker, DXF and physical plot/cutter outputs. Passing Rust transformations alone does not mean factory certification.
3. **Verify full Rust physics:** CPU/GPU multi-garment simulation agreement, body/self penetration and calibration fixtures before performance claims.
4. **Stage a full source-matched UI/host/native app build** with source hashes and exact ABI, then test bundle identity, signature/notarization, migration from old projects and recovery/rollback in isolation. Only then consider replacing the installed application with explicit deployment review.

No universal code-conversion tool can substitute for these system-level acceptance gates. Preserve the React/Three UI while migrating one authoritative operation at a time.
