# EXO V2 — graded notch cached-coordinate consistency (read-only)

**Date:** 2026-10-23. **Owner:** automated safe engineering pass. **Status:** source diagnostic + tests, **not** production integration or factory approval.

## Why this matters

EXO's canonical notch location is `edgeIndex` plus `t`, where `t` is the fraction of physical edge arclength. Some imported or edited marks also carry cached `x/y` coordinates in centimeters. Those cached coordinates must never be trusted as the cutting or sewing station unless they agree with the graded edge. The generic `gradePiece` path currently clones notch records without refreshing cached `x/y` when no explicit industrial point-break rules or construction anchors are present. A stale cache can therefore disagree with the physical graded edge even though the edge-based export is correct.

## Delivered

New `src/core/gradedNotchCoordinateConsistency20261023.js` exposes `inspectNotchCoordinatesOnPiece` and `inspectGradedNotchCoordinateConsistency`. Both are **nonmutating diagnostics**. They check notch IDs, edge indices, arclength fractions, optional finite `x/y` pairs and measured Euclidean discrepancy against `edgePointAt` (default 0.01 cm = 0.1 mm). They record the exact piece, size and notch; bad metadata blocks the diagnostic. A notch with no `x/y` is counted as missing rather than marked bad, and an entire run with no measurable cached coordinates is `not_configured`, **never a misleading pass**. The report always has `factoryCertified:false`.

New `src/core/gradedNotchCoordinateConsistency20261023.test.mjs` covers a deliberately stale nonbase-size notch, reattached industrial grade rule, a curved Bézier arclength station, missing optional coordinates, malformed fractions, duplicate IDs, invalid coordinate pairs and real source templates. The test is read-only and does not alter existing grading or manufacturing source.

## Observed fixture results

For current `createTemplateProject` fixtures, cached coordinate coverage is absent: Foundation Tee has 48 size-expanded notches without cached `x/y`, 501 jeans has 48, hoodie has 60, and the imported CLO male shirt has zero notches in this diagnostic. This means **there is no direct cached-coordinate proof for these templates**, not that their notch placements are incorrect. Separate paired-notch and seam-walk QA still apply. The generic two-size synthetic fixture demonstrates one stale `x/y` discrepancy in L while M remains consistent.

## Validation and limitations

Executed `node --test src/core/gradedNotchCoordinateConsistency20261023.test.mjs src/core/gradedConstructionAttachments.test.mjs src/core/gradedNotchIntervalAudit.test.mjs src/core/industrialNotchQA.test.mjs`: **24 passed, 0 failed**. This is a source-level test, not an installed app, DXF receiver or physical sample validation.

**Follow-up engineering:** decide whether `gradePiece` should always re-evaluate cached notch `x/y` from canonical graded edges, including the special affine T-shirt path, under a dedicated owner and full all-size regression. Until then, use the edge+arclength station as authoritative and do not treat a cached point or a diagnostic `not_configured` result as manufacturing approval. The 501 yoke junction and seam-length blockers remain unresolved.
