# Cloth Craft Studio V2 — November 6, 2026 macOS release audit

**Status: NO APPROVED PUBLIC NOVEMBER 6 BINARY.** This document reports a local-only source/build verification investigation, not a release announcement. The newest published GitHub DMG is still the [November 1 Apple Silicon developer snapshot](https://github.com/mikristian/exo-sample-3d/releases/tag/v0.3.0-dev-20261101). The [October 24 beta](https://github.com/mikristian/exo-sample-3d/releases/tag/v0.3.0-beta.1) remains available as an earlier snapshot.

## Existing local candidate (not a public download)

A **November 6 local QA DMG** was built from the installed Studio V2 app, whose web assets were dated **November 2**. The initially staged app included an older Rust session that lacked `nativePropertyMetadataV1` and `nativeProjectGenerationV1`, preventing garment opening. The second isolated build substituted an existing locally compiled November 2 Rust session that supports both flags. This candidate is **not a complete build of all November 6 working-tree source changes** and was **never uploaded to GitHub**.

| Local artifact property | Verified observation |
| --- | --- |
| DMG file | `EXO-ClothCraft-Studio-V2-macOS-arm64-2026-11-06-LOCAL-QA-r3-ABI-MATCH-NOT-PUBLIC.dmg` |
| Exact bytes | 899965497 |
| SHA-256 | `f10c2bd02b57389f5a158dd0f8d9ce86c038447c242dc99486ac5366f98eef12` |
| Platform | Apple Silicon macOS / ad-hoc signature / **not notarized** |
| Internal app version | `0.3.0` |
| Rust backend capabilities | Native project generation/metadata yes; **desktop feature false, GPU simulation false** |
| Public GitHub availability | **Not uploaded; QA-only** |

## Test results (local isolated QA)

- The compressed DMG passed its recorded SHA-256 and `hdiutil verify` image checksum.
- Read-only mounting and `codesign --verify --deep --strict` on the contained application passed.
- Known personal saved-garment folders, private reference asset locations, developer home-path strings and restricted-name assets were absent from the staged bundle. This scoped scan is **not a complete third-party asset and license clearance**.
- Mounted Node and Rust services started on isolated localhost test ports. A T-shirt **opened with two pattern panels** and the same disposable workspace **saved successfully**.
- Authenticated browser UI smoke rendered **28 pattern edges**, one 3D canvas, and loaded its JS/CSS/WASM assets without observed missing-asset errors or uncaught JavaScript exceptions. The test used an ephemeral QA authorization token only on localhost; no credentials were included in the DMG.
- These tests do **not** establish the native Swift application's first-launch behavior on a different Mac, Apple Gatekeeper approval on a clean computer, GPU performance, realistic fabric fitting, or factory-ready export.

## Concrete blockers before uploading a new release

1. **Freeze and review exact source.** The developer working tree contains thousands of uncommitted changes, while the matching native Rust session source and several current UI/bridge changes are not published as one audited corresponding-source snapshot. Existing Rust source-pinning preflight is intentionally refusing the mismatch. The source and binary must be reconciled and archived from the same build identity.
2. **Feature parity.** The recovered compatible Rust executable reports **CPU-only**, whereas the older bundled executable reported GPU support but failed the new document ABI. A production-facing desktop package must be tested against an explicitly declared simulation feature set, not silently advertised as equivalent.
3. **Redistribution review.** Review the full set of bundled third-party software, fabrics, images, avatars, models, native runtime dependencies, license notices, and GPL corresponding source. Excluding known private content does not prove all redistribution rights are cleared.
4. **Independent installer validation.** Test the actual Swift GUI from the final DMG on a clean Apple Silicon Mac, including install, Open/Save/Quit/Reopen, 2D drafting and grading, Tech Pack view, supported export, and the system's normal unsigned-app Gatekeeper approval flow. Do not bypass Gatekeeper globally.
5. **Final release procedure.** Only after the above, create a new **unnotarized development prerelease** (if Developer ID/notarization remain unavailable), publish the matching source archive and full checksums, verify the downloaded GitHub asset, and update README download links.

The **real application UI screenshot gallery**, including a corrected full Tech Pack document screenshot, is publicly visible on the [main README](../README.md#explore-the-application). This visual/documentation update is separate from the DMG publication gate.
