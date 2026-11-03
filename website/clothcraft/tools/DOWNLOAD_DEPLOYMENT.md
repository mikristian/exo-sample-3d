# ClothCraft Desktop Preview Downloads — Distribution & QA

**Status, 2026-10-22:** Working on the local ClothCraft website at `/download/` and `/downloads/`; **not published on the official GitHub Releases page or a public site**.

## Upstream provenance and immutable inputs

Canonical repository: https://github.com/erythrofr/ClothCraft (original project source: MIT license). The development archives were downloaded using authorized GitHub Actions artifact access from the successful workflow run https://github.com/erythrofr/ClothCraft/actions/runs/39828874228 (source SHA prefix `991b4754e3`). They were copied to `tools/release-input/` and their exact SHA-256s pinned in `tools/package-development-downloads.py`.

- `clothcraft-macos-arm64` artifact `12448985287`: source ZIP SHA256 `5a2f64eba6224be728a86f28ee23c6455929f8813af47ba797f222b9bfc11301`.
- `clothcraft-windows-x86_64` artifact `12447154334`: source ZIP SHA256 `b37740b7c028c4a928effb60750bf2aa0d63e4789f19ca4ce43838560bbf1dd3`.

**Both original ZIP files passed full `unzip -t` CRC verification**, and their executable architectures were inspected using `file` (Mach-O arm64 / PE32+ Windows x64). The MakeHuman avatar, templates, LICENSE and asset license notices were preserved in both.

## Packaged preview outputs

Run:

```bash
python3 website/clothcraft/tools/package-development-downloads.py
```

Outputs:

- `downloads/ClothCraft-macOS-AppleSilicon-Preview.dmg` — 18.6 million bytes. Contains a `ClothCraft.app` you can drag into `/Applications`, launch from Finder, and view the native Rust editor. Ad-hoc signed (for bundle structure integrity only), **NOT signed with a Developer ID, NOT notarized, and NOT independently certified safe**. Apple may show a Gatekeeper warning.
- `downloads/ClothCraft-Windows-x64-Portable-Preview.zip` — 19.1 million bytes. Extract and double-click `ClothCraft/Start ClothCraft.cmd`. This launcher preserves the working directory so the bundled editor can find avatar/material and template files. NOT signed and may trigger SmartScreen. It is a portable package, not an MSI installer.
- `downloads/manifest.json` — contains actual paths, source artifact IDs, sizes, and SHA256 checksums, and declares `signed_release=false`/`notarized=false`.
- `downloads/SHA256SUMS.txt` — checksum file for manual verification.

### Native smoke evidence

The Mac disk image was mounted read-only and verified; `plutil` correctly read the bundle's `Info.plist`, `codesign --verify --deep` succeeded **for the ad-hoc signature**, and `cloth-fit --help` ran from the packaged disk image. The exact CI `cloth-fit` binary also passed `--steps 0 --view --ui-smoke`, creating a 3024×1834 real UI screenshot. That screenshot is published on the Download page at `assets/clothcraft-native-macos-preview.webp`, clearly labeled as the actual Mac build. The GUI was **not tested on Windows**, and no Intel Mac build is included.

### Files served by local preview server

`serve.mjs` supports `HEAD`, byte-range requests, correct `Content-Type` and `Content-Disposition: attachment` for ZIP/DMG. Private `tools/` and `qa/` paths are excluded from HTTP access. `download.js` verifies the same-origin manifest structure and checks exact content-length via `HEAD` before enabling buttons, then fetches official Releases. If a later official release is found, it takes priority over the hosted experimental package. The local verified preview appears immediately; users do not need to wait for GitHub API availability.

For public deployment, provision a public HTTPS origin and ensure these binary files are served from an approved artifact host with adequate bandwidth, file integrity controls and immutable URLs. The current `127.0.0.1:8100` preview **works only on the connected Mac**, not on someone else's computer or phone. Preserve exact checksums and do not rebrand a local preview as an official vetted release. Public distribution should be coordinated with the ClothCraft maintainers and confirmed for all third-party assets/licenses.

## Local regression tests

```bash
node website/clothcraft/qa/download.mjs
node website/clothcraft/qa/github-links.mjs
node website/clothcraft/qa/multipage.mjs
node --test website/clothcraft/commerce/index.test.mjs
```

These tests cover verified direct files, browser download events, Mac and Windows filename matching, official GitHub release fallback, tamper prevention (untrusted release URLs rejected), unavailable repo/manifest states, desktop/mobile widths and key page navigation. An automated UI smoke is not equivalent to full installer acceptance testing, Windows runtime validation, or security review.
