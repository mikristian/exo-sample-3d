# EXO 2D notch coordinate reconciliation — engineering decision (2026-10-23)

**Disposition:** source-only prototype and independent validation permitted; no installed-app change, no factory approval, no edit to shared dirty `grading.js`, `App.jsx`, `dxf.js` or `factoryPackage.js` in this pass.

## Observed source behavior

- `src/core/grading.js::gradePiece` grades vertices, but its ordinary (no point-break / no explicit attachment) branches clone `piece.notches` without recomputing optional cached `x/y`. Non-base-size coordinates may therefore be stale.
- `src/core/grading.js::gradeProject` has a `seam-locked-affine-v1` T-shirt path that clones source piece metadata while scaling points and curves; it does not refresh cached notch coordinates in that branch.
- `src/core/gradedConstructionAttachments.js` already recomputes cached coordinates for explicit construction attachment paths, using `edgePointAt` and the authored edge/arclength station.
- `src/core/gradedNotchCanonicalView20261023.js` is a nonmutating development-only view. It rejects malformed cached pairs, invalid stations, duplicate piece/notch IDs and degenerate edges; it preserves a completely absent cache.
- `src/core/dxf.js` places physical DXF notch geometry from `edgeIndex` plus physical `t`, not from optional cached `x/y`. The manufacturing path also validates allowance/depth. `src/core/industrialNotchQA.js` compares paired seam stations using physical arclength, not cached positions.
- `src/core/factoryPackage.js` invokes `gradeProject` to generate per-size DXF/markers. `src/core/manufacturingReleaseReadiness.js` returns `factoryCertified:false` and `factoryCuttingAuthorized:false`, and requires external sample evidence even when digital checks pass.

## Narrow integration sequence

1. Keep a separate, explicit **display-only / diagnostic** adapter for a graded project. It must preserve the source project, size ID, point IDs, notch IDs, matched-seam IDs and grading provenance. A cloned project must be labeled development-only, with `factoryCertified:false`.
2. Exercise the generic and `seam-locked-affine-v1` grading branches, base and non-base sizes, a curved edge, an absent optional cache, and corrupted/partial cache pairs. Confirm no source mutation even when the adapter rejects an input.
3. Before modifying `src/App.jsx`, compare actual 2D render consumers of `notch.x/y` against physical station consumers. Only bind the corrected display view to a selected size under exclusive source-file ownership; do not route it into the authoritative editable garment or factory ZIP automatically.
4. When the owner of `src/core/grading.js` is available, make the canonical station calculation a single, transactional, revision-guarded grading operation. Avoid redundant recalculation at export time. Run all-size regression and browser/installed-app tests after sufficient free disk is restored.
5. Independently validate CUT/STITCH DXF receiver roundtrip, matching notches, sewing constraints, physical print scale and a sewn sample before changing manufacturing approval state.

## Safety and current blockers

The Mac was below the required **25 GiB free** threshold during this review (about 9 GiB available). Jarvis was marked offline by Tailscale, so no remote backup was attempted. A passing local notch view is **not** factory certification. The 501 jeans and imported CLO shirt still have known sewing, graded-junction and/or cutting-contour blockers, and no independent receiving CAD or physical sample acceptance has been demonstrated.
