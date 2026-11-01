# EXO V2 physical pleat closure: isolated runtime comparison, 2026-10-25

This is a development investigation, not manufacturing, CLO parity, physical
fit, fold-contact or cut/sew acceptance. The installed application was not
replaced. No Rust binary was built: the internal disk lacked the estimated
8 GB build headroom; the Expansion volume was not mounted.

The reproducible script is scripts/qa-physical-pleat-prefold-runtime-20261025.mjs.
It runs the previously compiled target/debug/exo-session simulator against an
injected experimental initial state held in a disposable temporary project.
Changes to Rust source were not compiled into that binary.

## Fixture

One off-avatar 400 x 300 mm rectangular panel, an uncut 18 mm sewn tuck intake,
and a 45 mm internal stitch depth. Quarter arc means the restrained 90 degree
prefold source; hairpin factors interpolate between flat (0) and near-closure
(1). VBD, OGC, 16 solver iterations per step, default 3 mm contact shell.

| Initial pose | Initial gap mm | Gap at 50 steps mm | Maximum extension at 50 steps % | Residual RMS at 50 steps N |
| --- | ---: | ---: | ---: | ---: |
| Quarter arc | 18.00 | 15.86 | 61.33 | 0.118 |
| Flat, factor 0 | 18.00 | Failed at step 29 | — | — |
| Hairpin 0.25 | 13.80 | 12.42 | 293.14 | 6.337 |
| Hairpin 0.40 | 11.29 | 10.26 | 222.83 | 6.705 |
| Hairpin 0.55 | 8.78 | 6.18 | 455.23 | 5.562 |
| Hairpin 0.70 | 6.28 | 27.05 | 304.73 | 20.787 |
| Hairpin 0.85 | 3.83 | 7.93 | 215.47 | 20.804 |
| Hairpin 1.00 | 1.60 | 5.90 | 323.32 | 98527.759 |

The completely flat pose failed with an OGC degenerate face at step 29.
The nearly closed hairpin already had 645.36% maximum extension after step 1
and its gap rebounded to 4.89 mm. A small initial sewing-line gap is not
evidence of stable closure or nonintersecting material. Even the numerically
closest hairpin misses the independent 2 mm criterion and fails strain and/or
residual gates.

## Source decision

The source default retains a restrained quarter-arc arrangement. The tighter
hairpin idea remains behind the explicit development-only environment setting
EXO_UNVALIDATED_TUCK_HAIRPIN_PREFOLD=1 and is disabled in normal operation.
Never enable it in the installed app or treat its output as production evidence.
Both poses preserve original 2D UV, mass, contour, rest area and seam metadata.

## Remaining work

Physical parity needs a properly controlled mountain/valley fold direction,
regularized curvature and layering, local self-contact handling around stitched
fold surfaces, and a simultaneous 2 mm seam-gap / low-strain / finite-residual
gate. Rebuild source on adequately provisioned storage and independently test
50-step isolated and on-avatar fixtures, undo/redo, save/reopen and installed
application behavior before advancing parity. No manufacturer approval exists.
