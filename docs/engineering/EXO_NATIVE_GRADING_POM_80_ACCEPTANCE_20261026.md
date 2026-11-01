# EXO V2 Grading & POM: 80% engineering-beta milestone (2026-10-26)

## Evidence-bound score

**10 / 12 = 83.3%** on the same equally weighted, internal grading/POM rubric defined in
[`EXO_NATIVE_GRADING_POM_75_ACCEPTANCE_20261025.md`](./EXO_NATIVE_GRADING_POM_75_ACCEPTANCE_20261025.md).
This exceeds the 80% development milestone, **not** 80% CLO feature parity or
factory manufacturing acceptance. The two remaining blocked requirements are
independently verified six-size graded CUT/allowance/notch output and third-party
industrial CAD + physical sample approval.

| Check | Scope | Status |
| --- | --- | --- |
| 1 | Editable, ordered six-size independent point rule tables | PASS |
| 2 | Graded contour, curve and material-space measurements | PASS |
| 3 | Physical sewn edge length and mismatch rejection for six sizes | PASS |
| 4 | Source-based POM anchor / cubic sewn edge measurements | PASS |
| 5 | Six-size POM targets, tolerances and revisions | PASS |
| 6 | Atomic, rule-pinned six-size POM target CSV | PASS |
| 7 | Native six-size catalog durable commit with revision checks | PASS |
| 8 | Native catalog/source rule/POM reopen and recovery | PASS |
| 9 | Distinct graded native 2D/3D fitting meshes and exact restoration | PASS |
| 10 | Default/legacy tight-envelope garment accepts valid outward size grades without editing saved source | **PASS** |
| 11 | Independently verified physical graded CUT, notches and allowances at 1:1 | BLOCKED |
| 12 | Independent receiving CAD and sewn sample approval | BLOCKED |

## Newly verified native capability

Previously the native T-shirt's source `Pattern` dimensions (1,000 × 660 mm)
rejected outward graded polygon points, unless a test manually widened the
saved template. The Rust `PersistedGradeRun` path now validates the exact source,
size inventory, panel metadata, curves and seams **before** compiling each size
inside a *disposable*, derived envelope containing its actual positive graded
vertices. Activation uses that disposable compilation template. Neither the
source garment nor the six serialized graded templates receives changed
`pattern.width` or `pattern.height` metadata. The normal Rust
`GarmentTemplate::compile` restrictions remain intact for ungraded projects.

The grade-only expansion accepts finite nonnegative material-space vertex
positions within the 10 m native limit. Negative/nonfinite/out-of-range points,
changed factory metadata, forged topology, nonmatching grade rules and stale
source revisions remain blocked. Temporary fitting bounds are **not** physical
CUT dimensions or manufacturing certification. New T-shirt and dress engineering
presets additionally reserve a bounded 5% positive drafting envelope for the
normal example size run; existing serialized projects remain unchanged.

## Reproduction and observed checks

- `node scripts/qa-native-graded-size-activation-20261025.mjs` — **PASS** with
  a disposable legacy source with unchanged 1,000 × 660 mm authoring envelope.
  Native XS/S/M/L/XL/XXL polygon widths measured 931.2 / 945.6 / 960 / 974.4 /
  988.8 / 1,075.2 mm; XXL is **12% larger than base** and beyond the legacy
  1,000 mm pattern envelope. Saved source metadata, actual 2D and 3D meshes,
  distinct POM measurements, exact source restoration, durable saved grade
  catalog inventory, and stale revision protection all passed. Native approval flags
  remained false for manufacturing.
- Rust `cargo test --locked --offline --no-default-features --lib -j 2 grading_envelope_tests`
  — **2 passed**, covering newly authored presets and forbidden invalid coords.
- Rust `cargo test --locked --offline --no-default-features --lib -j 2 grade_catalog_tests`
  — **10 passed** including a restored old source with 15% positive size growth,
  bad/nonfinite/negative/over-10 m inputs, and forbidden factory metadata changes.
- Rust `cargo test --locked --offline --no-default-features --bin exo-session -j 2 native_grade_activation_tests`
  — **3 passed**, checking atomic active-sized fitting and exact restoration.
  These Cargo commands run from `research/oss/clothcraft`; the Rust fitting
  catalog regression separately tests serialized project reconstruction.
- `node --test` of the native activation envelope, catalog, POM, release gate,
  CUT preflight, workflow, metrology and size review suites — **52 passed**.
- `node scripts/qa-grade-native-envelope-guide-20261026.mjs` — **PASS**,
  checking the actual dashboard displays required temporary positive extent in
  millimetres with preserved source information.

## Status limits

The live Rust exercise used a disposable local service and test garment. It
does not prove that the existing installed macOS application binary has been
replaced with this build. Tests of commercial receiving-CAD output and signed
physical sewn sample measurements remain outside this milestone. Native saved
fitting catalogs are independent of factory release evidence, and
`manufacturingApproved`, `manufacturerReady` and `cuttingAuthorized` remain false.

No existing garment project was changed by these test fixtures.
