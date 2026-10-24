# EXO ClothCraft Studio V2 — unnotarized macOS beta

**Release status (October 24, 2026): PUBLIC BETA.** EXO ClothCraft Studio V2
v0.3.0-beta.1 is publicly downloadable at:
https://github.com/mikristian/exo-sample-3d/releases/tag/v0.3.0-beta.1
This is the full native Studio V2 DMG, not the older
`GarmentStudioNative` preview.

DMG SHA-256:
`103dc1bbfd91a483b4d36638b34d4785c0dd1a733223456fe688576c0dc2c86d`

Source archive SHA-256:
`dadd84f7a5104137e99d29db457e4870e77b8150f965afbda0a25d18a998ba00`

## Installing the published beta

1. Download the **unnotarized Apple Silicon macOS beta** DMG from the
   GitHub release above. The source archive is available on the same page.
   Do not download from unofficial mirrors.
2. Verify the DMG checksum against the checksum published in the release.
3. Open the DMG and drag `EXO ClothCraft Studio V2.app` into Applications.
   Node.js, Rust, npm, Xcode and a development environment are **not**
   supposed to be required for supported features.
4. Try opening EXO. Because this beta is **not Developer ID notarized**,
   macOS may block the initial launch. If you independently trust the
   developer and the downloaded file, go to **System Settings → Privacy &
   Security → Open Anyway**, and confirm the app. Do **not** globally
   disable Gatekeeper, run a blanket `xattr -dr com.apple.quarantine`
   command or give EXO administrator privileges.
5. Create a non-sensitive test garment first, verify Save, Quit and Reopen,
   then work on important garments. Keep backups of original patterns.

## Supported limits and disclosure

- macOS 13 or later on Apple Silicon (`arm64`) is the current candidate
  target; Intel Mac/Windows/Linux binaries are **not** covered.
- Garment physics are experimental. A successful app launch, simulation or
  export is **not** verified industrial fit or factory readiness.
- The conservative public beta candidate omits assets without verified
  redistribution rights (private CLO avatars and trims, fabric scans,
  stage artwork and optional hand-tracking model). Missing thumbnails or
  reduced optional features are intentional until licensing is cleared.
- The published source-built r8 DMG passed SHA256, code-signature validation,
  bundled Node/Rust backend, T-shirt Open/Save and isolated browser UI smoke
  tests. It has **not** passed independent fresh-Mac Swift GUI/first-launch
  Gatekeeper testing.
- A source snapshot with first-party GPL code, modified MIT ClothCraft fork,
  native/Swift code, Rust/WASM source, build scripts and dependency inventories
  is attached. Byte-for-byte reproducibility of all preexisting native C++
  dependencies and full third-party legal-notice coverage have not been
  independently certified.
- An unnotarized beta is possible without an Apple Developer Program
  membership; this does **not** remove macOS Gatekeeper warnings.

## Maintainer follow-up checklist

The beta is published, but broader release approval still requires:

1. Confirm matching GPL-covered source and required corresponding source,
   source revisions, dependency/asset licenses and notices are available.
2. Verify the final staged binary tree contains no private or third-party
   restricted files, credentials, project data or absolute user paths.
3. Run the isolated full EXO V2 candidate test:
   `bash scripts/release/qa-current-studio-v2-mounted-beta.sh`.
4. Exercise the **real EXOClothCraft Swift GUI** on a clean macOS Apple
   Silicon account/device without developer tools, including Open, Save,
   Quit, Reopen and one supported export.
5. Rebuild from a clean source checkout, improve third-party notice coverage,
   and independently verify a fresh public download before a stable release.

Release gate details:
`docs/reports/EXO_PUBLIC_MACOS_V2_RELEASE_READINESS_20261024.md`.
