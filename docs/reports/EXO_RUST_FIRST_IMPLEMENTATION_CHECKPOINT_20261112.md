# EXO Rust-first implementation checkpoint — 2026-11-12

## Scope and safety

Keep EXO React/Three.js frontend and installed signed `~/Applications/EXO ClothCraft Studio V2.app` unchanged. All work here is isolated new source, tests and reports. No user garment, existing project, live service, vendor binary, or production framework was replaced. The working tree already contains thousands of unrelated changes, so do not declare a release without an isolated clean reproducible build.

## New outcomes

1. `scripts/audits/exo-rust-migration-runtime-reachability-20261112.mjs` uses locally installed Babel AST parser to trace candidate frontend/Node service entries. Self-test verifies direct imports, reexports, literal/dynamic unknown imports and unreachable modules. Main graph found **918 parsed source modules**, including **696 source-mapped backend files / 78,302 lines**, with 0 parse failures. Static reachability is not proof of runtime execution. Results: `docs/reports/EXO_RUST_MIGRATION_REACHABILITY_20261112.{json,md}`.
2. `rust/exo_command_contract` is a new independent Rust crate using `serde`, `serde_json`, `ts-rs 12.0.1` to define a strictly validated V1 command type for four existing native grade commands. `cargo test --locked` ran successfully and emitted `bindings/ExoGradeCommandV1.ts`. The TypeScript revision is `number` rather than `bigint` because browser JSON cannot serialize `bigint`; Rust rejects revisions beyond JS `Number.MAX_SAFE_INTEGER`. The generated binding is not yet imported by live EXO UI.
3. `scripts/qa-exo-rust-grade-command-contract-20261112.mjs` checks the generated TS discriminated union against actual `exo-session` Rust handler branches. `--probe-native` also checks the built Rust executable's native metadata/commit-generation capability flags. This does **not** prove full live UI wiring.
4. `scripts/qa-rust-grading-connected-migration-20261112.mjs` is a disposable **real Rust WASM to native Rust session acceptance**: 336 coordinate comparisons across 28 points, two panels and six grading sizes; native persisted size catalog, six native size activations and restores, and seven negative cases. This proves a real Rust cross-engine lifecycle, not that the React button currently uses this exact mapping. Report: `docs/reports/EXO_RUST_GRADING_CONNECTED_20261112.md`.
5. `scripts/audits/exo-cpp2rust-feasibility-20261112.py` extracts a narrow C++ DXF layer-name helper and compiles a manually translated Rust equivalent in a disposable directory; **13/13 byte-exact output comparisons passed**. The automatic Cpp2Rust tool was NOT installed or run. Report: `docs/reports/EXO_CPP2RUST_PILOT_20261112.md`.
6. `scripts/qa-exo-rust-first-release-gate-20261112.mjs` combines existing WASM grading QA, six-size native preview checks, new Rust→TS contract, static graph self-test, the real Rust grading round-trip and source-versus-installed binary identity. All baseline checks pass, but the read-only audit finds **three installed artifacts different from current source** (native Rust session, metadata validator, static host), so `--require-ready` exits **1**. The gate also deliberately refuses to substitute basic tests for browser integration, physical solver/calibration, factory and signed rollback acceptance.
7. The existing React grading component now routes its user-facing **Activate Size** and **Restore Original Size** request construction through `src/core/exoNativeGradeCommandV1.js`, which validates safe revisions/size labels and references the generated Rust TypeScript contract. `src/core/exoNativeGradeCommandV1.test.mjs` passed 3 tests. No visible UI layout/rendering was changed. This is source-wiring proof, not a clicked browser workflow. The contract crate is a *checked mirror* of native request JSON until `exo-session` itself imports its types.
8. `scripts/audits/exo-cxx-bridge-pilot-20261112.py` independently proved a real Rust executable calling the original C++ DXF safe-layer helper through a disposable `extern "C"` ABI: **13/13 byte parity, 5/5 negative inputs, 4/4 ABI error assertions**; output buffer canaries held. This used a small direct C ABI, not the uncached CXX crate, and does not prove full DXF bridge. See `docs/reports/EXO_CXX_BRIDGE_PILOT_20261112.md`.
9. `scripts/qa-rust-grading-browser-connected-20261112.mjs` and its report provide an isolated browser-to-Rust acceptance harness. The single bounded execution **stopped at preflight** because existing Chrome has no reusable CDP endpoint and no Desktop browser connector was available; no UI event, save, or browser Undo/Redo was actually tested. See `docs/reports/EXO_RUST_GRADING_BROWSER_CONNECTED_20261112.md`. The gate must remain red for live browser acceptance.

## Verification commands

```bash
node scripts/audits/exo-rust-migration-runtime-reachability-20261112.mjs --self-test
node scripts/audits/exo-rust-migration-runtime-reachability-20261112.mjs
PATH="$HOME/.cargo/bin:$PATH" CARGO_TARGET_DIR=/tmp/exo-command-contract-target cargo test --locked --manifest-path rust/exo_command_contract/Cargo.toml
node scripts/qa-exo-rust-grade-command-contract-20261112.mjs --probe-native
node scripts/qa-rust-grading-connected-migration-20261112.mjs
python3 scripts/audits/exo-cpp2rust-feasibility-20261112.py
node scripts/qa-exo-rust-first-release-gate-20261112.mjs
node scripts/qa-exo-rust-first-release-gate-20261112.mjs --require-ready  # expected exit 1 until release acceptance
node --test src/core/exoNativeGradeCommandV1.test.mjs
python3 scripts/audits/exo-cxx-bridge-pilot-20261112.py
node --check scripts/qa-rust-grading-browser-connected-20261112.mjs
```

## Conversion acceptance rules

For each authoritative garment operation: source Rust handler and exact ABI; command accepted through the actual React action; real native response (not stub), no silent JS/C++ fallback; preserved document revision and Undo/Redo; parity against fixed fixtures; clean source and signed bundle matching hashes; isolated rollback. For physical simulation require CPU/GPU parity and independent garment fit tests. For manufacturing require real DXF/plotter/cutter acceptance. Source-language percentages never satisfy these rules.

## Known limitations and next steps

- `ts-rs` currently emits a parser warning that it cannot interpret `serde(deny_unknown_fields)`; Serde itself still enforces strict fields. Avoid treating TS structural typing as a runtime security gate.
- No shared schema for all document response fields is generated yet, only four grading command request shapes. The React source routes two grading actions through a validated request adapter, but the full UI click-to-Rust and rendered result loop remains unverified. Incorporate the Rust contract crate into the native session before declaring literally one schema authority.
- The separate external ClothCraft native Rust engine's lines are not a percent-completed measure. Existing `exo-session` is the relevant authoritative backend target.
- Evaluate C++ conversion only on small isolated modules; C2Rust is for C, not C++, and CXX is a bridge rather than a translator.
- Physical fit and factory acceptance are independent of source-language conversion.
