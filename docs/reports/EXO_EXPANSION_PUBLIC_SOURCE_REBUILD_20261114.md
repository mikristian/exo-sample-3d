# EXO ClothCraft Studio V2 — portable source rebuild on Jarvis Expansion

**Date:** November 14, 2026. **Disposition:** reproducible-source checkpoint and partial native build **verified**; **not** a claim of byte-identical installed-app reconstruction, factory certification, or publicly qualified macOS installer.

## Source identity and storage

- Original public EXO base: [`mikristian/exo-sample-3d`](https://github.com/mikristian/exo-sample-3d), commit `1e4a9e3b51ee20244fd5e193aca5806f6579abee` at the time of the source freeze.
- Upstream Rust dependency: [`erythrofr/ClothCraft`](https://github.com/erythrofr/ClothCraft), with the explicitly reviewed EXO corresponding-source modifications already present in the selected Git commit. No claim that these modifications have been merged upstream.
- Physical Jarvis Expansion location (relative to the mounted physical volume): `EXO-Engineering/SourceRebuilds/EXO-V2-20261114-main-1e4a9e3b/`.
- Portable source archive: `inputs/exo-v2-public-source-main-1e4a9e3b-20261114.tar.gz`.
- **Archive SHA-256:** `43a47a6ec13e7c6509e3690e4a7e27885ce38df3326bda9dc2d3bdde0eccd9a5`.
- Exact source manifest: `evidence/portable-source-manifest-20261114.json`. The external archive contains **4,991 source/build/approved asset files**. Every archive member was decompressed and SHA-256 checked against the independent manifest: **4,991/4,991 matched**, with no undeclared or missing files.
- The allowlisted source selection had **zero personal-home directory path references**. The scanner is `scripts/release/audit-exo-portable-expansion-source-20261114.py`, also provided with the build inputs; no personal hostname, username, machine address, credential, local model archive or computer-specific absolute home path is needed.
- **291 optional media files omitted** under public-distribution asset groups: stage scenes, hardware, hanger/trim previews, fabric scans, 3D sample library, hand-tracking, preview avatars and screenshots. The corresponding source and clean MakeHuman reference fixture are retained as permitted; there are **no private CLO Thomas assets, converted CLO/YKK hardware, or CLO3D garment container files** in the portable source archive.
- The Mac's `ExpansionCloud` WebDAV alias is `noexec` and its `df` capacity is not meaningful. Verification and Cargo compilation occurred directly on Jarvis's physical Expansion drive. The unrelated removable SD card was not used.

## Verified builds and tests

| Subsystem | Source inputs and test method | Result |
|---|---|---|
| Rust core/grade | Clean Git source in isolated physical Expansion folder; Rust/Cargo 1.99.1; locked offline `exo-session` tests, no default UI feature | **9/9 focused grading tests passed** |
| Complete Rust session unit suite | Same pinned Git source, `cargo test --offline --locked --no-default-features --bin exo-session` | **62/62 passed** |
| React/Vite | Extracted, SHA-verified media-reduced source archive on Apple Silicon Mac; linked the already installed local Node dependency tree (not a fresh npm-ci proof) | **2,735 modules transformed; production build passed** |
| Browser smoke | Isolated HTTP static server plus headless Chrome against newly compiled public-source frontend | **HTTP 200, populated React UI, no page-script errors and no HTTP 5xx responses** |
| Native Swift launcher | Compiled first-party EXO V2 Swift source with `-D EXO_V2_STAGED -parse-as-library -O -target arm64-apple-macos13.0` | **Compiled Apple Silicon executable**; SHA-256 `58f937762d8db37768630617523ec6b2a60ea613bc2cae9e633ed1b1edc4746e`; independently read back from physical Expansion |
| Native C++ 2D drafting | Pinned source cross-built on Jarvis with Apple clang; executed x86_64 fixture there and arm64 fixture on Apple Silicon Mac | **Both tests passed**, arm64 output SHA-256 `f047400e7e1233ab7b1e9642774a83d1ea575575ddb37f02f562142ff52a9ab2` |

The public-source archive contains **source files and build metadata**, not the running private `.app` bundle or a generated signed public `.dmg`. Compiler outputs are held separately in `builds/` on the physical Expansion volume and are not included in the publicly distributable source snapshot.

## Required release and installed-app parity gates

1. A complete new native V2 `.app` must be assembled in isolated staging mode with `EXO_PUBLIC_DISTRIBUTION=1` and `EXO_INCLUDE_PERSONAL_AVATARS=0` (and a separate staging support directory). Never use the default personal-build flags or overwrite the running production app.
2. Finish clean source-pinned arm64 Rust service/solver binaries, C++ CAD CLI, Rust WASM kernels, Node service closure, and dependency/licensing notices. A source-matched installer requires **all** components, not simply Swift and React compilation.
3. Recreate the active WebKit asset and native service hashes or classify the result as a *new public build*. The installed V2 application's active JavaScript and some compiled runtime resources remain different from the public-source build.
4. Perform isolated GUI interaction and authenticated native service QA: create/edit pattern, direct Rust grading and history, 2D→3D view, save/restart/reopen, no lost personal data, and no candidate child-process or port leaks. A headless static UI smoke is not sufficient.
5. Source-only publication is compatible with omitting private CLO3D exports and machine paths, but any private-built installed app bundle containing those resources **must not be copied unchanged to GitHub**. Full release qualification also needs codesign/notarization status, clean-Mac install/rollback and independent garment/industrial approval where advertised.
6. Existing installation and user work remain untouched; no native candidate is installed or promoted by this report.

## Reproducibility and privacy controls

Source staging starts from a **specific Git commit**, includes only allowlisted application source and permitted fixtures, and refuses restricted media/personal paths. A full per-file SHA-256 ledger is available on Expansion. After transfer, verify archive SHA-256 and every manifest entry before building; do not infer bit-for-bit app reconstruction from checksum-valid installed bytes.

For an independent source-only inspection on a clean Mac:

```bash
python3 scripts/release/audit-exo-portable-expansion-source-20261114.py \
  --source "$EXO_SOURCE_STAGING/source-public-safe" \
  --manifest "$EXO_SOURCE_STAGING/evidence/source-snapshot-manifest.json" \
  --git-commit 1e4a9e3b51ee20244fd5e193aca5806f6579abee
```

The `$EXO_SOURCE_STAGING` variable points to a **new isolated source directory**, never the installed `.app` or original working repository. Use a source fence and source-local build outputs before attempting release packaging.
