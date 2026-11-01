# RUST-032 evidence — review only

The live source already uses a per-constraint Rust/WASM projection (`rustDistanceConstraintKernel.js`) with synchronous JS fallback. This change adds a batched Rust/WASM sweep call at the existing iteration boundary, retaining that original path as fallback. Rust projects contiguous f64 particle (xyz, inverse mass) and constraint (endpoint indices, rest, stiffness, fuse flag) buffers. Each maximal distance run executes in forward/reverse order; JS handles virtual seams and weighted surface stitches between runs. The substep/iteration parity, anchor/contact order, fuse follower behavior and pin rules remain in the original solver. Numerical inputs refresh each sweep; topology changes rebuild the run cache. Unavailable WASM, capacity limits, malformed numeric input and nonfinite native results use the original path. Rust validates a whole run before writing any particles, and JS validates native output before committing the run.

Only `src/core/physics.js` changes among existing tracked files. Source geometry and authored garment files are unchanged. A reproducible offline Cargo build script and generated browser WASM asset are included.

Validation performed locally:

| Check | Result |
| --- | --- |
| `node scripts/build-rust-pbd-kernel.mjs` | PASS: 3 Rust tests; release wasm32 build |
| `node scripts/qa-rust-pbd-kernel.mjs` | PASS: seeded 12,000 constraints, 8 directional passes, maximum double error 0; fuse/pins/zero, mixed dispatch, malformed atomic fallback and topology replacement |
| `node scripts/check-native-cpp-preflight.mjs` | PASS: 13 JS marker/structural parity cases and C++ unit checks; this is preflight coverage, not native solver validation |
| JS syntax checks; `git diff --check` | PASS |
| Architecture; physics | BLOCKED: missing `three` |
| Interfacing; factory | BLOCKED: missing `fflate` |
| Native C++ extended step (12 cases) | BLOCKED before execution: missing `three`; prebuilt `native_cpp/build-cmake/libgarment_cad_core.a` also absent |
| `npm run build` | BLOCKED: `vite` absent |
| `node scripts/qa-rust-pbd-production.mjs` | BLOCKED: `vite` absent; Chrome 1/30-frame parity and production timing were not executed |

The production Chrome harness compares tee and pants at 1 and 30 frames, then measures three paired trials per garment with eight warmup steps and 16 measured steps per backend. It alternates timing order and includes packing/validation/unpacking in sweep time. The baseline invokes the unchanged original JS projection callback. It fails if the median batched sweep is slower. No production benchmark numbers are available in this snapshot, so no performance or completed acceptance claim is made.

No packages or browsers were installed. The absent `research/oss/clothcraft` solver was not validated. Native solver coverage, browser parity, performance acceptance, architecture/physics/interfacing/factory checks and the app build remain outstanding. This is a review-only implementation, with no physical fit certification.

## Independent live-source integration and verification (2026-10-21)

The earlier table describes the isolated candidate environment, **not** the subsequent live source verification. Candidate source-only files were selectively applied without transplanting the prebuilt WASM or overwriting the live `physics.js` edits. The live file was merged manually to retain the existing per-constraint Rust bridge. WASM was rebuilt offline from the reviewed Rust source.

* Rust unit tests **3/3 PASS**, offline release `wasm32-unknown-unknown` build **PASS**.
* Seeded 12,000 constraints across eight forward/reverse passes: **maximum coordinate error 0** against independent legacy scalar logic; mixed special-constraint dispatch, invalid-input atomic fallback, topology refresh and added extreme finite-input overflow atomic fallback **PASS**.
* Real source Chrome tee and pants at **1 and 30 frames**: four parity cases **maximum position error 0**. Warmed 16-step median distance-stage times: tee **25.8 ms legacy versus 16.1 ms batch**; pants **9.9 ms legacy versus 6.9 ms batch**. These are local measurements, not a general GPU/CPU performance guarantee.
* A second independent Chrome run additionally asserted actual Rust commits: **1,751 committed native sweeps / 3,135,114 constraint projections**, four 1/30-frame parity cases at **0 error**, tee median **27.0 ms versus 16.2 ms** and pants **10.3 ms versus 6.2 ms** for the measured stage.
* `check-simulation-architecture`, `check-physics`, `check-interfacing`, native C++ 12 collision-disabled tee/pants extended-step parity cases, and Vite production build (**2066 modules**) **PASS**. Source `dist/wasm/exo_pbd_kernel.wasm` present; JS syntax and `git diff --check` **PASS**.
* **Known acceptance failures / exclusions:** existing native contact parity reports `fullStepParity:false` and collision-enabled discrepancies; `check-native-cpp-sewing-construction.mjs` fails its `checks>=27` assertion after an imported CLO fixture was unavailable. Neither establishes regression from this isolated numerical stage. Full solver, collision, sewing, GPU and physical-fit certification remain unproven.
* **Packaging blocker:** both macOS packaging scripts enumerate WASM files and omit `exo_pbd_kernel.wasm`. No shared packaging script, installed app, user garment, queue, Git branch or production service was changed. The source build is functional, but the batched stage is not shipped in the installed macOS app; it will use the original per-constraint fallback there.

This evidence supports a **production-used source Rust-owned batched distance projection stage only**, not complete Rust ownership of `physics.js`, the cloth solver, the macOS app or the overall EXO application. RUST-032 remains blocked in the shared queue pending coordinated packaging and full acceptance review.

## Coordinated source packaging verification (2026-10-21)

The previous **packaging blocker has been addressed in the source scripts**, not by changing the installed application. Both `integrations/clothcraft/macos/build.sh` and `build-web-only-v2.sh` now call `scripts/build-rust-pbd-kernel.mjs` and require `wasm/exo_pbd_kernel.wasm` exactly once. `bash -n` passed for both scripts, static invocation/asset-gate checks passed, and the built source WASM asset is nonempty (24,054 bytes). Neither installation script was executed: that would modify an installed app.

Fresh verification from the live source: 12,000 seeded constraints over eight directional sweeps with maximum scalar position error **0**; malformed-input and overflow fallback, topology replacement and mixed special-dispatch checks **PASS**. `check-simulation-architecture.mjs`, `check-physics.mjs`, `check-interfacing.mjs` and `git diff --check` **PASS**. An isolated Vite production build transformed **2,066 modules** and included `wasm/exo_pbd_kernel.wasm` (24,054 bytes); only the preexisting large-chunk advisory appeared. This validates source packaging configuration, **not** signed installed-release verification, physical fit, or collision-enabled native solver parity.

Two independent reviewers also reproduced **3/3 Rust unit tests**, the zero-error 12,000-constraint seeded comparison, **12 native C++ collision-disabled tee/pants extended-step comparisons** (maximum position difference 4.1e-15 m), and source Chrome **1,751 committed WASM sweeps / 3,135,114 constraint projections**. Four tee/pants 1- and 30-frame source comparisons had maximum position error **0**. In three warmed 16-step paired trials, one reviewer measured median distance-stage times of tee JS **27.1 ms** versus Rust **15.9 ms** and pants JS **9.9 ms** versus Rust **6.6 ms**; another independently measured tee **25.9 ms** versus **17.8 ms** and pants **10.3 ms** versus **7.1 ms**. `check-factory.mjs` produced a valid 45-file, six-size package and `check-native-cpp-preflight.mjs` passed 13 fixtures. After this independent review and source packaging fix, RUST-032 was requeued, claimed with a fresh token, and marked **done** in the durable migration queue. This certifies only this source numerical stage, not the full cloth solver or installed application.

## First-party inventory and completion gates

The independently exercised `rust/exo_migration_audit` was extended to include previously omitted first-party `rust/` crates and `scripts/` automation/tooling paths; its fixture test passes. Across its nine declared surfaces, the updated **file inventory** counts **85 Rust files** and **627 non-Rust files**: 181 C/C++ source/headers, 219 JS, 74 JSX, 144 MJS and 9 Swift. The `research/oss/clothcraft` upstream-derived fork (105 `.rs` files in a raw filesystem count), other undeclared roots, generated code and third-party runtime glue are **not** attributed to first-party ownership without a provenance/call-path audit. The scripts count includes development tooling. No Rust ownership percentage can be derived from these file counts; authoritative function/call-path ownership is still incomplete.

**Remaining independently unpassed gates:** complete first-party functional source audit and Rust UI/state/rendering ownership; native CPU/GPU cloth, sewing, collision, fabric and persistence parity; full real browser authoring and production export/round-trip QA; Rust HTTP/workspace/MCP route and host ownership; reproducible macOS build/sign/install and backed-up user-project smoke/rollback. The read-only shipping audit reports `releaseReady:false` (four source/installed binary differences, two missing installed Rust service artifacts, and two matching artifacts). The new PBD WASM is also absent from the macOS packaging allowlists. Do not declare 100% or close the recurring migration task.
