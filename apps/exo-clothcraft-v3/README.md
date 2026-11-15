# EXO ClothCraft Studio V3 · native Rust foundation

V3 is a **separate, early-stage Rust desktop application**. It doesn't replace
the installed V2 app, edit the V2 source or modify the vendored ClothCraft
working tree. Its current source is under `apps/exo-clothcraft-v3/`.

## Active Phase A conversion — source on Jarvis Expansion

The React-first backend conversion is **underway**, not complete. In the Expansion source checkout, the real React workspace request hook now calls a checked Rust-workspace command dispatcher (strict revision checks, authenticated native transport, malformed command rejection and no JavaScript retry). A parallel Rust command schema is in the EXO-owned exo-command-contract crate, with tests.

- [Current 41-system status and proof limits](../../docs/rust-migration/EXO_V3_STAGE_A_STATUS_20261115.md)
- [Machine-readable 41-system tracker](../../docs/rust-migration/EXO_V3_41_SYSTEM_RUST_STATUS_20261115.csv)
- [JavaScript transport unit tests](../../src/core/exoRustCommandDispatch20261115.test.mjs)
- [Rust native command-contract tests](../../rust/exo_command_contract/src/workspace.rs)

The source changes are not yet deployed into the locally running Mac hybrid. The other EXO React business/C++ functions still need per-button Rust conversion, common garment-document ownership, and real browser/native end-to-end verification. The 2026-11-15 six-size tee physical fit rejection remains open.

## React-first V3 hybrid preview (2026-11-15)

**Working local development preview:** EXO V3 can now launch the original EXO React UI beside a separate authenticated Rust/ClothCraft workspace, without changing the original V2 application or this native egui V3 prototype. See the [hybrid instructions](hybrid/README.md), the [preview builder](hybrid/build-preview.py) and the [live health test](hybrid/verify-preview.py).

This first shell uses **exactly the locally installed V2 React bundle and existing V2 Rust/ClothCraft service**. A verified native Rust exo-session is running, but it does **not yet** move every V2 JavaScript/C++ button handler to Rust or link to this native V3 editor's garment document. The final V3 backend migration and all-button parity remain open work. The preview references the owner's installed V2 resources read-only, uses separate ports 5485/5486 and an isolated workspace on an external drive, and is not a portable production app. The original native Rust V3 application described below continues to coexist unchanged.

## Run on macOS

From the EXO repository root:

```sh
cd apps/exo-clothcraft-v3
~/.cargo/bin/cargo run --offline
```

To build a **separate** local macOS `.app` under `~/Applications`, run
`bash apps/exo-clothcraft-v3/install-macos.sh` from the repository root.
The installer intentionally refuses to overwrite an existing V3 build by
default. To upgrade V3 while keeping a timestamped backup of the old app,
use `bash apps/exo-clothcraft-v3/install-macos.sh --backup-existing`.
An already-running V3 process is not force-quit, to avoid losing unsaved work;
use `open -n -a "$HOME/Applications/EXO ClothCraft Studio V3.app"` to launch
the new installed build alongside it if necessary. The historical installed build copied
upstream MIT and EXO GPL notices; new source-built releases must include the
current EXO first-party MIT license and preserve third-party notices. The build is local, ad-hoc-signed
and **not notarized for public distribution**.

The binary is a genuine `eframe`/`egui` native desktop app (not Electron,
WebKit or a JavaScript wrapper). The `marvelous-cloth` package is linked by a
local path dependency to the existing EXO Rust fork:
`research/oss/clothcraft`.

## What really works in this first vertical slice

- Start a built-in T-shirt or dress engineering document in Rust.
- View and select actual ClothCraft 2D panel contours.
- View the same document's compiled Rust 3D triangle mesh in a linked
  side-by-side placement preview. Drag to orbit and use the header zoom slider.
  **This view is not running the cloth solver and is not fit-certified.**
- Add a rectangular panel, duplicate or remove a panel, and edit polygon
  anchor coordinates in millimetres.
- Create and remove real Rust seams by selecting named panel boundaries, with
  equal-rest-length and occupancy validation; sewn edges display in orange.
- Every edit uses `marvelous_cloth::authoring::apply`, which validates and
  compiles the complete garment before changing the authoritative model.
  The compiled mesh and persisted template are updated together, including
  Undo/Redo, and remain one source for both viewports.
- Undo and redo through Rust `History` (only for the current open session).
- Save and reopen the **native** `marvelous-cloth-template` JSON format. Saves
  use atomic file replacement and validate the model first. Reopening creates
  a new history, not a claimed durable Undo log.
- Reject malformed load, invalid dimensions and bad geometry without changing
  the live document. Unimplemented UI tools stay visibly disabled.

This is not yet a full EXO UI port: **live 3D simulation**, advanced grading,
cutting markers and factory-ready export remain disabled. The saved project
format currently covers ClothCraft's editable garment template, **not** all
EXO V2-specific grading, artwork, tech-pack, avatar, workspace or history data.
Do not use this prototype to replace your existing EXO project files.

## Why this is a new app instead of a wholesale Git merge

The local ClothCraft fork contains substantial uncommitted custom Rust work
and follows an older upstream baseline. Updating it in place or copying unreviewed
third-party/legacy GPL-only sources into MIT upstream would be unsafe. V3 links
to that code without mutating it. ClothCraft retains its original license and
attribution; EXO-owned new V3 source is now MIT, with third-party and historical
licenses preserved.

## Migration acceptance order

1. Establish a clean, pinned and tested upstream/EXO Rust-core integration
   branch while preserving all present V2 changes and binary provenance.
2. Replace direct app-specific command calls with a typed, versioned
   capability/command API shared by V3 and the core. Preserve stable panel,
   edge and seam identities, expected document revisions and atomic failures.
3. Expand the single Rust document and loss-reported import/export mapping to
   cover EXO projects, grading, manufacturing and fitting state without silently
   dropping fields. Keep units in SI internally and millimetres in UI.
4. Bring over EXO's complete visual workspace incrementally in native egui/wgpu.
   Enable an individual tool only after native round-trip, Undo/Redo and
   independent geometry/measurement tests pass.
5. Package and test V3 independently. Deprecate the old JavaScript/Node bridge
   **only when** the required V2 capabilities pass in native V3.

Original ClothCraft upstream remains a separately maintained MIT project.
Contributions to upstream `main` still require maintainer review and proper
per-file licensing/provenance; this local V3 app is **not** an upstream merge.
