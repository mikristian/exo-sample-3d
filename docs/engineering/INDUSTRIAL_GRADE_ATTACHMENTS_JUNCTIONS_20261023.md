# Independent industrial size-rule / attachment / junction report — 2026-10-23

Scope: the independent test `src/core/industrialGradeIntegration20261023.test.mjs` evaluates uneven, signed five-size rules through the three industrial modes; five graded sizes of curved-edge notch + fold/dart anchor fixtures; and paired 501 back-leg/yoke junctions across six waist sizes. The harness does not alter shared implementation files or assert factory certification.

## Observations / blockers

* Grade-rule conversions use size-relative arithmetic in caller units; the isolated fixture checks coordinate equivalence to 1e-10. External grade-rule semantics and mm/cm conversions must still be validated against an independent industrial CAD receiver, with explicit unit metadata.
* Grade-aware notches preserve `edgeIndex` and arclength fraction. Anchored fold endpoints follow curved edges and the dart leg with vertex anchor follows its vertex; the other unanchored dart endpoint is only interpolated. **Blocker:** interpolated dart geometry is not an independently verified sewn balance or a certified dart-transfer construction. Notch `x/y` coordinate fields, when present, are retained rather than recomputed; consumers must calculate the physical location from the graded edge and fraction (or explicitly refresh stored coordinates).
* 501 jeans paired left/right yoke and back-leg sewn junctions: W32 base passes; all five other waist sizes fail on each of two joints (**10 endpoint-drift blockers**). The source junction evaluator reports `GRADED_SHARED_JUNCTION_DRIFT`, and `factoryCertified` remains false. This endpoint-station check does not assert fit of the full curves, ease, or sewn orientation. Existing industrial-pattern checks separately flag seam-length mismatches.

## Narrow follow-up proposals

1. Add explicit size-rule unit/provenance fields and a round-trip contract with a real Gerber/Lectra DXF grade-rule importer; compare signed increments and cumulative offsets in both dimensions for all sizes. Preserve the existing conversion functions until real importer evidence exists.
2. Give each dart leg/apex an explicit source vertex, edge or seam attachment. Recompute geometric notch coordinates (when stored) from grade-aware `edgePointAt` after grading. Audit all topology and edge references before moving marks.
3. For 501 jeans, coordinate yoke and back-leg sewn station rule tables per side. Require patternmaker approval of all source measurements and intended ease; then verify **both paired endpoint coordinates and full seam walks** for W28–W38. Do not simply widen a yoke, loosen the 0.05 cm threshold, or reclassify known gaps as intentional ease.

**Release:** DEVELOPMENT_ONLY_FACTORY_APPROVAL_REQUIRED. Industrial CAD interoperability, all-size sample sewing, and patternmaker signoff outstanding.
