# EXO ClothCraft V2 — matched native T-shirt sewing / coupled solver comparison

**Date:** 2026-10-21. **Scope:** read-only native CPU Rust VBD/OGC **off-body assembly previews**, running the existing experimental `exo-session` executable against the **two-panel** ClothCraft `tshirt` engineering preset (front and back). This is **not** the actual EXO **four-panel** Foundation Tee (front, back, left sleeve, right sleeve). **No UI changes, no imported third-party solver binaries, no native rebuild, no installed EXO application replacement, and no stored garment edits.** This is not a CLO3D physical-fit certification or deployment.

## Physical baseline and why this experiment exists

The true sewing and contact problem remains severe: this **two-panel engineering preset** starts with **530 mm maximum seam opening**. Prior native Thomas body trials had even larger initial gaps (more than a metre), so claims about detailed cloth physics do not establish that the real EXO four-panel shirt is sewn around the body. Interactive cloth, an off-body staged preview, avatar entry and production fit need separate evidence. Independent EXO four-panel measurements and a stricter principal-strain oracle were added on October 22 in `scripts/qa-exo-four-panel-principal-strain-20261022.mjs`.

The active experimental branch `research/oss/clothcraft-upstream-solver-review-20261020` includes CPU VBD+OGC, strict principal-material-stretch limit, whole-panel translations/rotations, experimental adjacent-fabric seam-block coupling, and a non-mutating `preassemble-preview` command. **These features already existed before this comparison.** Its "coupled" methods borrow VBD/augmented-constraint ideas but do **not** constitute a separately validated complete University of Utah AVBD implementation.

## New reproducible comparison and source change

`integrations/clothcraft/qa-tee-avbd-stage-comparison-20261021.mjs` is a new lightweight native comparative QA harness. It launches one **existing** `research/oss/clothcraft/target/debug/exo-session` CPU process with the CC0 MakeHuman OBJ, opens one T-shirt preset, captures its original revision, positions and clock, and runs **three disposable previews** with identical strain limit and identical 20 dynamic VBD steps. It checks the original native project snapshot is byte-identical after **each** trial, bounds principal material extension at 5%, rejects any preview claiming a completed avatar-entry or swept-CCD certificate, checks accepted best state never exceeds the terminal seam gap, and records max-gap/RMS/contact-rejection counters.

The script calls **no save operation**, because the full save/round-trip test currently fails with `No space left on device (os error 28)` on the Mac. That missing evidence is visibly `saveRoundTripChecked:false`; successful read-only snapshot checks are not a substitute for persisted file round-trip integrity. Standard, stricter `integrations/clothcraft/qa-offbody-preassembly-preview-20261021.mjs` keeps the actual save test by default; `EXO_OFFBODY_SKIP_SAVE=1` is an opt-in disk-safe diagnostic flag only.

Run: `npm run qa:tee-stage-compare` (research mode, not default CI). Running a native process does not modify the user's installed EXO application. Source file and tool versions must be included in any future comparative CI capture.

## Measured results in one matched real executable trial

Same real native binary, same T-shirt and initial positions, `strainLimitPercent=5`, `steps=20`, CPU with two Rayon workers. The extra pre-registration work makes this an accuracy-versus-compute comparison, **not** equal-work speed benchmarking.

| Experimental candidate | Initial max gap | Final max gap | Final seam RMS | Principal max extension | Time of native preview* |
| --- | ---: | ---: | ---: | ---: | ---: |
| A — constrained VBD, 20 steps | 530.00 mm | **420.472758 mm** | 337.953445 mm | 5.00000001% | 10.20 s |
| B — 40 rigid panel registrations + 20 VBD steps | 530.00 mm | **232.930730 mm** | 153.065960 mm | 5.00000001% | 8.10 s |
| C — 40 rigid + 10 nonrigid registrations (1 sweep, 2 fabric rings) + 20 VBD steps | 530.00 mm | **230.229039 mm** | **146.905100 mm** | 5.00000001% | 9.20 s |

*Times are **single, uncontrolled local wall observations**, do not show an overall speed gain or offer paired CPU warm/cold effects. Candidate C performs extra registration operations; elapsed times are not a like-for-like numerical throughput benchmark.*

Relative to A, C reduces measured maximum seam gap by **190.243719 mm** (approximately **45.25%**) and reduces the RMS by about **191.048345 mm** (**56.53%**). Both metrics remain physically unacceptable. Compared with the more economical B, C's additional registration improves maximum opening by only **2.701691 mm** while reducing RMS by **6.160860 mm**, so a user-facing default cannot be chosen on numerical aesthetics alone.

All three run previews explicitly returned `committed:false`, `avatarReentryValidated:false`, `sweptContactCertified:false`, `stagedAvatarEndpointChecked:true`, and the origin garment state/revision/time **unchanged**. No garment was marked factory-approved or physically collision-certified.

### Why the apparently more powerful coupled solver still fails

On C, the off-body nonrigid registration attempted **40** local coupled blocks and accepted **38**. However, in the subsequent physical VBD timeline the solver attempted **80 dynamic coupled blocks** and accepted **zero**: all **1,280** backtracked nonrigid trial candidates failed the **strict principal-stretch inequality**. No candidates failed the seam energy, worst-gap or endpoint contact guards in this run. This is direct solver telemetry and isolates the operative blocker: the proposed coupled direction is no longer feasible at the 5% material limit once VBD has saturated the available material strain.

Prior isolated research showed projecting this direction into the linearized principal-strain tangent cone can unlock some accepted updates **without improving** either max-gap or RMS results. Therefore simply weakening the strain gate, increasing iteration count, or labeling the method "AVBD" does not solve the physical problem. A new truly feasible, contact-aware, seam-improving **developable/foldable multi-panel direction** is required.

## What can safely be implemented next, in order

1. **Objective instrumentation and feasible candidate search:** For an identical frozen garment, log actual seam endpoint correspondence and each panel's gap/strain/contact restriction. Optimize a global merit function with independent max-gap *and* RMS boundaries, pinned vertex invariants, principal stretch inequality, and endpoint collision oracle before accepting an update. Use the existing two-panel rotation fixture as a low-cost proof; reject apparent progress that just redistributes seam error.
2. **Developable bending degrees of freedom:** Extend the current experimental `research/oss/clothcraft-upstream-solver-review-20261020/src/vbd/seam_blocks.rs` / `strain_limit.rs` beyond whole-panel rigid motion and overstretching vertex proposals. Build measured rest-length-preserving local bending/hinge parameterization with safe line search. Validate new proposals against identical 2-panel and 4-panel T-shirt fixtures; do not promote under an incompatible contact law.
3. **Couple collision and seam constraints:** Stop treating body wrapping as a late correction. Evaluate real cloth-to-cloth/cloth-to-avatar triangle contacts in every intermediate stage and compare against the OGC endpoint oracle; verify no unresolved initial collisions. Complete **swept continuous collision detection** for the re-entry path before transferring an off-body pose onto the avatar.
4. **Match the real textile and garment:** Validate seam length/correspondence, actual T-shirt 2D patterns, avatar scale/pose and calibrated warp/weft/bending/friction properties. A generic 5% principal-strain ceiling is a conservative experiment, not a universal factory material law.
5. **Compile, replay and promote only with gates:** Run long 200/1000-step tests, exhaustive triangle-intersection audits and matched before/after native performance A/B/B/A. Keep existing native app/UI and solver active until a new backend achieves a provisional **maximum seam gap under 10 mm**, independently verified avatar entry and repeatable simulation quality.

## Blockers, permissions, and quality status

- **Disk:** Mac data volume approximately 1.1–1.3 GiB available and reports **100% capacity**. Full save returned `ENOSPC`; established native compile safety floor is at least 8 GiB. No uncontrolled `cargo build`, backup cleanup, installer replacement, or deletion of user garments/project states was attempted. Earlier offload procedures require cryptographic verification of recovered backup sources, not speculative cache deletion.
- **Native physics:** The source-only isolated coupled solver exists, but **none** of the candidates has passed the whole-shirt closure gate or the full-avatar approach/continuous-contact gate. No third-party AVBD source was copied or merged here.
- **Persistence:** Current read-only native snapshots passed, but a filesystem save verification remains **blocked**, not PASS, until there is safe headroom.
- **Release:** **NOT READY**. No Git commit or remote push was performed as part of this comparison, and the user's installed EXO ClothCraft V2 or garments remain unchanged.

**Summary:** A matched benchmark and non-destructive disk-safe QA path are now implemented and passing. Best measured off-body gap fell to **230.229 mm**, from the controlled default **420.473 mm** after the same 20 dynamic steps. The true native 1:1 garment-fitting problem remains unsolved; strict coupled dynamic motion is blocked by material feasibility and full swept contact validation. This is a concrete diagnostic milestone, not a completed fix.
