# EXO ClothCraft V2 — resumable native T-shirt solver research loop

**Date:** October 22, 2026. **Scope:** local experimental research using the *pre-existing* native Rust VBD/OGC executable. No UI changes, native builds, external source vendoring, garment edits, solver promotion, installed app replacement or GitHub pushes.

## Implementation and how to resume

- Script: `integrations/clothcraft/qa-tee-solver-iteration-loop-20261022.mjs`.
- Run: `npm run qa:tee-iteration-loop`, `EXO_TEE_LOOP_MAX_TRIALS=3 npm run qa:tee-iteration-loop` (the maximum is **6** per invocation), or `node integrations/clothcraft/qa-tee-solver-iteration-loop-20261022.mjs --dry-run`.
- Frozen checkpoint: `docs/qa/clothcraft-tee-loop-20261022.json`, approximately **4.9 KB**, tracks completed experiments, SHA-256 native executable, exact candidate-grid version and numerical outcomes. A changed executable/candidate grid **fails** instead of silently mixing incompatible results.
- Research trials use the same `tshirt` preset, 20 dynamic CPU VBD steps and a 5% principal-fabric-extension ceiling. They vary *only* off-body rigid/nonrigid registration. There are ten numbered configurations, all bounded. Normal invocation runs up to three configurations and at most 180 seconds; there is no unsupervised local infinite process.
- The loop refuses to run experiments if physical disk available is **below 1 GiB**. The Mac currently has approximately **1.7 GiB**, still insufficient for the earlier **8 GiB** native build safety floor. No cargo/compiler or application packaging action is included.
- Every trial must report an off-body staging-only result, unchanged original positions/time/revision, finite seam metrics, proper 5% strain bound, and flags **`committed:false`**, **`avatarReentryValidated:false`**, **`sweptContactCertified:false`** before its metrics are checkpointed.
- The preview never invokes `save`. Persistent save round-trip is explicitly **not verified** because the previous verification hit `ENOSPC`; no user-owned garment data or avatar meshes appear in the checkpoint.
- All ten cases were run and checkpointed; rerunning now is a **no-op** with `completed:10` unless a new *versioned* set of experiments is created after an independently testable code improvement.

## Complete first-loop results (same existing experimental native executable)

| Case | Final max seam gap (mm) | Final seam RMS (mm) | Accepted nonrigid registration | Accepted dynamic nonrigid | Runtime for single preview, ms* |
| --- | ---: | ---: | ---: | ---: | ---: |
| VBD 20 reference, no registration | 420.472758 | 337.953445 | 0 | 0 | 5327 |
| Rigid registration 40 + VBD 20 | 232.930730 | 153.065960 | 0 | 0 | 6389 |
| Rigid 40, nonrigid registration 10, two rings, one sweep | 230.229039 | 146.905100 | 38 | 0 | 7268 |
| Rigid 40, nonrigid 20, two rings, one sweep | 230.230674 | 146.724915 | 43 | 0 | 7391 |
| Rigid 40, nonrigid 20, one ring, one sweep | 231.017395 | 148.323462 | 43 | 0 | 7267 |
| **Rigid 40, nonrigid 10, two rings, two sweeps** | **229.887806** | **146.608634** | **49** | **0** | **7562** |
| Rigid 30, nonrigid 20, two rings, one sweep | 276.048295 | 191.081731 | 48 | 0 | 7233 |
| Rigid 40, nonrigid 15, two rings, two sweeps | 229.887806 | 146.608634 | 49 | 0 | 7559 |
| Rigid 20, nonrigid 20, two rings, one sweep | 324.156657 | 240.400290 | 45 | 0 | 7365 |
| Rigid 40, nonrigid 20, two rings, two sweeps | 229.887806 | 146.608634 | 49 | 0 | 7875 |

*Single sequential-run timings are **uncontrolled**, not equal-work measurements; extra registration takes computation, and no production frame-rate gain is certified.*

Every case began at a **530 mm** maximum seam opening. The strongest measured configuration reduced the final gap by **190.585 mm (45.33%)** versus the unregistered 20-step VBD baseline, and RMS error by **191.345 mm (56.62%)**. The three 10/15/20 nonrigid-registration cases using two sweeps converged to exactly identical outputs, so **more registration iterations gave no additional benefit** after saturation.

### Physical invalidity remains

Even the best case's **229.9 mm max gap and 146.6 mm seam RMS** are unacceptable for a sewn T-shirt and over **22 times** a provisional 10 mm closure threshold. The starting pose is off-body. No candidate demonstrates a collision-safe continuous trajectory onto a mannequin, independent triangle-swept CCD, accurate friction/material calibration, approved sewing or factory manufacturing fit.

All candidates with active dynamic coupled blocks recorded **zero accepted dynamic blocks**. Under one sweep the same frozen full-shirt constraint system rejected **1,280 strain-limited line-search trials**; with two sweeps it rejected **2,560**. Additional parameter tuning without a new genuinely feasible strain-preserving bending/seam direction is unlikely to fix this bottleneck.

## Next ENGINEERING loop, not another repeat of solved search

1. Design and test a **local developable/hinge-preserving seam direction** with actual per-panel shape degrees of freedom, not just translations. Prefer an isolated two-panel seam fixture with controlled pins and independently computed principal stretch, and record both max and RMS gap improvements; only then apply to four-panel T-shirt.
2. Check active material constraints in the coupled block before solving: identify blocked triangles and project the direction into a **truly feasible nonlinear trust-region cone**, with physical membrane/bending energy descent. Prior first-order tangent projection made RMS and max gap worse, so it cannot be promoted without repeatable improvements.
3. Establish an independent swept cloth/cloth and cloth/avatar contact oracle for **full trajectories**. Do not call an off-body non-intersecting endpoint a fitted garment.
4. Require **8 GiB or more free** before native compilation and restore full `save` regression; plan 20–25 GiB workspace headroom through verified offloads of explicitly approved historical artifacts. Never remove user garments, source, or installed app to free space.

**Status:** 10/10 research configurations tested, all research safety guards passed, 0/10 physically acceptable, no native solver production deployment. A recurring ChatGPT continuation is configured to inspect the checkpoint and advance to a new code/QA hypothesis on the next run, rather than re-running these ten exhausted settings.
