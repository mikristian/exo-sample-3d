# EXO V2 Rust tooling adoption audit — 2026-10-21

## Scope and evidence

Read-only local inspection of the live `/blender-mac-workspace/exo-clothcraft-v2` worktree, shell commands, Rust toolchain, Cargo cache, npm executables, existing kernel manifests and WASM build scripts. This document is the only created file. No dependency was downloaded, installed, compiled or added to application code. No Git working-tree changes were reset or overwritten.

## Observed environment

| Tool or capability | Observed state | Adoption implication |
| --- | --- | --- |
| Rust / Cargo | `~/.cargo/bin/rustc --version`: `rustc 1.99.1 (58cf8f9c3 2026-10-13)`; Cargo `1.99.1` | Ready through explicit `~/.cargo/bin` path; current interactive `PATH` does not resolve `cargo`, `rustc`, or `rustup`. |
| Rust WASM target | `rustup target list --installed`: `aarch64-apple-darwin`, `wasm32-unknown-unknown` | Existing isolated `cdylib` WASM kernel build approach remains viable. Target installation was verified; a fresh build was **not** run. |
| Oxc / Oxlint / Oxfmt | `command -v` found none; `node_modules/.bin` contains no matching executable | Candidate for a future JS/TS static-analysis pilot only after version/license and free-space review. Do not assume the Oxc umbrella CLI exists. |
| ast-grep (`ast-grep` / `sg`) | Neither CLI resolved | Candidate for narrowly scoped AST migration rules; not available for immediate offline pilot. |
| `cxx` | No CLI resolved and no matching cached source crate discovered | Assess Rust/C++ FFI in a native-only experimental crate; `cxx` is principally a Rust crate ecosystem, so CLI absence alone does not prove the bridge is unavailable. Not needed for JS ↔ WASM ABI. |
| `wasm-bindgen`, `wasm-pack` | Neither CLI resolved; no matching cached `wasm-bindgen` source crate discovered | Current direct-export kernels avoid this dependency and its generated JS glue. Defer until a concrete ABI/interface need. |
| `proptest` | No CLI (expected; it is a crate) and no `proptest-*` source in local Cargo registry | Strongest candidate for differential/property QA; install would require cache/download and transitive dependency review. Offline immediate adoption unverified. |
| Node/npm/Vite | `node`, `npm`, `npx` resolved in `/usr/local/bin`; `node_modules/.bin/vite` exists | Existing JS differential harnesses and Vite build remain suitable validation paths. |
| C++ tools | Apple `/usr/bin/clang` exists; `cmake` not on `PATH` | Native C++ parity harnesses can be evaluated per existing scripts; do not assume CMake support. |
| Disk | `df -h .` reported 460 GiB volume, 415 GiB used, **1.3 GiB available**, 100% capacity rounded | Do not install toolchains/packages or run builds in the current constrained environment. Prior estimate of ~1.4 GB has already fallen to 1.3 GiB. |
| Local footprint | Cargo registry ~210 MB; `rust/` ~332 MB; `public/wasm` ~1.1 MB; no output from `du` for nonexistent `~/.cargo/git` | Large independent target directories and build artifacts are material risks; never clean others' data without coordinated approval. |

The working tree contains many unrelated modified files. The RUST-033 structural strain candidate and its files were inspected for context only; no source modification was attempted. The existing `rust/exo_structural_strain_kernel/Cargo.toml` declares `rlib` and `cdylib`, and `scripts/build-rust-structural-strain-kernel.mjs` runs offline Rust tests and release `wasm32-unknown-unknown` compilation before copying the WASM asset. The foam build script uses `--locked --offline --release --target wasm32-unknown-unknown`. These are existing workflows; the audit did not execute them.

## Recommended dependency pilot

**Pilot: property-based differential tests using `proptest` in one disposable, isolated Rust QA crate**, chosen after free disk is expanded and the candidate's published license and complete dependency tree are reviewed. Start with the already isolated structural-strain numerical contract once RUST-033 settles, but do not edit its currently worker-owned source or shared tests. Feed bounded seeded arrays of structural/nonstructural constraints, zero rest lengths, NaN/infinite data, repeated particle IDs and randomized ordering; compare returned Rust arrays with the frozen production JS baseline, preserving strain sample counts and output shape. `proptest` brings shrinking and reproducible regressions; existing seeded JS and browser fixtures remain the final source integration gate.

Pilot gates, in order:

1. Restore adequate headroom on a user-approved external/scratch volume and confirm free space with `df -h .` and `df -h "$CARGO_TARGET_DIR"`. A practical conservative gate is **at least 5 GiB free where outputs actually land**, with additional headroom for concurrent workers; the 5 GiB value is a proposed policy, not a measured build requirement.
2. Verify `proptest` exact version, SPDX license, transitive licenses, advisories, and feature set using an independently validated source or an approved registry mirror. Typical `proptest` releases advertise MIT/Apache-2.0; **the specific intended version and full tree have not been verified locally**. Commit `Cargo.lock` for the pilot, record hashes and package source.
3. Stage only a small stand-alone test crate/feature branch or worker-owned pilot files, reusing the existing Rust strain data model without changing production glue. Keep `proptest` under `[dev-dependencies]`; avoid adding it to `cdylib` shipping artifacts. First implement finite/bounded vectors, then explicit exceptional-value cases handled outside generators as necessary.
4. Build and run offline or from a pinned/approved cache using a target directory on expanded storage: `CARGO_TARGET_DIR=/approved/external/path/exo-proptest-target ~/.cargo/bin/cargo test --manifest-path <pilot>/Cargo.toml --locked --offline`; pass status is contingent on the package being cached or previously approved and downloaded.
5. Compare at least 10,000 seeded constraints, save minimized failing seeds without touching garments; run existing JS parity, Chrome source QA, native C++ strain comparison where compatible, architecture checks and Vite build after the pilot passes. Track per-case numerical tolerance and NaN/zero semantics separately. Do **not** label tests as solver certification.

Decision metric: proceed only if shrinking reveals a genuine edge case or demonstrably reduces QA maintenance effort without changing production simulation output. Otherwise drop the proposed dependency and keep the existing deterministic test harness.

## Other tools: staged feasibility and license checks

| Option | Proposed narrowly scoped follow-up | Licensing/security diligence before download |
| --- | --- | --- |
| Oxc (Oxlint/Oxfmt/parser) | Trial read-only linting on one mature JS bridge after RUST-033, report false positives and runtime cost; retain existing lint baseline | Verify exact component version and its repository/package SPDX declaration, lockfile and native binaries; check transitive packages and platform support. Public ecosystem licenses are not verified by this audit. |
| ast-grep | Trial one checked-in structural search rule locating numerical JS loops likely to benefit from Rust and one rule guarding forbidden bridge fallback removal | Verify exact release license, upstream authorship, distribution binary signature/checksum and dependencies. AST findings require manual review; no auto-rewrite in live shared worktree. |
| `cxx` | Native-only proof of concept for a single C++ numerical parity helper, outside production WASM | Verify `cxx`, `cxx-build`, code-generated headers and transitive crate licenses for exact versions, plus C++ toolchain availability. Rust↔C++ bridge is not a substitute for browser JS glue. |
| `wasm-bindgen` / `wasm-pack` | Benchmark bridge ergonomics and binary size against the existing direct WASM export ABI on a tiny test crate | Review exact crate/CLI versions and their licenses and generated JS distribution obligations; confirm Cargo/Rust compatibility, reproducible pinning and offline buildability. |
| `proptest` | Isolated nonshipping QA crate as detailed above | Verify exact released version and full dependency graph, including RNG/backtrace-related optional features, license compatibility and advisories. |

Do not claim any of these are locally installed based solely on an npm or Cargo dependency listing. The local cache scan found no `proptest-*`, `cxx-*`, `wasm-bindgen-*`, Oxc or ast-grep source directories within the first two levels of `~/.cargo/registry/src`; alternate vendored copies were not exhaustively ruled out. Native C++ tools, browser QA, and all proposed adoption tests remain unexecuted in this audit.

## Commands executed (read-only) and outcomes

Commands were executed from the live EXO worktree unless shown with an absolute path:

```sh
pwd
rg --files -g 'AGENTS.md' -g 'Cargo.toml' -g 'package.json' -g '*wasm*' -g '*rust*' | head -100
for c in oxc oxlint oxfmt ast-grep sg cxx wasm-bindgen wasm-pack cargo rustc rustup proptest node npm npx clang cmake; do command -v "$c" || true; done
df -h .
git status --short | head -70
ls -la "$HOME/.cargo/bin" "$HOME/.rustup/toolchains" 2>/dev/null | head -60
ls node_modules/.bin 2>/dev/null | rg 'ox|ast|sg|wasm|cxx|eslint|vite'
find rust -maxdepth 3 \( -name Cargo.lock -o -name .cargo \) -print | head -30
rg -n 'wasm-bindgen|proptest|cxx|serde|crate-type' rust/exo_structural_strain_kernel/Cargo.toml rust/exo_foam_kernel/Cargo.toml integrations/clothcraft/rust-service/Cargo.toml package.json
ls -ld /Volumes/Expansion /Volumes/* 2>/dev/null | head -25
rg -n 'rustc|cargo|wasm|build-rust' scripts/build-rust-structural-strain-kernel.mjs scripts/build-rust-foam-kernel.mjs | head -65
"$HOME/.cargo/bin/rustc" --version
"$HOME/.cargo/bin/cargo" --version
"$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc" --print target-list | rg '^wasm32-unknown-unknown$'
"$HOME/.cargo/bin/rustup" target list --installed
ls "$HOME/.cargo/registry/src" 2>/dev/null | head
find "$HOME/.cargo/registry/src" -maxdepth 2 -type d \( -name 'proptest-*' -o -name 'cxx-*' -o -name 'wasm-bindgen-*' -o -name 'oxc_*' -o -name 'ast-grep-*' \) -print 2>/dev/null | head -35
du -sh "$HOME/.cargo/registry" "$HOME/.cargo/git" rust public/wasm 2>/dev/null
rg -n 'license|wasm-bindgen|proptest|cxx|oxc|ast-grep' rust/exo_structural_strain_kernel/Cargo.lock rust/exo_foam_kernel/Cargo.lock package-lock.json | head -35
git status --short -- docs/engineering/exo-rust-tools-adoption-audit-20261021.md
```

All individual commands other than the `du` scan completed with zero exit codes. The `du` scan exited 1 because `~/.cargo/git` did not exist, while still reporting the three existing directory sizes. `rg` scans are limited by the paths and patterns shown. Repository `AGENTS.md` at the root or under `docs`/`docs/engineering` was not present, as separately checked using path reads. No compile, test suite, browser run or external GitHub licensing check was performed. **PASS**: toolchain discovery, Rust WASM target discovery, existing script inspection, disk/cached-dependency audit. **NOT RUN**: dependency pilots and performance/parity/build validation.
