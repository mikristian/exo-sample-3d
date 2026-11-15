# EXO ClothCraft Studio V2 — source-built public-mode macOS candidate

**QA date:** November 14, 2026 (U.S. Eastern). **Disposition:** an independently source-built, ad-hoc-signed **engineering candidate** was assembled, launched, saved a staging document, shut down safely, archived to Jarvis's physical Expansion drive, restored and launched again without the development source directory. **Not yet a distributable, notarized, source-identical reproduction of the installed personal EXO app.** No private CLO3D assets or user projects are included in this release candidate.

## Source identity and independent storage

- Public repository: <https://github.com/mikristian/exo-sample-3d>.
- Immutable runtime-source input: Git `1e4a9e3b51ee20244fd5e193aca5806f6579abee`. The public runtime code paths (`src`, integration, Rust, C++, Swift, `package-lock.json`, Vite config) did not change between this frozen runtime input and the preceding reviewed GitHub revision `97c88dfe48cbb7d8db27609e01a7f8ed4b35f2eb`. No live, dirty development source was copied into the release candidate.
- Public ClothCraft upstream: <https://github.com/erythrofr/ClothCraft>. The pinned EXO changes are corresponding-source modifications, **not** an assertion they are merged upstream.
- Source snapshot SHA-256: `43a47a6ec13e7c6509e3690e4a7e27885ce38df3326bda9dc2d3bdde0eccd9a5`. Its **4,991 files** individually match `portable-source-manifest-20261114.json`; 291 optional media files omitted. The neutral MakeHuman reference fixture and license are permitted build inputs.
- Physical Jarvis Expansion folder, relative to mounted `/Volumes/Expansion`: `EXO-Engineering/SourceRebuilds/EXO-V2-20261114-main-1e4a9e3b/`. The drive had approximately 2 TiB available. Compilation and archival were on the real physical Expansion drive, not on the no-execute WebDAV alias or the separate camera/SD card.
- Signed engineering candidate retained **internally**, not on GitHub: `builds/private-release-candidates/EXO-V2-source-built-staging-candidate-20261114.app.tar.gz`. Independently streamed back and SHA-256 verified:
  `6ed1a0d26cb5e73cbdddc0cc049ef33d5599ee4bdb7d398cc9abf1924bf7a452`.
- Internal QA evidence and a member-level audit are in `evidence/candidate-qa/`. The private archive has **not** been released as a downloadable installer.

## What was actually built

| Part | Verified result |
|---|---|
| Rust main EXO session | Locked Cargo build from pinned source on Jarvis Expansion, target `aarch64-apple-darwin`; binary SHA-256 `17d4024ac1d3ca5d97ee83babf5b5f2727853150ccc6691c1f44b7b1db1fff81`. It runs on Apple Silicon, reports native desktop capabilities, and opens a fresh T-shirt RPC fixture. |
| Native GPU physics step | Existing `qa-exo-v2-desktop-gpu-binary.mjs` executed the source-built arm64 Rust session on Apple Silicon; **2 editable panels, 4,570 triangles, one GPU physics step succeeded**. This is not calibrated physical fabric-fit validation. |
| ClothCraft utilities | Native arm64 `cloth-template` (`6b20f668...`) and `cloth-fit` (`29267d0c...`) built from pinned source, independently transferred/hash-matched and their CLI entrypoints executed successfully on Apple Silicon. |
| EXO Rust services | All three arm64 executables compiled from locked source on Expansion: metadata validator `4f2c724b...`, agent validator `e608688a...`, Rust static host `db732724...`. **7 Rust tests passed** across the three crates; positive/negative validator and host checks performed. |
| Production C++ CAD CLI | Configured with CMake 4.1.2 staged separately on Expansion and Apple CLT SDK LibXml2/CURL paths. Entire `garment_cad_cli` arm64 build **passed**, SHA-256 `bedbb88b8ac16ea79adbe347c8aa7a676ee2d0c33657a33017f0a3914a965067`; CLI `--help` ran on Apple Silicon, exit 0. No factory/export certification is implied. |
| macOS AppKit launcher | First-party EXO V2 Swift source compiled arm64 with `EXO_V2_STAGED`. New bundle has independent `com.mikristian.exo.clothcraft.workspace.v2.public-candidate` identity and `EXO-ClothCraft-Studio-V2-Staging-Public20261114` support namespace; ad-hoc signature passes `codesign --verify --deep --strict`. |
| Web/Node | **Fresh `npm ci` from checked-in lockfile** (using a separate temporary npm cache) then Vite build **2,735 modules transformed** with staged bridge URL `127.0.0.1:5485`. Standalone Node import closure staged **71 first-party modules and 8 locked runtime npm packages**. |
| WebAssembly | **59 WASM files** present and validated by signed runtime manifest. Five principal Rust WASM crates recompiled on Expansion and **38 crate tests passed**; four binaries byte-match the published artifacts, while the geometry kernel differs by 148 bytes. The remaining **54 of 59 are not independently rebuilt** in this audit. |
| Signed runtime provenance | `exo.desktop.runtime-provenance.v3`: **278 resource members** hash-checked independently, identity `67be49c461b9a01f7fabb1640aa0d8deff58117abf916a80d149718541d26e69`. Native outer launcher verified separately by Apple codesign. |

## Real macOS app and service acceptance

1. A genuine **separate AppKit/WKWebView window** launched. The UI displayed the EXO patternmaking workspaces, native T-shirt front/back panels and the Rust-session-ready indication. The actual window screenshot is [EXO public candidate UI QA](EXO_PUBLIC_CANDIDATE_UI_QA_20261114.png). This is a screenshot of the newly source-built candidate, not a substitute for CAD functionality tests.
2. Candidate Rust static host on `127.0.0.1:5486` returned HTTP **200**; candidate Node bridge on `127.0.0.1:5485` reported `ok:true`, `nativeReady:true`, and independently verified runtime provenance identity matching the signed bundle. The installed personal EXO continued separately on ports **5385/5386**.
3. Unauthenticated workspace POST returned HTTP **401**. Authenticated **read-only native snapshot** returned HTTP **200**, two editable T-shirt pattern panels and **4,570 triangles**.
4. An authenticated **Save** request returned HTTP **200** and wrote a garment document only inside the candidate's dedicated staging support folder. The candidate was terminated by targeting its exact AppKit PID; staging child processes exited and ports 5485/5486 cleared. The production EXO process and projects were never stopped or overwritten.
5. Cold relaunch initially returned a transient HTTP **422 Workspace busy** while restoring. Once ready, authenticated snapshot returned HTTP **200**, two panels/4,570 triangles. The reloaded revision was 0, and the saved file's byte hash changed during startup; **a distinct authored edit surviving restart, persisted Undo/Redo, and exact document round-trip equivalence are NOT yet established**. This remains a specific release gate, not an unqualified save/reopen pass.
6. The **107 MB compressed backup** was streamed from physical Expansion and every signing/runtime check repeated on the extracted app. To test self-containment, the original temporary development-source folder was temporarily moved away. The extracted app still launched an actual AppKit process, started the native Node bridge with the expected signed provenance and returned HTTP **200** from the static host. The developer source folder was restored afterward; the extracted test app was terminated and its disposable test copy removed, with staging ports cleared.
7. The original installed EXO ClothCraft Studio V2 remained running throughout. No update, replacement, restart or new live-production data migration was performed.

## Public-source safety audit

The standalone **read-only** verifier is `scripts/release/verify-exo-v2-public-candidate-20261114.py`. Its machine-readable result is [EXO candidate audit JSON](EXO_PUBLIC_CANDIDATE_AUDIT_20261114.json). It passed with **9 native executables**, **59 WASM files**, **278 runtime hashes**, a verified ad-hoc macOS signature, and **zero CLO3D project/model assets** and **zero absolute paths referring to the owner's home directory** in this signed candidate.

The audit deliberately also found **five source-built Rust executables containing generic build-machine `/Volumes/Expansion/...` paths** from Cargo dependency panic/source-location strings. Stripping symbol tables did not remove them. The third-party Node executable has one generic `/Users/` string not referring to the owner's home. **Do not market this candidate as fully path-scrubbed or redistribute unchanged** until code generation remaps such paths and license/notice verification is complete.

Other conditions remaining before an official public installer:

- Apple Developer distribution signature, notarization, *independent clean-Mac* install and rollback test; ad-hoc signing is an engineering check only.
- Pin/rebuild and license-review the remaining 54 WASM files, determine reason for the geometry-kernel hash mismatch, and audit third-party Node/native dependency license notices and full transitive corresponding source.
- End-to-end authored 2D edit → graded size → native Rust → 3D physics → save/reopen → persisted undo/redo under a controlled new staging project, including lifecycle and concurrent-request robustness.
- Verify physical calibration/industrial export reception and sample garment fit separately. UI appearance and compilation do not imply manufacturer-ready output, nor long-running GPU/CPU physics parity.
- Bit-exact parity with the older installed privately built EXO application is still **not proven**; this is a **new public-mode source-built candidate**, not that installed binary.
- The previously reviewed EXO source snapshot and historical installed source differ for some packaged outputs; see [installed runtime parity](EXO_V2_INSTALLED_RUNTIME_SOURCE_PARITY_20261114.md).

## Safe verification on a candidate copy

```bash
python3 scripts/release/verify-exo-v2-public-candidate-20261114.py \
  --app /absolute/path/to/new-staging-candidate.app \
  --out /path/outside/the/app/candidate-audit.json
```

The verifier explicitly **rejects installed application locations**, checks only the supplied candidate and writes no files inside it. Never point build/verification scripts at the running personal application. The candidate `.app` backup is on the physical Expansion drive and is **not** a published GitHub release asset.

**Outcome:** A separately built and independently backed-up EXO Studio V2 **macOS application does work** from reviewed public source without private CLO3D media or personal data paths. GitHub contains source and verification tools; public downloadable installer qualification remains open and is explicitly not claimed.
