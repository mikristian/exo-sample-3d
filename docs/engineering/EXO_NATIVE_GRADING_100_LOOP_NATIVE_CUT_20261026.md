# Native grading engineering loop toward 100% (2026-10-26)

## Outcome and scoring discipline

**10/12 = 83.3% of the existing engineering-beta rubric is independently
established.** This loop materially extends #11 CUT functionality and #12
receiving/sample workflows, but **does not change either to PASS** without
the actual independent 1:1 CUT receiver inspection and licensed CAD/factory
sample sign-off. See
`EXO_NATIVE_GRADING_POM_80_ACCEPTANCE_20261026.md` for the unchanged rubric.

## Implemented functional improvements

### Native Rust physical CUT for all six saved sizes

`research/oss/clothcraft/src/garment/cutline.rs` now exposes
`graded_production_cutlines(&FittingProject)` and structured results for each
XS/S/M/L/XL/XXL garment: physical offset CUT perimeter/area, named allowance
edges, graded physical CUT notch start/end stations, each sewn-edge material
length, sewn seam partner lengths and mismatch, and sewn notch intervals.
The function validates the complete saved source and all six graded templates
before constructing any CUT output; a missing physical allowance, ambiguous
notch projection, unsupported topology, seam mismatch without ease, or invalid
graded run rejects the full request. It does not change the source or sizes.

`research/oss/clothcraft/src/bin/exo-session.rs` adds a read-only,
revision-guarded `grade-run-cutlines` native RPC. Example request:

```json
{"op":"grade-run-cutlines","revision":10}
```

Successful results use `format: "exo-native-graded-cutlines.v1"`,
`sourceRevision`, and six `sizes[]` records with `panels[].cut`,
`sewline_edge_lengths_m`, and `seams[]`. Native size activation is not required;
the RPC inspects the saved six-size run. `manufacturerReady` and
`cuttingAuthorized` are explicitly false; it is engineering evidence only.

`src/core/nativeGradeAuthenticCutBundle20261026.js` checks completeness,
source revision, complete editable grading rule identity and persisted
catalog correlation, ordered size/panel/seam identities, positive finite CUT
geometry, edge allowance records, notch geometry, and unsupported claims. It
refuses unauthenticated JSON by default; the caller may only label results as
a controlled live Rust RPC at the native boundary, and **even then** cannot
claim independent cutter/factory acceptance.

The native workspace bridge handles `grade-run-cutlines` like
`grade-run-status`: as a read-only result. It deliberately does not feed the
CUT proof into the current-scene snapshot state. The Grading Export UI obtains
the status and CUT proof sequentially at the same revision, validates their
source/rules correlation, and displays only engineering observations.

The Grading Studio **Export → Production release checklist** includes an
**Inspect six-size native CUT geometry** control. On a successful native
response it displays panel counts, CUT area in cm², notch counts, sewn
relationships and maximum seam discrepancy in millimetres for each size.
Stale revisions and incomplete six-size results are blocked.

### Real sewn-sample measurement CSV interchange

`src/core/nativeGradingPhysicalSampleReview20261026.js` adds
`importNativeGradingPhysicalSampleWorksheet20261026` to complement blank
worksheet export. Returned CSV requires exact SHA-256 pins to source pattern,
full grade point offsets and current POM specifications; all sizes and POMs;
positive finite actual millimetre measurements; nonduplicate specimen IDs;
consistent operator/factory/calibration/date/report provenance per size; and
valid, non-executable CSV. It returns an atomic set of observations or a
specific rejection, never a partial import or factory authorization.

The Production release checklist now supports selecting an actual completed
factory CSV, reviews out-of-tolerance measurements and missing evidence, and
keeps **independent sample signature** separately blocked. Observations remain
ephemeral to the browser component, clearing when the source/rules/POMs change.

The release gate includes a separate **Independent signed six-size sewn-sample
inspection** requirement, preventing locally reported measurements or claimed
booleans from satisfying the release state.

## Verified testing

- Combined 13 focused grading core files: **76 of 76 JavaScript tests pass**,
  including negative/adversarial CSV and CUT proof cases.
- Chromium workflow: blank sample worksheet download; completed six-size CSV
  upload and tolerance review; altered source hash rejected; six-size CUT UI
  result renders; stale native CUT revision rejected; manufacturing remains
  unapproved.
- Scoped Rust tests: new `graded_cut_tests` **3/3** and native read-only
  `native_grade_activation_tests` **4/4**, plus existing
  `cutline_production` regressions **11/11**, as reported by the Rust worker.
- Rebuilt the development `exo-session` Rust executable only (not the installed
  macOS app). An isolated real child-process RPC returned six physical CUT
  size entries from an in-memory persisted grade catalog with 10 mm authored
  allowances: 2 panels per size and 8 sewn relationships per size (12 CUT
  panel outputs and 48 native sewn relationship entries). Stale revision was
  rejected and subsequent snapshot revision remained unchanged. All factory
  approval flags were false. This live fixture used zero physical notches and
  identical size geometry, whereas the separate Rust unit test covers
  nonidentical XS–XXL grade factors and notch/offset behavior is covered by
  the cutline kernel tests. It does not independently establish manufacturer
  notch or multi-size 1:1 physical acceptance.
- JSX syntax verified for the Grade Export checklist, Quality Dashboard and
  ClothCraft workspace components.

**Verification boundary:** the browser Rust-CUT table test is a component
integration fixture, while Rust scoped tests and the isolated development
executable call the actual native kernel. The installed macOS application's
bundled Rust executable was **not** replaced or release-tested. An unsigned local DXF roundtrip is not a licensed
receiving-CAD inspection. No physical garments were measured in these tests.

## Actual remaining work for 12/12

1. **Gate 11:** Independent 1:1 six-size CUT output acceptance, with returned
   per-size physical CUT and notch/allowance geometry, printed calibration
   measurements, source-correlated sewn seam inspection and authenticated
   receiver/cutter traceability. Native kernel measurements alone are not a
   physical cutter witness.
2. **Gate 12:** Licensed Gerber/Lectra or other agreed receiving-CAD software
   import/export with verified rule mapping and returned files, plus real
   calibrated and independently signed sewn XS–XXL samples at the POM stations.
   Self-entered CSV metadata and self-signed flags are not acceptable proof.

No user's existing garment project was modified as part of these regression
fixtures, and no manufacturing release was authorized.
