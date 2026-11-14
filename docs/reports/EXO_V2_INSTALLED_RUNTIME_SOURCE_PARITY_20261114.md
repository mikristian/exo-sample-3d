# EXO ClothCraft Studio V2 — installed app versus public source, November 14, 2026

**Status: public source sync tested; exact installed-binary reproduction is not certified.** The EXO app presently launched from the user's macOS Applications directory was deliberately **not** modified, reinstalled, signed, relaunched or deleted in this audit. This is not a factory-ready, externally qualified garment application release.

## Identified running version

- Executable: `EXO ClothCraft Studio V2.app/Contents/MacOS/EXOClothCraft` (full Studio V2, not the smaller native preview).
- Installed `runtime-provenance.json` schema: `exo.desktop.runtime-provenance.v3`.
- Embedded build timestamp: `2026-11-03T02:28:20.536Z`.
- Installed provenance identity was checked from the original on-device manifest, not from a guessed GitHub tag. Only relative filenames and cryptographic hashes are reported here; no user-home path is published.

## Bundle-level evidence

The installed manifest declared **279 runtime entries**. Every on-disk entry was present and matched its original SHA-256 manifest value (**279/279 installed-byte integrity checks passed**). That confirms no drift against the installed manifest; it **does not** prove matching public source or a reproducible signed build.

Against the November 14 source-sync checkpoint, the 279 manifest entries partitioned as follows:

| Provenance category | Entries | Meaning |
|---|---:|---|
| Same-path first-party source with identical bytes | 64 | Public source bytes directly match installed source after privacy-safe path normalization |
| Installed first-party historical variants preserved exactly | 5 | The corresponding installed bytes are separately archived in `source-snapshots/exo-v2-installed-20261103/` and SHA-verified |
| Machine-specific first-party source normalized for privacy | 1 | The original absolute home-directory path was replaced by a portable runtime path; byte-for-byte installed-source parity is intentionally not claimed for this source file |
| Compiled or third-party runtime | 93 | Rust/C++ executables, Node/toolchain components or other runtime output; source/build chain requires separate independent evidence |
| Web build outputs or assets | 115 | Vite JavaScript/CSS/WASM/other assets; source mapping and build-input provenance must be established, and restricted assets excluded |
| Restricted or local resource | 1 | Needs a rights-safe replacement; not copied into GitHub |
| **Total** | **279** | 279 installed file hashes matched their runtime manifest |

**Historical JavaScript source:** Five differing first-party source files were copied byte-for-byte to the safe historical snapshot directory rather than overwriting up-to-date code. Their SHA-256 values are recorded in `SOURCE_SHA256.json`; no avatar, personal media, machine-specific absolute path, key, token or compiled binary was copied. The final public `main` source has exact installed bytes for **69 of the 70 first-party source files directly present in the installed runtime manifest** (64 at their active paths and five in historical snapshots). The remaining installed source used a machine-specific personal home path and has deliberately been normalized in the public source. This narrow comparison does not establish complete application source-to-binary correspondence.

## Rebuild performed

- Created an **isolated source checkout** from the combined public `main` + latest reviewed source-sync Git tree. No user project, live app or dirty development worktree was modified.
- Rebuilt the Vite frontend through the project's existing pinned local Node dependency tree. For a lightweight offline safety test, `publicDir` was deliberately set to `false`, meaning this did **not** copy large or potentially restricted public media assets into the preview.
- **2,735 JavaScript modules transformed, Vite build passed** using source imports from `src/`, `integrations/clothcraft/`, `ppf_backend/`, research engineering indexes and the EXO character components.
- Launched the generated HTML/JS/CSS through a localhost static test server in headless Chrome. **HTTP 200, populated React app root, real EXO menus visible, zero page JavaScript exceptions and zero HTTP 5xx errors**. The preview server and browser were shut down after the isolated test.
- The installed app's active UI uses the JavaScript asset `index-DXLIiy-2.js`. The isolated combined-source build emits **a different JavaScript asset**, while the main stylesheet `index-Bov-pTR0.css` remains the same. A separate experiment using the November 2 public source and the five historical installed JS overlays also produced a different JavaScript asset. **Exact UI byte reproduction has therefore not been proved.**
- This was **not** a clean-machine macOS release build: the local Node dependency tree was reused, the resource copy was intentionally disabled, Swift/native dependencies were not recompiled to byte equality and an installed app installer was not generated.

## Release gates remaining before claiming the public repository exactly reproduces today's installed app

1. Create a clean, source-locked build of the installed macOS executable, Node services, Rust `marvelous-cloth` engine and EXO service binaries, C++ CAD support and WebKit/WASM runtime; pin dependency hashes and include all corresponding-source and license notices.
2. Eliminate/rebuild prohibited private CLO avatars or hardware models and all personal filesystem paths from the public release bundle. The installed app currently has private resources and personal paths, so **do not** upload its `.app` or `.dmg` unchanged.
3. Resolve the local modified upstream `research/oss/clothcraft` checkout into a clean auditable upstream baseline plus reviewable EXO patches. Do not claim all patches are part of upstream `erythrofr/ClothCraft`.
4. Match the installed app's active Vite UI asset hash, or explicitly label the new source-built candidate as a **new** release instead of falsely calling it the same binary. Run installed app file-tree/hash evidence against that new candidate.
5. Test the source-built and packaged candidate on a **clean Apple Silicon Mac**, including launch, 2D editing, Rust/JS IPC, six-size grading, save/undo/restart, safety validation, 3D viewport, runtime assets and rollback; record signing/notarization status.
6. Independently validate high-stakes industrial cutter exports and physically calibrated draping if those features are described as manufacturer-ready; software compilation alone is not acceptance.

## Reproducible checks

Run the **read-only** auditor against a Git commit on a Mac with EXO installed:

```bash
python3 scripts/release/audit-installed-v2-source-parity-20261114.py --ref main
```

Run existing fail-closed bundle publication inventory checks (expected to report blockers until explicitly resolved):

```bash
EXO_RELEASE_SOURCE_REF=main bash scripts/release/check-full-v2-publication-gates-20261024.sh
```

**Publication policy:** The public repository may be kept current with safe source and evidence **without** including an unreleasable private app bundle. A passing GitHub commit, static source audit or browser boot does not independently qualify a downloadable installer as source-matched. Preserve the user's functioning local installation until a source-built candidate is accepted.
