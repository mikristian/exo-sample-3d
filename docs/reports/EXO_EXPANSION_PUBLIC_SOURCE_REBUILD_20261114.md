# EXO ClothCraft Studio V2 — portable source rebuild on Jarvis Expansion

**Date:** November 14, 2026. **Disposition:** reproducible-source checkpoint and partial native build **verified**; **not** a claim of byte-identical installed-app reconstruction, factory certification, or publicly qualified macOS installer.

## Source identity and storage

- Original public EXO base: [`mikristian/exo-sample-3d`](https://github.com/mikristian/exo-sample-3d), commit `1e4a9e3b51ee20244fd5e193aca5806f6579abee` at the time of the source freeze.
- **Current reviewed public `main` as of the privacy follow-up:** `16a219d31ffb09bfa168d6f0637540ea00543f6c`. `git diff` confirms **zero changes** to the EXO engineering runtime source (`src`, the ClothCraft integration, native Rust/C++/Swift, package lock and Vite config) between the frozen archive commit and this GitHub revision. Subsequent changes were privacy-safe documentation, source staging scripts and removal of restricted legacy binaries; the original immutable archive SHA remains valid.
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
| React/Vite | Extracted SHA-verified media-reduced source, then independently repeated from a fresh directory using `npm ci --ignore-scripts --no-audit --no-fund` with Node v24.13.1, npm 11.8.0 and the checked-in lockfile | **Fresh npm install passed; 2,735 modules transformed; production build passed** |
| Browser smoke | Isolated HTTP static server plus headless Chrome against newly compiled public-source frontend | **HTTP 200, populated React UI, no page-script errors and no HTTP 5xx responses** |
| Fresh dependency verification | Fresh lockfile source and separate `npm ci` and Vite logs saved with SHA-256 readback under `evidence/web-lockfile-rebuild/` on Jarvis Expansion | **PASS**. Clean JS output SHA-256 `edb57f05fdfeb3938df81927ab16c4781c6c5fd052f897c1e08f1913856996a4` |
| Native Swift launcher | Compiled first-party EXO V2 Swift source with `-D EXO_V2_STAGED -parse-as-library -O -target arm64-apple-macos13.0` | **Compiled Apple Silicon executable**; SHA-256 `58f937762d8db37768630617523ec6b2a60ea613bc2cae9e633ed1b1edc4746e`; independently read back from physical Expansion |
| Rust `exo-session` Apple Silicon | Rust/Cargo 1.99.1 compiled the **desktop-enabled arm64** EXO/ClothCraft session on Jarvis Expansion from pinned source; the binary was copied to the Apple Silicon Mac, independently SHA-256 verified and executed with `--exo-capabilities` and a read-only JSON `open` request using a permitted neutral MakeHuman mannequin | **PASS.** `desktopFeature:true`, `gpuSimulation:true`, `nativeProjectGenerationV1:true`, `nativePropertyMetadataV1:true`; session opened a fresh T-shirt fixture at revision 0 without writing any personal project. Binary SHA-256 `17d4024ac1d3ca5d97ee83babf5b5f2727853150ccc6691c1f44b7b1db1fff81`. GPU capability flag is not calibrated physics fit proof. |
| Native C++ 2D drafting | Pinned source cross-built on Jarvis with Apple clang; executed x86_64 fixture there and arm64 fixture on Apple Silicon Mac | **Both tests passed**, arm64 output SHA-256 `f047400e7e1233ab7b1e9642774a83d1ea575575ddb37f02f562142ff52a9ab2` |

The public-source archive contains **source files and build metadata**, not the running private `.app` bundle or a generated signed public `.dmg`. Compiler outputs are held separately in `builds/` on the physical Expansion volume and are not included in the publicly distributable source snapshot. Apple Silicon native-session runtime proof (without private file paths, project contents or personal media) and its SHA-256 check are stored at `evidence/exo-arm64-rust-session-evidence-20261114.json`.

## Required release and installed-app parity gates

1. A complete new native V2 `.app` must be assembled in isolated staging mode with `EXO_PUBLIC_DISTRIBUTION=1` and `EXO_INCLUDE_PERSONAL_AVATARS=0` (and a separate staging support directory). Never use the default personal-build flags or overwrite the running production app.
2. The source-pinned arm64 EXO Rust `exo-session` binary now compiles and opens a fresh fixture; complete the **remaining** Rust services, production C++ CAD CLI, Rust WASM kernels, Node service closure, and dependency/licensing notices. A source-matched installer requires **all** components, not simply Swift and React compilation.
3. Recreate the active WebKit asset and native service hashes or classify the result as a *new public build*. The installed V2 application's active JavaScript and some compiled runtime resources remain different from the public-source build.
4. Perform isolated GUI interaction and authenticated native service QA: create/edit pattern, direct Rust grading and history, 2D→3D view, save/restart/reopen, no lost personal data, and no candidate child-process or port leaks. A headless static UI smoke is not sufficient.
5. Source-only publication is compatible with omitting private CLO3D exports and machine paths, but any private-built installed app bundle containing those resources **must not be copied unchanged to GitHub**. Full release qualification also needs codesign/notarization status, clean-Mac install/rollback and independent garment/industrial approval where advertised.
6. Existing installation and user work remain untouched; no native candidate is installed or promoted by this report.

## Current public GitHub branch privacy cleanup

The source-only audit work was published to `main` (first at `c633aee760bbffa71e06bd9161cdb773f5c11867`, then the privacy normalization at `16a219d31ffb09bfa168d6f0637540ea00543f6c`). Three unnecessary CLO project/inspector binaries were removed from the **current branch tree**, with conservative `.gitignore` patterns added. The remaining 36 previously tracked documentation/research files containing absolute macOS personal home paths were normalized to portable placeholders; a repository-wide text search of the resulting Git tree found **zero** `/Users/<local>/` matches. The private local working tree and active EXO installation were not modified by those Git-tree changes. Older Git commits retain their historical objects until a separately reviewed history-rewrite policy is considered; this report makes no claim of Git history erasure.

## Repeating the physical Expansion source export

The new source-only tool, `scripts/release/stage-exo-public-source-on-jarvis-expansion-20261114.sh`, stages allowlisted Git source through a configured SSH host alias, resolves the actual remote `main` when no immutable commit argument was provided, sanitizes machine-specific paths, omits optional media, hashes every member and seals a new archive on the physical Expansion drive. It never writes an existing staging folder or live application. Syntax and its dry-run/SSH argument handling were checked; the documented 4,991-file checkpoint above was staged and verified using the equivalent individual commands, **not by rerunning the combined script**.

```bash
bash scripts/release/stage-exo-public-source-on-jarvis-expansion-20261114.sh --dry-run
# After validating your configured Jarvis SSH alias and external volume:
bash scripts/release/stage-exo-public-source-on-jarvis-expansion-20261114.sh
```

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
