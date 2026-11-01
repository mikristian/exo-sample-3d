# Graded notch DXF and factory export consumer audit (2026-10-23)

## Consumer contract

`src/core/factoryPackage.js` calls `gradeProject(project, size)` for every size, then `projectToDxf(graded, size, {cutlineMode:'manufacturing'})` for each packaged DXF. `src/core/dxf.js` emits explicitly authored NOTCH geometry using `notch.edgeIndex` and the stitch-edge arclength fraction `notch.t` (including the two displaced fractions for double notches). `factoryNotchForEdge` projects the resulting station to the physical allowance CUT boundary. The DXF writer does not read the notch's cached `x` or `y` coordinates. Moving or corrupting those cached values alone therefore cannot change this export consumer's notch location.

`src/core/grading.js` delegates to `gradeConstructionAttachments` when the piece has an industrial point break or explicitly anchored internal line. That helper recomputes finite cached `x/y` from canonical edgeIndex/t, but preserves partial or nonfinite caches as-is; grading without those triggers clones notch metadata. This is a potential **visual/editor consumer** inconsistency wherever a component paints or drags the cached point. It does not by itself establish DXF drift. A separate source audit is needed before claiming any particular UI consumer reads those fields.

## Negative cases and release limitations

The focused source-level regression covers direct graded manufacturing DXF independence from cached x/y, a factory-package DXF versus direct DXF comparison, rejected invalid physical notch depth and NaN fraction, and grade-provenance and reference-only blockers. `src/core/manufacturingReleaseReadiness.js` hardcodes `factoryCertified`, `factoryCuttingAuthorized` and `bulkProductionAuthorized` to `false`, even when geometry passes. An exported ZIP is expressly an unapproved engineering study and does not establish Gerber/Lectra compatibility or physical sample approval.

## Next safe integration point

Validate complete notch metadata **before** constructing the per-size DXF in `buildFactoryPackageFiles` and at the direct `projectToDxf` entry. Reject invalid `edgeIndex`, nonfinite/out-of-range `t`, partial finite cached coordinate pairs, and nonfinite cached coordinate pairs unless an explicit repair action has normalized them. Today `projectToDxf` silently skips invalid `edgeIndex`, so a malformed notch can disappear from manufactured geometry. Perform this validation without depending on or trusting cached x/y for positioning, and retain a separate human factory release gate. Add a visual consumer audit for renderer references to `notch.x` and `notch.y` before changing editor presentation.

Run: `node --test scripts/qa-graded-notch-export-consumer-20261023.test.mjs`.
