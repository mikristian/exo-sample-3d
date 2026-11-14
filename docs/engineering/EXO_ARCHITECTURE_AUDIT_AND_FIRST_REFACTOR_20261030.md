# EXO architecture baseline and first guarded refactor — 2026-10-30

## Outcome

This pass added a repeatable JavaScript/TypeScript module dependency audit and completed one narrow production-code refactor. The computation for native internal-line curve sampling now lives in `src/core/nativeInternalCurve.js`. Existing imports of `src/components/nativeInternalCurve.js` continue working through a compatibility re-export. The core print appearance code now imports the core implementation directly. Native CAD geometry, serialized pattern data, Rust build artifacts, grading, DXF/factory validation and release packaging were not changed in this pass.

### Machine-readable graph evidence

- [Before](../reports/EXO_ARCHITECTURE_DEPENDENCIES_20261030.json)
- [After](../reports/EXO_ARCHITECTURE_DEPENDENCIES_POST_REFACTOR_20261030.json)
- Analysis source: `tools/rust-migration/architecture-dependency-audit-20261030.mjs`
- Standalone graph tests: `tools/rust-migration/architecture-dependency-audit-20261030.test.mjs`

| Static graph metric | Before | After |
| --- | ---: | ---: |
| Application source modules parsed | 959 | 960 |
| Resolved synchronous source references | 1,849 | 1,850 |
| `src/core` → `src/components` imports | 4 | **3** |
| Synchronous import cycles | 1 | 1 |
| Files participating in cycles | 2 | 2 |

One additional source module and import edge are expected: a new canonical implementation plus the compatibility re-export. The structural reduction is one direct core-to-UI dependency. The report includes separate unresolved reference counts; these are leads for classification, not verified missing files.

## Findings from the graph

1. **One active cycle:** `src/core/grading.js` ↔ `src/core/accumarkGradedNotchDistance20261023.js`. This belongs to the ongoing grading/Modaris engineering lane; resolve with that lane's contract owner and complete regression fixtures. This pass made no grading changes.
2. **Three remaining core-to-UI imports:** `src/core/proceduralHardwarePreview.js` imports `src/components/HardwareButton3D.js`, `ButtonholeHardware3D.js` and `ZipperHardware3D.js`. Inspect whether these are presentation/Three.js adapters whose ownership should move into a dedicated rendering boundary. Moving them safely requires caller and viewport verification.
3. **High integration fan-out:** `src/App.jsx` had 151 distinct resolved synchronous outgoing modules and `src/components/ClothCraftWorkspace.jsx` had 88 in the baseline graph. Their counts make them useful candidates for command facade and feature-owner analysis, but import count alone does not demonstrate a defect.
4. **Large source inventory vs browser reachability:** The earlier broader Oxc audit parsed 2,174 JS/TS files and found 8,874 import references; its browser entrypoint had 713 *potentially* reachable files. The new architecture report excludes tests/QA, follows specific first-party roots and uses synchronous edges for cycle analysis, so its counts are intentionally different.

## Exact refactor and compatibility

- Canonical pure sampling: `src/core/nativeInternalCurve.js`.
- Old path compatibility: `src/components/nativeInternalCurve.js` re-exports `cubicPoint`, `sampleInternalCurve` and `initialInternalTangents` by identity. The large 2D board still uses its original import path.
- Call-site migration: `src/core/printPatternAppearance20261025.js` imports from `./nativeInternalCurve.js`.
- Repeatable codemod: `tools/rust-migration/codemods/relocate-native-internal-curve-20261030.mjs`. It uses Oxc AST positions, requires an exact approved import and refuses unexpected source. Default mode is a dry run; `--apply` writes only the specific call-site import. Running it again is idempotent.
- No changes to tangent conventions, sampling step limits, degenerate input handling, or print appearance semantic roles.

## Verification performed

```sh
node --test tools/rust-migration/runtime-ownership-audit.test.mjs \
  tools/rust-migration/architecture-dependency-audit-20261030.test.mjs \
  tools/rust-migration/codemods/relocate-native-internal-curve-20261030.test.mjs \
  src/core/nativeInternalCurve.refactor20261030.test.mjs \
  src/core/printPatternAppearance20261025.test.mjs
```

**Result: 13 tests passed, zero failed.** This includes Oxc parsing/reachability, cycle and boundary detection, exact/idempotent codemod behavior, compatibility export identity, curve numeric values and the pre-existing native print appearance tests. The broader application bundle, installed signed Mac app and C++/Rust interop were not rebuilt or tested as part of this narrow source change.

## Next priority sequence

1. **Add an architectural baseline gate for new violations.** Keep the existing cycle and three remaining core-to-UI imports as an explicit baseline until each owner approves a migration. Enforce only regressions/new edges initially. Add a distinction between unresolved code imports and expected CSS, JSON, assets and external research content.
2. **Reduce UI state/mapping duplication in a stable pilot.** Two views map the same seven CAD automatic-contrast preferences: `PatternEditor.jsx` and `ClothCraftBoardV2.jsx`. Extract a pure helper that takes the caller's paper fallback, preserving `twoDAutoContrast === false`; test both defaults. Both large UI files are concurrently modified, so schedule this separately after checking overlapping edits.
3. **Separate 3D hardware creation from domain logic.** Move or adapt the three hardware visualization imports with realistic Three.js viewport tests; record runtime consumers before moving exported functions.
4. **Publish typed domain contracts for Rust migration.** Identify one authoritative versioned garment schema and command/transaction ABI for CAD topology, grading, sewing and manufacturing. Preserve centimetre/metre semantics, IDs, undo/revision checks, original source formats and parity fixtures before migrating algorithm ownership.
5. **Benchmark Rust throughput later.** Once a stable crate has an agreed API and baseline, compare `cargo-nextest` and `sccache` against existing cargo/test time and disk usage. Avoid copying reference GitHub source directly into the application without a license/API audit.

**Scope note:** A static graph measures source-level coupling; it cannot alone certify dead code, current installed-runtime implementation, numerical equivalence, physical simulation accuracy, or industrial CAD interoperability.
