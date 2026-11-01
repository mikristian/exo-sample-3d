# EXO ClothCraft V2: Clean architecture and Rust migration GitHub toolkit

**Saved:** 2026-10-30
**Scope:** Curated references and an execution playbook; this document does not represent a completed refactor, library installation, vendor acceptance, or runtime behavior change.

## Where these references are saved

- **Existing 12 Rust/toolchain references:** [exo-rust-github-registry.json](exo-rust-github-registry.json), with its existing separately pinned reference lock. This already includes **Oxc**, **ast-grep**, **CXX**, **wasm-bindgen**, **proptest**, **lyon**, **parry**, and UI/GPU research choices. The existing script `scripts/rust-migration-github-registry.mjs` assumes exactly 12 entries; leave that manifest untouched.
- **19 additional architecture/refactoring references:** [exo-architecture-refactor-github-registry-20261030.json](exo-architecture-refactor-github-registry-20261030.json), saved as GitHub URLs and EXO-specific adoption notes.
- **Already present for practical code analysis:** `tools/rust-migration/package.json` has `@ast-grep/napi` and `oxc-parser`; `tools/rust-migration/full-app-audit.mjs` and `runtime-ownership-audit.mjs` already provide conservative inventories and source reachability. Reuse these before adding overlapping tooling.

The current project combines React/Vite/Three.js, Node endpoints, Swift desktop hosts, C++ CAD/native modules, Rust kernels, Rust HTTP services and WebAssembly adapters. Source ownership, installed runtime provenance and functional parity are separate questions. Many concurrent code changes exist; make architecture improvements in isolated, narrowly scoped increments.

## First choices: direct benefit to EXO

| Priority | GitHub | Purpose in EXO | First safe use |
|---|---|---|---|
| **1** | [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) | Trace browser/core/adapter imports and cycles; enforce clean dependency direction | Read-only `src/` dependency graph, then baseline rules |
| **1** | [Knip](https://github.com/webpro-nl/knip) | Find unused modules, exports and dependencies | Report-only scan, manually review dynamic/desktop/CLI loading |
| **1** | [jscodeshift](https://github.com/facebook/jscodeshift) | Large, repeatable JS/JSX AST-based rewrites | Pilot fixture-tested import and function extraction transformations |
| **1** | [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries) | Stop new architectural coupling once boundaries are defined | Warning-only rule for UI importing native adapters or domain importing UI |
| **1** | [cargo-modules](https://github.com/regexident/cargo-modules) | Show Rust module structure, edges, cycles and orphan files | Inspect one stable Rust crate before reorganizing |
| **1** | [rust-analyzer](https://github.com/rust-lang/rust-analyzer) | Rename/move Rust functions with reference awareness | Move only after parity/API surface is captured |
| **1** | [cargo-nextest](https://github.com/nextest-rs/nextest) | Faster scheduling and clearer failures for Rust tests | Benchmark selected Rust suites against existing test runner |
| **1** | [sccache](https://github.com/mozilla/sccache) | Reduce repeat Rust/C++ compilation work when eligible | Small build-cache experiment with explicit disk cap |
| **1** | [Ruffle](https://github.com/ruffle-rs/ruffle) | Reference design: one Rust core, desktop and WebAssembly frontends | Study its `core/`, `desktop/`, `web/` separation |

**Important distinction:** Oxc and ast-grep are already integrated into EXO's separate AST inspection tooling. Adding jscodeshift should solve an actual missing transform use case; do not duplicate functionality for its own sake.

## Other useful options

| Tool / reference | GitHub | When it is valuable |
|---|---|---|
| ts-morph | [dsherret/ts-morph](https://github.com/dsherret/ts-morph) | Symbol-aware JS/TS refactors requiring a project-wide model |
| Codemod CLI | [codemod/codemod](https://github.com/codemod/codemod) | Orchestrating multiple approved migration steps; choose this *or* a simpler transform runner |
| Biome | [biomejs/biome](https://github.com/biomejs/biome) | Fast incremental check/format, once formatting policy is agreed |
| cargo-deny | [EmbarkStudios/cargo-deny](https://github.com/EmbarkStudios/cargo-deny) | Rust supply-chain/advisory, source, version and licensing checks |
| cargo-machete | [bnjbvr/cargo-machete](https://github.com/bnjbvr/cargo-machete) | Candidate unused Rust deps; dynamic/macro uses require confirmation |
| cargo-llvm-cov | [taiki-e/cargo-llvm-cov](https://github.com/taiki-e/cargo-llvm-cov) | Evidence of code paths actually exercised by Rust regression tests |
| cargo-semver-checks | [obi1kenobi/cargo-semver-checks](https://github.com/obi1kenobi/cargo-semver-checks) | Public Rust API compatibility after crate boundaries stabilize |
| cbindgen | [mozilla/cbindgen](https://github.com/mozilla/cbindgen) | C-compatible exported Rust APIs consumed by native code |
| Zed | [zed-industries/zed](https://github.com/zed-industries/zed) | Reference for modular Rust desktop architecture at scale |
| Rust Design Patterns | [rust-unofficial/patterns](https://github.com/rust-unofficial/patterns) | Rust ownership, API and module design principles |

The preexisting registry also includes [CXX](https://github.com/dtolnay/cxx), the stronger first candidate for an explicit Rust-to-C++ interface, and [wasm-bindgen](https://github.com/wasm-bindgen/wasm-bindgen) for browser interfaces. CXX and cbindgen solve different FFI cases. The direct TypeScript-to-Rust translator in the existing registry is **experimental only**; no tool here proves general JS/TS-to-Rust semantic equivalence. [Google autocxx](https://github.com/google/autocxx) was archived September 21, 2026, so it is deliberately excluded from new recommendations.

## Recommended clean architecture target

```text
React/Three.js editor     Swift / native desktop       Automation / API
         |                         |                           |
         +-------------------------+---------------------------+
                                   |
                    versioned commands + project DTOs
                                   |
                         authoritative Rust domain
             geometry / topology / grading / sewing / marker
                                   |
                           adapters + ports
             JS/WASM      C++ FFI       DXF      persistence
```

This is a **target**, not the currently verified runtime layout. Keep presentation, domain rules, document/transaction state, and IO separate. Avoid introducing a universal service abstraction or a single giant crate before measuring actual dependencies.

### Boundaries worth enforcing

1. **Document identity:** one versioned garment project schema defining units, IDs, size run, seams, curve geometry and revision semantics; no hidden shadow schemas between editor, exports and Rust.
2. **Pure domain math:** core geometry, drafting, graded transformations, marker nesting and sewing matching should not import React, DOM, HTTP or Three.js.
3. **UI orchestration:** `src/components` may call public commands and query adapters, but must not bypass authoritative document mutation or revision gates.
4. **Transport adapters:** browser WASM, local Rust service, C++ CAD and installed Swift app must declare implementation, ABI and provenance explicitly. A successful source test does not prove the installed binary is current.
5. **Stable CAD contracts:** preserve model-space units, numeric tolerances, seam/allowance/cut identities, undo/redo semantics, DXF/AAMA cases and garment manufacturing validation across language transitions.

## Practical rollout for a large refactor

**Phase 0 — Baseline and ownership map.** Use existing `full-app-audit.mjs` and `runtime-ownership-audit.mjs`; add a read-only dependency-cruiser graph of `src/`. Record known cycles, runtime entrypoints, installed binary/source mismatches, and current acceptance fixtures. Categorize JS, Rust, C++ and Swift modules by *active execution path* before calling anything dead.

**Phase 1 — Guard new edges.** Adopt a dependency direction with narrow modules: UI → application commands → domain contracts → domain libraries; adapters implement the outward-facing IO/FFI edges. Start `eslint-plugin-boundaries` on one noncritical folder in warning mode. Use Knip only to generate candidates; validate every deletion against dynamic import, native bridge, test and build scripts.

**Phase 2 — Make refactors mechanical.** Develop a single, fixture-tested `ast-grep`/jscodeshift transformation for a small stable family of imports or adapters. Require dry-run counts, diff review, idempotence, public exports unchanged, and focused baseline tests. Prefer small PRs grouped by an interface rather than bulk formatting or sweeping moves.

**Phase 3 — Consolidate Rust intentionally.** Use cargo-modules/rust-analyzer on individual crates. Consolidate into a Cargo workspace or shared crates **only where shared dependencies, API contracts, and build integration justify it**. Existing individual Cargo manifests and `scripts/build-rust-*-kernel.mjs` are real release dependencies; enumerate them before relocating any source. Preserve wasm32 builds, exported symbols, loader ABI and fallback behavior.

**Phase 4 — Migrate vertical features.** For each subsystem, record JS/C++ source behavior, design a typed Rust owner, keep compatibility adapters, compare both versions on real garment fixtures, verify installed runtime, then retire legacy implementation once the replacement has the same documented surface. Prioritize stable geometry/document contracts before changing complex 2D interactions or manufacturing exports.

**Phase 5 — Accelerate without compromising evidence.** Use nextest where it measurably improves test execution and sccache where compiler cache hits are real. Use llvm-cov to expose untested cases. Keep tests for geometry, positive/negative DXF interchange, history/undo, grading and fabric numerical equivalence; check packaging/release provenance on the actual installed Mac app.

## Speed and correctness constraints

- **Compilation vs tests:** nextest accelerates execution of eligible tests, not compilation itself. sccache can cache eligible Rust and C++ compilation, but Rust `cdylib`, linking, procedural macros and incremental compiler settings can limit cache hits; measure with actual EXO build scripts.
- **File size and worktrees:** avoid cloning large reference repositories and avoid full-tree reformatting during active engineering loops. Keep links/metadata locally; install only needed pinned tools in an isolated workspace after checks.
- **Deletion false positives:** Knip and cargo-machete results are candidates. EXO has dynamically reachable plugin, native, and build paths that are not necessarily visible to static scanners.
- **Rust conversion:** syntax translation is distinct from feature parity. Measure preserved contract behavior and source-to-installed runtime provenance; generated Rust alone is not a successful migration.
- **External source reuse:** licenses and provenance must be checked before copying or vendoring code, independently of whether the copied code is later translated to Rust.

## Suggested first pilot

Pick a stable, small `src/core` support area outside active Modaris grading, marker/cut validation and installer edits. Capture its dependency graph, unused-export report and public contract; apply one reversible AST transformation; verify import graph and focused tests. This will establish a reliable recipe for larger refactors without disrupting ongoing engineering.

These repositories were checked against their public GitHub project pages on 2026-10-30. The catalog records references, **not** installation, cloning, code import, test completion, or correctness of future upgrades.
