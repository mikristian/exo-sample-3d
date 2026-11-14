# EXO grading — source-pinned independent verification loop

Date: 2026-10-27

## Engineering acceptance status

**10 of 12 (83.3%) of the original grading engineering-beta checks are
verified.** The two remaining manufacturing gates are not waived, merged or
declared complete simply because local code or test fixtures pass. See
`EXO_NATIVE_GRADING_POM_80_ACCEPTANCE_20261026.md` for the original rubric.

### Implemented this pass

1. **Real six-size native CUT regression** —
   `integrations/clothcraft/qa-native-six-size-cut-proof-20261027.mjs`
   starts an isolated local Rust development session with a disposable
   persisted grade catalog. All six sizes have genuinely different geometry
   (97%, 98.5%, 100%, 101.5%, 103% and 112% of base). Each of two panels has
   10 mm authored allowances and one physical 4 mm notch on its hem. Actual
   `grade-run-cutlines` proof produced 12 physical CUT panel contours,
   12 projected notches and 48 sewn relationships. The test independently
   measures area, the notch projection 10 mm from sewline to CUT, 4 mm notch
   depth, per-size sewn edge lengths, intervals, area growth, repeatability,
   stale revision rejection and source immutability. It separately rejects
   malformed notch metadata and missing allowances. No sample/cutter/CAD
   approval is inferred.

2. **Independent review packet** —
   `src/core/nativeGradeExternalReviewRequest20261027.js` creates a
   deterministic, read-only six-size JSON evidence request from a valid
   same-revision native Rust CUT result, exact editable point grading rules,
   complete garment source and all POM targets. It includes SHA-256 hashes of
   the original source template, full grade rule set, POM specifications and
   native six-size CUT response. It refuses stale/missing/modified source,
   absent POM targets and spoofed manufacturing flags. The production release
   checklist now offers **Download six-size independent factory review
   request (JSON)** after successfully inspecting native CUT geometry and
   completing POM targets. Filename explicitly says `NOT-APPROVED`.
   Source, complete grading-rule and POM digests are also cross-checked
   against the separately implemented reviewer signature verifier's canonical
   SHA-256 format, including generated null-prototype native point-rule data.

3. **Reviewer signature verification** —
   `src/core/nativeGradeIndependentReviewEvidence20261027.js` verifies three
   distinct Ed25519-signed reviewer attestations for physical CUT,
   independent receiving CAD and real sewn samples. The caller supplies
   public keys established by an **external trust enrollment process**.
   The module bundles no reviewer keys and never treats public keys delivered
   inside the evidence file as trusted. All reports must pin exact source
   revision, full grading-rule hash, source geometry hash and POM hash;
   cover six sizes in order, use distinct reviewer/evidence IDs and current
   timestamps, and pass physical calibration, allowance/notch, returned CAD
   file and sewn sample POM checks. Invalid signatures, replay, changed grade
   offsets, incomplete sizes, expired calibration and out-of-tolerance
   measurements reject the evidence. Valid signatures establish **authentic
   reviewer claims only**, not the truth of unobserved factory work.

4. **UI trust gate** — The release checklist includes a signed-review import
   control, disabled unless externally provisioned reviewer public keys are
   supplied by the surrounding trusted app. A report from the same user is
   not automatically trusted. Even with valid signatures the UI explicitly
   reserves final manufacturing release for independently checked physical
   evidence. The factory CSV importer, real CUT inspector and original source
   are unchanged by review downloads.

## Test commands

```sh
node integrations/clothcraft/qa-native-six-size-cut-proof-20261027.mjs
node --test src/core/nativeGradeExternalReviewRequest20261027.test.mjs \
  src/core/nativeGradeIndependentReviewEvidence20261027.test.mjs \
  src/core/nativeGradeAuthenticCutBundle20261026.test.mjs
node scripts/qa-native-grading-physical-sample-ui-20261026.mjs
```

Additional native grading, CAD, CSV and factory-release adversarial test suites
must continue to pass. The production macOS app was not replaced or installed
by this loop. No existing garment project was altered.

## Required to actually reach 12/12

- **Gate 11 — physical CUT acceptance:** Actual calibrated full-scale CUT/STITCH
  plots for all six sizes must be measured by an independently identified
  cutter/receiving factory. Returned physical notch positions, seam allowances,
  sewn edge relations and scale witnesses must match the exact revision and
  hashes. Native Rust tests and digital geometry alone do not measure paper,
  fabric or cutter output.
- **Gate 12 — independent CAD and sewn samples:** A real licensed external
  receiving-CAD application must return independently inspected size/cut/mark
  artifacts with preserved grade identities and audited file hashes. An actual
  factory must cut/sew six individually traceable specimens and return
  calibrated POM measurements plus independent signed inspection reports.
  Trust roots must be established out of band, not uploaded alongside the
  attestations. Signatures and hashes establish file integrity/attribution,
  not proof that the claimed physical work occurred.

**Current manufacturing authorization: blocked.** No fabric cutting or
factory approval is implied by this progress report.
