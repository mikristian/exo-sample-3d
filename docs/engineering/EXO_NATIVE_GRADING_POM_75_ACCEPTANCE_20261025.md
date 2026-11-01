# EXO V2 Grading & POM: 75% engineering-beta gate (2026-10-25)

## Scope and scoring

This is a **focused twelve-check EXO grading/POM engineering-beta rubric**, not
a scientific percentage of CLO 3D product parity. Nine checks below have
supporting development/native test evidence. **9/12 = 75%** of this declared
internal rubric. Industrial fit/cutting certification remains **not approved**.
The checks are equally weighted only for tracking this project's milestone.

| # | Acceptance requirement | Evidence | Result |
|---|---|---|---|
| 1 | Exact ordered six-size editable independent grading rule tables | Grading core tests; installed grade studio loop | PASS |
| 2 | All-size contour, curve and material-distance QA | Grading regression suite | PASS |
| 3 | All-size sewn edge lengths and mismatch rejection | Native seam QA; installed rejection/recovery loop | PASS |
| 4 | POM from physical points and curve-aware single sewn edges | POM tests and installed Measurements view | PASS |
| 5 | Editable six-size target tolerances and source revision linkage | POM tests; installed grade studio loop | PASS |
| 6 | Atomic, source-pinned six-size POM target CSV exchange | POM roundtrip/tampering tests | PASS |
| 7 | Native six-size catalog commit with revision CAS and durable save | Isolated native catalog commit regression | PASS |
| 8 | Native project reopen/recovery with intact POMs and source rules | Isolated commit/reopen regression | PASS |
| 9 | Genuinely different six-size native 2D/3D fitting preview plus exact base restoration | Isolated activation with valid authored pattern envelope | PASS (CONDITIONAL) |
| 10 | Default tight-envelope T-shirt supports arbitrary outward grades without adjusting its source pattern | Real native activation error + new fail-closed source preflight | BLOCKED |
| 11 | Actual six-size graded CUT contours, offset allowances and notch placements independently verified at 1:1 | Source-only CUT preflight reports missing physical evidence | BLOCKED |
| 12 | Independent industrial receiving CAD and sewn sample fit approval | No receiving-CAD/physical sample sign-off | BLOCKED |

The conditional ninth check verifies a valid authored source whose pattern
envelope provides room for grading. The default T-shirt preset's tight bounds
do **not** satisfy that requirement without deliberate preparation. The
current native engine disallows a graded point beyond panel.pattern width/height,
although a 2D preview can represent it; EXO now reports this before native
catalog submission, rather than presenting a late failure as success.

## Changes in this loop

- `src/core/nativeGradeActivationEnvelope20261025.js`: detects a Rust-only
  source envelope violation across every graded size/panel/vertex. The catalog
  bridge preflights the real native pattern bounds and returns actionable
  diagnostics. Source-only fixtures without Pattern envelopes do not confer
  native activation proof.
- `scripts/qa-native-graded-size-activation-20261025.mjs`: isolated native
  full loop on a nonzero six-size T-shirt grade with an expanded **source**
  pattern envelope. Verified increasing XS–XXL material widths, sized 2D
  template, independently compiled 3D mesh, saved original source preservation,
  precise restoration for each size, stale revision rejection, and six-size POM
  variation.
- POM metrology: curve-aware consecutive edge-path draft measurements, selected
  POM station editing, safe source-pinned CSV round trips, independent
  graded-spec target increments, and adversarial checks. The Rust persisted
  grade catalog currently supports only `anchor-distance` and
  `sewline-edge`, so multi-edge paths remain **draft and CSV only** with an
  explicit fail-closed save guard.
- `src/core/nativeGradeCutPreflight20261025.js`: all-size source-only
  allowance/notch/CUT evidence inventory. Unknown/nonzero allowances,
  unproved notches, sewn CUT/STITCH coordination and receiving-CAD approval
  never silently receive factory-ready status.
- `src/components/NativeGradingQualityDashboard20261025.jsx`: separate visible
  native-size activation envelope status and expandable six-size CUT/notch/
  allowance diagnostic counts.
- Signed incremental UI asset update in the existing EXO V2 macOS app. Native
  Rust executable and user project files were not replaced.

## Reproduction

```sh
node scripts/qa-native-grade-catalog-commit-20261025.mjs
node scripts/qa-native-graded-size-activation-20261025.mjs
node scripts/qa-native-grade-studio-loop-20261025.mjs --installed
node --test src/core/nativeGradeActivationEnvelope20261025.test.mjs \
  src/core/nativeGradeCatalogBridge20261025.test.mjs \
  src/core/nativeGradingPOM20261025.test.mjs \
  src/core/nativeGradeCutPreflight20261025.test.mjs
```

Every browser/native test creates a disposable native project; the user's
existing clothing projects are never used as test fixtures.

## Release controls / remaining work

The Rust catalog save is not proof of manufacturable graded cutting geometry.
**manufacturerReady = false; cuttingAuthorized = false; manufacturingApproved
= false** remain required until external evidence is independently established.
The next major native upgrade is grade-aware 2D/3D envelopes for normal
outward-size construction, followed by physically proved per-size CUT,
STITCH, allowance and notch geometry; third-party CAD import/export and
actual printed/sewn sample validation must follow.
