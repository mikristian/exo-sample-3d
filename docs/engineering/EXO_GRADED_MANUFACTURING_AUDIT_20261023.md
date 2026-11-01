# EXO 2D graded manufacturing audit — 2026-10-23

Scope: source-only inspection of unchanged `createTemplateProject('tee')`, `('jeans-501')` and `('clo-male-tshirt')` using existing production, industrial pattern, cutline, topology, notch, junction and factory sample release inspectors. No grade tables, pattern coordinates, tolerances or acceptance thresholds were changed.

## Observed findings

| Template | Production blockers | Graded industrial pattern blockers | Physical CUT blockers | Topology findings | Paired notch checks / blockers | Shared junction checks / blockers | External evidence blockers |
| --- | ---: | ---: | ---: | ---: | --- | --- | ---: |
| Foundation tee, XS–XXL | 0 | 0 | 0 | 0 | 24 / 0, four configured groups | **Not configured** | 6 |
| 501 jeans, W28–W38 | 0 | 30 | 0 | 0 | **No paired notch checks configured** / 0 | 12 / 10, two yoke junctions | 7 |
| Imported CLO male T-shirt, XS–XXL | 4 | 24 | 656 | 0 | **No paired notch checks configured** / 0 | **Not configured** | 7 |

The count of zero notch blockers on jeans and CLO is **not** proof of aligned notches: those fixtures have zero evaluated paired-notch groups. The tee's zero shared-junction blocker field is `null`, because the junction inspector returned `not_configured`; no shared-junction grade validation occurred. A zero topology finding count only covers that inspector's implemented scope.

The tee's implemented geometry checks pass and its four sleeve notch groups pass across six sizes; the experimental separate neckband still lacks approved marker/BOM and sample evidence. Jeans fail graded seam/measurement QA and yoke junction continuity: left and right yoke endpoints coincide at W32 only, but drift in the other five sizes (10 failed size/junction checks, maximum recorded gap about 1.7145 cm at W38). CLO import fails foundational production checks, graded sewing/measurement checks and physical contour checks; its imported grading table remains unapproved. The raw template must not be treated as a sewable factory pattern.

All three return `BLOCKED_NOT_APPROVED`, with `factoryCertified=false`, `factoryCuttingAuthorized=false` and `bulkProductionAuthorized=false`. There is no evidenced Gerber/Lectra receiver validation, independent patternmaker approval or physically sewn sample signoff. Exporting digital files or passing an inspector cannot provide those approvals.

## Priorities

1. Author, review and test missing jeans and CLO sewing notch pairs; configure genuine tee/CLO junction constraints where sewn edge joins require verification.
2. Resolve 501 graded seam mismatch and coordinated yoke/seat/side grade rules; rerun all-size junction checks with an approved patternmaker rule table.
3. Correct CLO imported source geometry, seam relationships, cutlines and XS/S crossings through a reviewed, provenance-preserving process; retain its source and approval blocks until independent review.
4. Complete tee neckband pattern/BOM acceptance and validate all three patterns in receiving CAD and physical samples before any factory release.

Deterministic assertions and live fixture counts: `node --test scripts/qa-exo2d-graded-manufacturing-20261023.test.mjs`. These results describe the current source snapshot; run the audit again whenever fixture geometry or inspection logic changes.
