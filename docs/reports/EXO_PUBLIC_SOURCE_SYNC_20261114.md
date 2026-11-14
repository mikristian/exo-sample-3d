# EXO ClothCraft Studio V2 — reviewed public source sync, 2026-11-14

**Source-only update; not an installed app release.** This update is based on the existing published `sync/exo-v2-source-20261102` source checkpoint and adds reviewed first-party developments without publishing user projects, local models, downloaded CAD libraries, proprietary avatars, hardware, application binaries, or private credentials.

## Changes added

- Verified Rust command contract and bindings, native-grade history routing, 2D workspace integration, geometry/cutting helpers and targeted regression tests.
- Corresponding modified ClothCraft engine Rust source for the new EXO edits, kept under `research/oss/clothcraft/src`; the upstream origin remains `https://github.com/erythrofr/ClothCraft` and local EXO modifications **are not claimed to have been accepted upstream**.
- First-party V3 native prototype and Rust-first candidate QA/build scripts, with no claim that V3 replaces the stable V2 app.
- November 12 engineering evidence and November 14 source-language, UI and all-system Rust migration plan.

## Verification performed before source sync

- 11/11 targeted Node tests passed after removing an invalid assumption that the local verified garment-geometry embedding index must always contain precisely 73,069 examples. Larger verified indices are now allowed; malformed/trust boundary checks remain.
- 4/4 `exo_command_contract` Cargo tests passed (`ts-rs` reported non-blocking serde attribute warnings).
- Selected source scripts passed JavaScript syntax validation; migration plan includes all 41 backend systems and 12 UI areas.
- Public-file scan rejected embedded home directories, obvious token/key formats and sensitive filenames. Selected files are source/docs/tests, not generated datasets, downloaded third-party clones or macOS build outputs.

## Release blockers — do not treat this commit as a downloadable full EXO app

The **installed** EXO V2 desktop package is not proven to match a reproducible public source revision. The existing publication check found private CLO avatar resources, personal machine paths in packaged resources, local edits in the ClothCraft engine without a clean upstream pin, and a mismatch between selected GitHub source and the local workspace source. There is also no completed clean-machine signed/notarized source-matched installer acceptance for this new checkpoint.

To publish a desktop installer, first create a clean source-pinned build; exclude licensed/private media and local paths; reproduce the Rust/Swift/Node/WASM dependencies with recorded hashes and notices; test signed macOS packaging, installer and rollback; then run user-interaction and independent manufacturing/physics gates. Until then keep the installed app unmodified and publish only verified corresponding source.
