# EXO ClothCraft V2 — REA-assisted CLO3D reverse-engineering audit

**Date:** 2026-10-19. **Status:** initial deep source/architecture audit plus targeted runnable tests, with a repeatable REA evidence baseline. Not a parity certificate, completed product, installed release, or a claim that commercial algorithms have been recovered.

## 1. Saved reference and reproducibility

| Item | Verified value |
| --- | --- |
| Official source | https://github.com/morluto/rea |
| Local shallow sparse checkout | `research/oss/rea/` (ignored by EXO Git via `.gitignore`) |
| Pinned commit | `833136507dd79d959340b09862a53af344e4f1b3` |
| License | MIT for REA-authored code; third-party licenses remain separate (see `LICENSE` and `THIRD_PARTY_NOTICES.md`) |
| Locally executed CLI | `rea-agents@6.7.0` via project-independent npm exec; Node `v24.13.1` |
| Local target | `/Applications/CLO_Standalone_OnlineAuth.app` |
| Target version / bundle ID | `7.0.242` / `com.clo3d.security.closo` |
| Target CPU family | main Mach-O: `x86_64` |
| First-party native references | 51 declared library dependencies in primary Mach-O, including `libCloMathSimulate.dylib`, `libCloScene.1.0.0.dylib`, `QtWidgets.framework`, `QtGui.framework`, `QtOpenGL.framework`, `libCLOAPIInterface.dylib`, `libVRaySDKLibrary.dylib` |

The local checkout includes REA's `src/`, `docs/`, `scripts/`, `bridge/` and `.agents/skills/` trees. It remains a separately versioned nested Git repository, intentionally excluded from EXO's primary Git index by the existing `research/oss/` ignore rule. The checked-out research source occupies about 45 MiB.

**Evidence retained:**

- `docs/engineering/rea-clo7-static-plist-20261019.json`: REA `inspect-plist`, original target identity, extension associations `zpac` and `zprj`, source hash and tool provenance.
- `docs/engineering/rea-clo7-static-macho-20261019.json.gz`: losslessly compressed REA `inspect-macho` Evidence, main executable, dependencies, architectures, and limitations. Restore with `gunzip -c`, without changing the application.
- `docs/engineering/rea-2d-cad-audit-20261019.md`: exact current-source 2D controls and physical pattern design limits.
- `docs/engineering/rea-native-3d-audit-20261019.md`: native session, scene, physics, persistence, export and fitting gaps.
- `docs/engineering/rea-provider-readiness-20261019.json`: observed REA tool availability on this Mac, generated from the actual `rea providers` CLI.

REA is an **investigation framework**, not an open-source CLO3D CAD editor or a garment simulator. Its value here is to collect provenance-tagged app observations, map actual implementation boundaries, inspect the native target, and test our EXO reproduction against observed user behavior. The Mach-O dependency names do **not** prove a particular algorithm or make proprietary algorithms usable by EXO.

**Current provider readiness:** REA's native macOS static inspection tools are operational. Ghidra has no configured installation/Java runtime, Hopper's launcher is absent, IDA's MCP bridge is not configured, and Kuna is not configured. Accordingly, this first pass examines available metadata and linkage; **no function-level decompilation is claimed**. REA's SQLite lane also reports a stricter Node requirement than the present `v24.13.1`.

## 2. Reconstructed architecture and authority

```text
Observed CLO 7.0.242
  Qt interface + native Mach-O x86_64
  - CloScene, CloMathSimulate, CLO API, OpenGL, V-Ray and format libraries
  - individual behavior and call graphs not yet confirmed

EXO ClothCraft V2
  UI: React/SVG (ClothCraftBoardV2) + tool palettes/inspectors
    ↓ versioned operation / staged Shape
  Native bridge: integrations/clothcraft/workspace.mjs
    ↓ JSON RPC with expected native revision
  Rust exo-session / garment polygon + seams + physical mesh
    ↓ snapshot.positions / uv / triangles / boundaries
  Three.js ClothCraftSceneV2 live cloth/avatar renderer
    ↓
  Native JSON saves + separate browser IndexedDB project library
```

**Contract:** Rust material metres, physical contour, saved sewing and compiled mesh must be authoritative. 2D SVG guides and previews have separate presentational authority until a Shape transaction succeeds. Repeated measurements should identify their source revision and flat/sewn basis.

## 3. Whole-project feature and gap register

The status column distinguishes an implementation path from factory-ready parity.

| Priority | Subsystem | Confirmed present / evidence | Main remaining acceptance gap |
| --- | --- | --- | --- |
| **P0** | 2D selection and tool dispatch | SVG edge/station hit targets and separate tool selection in `ClothCraftBoardV2.jsx`; real screenshot/QA assets exist | End-to-end clicking, dragging, cancel and switching between panels at all supported zoom levels. `elementFromPoint` must select intended control despite overlays. |
| **P0** | Physical spline editing | `nativeFreeCurvePoints.js`, free knots, cubic tangents, symmetry, side guide stations, Rust Shape | Assert 2D paper fill, compiled 2D Rust boundary, and 3D surface match **before vs after explicit Apply**. Test reverse/crossing curves and undo/redo. |
| **P0** | Named sewing and edge correspondence | Native seam references, revision-guarded edit, ease when changing sewn side length | Seam IDs, reverse/ease/length residual and stitch pairing survive add/split/drag, reopen and garment simulation. No unannounced seam stretching. |
| **P0** | Dart/pleat construction | Red construction guides rendered in `ClothCraftBoardV2.jsx` (currently `data-dart-physical=false`) | Physically authored dart apex, intake and legs, fold topology, closure and 3D drape; graded/sewn/exported geometry must agree. |
| **P0** | Cloth fit and solver stability | Persistent Rust solver and 3D snapshots via `integrations/clothcraft/workspace.mjs` | Quantify penetration, seam gap, self-collision and 40/200/1000-step behavior. The recorded experimental GPU/CPU seam-gap discrepancy is a blocking parity issue. |
| **P0** | Whole garment workflow | T-shirt native preset; existing simplified hoodie/trouser/jacket fixtures | Complete physical tee, hoodie, trousers and multi-piece garment: draft → sew → drape → edit → save → reopen → export, with deterministic metrics. |
| **P1** | 2D guides, measurements and POM | Named construction guides, 14 current outline labels, saved POM paths, analytic guide clipping | Persist guide provenance as revisioned native references; accurate seam-path/circumference/POM types, size tables, allowances and tolerance-controlled centimetres. |
| **P1** | Production cutlines/notches | Allowance display, point IDs, cutline and SVG/DXF paths | True industrial stitch/cut allowance offsets, corners, accurate notches, grainlines, drill points, calibration and independent AAMA/ASTM/DXF acceptance. |
| **P1** | Grading | Numeric Rust grade operations, basic single-size UI | Multiple sizes, grade-rule sets, grading at independent material anchors, preserved seam IDs, POM/size charts and complete collection export. |
| **P1** | Tools and inspector UX | `RightToolPalette`, `CloPropertyEditorAccordion`, contextual controls, tool modes | Audit each visible action for real command, precise parameter input, undo/redo, native persistence, error state and keyboard accessibility; do not infer completeness from tool names. |
| **P1** | 3D avatar and arrangement | MakeHuman collider and Three.js avatar placement | Measurement-driven avatars, grading across body types, poses, preserved arrangement and contact behavior; verify what is reset when swapping avatar. |
| **P1** | Fabric physics and material view | Native fabrics, appearance properties and Three.js PBR scene | Physical bending/stretch mapping, calibrated appearance, front/back optics, texture scale, saved render/solver frame equivalence. |
| **P1** | Interchange | Existing native export paths and tech pack scaffolding | Independent reader opens DXF, OBJ, GLB and manufacturing spec with preserved real units, orientation, UV, seams, materials and grading; round-trip metrics verified. |
| **P1** | Workspace durability | Native JSON atomic rename, native backups and browser IndexedDB versions | Prove consistent revisions across library/native bridge, conflict recovery, corrupted saves, migrations and cold restart. |
| **P2** | Full UI workspace parity | Split/2D-only/3D/render navigation, themes, settings, libraries, inspections | Consistent interaction diagrams, selection persistence, actual action feedback, empty/error screens, visual QA at expected macOS displays. |
| **P2** | Automated full regression | Many targeted tests and disposable native fixtures already exist | One small, repeatable evidence bundle per user scenario: action log, revision, SVG screen sample, mesh geometry, seam measurements, saved artifact, 3D screenshot. |

**Existing targeted verification on 2026-10-19:**

1. `node --test src/core/nativeFreeCurvePoints.test.mjs src/core/patternGuideTracks.test.mjs src/core/patternCurveDrafting.20261019.test.mjs src/core/patternSewingGuideSampling.test.mjs src/core/patternVisualTokens.test.mjs` → **28/28 passed**.
2. `node integrations/clothcraft/qa-v2-actual-side-contour-20261019.mjs` → **4/4 passed** against a disposable Rust project; compiled front/back side-left/right physical contours changed about 20–23.69 mm, authored curve versus mesh boundary discrepancy about 0.14 mm, and save/reopen persisted each result.
3. **Live, read-only browser QA (current source):** `node integrations/clothcraft/qa-v2-side-stations-measurements-20261019.mjs` was run against temporary Vite `5284` with native bridge `5385`. The originally straight-line-only guide assertion was updated to inspect the current curved SVG polyline endpoints. The run still **fails at the physical station pointer-hit assertion**, before any native edit: at 1740×1060 the center landed on the inspector's `Information` `SPAN`; at 2200×1200 it landed on an `Item No.` `LABEL`. Both have `pointerEvents:auto`. The QA's intercept layer denies native mutation requests; these results show a screen-space obstruction or camera/layout/QA-coordinates mismatch, **not** proof of a bad Rust spline. Verify station SVG transform, viewport clipping, scroll/pan and inspector stacking together. Do not claim the full front/back browser test passed.
4. These do **not** close the live UI pointer-interception issue, long-running sewn-body fit qualification, factory-grade cutline correctness, or 3D GPU parity.

**Known source-level physical-UI distinctions:** a side station is a calculated position along an existing edge until the free knot is actually added; a yellow path is a proposed geometry until committed; the red dart marks are explicitly illustrative; foam padding previews do not establish solver foam contact. These must stay clearly identified during feature demos.

## 4. REA research questions, in investigation order

1. **2D tool semantics.** On the installed CLO app, capture a *user-authorized, reproducible* path for selecting a segment, adding a curve point, dragging independent handles, editing a notch/allowance, and observing the selected inspector. Record labels, coordinates, before/after state and the tool that actually owns the action.
2. **UI topology and identities.** Use REA's native UI observation / selector traces when a target window is available to identify component boundaries, selection ownership and parameter-flow hypotheses; preserve the observations, not inferred source code.
3. **Geometric authority.** Compare visible 2D changes with saved CLO document changes using a disposable CLO project and recorded feature-level assertions. Inspect resource/file format only within allowed targets and applicable terms. Do not modify the user's original garment.
4. **Native boundaries.** The observed `CloScene`, `CloMathSimulate` and `CLOAPIInterface` dependencies provide research starting points. REA `inspect-macho` is static and provider-free; function-level decompilation requires a configured, appropriately licensed Hopper, Ghidra or IDA provider and a separate evidence report.
5. **Parity implementation.** Capture one narrow CLO behavior and reproduce with EXO's own Rust+React architecture, unit tests, browser QA and disposable project; avoid importing proprietary binaries or copying any protected resources.
6. **Regression loop.** For every confirmed behavior, store the REA Evidence digest, CLO baseline, EXO before/after revision, native Rust compiled measurement, 3D scene result, versioned test and outstanding limitation in one reviewable entry.

## 5. First engineering sprint — exit criteria

| Order | Implementation | Pass condition |
| --- | --- | --- |
| 1 | **2D station hit-target and live curve preview** | `elementFromPoint` resolves selected side-station circle at ordinary zoom; drag changes actual paper path; cancel restores prior revision and preview; all four front/back stations pass read-only Playwright. |
| 2 | **Staged sewn-side Apply** | Each proposed side edit shows physical length change, then explicit seam-ease and Shape commit rebuild native revision, mesh/3D snapshot and reference measurements. Reopen preserves actual garment. |
| 3 | **2D manufacturing geometry** | Validated split/notch/allowance/POM changes across mirrored sides, with true measures and stable IDs; exact DXF/physical width acceptance fixture. |
| 4 | **Physical dart milestone** | Create, move and close one actual dart; physical 2D outline, sewing and 3D fold change; saved/reopened and exported pattern retains correct intake. |
| 5 | **One end-to-end garment** | Fully sewn and simulated T-shirt with side curves, stable seam residuals and collisions, material and texture, persisted 2D+3D and independently checked output. |
| 6 | **Expand tool coverage** | Finish hidden/unavailable actions only after each has a native operation or intentionally labeled visual-only state; add regression examples to the tool catalog. |

## 6. REA reproducible local commands

No global installation or agent config rewrite is required for these commands; the first run downloads the pinned CLI into a private npm cache. The audit's ephemeral cache was deleted afterward to reclaim disk space; it must be rebuilt on a later run with network access. Once cached again, `--offline` can avoid new downloads. Pin to the exact inspected version rather than `@latest`.

```sh
cd /blender-mac-workspace/exo-clothcraft-v2

npm exec --yes --package=rea-agents@6.7.0 \
  --cache=/tmp/exo-rea-npm-cache -- rea inspect-plist \
  /Applications/CLO_Standalone_OnlineAuth.app/Contents/Info.plist --format json

npm exec --yes --package=rea-agents@6.7.0 \
  --cache=/tmp/exo-rea-npm-cache -- rea inspect-macho \
  /Applications/CLO_Standalone_OnlineAuth.app/Contents/MacOS/CLO_Standalone_OnlineAuth --format json

# Read stored evidence without re-examining the original:
gunzip -c docs/engineering/rea-clo7-static-macho-20261019.json.gz | jq '.normalized_result.dependencies.total'
```

`npx rea-agents setup` is **not** part of this pass; that command configures an agent and can offer additional native provider installation. Review the proposed configuration and permissions separately before integrating MCP. A transient npm cache avoids modifying EXO package dependencies. At time of inspection the host had about 1.2–1.6 GiB free, so avoid extracting the full 2.6 GiB CLO application or building native tools onto the system disk.

## 7. Audit boundaries, questions for next iteration

- Internal CLO function-level call graphs, specific 2D widgets and persisted CLO project records **were not decompiled**. Library names are architectural hints, not algorithm claims.
- Current worktree contains extensive concurrent UI changes, and screenshot/test results can become stale. Inspect the exact current commit and working-tree revision before asserting a defect or release readiness.
- Native compiled contour passing does not establish a correct rendered interactive drag under overlays. The previously observed QA pointer-hit problem should be independently reproduced or cleared at a stable viewport.
- No consumer/app install, production garment mutation or irreversible app setup occurred in this audit. All native shape tests cited here use disposable test fixtures.
- Build/refactor sequence: **prove a feature's behavior → define data/command authority → implement in EXO → run disposable and source UI acceptance → save evidence → move to next feature**.

**Supporting prior project evidence:** `docs/engineering/exo-2d-mission-phase1-20261018.md`, `docs/engineering/2d-tool-coverage-20261018.md`, `research/clo-2d-analysis/CLO_2D_TOOL_TAXONOMY_20261018.md`, `research/clo-2d-analysis/CLO_SEWING_NOTCH_POM_TEST_MATRIX_20261018.md`, and `research/clo-3d-analysis/EXO_3D_VIEWPORT_PARITY_INVENTORY_20261018.md`.
