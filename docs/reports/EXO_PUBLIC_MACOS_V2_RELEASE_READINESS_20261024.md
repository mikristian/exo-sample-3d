# EXO ClothCraft Studio V2 — Public macOS Release Readiness

**Audit date:** October 24, 2026. **Outcome:** staged local-only, ad-hoc-signed full Studio V2 DMG. **NOT approved for public release**. Update: a more conservatively filtered r3 candidate was produced and isolated-smoke tested later the same day.

## Requested outcome

User downloads `EXO ClothCraft Studio V2.dmg` from GitHub Releases, drags the same supported Studio V2 app to Applications and launches without Node, Rust or a development environment.

## What has actually been completed

- Verified the original user-installed `~/Applications/EXO ClothCraft Studio V2.app` was present, arm64 and version `0.3.0` (bundle version `0.1.0`). It was actively running and was **not altered, quit or overwritten**.
- Distinguished the `native_app/build.sh` **GarmentStudioNative preview** from the real `EXOClothCraft` Swift + Node + Rust full app. The existing GitHub candidate DMG workflow packages the **preview**, not the user's actual V2.
- Created new script `scripts/release/package-current-studio-v2-candidate.sh`, explicitly **local-test-only**. It stages a copy of the installed app, excludes known private avatar/research content from the copy, adds locally compiled first-party Rust static host/validators and necessary JS adapters, verifies resources and ad-hoc re-signs the copy. It does not touch the original app.
- Generated `release-artifacts/EXO-ClothCraft-Studio-V2-macOS-arm64-LOCAL-TEST-UNNOTARIZED-r2.dmg` plus matching `.sha256`. The output is intentionally **not** named as a public release and must remain private until all blockers below are closed.
- Independently verified the r2 DMG SHA-256, `hdiutil verify` disk-image checksum, read-only mount, bundle ID `com.mikristian.exo.clothcraft.workspace.v2`, ad-hoc code signature, embedded Node, Rust service, Rust static host, metadata/agent validators and offline V2 `index.html`.
- Launched the **r2 DMG's bundled** Rust static web host and Node API on independent loopback ports 5496/5497, with temporary isolated user data paths; confirmed HTTP 200 index, HTTP 200 `/health` and backend fields `nativeReady=true, rustCheckoutReady=true, ogcBackend=true, fitCertified=false`; excluded private Thomas avatar URL returned HTTP 404. The user's running application and ports 5385/5386 were untouched.
- Created and pushed GitHub branch `release/exo-v2-remove-private-avatar-20261024`, parented on the real public `main`, removing the **tracked private** `public/avatars/preview/clo-thomas.glb`. This action fixes one proven protected-file release gate, does **not** grant distribution rights over other files or retroactively purge Git history.

## Public release blockers — fail closed

1. **Beta installation expectation**: Only an `Apple Development` identity was visible through `security find-identity -v -p codesigning`; no verified Developer ID Application certificate or Apple notarization credentials. Developer ID/notarization are **not mandatory for a clearly labeled unnotarized beta**, but recipients may need to approve a trusted app manually in macOS Privacy & Security. No automatic removal of quarantine or deceptive Gatekeeper workarounds are acceptable. A seamless ordinary consumer install still requires signing/notarization.
2. **License/provenance**: The original installed app includes user/private CLO Thomas/other exported avatars, CLO hardware and private research files. The candidate removes **known** private assets and unreviewed data categories; this is not a complete legal review of all third-party fabrics, avatars, stage models, textures, trims, icons, embedded binaries and dependencies. Confirm licenses and verify the final immutable staged release before public upload.
3. **Installed-current vs source-current parity**: More than 1,500 local modified/untracked paths existed at audit, including new Rust/native/2D features. The r2 DMG packages the **current installed V2 binary and its bundled web assets**, plus missing local first-party Rust host/validator executables, not all not-yet-committed active development. A fully reproducible *latest source* public build remains necessary.
4. **Fresh Mac GUI proof**: Performed read-only mounted image + two isolated service smoke checks; **did not** replace the user's live app, fully launch and visually validate the GUI from a truly fresh separate Mac account/device, run grading persistence on clean system, exercise camera/privacy permissions, or verify Gatekeeper/notarization on a clean machine.
5. **Release hosting**: At audit `mikristian/exo-sample-3d` had **zero GitHub Releases** and failing October 21 public GitHub workflows, caused at least in part by tracked prohibited Thomas preview. The GitHub connector refused branch/PR actions with HTTP 403. The local Git remote credentials successfully pushed the separate safety branch, but no public release or artifact upload occurred.
6. **Disk/CI sustainability**: The primary Mac filesystem had roughly 3 GiB free when starting. A fresh multi-runtime source build/packaging may require much more working space; perform approved cleanup or build on a larger separate volume/CI runner.

## Release candidate provenance and conditions

The local DMG is **not a public release**, not an approved release-candidate to hand to external end-users, and not proven feature-for-feature equivalent to the current development source. Do not publish it to GitHub Releases or advertise compatibility until independent rights review, deterministic source build, genuine Developer ID signature and Apple notarization, clean-machine UI/save/reopen testing and published checksums are complete.

## Remaining execution checklist

- [ ] Review and merge public Thomas-asset removal under the repo's contribution process; separately handle already published Git object history only via deliberate maintainer policy.
- [ ] Create a _clean, version-pinned, minimal public runtime bundle_ from a Git revision that includes authorized current V2 source, Swift shell, required Node scripts, Rust binaries and verified licenses.
- [ ] Complete third-party source/asset redistribution matrix and ship only approved artwork, avatars, trims, fonts, textures, models and binary dependencies.
- [ ] Fix public GitHub CI so it builds from a deliberately filtered/allowlisted asset tree rather than passing the entire local `public/` directory to Vite, while **retaining or strengthening**, never disabling, restricted-content checks.
- [ ] If targeting seamless distribution, provision Developer ID Application signing and Apple notarization credentials through approved Apple Developer release controls. This is **optional** for the specifically disclosed unnotarized beta.
- [ ] Test the unnotarized GitHub download's quarantine/Gatekeeper approval flow on a separate Apple Silicon Mac with no development environment; if pursuing signed distribution, also verify signing, notarization, stapling and Gatekeeper assessment.
- [ ] Verify the exact downloaded GitHub Release DMG's SHA256 matches approved build, and demonstrate 2D edit, native grading, save/quit/reopen, relevant 3D render/runtime and clearly scoped export on the clean target.
- [ ] Publish approved release with actual `EXO ClothCraft Studio V2.dmg` filename and checksum, explicit supported macOS/architecture/version, known limitations, and public documentation.

## Relevant paths

Local private artifact: `release-artifacts/EXO-ClothCraft-Studio-V2-macOS-arm64-LOCAL-TEST-UNNOTARIZED-r2.dmg`

Updated, more conservatively filtered local artifact: `release-artifacts/EXO-ClothCraft-Studio-V2-macOS-arm64-LOCAL-TEST-UNNOTARIZED-r3.dmg` (185 MB). Excludes optional unreviewed fabric scans, CLO hardware, stage artwork, hardware thumbnails, hanger assets and hand-tracking model/WASM; includes the exact-version Node 24.13.1 license, EXO GPL text and MakeHuman CC0 notice. SHA256, disk image integrity, mounted bundle code signature, two-panel Rust T-shirt open/save to a disposable workspace, static V2 UI (60 edges and one canvas) and asset checks passed. This is **not** a clean Mac or source parity certificate.

Additional October 24 local release iteration: `release-artifacts/EXO-ClothCraft-Studio-V2-macOS-arm64-LOCAL-TEST-UNNOTARIZED-r5.dmg` (192,541,709 bytes). Mach-O debug paths containing the local developer's home folder were removed from staged first-party executables without touching the running installed app, and modified binaries were re-signed individually. An intermediate r4 build failed because signatures had been invalidated; r5 **passed** digest, staged bundle signatures, no personal home path scan, native Rust T-shirt Open/Save and isolated browser UI smoke. This is not a reproducible clean-source build.

**GitHub internal draft created (not publicly downloadable):** Release ID `423010397`, tag `v0.3.0-beta.1-internal-review`. The r5 DMG and matching `.sha256` assets were uploaded via authenticated GitHub API; GitHub reported a DMG digest of `sha256:728e4c464b8b15e225578885f993877215671c10cd35cfe26f59ecc0a78e6c1e`, matching the locally verified bytes. Draft remains `draft=true`; there is no public user download. A separate source-review archive is saved locally but is *not* verified as complete corresponding GPL source; an upload attempt was blocked and no source archive was uploaded. The full app's dependency/source correspondence, third-party notices, and clean-machine Swift GUI installation must still be proven before publication.

GitHub CI update: commit `ebd6118` fixed the missing public XPBD fixture alias and published the isolated current Studio V2 test helper; both public source CI and native preview macOS CI passed. The native preview CI **does not build the full user-installed V2**.

Local packaging script: `scripts/release/package-current-studio-v2-candidate.sh`

GitHub safety branch: `https://github.com/mikristian/exo-sample-3d/tree/release/exo-v2-remove-private-avatar-20261024`

Public GitHub repository: `https://github.com/mikristian/exo-sample-3d`
