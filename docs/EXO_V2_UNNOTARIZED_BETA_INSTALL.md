# EXO ClothCraft Studio V2 — unnotarized macOS beta

**Release status (October 24, 2026): NOT YET PUBLISHED.** The installed full
Studio V2 has a local DMG test candidate, but there is **no approved GitHub
Releases download yet**. Do not treat the source ZIP or the older
`GarmentStudioNative` preview as the full Studio V2 installer.

When a beta release is approved, its download will appear at:
https://github.com/mikristian/exo-sample-3d/releases

## Installation after a verified DMG is published

1. Download the explicitly labeled **unnotarized Apple Silicon macOS beta**
   `EXO ClothCraft Studio V2.dmg` and the matching SHA256 checksum from
   GitHub Releases. Do not download files from unofficial mirrors.
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
- The current local DMG has passed SHA256, signature, Node/Rust backend,
  sample garment Open/Save and isolated browser UI smoke tests. It has
  **not** passed independent fresh-Mac GUI installation/launch or final
  full-source/license provenance review.
- An unnotarized beta is possible without an Apple Developer Program
  membership; this does **not** remove macOS Gatekeeper warnings.

## Maintainer release checklist

Do **not** upload the local `LOCAL-TEST-UNNOTARIZED` artifacts as a
public GitHub release just by renaming them. Before publishing:

1. Confirm matching GPL-covered source and required corresponding source,
   source revisions, dependency/asset licenses and notices are available.
2. Verify the final staged binary tree contains no private or third-party
   restricted files, credentials, project data or absolute user paths.
3. Run the isolated full EXO V2 candidate test:
   `bash scripts/release/qa-current-studio-v2-mounted-beta.sh`.
4. Exercise the **real EXOClothCraft Swift GUI** on a clean macOS Apple
   Silicon account/device without developer tools, including Open, Save,
   Quit, Reopen and one supported export.
5. Create an immutable release tag, publish the approved DMG and checksum
   as a **GitHub prerelease**, and independently redownload/verify.

Release gate details:
`docs/reports/EXO_PUBLIC_MACOS_V2_RELEASE_READINESS_20261024.md`.
