# EXO Foundation Tee: six-size real Rust workflow QA — 2026-11-15

**Verdict: Engineering integration smoke PASSED. Production-accurate / physical garment fit / factory release FAILED.**

Source: EXO public Git `981f6598e833425a5a27b94cb2737f939a90a324` plus the four scoped first-party integration changes and an isolated test runner in this candidate. Binaries: source-built and independently hash-verified from the November 14 Mac public candidate. See [machine-readable evidence](EXO_FOUNDATION_TEE_SIX_SIZE_E2E_QA_20261115.json).

This run exercised actual EXO garment/size/DXF/techpack routines, the real native C++ exporter and a separate native Rust `exo-session` process using the CC0 MakeHuman mannequin. **It was a Node/Rust RPC test, not a fully clicked macOS GUI acceptance or independently verified physical garment.** The original installed app and user documents were not changed.

## Passes and measured outputs

- Actual EXO source: one **four-panel** front/back/left sleeve/right sleeve tee, **14 actual seams**, **8 matched source notch stations**, including 4 double-notch records, **38 per-edge seam allowances**, 4 paired notch seams and distinct XS–XXL graded 2D outlines.
- All six EXO pattern grades had increasing chest half width, valid positive body length and **under 0.5%** source seam-length mismatch. Construction DXF with `SA_` and manufacturing-mode DXF with `CUT_`/`STITCH_`/`NOTCH_`/`GRAIN_` were generated and parsed for each size, with unit label and finite coordinates. Their external CAD/cutter interpretation is **not** proven.
- The actual C++ native converter produced four authored polygon panels and 14 sewn edge references. A **source-scoped** Rust workspace adapter enriches those with numerical seam-allowance metres, physical notch station/depth and reversed-side sewing correspondences. It does not rewrite the generic C++ converter and cannot encode the source `double` notch type as a full cutter mark.
- One persisted authoritative **Rust six-size grade catalog** accepted all six different geometries while preserving original seam/panel IDs and fixed template metadata; all six had 14 valid native sewn-seam pair reports and six native CUT/allowance reports. The maximum rest-length seam mismatch remained below **5 mm**.
- Native Rust grade Undo→Redo and stale-revision rejection passed; **a separate newly spawned Rust process cold-reopened the saved project and verified persisted Undo→Redo works after restart**, with unchanged source geometry, identical six-size grade catalog and sewn-seam audit. Native-linked history crash/recovery regressions were checked separately.
- Each of XS, S, M, L, XL, XXL compiled to a different real 3D mesh and completed **3 consecutive CPU solver steps** with collision checks enabled, after a reversible **opt-in** initial pose that separates left/right sleeves by 22 cm along Z. This changes no 2D material coordinates, seam IDs, allowances, or original front/back placement.

## 3D physics: bounded smoke pass, quality and fitting fail

| Size | Native triangles | Max rest seam mismatch (mm) | Step 3 maximum physical seam gap (mm) | Step 3 peak strain (%) | 3/3 CPU steps | Provisional quality |
|---|---:|---:|---:|---:|---|---|
| XS | 3,173 | 1.884 | 1106.677 | 439.643 | **PASS** | **FAIL** |
| S | 3,390 | 1.880 | 1106.286 | 330.048 | **PASS** | **FAIL** |
| M | 3,619 | 0.119 | 1082.126 | 338.827 | **PASS** | **FAIL** |
| L | 3,893 | 2.013 | 1099.019 | 438.284 | **PASS** | **FAIL** |
| XL | 4,045 | 2.610 | 1128.089 | 432.256 | **PASS** | **FAIL** |
| XXL | 4,308 | 3.203 | 1124.005 | 402.350 | **PASS** | **FAIL** |

**Interpretation:** Rest-pattern sewing lengths are matched within a few millimetres, but **3D physical garment seams remain over one metre apart after three steps**. These are distinct measurements. The simulation currently stretches fabric beyond plausible sample acceptance. Engineering triage uses provisional **10 mm seam-gap** and **30% peak-extension** limits only to detect that this experiment is nowhere near accepted; real fabric thresholds require calibration and expert approval. `minimumDistanceMm` includes near-zero contact distances; no exhaustive swept CCD / multi-frame body/self-penetration acceptance exists.

**Negative baseline:** with the original unmodified sleeve placement, the real Rust OGC solver rejects its first step on a genuine triangle intersection, rather than returning a false success. The opt-in staging is a bounded first-step collision precondition, **not a physical-sewing/fit solution**. Tests over 3 frames remain much too short to qualify stability, motion or long-term energy/strain.

## Safety and source-change scope

- `integrations/clothcraft/foundationTeeOffbodyStaging20261115.mjs` is **opt-in** (`initialPlacementPreset: "offbody-foundation-tee"`). It clones the supplied EXO tee and separates only the initial left/right sleeve Z values. No automatic migration of saved projects or original user garment data.
- `integrations/clothcraft/sourceTeeCutMetadata20261115.mjs` transfers authored per-edge seam allowance and notch arclength to a cloned native `GarmentTemplate`, with source/edge checks and a refusal of unqualified factory approval. Generic unknown documents continue through the original path.
- `integrations/clothcraft/sixSizeTeeNativeCatalog20261115.mjs` produces the single persistent Rust grade catalog; its six graded native polygons preserve panel/seam IDs, and cubic handles follow Rust`s required 1/3–2/3 displacement rule.
- `integrations/clothcraft/workspace.mjs` includes a **fail-closed** native same-project reopen generation repair. Only an input byte-/value-equivalent to the current saved native project may rebase to the *newer* exact current generation, and no authored fields may change in that process. Third-party/old journal mismatches still reject.
- `scripts/qa-foundation-tee-six-size-workflow-20261115.mjs` is the reproducible test. It creates and deletes its **own disposable workspace**, never the installed app or original garment files. Its full end-to-end check also proves a newly spawned Rust child can cold-reopen and replay durable grade Undo/Redo history. `--require-factory-approval` and `--require-physical-fit` exit nonzero if evidence is incomplete.

## Focused regression tests

- New six-size Rust bridge, original source CUT metadata, staging safety and native generation tests: **5/5 passed**.
- Existing Rust-linked history and native mirror crash/recovery tests: **29/29 passed**, including real Rust process termination and staged-journal recovery.
- Existing native six-size sewn audit (simplified control fixture) passed.
- Original Golden Garments: **150/150 graded-size checks**, 25/25 patterns; EXO four-piece Foundation Tee production-development script passed.
- Eight real connected E2E stages passed with six three-frame Rust CPU steps and a separate real Rust cold-reopen. No physical acceptance claimed.

## Critical blockers to production accuracy

1. Solve the **3D sewing assembly/seam closure** without pathological extension; initial placement alone is insufficient. Long-run coupled OGC/VBD body and self-collision, physical fabric calibration and verified fit on 160/180/200 cm avatars remain necessary.
2. Ensure true 2D/3D live editing after grading can preserve and regenerate native seams, allowances, matched double notches and every manufacturing reference without separate unsynchronized source authority.
3. Draft and test the **separate neckband cut piece**, verify measured fabric shrink/wash and physically sew graded samples.
4. Validate each DXF in an **independent real AAMA/ASTM receiving CAD application**, check cutter-compatible notch interpretation and perform a physical plot ruler/cut and size-by-size tech-pack/BOM/POM receipt.
5. Verify the workflow in the actual newly built Mac UI, save/reopen/Undo/Redo with file dialogs and a clean, source-built native release. Run multiple fabrics, velocities and poses before any commercial claim.

## Reproduce on a development Mac (independent source-built native binaries)

```sh
export EXO_CLOTHCRAFT_REPO="/absolute/path/to/pinned/ClothCraft"
export EXO_CLOTHCRAFT_SESSION_BIN="/absolute/path/to/source-built/exo-session"
export EXO_NATIVE_CLI="/absolute/path/to/source-built/garment_cad_cli"
node --test integrations/clothcraft/foundationTeeSixSizeBridge20261115.test.mjs
node scripts/check-tee-production-development.mjs
node scripts/check-golden-garments-20261028.mjs
node scripts/qa-foundation-tee-six-size-workflow-20261115.mjs
# Fail-closed factory gate (expected non-zero until independent signoff):
node scripts/qa-foundation-tee-six-size-workflow-20261115.mjs --require-factory-approval
```

**No app overwrite, independent lab physical-fit sign-off, industrial receiver approval or commercial garment equivalence is claimed.**
