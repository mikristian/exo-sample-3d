# EXO V3 React Hybrid — First live integration checkpoint

Status: The isolated macOS V3 React Hybrid app uses the **exact installed EXO V2 React interface** and the **existing authenticated EXO Rust/ClothCraft runtime**. This is the first shell integration for Stage A of the backend-first migration. It does NOT mean every button has been ported to Rust.

## Current verified behavior

- React UI: actual V2 bundled web index served byte-for-byte; no recreation or screenshots.
- Backend: separate EXO Rust static host and native ClothCraft exo-session, verified through bridge health and signed runtime-provenance identity.
- Isolated preview: ports 5486 (React) and 5485 (authenticated bridge), app-owned subprocesses and watchdog, isolated garment Output data.
- Preserves installed EXO V2 and original native Rust V3; no source mutations, user-project modifications or original app overwrites.
- Symlinks to existing 3.1GB V2 resource bundle locally and reuses the already-verified signed V2 Node executable read-only. Therefore this preview is NOT self-contained, notarized or redistributable.

## Reproduce on the Mac

Requires existing V2.app, its Node cache, original EXO source and a writable external volume with at least 250 MiB available.

Run the portable build script with --repo /path/to/exo-sample-3d and --destination /Volumes/YourDrive/EXO-V3-Hybrid. It will create a separately named EXO ClothCraft Studio V3 React Hybrid.app, refusing to overwrite. Open that app normally in Finder or with open -n.

Example commands:

    python3 apps/exo-clothcraft-v3/hybrid/build-preview.py --repo /path/to/exo-sample-3d --destination /Volumes/YourDrive/EXO-V3-Hybrid
    open -n "/Volumes/YourDrive/EXO-V3-Hybrid/EXO ClothCraft Studio V3 React Hybrid.app"
    python3 apps/exo-clothcraft-v3/hybrid/verify-preview.py

The launcher is generated from the existing audited V2 Swift AppKit/WebKit source, uses staged ports and prevents V2 runtime cache overwrites. NEVER sign the whole app with a recursive --deep flag across its symlinked resource directories.

## Incomplete; do not claim full Rust parity

- Active EXO buttons can still invoke JavaScript and C++ logic. The existing V2 EXO/ClothCraft Rust bridge, not the standalone V3 native egui library, is in use.
- The authoritative shared Rust garment document, lossless V2 project import/export and all-button Rust command ledger are NOT finished.
- ClothCraft CPU solver executes real steps, but the current six-size garment fit validation still fails seam closure and strain.
- This prototype depends on the external drive and locally installed original V2 app. It is a development checkpoint, not a production build.

## Next implementation work

1. Inventory each reachable V2 React action; use the button-parity ledger in docs/rust-migration.
2. Consolidate EXO and ClothCraft into one Rust garment schema, command API, revision log and durable Undo/Redo.
3. Move all existing CAD, grading, sewing, physics, manufacturing and saved-project operations to Rust one tested behavior at a time, keeping React presentation-only.
4. Swap the preview's V2 runtime dependency for an independent V3 Rust service and revalidate old EXO projects.
5. Once this backend works, progressively replace React views with egui/wgpu Rust UI.

Smoke verification (2026-11-15): the React index SHA-256 matched V2; Rust bridge health showed ok, nativeReady, nativeSession.loaded, nativeProcessRunning and provenance verified. This proves the hybrid launched; it is not all-button feature parity.
