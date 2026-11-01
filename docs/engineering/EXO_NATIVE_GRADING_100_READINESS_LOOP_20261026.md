# EXO grading: 100% acceptance closure loop (2026-10-26)

## Actual milestone score

**10/12 = 83.3% passed** of the defined native grading engineering-beta
rubric, not 100%, after this loop. The denominator and the two independent
manufacturing requirements are unchanged from
`EXO_NATIVE_GRADING_POM_80_ACCEPTANCE_20261026.md`. No factory releases or
independent sample approvals were available to establish 12/12.

## Implemented this loop

1. `src/core/nativeGradeSixSizeCutEvidence20261026.js`: checks complete
   XS–XXL CUT and STITCH contour coordinates against native graded source
   geometry in millimetres, covering zero allowances and bounded, uniform
   positive rectangular offsets. Requires exact revision/template/full point
   rules and complete panel identities. Rejects altered/missing geometry and
   unsupported curved/variable allowances, sewn CUT proof and physical notch
   transfers. **Local geometry evidence only; not authoritative Rust proof.**
2. `src/core/nativeGradeCadRoundtripEvidence20261026.js`: parses six returned
   generic DXF files and compares all parsed CUT/STITCH/mark entities against
   independently regenerated size exports, including SHA-256 pins to the
   complete source and grade rules. Refuses missing sizes, changed vertices,
   misplaced notches and unsupported wire entities. **Local R12 DXF parity
   only, not licensed Gerber/Lectra or ASTM/AAMA certification.**
3. `src/core/nativeGradingPhysicalSampleReview20261026.js`: audits provided
   measured millimetre values for every POM and every sewn XS–XXL specimen,
   requiring unique specimen IDs, factory/operator, calibration reference,
   dates and signed report references. Any tolerance exceedance, absent size,
   stale source rule, duplicate station or invalid number blocks readiness.
   No user-submitted values receive automatic independent approval.
4. `src/components/NativeGradingReleaseChecklist20261025.jsx`: displays the
   physical specimen requirement and offers a **blank** CSV worksheet after
   six-size POM targets are verified. The worksheet hashes complete source,
   full grading rules and POM specifications, leaves all real sample values,
   signers and calibration fields empty, and cannot itself approve a garment.

The new file paths and test fixtures contain no real customer's measured
factory samples and do not mutate any user's garment project.

## Remaining independent evidence for 12/12

### Gate 11 — independently measured all-size physical CUT

Current blocker: the authenticated Rust native AAMA CUT study is limited to a
single unsewn/no-notch size. Local six-size math verifies only a deliberately
restricted geometry subset, and can't establish six-size physical CUT offset,
notch depth, sewing linkage, or 1:1 calibration for arbitrary production
garments. To pass:

- Produce all XS–XXL physical CUT/STITCH outlines, nonuniform seam allowances,
  sampled curves and actual graded notch stations **from the native source**.
- Obtain independent per-size validation of coordinates, sewn relationships,
  notch shape/depth and cutting-scale calibration; bind evidence to exact
  revision/template/rule-set and immutable returned artifacts.
- Prove failures for broken/overlapping offsets, wrong notch stations, missing
  size, stale source and corrupted returned files.

### Gate 12 — independent receiving CAD and sewn-sample approval

Current blocker: local generic AutoCAD R12 DXF parsing is not vendor CAD
acceptance. No approved return conversion from a licensed independent
receiving Gerber AccuMark/Lectra CAD system or separately measured, signed
XS–XXL sewn fit samples is present. To pass:

- Supply source and returned native-CAD/grade-rule artifacts for all six sizes
  from the actual vendor application, with operator, product/version, custody
  metadata, loss report and independently checked source hashes.
- Compare dimensions, point/curve/rule identities, notches, internal marks,
  grain and allowances across each size to the native source.
- Have a real independent factory create/measure the six physical sewn
  specimens at every authored POM with calibrated tools and signed records.
  Record failed sample measurements as failures, not auto-adjusted targets.
- Independently authenticate the operator/factory approvals and correlate
  sample results with the received CAD size and revision.

**Do not treat local evidence booleans, fixture-passing math, user-entered
sample observations or a PDF signature filename as proof of actual factory
acceptance.** The grading release gate retains `manufacturingApproved=false`,
`cuttingAuthorized=false` and `manufacturerReady=false` until independently
verifiable backend evidence exists.

## Focused reproduction

```sh
node --test src/core/nativeGradeSixSizeCutEvidence20261026.test.mjs \
  src/core/nativeGradeCadRoundtripEvidence20261026.test.mjs \
  src/core/nativeGradingPhysicalSampleReview20261026.test.mjs \
  src/core/nativeGradeCutPreflight20261025.test.mjs \
  src/core/nativeGradingReleaseGate20261025.test.mjs

node scripts/qa-native-grading-physical-sample-ui-20261026.mjs
```

The browser test uses the already running local development server and a
disposable React mount. It checks that an incomplete POM run disables the
physical-sample worksheet, the complete run exports a blank source-pinned CSV,
and the UI never claims independent approval.
