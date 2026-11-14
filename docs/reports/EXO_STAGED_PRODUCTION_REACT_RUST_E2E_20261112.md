# EXO V2 staged production frontend → native Rust end-to-end QA

**2026-11-12 — PASS.** The complete *compiled* React/Three.js web bundle staged at `release-artifacts/EXO-RustFirst-Staging-20261112-NOT-INSTALL/web` successfully operated the actual native Rust `exo-session` binary through EXO's Node bridge **without browser request interception or an HTTP proxy**. This verifies a component of the candidate release, **not** a packaged, signed, installed macOS `.app`.

## Exact isolated test

Command: `node scripts/qa-exo-staged-production-runtime-20261112.mjs`

The harness verified the staged `exo-session` SHA-256 against its source-fenced manifest, confirmed **both staging ports 5485 and 5486 were unoccupied**, then launched:

- A disposable native Node bridge bound to `http://127.0.0.1:5485`, with a 32-byte random bearer credential and a new temporary Rust garment workspace.
- `vite preview --outDir release-artifacts/EXO-RustFirst-Staging-20261112-NOT-INSTALL/web` on `http://127.0.0.1:5486`, serving **compiled production assets**, not source hot-reload dev modules.
- One disposable Playwright-controlled headless Chrome, not the user's live Chrome/desktop EXO, with the per-run bridge credential injected before React initialization.

Chrome directly contacted `http://127.0.0.1:5485/workspace` from the `http://127.0.0.1:5486` origin; **all 13 captured browser-origin workspace requests** completed with HTTP 200, an accepted Origin, the correct Access-Control-Allow-Origin and a bearer credential. No intercept, re-route or synthetic browser operation was used.

Through genuine visible React controls, the test opened a new pattern, entered **Edit Grading**, created a zero-offset six-size grading draft, selected **Export**, and clicked **Save grading catalog to Rust**. The Rust session committed a six-size catalog at revision 1 and the base template remained identical to its original. The test expanded **Grading history: Draft / Rust**, clicked **Undo Rust catalog**, captured successful native HTTP `undo`, and verified the catalog was removed. It then clicked **Redo Rust catalog**, captured HTTP `redo`, and verified all six templates and the source garment restored exactly against the persisted Rust project on disk. Observable local draft Undo/Redo control states were identical before and after. The private React history array was not inspected directly.

### Instrumentation correction

The first bounded run failed the QA assertion **after** successful React grade Save because the tester used Playwright's `Request.headers()` to inspect browser-managed `Origin`; that API can omit security headers. This was a **test recorder error**, not an EXO networking or Rust grading failure. The harness was corrected to use `request.allHeaders()` and `response.allHeaders()` to inspect Origin/CORS. The subsequent one-off run passed its real Save, Undo, Redo, persisted-project and direct networking checks.

### Isolation and release limitations

The harness shut down only its own Chrome/Node/Vite process groups and discarded only its disposable Rust workspace. It never modified the installed `~/Applications/EXO ClothCraft Studio V2.app`, live EXO ports 5385/5386, camera SD card, project backups or any personal garment.

**What it does not certify:** the native macOS Swift launcher, WebKit session credential handoff, packaged runtime closure, Developer ID signing/notarization, release ABI of a GPU-enabled desktop `exo-session`, realistic garment physics, manufacturing cutter accuracy, user-project upgrade and tested rollback. The staged source-matched `exo-session` tested here reports `desktopFeature=false` and `gpuSimulation=false`; the existing `scripts/qa-exo-v2-desktop-gpu-binary.mjs` correctly rejects it for desktop packaging. A GPU-capable release must be built separately and independently tested after safe disk headroom is available.

The source fence captured earlier in the day became stale when the QA harness's network recorder was corrected. Capture and verify a **new** source fence after the completed QA code change before any future full `.app` packaging. **No production deployment approval has been granted.**
