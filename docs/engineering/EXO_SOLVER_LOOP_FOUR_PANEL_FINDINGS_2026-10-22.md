# EXO ClothCraft V2 — ongoing solver loop and independent four-panel audit

## October 26, 03:47 local continuation — simultaneous sewing-path excursion veto

**Concrete bounded source/test improvement; no new garment pose.** The
research-only simultaneous sleeve-motion admission gate previously checked
maximum/RMS sewing gap at the terminal candidate but not at the intermediate
sampled motion states. A fabricated candidate with both endpoints below the
original sewing gaps and a halfway maximum gap above the original was admitted.
The new `simultaneous_seam_gap_excursion` veto compares **both** maximum and
RMS gap at all three prescribed samples against the original sewing baseline
(1e-6 mm numerical tolerance). It does not certify continuous between-sample
seam behavior, and does not relax any existing strain or collision veto.

**Reproduction and QA:** a targeted regression **failed before** the source
change because the unsafe halfway pose was selected. After the correction,
the new test rejects independent maximum-gap and RMS-gap excursions, accepts
the unchanged clear synthetic path, and verifies exact source-state
nonmutation. The simultaneous, coupled-admission and disjoint swept-contact
suites passed **17/17**, zero failures, in approximately **4.71 seconds**;
source/test syntax and scoped whitespace checks passed. A separate read-only
reviewer passed **2/2** focused tests and **4/4** independently constructed
adversarial controls (maximum-only and RMS-only excursions, tolerance boundary,
clear baseline), with source serialization unchanged. These are research
checks, not a native solver run. Off-sample excursions remain unverified.

**Unchanged real four-panel measurements:** original tee max/RMS sewing gap
**188.452062 / 117.400268 mm**, folded/translated candidate **343.276437 /
144.605395 mm** (both worse); maximum principal extension **7933.803349%**,
compression **89.040793%**; candidate **3** same-panel intersections and
**64** inter-panel near-clearance warnings. Static/swept contact fail and
physical acceptance remains **rejected**. Real-case research evaluation took
approximately **4.42 s**, with source-state nonmutation confirmed. The new
sewing-path veto is also triggered on this already-rejected candidate.

**Native/storage preflight:** saved two-panel checkpoint **10/10 complete**;
existing binary SHA-256
`c6941b0a904f80fa34f987534b0d2401c6c42922a69ffa05d8711847eb085fc0`
differs from frozen checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Available disk approximately **0.38 GiB**, below the **1 GiB** research
experiment floor and **8 GiB** native-build floor. No native batch, repeat,
build, cleanup, cache deletion, installation, reset, garment save, UI change,
branch change, commit or push. Calibrated coupled bending/contact, deformable
CCD, avatar entry and CLO3D parity remain unverified.

## October 26, 02:33 local continuation — sparse-vector fail-open closed

**Concrete bounded source/test correction; no new garment pose.** The
research-only simultaneous sleeve admission gate previously accepted a
synthetic candidate with the middle coordinate deleted from all three motion
vectors (`translationM`, `optimized.selectedTranslationM`, and
`simultaneous.translationM`). `Array.prototype.every` and `some` skip sparse
array holes, while `Math.hypot(...sparseVector)` returns `NaN`; the older
`> 0.15` magnitude comparison did not reject that `NaN`. A pre-fix isolated
reproduction returned the forged candidate ID with **zero veto reasons**.
`nativeSleeveCoupledCandidateAdmissionResearch20261025.js` now requires each
of the three vector coordinates to be an own finite value, and its stronger
data-only array guard rejects holes and arrays exceeding a 4,096-element
research input budget. The older staged rank and stronger simultaneous rank
both reject the reproduced missing-coordinate case. The new regression also
checks individually sparse vectors, a missing middle motion sample, and
source-state nonmutation. No contact exemption or physical acceptance was
added.

**QA:** focused coupled-admission, disjoint-swept-contact and simultaneous
gate suites **16/16 PASS**, zero failures, approximately **3.79 s** runner
wall time. Source/test syntax checks passed. The real detached right-sleeve
simultaneous diagnostic took approximately **3.62 s** in this uncontrolled
observation, not a production solver benchmark. An independent read-only
reviewer reproduced rejection of holes in the staged entry/optimized vectors,
all three simultaneous vectors, a sparse candidate array, and inherited
vector coordinates. Their final sparse/accessor/Proxy focused check passed
**2/2** in approximately **139 ms**. The staged gate intentionally does not inspect the
simultaneous-only vector; the simultaneous gate does. No remaining
missing-coordinate acceptance bypass was reproduced.

**Unchanged physical measurements:** original tee maximum/RMS sewing gap
**188.452062 / 117.400268 mm**, prior folded/translated right-sleeve
candidate **343.276437 / 144.605395 mm** (both worse); maximum principal
extension **7933.803349%**, compression **89.040793%**; candidate **3**
same-panel intersections and **64** inter-panel near-clearance warnings.
Static and swept contact fail; physical acceptance is **rejected**. The
source garment, detached research fixtures and installed application were
not mutated.

**Native/storage preflight:** saved two-panel grid remains **10/10 complete**.
Current executable SHA-256
`c6941b0a904f80fa34f987534b0d2401c6c42922a69ffa05d8711847eb085fc0`
does not match frozen checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Free disk fluctuated around **0.34–0.41 GiB**, below both the **1 GiB**
research batch floor and **8 GiB** native-build floor. No native trial,
build, repeated candidate, cache deletion, cleanup, installation, reset,
garment save, UI change, branch change, commit or push occurred. Calibrated
coupled seam bending, contact, deformable CCD, avatar entry and CLO3D parity
remain unverified.

## October 26, 01:34 local continuation — contradictory staged motion blockers veto admission

**Small source/test correction, no new pose:** the legacy staged sleeve admission
screen previously trusted `coupledInterpanelIntervalClear: true` even when the
same fold or translation interval retained a non-null `blocker`. Because the
stronger simultaneous gate inherits the staged verdict, a fabricated staged
clear/blocker contradiction could be screened as eligible when its other
synthetic evidence passed. `nativeSleeveCoupledCandidateAdmissionResearch20261025.js`
now vetoes contradictory blockers in the fold's three active intervals, the
single fold interval, and the optimized translation's three active intervals.
No collision exclusion or physical approval was introduced.

**Independent QA:** new negative controls for all three blocker locations
passed, including exact input nonmutation. The updated simultaneous gate
suite passed **7/7** in approximately **2.94 s**; separate coupled-admission
and disjoint-swept-contact suites passed **8/8** in approximately **2.13 s**.
Source/test syntax checks passed; an unrelated pre-existing report line still
has trailing whitespace. The real right-sleeve candidate
remains rejected: original max/RMS gap **188.452062 / 117.400268 mm** versus
candidate **343.276437 / 144.605395 mm**; maximum principal extension
**7933.803349%**, compression **89.040793%**, **3** same-panel intersections,
**64** inter-panel near-clearance warnings, and failed static/swept contact.
No new native solver runtime measurement was taken; the observed **2.81 s**
real-case diagnostic is research-only. Source nonmutation passed.

**Preflight:** frozen two-panel checkpoint is **10/10 complete**; binary hash
`c6941b0a904f80fa34f987534b0d2401c6c42922a69ffa05d8711847eb085fc0`
differs from checkpoint `1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Free space was only about **0.35 GiB** (approximately 368,000 KiB), below the
1 GiB native experiment floor and 8 GiB native-build floor. No native batch,
build, cleanup, deletion, installation, UI/garment change, reset, commit or push.
Coupled feasible assembly, adjacent-hinge continuous collision safety,
avatar entry and CLO3D parity remain unverified.

## October 26, 00:37 local continuation — complete disjoint-sweep root-pair accounting

**Research-only source-level correction:** the simultaneous candidate gate
previously admitted a fabricated clear swept-contact report with **14,814**
disjoint face pairs, **6,400** broadphase-pruned pairs and just **one** triangle
distance evaluation, without any evidence accounting for the other **8,413**
pairs. Triangle distance evaluations are not equivalent to unique root pairs:
one root pair may be recursively evaluated many times, or cleared by a
midpoint bounding-box check without a triangle distance evaluation. The
disjoint-sleeve interval producer now separately counts `rootCheckedPairs`
for every non-pruned root pair entering the bounded interval checker. The
simultaneous admission gate requires `prunedSweptBounds + rootCheckedPairs ==
disjointPairs` before accepting a **clear** report; blocked reports may have
partial work, but never pass admission. Negative, missing, excessive and
contradictory counts are rejected. Existing tests were expanded for producer
invariants and forged-clear evidence; no collision exemptions were added.

The actual detached right-sleeve simultaneous-motion contact witness remains
faces **97/101** at path fraction **0.5**, **0.584016 mm** separation. Because
the checker stops useful narrowphase work after finding a blocker, its real
blocked report has **14,814** disjoint pairs, **6,411** broadphase prunes,
**5,572** checked roots and **79,471** recursive triangle-distance evaluations;
the remaining roots are **not certified**. The blocked candidate remains
rejected, as does the original four-panel garment. No new pose was solved.

**Unchanged physical metrics:** original max/RMS seam gap **188.452062 /
117.400268 mm**; existing right-sleeve folded/translated candidate
**343.276437 / 144.605395 mm** (both worse). Full-tee principal extension
**7933.803349%**, compression **89.040793%**; candidate same-panel
intersection warnings **3**, inter-panel near-clearance warnings **64**;
static and simultaneous contact **failed**. Physical acceptance remains
**rejected**. The final focused three-suite QA passed **12/12** tests in
approximately **6.41 s**, with a prior producer/admission two-suite check
**9/9** in approximately **3.31 s**. Independent read-only QA reproduced the
original **8,413-pair** omission, then verified the patched forged-clear
rejection, valid exhaustive accounting and partial blocked-case veto;
its independent focused suite passed **5/5**. Syntax, whitespace and
source-state nonmutation checks passed. The final real-case admission test
took approximately **2.82 s**
in an uncontrolled observation, not a production-solver benchmark.

**Preflight:** frozen native candidate grid **10/10 complete**; existing binary
SHA-256 `c6941b0a904f80fa34f987534b0d2401c6c42922a69ffa05d8711847eb085fc0`
does not match checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Free space was approximately **1.35 GiB** on the latest observation, below
the **8 GiB** native-build floor. No native batch, completed-candidate repeat,
build, cleanup, installed-app change, garment save, reset, commit or push.
Continuous deformable/adjacent-hinge CCD, calibrated coupled constraints,
avatar entry and CLO3D parity remain unverified.

## October 25, 23:34 local continuation — simultaneous seam/contact candidate admission

**Source-level integration, research only:** extended
`src/core/backends/nativeSleeveCoupledCandidateAdmissionResearch20261025.js`
with `rankSleeveSimultaneousMotionResearch20261025`, and added
`scripts/qa-exo-sleeve-simultaneous-candidate-gate-20261025.mjs`.
The legacy *two-stage* hinge-then-translation diagnostic ranking is preserved.
The new, separately named ranking refuses to promote its lower-RMS diagnostic
candidate unless coherent **simultaneous** hinge/translation evidence includes
all three prescribed static samples, three active inter-panel motion screens,
the same-sleeve **disjoint-face** swept-contact screen, exact terminal sewing
and principal-strain agreement, bounded particle/face-pair accounting, and
the existing rest-mesh and per-seam vetoes. Missing, contradictory, malformed,
accessor or Proxy evidence fails closed. It always reports adjacent-hinge
swept contact, deformable CCD, avatar entry, material calibration and physical
acceptance as **unverified/false**; evidence is research-reported rather than
independently authenticated production solver output.

**Reproducible false-positive closed in the stronger scope:** an independent
reviewer constructed a synthetic low-RMS candidate whose *two-stage* rank
reported a screened candidate despite a simultaneous mid-path self-contact
blocker. The new ranking instead selects a higher-RMS synthetic candidate
with the required limited simultaneous screens clear. The reviewer also found
that an initial version accepted a fabricated zero-disjoint-work census and
executed caller-defined getters/Proxy traps. These paths were hardened with
nonzero disjoint-face accounting, coherent pruned/evaluated counts, and
data-only/Proxy rejection before ranking; dedicated regressions were added.

**Actual detached four-panel control (not a new pose):** original sewing
maximum/RMS **188.452062 / 117.400268 mm**; right-sleeve 0.2-radian folded
and translated candidate **343.276437 / 144.605395 mm**, both worse.
Principal extension **7933.803349%**, compression **89.040793%**;
**3** same-panel intersection warnings and **64** inter-panel near-clearance
pairs at the candidate endpoint. The simultaneous disjoint-sleeve interval
finds faces **97/101** at path fraction **0.5**, distance **0.584016 mm**;
the sleeve/back interval finds exact **0 mm** contact at fraction **0.9375**.
The rest mesh still has **27** ill-conditioned sleeve faces. Both two-stage
and stronger simultaneous research screens reject this candidate, as does
physical acceptance. No pose, solver, garment, editor or installed app changed.

**QA:** final new + existing candidate/simultaneous focused suites **11/11
PASS**, zero failures, approximately **4.90 s** combined wall time; new source
and test JavaScript syntax passed. Independent numerical seam/strain and
source-state nonmutation assertions passed. The independent reviewer
reproduced the initial adversarial failures, then reran the exact zero-work,
getter and Proxy probes against the patched gate: **3/3 rejected**, with zero
getter/Proxy trap executions; their focused synthetic suite passed **4/4**.
An additional post-guard local synthetic run passed **4/4**. The real-case
new-gate evaluation including detached fixture construction took approximately
**4.09 s** in one uncontrolled run, not a native solver benchmark.

**Preflight:** frozen two-panel grid remains **10/10 complete**, with no
remaining candidates; existing executable SHA-256
`c6941b0a904f80fa34f987534b0d2401c6c42922a69ffa05d8711847eb085fc0`
does **not** match checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Free disk fluctuated under concurrent activity from approximately **1.52 GiB**
to **0.21 GiB** and recovered to approximately **1.51 GiB** without this run
deleting or cleaning anything. Zero native trials/builds, repeated candidates,
installs, branch changes, resets, commits or pushes. The next physical blocker
is a **conditioned sleeve rest mesh** and a calibrated, genuinely coupled
seam-bending/contact solve; adjacent-face swept thickness and avatar entry
remain unverified. No CLO3D parity claim is supported.

## October 25, 09:34 local continuation — bounded post-fold sleeve seam-merit direction

**New research-only source and independent numerical QA:**
`src/core/backends/nativeSleeveFoldedSeamMeritResearch20261025.js`
and `scripts/qa-exo-sleeve-folded-seam-merit-20261025.mjs`.
The study starts from the actual detached, crease-conforming **0.35-radian**
developable sleeve-fold result, then solves the exact 3-axis least-squares
rigid translation of that folded sleeve against all authored direct and
weighted virtual sewing correspondences. It limits translation to **0.15 m**,
evaluates five bounded fractions, checks all **102 sewing pairs / 14 groups**,
and independently screens the chosen detached candidate's strain, static
same/inter-panel contact, and moving-sleeve vs. each other panel's conservative
translation interval. This is a **sequential fold then translation** research
direction, not a coupled deformable solve, physical trajectory or calibrated
solver integration.

| Actual four-panel metric | Original tee | Left folded | Left + seam step | Right folded | Right + seam step |
| --- | ---: | ---: | ---: | ---: | ---: |
| Maximum seam gap (mm) | 188.4521 | 339.7307 | **339.7307** | 339.7307 | **339.7307** |
| RMS seam gap (mm) | 117.4003 | 155.5110 | **143.9549** | 152.7688 | **143.8481** |
| Principal extension, full tee (%) | 7933.8033 | 7933.8033 | **7933.8033** | 7933.8033 | **7933.8033** |
| Principal compression, full tee (%) | 89.0408 | 89.0408 | **89.0408** | 89.0408 | **89.0408** |
| Contact/physical acceptance | Failed | Failed | **Failed** | Failed | **Failed** |

The new bounded translation lowers folded-pose RMS by approximately **7.43%**
for the left sleeve and **5.84%** for the right, with **zero** individual
seam-group regressions against each *folded* reference. It does **not** improve
the worst seam gap or beat the original tee; **five** sewing groups still
regress against the original authored pose. Chosen translations are
approximately **[+5.26, -98.55, +8.14] mm** (left) and
**[+24.10, -83.13, -2.28] mm** (right). The 3D triangle-edge material
isometry of each folded sleeve is independently checked before optimization;
rigid translation leaves material strain unchanged.

**Contact veto:** both candidates still have **3** complete-garment
intra-panel intersections and **270** nonadjacent intra-panel near-clearance
pairs; inter-panel near-clearance is **149 left / 47 right**. These counts are
for the detached remeshed candidate, not a same-topology solver improvement.
Conservative active-motion interval checks reject left sleeve vs. front and
back, and right sleeve vs. back. Full-body principal extension remains
**7933.803349%** and compression **89.040793%**. Thus both candidates fail
static contact, material strain, and physical acceptance, and remain unsafe
for production promotion.

**QA:** 3 new adversarial/analytic tests and 14 existing hinge,
parameterized-constraint and coupled-interval tests: **17/17 PASS**,
zero failures, approximately **4.09 s** combined. Independent finite-difference
seam residuals verify the closed-form least-squares optimum, exact 102-pair
metrics, translation/isometry, strict source nonmutation, and rejection of
invalid budgets, damaged sewing, unsupported pins, changed original material
provenance, and non-isometric folded inputs. An uncontrolled two-sleeve
evaluation took approximately **2.1–2.2 s**, including the prior remesh/fold
construction; no production solver speed claim is made.
An independent read-only adversarial reviewer identified two accepted
malformed-topology controls (reversed folded face winding and missing original
sleeve faces). The new strict source/folded face-count and positive signed
material-area preflight now rejects both, with explicit regression tests;
the final combined 17-test suite still passes. The reviewer independently
reran both exact former bypasses read-only after the fix: **both rejected**,
and the focused new suite passed **3/3**.

**Preflight:** frozen two-panel native grid **10/10 complete**; executable
SHA-256 `8256ccda544abe3cd348fac6e37e7518e3222e39e4442b1da3641a541298279e`
still differs from checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Disk approximately **2.30 GiB free**, below the 8 GiB native-build floor.
**Zero native trials/builds or repeated candidates.** Existing UI, saved
garment, installed apps, branches, and unrelated worktree changes untouched;
no reset, cleanup, deletion, install, commit or push. All output acceptance
flags explicitly remain false, including calibrated constraints, continuous
deformable CCD, avatar entry and safe auto-application.

**Next:** jointly optimize fold angle and rigid seam-merit direction with
contact constraints and a repaired rest mesh; independently validate any
candidate against the real solver's calibrated bending/strain law before
attempting production integration. Neither safe avatar entry nor CLO3D
parity has been demonstrated.

## October 25 morning continuation — actual sleeve developable-hinge candidate and contact rejection

**New bounded, detached research implementation:**
`src/core/backends/nativeSleeveDevelopableHingeCandidateResearch20261025.js`
with independent adversarial QA in
`scripts/qa-exo-sleeve-developable-hinge-candidate-20261025.mjs`.
This is the first use of the *actual* 112-vertex, 178-triangle crease-conforming
Foundation Tee sleeve to construct a material-isometric 3D planar reference
and a prescribed **0.35-radian crease fold**, rather than merely inventorying
hinges or analyzing a synthetic fold. The algorithm derives a deterministic
3D axis/frame from original sleeve material/world correspondences, retains all
original sewn particle IDs, appends only 17 detached research particles per
tested sleeve, and tests the full 102 sewing correspondences across 14 groups.
It also screens static same-panel and inter-panel contact at three poses and
conservative inter-panel motion intervals, including **separate moving-sleeve
vs. each other panel** checks so an unrelated stationary-panel collision cannot
hide the active sleeve's first witness. Neither the real solver constraints
nor the saved garment are modified.

| Actual four-panel pose | Original authored | Left sleeve planar / folded | Right sleeve planar / folded |
| --- | ---: | ---: | ---: |
| Maximum sewn gap (mm) | **188.4521** | 345.0000 / **339.7307** | 345.0000 / **339.7307** |
| RMS sewn gap (mm) | **117.4003** | 154.8854 / **155.5110** | 154.8854 / **152.7688** |
| Maximum principal extension, full tee | **7933.8033%** | **7933.8033%** | **7933.8033%** |
| Maximum principal compression, full tee | **89.0408%** | **89.0408%** | **89.0408%** |
| Maximum principal extension, remeshed folded sleeve | 751.535% in prior distorted pose | ~0% | ~0% |
| Folded sleeve self-intersections / near-foldovers | 3 / 3 in prior distorted pose | **0 / 0** | **0 / 0** |
| Folded sleeve nonadjacent near-clearance pairs | 37 in prior distorted pose | **40** | **40** |
| Folded full-tee inter-panel near-clearance pairs | 122 in original pose | **92** | **61** |
| Physical/contact acceptance | Rejected | **Rejected** | **Rejected** |

The developable fold preserves **every remeshed triangle edge length** against
its original 2D material geometry to independent 1e-10 m test tolerance, and
the spectral sleeve extension/compression are below 3e-11% numerically. This
demonstrates a kinematically isometric *detached sleeve* direction, **not** a
feasible assembled tee. Rebuilding the planar sleeve worsens overall sewing
residuals; five individual sewing groups regress in each experiment. Both
sleeves retain **27 poorly conditioned rest triangles**, and the full tee
retains its severely strained body panels. The original authored crease
points deviate by up to **62.732 mm** from the derived rigid hinge line, so
simply rotating the original distorted world-space crease would be invalid.

The independently scoped active-motion interval screen detects an exact
**0 mm sampled collision at path fraction 0.5** between the moving left sleeve
face 20 and back face 106; the mirrored right sleeve collides with back face
80. A whole-tee interval screen also fails due to a pre-existing unrelated
front/right-sleeve collision. These are **prescribed kinematic paths, not
solver trajectories**. Even a cleared rigid interval would not certify
continuous deformable same-panel contact or avatar entry. All candidate
acceptance flags remain false, including material calibration, regenerated
solver constraints, physical fit, and safe automatic application.

**Independent QA:** 3 new tests plus 21 existing parameterized-mass,
contact-topology, constraint-inventory and coupled-interval tests:
**24/24 PASS, 0 failures**, approximately **3.46 seconds** combined. Tests
independently recompute 3D triangle-edge lengths, signed Rodrigues rotation,
stationary-side invariance, translation, 102 original sewing references,
negative malformed-input/pinned-sleeve cases, and byte-for-byte source and
detached-mesh nonmutation. Source syntax and Git whitespace checks passed.
Two full sleeve candidate studies took approximately **0.89 and 0.72 seconds**
in uncontrolled sequential observations; no production runtime gain is claimed.

**Native/disk preflight:** the separate two-panel candidate grid remains
**10/10 complete**, and the pre-existing binary SHA-256
`8256ccda544abe3cd348fac6e37e7518e3222e39e4442b1da3641a541298279e`
still differs from the frozen checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
The read-only loop dry-run correctly fails closed. Available disk fluctuated
between approximately **1.82 and 2.31 GiB** during the run, below the 8 GiB
native-build safety floor.
No native trials/builds, saved-garment edits, app/UI changes, cleanup,
installations, resets, branch changes, commits, or pushes were performed.
Next: repair the remaining crease rest-mesh slivers and design a contact-aware
seam-merit direction on the rigidly flattened sleeve; independently validate
the real solver's constraint law before integrating calibrated bending/mass.

## October 25, 07:42 local continuation — hypothetical sleeve mass and XPBD coefficient reconstruction

**New detached research-only source and independent numerical QA:**
`src/core/backends/nativeSleeveRemeshParameterizedConstraintsResearch20261025.js`
and `scripts/qa-exo-sleeve-remesh-parameterized-constraints-20261025.mjs`.
This takes the independently checked crease-conforming sleeve area/contact
inventory and structural/hinge graph and, only when explicitly supplied four
dimensioned **hypothetical** parameters, derives per-vertex kg mass and inverse
mass, 289 edge rest-length/compliance entries, and 245 hinge dihedral/compliance
entries (20 crease hinges) per sleeve. The parameter fields are areal density
(kg/m²), structural stiffness (N/m), hinge stiffness (N·m/rad), and timestep
(seconds). XPBD research coefficients are compliance divided by timestep²;
these are not wired into or calibrated for the production solver. Existing
body-panel anchors are retained; a sleeve pin or soft anchor fails closed
because partial-axis/soft-anchor inverse-mass treatment is not implemented.

For a **hypothetical numerical control only**, 0.2 kg/m² areal density,
1000 N/m edge stiffness, 0.02 N·m/rad hinge stiffness, and 1/60 s timestep
produce **0.0153585 kg per sleeve**, structural compliance **0.001 m/N**,
hinge compliance **50 rad/(N·m)**, and timestep-scaled coefficients **3.6**
and **180000** respectively. Doubling both stiffnesses and areal density
while halving timestep doubles the timestep-scaled coefficients and total
mass, as independently checked. These illustrative inputs are **not measured
fabric properties**; no physically calibrated solver constraints are claimed.

The new detached research study **does not alter the pose**. Existing complete
four-panel tee seam gaps remain **188.452062 mm max / 117.400268 mm RMS**;
the earlier translation candidate is **92.296293 / 60.539759 mm** but is
still rejected. Complete-garment principal extension/compression remain
**7933.803349% / 89.040793%**; detached sleeve principal extension remains
**751.535%**. The sleeve has **3 intersections, 3 near-foldovers and 37
near-clearance pairs**; static contact **fails**, and **zero** collision
exclusions are created. No physical seam/contact/strain improvement is claimed.

**QA:** 3 new independent tests plus 6 existing inventory/area/contact tests,
**9/9 PASS**, zero failures, approximately **1.74 s** combined. Independent
triangle-area integration reproduces vertex masses, rest-edge distances,
theoretical compliance and timestep scaling; invalid parameter values,
unsupported sleeve anchors, broken sewing, and missing crease topology are
rejected. An independent adversarial reviewer additionally reproduced malformed
body-panel anchor metadata being accepted; the new validator now rejects
nonfinite/missing anchor targets, invalid stiffness, axes and type, with
regressions. Hypothetical material-input accessors and hidden extra fields
also fail closed. The two-sleeve parameterized check took approximately
**0.93 s** in an uncontrolled final test. Source payload, detached mesh and material-input
nonmutation assertions passed. A first test attempt exposed real body-panel
anchors and was corrected to reject only sleeve anchors rather than falsely
assuming the whole garment had none.

**Native preflight:** checkpoint remains **10/10 complete**, and the current
binary SHA-256 `8256ccda544abe3cd348fac6e37e7518e3222e39e4442b1da3641a541298279e`
does not match checkpoint `1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Read-only dry-run rejected the mismatch. Disk was approximately **2.53 GiB**
free, below the 8 GiB native-build floor. No trial, native build, app/UI edit,
garment save, reset, cleanup, installation, branch change, commit or push.
Next: obtain independently measured fabric parameters and validate their
mapping to the actual solver's energy/constraint equations; repair remaining
poor mesh faces and static contact before any coupled folding promotion.
Continuous deformable CCD, avatar entry, and CLO3D parity remain unverified.

## October 25, 06:36 local continuation — detached sleeve mass-area and contact-topology preflight

**New bounded research-only source and independent QA:**
`src/core/backends/nativeSleeveRemeshMassContactTopologyResearch20261025.js`
and `scripts/qa-exo-sleeve-remesh-mass-contact-topology-20261025.mjs`.
The new preflight first requires the existing complete provenance, crease,
sewing, strain and static-contact inventory audit to pass structurally. It
then derives **per-vertex rest-material area weights** by one-third of each
incident face area, independently checks conservation against the original
source sleeve triangulation, and classifies *every* same-sleeve face pair
by shared material topology. A corrupted source material area is rejected.
These weights are **m², not kilograms or inverse masses**; no unverified
fabric areal density, stiffness, or solver masses were fabricated.

| Per sleeve, actual Foundation Tee | Original source | Detached research mesh |
| --- | ---: | ---: |
| Vertices / triangles | 95 / 144 | **112 / 178** |
| Rest material area | 0.0767925 m² | **0.0767925 m² (conserved)** |
| Face pairs classified | — | **15,753 / 15,753** |
| Shared-edge pairs requiring foldover awareness | — | **245** |
| Shared-vertex pairs requiring crossing awareness | — | **694** |
| Nonadjacent pairs requiring clearance screening | — | **14,814** |
| Protected crease edge-neighbor pairs | — | **20** |
| Preserved native sleeve sewing constraints | 41 | **41** |
| Static sleeve intersections / near-foldovers / near-clearance | Not remeasured | **3 / 3 / 37** |
| Principal sleeve extension / compression | — | **751.535% / 89.041%** |
| Static contact valid / physically accepted | No / No | **No / No** |

Face adjacency is **not** an unconditional contact exclusion: edge-neighbor
foldovers and vertex-neighbor crossings can be real collisions. The new
classification makes the required narrowphase work explicit; it does **not**
turn off checks or implement a collision-safe production exclusion policy.
The separate existing full four-panel pose remains **188.452062 mm maximum /
117.400268 mm RMS seam gap**, **7933.803% principal extension / 89.041%
compression**, and failed contact. The previous translation-only candidate
remains **92.296293 / 60.539759 mm**, but contact and strain still fail;
neither metric improved in this run. This was a detached topology/area
preflight, **not** a new solved garment pose.

**Independent QA:** three new tests plus eleven preceding sleeve topology,
contact and crease tests: **14/14 PASS**, zero failures, approximately
**2.63 s** combined. Tests independently recompute source/remesh area,
all 15,753 pair classifications, vertex area weights and their normalized
sum, and reject corrupted source area, crease, sewing and interpolation
provenance. Original payload and detached research meshes passed byte-for-byte
nonmutation assertions. The two-sleeve new preflight, including the prior
mesh optimization, took approximately **0.84 s** in one uncontrolled
observation; no controlled solver runtime improvement is claimed. JavaScript
syntax and Git whitespace checks passed.

**Native preflight:** the separate two-panel benchmark grid remains
**10/10 complete**. Current native executable SHA-256
`8256ccda544abe3cd348fac6e37e7518e3222e39e4442b1da3641a541298279e`
does not match frozen checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Disk was approximately **2.52 GiB free**, below the **8 GiB** native-build
floor. No native trial or build was run, and no completed candidate repeated.
No UI/app change, garment save, reset, deletion, cleanup, installation,
branch change, commit or GitHub push occurred.

**Next:** obtain independently calibrated fabric areal density, stiffness,
and pinning/mass treatment; build and validate candidate XPBD constraints
and edge-/vertex-neighbor contact policies without silently excluding
foldovers. Resolve remaining poor triangles and unacceptable strain/contact
before coupled seam-bending promotion. Continuous deformable CCD, safe avatar
entry and CLO3D parity remain unverified.

## October 25, 05:38 local continuation — detached sleeve bending/structural inventory preflight

**New bounded research-only source:**
`src/core/backends/nativeSleeveRemeshConstraintInventoryResearch20261025.js`
with independent geometry/provenance regression suite
`scripts/qa-exo-sleeve-remesh-constraint-inventory-20261025.mjs`.
This inventories **all material structural edges and interior four-vertex
hinges** on the contact-aware crease-conforming sleeve research mesh, with
rest edge lengths, zero planar-rest dihedral and observed world dihedral.
It refuses malformed face winding, degenerate triangles, absent or duplicate
protected crease hinges, changed original particle positions, invalid
generated-vertex interpolation provenance, orphan vertices and incomplete
frozen fixture sewing counts. The 102 native sewing correspondences remain
the source baseline, **not an independently signed manufacturing manifest**.

| Per sleeve | Existing original mesh | Detached crease-quality mesh |
| --- | ---: | ---: |
| Material vertices / triangles | 95 / 144 | 112 / 178 |
| Unique material structural edges | **238** | **289** |
| Interior bend hinges | **194** | **245** |
| Explicit crease bend hinges | Not crease-conforming | **20** |
| Native sewing constraints referencing sleeve | 41 | **41 retained in source** |
| Source sleeve sewing endpoint references | 46 | **46 retained** |

The topology change demonstrates why reusing old structural and bending
constraints would be incorrect. **The new output is an inventory, not a
regenerated, stiffness-calibrated XPBD constraint set.** Mass distribution,
contact exclusions, material stiffness and solver stability have not been
revalidated; flags `solverConstraintsRebuilt`, `stiffnessCalibrated`,
`samePanelContactExclusionsRebuilt`, `continuousContactCertified`,
`physicalAcceptance`, and `safeToAutoApply` remain **false**.

The detached sleeve still has **27 ill-conditioned triangles**, **751.535%
maximum principal extension / 89.041% compression**, **3 intra-panel
intersections**, **3 near-foldovers**, and **37 nonadjacent near-clearance
pairs**. Static contact and principal strain **fail**. The original four-panel
sewing gaps remain **188.452062 mm max / 117.400268 mm RMS**, and the prior
unsafe translation candidate remains **92.296293 / 60.539759 mm** with
**7933.803349%** complete-garment maximum extension, **89.040793%**
compression, and failed contact. No new garment pose or physical seam
improvement was produced. The previous four-panel candidate is still
rejected; avatar entry and continuous deformable collision safety are not
certified.

**Independent QA:** 3 new adversarial/topology tests plus 12 existing
crease/quality/coupled-motion tests, **15/15 PASS** in approximately **2.49 s**.
An independent edge-incidence calculation matched all 289 edges, 245 hinges
and 20 protected crease hinges; missing sewing, corrupt interpolation,
reversed faces and invalid crease edges were rejected. Source payload and
detached research input nonmutation assertions passed. Syntax and Git
whitespace checks passed. One uncontrolled two-sleeve research inventory
observation took approximately **0.81 s**, including prior mesh optimization.

**Native preflight:** saved two-panel grid remains **10/10 complete**;
current experimental executable SHA-256
`8256ccda544abe3cd348fac6e37e7518e3222e39e4442b1da3641a541298279e`
differs from checkpoint SHA-256
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
The read-only iteration dry-run refused this mismatch. Disk had approximately
**2.27 GiB free**, below the 8 GiB native-build floor. **No native trial,
native build, project save, cleanup, deletion, UI/app change, reset,
installation, branch change, commit or push occurred.**

**Next:** validate a bounded candidate constraint *reconstruction* against
the topology inventory and independently audit crease bending energy,
mass/stiffness calibration, same-panel exclusions, seam compatibility and
contact before any native solve. Neither safe avatar entry nor CLO3D parity
has been established.

## October 25, 04:41 local continuation — contact-aware crease edge-flip research

**New detached research implementation:**
`src/core/backends/nativeSleeveCreaseQualityContactResearch20261025.js`
with independent regression suite
`scripts/qa-exo-sleeve-crease-quality-contact-20261025.mjs`.
It starts from the previous 112-vertex/178-face crease-conforming sleeve
preview and performs bounded, independently certified **interior material
edge flips**. Every candidate preserves the crease edges, material boundary,
authored vertex positions and sewing references, source-face lineage, and
material coverage. Candidate flips must strictly reduce poorly conditioned
rest triangles, avoid a worse global maximum aspect/minimum altitude, and
not increase any of the three **static intra-sleeve** contact counts.
This does **not** rebuild physical constraints or solve garment folding.

| Per-sleeve metric | Naïve crease split | Contact-aware flips |
| --- | ---: | ---: |
| Material vertices / triangles | 112 / 178 | 112 / 178 |
| Crease-crossing triangles | 0 | 0 |
| Ill-conditioned rest triangles | **46** | **27** |
| Worst rest aspect ratio | 230.756:1 | 230.756:1 |
| Minimum rest altitude | 0.323 mm | 0.323 mm |
| Static intra-sleeve intersections | 3 | 3 |
| Static intra-sleeve near-foldovers | 3 | 3 |
| Static intra-sleeve disjoint near-clearance pairs | 37 | 37 |
| Principal extension (initial world pose) | 751.535% | 751.535% |
| Principal compression | 89.041% | 89.041% |
| Triangles over 5% extension | 173 | 171 |

Each sleeve accepted **13** local flips after scanning **3,150** bounded
interior-edge proposals and evaluating static contact for **21** candidates.
The two-sleeve research operation took approximately **0.7–0.83 seconds**
in uncontrolled observations. A separately tested unconstrained greedy
edge-flip algorithm improves rest slivers further (**46 -> 26**) but worsens
disjoint static near-clearance pairs (**37 -> 42**); the new contact-aware
screen correctly vetoes that tradeoff. Neither method fixes the worst sliver,
and even the new **27** poor triangles per sleeve should not be mistaken
for a fully repaired mesh. That is **five fewer poor faces** than the original
unsplit sleeve's **32**, but across **178 rather than 144** triangles and
with a much worse worst aspect ratio. It is
**not solver-ready**.

**Crucial complete-garment negative control:** a detached four-panel payload
with both improved sleeves has **534 particles / 836 triangles**. The complete
authored **102** sewing correspondences and their gap metrics remain exactly
**188.452062 mm maximum / 117.400268 mm RMS**. Maximum principal extension
remains **7933.803349%** and compression **89.040793%**; static inter-panel
near-clearance remains **122**. Relative to the original **unmodified**
four-panel mesh, static intra-panel intersections remain **6**, but near
foldovers worsen **44 -> 50** and disjoint near-clearance pairs worsen
**231 -> 303**. Those latter increases are already present in the *naïve
crease split*, and the contact-aware flips do not add to them. Therefore
the new optimization improves **rest quality relative to the split baseline**,
not complete-garment contact validity. Physical acceptance is **REJECTED**.

An independent read-only adversarial review found that the initial generic
optimizer accepted a source T-junction (unused vertex on an existing edge)
and coincident reversed duplicate faces. A source-edge/interior-vertex
preflight, duplicate-face and positive-area material-overlap rejection, and
original/cut-vertex provenance validation were added. Focused regression
tests now reproduce and reject those invalid inputs. The final combined
crease-mesh, coupled-hinge/translation, four-panel contact-gate and new
quality/contact suites passed **20/20 tests**, zero failures, in approximately
**2.47 seconds**; JavaScript syntax and Git whitespace checks passed.
The independent reviewer retested four adversarial invalid previews after
the fixes; all were rejected without input mutation. Every output explicitly
reports `solverConstraintsRebuilt:false`, `continuousContactCertified:false`,
`physicalAcceptance:false`, and `safeToAutoApply:false`.

The frozen **two-panel** native grid remains **10/10 complete**. The current
binary hash `8256ccda544abe3cd348fac6e37e7518e3222e39e4442b1da3641a541298279e`
does **not** match the saved checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
No candidate was repeated; no native experiment or build was attempted.
Disk remained approximately **2.3 GiB free**, below the 8 GiB build floor.
The existing UI, editable garment, installed applications, branches and
unrelated worktree changes were left untouched. No reset, cleanup, deletion,
installation, commit, or push occurred. Full coupled seam bending, acceptable
principal strain, static/swept cloth contact, safe avatar entry, and CLO3D
parity remain **unverified**.

## October 25, 03:41 local continuation — bounded crease-conforming sleeve topology preview

**New research-only source and QA:**
`src/core/backends/nativeSleeveCreaseConformingMeshResearch20261025.js`
and `scripts/qa-exo-sleeve-crease-conforming-mesh-20261025.mjs`.
This constructs a **detached material-space triangle split** along each
authored underarm center crease. Crossing edges share cached intersection
vertices, original local vertex IDs and native sewing endpoints remain intact,
new vertices carry edge interpolation weights and current-world interpolation,
and per-source-face signed area/orientation are checked. Input/source state is
not mutated. The output is explicitly **not a solver-ready native payload**:
new XPBD/strain/bend constraints, self-contact exceptions, and sewing-aware
contact handling have **not** been regenerated or certified. No production
garment mesh, editor, installed app or simulation was changed.
Independent adversarial review found an initial shared-edge winding bypass:
two adjacent source faces could use the same directed edge without rejection.
The final implementation now requires opposite directions on every shared
output edge, and also rejects collapsed world-space triangles; regression
controls for both failure modes pass. A second independent adversarial
probe found an existing source T-junction that generated a duplicate,
coincident but disconnected crease intersection vertex. A bounded
source-edge/interior-vertex preflight now refuses that topology; its exact
reproduction is included in the regression suite.

On each **real** Foundation Tee sleeve, the detached preview splits **20
crossing faces** using **17 shared cut-edge vertices**: **95 -> 112** material
vertices and **144 -> 178** faces; no face straddles the crease at the stated
1e-8 m sign tolerance. The largest per-face material-area discrepancy is
approximately **6.51e-19 m²**. All original vertex positions, particle IDs
and the full **102** authored sewing correspondences remain unchanged.

**Critical negative result:** this naïve crease-conforming split makes rest
mesh conditioning **worse**. At the research strain-element thresholds
(maximum aspect 25, minimum altitude 2 mm), ill-conditioned faces increase
from **32 to 46 per sleeve**; maximum aspect worsens from **32.55 to 230.76**
and minimum altitude falls from **1.290 to 0.323 mm**. The preview must **not**
be promoted into the native solver. Next work needs a quality-constrained
crease-aware retriangulation and regenerated, independently audited physical
constraints before any coupled hinge/translation solve.

The saved four-panel pose and sewing measurements are unchanged:
**188.452062 mm maximum / 117.400268 mm RMS** baseline, compared with the
previous unsafe joint-translation candidate **92.296293 / 60.539759 mm**.
The existing baseline/candidate principal extension **7933.803349%** and
compression **89.040793%** remain unacceptable; baseline/candidate static
inter-panel near-clearance counts **122 / 382**, and both have **6**
intra-panel intersections. **Contact validity and physical acceptance fail**.
The new split preview was not passed off as a fresh physical simulation or
new seam/strain/contact improvement. Uncontrolled two-sleeve topology
preview observations took approximately **13–34 ms**.

Focused QA of the final topology plus existing coupled, hinge-interval,
translation and angle-path suites: **27/27 tests passed**, zero failures,
approximately **1.17 s** final runner wall time. An independent synthetic square
control verified shared cut-edge reuse, signed area and world-space edge
interpolation. Adversarial malformed geometry and resource budgets fail
closed; source-state nonmutation, JS syntax and whitespace checks passed.

The frozen two-panel native grid remains **10/10 complete**. Current native
executable SHA-256 `8256ccda544abe3cd348fac6e37e7518e3222e39e4442b1da3641a541298279e`
**does not match** checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`;
the resumable dry-run preflight refused the mismatch. Available storage was
approximately **2.56 GiB**, below the **8 GiB** native-build floor. **Zero**
native trials/builds or repeated candidates; no cleanup, reset, cache purge,
install, commit or push. Continuous deformable CCD, avatar entry, physically
feasible sewn assembly and CLO3D parity remain unverified.

## October 25, 02:37 local continuation — full four-panel coupled-motion veto

**New research-only source:**
`src/core/backends/nativeFoundationTeeCoupledMotionGateResearch20261025.js`
with independent QA at
`scripts/qa-exo-foundation-tee-coupled-motion-gate-20261025.mjs`.
This composes the existing conservative inter-panel hinge/translation
interval screen with **all 102 authored sewing correspondences across 14
groups**, principal stretch and compression, rest-mesh conditioning, pinned
vertex checks, and independently recomputed intra/inter-panel **static**
contact at 0%, 50%, and 100% of a prescribed path. The sampled pose payloads
are detached; no source project, native payload or motion input is modified.
All budgets and sample fractions are bounded. Neither the research-only
gate nor a static-clear pose certifies continuous self-contact, hinge
thickness, avatar collision, avatar entry or production fitting.

**New independently verified rejection reason:** the prior joint rigid
translation improves overall maximum seam gap from **188.452062 to
92.296293 mm** and RMS from **117.400268 to 60.539759 mm**, but **both
side-seam groups regress**: `seam-side-l` and `seam-side-r` each worsen
their maximum gap by **79.911574 mm** and RMS by **79.901177 mm**. The
new composed gate therefore rejects the candidate on per-group merit in
addition to its known contact and strain failures. Independent particle
distance calculations reproduced the 102-sample overall seam metrics.

The three sampled poses have inter-panel exact near-clearance pair counts
**122, 374, 382** and **six intra-panel intersections at every pose**.
Maximum principal extension is **7933.803349%**, compression
**89.040793%**; the unchanged rest mesh has **192/768** ill-conditioned
triangles. The conservative interval checker independently finds front face
17 against back face 17 at fraction **0.875**, with exact **0 mm** gap.
One uncontrolled composed-audit runtime was approximately **451 ms**.
The original sleeve crease inventory additionally confirms **20 faces
crossing the material hinge and 17 cut edges per sleeve**; trying to
articulate the original unremeshed sleeve is correctly refused as a
material-triangle deformation. This is a topology blocker, not a completed
crease-conforming remesh or a new physically improved garment.

**Independent QA:** new suite **4/4 pass**; combined focused coupled,
interval, joint-translation and angle-path suites **31/31 pass** (about
**1.07 s** total), zero failures. New source/test syntax and `git diff
--check` passed. The frozen two-panel native candidate grid remains **10/10
complete**; existing executable SHA-256 `e192b7db60366173c758078e0bd7346f6368e5d7d4a492141469eaa66d32e1a0`
still mismatches checkpoint `1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Available storage was approximately **2.55 GiB**, above the lightweight
research floor but below the **8 GiB native-build floor**. No native trials,
native builds, cleanup, deletion, garment saves, UI edits, installs,
branch changes, commits or pushes were performed.

**Next:** implement a provenance-preserving crease-conforming sleeve
retriangulation with independent conditioning and nonadjacent contact QA,
then feed the resulting four-panel topology into this composed safety gate.
Continuous deformable self-contact and avatar-entry certification remain
unverified.

## October 25, 01:40 local continuation — composed hinge-and-translation interval contact veto

**New bounded research-only source and independent QA:**
`src/core/backends/nativeCoupledHingeTranslationIntervalResearch20261025.js`
and `scripts/qa-exo-coupled-hinge-translation-interval-20261025.mjs`.
Unlike the preceding translation-only path screen, this checker accepts
**simultaneous per-panel rigid translation and prescribed hinged rotation**,
including an actual two-triangle crease whose shared stationary vertices lie
on the rotation axis. A material triangle straddling the hinge with an
off-axis stationary vertex is rejected as nonrigid. For each cross-panel
triangle pair, a midpoint AABB and an exact triangle-distance oracle are
bounded conservatively by the sum of translation speed and angular speed
times maximum vertex radius over the interval. Unresolved intervals and
work-budget exhaustion fail closed. It screens **inter-panel contact only**;
same-panel self-contact, rest conditioning, avatar contact, material strain,
sewn-edge thickness exceptions, and the actual deformable solver trajectory
are not certified. The result always marks physical acceptance and safe
auto-application false.

Independent geometric controls showed that **both endpoints can be clear
while a mid-path hinge collision occurs**, including when **both hinge and
translation are nonzero**. The checker rejects these paths at their exact
0 mm midpoint contact. A valid two-face axis-pinned crease passes the
geometry preflight, whereas a face whose stationary vertex is off-axis
fails. An additional deterministic in-memory adversarial probe checked
**60 motion configurations x 101 independently evaluated poses**, with
**59 conservatively cleared, one rejected, and zero sampled false clears**.
These sampled oracles are a QA cross-check, not continuous CCD certification.

On the actual four-panel Foundation Tee, using the previously measured
**translation-only** joint candidate as a compatibility control (zero hinge
angles), the new checker independently reproduced the same front face 17 /
back face 17 **0 mm** collision at **87.5%** of the prescribed path. It
examined 69 exact triangle distances before rejecting the candidate, out of
216,576 potential inter-panel face pairs; one uncontrolled checker runtime
was approximately **9.25 ms**. This is **not** a new physically improved
garment or native solver benchmark. The unchanged baseline/candidate seam
gaps remain **188.452062 / 117.400268 mm** versus **92.296293 /
60.539759 mm** (maximum / RMS). Principal extension/compression remain
**7933.803349% / 89.040793%**; prior exact static contact screens found
**6** intra-panel intersections, **231** intra-panel near-clearance pairs,
and **122 -> 382** inter-panel near-clearance pairs. Contact validity and
physical acceptance **fail**. Source project, payload and motion inputs
passed nonmutation assertions.

**Independent QA:** 8/8 new tests, **27/27 combined** with three existing
coupled/path/translation suites, zero failures, approximately **1.01 s**
combined. Source/test syntax and `git diff --check` passed. Frozen native
checkpoint remains **10/10 completed**, with **zero candidates remaining**;
the current executable SHA-256
`e192b7db60366173c758078e0bd7346f6368e5d7d4a492141469eaa66d32e1a0`
still **differs** from the checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Read-only dry-run refused the mismatch, so **no native trial was repeated**.
Disk was approximately **1.95 GiB free**, above the 1 GiB lightweight QA
floor but below the 8 GiB native-build floor. No native build, UI/app change,
garment save, cleanup, deletion, installation, reset, commit or push occurred.

**Next:** integrate actual four-panel *intra-sleeve* crease candidates with
this conservative inter-panel motion screen, the existing independent
same-panel contact and strain oracles, and all 102 sewing correspondences.
Resolve the known ill-conditioned rest mesh before physical acceptance.
Neither deformable swept CCD nor safe avatar entry nor CLO3D parity is proven.

## October 25, 00:33 local continuation — conservative inter-panel translation-path veto

**New research-only source and independent QA:**
`src/core/backends/nativeRigidPanelTranslationIntervalContactResearch20261025.js`
and `scripts/qa-exo-rigid-panel-translation-interval-contact-20261025.mjs`.
The new bounded checker screens the *entire prescribed linear rigid-panel
translation interval*, rather than only the previously tested 0%, 50%, and
100% poses. For each inter-panel triangle pair, a swept AABB gives a safe
first-stage lower bound; uncertain pairs use exact triangle distances at
interval midpoints. Because the two panels translate rigidly, the relative
translation speed times half the interval width rigorously bounds how much
the triangle distance can decrease from its midpoint. Unresolved bounds and
work-budget exhaustion **fail closed**. The checker never edits the payload.

The independent synthetic controls include **two clear endpoints with a
colliding midpoint**, static overlap, safe separated swept volumes, exact
narrowphase clearance despite overlapping swept boxes, malformed topology,
invalid velocities, and insufficient depth/work budgets. The checker is
strictly limited to **inter-panel rigid linear translation**: it does not
check intra-panel folding, deformable motion, avatar contact, sewn-edge
thickness exceptions, or general swept CCD. It unconditionally reports
`sweptCollisionCertified:false`, `physicalAcceptance:false`, and
`safeToAutoApply:false`, even when its restricted interval screen clears.

On the **actual four-panel Foundation Tee**, the previous joint-translation
candidate was independently remeasured: original seam **188.452062 mm max /
117.400268 mm RMS**; candidate **92.296293 mm max / 60.539759 mm RMS**.
This is **not a new seam improvement**. Principal extension remains
**7933.803349%**, compression **89.040793%**, and the candidate still
fails static contact (previous exact inter-panel violations **122 -> 382**,
with **6 intra-panel intersections** and **231 intra-panel near-clearance
pairs** unchanged). The new interval screen independently found an **exact
0 mm** contact between front face **17** and back face **17** at **87.5%**
of the prescribed joint translation. A separately reconstructed pair of
world-space triangles reproduced the zero-distance witness. The screen
certified **4097** earlier pairs before stopping on this blocker, out of
**216576** possible cross-panel face pairs; it did **44** narrowphase
distance evaluations. It is **not** a full contact-pair census. Uncontrolled
interval-screen observations were approximately **9–13 ms**, not a native
solver performance benchmark.

**Independent QA: 41/41 PASS**, zero failures, approximately **0.96 s**
across seven new/existing focused suites. Source/test syntax passed;
project and native payload nonmutation checks passed. No native trial ran:
the frozen two-panel candidate grid remains **10/10 complete**, and the
existing executable SHA-256 `e192b7db60366173c758078e0bd7346f6368e5d7d4a492141469eaa66d32e1a0`
does **not** match the checkpoint SHA-256
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Available disk was approximately **1.9 GiB**, below the 8 GiB native-build
floor. No build, reset, cleanup, deletion, installation, garment/UI edit,
branch change, commit, or GitHub push was performed.

**Next:** construct genuinely contact-aware coupled hinge/translation
candidates on a conditioned rest mesh, with independently checked sewn
groups, principal strain, cloth/self and cloth/body contact, and conservative
trajectory bounds. This result rejects an unsafe rigid translation path;
it does not demonstrate physically feasible assembly, safe avatar entry,
continuous collision certification, or CLO3D parity.

## October 24, 23:34 local continuation — simultaneous four-panel translation research

**New bounded source/test improvement (not production):** added
`src/core/backends/nativeFoundationTeeJointTranslationResearch20261025.js`
and `scripts/qa-exo-foundation-tee-joint-translation-20261025.mjs`.
Unlike the preceding *independent per-seam* lower bounds, this constructs
one gauge-fixed least-squares system for **all 102 actual sewing pairs**
(92 cross-panel, 10 same-panel) and simultaneously optimizes three
translation vectors, holding the front panel fixed. It preserves each
panel's original particle offsets, rest mesh and sewing identities;
the candidate is a detached in-memory payload, **not saved or applied**.
It does not bend a hinge or solve contact-constrained sewing.

| Actual native four-panel pose | Original | Joint translation research candidate |
| --- | ---: | ---: |
| Maximum sewing gap | 188.452062 mm | **92.296293 mm** |
| RMS sewing gap | 117.400268 mm | **60.539759 mm** |
| Maximum principal extension | 7933.803349% | **7933.803349%** |
| Maximum principal compression | 89.040793% | **89.040793%** |
| Intra-panel intersecting triangle pairs | 6 | **6** |
| Intra-panel near-clearance pairs | 231 | **231** |
| Inter-panel exact near-clearance pairs | 122 | **382** |
| Static fabric contact valid | **No** | **No** |
| Physically accepted | **No** | **No** |

The original and candidate inter-panel values above are from the **same
exact triangle-distance checker** at 1 mm clearance, not the earlier
763-pair broadphase potential-contact count. The jointly optimized
translation reduces sewing gaps but **increases inter-panel contact
violations** and leaves extreme fabric strain and existing self-contact
unchanged. The original and candidate are both rejected. The
underarm same-sleeve pairs cannot be improved by whole-panel translations.
Avatar contact was **not rerun** on this candidate; previous original-pose
avatar samples are not candidate measurements.

Three discrete translation-path poses at fractions 0, 0.5, 1 were also
checked. Their max/RMS gaps were respectively
**188.452/117.400**, **136.670/78.705**, and **92.296/60.540 mm**;
inter-panel exact near-clearance pairs were **122, 374, 382** and each
pose failed static fabric contact. This is **not swept CCD** or proof
about unsampled intervals, avatar entry or any physically safe path.
The least-squares research function alone took approximately **5.43 ms**
in one uncontrolled observation. Independent raw particle-space seam
oracles, numerical objective perturbations, rigid-offset invariance,
spectral-strain invariance, 3-pose contact rejection, malformed input
guards and source-state nonmutation all passed: **32/32 tests**, zero
failures across five related suites in approximately **0.94 s**.

**Native research loop was not executed:** frozen checkpoint already
contains all **10/10** two-panel candidates, and the current binary SHA-256
`e192b7db60366173c758078e0bd7346f6368e5d7d4a492141469eaa66d32e1a0`
still differs from checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Available disk was approximately **2.16 GiB**, below the 8 GiB native-build
floor. No native trials/builds, disk cleanup, app changes, UI changes,
garment saves, resets, commits or pushes. The worktree and installed
software remain untouched except for these new research files and this
report. **Next:** add constrained hinge/developable motion and a coupled
contact-aware merit/acceptance gate; do not promote this translation-only
candidate. CLO3D parity and continuous collision certification remain
unverified.

## October 24, 22:33 local continuation — real four-panel per-seam translation bounds

**New source/test improvement, research only:** added
`src/core/backends/nativeFoundationTeeSeamClosureBoundsResearch20261025.js`
and `scripts/qa-exo-foundation-tee-seam-closure-bounds-20261025.mjs`.
The diagnostic binds the previously frozen **102-pair / 14-group** tee sewing
inventory to the **actual** native four-panel world positions (not synthetic
index-coverage panels). It independently reports each seam group's maximum
and RMS gap and its least-squares residual after an independently optimized
rigid translation between the two panels. It explicitly refuses to interpret
same-sleeve underarm sewing as correctable by translating the whole sleeve.
This identifies groups that need bending or coupled motion, but **independent
per-group translations cannot all be applied simultaneously**, and none was
applied to the garment.

On the original four-panel native pose, the new diagnostic measured
**188.452062 mm maximum / 117.400268 mm RMS sewing gap** over all 102 pairs.
The two shoulder groups each had **176.430274 mm RMS** (188.452062 mm max),
with a **15.174365 mm RMS lower bound** under that group's *independent*
relative translation. The sleeve-back/front lower groups were next at
**135.418833 mm RMS**, with **28.125382 mm** independent translation bounds.
These bounds do not account for constraints on other groups, principal strain,
contact, avatar fit or trajectories. An independent rigid-shift negative
control attained the shoulder group's predicted bound but did not certify
the resulting pose or improve the saved garment.

Independent physical audits of this same initial native payload measured
**7933.803349% maximum principal extension** and **89.040793% maximum
principal compression**, failing the nominal 5% research cap. Static checks
found **500/1268 penetrating avatar sample points**, **6 intra-panel
intersecting triangle pairs**, **231 nonadjacent intra-panel near-clearance
pairs**, and **763 inter-panel broadphase *potential* contacts** (not
independently proven intersections). Contact validity **failed**; neither
these static screens nor discrete sampling prove swept CCD. The separately
reported off-body baseline of **345.000/179.744 mm** and isolated sleeve
75-degree baseline of **273.707/263.883 mm** are different poses/fixtures,
not comparable improvements.

**Independent QA: 34/34 PASS** across the new six-case numerical/adversarial
suite plus five existing sewing and coupled-contact/path suites, approximately
**0.521 s** combined. Checks included a raw particle-space independent
seam-gap oracle, exact constructive translation-bound control, invariance to
rigid panel offsets, underarm non-repairability, malformed geometry rejection,
and project/payload nonmutation. The new diagnostic took approximately
**9.8 ms** in one uncontrolled observation; separate baseline strain audit
took **2.77 ms** and static contact screens **129.29 ms**. Syntax and diff
whitespace checks passed.

**Native loop intentionally not run:** existing experimental binary SHA-256
`e192b7db60366173c758078e0bd7346f6368e5d7d4a492141469eaa66d32e1a0`
does not match frozen checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`;
the saved two-panel candidate grid is already **10/10 complete**. A dry-run
guard rejected the mismatch before launching the native service. Disk had
approximately **2.15 GiB** free, below the **8 GiB** native-build floor.
No native trials, builds, cache cleanup, installs, resets, commits, pushes,
garment saves or UI changes were performed. Next: seek **jointly compatible**
four-panel hinge/translation motion that reduces the worst groups while
maintaining the independent spectral and cloth/body-contact rejection gates.
This work does not establish physical acceptance, safe avatar entry, CLO3D
parity or continuous collision certification.

## October 24, 21:45 local continuation — bind canonical four-panel sewing inventory

**New, research-only source and QA:**
`src/core/backends/nativeFoundationTeeSewingInventoryResearch20261024.js`
and `scripts/qa-exo-foundation-tee-sewing-inventory-20261024.mjs`.
Updated the sampled coupled angle-path gate to admit legitimate same-sleeve
underarm sewing **only when an explicit full manifest is provided**, and to
retain seam-group identity when distinct authored seams share a junction
vertex pair. Intra-panel pairs never contribute to cross-panel connectivity.
The gate still reports `physicalAcceptance:false` and
`sweptCollisionCertified:false` unconditionally.

**Newly established canonical tee inventory:** 14 authored seam groups,
**102 native seam constraints**, of which **92 cross panels** and **10 sew
distinct vertices within the same sleeve**. Four vertex pairs occur twice
because they belong to two different sewn groups at a sleeve junction:
there are 98 distinct endpoint pairs, but all 102 grouped correspondences
must be retained. The earlier cross-panel-only/unique-endpoint validator
could not represent the complete real tee inventory. The new frozen
project/native-baseline adapter verifies group IDs, side panel identities,
particle provenance, and canonical per-group sample counts; it rejects
changed/missing groups, malformed endpoints and unsupported virtual seams.
It is a **fixture-derived, not independently signed**, manifest. A candidate
must be checked against the *separately frozen baseline*, not against a
manifest derived from that same candidate.

**Independent QA:** **28/28 PASS** across five coupled sewing/contact/path
suites, including a raw-particle oracle for all 102 pairs, 10 intra-panel
samples and four shared junctions. Missing an entire underarm group, changing
a seam ID, and using an intra-panel seam to fake panel connectivity all
correctly fail. One explicitly **synthetic** four-panel index-coverage test
confirmed that the entire frozen manifest can be passed to the sampled
gate; its 648.201 mm maximum / 375.611 mm RMS gap and near-zero strain
describe artificial geometry, **not** a new Foundation Tee pose. Combined
runner time was approximately **0.446 seconds**; that synthetic gate call
took approximately **21 ms** in one uncontrolled observation. Project,
native payload, synthetic panels and manifest passed nonmutation checks.
The real separated-sleeve path control still rejects **28 intra-panel
clearance warnings at each pose** (14 per sleeve), with negligible
principal extension/compression and no sewn cross-panel gap measurement.
The historical real four-panel off-body baseline remains **345.000 mm
maximum / 179.744 mm RMS**, and the isolated 75-degree sleeve baseline
remains **273.707 / 263.883 mm**. Neither was physically improved.

**Native loop not launched:** current executable SHA-256
`e192b7db60366173c758078e0bd7346f6368e5d7d4a492141469eaa66d32e1a0`
differs from the saved checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
All **10/10** native candidates are already completed; no candidate was
repeated. Available disk was approximately **2.14 GiB**, below the 8 GiB
native-build floor. No native build, cache purge, garment or UI edit,
installation, reset, commit or push occurred. **Remaining blocker:** an
actual four-panel crease-pose representation with full sewing constraints,
better-conditioned material triangles and independently valid cloth/body
contact along a trajectory. This is not avatar-entry CCD or CLO3D parity.

## October 24 continuation — explicit sewn-pair coverage against an authored manifest

**Concrete source/test improvement (research only):** the sampled coupled
crease-angle path now accepts an optional `requiredSewingPairs` manifest,
validates every required correspondence, and checks exact unordered pair-set
equality against the proposed sewing constraints. A connected four-panel
spanning tree with three valid sewing pairs now **fails** the sampled research
gate when the independently supplied manifest specifies four; an extra,
unapproved pair also fails. Reversed endpoints and reordered entries match.
Malformed, duplicate, self-panel, unknown-panel and out-of-range required
pairs fail closed. When no manifest is supplied the result explicitly reports
`sewingCoverageChecked:false` and `sewingCoverageMatchesManifest:null`;
the legacy sampled research gate remains compatible, but **neither that gate
nor a caller-authored manifest proves complete real-garment seam coverage**.
An authoritative Foundation Tee sewing manifest has not yet been independently
bound to this experiment. No source garment or solver pose was modified.

Changed only `src/core/backends/nativeCoupledCreaseAnglePathResearch20261024.js`
and new `scripts/qa-exo-coupled-sewing-coverage-20261024.mjs` plus this report.
**Independent QA: 20/20 pass**, across the new adversarial manifest suite and
the existing sewing-graph, sampled-path and coupled-static suites; zero failures,
approximately **0.37 s** combined runner time. Source syntax checks passed.
The real separated-sleeve five-pose negative control still reports **28
intra-panel clearance warnings at every pose**, zero inter-panel warnings,
negligible principal extension/compression (<7e-12%), failed contact and no
measured cross-panel seam gaps; its input-state nonmutation assertion passed.
The distinct historical isolated 75-degree sleeve max/RMS gap remains
**273.706902 / 263.883173 mm** and the distinct historical full four-panel
off-body max/RMS remains **345.000 / 179.744 mm**. These are not new solver
measurements; no physically accepted pose or runtime improvement was found.

Native executable SHA-256 `e192b7db60366173c758078e0bd7346f6368e5d7d4a492141469eaa66d32e1a0`
still **differs** from frozen checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
The checkpoint has **10/10 completed distinct candidates**. Therefore the
native iteration command was **not** run and no completed trial repeated.
Disk headroom was approximately **2.13 GiB**, below the **8 GiB** native-build
floor. No build, cleanup, deletion, install, UI/garment edit, reset, commit,
push or checkpoint rewrite was performed. Next: bind the full authoritative
four-panel sewing-pair inventory, repair rest mesh thickness/conditioning,
then seek an actual coupled seam/strain/contact-valid path. Avatar entry,
swept CCD and CLO3D parity remain unverified.

## October 24 continuation — reject disconnected or spoofed coupled sewing graphs

**Source-level change:** hardened research-only
`src/core/backends/nativeCoupledCreaseAnglePathResearch20261024.js` to
validate cross-panel sewing correspondences, reject self-pairs, reversed
duplicates, unknown panels and invalid vertex indices, and require a connected
panel sewing graph before `sampledResearchGatePass` can be true. A connected
graph is only a necessary topological condition, **not** proof of complete
sewing-edge coverage or a physically valid assembled garment. The evaluator
continues to report `physicalAcceptance:false` and
`sweptCollisionCertified:false` unconditionally.

**Independently reproduced false positives before the fix:** four separated,
contact-clear synthetic panels with either a self-paired vertex (zero gap) or
only one valid A–B correspondence (50 mm gap within a deliberately loose
100 mm research tolerance) previously returned
`sampledResearchGatePass:true`, despite C and D being unsewn. Both now fail
closed. A connected A–B–C–D chain still passes the *sampled research* screen
with no physical certification. New adversarial regression file:
`scripts/qa-exo-coupled-sewing-graph-20261024.mjs`.

**QA:** 14/14 tests passed across the new sewing-graph suite and the existing
coupled static-pose and sampled-path suites (about 0.50 s test-runner wall
time). A connected, zero-gap but intersecting two-panel negative control also
fails as required. Syntax checks passed; original source panels remained unchanged.
The actual Foundation Tee's separated two-sleeve, five-pose screen still
rejects **28 intra-panel near-clearance pairs at every pose**, with zero
inter-panel warnings and principal extension/compression below `7e-12%`.
That fixture has no cross-panel sewing correspondences; its max/RMS seam
gaps remain **unmeasured**. Previously verified isolated 75-degree sleeve
gaps remain **273.706902 / 263.883173 mm** maximum/RMS, while the separate
historical four-panel off-body baseline remains **345.000 / 179.744 mm**.
No new physical solver improvement or avatar-contact result was obtained.

**Native execution blocked safely:** checkpoint hash is
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`,
but the current experimental executable hashes to
`e192b7db60366173c758078e0bd7346f6368e5d7d4a492141469eaa66d32e1a0`.
The checkpoint already contains **10/10 distinct completed candidates**.
Because the binary/checkpoint hashes differ, the resumable native batch was
**not launched**, and no completed candidate was repeated. Disk headroom
was approximately **1.01 GiB**, far below the **8 GiB** native-build floor.
No native build, cleanup, solver installation, UI/garment change, branch
reset, commit or push was performed. Full four-panel coupled seam closure,
continuous contact, avatar entry and CLO3D parity remain unverified.

## October 24 continuation — bounded coupled hinge-angle path detects missed intermediate contact

**New research-only source and independent QA:**
`src/core/backends/nativeCoupledCreaseAnglePathResearch20261024.js` and
`scripts/qa-exo-coupled-crease-angle-path-20261024.mjs`. The new screen
interpolates independently specified crease angles over a bounded 2–16
subdivision path and calls the exact coupled static triangle-contact and
principal-strain evaluator at **every endpoint and intermediate pose**.
Per-pose and whole-path triangle-pair budgets are enforced before sampling.
The result explicitly separates sampled contact clearance, principal-strain
validity and terminal sewing tolerance, and always refuses physical approval,
automatic application and swept-collision certification. This is a
**prescribed hinge-angle sampling diagnostic**, not a dynamic simulation or
continuous cloth/body/self collision proof.

**Independent negative control:** two initially separated synthetic sheets
have clear **-90° and +90°** hinge endpoint poses, but at the intervening
**0°** pose their triangles touch at material/world point `[0.03,0,0]` m.
An independent exact triangle-distance oracle reproduces zero separation.
The new five-pose path screen rejects the contact that checking both endpoints
alone misses. A separate well-spaced control passes its sampled static screen
without gaining physical certification; invalid angles, unrecognized panel
IDs, excessive subdivisions and exhausted pair budgets fail closed.

**Actual Foundation Tee sleeve topology, not sewn four-panel assembly:**
both refined sleeves were placed 0.5 m apart and rotated through five
sampled poses from 0° to 75°. Every sample had **28 intra-panel sub-1 mm
clearance pairs (14 per sleeve)**, zero inter-panel clearance warnings and
principal extension/compression below **7e-12%**. Sampled contact therefore
**failed at every pose**, despite near-isometric rigid folds. This separated
fixture supplies **no cross-panel sewing correspondences**, so its maximum
and RMS seam gaps are **not measured**. The distinct previous isolated
75° sleeve gaps remain **273.706902 mm maximum / 263.883173 mm RMS**, and
the historical complete four-panel off-body baseline remains **345.000 mm /
179.744 mm**. No new seam improvement, feasible assembly or avatar-safe
trajectory was demonstrated.

**Independent QA:** five related research suites passed **20/20** with zero
failures (about **1.69 s** combined runner wall time). The new five-pose
two-sleeve path screen took approximately **199 ms** in one uncontrolled
combined-suite observation (about 144 ms in a separate focused run), not a
native solver benchmark. Original project, native payload and source panel
arrays passed nonmutation assertions; syntax checks passed. The frozen
two-panel native executable SHA-256 still matches its checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
`EXO_TEE_LOOP_MAX_TRIALS=3 npm run qa:tee-iteration-loop` reported **10/10
complete, zero repeated trials**. Free disk was approximately **2.45 GiB**,
below the **8 GiB** native-build floor. No native build, cache deletion,
disk cleanup, UI/installed-app change, garment save, branch reset, commit,
deployment or GitHub push was performed. **Next:** repair rest-mesh thickness
and conditioning, then evaluate actual four-panel sewing and bending under
independent avatar, cloth/cloth and swept-contact constraints. Neither
avatar-entry CCD nor CLO3D parity is certified.

## October 24 continuation — coupled static crease-pose contact veto across separate panels

**New research-only source and independent QA:**
`src/core/backends/nativeCoupledCreasePoseContactResearch20261024.js` and
`scripts/qa-exo-coupled-crease-pose-contact-20261024.mjs`. This bounded
evaluator rotates each panel's positive material side around its verified
world-space crease axis, builds an **in-memory multi-panel pose**, and checks
both intra-panel and **exact narrowphase inter-panel** static thickness,
principal fabric extension/compression, and optional explicit sewing-vertex
residuals. It validates crease-axis collinearity, triangle-side alignment,
panel identity, finite angles, sewing indices and a global triangle-pair
budget. It does **not** install a constraint graph, solve a trajectory, check
an avatar or alter an editable garment.

**New independent negative control:** two separately isometric, initially
contact-clear synthetic panels start 30 mm apart. A 90-degree fold closes
their one explicit sewing correspondence from **42.426407 mm maximum/RMS to
approximately 0 mm**, with principal extension/compression both effectively
**0%**. Nevertheless, an independently reconstructed moving-triangle / static
triangle witness has **zero distance**, and the exact inter-panel contact
screen rejects the folded pose. This demonstrates why individually clean
folds and a closing seam cannot imply safe *coupled* assembly. A separated
two-panel control passes the static contact screen, without fit certification.

**Actual Foundation Tee topology:** a research-only two-sleeve pose was
constructed from the refined material meshes, with the panels deliberately
separated by 0.5 m in world Z to isolate same-panel defects. At 75 degrees,
principal extension/compression were below `3e-12%`, and exact inter-panel
near-clearance count was **0**, but there were **28 intra-panel sub-thickness
pairs (14 per sleeve)**. Static contact therefore **failed**. This is **not**
the actual sewn four-panel world pose; there were **no cross-panel sewing
correspondences supplied**, so maximum/RMS seam gaps for this new experiment
are **unmeasured**, not zero. The distinct, previously measured isolated
underarm 75-degree seam gaps remain **273.706902 mm max / 263.883173 mm RMS**;
the historical full four-panel off-body baseline remains **345.000 mm max /
179.744 mm RMS**. Neither was improved in this run.

**Independent QA:** the new 4 tests and 22 existing coupled-cloth, crease
interval and fraction-sweep tests passed **26/26** (about **1.96 s** runner
wall time). The new two-sleeve coupled static screen took about **49.68 ms**
in one uncontrolled observation, not a native solver benchmark. Negative
controls covered a hidden coupled contact despite closed sewing, a separated
pose, malformed sewing/axis/angle inputs and pair-budget refusal. Source
project, native payload and panel arrays passed JSON nonmutation assertions;
JavaScript syntax checks passed. The frozen **two-panel** native executable
hash still matches the checkpoint; `EXO_TEE_LOOP_MAX_TRIALS=3 npm run
qa:tee-iteration-loop` returned **10/10 complete, zero repeated candidates**.
Free disk was approximately **2.89 GiB**, below the **8 GiB** native-build
floor. No native build, installed-app/UI edit, garment save, cache cleanup,
deletion, reset, commit or push was performed.

**Still blocked:** the new gate covers only static coupled snapshots; the
real refined sleeve mesh remains thickness-invalid, and the four-panel
sewing/contact trajectory is unsolved. Next: apply independently certified
local material remeshing to remove the 14 per-sleeve rest clearance warnings,
then evaluate actual four-panel coupled seam/strain/static and swept contact
with avatar clearance. No continuous collision, safe avatar entry, physical
fit or CLO3D parity is claimed.

## October 24 continuation — bounded crease-fraction sweep with exact clearance and folded-contact veto

**New source/test:** `src/core/backends/nativeCreaseFractionSweepResearch20261024.js`
and `scripts/qa-exo-crease-fraction-sweep-20261024.mjs`. This research-only,
bounded sweep changes the interpolation fraction along a constrained crease
edge, rather than rerunning the exhausted fixed-vertex or native parameter
grids. It reuses the proven provenance-preserving subdivision primitive,
checks **exact** disjoint-face minimum rest clearance, independently screens
the resulting 75-degree rigid-fold pose for principal strain and same-panel
static contact, and refuses to promote any candidate. It neither installs
constraints nor moves the original sewing endpoints or saved garment.

**Actual Foundation Tee sleeves, independently tested:** for each sleeve,
evaluated 3 interior crease edges (indices 7, 9, 16) at 5 distinct fractions
(0.20, 0.35, 0.50, 0.65, 0.80): **15 candidates per sleeve, 30 total**.
All 30 were unique within this new sampling grid. The exact minimum
disjoint-face rest clearance in the refined baseline is **0.3839069 mm**
against the experimental 1 mm screen. Edge 7 or 9 subdivision produced
**17** ill-conditioned triangles (versus **15** baseline), **18–20**
sub-thickness contact warnings (versus **14**), and exact minimum clearance
as low as **0.116687 mm** (edge 9, fraction 0.80). Edge 16 retained the
baseline **15** poor triangles, **14** warnings and **0.3839069 mm** exact
minimum at all five fractions, but **did not improve** any safety metric.
Thus **5/15** candidates per sleeve were nonregressing, **0/15** improved,
and **0/15** were eligible for further physical research. All were rejected.

| Isolated sleeve, per side | Refined baseline | Nonregressing edge-16 split at 0.20 |
| --- | ---: | ---: |
| Ill-conditioned rest triangles | 15 | **15** |
| Exact minimum disjoint rest clearance | 0.383907 mm | **0.383907 mm** |
| Rest / 75-degree static clearance warnings | 14 / 14 | **14 / 14** |
| 75-degree maximum underarm sewing gap | 273.706902 mm | **273.706902 mm** |
| 75-degree RMS underarm sewing gap | 263.883173 mm | **263.883173 mm** |
| 75-degree maximum principal extension/compression | ~0% / ~0% | **~0% / ~0%** |
| Static contact valid / physically accepted | No / No | **No / No** |

An **independent exhaustive triangle-pair distance oracle** reconstructed
the selected candidate's minimum clearance. A separate weighted sewing
oracle confirmed unchanged maximum/RMS gaps, and an independent folded
static-contact screen rejected the candidate. These are **isolated sleeve**
poses, not a new four-panel coupled fit. The distinct historical complete
four-panel off-body baseline remains **345.000 mm max / 179.744 mm RMS**.
No avatar contact, full inter-panel folded contact or swept CCD is certified.

**QA:** new 3-test suite plus preceding crease-resampling, paired-flip and
fold-contact suites passed **15/15** with zero failures (approximately
**5.34 s** test-runner wall time). The two new 15-candidate sleeve sweeps
took approximately **0.57 s** and **0.44 s** in one uncontrolled QA
observation; these are not native solver speed measurements. Negative controls
reject duplicate trials, malformed budgets, invalid fractions, and meshes
without an exact disjoint-face clearance oracle. Source project, native
payload and research sleeve inputs passed nonmutation checks. Syntax and
diff-whitespace checks passed.

The existing experimental **two-panel** executable SHA-256 matches the
saved checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
`EXO_TEE_LOOP_MAX_TRIALS=3 npm run qa:tee-iteration-loop` exited with
**10/10 already complete**, rerunning **zero** candidates. Free disk was
approximately **3.12 GiB**, below the **8 GiB** native-build safety floor.
No native build, solver installation, installed-app/UI edit, garment save,
cleanup, deletion, branch reset, commit or GitHub push was performed.

**Next:** the sampled one-edge fraction family is insufficient. Develop a
genuinely coupled, material-provenance-preserving local retriangulation and
crease-placement proposal that improves **both** conditioning and exact
clearance, then test assembled four-panel seam, principal strain, inter- and
intra-panel static contact, avatar contact and swept trajectories independently.
Complete garment fit, avatar-entry CCD and CLO3D parity remain unverified.

## October 24 continuation — topology-only repair rejects world-pose and cached-graph spoofing

**Concrete source-level safety improvement:** hardened
`src/core/backends/nativeCreaseRepairCandidateGate20261024.js` so a
material-preserving face-retriangulation proposal must preserve **every
non-face field**, including `worldPositionsM`, nested constraint caches,
hidden/nonenumerable properties, and unknown metadata. Previously the gate
compared selected material/provenance/sewing fields but silently permitted a
candidate to change its world pose or cached constraints while reporting
`materialCoordinatesLocked:true`. New descriptor-aware deep comparisons
reject such edits; nonfinite numbers and extra hidden face fields also fail
closed. Existing specific provenance and boundary diagnostic errors are
preserved. This prevents unsafe research candidates from carrying unrelated
state changes downstream; it does **not** make flat material checks equivalent
to world-space contact validation.

Added `scripts/qa-exo-crease-repair-pose-invariance-20261024.mjs` with
negative controls for altered world coordinates, removed world-pose metadata,
new approval flags, stale nested hinge caches, hidden metadata, hidden face
fields and NaN. A legitimate synthetic topology-only diagonal replacement
still passes the flat geometry gate without physical approval. Actual
four-panel project/native-payload fixtures passed JSON nonmutation checks.
**Independent regression:** 18/18 tests passed across the new adversarial
suite and four existing candidate/provenance/single-flip/paired-flip suites;
test-runner wall time approximately **6.86 s**. Syntax and scoped diff
whitespace checks passed.

**No new physical pose or solver measurement:** historical isolated sleeve
75-degree maximum/RMS underarm gap remains **273.706902 / 263.883173 mm**,
principal extension/compression approximately **0%**, with **14** static
sub-1 mm warnings per sleeve and failed contact validity. At 180 degrees,
seam gap is approximately zero but **361** static triangle intersections per
sleeve veto acceptance. The distinct historical four-panel off-body baseline
remains **345.000 / 179.744 mm** maximum/RMS. The refined rest mesh still has
**15** ill-conditioned triangles per sleeve, and hierarchical subdivision
still has **21** and **20** clearance warnings. None is a certified fit.

The frozen two-panel native executable SHA-256 still matches the checkpoint
(`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`).
`EXO_TEE_LOOP_MAX_TRIALS=3 npm run qa:tee-iteration-loop` returned **10/10
complete** without rerunning any candidate. Available disk was approximately
**3.77 GiB** before this source-only pass, below the **8 GiB** native-build
floor. No native build, solver installation, UI change, saved garment edit,
cache cleanup, deletion, reset, commit or GitHub push occurred. Physical
seam/contact improvement, complete coupled folding, continuous CCD, avatar
entry and CLO3D parity remain **blocked/unverified**.

## October 24 continuation — hierarchical crease provenance unlocked for guarded retriangulation (research only)

**Source improvement:** extended
`src/core/backends/nativeCreaseRepairCandidateGate20261024.js` to
validate acyclic, index-ordered generated-parent interpolation, not only
direct interpolation from original vertices. The previous restriction
rejected legitimate second-generation crease subdivisions from
`nativeCreaseEdgeResamplingResearch20261024.js`, preventing the existing
single-/paired-edge repair searches from inspecting them. The new gate
requires every generated index to have exactly one valid provenance record,
rejects forward/self/cyclic parent references, missing entries, invalid
weights and displaced generated material coordinates. It continues to
preserve material boundaries, crease hinges, area, original sewing ownership
and candidate nonmutation. It **does not** install constraints or certify
deformed-world contact.

**New independent regression file:**
`scripts/qa-exo-crease-hierarchical-repair-gate-20261024.mjs`.
Synthetic one- and two-level subdivisions now pass the safety gate; negative
controls for missing, forward, cyclic, duplicate, altered-weight and
displaced-vertex provenance fail closed. Both actual Foundation Tee sleeves
were subdivided twice, then submitted to **4 bounded single-flip proposals
and 4 bounded paired-flip proposals each**, with the same existing
source-state and physical-approval vetoes. The paired search independently
evaluated **3 unique final proposals per sleeve** and found **zero verified
improvements**. The original project, native payload, source sleeve and
research candidates passed JSON nonmutation checks.

| Per sleeve, flat REST material only | Prior refined mesh | Two nested crease splits |
| --- | ---: | ---: |
| Material vertices | 112 | **114** |
| Material faces | 178 | **182** |
| Ill-conditioned triangles | 15 | **21 (worse)** |
| Disjoint sub-1 mm clearance warnings | 14 | **20 (worse)** |
| Physical acceptance | Rejected | **Rejected** |

This small search verifies that hierarchical resampling is now compatible
with constrained repair infrastructure, **not** that a better triangulation
exists. The newly split meshes remain less suitable than the baseline.
No new folded 3D pose, coupled seam solver, world-contact validation or
swept collision result was generated. The previously verified isolated
75-degree sleeve result remains **273.707 mm maximum / 263.883 mm RMS
underarm gap**, with negligible principal strain but failed static contact.
The separately measured historical complete four-panel off-body baseline
remains **345.000 mm maximum / 179.744 mm RMS seam gap**. Neither baseline
is a new measurement or a physically accepted garment.

**Independent QA:** 19/19 tests passed across hierarchical provenance,
repair candidate, single-flip, paired-flip and resampling suites; combined
test-runner duration **7.08 s**. The bounded two-sleeve hierarchical search
took **814 ms** in one uncontrolled observation, not a solver benchmark.
Source/test syntax and diff whitespace checks passed. The native binary
SHA-256 still matches the frozen checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
The bounded `EXO_TEE_LOOP_MAX_TRIALS=3 npm run qa:tee-iteration-loop`
exited successfully with **10/10 completed and zero candidates repeated**.
Disk headroom at final inspection was approximately **5.05 GiB**, below
the **8 GiB** native-build floor. No native build, UI/app/garment save,
cleanup, reset, installation, commit or GitHub push occurred.

**Next:** evaluate topology changes local to the newly introduced vertices
with strict simultaneous altitude, exact minimum-clearance and principal
strain/contact nonregression. Reject the current 21-sliver/20-warning
candidate. Complete four-panel assembly, continuous cloth/avatar collision
and CLO3D parity remain unverified.

## October 24 continuation — provenance-preserving crease-edge resampling primitive (research only)

Added `src/core/backends/nativeCreaseEdgeResamplingResearch20261024.js`
and `scripts/qa-exo-crease-edge-resampling-20261024.mjs`. Unlike the
exhausted fixed-vertex one/two-flip neighborhoods, this opt-in **interior
crease-edge subdivision** creates one new material vertex with explicit
interpolation provenance, splits both incident faces conformingly, and
replaces one hinge with two. Provenance supports acyclic generated-parent
edges on subsequent subdivisions; hidden fields, accessors, malformed
provenance, nonmanifold faces, missing crease hinges and unsafe budgets fail
closed. Candidate arrays are deep-isolated from the source. The original
sewing particle IDs, flat material boundary, area, crease axis and original
material vertices remain unchanged. Derived topology/quality metadata is
refreshed rather than copied stale. No solver constraints are installed and
no physical approval or contact exemption is granted. **All static contact
and quality metrics in this helper are flat REST-material checks**, not
checks of the independent `worldPositionsM` pose. A separate adversarial
review found that an arbitrarily displaced world vertex still produces a
clean *rest* screen; this is intentional separation of coordinate systems,
and a negative control now requires explicit `worldPoseContactChecked:false`
and `worldPoseValidityCertified:false` rather than suggesting a valid pose.

The bounded test used three representative crease edges (`100:101`,
`100:102`, `101:109`, indices **7/9/16**) on **each** real Foundation Tee
sleeve. Every split increased material vertices **112→113**, triangles
**178→180**, structural edges **289→292**, bending hinges **245→248**,
and crease hinges **20→21**, conserving **0.0767925 m²** material area
per sleeve. Results were symmetric:

| Per-sleeve rest screen | Unchanged baseline | Split edge 7 | Split edge 9 | Split edge 16 |
| --- | ---: | ---: | ---: | ---: |
| Ill-conditioned triangles | 15 | **17** | **17** | **15** |
| Minimum triangle altitude | 0.383907 mm | **0.352967 mm** | **0.291717 mm** | 0.383907 mm |
| Static disjoint sub-1 mm warnings | 14 | **20** | **20** | **14** |
| Static intersections | 0 | 0 | 0 | 0 |
| Static contact screen clear | No | No | No | No |
| Physical acceptance | No | No | No | No |

**Interpretation:** provenance-valid edge subdivision alone does **not**
repair the slivers or fabric-clearance violations. The two splits around
the priority `100/101/102` crease cluster made both metrics worse; edge 16
was neutral. All three remain research-only, uninstalled candidates. This
avoids mistaking additional degrees of freedom for a physically improved
mesh. An independent synthetic clean-rest negative control still detects
an unsafe 180° fold, proving the primitive never treats a clean flat mesh
as trajectory contact certification.

At **75° isolated rigid-half folding**, every resampled candidate retains
the existing sewing-endpoint **273.706902 mm maximum / 263.883173 mm RMS**
gap and approximately zero principal fabric extension/compression
(both <1e-9%). Independently recomputed static contact **still fails**.
These are isolated material-space sleeve metrics, not an accepted four-panel
fit. The historical complete four-panel baseline remains **345.000 mm
maximum / 179.744 mm RMS**, and the separate native two-panel 10-case
checkpoint remains **10/10 complete**; no native candidates were repeated.

**Independent numerical QA:** 5/5 new focused tests and **20/20** combined
crease-repair/contact tests passed. The new six-proposal, two-sleeve
evaluation took approximately **214 ms** in one uncontrolled observation;
final combined test-runner time was approximately **5.44 s**. Source syntax and
diff-whitespace checks passed. Project, native payload, source sleeves and
candidate-array isolation passed nonmutation checks. The existing native
binary SHA-256 still matched checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
The bounded `EXO_TEE_LOOP_MAX_TRIALS=3 npm run qa:tee-iteration-loop`
reported complete with zero new trials. Free disk at start was approximately
**5.21 GiB** (approximately **5.70 GiB** at final inspection), below the
**8 GiB** native-build floor; no native build,
garment/UI/installed-app change, checkpoint rewrite, cleanup, reset,
commit or push was performed.

**Next:** use the now-proven hierarchical crease subdivision to construct
an *independently verified* constrained local retriangulation/refinement
that strictly improves both conditioning and minimum exact clearance.
Do not accept warning-count-only improvements or relax the 1 mm rule without
a validated material-adjacency/thickness model. Coupled four-panel seam
closure, safe avatar entry, swept CCD and CLO3D parity remain unverified.

## October 24 continuation — bounded paired crease flips with exact-clearance safety (research only)

Added `src/core/backends/nativeCreaseRepairPairedFlipResearch20261024.js`
and `scripts/qa-exo-crease-repair-paired-flips-20261024.mjs`. This is
a **new two-edge topology search**, not another native two-panel parameter
measurement or a production garment modification. It enumerates strictly
convex, orientation-preserving, crease-respecting flips; validates each
intermediate and final topology through the existing provenance/area/boundary
gate; and rejects a final candidate if **any** of ill-conditioned triangle
count, near-clearance count, static intersections, minimum altitude, maximum
aspect ratio or independently measured minimum static clearance regresses.
An explicit safety classifier now rejects invalid/nonfinite quality metrics.
Final face sets are canonicalized to avoid repeating equivalent
triangulations; the search has a **12×12 proposal ceiling** and a cooperative
**15-second wall-clock budget** checked between evaluations. If the
thresholded contact screen reports no near pairs, a bounded exact
triangle-distance pass measures the true disjoint minimum instead of
mistaking the 1 mm warning threshold for exact clearance. A negative
control distinguishes **3 mm** from **2 mm** separation even though
both exceed that threshold.
No proposal is applied automatically, and neither endpoint static screening
nor rigid-half folding is treated as continuous collision certification.

For **each of the two real Foundation Tee sleeves**, the bounded 12-by-12
search considered **144 ordered two-flip proposals**; **64** equivalent
final triangulations were skipped. Of **80 unique final triangulations
evaluated per sleeve** (**160** across both sleeves), **53** per sleeve
failed quality nonregression; **27** passed the
nonregression criteria; **zero** achieved a strict verified improvement.
No candidate was accepted or installed. The original baseline remains
**15** poorly conditioned rest triangles, **14** disjoint sub-1 mm static
warnings, **0** static triangle intersections, **0.383907 mm** minimum
altitude and minimum exact near clearance, and **85.495** maximum aspect
ratio per sleeve. The independent negative control confirms the earlier
single-edge `91:111` count-only apparent win (**14 to 13** warnings)
fails both altitude and minimum-clearance nonregression.

Independent isolated sleeve measurements (unchanged triangulation):

| Per sleeve, material-space fold | 0° | 75° | 180° |
| --- | ---: | ---: | ---: |
| Maximum underarm gap | 345.000 mm | 273.707 mm | ~0 mm |
| RMS underarm gap | 332.617 mm | 263.883 mm | ~0 mm |
| Maximum principal extension/compression | ~0% / ~0% | <1e-9% / <1e-9% | ~0% / ~0% |
| Static near-clearance warnings | 14 | 14 | 195 |
| Static triangle intersections | 0 | 0 | 361 |
| Physical acceptance | **No** | **No** | **No** |

The historical **complete four-panel** off-body baseline remains
**345.000 mm max / 179.744 mm RMS**, and the completed native **two-panel**
grid remains **10/10**; the fixtures must not be conflated. The existing
native executable and checkpoint matched and
`EXO_TEE_LOOP_MAX_TRIALS=3 npm run qa:tee-iteration-loop` returned
`complete: true` without executing any already-completed trial.

**Focused independent numerical QA:** the new paired-search and previous
single-flip, candidate-gate and contact-provenance suites passed **15/15**
tests (about **5.41 seconds** test-runner wall time). The paired two-sleeve
search plus independent fold/strain/contact measurements took approximately
**3.23 seconds** in one uncontrolled observation. Original project,
payload and sleeve source inputs passed JSON nonmutation checks. Native
builds were not attempted because free disk remained below **8 GiB**.
No installed app, editable garment, UI, branch, cache, checkpoint or
existing unrelated worktree change was modified.

**Next:** a topology-only two-flip neighborhood has not solved the slivers
or baseline thickness defects. Pursue a provenance-reconstructed crease
resampling / constrained local remeshing method, then require zero rest-mesh
quality and thickness defects before testing coupled four-panel bending
and independently verified static/trajectory contact. No safe avatar
entry, swept CCD, physically accepted seam closure or CLO3D parity is claimed.

## October 24 continuation — bounded crease-repair flip search exposes clearance/quality tradeoff (research only)

Added `src/core/backends/nativeCreaseRepairFlipSearchResearch20261024.js`
and `scripts/qa-exo-crease-repair-flip-search-20261024.mjs`. This
deterministic, non-mutating single-edge topology search enumerates strictly
convex, crease-preserving interior flips, prioritizes existing witness/sliver
neighborhoods, and runs each proposed triangulation through the previously
independent material-provenance and static-contact gate. It is capped at
**48 evaluations per sleeve** in this run (hard maximum 64); it never
installs a solver, applies a candidate, or changes an editable garment.

Both real Foundation Tee sleeves produced **155** geometrically possible
single-edge flips. The bounded first 48 were evaluated independently per
sleeve; **one** improved the discrete sub-1 mm static warning count, via
flipping material edge **91:111**. This is an **unsafe tradeoff, not a
physical improvement**: the smallest exact clearance and minimum triangle
altitude both worsened. The previous priority face pair **97/104** remains
at approximately **0.583618 mm**; the mesh still violates the 1 mm rule.

| Isolated sleeve, each side | Existing refined mesh | Exploratory 91:111 flip |
| --- | ---: | ---: |
| Ill-conditioned rest triangles | 15 | **15** |
| Minimum triangle altitude | 0.383907 mm | **0.327173 mm (worse)** |
| Maximum triangle aspect ratio | 85.495 | 82.307 |
| Disjoint sub-1 mm static warning pairs | 14 | **13** |
| **Smallest exact disjoint clearance** | 0.383907 mm | **0.327173 mm (worse)** |
| Flat static intersections | 0 | 0 |
| Flat static-contact validity / physical acceptance | Fail / No | **Fail / No** |

Independent candidate reconstruction at **0° and 75°** confirmed 13
static warnings, zero sampled triangle intersections, and negligible
principal extension/compression (<1e-9%) in both poses. Isolated underarm
maximum/RMS gaps are unchanged because no material vertex or sewing
endpoint moved: **345.000 / 332.617 mm** flat and
**273.707 / 263.883 mm** at 75°. The 180° endpoint remains invalid with
**359** static triangle intersections and **193** sub-thickness warning
pairs per sleeve. These are isolated rigid-half-fold material-space checks,
not coupled four-panel solver or swept-contact results. The last global
four-panel research baseline remains **345.000 mm maximum / 179.744 mm
RMS**, and the separate frozen two-panel native grid's lowest maximum is
**229.888 mm** with **146.609 mm RMS** and approximately **5%** principal
extension; none is physically accepted.

**Independent QA:** new bounded-search tests plus the preceding repair
gate, rest-contact provenance and isolated fold-contact suites passed
**14/14** with zero failures (about **2.09 s** test-runner wall time).
The new two-sleeve search and independent pose checks took approximately
**1.79 s** in one uncontrolled observation. Original source project,
native payload and refined sleeve inputs passed JSON nonmutation checks.
The existing experimental native binary SHA-256 still equals checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
The bounded `EXO_TEE_LOOP_MAX_TRIALS=3 npm run qa:tee-iteration-loop`
returned **10/10 already complete**, with **zero native trials repeated**.
Final available disk was approximately **5.70 GiB**, below the 8 GiB
native-build floor. No native build, installed app/UI/garment edit, cache
cleanup, branch reset, commit or push occurred.

**Next:** do not promote the tempting 14-to-13 warning-count flip.
Search multi-step constrained triangulations with a strict minimum-clearance
and minimum-altitude nonregression rule, or reconstruct interpolation-valid
crease sampling, and require **zero** slivers and **zero** sub-thickness
contacts before coupled bending. Avatar contact, safe entry, swept CCD and
CLO3D parity remain unverified.

## October 24 continuation — provenance-locked crease repair candidate gate (research only)

Added `src/core/backends/nativeCreaseRepairCandidateGate20261024.js`
and `scripts/qa-exo-crease-repair-candidate-gate-20261024.mjs`.
This is a **new bounded, fail-closed preflight for future topology-only sleeve
repair proposals**, not a remesh applied to a garment. It independently
recomputes material triangle conditioning and a 1 mm static intrapanel contact
screen. It requires unchanged original particle/sewing ownership, unchanged
original material coordinates, exact parent-edge interpolation for **every**
generated crease vertex, preserved boundary edges and area, consistent face
winding, manifold topology and constrained crease hinges separating opposite
material sides. Nonenumerable provenance additions, accessors, cyclic inputs,
bad budgets, moved material nodes and broken creases fail closed. A synthetic
alternative-diagonal proposal passes the *flat research geometry screen*,
while no candidate can be automatically applied or physically certified.

**Critical design constraint:** Simply nudging crease-generated nodes 100,
102 or 101 in material space, without reconstructing their parent-edge
interpolation, **violates material provenance** and is rejected. This makes
topology-only retriangulation the safe first repair class; a later genuine
vertex-resampling scheme must explicitly rebuild and validate provenance.
The gate does **not** claim that its limited planar area/boundary checks
constitute a full remesh certification or that flat static clearance proves
folded/continuous contact safety.

| Independent actual Foundation Tee sleeve gate (each side) | Existing refined mesh | Unchanged candidate control |
| --- | ---: | ---: |
| Ill-conditioned rest triangles | 15 | **15** |
| Static disjoint sub-1 mm near-clearance pairs | 14 | **14** |
| Static intersecting triangle pairs | 0 | **0** |
| Flat research geometry screen | Rejected | **Rejected** |
| Candidate installed / physically accepted | No / No | **No / No** |

This iteration deliberately **does not claim improved physical measurements**.
The previous isolated 0°→75° underarm maximum/RMS gaps remain
**345.000→273.707 mm / 332.617→263.883 mm** per sleeve, with negligible
principal extension/compression (<1e-9%) and failed static contact. The
historical **assembled four-panel** off-body result remains **345.000 mm
maximum / 179.744 mm RMS**, not directly comparable to isolated sleeve RMS.
No new avatar contact, 3D coupled pose or continuous trajectory was run.

**Independent QA:** the new candidate-gate suite plus prior provenance,
fold-contact and constraint-graph suites passed **15/15** in approximately
**0.404 s** runner time. The new two-sleeve flat gate took approximately
**65.8 ms** in one uncontrolled observation; it is not a native solver
benchmark. Source project, original native payload and all test candidates
passed nonmutation assertions. JavaScript syntax checks passed. The frozen
native **two-panel** executable/checkpoint still matched and the bounded
`EXO_TEE_LOOP_MAX_TRIALS=3 npm run qa:tee-iteration-loop` returned **10/10
complete** without repeating candidates. Storage was approximately **5.58
GiB** available, below the 8 GiB native-build floor. No native build,
checkpoint rewrite, cleanup, UI/garment/installed-app edit, branch reset,
commit or push occurred.

**Next:** generate new topology-only, crease/boundary-preserving triangulation
candidates around the witness neighborhood and run them through this gate.
Require zero slivers and a clear flat contact screen before any folded
candidate; then independently validate folded/coupled strain, full contact
and time-dependent swept CCD. The remaining 15 slivers, 14 static clearance
warnings and safe avatar entry are unresolved; CLO3D parity is not proven.

## October 24 continuation — pre-existing sleeve clearance blocker and crease-sliver provenance (research only)

Added `src/core/backends/nativeCreaseRestContactProvenanceResearch20261024.js`
and `scripts/qa-exo-crease-rest-contact-provenance-20261024.mjs`.
This **non-mutating diagnostic** distinguishes a clearance defect already
present in the flat material mesh from a new contact caused by the prescribed
fold. It independently audits rest-face quality, edge-connected material
topology, original-vs-new crease vertex provenance, and ranks crease nodes
touching poor triangles near the witness. No collision exclusions, solver
forces, rest coordinates, sewn endpoints or contact thresholds were changed.

**New root-cause finding:** the previously identified face pair **97/104** on
each sleeve is already separated by only **0.583618470 mm at 0°**. At the
previous 75° witness pose it remains **0.583618470 mm**. The experimental
1 mm clearance deficit is therefore **0.416381530 mm in the flat rest mesh**;
it was **not introduced by the 0°–75° fold**. The two faces are separated by
**three face-edge hops** in the material mesh, and **both are poorly conditioned**
(rest altitudes **0.705934 mm** and **1.282002 mm**). Of the **15** poorly
conditioned faces per sleeve, **15 touch the center crease and 15 touch
newly generated crease-intersection vertices**, while **none touches the
original material boundary**. This narrows a future repair to the interior
crease sampling/triangulation, but does not prove that relocating any vertex
would preserve the original material mapping or solve contact.

The first priority vertices for independent remeshing experiments are
**100, 102, 101** on each sleeve: all occur directly on the witness faces
and touch respectively **4, 4, 2** poorly conditioned triangles. Vertex 111
touches five poor triangles but is **five face hops** from the witness, so
it is a separate quality cluster rather than the first contact repair target.
The contact gate continues to reject both flat and folded configurations.

| Isolated sleeve measurement (per side) | Flat 0° | Fold 75° |
| --- | ---: | ---: |
| Maximum underarm seam gap | 345.000 mm | 273.707 mm |
| RMS underarm seam gap | 332.617 mm | 263.883 mm |
| Maximum principal extension/compression | ~0% / ~0% | <1e-9% / <1e-9% |
| Face 97/104 clearance | 0.583618 mm | 0.583618 mm |
| 1 mm static clearance rule satisfied | No | No |
| Ill-conditioned rest faces | 15 | 15 |
| Physical fit accepted | No | No |

**Independent QA:** new negative controls distinguish a pre-existing rest
clearance defect from a genuinely fold-introduced contact, and reject invalid
topology, missing intersection provenance, shared-vertex witness faces and
invalid budgets. On the actual two sleeves, an independent triangle-distance
oracle reconstructed both 0° and 75° gaps, independent rest-quality counts
matched the diagnostic, and the source project, native payload and refined
mesh passed JSON nonmutation assertions. The new and three prior relevant
research suites passed **15/15** (approximately **1.33 s** runner wall time).
The combined new provenance diagnostic and isolated two-angle fold QA took
approximately **227 ms** in one uncontrolled observation; it is not a native
solver throughput benchmark.

The separate **two-panel** native parameter checkpoint remains **10/10
complete**, with executable SHA-256
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`
matching the stored hash. The bounded `EXO_TEE_LOOP_MAX_TRIALS=3 npm run
qa:tee-iteration-loop` exited successfully with **zero candidates repeated**.
Free disk was approximately **6.65 GiB**, below the **8 GiB native-build
floor**; no native build, saved garment modification, cleanup, offload,
app/UI change, branch reset, commit, push or deployment occurred.

**Next:** prototype an explicitly opt-in, material-provenance-preserving
interior crease remesh around nodes 100/102/101, and independently require
improved conditioning **and** at least 1 mm rest clearance before running
coupled full-garment folds. Preserve all original sewing endpoints and material
boundaries. The historical global four-panel off-body baseline remains
345.000 mm maximum / 179.744 mm RMS; isolated sleeve values above are not
global assembly measurements. Continuous cloth/avatar CCD, safe avatar entry
and CLO3D parity remain unverified.

## October 24 continuation — conservative fold-interval clearance witness (research only)

Added `src/core/backends/nativeCreaseFoldIntervalContactResearch20261024.js`
and `scripts/qa-exo-crease-fold-interval-contact-20261024.mjs`.
The bounded, non-mutating interval screen evaluates **nonadjacent** material
triangle pairs along a prescribed rigid center-crease rotation. A midpoint
triangle-distance/AABB lower bound is reduced by a rigorous maximum vertex
arc-displacement bound over each angular subinterval; an unresolved bound,
sampled sub-thickness contact, or exhausted work budget **fails closed**.
It does not certify adjacent-hinge thickness, other garment panels, the avatar,
deformable dynamics or continuous collision safety for the assembled shirt.

**New independently reconstructed clearance witness:** on **both** refined
Foundation Tee sleeves, material faces **97 and 104** have **0.58361847 mm**
static separation at **75°** of the prescribed fold, violating the experimental
**1 mm** clearance. The independent triangle-distance oracle reproduced this
witness from the actual remeshed vertices, not from the interval-screen result.
The interval evaluator stopped at the first definite violating pair after
examining **11,889** disjoint-material face pairs, conservatively clearing
11,888 of those pairs over the requested **0°–150°** interval. It performed
53,989 bounded AABB checks and 28,328 triangle-distance evaluations per sleeve.
This is not an exhaustive count of all violating pairs, and no complete
garment collision clearance is implied.

| Measurement | Flat isolated sleeve | 75° witness pose | 150° isolated sleeve |
| --- | ---: | ---: | ---: |
| Maximum underarm sewing gap | 345.000 mm | **273.707 mm** | 89.293 mm |
| RMS underarm sewing gap | 332.617 mm | **263.883 mm** | 86.088 mm |
| Principal fabric extension/compression (independent rigid-fold audit at 75°) | ~0% | **<0.000000001%** | ~0% |
| Disjoint-material contact screen | Rejected | **Rejected: 0.584 mm < 1 mm** | Rejected |
| Ill-conditioned rest triangles per sleeve | 15 | 15 | 15 |
| Physically accepted / safe avatar entry | No / unverified | No / unverified | No / unverified |

The 75° seam residuals follow the independently tested exact rigid-half-fold
law `gap(angle)=gap(0)*cos(angle/2)`; they are **isolated underarm-only**
measurements, not new four-panel global seam residuals. The historical global
off-body four-panel baseline remains **345.000 mm maximum / 179.744 mm RMS**.
The 15 poor rest triangles per sleeve and the previous 14 near-clearance
warnings at each of 0°, 90°, and 150° remain unresolved.

**Independent QA:** `node --test scripts/qa-exo-crease-fold-interval-contact-20261024.mjs
scripts/qa-exo-underarm-crease-fold-contact-20261024.mjs
scripts/qa-exo-underarm-crease-constraint-graph-20261024.mjs`
returned **12/12 PASS**, about **1.32 s** runner wall time. Synthetic negative
controls prove that two clear endpoints can hide a midpoint collision, that
unresolved motion bounds and work budgets cannot pass, and that separated
faces can pass the restricted nonadjacent motion bound without ever granting
full CCD or physical acceptance. The two-sleeve interval screen plus
independent 75° strain/static-contact reconstruction took approximately
**1.05 s** in one uncontrolled observation, not a native
solver benchmark. Source project and native payload were unchanged.

The pre-existing native executable SHA-256 still matches checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
`EXO_TEE_LOOP_MAX_TRIALS=3 npm run qa:tee-iteration-loop` confirmed the
**two-panel** research grid is **10/10 complete** without repeating a trial.
Disk at final inspection was approximately **8.26 GiB** free. No native build
was attempted; no installed app, user UI, editable garment, existing branch,
unrelated worktree files, caches or checkpoints were reset, deleted or
replaced. No commit or GitHub push occurred.

**Next:** inspect the first sub-1 mm witness and 14 persistent near-clearance
pairs in the material mesh; correct boundary/crease-constrained topology and
15 ill-conditioned rest triangles per sleeve before proposing coupled full
garment bending. Independent static cloth/body and cloth/self checks plus
real swept CCD remain required for any physically accepted candidate.

## October 24 continuation — isolated articulated sleeve fold with independent static contact veto (research only)

**New source/test:** `src/core/backends/nativeUnderarmCreaseFoldContactResearch.js`
and `scripts/qa-exo-underarm-crease-fold-contact-20261024.mjs` construct
bounded material-space, **isolated sleeve** crease rotations using the
previously reconstructed, quality-rejected crease topology. The positive
material half rotates rigidly around x=0. The diagnostic independently
recomputes weighted underarm sewing residuals, principal triangle extension
and compression, and topology-aware static same-panel triangle contact for
each angle. This is not an avatar-positioned four-panel assembled pose, does
not integrate solver forces or install bending constraints, and cannot certify
a collision-free swept path.

| Isolated material-space fold, **per sleeve** | 0° | 90° | 150° | 180° |
| --- | ---: | ---: | ---: | ---: |
| Underarm maximum sewing gap (mm) | 345.000 | 243.952 | 89.293 | ~0 |
| Underarm RMS sewing gap (mm) | 332.617 | 235.196 | 86.088 | ~0 |
| Maximum principal extension/compression | ~0% | ~0% | ~0% | ~0% |
| Static intersecting same-panel triangle pairs | 0 | 0 | 0 | **361** |
| Static nonadjacent sub-1 mm clearance pairs | **14** | **14** | **14** | **195** |
| Rest triangles failing 2 mm / 25:1 gate | **15** | **15** | **15** | **15** |
| Contact-clear / physically accepted | No / No | No / No | No / No | No / No |

The other sleeve independently produces the same measurements. Each angle
checks **15,753 static triangle pairs per sleeve**. The 90° and 150°
folds improve intra-sleeve sewing gaps without measurable spectral strain,
but even the flat refined rest topology has 14 disjoint sub-thickness
clearance warnings per sleeve. At 180°, the ideal zero sewing gap coincides
with **361 positive-area triangle intersections per sleeve**. This is an
actual static geometric collision veto, not a full cloth-thickness or
continuous collision certificate. No avatar contact was evaluated for these
isolated poses. All candidates are explicitly rejected, including the
zero-gap endpoint. The historical **global four-panel** off-body baseline
remains **345.000 mm maximum / 179.744 mm RMS**, and cannot be numerically
compared to the isolated **underarm-only** RMS values above as a global
garment improvement.

**Independent QA:** `node --test` across the new fold-contact, preceding
crease-constraint-graph, crease-flip, crease-remesh and center-crease suites
returned **17/17 PASS** in approximately **0.504 seconds** total. Tests independently reconstruct the
rigid half-angle seam-gap law on synthetic and actual sleeve sewing pairs,
verify zero principal strain, require a static 180° overlap veto, check
the 14 baseline near-clearance warnings, reject invalid/repeated/budget-
exhausting trials, and confirm source project/payload nonmutation. One
uncontrolled real four-angle, two-sleeve run took **323.648 ms** within
the test; this is not a native solver performance measurement.

The pre-existing native executable SHA-256 still equals checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
`EXO_TEE_LOOP_MAX_TRIALS=3 npm run qa:tee-iteration-loop` verified the
**two-panel** native candidate grid is **10/10 complete**, with **zero new
trials**. Available disk was approximately **7.51 GiB**, above the 1 GiB
lightweight floor but **below the 8 GiB native-build threshold**. No native
build, app/garment/UI changes, cache cleanup, disk freeing, branch reset,
commit or GitHub push occurred.

**Next:** investigate and repair the 14 static near-clearance witnesses and
15 ill-conditioned rest triangles per sleeve without moving sewing endpoints,
crease edges or material boundaries. Only then consider coupling these
hinges to the full garment and checking bounded static/swept cloth contact,
avatar constraints and material strain. CLO3D parity, continuous collision
safety, and safe avatar entry remain unverified.

## October 24 continuation — quality-gated sleeve crease constraint-graph preview (research only)

**New source-level milestone:** `src/core/backends/nativeUnderarmCreaseConstraintGraphResearch.js`
and `scripts/qa-exo-underarm-crease-constraint-graph-20261024.mjs` build and
independently verify a **non-installed** material constraint-graph preview
from the previously refined sleeve crease mesh. The builder deduplicates
material structural edges with exact 2D rest lengths, computes per-face
inverse rest-shape matrices and areas, constructs two-face bending-hinge
adjacency, identifies the 20 x=0 crease hinges per sleeve, and maps original
direct or weighted underarm sewing endpoints back to their original local
vertices. Invalid budgets, malformed seams and impossible topology fail
closed. It does not integrate forces or install any constraints in the app.

| Independently reconstructed, **per sleeve** | Result |
| --- | ---: |
| Material vertices / triangles | **112 / 178** |
| Unique structural edges | **289** |
| Two-face bending hinges | **245** |
| Interior crease hinges | **20** |
| Original underarm sewing pairs retained | **5** |
| Ill-conditioned rest triangles | **15** |
| Minimum rest altitude / maximum aspect | **0.383907 mm / 85.495** |
| Quality-approved / solver-ready | **No / No** |

The new graph is a necessary structural/bending **preview**, not a
physically executable or contact-safe constraint system. Its 15 poor
triangles per sleeve still fail the 2 mm / 25:1 rest-mesh gate. Structural
and bending constraints remain **uninstalled**; there is no new folded 3D
pose, principal-strain result, static/swept cloth-contact result, avatar
entry validation, or seam-closure measurement. The last separately measured
four-panel off-body research pose remains **345.000 mm maximum /
179.744 mm RMS seam gap**, approximately zero measured principal extension
and compression, zero *sampled* avatar penetrations, and zero *flagged*
static fabric contacts. These are **historical baseline observations**, not
new measurements or a contact certificate for the remeshed topology.

**Independent QA:** 14/14 tests passed across four focused suites in
approximately **0.316 s** test-runner wall time. The new real-garment graph
reconstruction took **84.855 ms** in one uncontrolled run, not a native
solver benchmark. Tests reconstruct edge incidence, all inverse rest-shape
identities, rest lengths, areas, crease-side adjacency, direct and weighted
sewing ownership, and exact source project/payload nonmutation. The native
executable SHA-256 matches the frozen checkpoint; bounded
`EXO_TEE_LOOP_MAX_TRIALS=3 npm run qa:tee-iteration-loop` returned
**10/10 complete**, with **zero new trials**. Available disk was
approximately **3.56 GiB**, above the 1 GiB lightweight threshold but
below the 8 GiB native-build floor. No native build, UI/app/garment edit,
cleanup, deletion, reset, commit or push was performed.

**Next:** quality-preserving boundary/crease-constrained refinement with
validated sewing and rest-matrix remapping; only after all triangles pass
conditioning should a solver receive these structural and bending graphs
for independently checked 3D fold/strain/contact experiments. Continuous
collision safety, avatar entry, full physical sewing and CLO3D parity remain
unverified.

## October 24 continuation — constrained crease-edge flip refinement (research only)

**Concrete material-mesh improvement:** added
`src/core/backends/nativeUnderarmCreaseFlipRefinementResearch.js` and
`scripts/qa-exo-underarm-crease-flip-refinement-20261024.mjs`.
The new bounded, deterministic planar edge-flip pass starts from the
previously rejected crease-conforming sleeve remesh. It considers only
strictly convex adjacent-triangle quadrilaterals, forbids any change to
material boundaries or the 20 interior crease edges, preserves vertex/world
coordinates and original sewing endpoints, and accepts only flips that
reduce the count of 2 mm / 25:1 ill-conditioned triangles or lower a
secondary quality penalty without increasing that count. It never touches
the live garment, UI, native solver, or installed apps.

| Independent rest-mesh audit, **per sleeve** | Original sleeve | Prior crease split | New constrained flips |
| --- | ---: | ---: | ---: |
| Material vertices | 95 | 112 | **112** |
| Material triangles | 144 | 178 | **178** |
| Constrained interior crease edges | not executable | 20 | **20 retained** |
| Ill-conditioned triangles | 32 | 46 | **15** |
| Minimum altitude | 1.289695 mm | 0.327173 mm | **0.383907 mm** |
| Maximum aspect ratio | 32.550 | 139.611 | **85.495** |
| Material area | 0.0767925 m² | 0.0767925 m² | **0.0767925 m²** |
| Successful interior edge flips | — | — | **113** |
| Mesh conditioning accepted | No | No | **No** |

The improvement is substantial (**46 -> 15** poor triangles per sleeve,
31 fewer than the prior split and 17 fewer than the original sleeve),
but **15 remain**, the minimum altitude is far below 2 mm, and maximum
aspect is far above 25:1. It is **not** safe to build solver constraints
or simulate this mesh yet. The independent QA reconstructs the full edge
incidence and original boundary, checks every crease edge, verifies no
strict interior edge crossings, recomputes material area and triangle
quality, and checks original project/payload nonmutation. Zero-flip,
invalid-budget and nonmanifold negative controls also pass.

**QA:** 10/10 tests passed across the new constrained-flip suite, prior
crease-split suite, and center-crease suite, in approximately **0.44 s**
combined test-runner wall time. One uncontrolled full two-sleeve refinement
took **260.481 ms** within the test (not a native solver benchmark).
JavaScript syntax and `git diff --check` passed. Existing executable SHA
still matches the frozen checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Read-only resumable preflight confirmed **10/10 native candidates complete**,
zero remaining; no native candidates were repeated. Free disk was about
**3.75 GiB**, below the 8 GiB native-build floor.

**Physical comparison unchanged:** the last separately measured four-panel
off-body pose remains **345.000 mm maximum / 179.744 mm RMS seam gap**,
approximately zero measured principal extension/compression, zero sampled
avatar penetrations and zero flagged endpoint static contacts. These are
historical pose metrics; **no folded 3D pose was generated** from the
refined topology, so new principal strain, true cloth contact, swept CCD
and folded-pose runtime cannot be claimed. The source-state nonmutation
check passed. No native build, UI or garment save, cleanup, deletion,
reset, commit or push occurred.

**Next:** eliminate the remaining 15 poor triangles per sleeve through
validated boundary/crease-constrained Steiner refinement (with sewing and
constraint remapping), then rebuild structural/bending constraints and
evaluate modest non-overlapping fold angles under independent strain,
seam-group, avatar and cloth/cloth contact gates. No physical fit,
avatar-entry CCD or CLO3D parity certification is established.

## October 24 continuation — explicit crease-conforming sleeve remesh, with quality veto (research only)

Added `src/core/backends/nativeUnderarmCreaseRemeshResearch.js` and
`scripts/qa-exo-underarm-crease-remesh-20261024.mjs`. The bounded,
nonmutating remesher uses the previously verified underarm x=0 crease,
interpolates each shared crossing edge **once**, splits all 20 crossed
triangles per sleeve, and independently checks material area, winding,
boundary-edge subdivisions, nonmanifold edges, seam-vertex identity and
interpolated world positions. Each resulting triangle lies entirely on one
side of the crease. Two candidate diagonals for each clipped quadrilateral
are ranked by the 2 mm minimum-altitude / 25 maximum-aspect quality screen.
This is a *material topology research artifact*, not a folded garment, and
it does not regenerate structural or bending springs or modify the live mesh.

| Per sleeve, real four-panel Foundation Tee | Existing sleeve mesh | Research crease mesh |
| --- | ---: | ---: |
| Material vertices | 95 | **112** |
| Triangles | 144 | **178** |
| Shared crossing edges split | 0 | **17** |
| Interior crease-aligned edges | not executable | **20** |
| Material area | 0.0767925 m² | **0.0767925 m²** |
| Ill-conditioned triangles, independent 2 mm / 25 aspect screen | 32 | **46 (regression)** |
| Minimum altitude | 1.289695 mm | **0.327173 mm** |
| Maximum aspect ratio | 32.550 | **139.611** |

**Critical blocker:** although the remesh now exposes a crease-conforming
hinge graph and preserves area/boundary and original sewing endpoints,
triangulation **worsens material conditioning**. It is explicitly flagged
`qualityRegressed:true`, `qualityApproved:false`,
`meshConditioningCertified:false`, `safeToAutoApply:false`. The above
quality counts are *per sleeve under this independent screen*; they must
not be confused with the earlier 36 ill-conditioned faces reported by a
different whole-garment research gate. No constraint graph was rebuilt,
no 3D crease angle was applied and no new 3D seam, principal-strain or
contact measurements are available. The previous contact-clear research
pose remains 345.000 mm maximum / 179.744 mm RMS seam gap, ~0%
principal extension/compression, zero **sampled** avatar penetrations and
zero **flagged static** fabric contacts, but still physically rejected.

Independent tests check synthetic and real panels, material conservation,
shared edge interpolation, exact boundary subdivisions, triangle orientation,
sewing ownership, malformed world positions, nonmanifold inputs, budget
refusal and source-state JSON nonmutation. This research helper never claims
swept cloth/cloth CCD, safe avatar entry, physical fit or CLO3D parity.
Final syntax checks and four focused suites passed **14/14 tests**, about
**0.74 s** test-runner wall time. One uncontrolled real remesh diagnostic
took **12.93 ms**, not a native solver benchmark. The existing executable
SHA-256 matched its checkpoint (`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`);
read-only loop dry run confirmed **10/10 completed**, zero candidates left,
and no repeated native trial. Final disk headroom was about **3.58 GiB**,
below the **8 GiB** native-build floor. No native build, project/garment save,
UI or installed-app edit, cleanup, reset, commit, push or deployment.
Next: improve local crease-conforming triangle quality (possibly constrained
Steiner refinement) **before** regenerating native constraints or testing
collision-aware 3D fold angles. Do not promote the current sliver mesh.

## October 24 continuation — new sleeve center-crease topology proposal (research only)

Added `src/core/backends/nativeUnderarmCenterCreaseResearch.js` and
`scripts/qa-exo-underarm-center-crease-20261024.mjs`. This bounded,
nonmutating material-space diagnostic derives a straight fold line from the
actual intra-sleeve underarm sewing-pair midpoints, verifies that every pair
straddles it, and computes an **optimistic** 180-degree material reflection.
It independently counts existing triangles and edges that the crease cuts.
The result is a concrete remeshing target, **not** an executable fold, a new
solver, a safe collision path or a fit certificate.

Both real EXO Foundation Tee sleeves have five underarm pairs with symmetric
material x coordinates and a center crease at **x=0**. Their material-space
seam maximum/RMS are **345.000 / 332.617 mm** each. Reflecting one half of
the *ideal flat material* across that line makes both material-space residuals
**0 / 0 mm** in exact arithmetic. This is not a measured 3D candidate: at
180 degrees the fabric halves overlap, and fabric clearance is **not validly
established**. Crucially, the current triangulation has **20 faces crossed
by the required line, 17 intersected unique mesh edges and four vertices on
the line per sleeve**. The present hinge implementation rejects folds that
cut triangle interiors, so neither sleeve's center crease is currently
executable without a validated crease-conforming remesh and constraint-graph
reconstruction. This explains why tuning the 40 existing hinge sides cannot
close the underarm worst pairs, without ruling out newly meshed articulation.

For context, the earlier contact-clear *3D* research pose remains **345.000
mm global maximum / 179.744 mm global RMS**, with approximately zero measured
principal extension/compression, zero sampled avatar penetrations and zero
flagged static contact pairs, but **36 ill-conditioned rest triangles** and
no physical acceptance. Those are **prior pose measurements**; this new
material-space reflection has **no measured 3D seam, strain, contact or
runtime comparison** against an executable folded pose. A zero theoretical
material gap must never be reported as an accepted sewn garment.

Independent QA: **11/11 pass** across the new four-test crease suite and
existing finite-arc/rigid-reachability suites. The new real-fixture
crease inspection took approximately **7.18 ms** in one uncontrolled
observation; combined tests took approximately **0.74 seconds**. Project and
payload passed exact JSON nonmutation checks. Native checkpoint remains
**10/10 complete** and executable SHA-256 matches the stored hash; no
candidate was rerun. Available disk at preflight was **3.38 GiB**, below the
8 GiB native-build floor. No native builds, UI/installed-app edits, garment
saves, cleanup, resets, commits or pushes occurred. Next: construct a
topology-preserving, quality-audited x=0 sleeve remesh and then evaluate
non-overlapping fold angles with spectral strain, seam-group and swept-contact
gates; none of these are certified yet.

## October 24 continuation — exact finite-angle sleeve hinge reachability (research only)

**New source-level result:** `src/core/backends/nativeUnderarmFiniteArcReachabilityResearch.js`
computes the exact minimum sewing-pair gap attainable by each single
executable sleeve hinge over its entire signed ±π arc, using an analytic
rotation-circle bound rather than repeating the completed small-angle grid.
It handles direct and weighted sewing endpoints, validates actual interior
hinge-edge topology, rejects pins and malformed geometry, and leaves the
source garment unchanged. Its per-pair minima are **optimistic**: separate
sewing pairs may require incompatible angles, and no fabric contact, bending
energy or continuous collision condition is imposed on the analytic floor.

The **actual repaired four-panel Foundation Tee** was reconstructed from the
same protected-edge, clearance-repaired off-body fixture and its prior
front/back -0.10/+0.10 rad pose. Among **40 executable sleeve hinge sides**,
**zero** could reduce the 345 mm worst underarm sewing gap by even **0.01 mm**
over the full single-axis arc. The greatest mathematical apparent reduction
was **0.000001824 mm**, below meaningful geometric resolution and treated as
roundoff, not a feasible improvement. Thus the prior zero first-order
Jacobian is now complemented by a bounded **finite-angle** impossibility
result for this specific executable one-hinge family. This does **not** rule
out a newly remeshed fold line, multiple coordinated hinges or a validated
deformable solver.

An independent full-angle **negative control**, using one existing left
sleeve axis at -π radians, confirmed the analytic underarm prediction by
reconstructing actual triangle positions, then applying separate seam,
spectral-strain and contact screens:

| Metric | Contact-clear research baseline | Rejected single-hinge -π pose |
| --- | ---: | ---: |
| Global maximum seam gap | 345.000000 mm | **524.989979 mm** |
| Global RMS seam gap | 179.744026 mm | **229.467372 mm** |
| Target left underarm maximum/RMS | 345.000 / 332.617 mm | **345.000 / 332.617 mm** |
| Maximum principal extension/compression | <1e-9% / <1e-9% | **<1e-9% / <1e-9%** |
| Sampled avatar penetration points | 0 | **0** |
| Exact static inter-panel near-clearance pairs | 0 | **28** |
| Static same-panel nonadjacent near pairs | 0 | **2** |
| Ill-conditioned rest faces | 36 | **36 (same unchanged rest mesh)** |
| Physical research acceptance | Rejected | **Rejected** |

The static contact counts are clearance-screen findings, **not** a proof of
28+2 distinct penetrating locations. No swept cloth/cloth or avatar-entry
CCD was performed. The rejected fold is a geometric negative control, not
an alternative solver setting or candidate to apply. Source project, native
payloads, repaired mesh and research poses passed JSON nonmutation checks.

**Independent QA:** the new four-test finite-arc suite, the prior three-test
rigid-placement proof and four-test worst-pair Jacobian suite all passed:
**11/11**, approximately **0.93 seconds** combined in one run. Independent
synthetic controls establish exact full-arc closure for an actually
articulated rectangle, weighted seam agreement, invariance of same-side
pairs, rejection of boundary-only pivot axes and malformed weights/pins.
The real-pose analytic audit took **240.09 ms** in one uncontrolled
observation; it is not a native solver runtime benchmark. Syntax and
`git diff --check` passed.

The native two-panel checkpoint was independently checked read-only:
binary and parameter hashes match, **10/10 trials complete**, **zero
remaining**. No repeated native trials or builds were run. Disk headroom
fluctuated sharply during the run, dropping below 1 GiB at one inspection
and later reaching approximately **3.24 GiB**; it remained below the
**8 GiB native-build safety floor**. No cleanup, offload, installation,
garment save, UI change, reset, commit or GitHub push occurred.

**Next:** find or construct a *different* material-valid intra-sleeve
articulation whose axis separates the actual worst underarm endpoint pairs;
then verify both underarms' max/RMS reductions with independent
seam-group, principal strain, rest-conditioning and true cloth-contact
checks. The existing 36 sliver faces and swept CCD/avatar entry remain
unresolved. No CLO3D parity or fit certification is claimed.

## October 24 continuation — rigid-placement impossibility bound for sleeve underarms (research only)

**New source-level result:** `src/core/backends/nativeRigidSeamReachabilityResearch.js`
computes exact rigid-motion-invariant seam correspondences, per-group
maximum/RMS lower bounds and a global lower bound from the actual sewing
graph. `scripts/qa-exo-rigid-seam-reachability-20261024.mjs` independently
verifies those bounds under distinct 3D rigid motions of the left and right
sleeves. It includes weighted virtual sewing, ownership/budget/weight and
nonfinite negative controls. This does not modify a garment or production
solver and cannot certify material/contact safety.

**Critical correction to the previous proposed next step:** Both 345 mm
worst underarm sewing pairs are *intra-panel*, not sleeve-to-bodice pairs.
Particles **314 and 317** both belong to `sleeve-left`, and particles
**409 and 412** both belong to `sleeve-right`. Their material-space
separation is 345 mm in each sleeve. All **5/5** sewing correspondences in
each underarm group connect points on the same rigid panel. Consequently,
**no amount of whole-sleeve rigid translation or rotation can close these
underarm gaps**, regardless of how other panels are positioned. A different
*intra-panel* articulated fold, changed material topology or validated
deformation is necessary; rigid panel placement alone is provably
insufficient. This conclusion is limited to whole-panel rigid motion,
not arbitrary folding or cloth deformation.

| Four-panel repaired off-body pose | Measured / rigid-only floor |
| --- | ---: |
| Current maximum seam gap | **345.000000 mm** |
| Current global RMS seam gap | **179.744026 mm** |
| Rigid-only maximum gap lower bound | **345.000000 mm** |
| Rigid-only global RMS lower bound (102 sewing pairs) | **104.146567 mm** |
| Invariant sewing pairs | **10/102** |
| Each underarm rigid-only maximum/RMS floor (5 pairs) | **345.000000 / 332.617460 mm** |
| Maximum principal extension/compression | **< 1e-9% / < 1e-9%** |
| Sampled avatar penetrations, baseline and independent rigid motion | **0 / 0** |
| Exact static inter-panel near pairs, baseline and independent rigid motion | **0 / 0** |
| Static same-panel nonadjacent near pairs, baseline and rigid motion | **0 / 0** |
| Rest-mesh ill-conditioned triangles | **36 (unchanged)** |
| Physically accepted / swept CCD certified | **No / No** |

The RMS floor is only a mathematical lower bound under independent rigid
placement, **not** a predicted achievable RMS; the other 92 variable
sewing pairs, collisions and sewing topology impose additional constraints.
The independent rigid-motion negative control changed panel placement while
preserving both underarm maxima/RMS, rest strain and static contact screens.
It does **not** certify the intervening motion trajectory. The reachability
audit took approximately **4.37 ms** in one uncontrolled observation.

**Independent QA:** 14/14 tests passed in **~2.88 s** across the new
rigid-motion proof, previous worst-pair finite-difference Jacobian and
coupled trust-region suites. Syntax checks and `git diff --check` passed.
All source project, native payload, repaired mesh and research poses passed
nonmutation assertions. Native executable SHA-256 remains
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Read-only checkpoint dry-run verified **10/10 complete**, zero remaining,
so no native two-panel candidates were repeated. Disk was approximately
**3.24 GiB free**, above the lightweight 1 GiB threshold but below the
8 GiB native-build floor. No native builds, garment saves, installed-app/UI
edits, deletion, cache cleanup, branch resets, commits or pushes occurred.

**Next:** investigate a material-preserving *articulated* sleeve fold
capable of reducing both intra-panel underarm maxima, then independently
check seam-group regressions, principal strain, the 36 rest-mesh slivers,
cloth/cloth and cloth/avatar contacts along the complete trajectory.
Continuous CCD, safe avatar entry, complete physical assembly and CLO3D
parity remain unverified.

## October 24 continuation — exact underarm worst-pair hinge Jacobian (research only)

**New source and independent finite-difference QA:**
`src/core/backends/nativeUnderarmWorstPairJacobianResearch.js` and
`scripts/qa-exo-underarm-worst-pair-jacobian-20261024.mjs`.
Instead of repeating the completed 76-angle sleeve grid, this read-only
diagnostic enumerates each underarm's *individual worst sewing pair*, maps
its direct or weighted endpoints to the sleeve's actual material vertices,
and analytically differentiates the gap with respect to each currently
executable hinge angle. It independently validates interior mesh edges,
triangle-side partition, world-axis collinearity and pin compatibility.
The derivative is a **local first-order** geometric diagnostic, not a
finite-angle improvement, cloth-contact clearance or solver certificate.

On the already established, contact-clear front/back folded off-body
four-panel research pose (front -0.10 / back +0.10 rad), both underarms
have five sewing pairs. Their unique maximum-gap correspondences are:

| Underarm group | Worst pair index | Particle endpoints | Worst gap | Hinge axes moving at least one worst endpoint | Hinge axes with nonzero first-order gap derivative |
| --- | ---: | --- | ---: | ---: | ---: |
| Left | 0 | 314 / 317 | 345.000000 mm | 10 / 40 | **0 / 40** |
| Right | 0 | 409 / 412 | 345.000000 mm | 10 / 40 | **0 / 40** |

Thus the exact bottleneck is **not** that all hinge axes leave the endpoint
particles stationary: ten axes per underarm can move a worst-pair endpoint,
but their instantaneous motion is orthogonal to the pair's separation.
This explains why small signed hinge perturbations fail to reduce the
345 mm maximum *to first order*. It does **not** exclude second-order,
larger-angle, coupled multi-panel or translation-based improvements.
No additional native candidate, finite-angle grid or contact simulation
was run. The previously validated baseline remains **345.000 mm maximum /
179.744026 mm RMS**, with essentially zero principal extension/compression
in the off-body rigid-hinge pose and zero *previously sampled* avatar
penetrations and static/swept contact warnings. These are historical pose
observations, **not newly certified by the Jacobian**. The same research
mesh retains **36 ill-conditioned rest faces**; physical acceptance remains
**rejected**.

**Independent QA:** analytical derivatives agree with independently
measured centered finite differences for direct and weighted virtual
seams; malformed weights, absent groups, duplicate axes, non-interior
axes and moving pins fail closed. Real four-panel worst-pair endpoint
finite difference agrees. Four new tests passed; combined with the two
existing sleeve QA suites, **11/11 tests passed** in approximately
**2.72 s**. The read-only real-pose Jacobian took **7.9 ms** in one
uncontrolled observation (not a native solver benchmark). All original
project, native payloads, repaired graph and posed garment passed
JSON nonmutation checks. JS syntax and `git diff --check` passed.

Read-only native checkpoint dry-run confirmed matching binary and
parameters, **10/10 completed** two-panel trials and **zero remaining**;
none were rerun. Disk had approximately **3.30 GiB free**, above the 1 GiB
lightweight experiment floor but below the 8 GiB native-build floor.
No native build, installed-app/UI change, saved-garment write, cleanup,
deletion, reset, commit or push was performed.

**Next:** design a boundary-preserving underarm closure mode with
nonzero *first-order* leverage on particles 314/317 and 409/412, such as
paired rigid panel placement before constrained bending, and then require
both seam maxima and RMS, every seam group, principal strain, rest
conditioning, endpoint/static and conservative path contact gates to pass.
Continuous CCD, avatar-entry safety and CLO3D parity remain unverified.

## October 23 late continuation — independently ranked sleeve underarm hinge leverage (research only)

**New bounded source/test:** `src/core/backends/nativeUnderarmAxisLeverageResearch.js`
and `scripts/qa-exo-underarm-axis-leverage-20261023.mjs`. This is a
**geometry-only** diagnostic, not a coupled contact-safe solver or fitted pose.
It ranks both signs of previously untested sleeve fold axes against their
actual five-pair underarm seam residuals, rejects malformed/duplicate axes,
requires complete named seam evidence, and avoids letting floating-point
noise (~1e-14 mm) outrank measurable RMS changes. It never changes a saved
garment or allows automatic promotion.

The preflight read `docs/qa/clothcraft-tee-loop-20261022.json`, the current
worktree and this report. The existing native binary SHA-256 still equals
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Read-only resumable preflight confirmed **10/10 completed, zero remaining**;
no native candidate was rerun. Disk free was **~3.83 GiB**, sufficient for
small source QA but below the **8 GiB native-build safety floor**.

Starting from the existing repaired four-panel front -0.10 / back +0.10 rad
off-body research pose (**345.000000 mm max**, **179.744026 mm RMS**), the
ranking screened **38 new sleeve axes x 2 angles = 76 single-hinge geometry
probes**, excluding both previously tested `33,34:positive` sleeve axes.
**16/38** axes measurably changed an underarm residual, but **0/38** reduced
the underarm *maximum* seam gap. This is a negative feasibility result for
the currently executable hinge family, not a claim that sleeve assembly is
mathematically impossible under a different fold graph.

The top nonregressing geometry-only observation was
`sleeve-left:22,59:positive` at **-0.04 rad**. Its left underarm RMS fell by
**0.0068775 mm** but its maximum remained **345.000000 mm**; the global RMS
fell only **179.744026 -> 179.743402 mm** (~0.000624 mm), with unchanged
global maximum. Independent endpoint reconstruction confirmed the underarm
numbers. Maximum principal extension/compression remained below **1e-9%**;
sampled avatar penetrations and exact *endpoint* static inter-panel near
pairs were both **0**. The mesh still has **36 ill-conditioned rest faces**.
No sampled motion-path or continuous collision certificate was established,
and this observation **fails** research acceptance.

**Independent QA:** 3/3 new tests passed in ~0.86 s, including a synthetic
positive-leverage control, malformed/duplicate/excluded-axis negatives, and
actual repaired four-panel integration with independent seam, principal
strain, endpoint avatar and exact static contact recomputation. Combined with
three earlier scoped coupled-folding suites, **16/16** tests passed in ~4.40 s.
The ranking took ~0.40-0.50 s in uncontrolled observations, not a native
solver benchmark. Source project, native payloads, repaired graph and pose
passed JSON nonmutation checks. No build, app/UI edit, saved-garment change,
cache cleanup, deletion, reset, commit or push occurred.

**Next:** identify which *individual maximum-gap sewing pairs* lie outside
every current executable hinge's moving material side; propose a new
boundary-preserving hinge line or paired panel translation that actually
reduces both 345 mm underarm maxima. Require full contact and all-group
regression gates before evaluating any candidate for physical acceptance;
repair the 36 rest slivers independently. Continuous cloth/cloth and
cloth/avatar collision certification, safe avatar entry and CLO3D parity
remain unverified.

## October 23 continuation — paired sleeve-underarm leverage audit (research only)

**New bounded source and independent test:**
`src/core/backends/nativeSleeveUnderarmCouplingResearch.js` and
`scripts/qa-exo-sleeve-underarm-coupling-20261023.mjs`. The new evaluator
requires valid, identity-stable five-pair left/right underarm seam groups,
explicitly tests whether **both** underarm maxima improve, and preserves the
existing fail-closed principal-strain, named-group regression, sampled avatar,
static cloth and conservative swept-contact screens. It rejects duplicate or
oversized candidate grids and checks source JSON nonmutation. It never saves
or promotes an experimental garment and never certifies swept CCD.

The existing two-panel executable/checkpoint still match on read-only dry
run: **10/10 complete, zero remaining**, so no native trial was repeated.
Free disk at preflight was approximately **2.91 GiB**, above the 1 GiB
lightweight experiment floor but below the 8 GiB native-build floor. The
four new trials instead start from the previously repaired, contact-clear
four-panel **front −0.10 / back +0.10 rad** research pose (345.000 mm max,
179.744026 mm RMS) and move both sleeve hinges at the previously untested
paired angles below:

| Left/right sleeve angles | Max seam gap (mm) | RMS seam gap (mm) | Both underarm maxima improved? | Per-group regressions | Static/swept cloth potentials |
| --- | ---: | ---: | --- | ---: | ---: |
| −0.04 / +0.04 rad | 345.000 | 179.780924 | No | 4 | 0 / 0 |
| −0.08 / +0.08 rad | 345.000 | 179.843481 | No | 4 | 0 / 0 |
| +0.04 / −0.04 rad | 345.000 | 179.732863 | No | 4 | 0 / 0 |
| +0.08 / −0.08 rad | 345.000 | 179.747458 | No | 4 | 0 / 0 |

**New bottleneck diagnosis:** The selected executable sleeve hinges
(`axisVertices=[33,34]`, positive side on each sleeve) move fabric but have
**zero measurable leverage** over either five-pair underarm group: both
groups remain **345.000 mm max / 332.617460 mm RMS** across all four probes.
Even the tiny 0.011163 mm global RMS improvement in the third trial does
not improve either underarm or prevent four other seam-group regressions.
All four retain **36 ill-conditioned rest faces**, near-zero principal
extension/compression (<1e-9%), zero sampled avatar penetrations and zero
flagged conservative static/swept cloth potentials. **0/4 research eligible**;
no claim of continuous collision safety or fit.

**Independent QA:** four new negative-control/integration tests plus twelve
existing independent trust-region, sampled-exact-contact and post-flip
trajectory tests passed **16/16** in approximately **4.12 s**. The four new
paired sleeve evaluations each took approximately **0.74–0.91 s** in this
uncontrolled run, not a native solver benchmark. Independent endpoint seam,
principal strain and exact static contact recomputation agreed with the new
probe. Original project, payloads, repaired graph and staged pose passed
JSON nonmutation checks. JavaScript syntax and scoped diff checks passed.
No native build, checkpoint rewrite, saved garment/UI/installed-app change,
cleanup, deletion, branch reset, commit or GitHub push was performed.

**Next:** avoid repeating these zero-leverage sleeve axes. Independently rank
alternative sleeve fold axes by whether they actually move the underarm
sewing correspondences, then test a small new coupled candidate grid with
both underarm maxima, all seam groups, strain, rest conditioning and cloth
contact gated. Correct the 36 rest slivers before physical acceptance.


## October 23 continuation — bounded contact-clear coupled-hinge trust region (research only)

**New source/test:** `src/core/backends/nativeCoupledAngleTrustRegionResearch.js`
and `scripts/qa-exo-coupled-angle-trust-region-20261023.mjs` introduce a
bounded **1–6 candidate** trust-region screen on the actual repaired four-panel
Foundation Tee. Unlike a global Pareto-only score, the new fail-closed screen
requires **both** maximum and RMS seam gaps to improve, every named sewing
group to remain nonworse, acceptable principal strain, pinned/anchor fidelity,
no sampled avatar penetration, no unresolved conservative static/swept cloth
contact, and zero ill-conditioned rest triangles. Invalid, nonfinite,
contradictory or incomplete evidence is rejected. No result can be promoted to
an installed garment or certified as swept CCD or safe avatar entry.

The prior **two-panel native** executable SHA-256 still matches checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`;
read-only `--dry-run` showed **10/10 completed, zero remaining**. No completed
native candidate was repeated. Instead, four **new** paired hinge-angle trials
were evaluated in memory on the repaired **four-panel** off-body garment:

| Front/back angles (radians) | Max seam before → after (mm) | RMS seam before → after (mm) | Conservative cloth-contact potentials (static/swept) | Research acceptance |
| --- | ---: | ---: | ---: | --- |
| −0.025 / +0.025 | 345.000 → 345.000 | 192.074 → **188.375** | 0 / 0 | Rejected |
| −0.050 / +0.050 | 345.000 → 345.000 | 192.074 → **185.072** | 0 / 0 | Rejected |
| −0.075 / +0.075 | 345.000 → 345.000 | 192.074 → **182.188** | 0 / 0 | Rejected |
| −0.100 / +0.100 | 345.000 → 345.000 | 192.074 → **179.744** | 0 / 0 | Rejected |

For all four, named seam groups were nonworse, sampled avatar penetrations
were **zero**, principal extension/compression stayed below **1e-9%**, and
the conservative sampled/static plus inter-sample broadphase screens flagged
**zero** cloth-contact potentials. This is a **bounded conservative screen**,
not complete swept narrow-phase CCD or proof of avatar-entry safety.
The independent endpoint check on the strongest −0.1/+0.1 trial reconfirmed
**179.744026 mm RMS**, **345.000 mm maximum**, **zero exact static inter-panel
near-clearance pairs**, **zero same-panel static intersections**, and negligible
principal strain. It identified the unchanged worst-gap bottlenecks as
`seam-sleeve-l-underarm` and `seam-sleeve-r-underarm`. Every candidate still
has **36 ill-conditioned material-rest triangles**, and none improves the
maximum seam gap; **0/4** passes the research gate. The prior −0.15/+0.15
trajectory with 15 proven piercing face pairs remains rejected and was not
included in this new angle grid.

**Independent QA:** six negative/contract controls plus the actual four-panel
integration test, and three existing independent trajectory/penetration suites,
passed **16/16** in approximately **3.05 seconds** in a parallel test run.
The four new coupled audits individually took approximately **0.52–0.71 s**
in that uncontrolled run, not a native solver benchmark. Source project,
original/optimized payload, staged garment and rebuilt constraint graph
passed JSON nonmutation assertions. Disk free at final test was approximately
**2.22 GiB**, above the 1 GiB research threshold but below the separate
**8 GiB native-build floor**. No native build, checkpoint rewrite, saved
garment, installed app/UI edit, cleanup, deletion, branch reset, commit,
push or deployment was performed.

**Next:** target the two sleeve-underarm maximum-gap groups with material-
preserving, group-nonregressing coupled motion while retaining the now-
identified front/back contact-clear angle region. Repair the remaining 36
rest slivers with regenerated constraints before attempting research
acceptance. Continuous cloth/avatar CCD, safe avatar entry, physical fit and
CLO3D parity remain unverified.

## October 23 continuation — all eleven sewing-incident contact pairs are proven piercings (research only)

**New independent regression:**
`scripts/qa-exo-sewn-geometry-adjudication-20261023.mjs` reconstructs the
existing repaired four-panel tee in memory, reproduces the previously rejected
front −0.15 / back +0.15 rad hinge candidate, and geometrically adjudicates
**all eleven** exact static sub-1 mm face pairs previously labelled
`sewing_boundary_incident_faces` on `seam-side-r`. It independently calls the
strict transverse edge/triangle crossing oracle; mere adjacency to a sewing
correspondence is never treated as permission to penetrate fabric.

| Exact static contact classification at rejected endpoint | Face-pair count |
| --- | ---: |
| Sewn-boundary-incident **strict transverse piercings** | **11 / 11** |
| Previously adjudicated unmatched strict transverse piercings | 4 / 5 |
| Previously adjudicated unmatched disjoint but sub-1 mm clearance | 1 / 5 |
| All exact static near-clearance face pairs | **16** |
| Total proven transverse piercing face pairs | **15** |
| Unresolved conservative inter-sample swept warnings | **20** |

The eleven sewn-incident pairs are front/back face indices
`(53,53), (53,55), (54,54), (54,61), (55,55), (57,57), (57,59),
(59,54), (59,59), (61,53), (61,61)`; all have independently verified strict
interior crossings. **Fifteen face-pair witnesses do not imply fifteen distinct
physical crossing locations.** None of the 16 contacts is certified safe;
the sewing association cannot be used to suppress any collision veto.

The rejected research candidate's metrics are unchanged: max seam gap
**345.000 → 345.000 mm**, RMS seam gap **192.074423 → 176.246380 mm**,
principal extension/compression **<1e-9%**, sampled avatar penetrations **0**,
and **36** ill-conditioned material-rest faces. The new test additionally
checks a synthetic *sewn* but strictly piercing triangle pair, retained
no-exemption flags, full witness completeness, exact face identities, and
JSON nonmutation of the original project and every intermediate source.

**QA:** `node --test scripts/qa-exo-sewn-geometry-adjudication-20261023.mjs
scripts/qa-exo-interpanel-penetration-witness-20261023.mjs
scripts/qa-exo-sewn-contact-topology-20261023.mjs` passed **12/12** in about
**1.21 s**, including the fixed-face assertions and the synthetic sewn-piercing
negative control. One real tee diagnostic took approximately **1.08 s** in an
uncontrolled parallel test run, not a native benchmark.
Read-only checkpoint preflight verified executable SHA-256
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`
and **10/10 completed two-panel candidates**, so no trial was repeated.
Available storage was approximately **2.21 GiB**, below the **8 GiB** native
build threshold. No native build, production solver, UI, saved garment,
installed app, worktree cleanup, commit, or GitHub push was attempted.

**Next:** redesign or constrain coupled motions to avoid *all* proven strict
crossings, reduce both maximum and RMS seam separation without individual
seam-group regression, and independently resolve 36 rest-mesh slivers and
continuous cloth/self and cloth/avatar collision safety. The current pose
remains **rejected**; neither swept CCD nor safe avatar entry nor CLO3D parity
has been established.

## October 23 continuation — four unmatched front/back pairs are proven transverse piercings (research only)

**New independent source-level diagnostic:**
`src/core/backends/nativeInterpanelPenetrationWitnessResearch.js` classifies
bounded exact static inter-panel witnesses using **strict interior segment/
triangle plane crossings**, independently measured triangle distance and
positive-area coplanar polygon clipping. A proper transverse witness requires
an edge to cross the opposite triangle's plane strictly on both sides and
strictly inside the target face; grazing, shared-point and numerically
ambiguous zero-gap cases remain unresolved rather than falsely certified.
The helper rejects stale face/distance evidence, malformed/degenerate geometry,
over-budget inputs and nonfinite positions. It never waives a contact veto,
changes the live solver, or certifies swept CCD.

**Actual repaired four-panel Foundation Tee:** On the rejected front -0.15 /
back +0.15 rad coupled trajectory, the previously identified **five unmatched**
front/back face pairs are now resolved more precisely:

| Front/back faces | Measured gap | Strict static geometry |
| --- | ---: | --- |
| (52,52), (52,60), (55,52), (60,60) | 0 mm each | **4 proven transverse piercings** (two geometric crossing locations, seen by four face pairs) |
| (52,55) | **0.390354849 mm** | Disjoint faces but below the research 1 mm clearance |

The two independently located transverse intersection points are approximately
`(0.124454, 0.988781, 0.370821) m` and
`(0.087132, 0.925284, 0.376238) m` in the rejected off-body research pose.
The other **11 sewing-boundary-incident face pairs** remain subject to the
unchanged contact veto; their closest points were not adjudicated in this
iteration. **This is evidence of actual panel piercing**, not merely a zero
distance or a conservative bounding-box warning.

| Repaired tee measurement | Before front/back hinges | After front/back hinges |
| --- | ---: | ---: |
| Maximum seam gap | 345.000 mm | **345.000 mm** |
| RMS seam gap | 192.074423 mm | **176.246380 mm** |
| Maximum principal extension/compression | approximately 0% | <1e-9% / <1e-9% |
| Sampled avatar penetrations | 0 | **0** |
| Confirmed exact inter-panel sub-1 mm pairs | 0 | **16** |
| Unresolved swept inter-panel potentials | — | **20** |
| Ill-conditioned material rest triangles | 36 | **36** |
| Physically accepted | No | **No** |

**Independent QA:** New
`scripts/qa-exo-interpanel-penetration-witness-20261023.mjs` includes strict
transverse crossing, grazing-point negative control, coplanar area overlap,
disjoint submillimetre thickness, stale/invalid input and the real four-panel
five-pair fixture with source-state nonmutation. Alongside five established
contact/sewing/hinge suites, **23/23 tests passed** in an approximately
**2.50-second** final parallel test run (uncontrolled). A real fixture audit took
about 1–2 seconds depending on concurrent test activity, not a native solver
benchmark. The native two-panel executable/checkpoint was verified read-only:
**10/10 completed**, zero remaining candidates; no trial was repeated.
Storage was approximately **2.01 GiB free** at preflight and **1.71 GiB** at
final read-only verification, below the separate 8 GiB native-build safety
floor. No native build, saved garment/UI/installed-app
change, deletion, cache cleanup, branch reset, commit or GitHub push.

**Next:** Reject the two strict crossing locations in any candidate trajectory,
then search bounded alternative front/back hinge angles or geometry-preserving
motions that remove these crossings while decreasing **both** maximum and RMS
seam gaps. Resolve the 11 remaining sewing-incident contacts geometrically,
20 swept-contact warnings and 36 ill-conditioned rest triangles independently.
No avatar-entry continuous collision certification, physical fit or CLO3D
parity is established.

## October 23 continuation — exact-contact sewing topology classification (research only)

**New bounded, independent contact diagnostic:** The exact static inter-panel
screen now supports an opt-in maximum of 256 retained witnesses (default eight),
with an explicit completeness flag. The coupled sampled-witness collector
supports the same bounded full-evidence option, while keeping its cumulative
pair budgets and conservative swept-contact veto unchanged. New
`src/core/backends/nativeSewnContactWitnessTopologyResearch.js` checks each
retained exact face pair against **actual direct and weighted virtual sewing
correspondences** and the material mesh's boundary edges. It distinguishes
sewing-correspondence-incident faces from unmatched contacts, rejects malformed
or incomplete evidence, and **never exempts either class from collision
checks**. Sewing adjacency does not establish that the closest geometric
contact point lies on an intended seam.

**Actual repaired four-panel Foundation Tee:** On the previously rejected
front −0.15 / back +0.15 rad off-body trajectory, retaining all 16 exact
sub-1 mm inter-panel witnesses reveals:

| Sampled contact classification | Count |
| --- | ---: |
| Exact static sub-1 mm face pairs (all at stage 2, final hinge endpoint) | **16** |
| Faces incident to a shared sewing correspondence on both boundaries | **11** |
| Shared sewing supports only on interior faces | **0** |
| No matching sewing correspondence on the two faces | **5** |
| Witnesses missing due to evidence cap | **0** |
| Unresolved conservative swept inter-panel potentials | **20** |

The eleven sewing-incident witnesses all reference `seam-side-r`, but are
**not certified as intentional seam contact**. The five unmatched face pairs
include front/back face indices `(52,52)`, `(52,60)`, `(55,52)`,
`(60,60)` at 0 mm and `(52,55)` at **0.390355 mm**. These are targeted
geometric investigation priorities, not proven penetrations: a zero triangle
distance can indicate touching, overlap or piercing. No clearance threshold
was relaxed and no contact veto was removed.

| Repaired off-body four-panel measurement | Before hinge pair | After hinge pair |
| --- | ---: | ---: |
| Maximum seam gap | 345.000 mm | **345.000 mm** |
| RMS seam gap | 192.074423 mm | **176.246380 mm** |
| Maximum principal extension / compression | ~0% / ~0% | <1e-9% / <1e-9% |
| Sampled avatar penetrations | 0 | **0** |
| Ill-conditioned material rest faces | 36 | **36** |
| Research acceptance | No | **No** |

This classification adds evidence, not a new accepted pose. The unchanged
front/left-sleeve candidate still regresses two back sleeve seam groups and
also leaves the 345 mm maximum seam gap. Independent source/test regression
suite: **22/22 PASS**, ~**5.71 s** (six sequential suites), including
malformed correspondence and witness-budget negative controls, real 16/11/5
counts, no contact exemption, and JSON nonmutation of original project,
payload, repaired graph and poses. One full real-fixture classification audit
took ~**1.02 s** in an uncontrolled observation, not a native solver benchmark.

**Safety:** The existing two-panel native checkpoint was verified by
read-only dry run: binary SHA
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`
matches, grid **10/10 complete**, no remaining candidates or repeats.
Initial disk available ~**2.32 GiB**, below the 8 GiB native-build floor.
No native build, installed app/UI edit, saved garment change, deletion, cache
cleanup, branch reset, commit, GitHub push or deployment. Changes remain
research-only and uncommitted.

**Next:** independently locate geometric closest points for the five
unmatched front/back face pairs and test whether they represent actual
penetration versus non-sewn boundary touching. Do not waive the eleven
sewing-incident pairs without geometric proof. Pursue coupled movement
reducing **both** max and RMS seam gaps, no per-group regressions, valid
conditioned rest triangles and continuous contact checks. No avatar-entry
CCD, physical-fit or CLO3D-parity certification is claimed.

## October 23 continuation — independent exact static witnesses locate real front/back contact blockers

**New source-level research diagnostic:**
`src/core/backends/nativeCoupledExactSampleWitnessResearch.js` accepts an
explicit, bounded sequence of coupled hinge poses and independently measures
**exact static** inter-panel triangle separation at every sampled pose. It
reports AABB potential counts alongside actual sub-clearance pairs, nearest
face identities and per-stage witnesses. The aggregate work budget is
preflighted, and the narrowphase budget is cumulative; invalid or collapsed
triangles fail closed. It does not modify or relax the conservative swept
contact gate, solver, UI, editable garment, or installed application. It
explicitly refuses to certify swept CCD, avatar entry, fit, or autoapplication.

**Actual repaired four-panel Foundation Tee (7 sampled poses per trajectory):**

| Research measurement | Front/back hinges | Front/left sleeve hinges |
| --- | ---: | ---: |
| Initial max / RMS seam gap | 345.000 / 192.074423 mm | 345.000 / 192.074423 mm |
| Candidate max / RMS seam gap | **345.000 / 176.246380 mm** | **345.000 / 182.760277 mm** |
| Maximum principal extension/compression | <1e-9% / <1e-9% | <1e-9% / <1e-9% |
| Sampled avatar penetration count | 0 | 0 |
| Static inter-panel AABB potentials | **67** | **0** |
| Independently confirmed sub-1 mm static triangle pairs | **16** | **0** |
| AABB-only false alarms at sampled poses | **51** | **0** |
| Unresolved conservative swept inter-panel potentials | **20** | **0** |
| Ill-conditioned rest faces | **36** | **36** |
| Physical research acceptance | **Rejected** | **Rejected** |

The front/back trajectory has **16 genuine static zero-or-submillimetre
separations**, not merely 67 AABB false positives. The closest sampled
front/back face witnesses include `(52,52)`, `(52,60)` and `(53,53)` at
**0 mm measured distance** at the final second-hinge endpoint. A zero
triangle distance does not by itself distinguish intended sewing-boundary
touching from unintended panel penetration; classify those pairs against
actual sewing topology before proposing a contact-aware repair. The
front/left-sleeve candidate has no sampled inter-panel contacts, but still
regresses two left-sleeve/back seam groups. Neither candidate improves
maximum seam gap; neither is acceptable, and discrete samples cannot prove
collision-free motion between them. The 36 rest-face defects remain blocking.

**Independent QA:** new
`scripts/qa-exo-coupled-exact-sample-witness-20261023.mjs` covers a proven
AABB false alarm, an actual zero-gap negative control, cumulative budget
exhaustion, invalid/degenerate geometry, real seven-pose reconstruction,
strict 67/16 and 0/0 regression counts, and JSON source nonmutation. Together
with existing exact-static, coupled-trajectory, hinge-tolerance and rebuilt
constraint-graph suites, **17/17 tests passed** in approximately **2.11 s**.
Source syntax checks passed. Individual combined coupled-plus-exact audits
took approximately **847 ms** (front/back) and **890 ms** (front/sleeve),
uncontrolled research observations, not native solver benchmarks.

**Checkpoint and safety:** verified existing binary/checkpoint parameters via
read-only native dry run; the two-panel grid remains **10/10 complete**, zero
remaining, and no candidates were rerun. Free disk at final check was about
**4.58 GiB**, below the 8 GiB native-build threshold. No native build,
garment save, UI/installed-app change, cache deletion, branch reset, commit,
GitHub push or deployment. Changes are local, research-only and uncommitted.

**Next:** classify the 16 sampled front/back close pairs by sewing-boundary
adjacency versus unintended intersection, while retaining conservative
swept-contact rejection. Then search for material-preserving motion that
reduces **both** maximum and RMS seam gaps, fixes the 36 rest-face defects,
and does not regress any individual sewn group.

## October 23 continuation — first independently gated coupled hinges on repaired four-panel graph (research only)

**New test-level integration:** `scripts/qa-exo-postflip-coupled-trajectory-20261023.mjs`
now reconstructs the actual Foundation Tee's two independently certified
contact-repair flips, rebuilds all native structural/bending springs and
collision exclusions, and executes **two distinct sequential two-hinge
trajectories** against the independently implemented coupled seam, principal
strain, sampled avatar, static cloth and conservative swept-contact gates.
This is the first bounded end-to-end coupled-folding QA on the **repaired
constraint graph**, rather than repeating the pre-repair contact witness.
Neither trajectory is applied to the garment or accepted as a solver result.

| Repaired off-body four-panel research pose | Initial | Front −0.15 rad / back +0.15 rad | Front −0.15 rad / left sleeve +0.15 rad |
| --- | ---: | ---: | ---: |
| Maximum seam gap | 345.000 mm | **345.000 mm** | **345.000 mm** |
| RMS seam gap | 192.074423 mm | **176.246380 mm** | **182.760277 mm** |
| Maximum principal extension | ~0% | < 0.000000001% | < 0.000000001% |
| Maximum principal compression | ~0% | < 0.000000001% | < 0.000000001% |
| Sampled avatar penetrations | 0 | 0 | 0 |
| Same-panel static near-clearance pairs | 0 | 0 | 0 |
| Static self-intersections | 0 | 0 | 0 |
| Inter-panel potential contacts over sampled poses | — | **67** | **0** |
| Unresolved swept inter-panel potentials | — | **20** | **0** |
| Unresolved swept same-panel potentials | — | 0 | 0 |
| All sewn seam groups nonworse | — | Yes | **No** |
| Ill-conditioned rest faces | 36 | **36** | **36** |
| Research screen accepted | No | **No** | **No** |

The **front/back** motion produces a measurable **15.828043 mm RMS reduction**
without measurable material strain, and passes per-seam-group Pareto checks,
but **fails cloth-contact clearance** (67 sampled broadphase potential
contacts and 20 unresolved swept inter-panel potentials). These counts
are conservative *potential* contacts, not proven penetrations. The
**front/left-sleeve** motion produces a **9.314147 mm RMS reduction** with
zero flagged cloth-contact potentials, but worsens two independent seam
groups: `seam-sleeve-l-back-lower` (+3.842685 mm maximum / +2.452174 mm RMS)
and `seam-sleeve-l-back-upper` (+1.182710 mm maximum / +0.819216 mm RMS).
**Neither reduces maximum seam separation**. Both retain **36**
ill-conditioned material rest faces, so neither is physically accepted.
These are distinct blockers; a global RMS reduction must not override
either a cloth-contact veto or a regressing sewn seam group.

**Independent QA:** new integration test **2/2 passed**. Together with
existing protected flip, graph reconstruction and hinge-tolerance suites,
**12/12 passed** in about **2.13 seconds** of test-runner wall time.
Two individual coupled audits took **817.98 ms** and **750.16 ms**;
these are uncontrolled research observations, not native solver benchmarks.
The test independently remeasures final seam residuals and verifies
byte-for-byte JSON nonmutation of project, baseline, optimized mesh,
off-body pose and repaired graph. JavaScript syntax and scoped diff checks
passed. The existing native two-panel checkpoint was checked with the
script's **dry-run**: binary and parameter hashes match, **10/10 complete,
zero remaining**, no candidate repeated. Disk available was approximately
**4.8 GiB**, below the **8 GiB** native-build floor. No native builds,
garment saves, UI/installed-app changes, deletes, cache cleanup, resets,
commits, GitHub pushes or deployments occurred.

**Next blocker-directed step:** diagnose the 67 inter-panel potential pairs
for the front/back motion using exact static narrowphase and conservative
swept witnesses, while developing a candidate that reduces *both* global
maximum/RMS seam gaps without regressing either underarm seam group.
The 36 rest-mesh conditioning failures remain a separate hard veto. Static
screens and hinge samples do **not** certify swept triangle CCD, safe avatar
entry, physical fit or CLO3D parity.

## October 23 continuation — certified-flip constraint graph rebuilt in memory (research only)

**Concrete source-level improvement:** added
`src/core/physics/nativeFlipConstraintGraphResearch.js`, an **opt-in,
transactional** adapter for previously certified single-edge material flips.
It accepts a frozen native payload plus face replacements, independently
rechecks material-edge certificates and protected hinges, and rebuilds the
structural springs, bend springs and collision exclusions on a cloned payload.
It rejects stale source graphs, unsupported non-isometric rest lengths,
ambiguous directional stiffness, corrupt spring properties, nonplanar rest
coordinates, nonmanifold faces and altered protected edges. Existing spring
coefficients are preserved when their endpoints/hinges survive; new
coefficients are reconstructed from the original piece's verified native
directional-stiffness law and material rest coordinates. Multiple bend
springs with identical opposite endpoints are handled as distinct hinges,
not erroneously collapsed. No installed-app, production solver, UI, saved
garment or source pose is modified. The returned payload remains explicitly
`safeToAutoApply:false` and **not solver-certified**.

**Independent actual four-panel Foundation Tee test:** On the rejected,
rest-isometric off-body pose, the two protected clearance-aware flips now
yield a structurally consistent research payload: **1264/1264** expected
structural springs, **1040/1040** expected bend springs (including legitimate
duplicate endpoint pairs), **2 stale structural diagonals removed**, **2 new
diagonals installed**, and **5 changed bend hinges per front/back panel**.
The collision-exclusion set is regenerated (**2310 pairs**). Every spring's
material rest length and native stiffness conversion passed independent
recalculation; the independently computed bend-opposite multiset matches.

| Four-panel off-body diagnostic | Before | In-memory graph-rebuilt candidate |
| --- | ---: | ---: |
| Maximum seam gap | 345.000 mm | 345.000 mm |
| RMS seam gap | 192.074423 mm | 192.074423 mm |
| Maximum principal extension | approximately 0% | approximately 0% |
| Maximum principal compression | approximately 0% | approximately 0% |
| Same-panel sub-1 mm clearance pairs | 2 | **0** |
| Static self-intersections | 0 | 0 |
| Static inter-panel clearance violations | 0 | 0 |
| Sampled avatar penetrations | 0 | 0 |
| Ill-conditioned rest faces | 36 | **36 (still blocked)** |

Graph rebuilding took **23.64 ms** in one uncontrolled observation (not a
native solver benchmark). Source project, original payload and original pose
were byte-identical before and after. **This does not improve seam closure**:
the next research step is a genuinely seam-reducing coupled folding trajectory
using this in-memory graph, with material strain and sampled contact rejection.
No motion trajectory was run or certified in this iteration. Neither endpoint
static clearance nor discrete avatar samples establish continuous cloth/self
or cloth/avatar collision freedom, or safe avatar entry.

**Independent QA:** new
`scripts/qa-exo-flip-constraint-graph-20261023.mjs` passed **5/5** tests,
including real four-panel graph/rest verification, corrupted rest/stiffness
rejection, stale exclusion/duplicate spring rejection, nonplanar input and
protected-edge veto. Combined with the existing independent clearance,
principal-strain, hinge-tolerance and witness suites: **22/22 PASS**, about
**1.00 s** test-runner wall time. JS syntax and `git diff --check` passed.
The frozen native **two-panel** binary and checkpoint matched via dry run;
**10/10 complete, no candidates repeated**. Available disk was approximately
**5.35 GiB** initially and **5.36 GiB** at the final check, below the 8 GiB
native-build floor. No native builds, deletes, cache cleanup, offloads,
garment saves, installed-app changes, resets, commits or GitHub pushes.


## October 23 continuation — bounded clearance-aware protected edge flips (research only)

**New concrete source-level advance:**
`src/core/physics/nativeClearanceAwareFlipResearch.js` searches at most 16
local interior diagonals near measured same-panel contact witnesses (12 per
panel in this independent experiment). Each proposed flip must pass the
existing independent `auditSingleMaterialEdgeFlip` certificate: unchanged 2D
material coordinates, preserved material boundary and fold-protected edges,
valid triangle orientation/coverage, and no increased count of poorly
conditioned local faces. A fresh full-panel static self-contact screen then
rejects any proposal that increases triangle intersections, near-foldovers or
sub-thickness disjoint contacts anywhere in the panel. Only strict global
contact-defect reductions are returned. The helper never edits the source
world positions, saved garment, installed UI or live solver; it explicitly
marks structural/bend constraints **not regenerated** and forbids autoapply.

**Independent four-panel witness:** Starting from the existing certified,
protected opt-in rest mesh in the rejected off-body staging pose, a single
local certified flip on **front** and another on **back** removed the two
previously persistent **0.376376569 mm** same-panel clearance violations.
The independently re-audited composite *in-memory diagnostic only* changed
**2 -> 0** nonadjacent sub-1 mm pairs, with **0** exact static self-
intersections, **0** near-flat edge foldovers and **0** exact static
inter-panel near-clearance pairs. Maximum seam gap remained **345.000 mm**,
RMS **192.074423 mm**; maximum principal extension and compression were
approximately **0%**, sampled avatar penetrations **0**, and ill-conditioned
rest faces **36 -> 36**. The targeted two-panel flip search scanned **10**
interior diagonals, certified **6** local material flips and performed **2**
full-panel candidate contact screens in approximately **140 ms** for one
uncontrolled observation. Original project, payload and pose remained
byte-identical. No candidate was saved or applied.

**Crucial remaining blocker:** Replacing only face lists leaves **two stale**
and **two missing** structural spring edges in the diagnostic payload; bend
constraints also require rebuilding and independent rest-metric verification.
This candidate is **not solver-ready** or sewn: no seam-gap improvement,
coupled folding acceptance, cloth thickness certification, swept triangle
CCD or avatar re-entry proof. The next safe implementation step is an opt-in,
transactional constraint-graph rebuild for these certified local flips,
followed by full independent structural/bending rest-length QA and a new
bounded coupled seam-motion audit. The remaining **36** ill-conditioned
material faces also still block physical acceptance.

**QA:** New `scripts/qa-exo-clearance-aware-flip-20261023.mjs` passed
**4/4** independent tests (synthetic repair, protected-edge veto/budgets,
malformed input rejection, and actual four-panel re-audit). Five combined
targeted suites passed **32/32** in approximately **0.94 s**; JS syntax and
`git diff --check` passed. The native two-panel executable/checkpoint
dry-run matched and confirmed **10/10 complete, zero remaining**; no native
candidate was repeated. Disk was approximately **6.23 GiB** at the initial
check and fluctuated down to **3.32 GiB** during concurrent workspace activity
(**3.32 GiB** at the final read-only checkpoint check), below the 8 GiB native-build
floor. No native build, file deletion, cache cleanup, garment save, branch
reset, UI/app replacement, Git push or deployment was performed.

## October 23 continuation — degenerate inter-panel faces cannot bypass static clearance preflight

**Concrete source-level safety correction:** `nativeInterpanelExactContactResearch.js`
now rejects nondegenerate-face violations for **every** triangle before AABB
pruning, using the same squared-area floor (`1e-28 m^4`) as the triangle
distance narrowphase. It also rejects nonfinite area arithmetic. Previously,
a collinear or duplicate-position triangle far from another panel could be
pruned before any distance call, yielding `staticInterpanelExactClear: true`
despite invalid cloth geometry. An independent regression reproduced that
false clearance (`narrowphaseCheckedPairs: 0`) before the fix; the corrected
screen throws rather than issuing a clearance result. Both panel orders,
collinear/duplicate positions, a thin valid negative control, and source
nonmutation are covered. This is a **static** contact preflight, not CCD.

**Independent QA:** eight targeted strain/contact/rest-seed suites passed
**49/49** tests in approximately **1.05 s** of test-runner wall time
(uncontrolled). Syntax checks and `git diff --check` passed. Actual four-panel
rest-seed research remains **345.000 mm max / 192.074 mm RMS** seam gap,
effectively zero principal extension, **0/1268** sampled avatar penetrations,
and **two** same-panel clearance defects at **0.376376569 mm** (front
23/115 and back 16/23). The established optimized four-panel pose remains
**188.452 mm max / 117.400 mm RMS** seam gap, **2389.418%** principal
extension and **496** sampled avatar penetrations. The earlier two-hinge
candidate remains rejected (**345.000 mm max / 192.685 mm RMS**, worse RMS,
12 unresolved swept observations); none of these fit metrics improved in this
source-only change. Original payload and fixture nonmutation checks passed.

**Operational guard:** read-only checkpoint dry run verified matching existing
executable/parameters and **10/10** completed two-panel trials with **zero**
remaining; no candidate was repeated. Available disk was approximately
**7.16 GiB**, below the **8 GiB** native-build safety floor. No native build,
cache cleanup, deletion, saved garment/UI/installed-app modification, branch
reset, commit, push or deployment. The remaining engineering blockers are
material-preserving repair of the two submillimetre same-panel defects and a
coupled seam-reducing motion that passes strain, static/swept cloth contact
and avatar clearance. No avatar-entry CCD or CLO3D parity is certified.

## October 23 continuation — bounded exact inter-panel static clearance for rest seeds

**Concrete source-level improvement:** introduced the research-only
`nativeInterpanelExactContactResearch.js` static contact screen. It preflights
the total cross-panel triangle-pair budget, filters with 3D AABB distance,
then computes actual 3D triangle separation for every AABB candidate, with
a second independent narrowphase-work cap and only eight retained closest
violation witnesses. The off-body rest-seed selector now uses this **exact
static** result instead of treating every broadphase box overlap as physical
contact; it preserves the former AABB counts for comparison and reports exact
inter-panel witnesses. This is a bounded, opt-in research selector change,
not a modification of the installed app or saved garment.

**Independent adversarial QA:** a pair of separated diagonal triangles has
an AABB gap of about **0.899 mm** but an actual gap of about **1.169 mm**.
The old conservative AABB gate rejects it; the new static screen correctly
clears it. Translating the second triangle yields about **0.890 mm** true
separation and is still rejected. Transverse face piercing reports **0 mm**
and is rejected; a parallel-plane **0.5 mm** gap is rejected. A synthetic
two-panel off-body seed proves the selector now distinguishes the safe AABB
false positive from the unsafe counterpart. Malformed coordinates, exhausted
total/narrowphase work budgets, and nonmutation are also covered. **These
fixtures establish static separation only; no dynamic swept CCD is claimed.**

**Independent regression:** seven targeted contact, strain and real-shirt
suites passed **42/42** tests after the final parallel-plane negative control,
in approximately **1.5 seconds** of test-runner time (uncontrolled).
Source syntax and scoped whitespace checks passed. The real four-panel
off-body rest seed remains rejected due to **two same-panel 0.376377 mm
clearance defects** (front 23/115, back 16/23), not an inter-panel AABB
false alarm. It has **345.000 mm maximum / 192.074 mm RMS** seam separation,
effectively zero principal strain and zero sampled avatar penetrations.
The subsequent two-hinge candidate remains rejected: **345.000 mm maximum /
192.685 mm RMS** seam separation, effectively zero principal strain,
zero sampled avatar penetrations, **12** unresolved swept self-contact
observations, and approximately **835 ms** for one uncontrolled coupled audit.
The established optimized four-panel initial pose remains **188.452 mm
maximum / 117.400 mm RMS**, **2389.418%** principal extension and **496**
avatar penetration samples; no physical fit improvement is claimed.

**Checkpoint and operational guard:** the pre-existing executable SHA-256
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`
matches the checkpoint. Its **10/10 two-panel** candidate grid is complete,
so no completed candidate was rerun. Disk space was approximately **7.40 GiB**
after validation, below the **8 GiB** native-build safety floor. No native
build, cache cleanup, deletion, saved garment/UI/installed-app change, branch
reset, commit, GitHub push or deployment. Original payloads remained
unchanged. The next material improvement is still a protected, material-
preserving repair of the two actual intrapanel clearance defects, followed
by a seam-reducing fold that passes principal strain and sampled/swept
contact rejection together. CLO3D parity, true avatar-entry CCD and physical
sample acceptance remain unverified.

## October 23 continuation — caller-specific hinge tolerance cannot waive swept contact

**Concrete safety correction:** the research-only coupled cloth contact screen
previously classified rigidly rotating vertices using a hard-coded **1e-8 m**
material-axis tolerance, even when the hinge candidate itself was generated
with a wider, explicitly supported `restToleranceM` (up to 1e-3 m). This
mismatch could classify a **pinned near-axis vertex** as rotating, falsely
exempting a disjoint same-panel triangle pair from the conservative swept
contact veto. `rigidSideClasses` now uses the hinge's actual material-axis
tolerance, matching `createNativeDevelopableHingeCandidate`. Its existing
off-axis error bound applies to pinned vertices in that tolerance band.

**Independent adversarial witness:** with a 1 mm rest-axis tolerance, one
vertex at 0.5 mm material-axis offset remains pinned while the opposing
triangle rotates through 180 degrees. The two nonadjacent triangles are
**1.432 mm apart initially**, **0.900 mm apart at the midpoint**, and
**1.416 mm apart finally**. The former rigid classification incorrectly
waived the first half-arc pair; the corrected screen records the unresolved
contact and rejects the research candidate. This is a sampled contact
counterexample and a conservative safety correction, **not full swept CCD**.
The regression verifies source-state nonmutation and no automatic application.

**Independent QA:** new
`scripts/qa-exo-coupled-hinge-tolerance-20261023.mjs` plus four existing
contact/clearance suites passed **24/24 tests** in approximately **1.35 s**;
source syntax and scoped whitespace checks passed. A separate four-panel
coupled audit remained **REJECTED**: max seam gap **345.000 -> 345.000 mm**,
RMS gap **192.074 -> 192.685 mm**, principal extension/compression effectively
zero, zero sampled avatar penetrations, **12** unresolved swept same-panel
contact observations, and original state unchanged. That audit took
approximately **869 ms** in one uncontrolled observation, not a native solver
benchmark. The established optimized initial four-panel tee remains
**188.452 mm max / 117.400 mm RMS seam gap**, **2389.418% maximum principal
extension**, **496** avatar penetration samples, **24** static intersections,
and two **0.376377 mm** submillimetre clearance violations; no improved
physical fit is claimed.

**Checkpoint and operations:** the preflight native executable/checkpoint
read-only dry run confirmed **10/10 two-panel candidates complete, none
remaining**, so no completed candidate was rerun. Free disk was approximately
**7.96 GiB**, below the separate **8 GiB native-build** safety floor. No
native build, new experiment batch, saved garment/UI/installed-app mutation,
cleanup, cache deletion, branch reset, commit, GitHub push or deployment.
Changes remain local and research-only. Next: test tolerance-band corner
cases and pursue material-preserving repair of the two actual static clearance
defects before seeking a physically feasible coupled seam-reducing fold.

## October 23 continuation — exact rigid-pair clearance reduces conservative swept false alarms

**Concrete coupled-contact source improvement:** the research-only
`nativeCoupledClothContactResearch.js` now applies the independently tested
3D triangle-distance primitive as a second, strict separation certificate
*only* for disjoint same-panel faces that are either both stationary or both
on the same rigidly rotating side of one hinge. The existing conservative
swept separating-axis screen runs first. For co-rotating faces, the exact
starting distance must exceed the requested clearance **plus** the summed
worst-case displacement of any approximately-on-axis pinned vertices and a
floating-point margin. Mixed moving/stationary pairs receive no exemption.
This is a mathematically bounded rigid-motion filter, **not** general
deformable swept collision detection, and it cannot certify garment entry.

**Independent synthetic witness:** two nonintersecting triangles have a true
Euclidean minimum gap of **1.168911 mm**, above the experimental **1 mm**
clearance, but their AABB gap is only **0.899248 mm** and every individual
static SAT-axis gap is below the threshold. Previously the conservative
swept gate could retain this pair as a possible collision even when both
faces remain fixed or co-rotate rigidly. The new exact-rigid counter confirms
its separation for both cases. Moving one face diagonally by 0.2 mm reduces
the true gap to **0.890320 mm**; both stationary and co-rotating negative
controls still fail the existing static thickness gate. All synthetic
inputs remain byte-equivalent under JSON serialization after evaluation.

**Independent QA:** the new
`scripts/qa-exo-coupled-exact-rigid-clearance-20261023.mjs` adds the safe
stationary/co-rotating and unsafe submillimetre controls. Eight focused
contact/strain suites passed **47/47 tests** in approximately **1.44 s**;
source syntax and scoped whitespace checks passed. The previously rejected
four-panel off-body hinge still measures **345.000 mm maximum seam gap** and
**192.074 -> 192.685 mm RMS gap**, negligible principal strain, zero sampled
avatar penetrations, and **12 unresolved swept self-contact observations**;
its research gate remains rejected. One uncontrolled four-panel coupled
audit took approximately **949 ms**, not a solver benchmark. The established
optimized four-panel initial pose still measures **188.452 mm maximum / 117.400
mm RMS seam gap**, **2389.418% principal extension**, **496 sampled avatar
penetrations**, **24 static intersections**, and **two** 1 mm-clearance
violations at **0.376377 mm**. These established metrics were not changed by
the new rigid-pair filter. Neither case is physically accepted.

**Checkpoint and safety:** read-only native dry-run matched the existing
binary/checkpoint parameters and reported **10/10 completed, zero remaining
two-panel candidates**. No completed candidate was repeated. Disk headroom
was approximately **8.8 GiB** at preflight and **8.76 GiB** at final check.
No native build, saved garment mutation, UI/installed-app change, file
deletion, cleanup, branch reset, commit, push or deployment occurred. The
research changes remain local and uncommitted. Next: apply independently
bounded exact-rigid filtering to reduce false positive swept vetoes without
weakening genuine 1 mm clearance violations, then pursue a physically
strain-safe seam-reducing candidate; the two real off-body clearance defects
remain blocking. Full CCD, safe avatar entry and CLO3D parity are unverified.

## October 23 continuation — transverse face-interior contact-distance correction

**Concrete research-source fix:** `nativeTriangleDistanceResearch.js` now
checks finite triangle edges piercing the *interior* of the opposing face,
in both directions. The previous vertex-to-triangle plus edge-to-edge
minimum-distance calculation could report a strictly positive separation for
two intersecting, noncoplanar triangles when no vertex lay on the other face
and no two boundary edges met. This is a safety-relevant error in a reusable
static distance primitive, even though the existing same-panel caller also
performs a separate intersection screen. The correction does not enable
production simulation, modify garment geometry, or claim swept collision CCD.

**Independent negative control:** a transverse face-piercing pair previously
reported **0.357142857 m** separation; it now correctly reports **0 m**.
The new `scripts/qa-exo-triangle-piercing-distance-20261023.mjs` verifies
both triangle orders, three vertex permutations, four metric scales, a
strictly separated near-miss, integration with the existing static contact
screen, and original-state nonmutation. Seven targeted suites passed
**49/49 tests** in approximately **1.50 seconds**. Both modified JavaScript
files passed source syntax checks. This runtime is QA execution time, not
native solver performance.

**Physical acceptance unchanged:** the completed native *two-panel* grid
remains **10/10**, with zero remaining candidates; the executable and saved
parameter checkpoint matched the read-only dry run, so no native trials were
repeated. The actual four-panel optimized initial mesh still has established
**188.452 mm max / 117.400 mm RMS seam gap**, **2389.418% maximum principal
extension**, **496 sampled avatar penetrations**, **24 static self-intersections**,
and **two** disjoint-face 1 mm-clearance violations at **0.376377 mm**.
Independent witness QA confirmed the same two face pairs (front 23/115 and
back 16/23) without changing the source pose. The prior seam-closed staged
candidate remains rejected at **1.44 mm max / 0.537 mm RMS** due to
**3112.05% principal extension** and **977 endpoint avatar penetrations**.
No fit, avatar-entry, continuous collision, or CLO3D parity certification.

**Operational safety:** approximately **10.30 GiB** free at the initial
checkpoint verification. No native builds, user-interface changes, garment
saves, installed-app changes, cache deletion, branch resets, commits, pushes,
or deployments. Changes are local and research-only. Next: use the independent
contact oracle in bounded candidate rejection while pursuing material-
preserving repairs of the two remaining clearance defects and actual
strain-safe seam closure.

## October 23 continuation — scale-invariant skew-edge cloth-clearance veto

**Research source fix:** `nativeTriangleDistanceResearch.js` no longer uses
absolute `1e-20` cutoffs for the finite-segment determinant and segment
parameters. Those quantities scale as length to the fourth power: at small
nondegenerate fabric features, the old code misclassified skew edges as
parallel and inflated the true static gap. The parallel test now uses a
relative floating-point tolerance (`Number.EPSILON * squaredEdgeA *
squaredEdgeB`); the segment parameters retain their scale rather than being
rounded to zero by a fixed metric cutoff. Production fitting and UI remain
untouched; this is a static disjoint-face research clearance oracle, not CCD.

**Previously missed unsafe fixture:** At 1e-5 uniform geometric scale, the
old oracle reported **0.002313807 mm** separation where the correct
scale-consistent value is **0.002183852 mm**. A strict **0.00225 mm**
clearance gate consequently reported zero violations and incorrectly passed
the pair. The corrected checker counts one disjoint-face violation and vetoes
that fixture; at a 0.002 mm threshold it correctly reports no violation.
Independent regression also checks scale invariance across four scales,
triangle order/permutation, malformed-state handling from the existing suite,
and original-state nonmutation.

**Validation:** Seven targeted contact suites passed **49/49 tests** in **1.50 s**;
the independent principal-strain suite passed **8/8** additional tests
(**57/57** combined, approximately **1.76 s** of test-runner time).
the actual four-panel off-body rest witness remains **two** clearance
violations (front 23/115 and back 16/23), each **0.376376569 mm**, with
unchanged geometry and no claim of repaired clearance. The existing
four-panel baseline remains **188.452062 mm maximum seam gap**, **117.400268
mm RMS gap**, **2389.417878% principal extension**, and **496 sampled avatar
penetrations**. A separate aggressively staged seam candidate measured
**1.44 mm maximum gap** and **0.537 mm RMS gap**, but failed physical
acceptance with **3112.05% maximum principal extension**, **977 avatar
penetration samples**, and **6187 intermediate penetration samples**;
these are not results of the new static-distance fix. The rejected off-body
hinge baseline remains **345.000 mm
maximum gap** and **192.074 mm initial RMS gap**; a sampled candidate in
this QA run had **193.816 mm RMS gap** and no acceptable seam closure.
Two real contact witness checks took **119.79 ms** and **54.28 ms** (single
uncontrolled observations, not solver benchmarks). The original research
checkpoint remains **10/10 complete**, executable and parameters matched
the read-only dry run, with **zero** untested candidates. No native candidate
was rerun. Available space was approximately **11.74 GiB** at preflight and
**11.57 GiB** at final check.
No native builds, garment saves, installed-app changes, UI edits, deletion,
cache cleanup, branch reset, commit, push or deployment were performed.
Physically feasible coupled seam bending, swept CCD, avatar entry and CLO3D
parity remain unverified.

## October 23 continuation — nearest-first contact blocker diagnostics

**Source-level research improvement:** `nativeIntrapanelContactResearch.js`
now retains the **eight closest** disjoint same-panel clearance violations,
sorted by measured distance with deterministic face-identity tie breaking.
Previously, `nearClearanceExamples` retained the first eight in face traversal
order, potentially hiding the most severe violations on dense meshes. The
total violation count, global minimum distance, strict 1 mm research
clearance veto, pair work budget, production UI and solver behavior are
unchanged. The witness list is diagnostic only; it does not repair contact.

**Independent regression:** The new
`scripts/qa-exo-nearest-clearance-priority-20261023.mjs` supplies ten spatially
separated face pairs whose nearest two violations occur last in face order.
All ten violations are counted; the closest eight (0.14 to 0.77 mm) are
retained in ascending distance order. Reversing face order leaves the same
eight distances, and exhausting the 189-pair work budget rejects the
190-pair fixture. Input state remains unchanged. The previous real-shirt
witness assertion was updated to compare identities independent of display
order, without removing or weakening either expected violation.

**QA:** Six targeted suites, including the new negative controls, **45/45
passed** in approximately **1.43 s**; source syntax checks passed. On the
actual rejected four-panel rest-isometric pose the same two violations remain:
front faces 23/115 and back faces 16/23, each **0.376376569 mm** apart,
three material-face adjacency hops away. The optimized and certified-flip
meshes still fail static contact acceptance. The prior four-panel initial
mesh metrics remain **188.452 mm max seam gap**, **117.400 mm RMS gap**,
**2389.418% maximum principal extension** (opt-in optimized mesh), and **496
sampled avatar penetrations**. These are not newly simulated fitting results.
The off-body hinge candidate remains **345.000 → 345.000 mm max gap** and
**192.074 → 192.685 mm RMS gap**, with unresolved swept-contact warnings.
The two real static witness diagnostics took **127.61 ms** and **53.43 ms**
in this run, uncontrolled observations rather than solver benchmarks.

**Checkpoint / safety:** The native two-panel candidate grid is still
**10/10 complete**; a read-only executable/checkpoint verification found
zero remaining candidates. No completed candidate was rerun. Available
storage at the final check was approximately **13.35 GiB**. No native build,
garment save, installed-app change, UI change, cache deletion, branch reset,
commit, push or deployment occurred. The source project, diagnostic poses
and test payloads passed nonmutation assertions. Physically feasible coupled
seam bending, complete cloth-thickness clearance, continuous CCD, safe
avatar entry and CLO3D parity remain **unverified**.

## October 23 continuation — material-topology witnesses for the two blocked rest-clearance pairs

**Research-only source improvement:** The same-panel static contact checker now
returns up to eight bounded, measured `nearClearanceExamples` and the
`minimumNearClearanceMm`, rather than only counting disjoint face pairs closer
than 1 mm. Each example identifies the panel, both face indices, exact static
triangle distance and shortest face-to-face **shared-edge adjacency path**
(BFS limited to six hops). The off-body seed research report carries those
witnesses forward. Nonmanifold material edges fail closed. The existing
contact veto, collision thresholds, solver, editable garment, UI and installed
application are unchanged. This is a localization aid for constrained
retriangulation, **not** a contact repair or a thickness/CCD certificate.

**Independent real four-panel finding:** The rejected rest-isometric off-body
pose has exactly **two** disjoint-face clearance violations, both measuring
**0.376376569 mm** against a 1 mm static research threshold:

| Panel | Face A | Face B | Shortest shared-edge face path |
| --- | ---: | ---: | ---: |
| Front | 23 | 115 | 3 edges |
| Back | 16 | 23 | 3 edges |

This **three-face-adjacency-edge** measurement is different from the prior
`minimumMaterialEdgeHops: 1` diagnostic, which measures a shortest path
between material vertices, not between faces sharing edges. They must not be
treated as contradictory or substituted for each other. The existing
protected-hinge, certified one-flip topology still leaves **both** violations
at the same measured separation. No claim of repaired clearance is made.

**Current initial-pose comparison** (two distinct opt-in meshes, not fitted
solver outcomes):

| Measurement | Existing optimized mesh | Certified one-flip mesh |
| --- | ---: | ---: |
| Maximum seam gap | 188.452062 mm | 188.452062 mm |
| RMS seam gap | 117.400268 mm | 117.400268 mm |
| Maximum principal extension | 2389.417878% | 2389.417878% |
| Maximum principal compression | 78.167905% | 89.040793% |
| Sampled avatar penetrations | 496 | 496 |
| Static same-panel intersections | 24 | 24 |
| Disjoint submillimetre warnings | 2 | 2 |
| Inter-panel AABB potential contacts | 938 | 935 |
| End-to-end research diagnostic runtime | 127.99 ms | 141.99 ms |
| Physically accepted | No | No |

The two runtimes are **single uncontrolled observations**, not a speed
comparison. The off-body hinge experiment remains rejected: maximum seam gap
**345.000 → 345.000 mm**, RMS **192.074 → 192.685 mm**, negligible principal
strain and zero sampled avatar penetrations, but unresolved same-panel swept
contact and the two static clearance warnings. No actual seam closure was
achieved by the hinge experiment.

**QA:** `node --test` on six targeted suites, including the new independent
`qa-exo-rest-clearance-witness-20261023.mjs`, returned **52/52 PASS** in
approximately **1.54 seconds**. Negative controls cover a 0.4 mm disjoint
pair, 2 mm clearance, malformed nonmanifold material adjacency, exact real
four-panel face identities, unchanged material state and rejection of the
unsafe off-body seed. Syntax checks, scoped whitespace checks and source /
payload nonmutation checks passed. The existing two-panel native checkpoint
remains **10/10 complete**, and its executable SHA-256 matches; no candidates
were repeated. Available disk was approximately **9.1 GiB**; no native build
or experiment was needed. No garment save, app/UI change, cleanup, deletion,
branch reset, commit, push or deployment occurred.

**Next:** Test bounded, protected-edge-safe local remeshing around these
identified front/back face neighborhoods. Any proposed repair must preserve
material coordinates, seam/anchor correspondence, constraint rest lengths,
and avoid worsening poor-face counts or static/swept contact. Only then
evaluate genuinely seam-reducing constrained folding. Continuous cloth CCD,
avatar-entry safety, thickness certification and CLO3D parity remain blocked.

## October 23 continuation — exact static disjoint-face clearance and blocked off-body seed

**Research-only source improvement:** Added
`nativeTriangleDistanceResearch.js`, a finite-triangle Euclidean distance
oracle using point-to-triangle and edge-to-edge closest-point checks. The
same-panel narrowphase now measures clearance for **nonintersecting faces
sharing no material vertex**, after its existing intersection test and AABB
pruning. It reports `nonadjacentNearClearancePairs` separately from exact
intersections and shared-edge near-flat fold-backs. The coupled two-hinge
research gate, off-body seed selector and sampled self-contact diagnostics
propagate these warnings and **reject** any candidate violating the requested
1 mm static separation. No shared-vertex/edge finite-thickness certification,
continuous collision detection or safe avatar-entry certification is implied.
Production solver, installed app, editable garment and UI remain unchanged.

**Previously hidden real failure:** The opt-in four-panel rest-isometric
off-body pose has **two** same-panel nonadjacent face pairs only
**0.376377 mm** apart (front faces 23/115 and back faces 16/23), below
the 1 mm research clearance. Both are one material-edge hop apart and
involve an ill-conditioned sliver. It still has negligible principal strain,
zero sampled avatar penetrations and zero inter-panel broadphase contacts,
but it must now return `best: null` / `restAndEndpointFeasible: false`.
Older tests that assumed this pose was accepted were corrected to reconstruct
it in a **test-only rejected diagnostic fixture**, never to weaken the
candidate gate. The separate two-hinge diagnostic still has maximum seam gap
**345.000 → 345.000 mm**, RMS **192.074 → 192.685 mm**, negligible
principal strain, zero sampled avatar penetrations, and **12** unresolved
swept same-panel observations; it is rejected.

**Real four-panel static measurements (distinct meshes, not before/after
solver fitting):**

| Metric | Protected source mesh | Opt-in certified rest-flip mesh |
| --- | ---: | ---: |
| Maximum seam gap | 188.452062 mm | 188.452062 mm |
| RMS seam gap | 117.400268 mm | 117.400268 mm |
| Peak principal extension | 7933.803% | 2389.418% |
| Sampled avatar penetrations | 500 / 1268 | 496 / 1268 |
| Exact static self-intersections | 6 | 24 |
| Shared-edge near-flat fold-back warnings | 44 | 0 |
| **New disjoint-face near-clearance warnings** | **231** | **2** |
| Inter-panel AABB potential contacts | 763 | 938 |
| Thickness / physical fit certified | No | No |
| Static contact audit runtime, one observation | 82.08 ms | 52.95 ms |

The timings are uncontrolled single observations, **not** a solver speedup
benchmark. Source project and experimental payload JSON remained unchanged.
Six targeted QA suites passed **60/60** tests in **1.42 seconds**; these
include independently known 0.4/2.0 mm triangle separations, static and
sampled near-clearance rejection, coupled-candidate vetoes, original-state
nonmutation and the actual four-panel blocked-seed regression. Syntax checks
passed. The existing native two-panel checkpoint was read-only verified
against its executable/parameter hashes with **10/10** candidates complete,
**zero** remaining and no repeated trials. Free disk was approximately
**10.7 GiB**; no native build was needed or run. No deletion, cache cleanup,
UI/app replacement, garment save, branch reset, commit, push or deployment.

**Next:** Repair the two submillimetre rest-clearance pairs without violating
material-coordinate fidelity or protected hinges, then seek a truly
seam-reducing, strain-constrained coupled motion. Nonadjacent static
clearance is a useful necessary condition, not sufficient proof of continuous
cloth contact or physically valid garment fitting.

## October 23 continuation — conservative near-flat hinge fold-back veto

**New research-only source/test safeguard:** `nativeIntrapanelContactResearch.js`
now reports `edgeNeighborNearFoldoverPairs` for two triangles sharing a
material edge when their projection overlaps over positive area and the
opposite vertex lies within the requested 1 mm distance of the first face's
plane. Unlike a generic shared-edge distance test, this does **not** reject
ordinary hinges just for meeting at their sewn mesh edge. It does reject a
synthetic near-coplanar 0.4 mm fold-back, while allowing a 2 mm separation,
an ordinary outward hinge and a 0.4 m raised hinge. Coplanar fold-overs remain
counted as intersections, not double-counted as warnings. This is a bounded
**near-flat static risk screen**, not general fabric thickness clearance,
noncoplanar triangle distance, swept CCD or physical-fit certification.

`nativeCoupledClothContactResearch.js` now propagates per-pose and aggregate
near-foldover warnings and vetoes such candidates; the off-body rest-seed
acceptance also requires the near-foldover screen to be clear. The default
production solver, editable garment and UI are not modified. New independent
negative controls confirm the candidate gate rejects a shared-edge fold-back
even when it is not an exact static triangle intersection. Original JSON
source and candidate payloads remain unchanged.

**Measured real four-panel Foundation Tee, quality mesh at its existing
initial pose:** protected baseline has **44** near-flat edge-neighbor
warnings, **6** exact static self-intersections, **500/1268** avatar
penetrations, **7933.803%** peak principal extension, max seam gap
**188.452062 mm** and RMS **117.400268 mm**. Existing opt-in edge-flip mesh
has **0** near-flat edge-neighbor warnings, **24** exact static
self-intersections, **496/1268** avatar penetrations, **2389.418%** peak
principal extension and the same max/RMS seam gaps. Both are **rejected**;
these are different meshes, not before/after physical solver improvements.
One in-process combined diagnostic observation was **44.94 ms** (baseline)
versus **36.41 ms** (opt-in); this is not a controlled throughput comparison.

The existing **off-body two-hinge** real four-panel research motion still has
max seam gap **345.000 → 345.000 mm**, RMS **192.074 → 192.685 mm**,
effectively **0%** principal extension, **0** sampled avatar penetrations,
**0** new near-foldover warnings and **12** unresolved swept same-panel
observations. It remains **rejected**, without any seam closure gain.
The separate native two-panel parameter grid is still **10/10 complete**;
the read-only dry-run verified executable/parameter hashes and zero remaining
candidates, so no native trial was repeated. Disk free was about **11.7 GiB**
(above the 8 GiB build safety floor, but no build was necessary). No garment
save, UI/app replacement, cleanup, branch change, commit, push or deployment.
The next step is a true thickness-aware, noncoplanar triangle-distance oracle
with continuous hinge-interval contact tests, followed by strain-constrained
seam-closing motion on the actual four-panel garment.

## October 23 continuation — shared-edge fold-over rejection and complete contact work accounting

**Concrete source-level, opt-in research improvement:** The same-panel static
contact checker now tests faces sharing a material **edge** for positive-area
**coplanar fold-over** instead of excluding every edge neighbor. It continues
to permit ordinary shared-edge boundary contact and noncoplanar hinges, and
does **not** assert fabric-thickness clearance for noncoplanar folds. Static
face-pair budgeting now counts *all* checked pairs, including edge neighbors;
the sampled-trajectory checker consumes the same complete count, and the
coupled hinge audit reports complete static same-panel work. This closes an
otherwise silent undercount when adding edge-neighbor checks. It does not
change the production solver, installed app, UI, garment or stored project.

**Independent positive/negative controls:** A synthetic two-face mesh folded
onto itself across its shared edge is rejected; unfolded and noncoplanar
hinges remain clear. A 360-degree synthetic hinge arc has matching clear
endpoints but a positive-area shared-edge fold-over at its midpoint, which
the existing sampled-path gate now rejects. A too-small *total* pair budget
fails closed even when the nonadjacent-pair count is zero. Source and fixture
JSON nonmutation checks pass. Six targeted suites passed **48/48** tests in
**3.04 seconds** (one uncontrolled combined QA observation), with syntax
and whitespace checks passing.

**Real four-panel Foundation Tee (current in-memory source, before/after
certified one-flip topology):** Each mesh has **76,912** non-edge pairs and
**1,040** shared-edge pairs checked (**77,952 total**). No shared-edge
coplanar fold-over was found in either pose; both still have **24** static
same-panel intersections. Both retain **188.452062 mm** maximum seam gap,
**117.400268 mm** RMS gap, **2,389.417878%** maximum principal extension,
**496** sampled avatar penetrations and **938** current inter-panel AABB
potential contacts. The last value differs from the previous report's 935;
the two payloads measured *in this run* both have 938, so this change is
**not attributed** to the shared-edge checker. Two isolated static checks
took **33.43 ms** and **33.83 ms** respectively; these are uncontrolled
observations, not native solver throughput measurements. The actual
coupled off-body hinge candidate still has maximum seam gap **345.000 mm**
(unchanged), RMS **192.074 → 192.685 mm** (worse), negligible principal
strain, zero sampled avatar penetrations, zero sampled inter-panel contacts,
but **12** unresolved swept same-panel contact observations and no acceptance.
The certified topology retains **36** poorly conditioned rest faces, versus
**37** on the protected baseline. Source and candidate nonmutation passed.

**Checkpoint/storage:** Read-only native dry-run verified executable and
parameter hashes and **10/10** completed two-panel candidates with zero
remaining; no completed candidate was rerun. Available disk was about
**12.4 GiB**; no native build or native trial was necessary. No deletions,
cache cleanup, garment saves, installed-app/UI changes, branch changes,
resets, commits, pushes or deployments. **Next:** conservative thickness-aware
hinge-neighbor clearance and a bounded seam-reducing coupled motion that
independently satisfies rest conditioning, principal strain, avatar clearance
and cloth contact. Neither continuous collision detection, safe avatar entry
nor CLO3D parity is certified.

## October 23 continuation — noncoplanar shared-vertex self-crossing and QA oracle repair

**Bounded research-only source change:** the same-panel static contact screen
now checks *noncoplanar* triangles sharing exactly one material vertex for a
positive-length intersection segment. It intersects each triangle's opposite
edge with the other face plane and requires both resulting segments to extend
along the same ray from the shared vertex. A shared point alone, opposite rays
and a face lying entirely on one side do not count as penetrations. Existing
edge-adjacent exclusions, UI, saved garment and installed-app behavior are
unchanged. This is **static** geometry only: no thickness or swept/continuous
collision certification.

**Independent regression controls:** added a genuine noncoplanar shared-vertex
crossing that the previous vertex-neighbor-only coplanar screen missed, plus
opposite-ray and same-side negative controls. The older four-panel off-body QA
had a stale hard-coded count of 73,839 eligible same-panel pairs from before
vertex-only neighbors were included; replaced it with a face-topology-derived
independent count oracle, which verifies **76,912** pairs on the current
fixture. First combined QA run correctly exposed that stale assertion;
after the test-only correction, **41/41** tests passed across eight targeted
research suites in **1,246.94 ms** (single uncontrolled wall observation).
Source syntax and scoped whitespace checks passed. Actual four-panel tests
verify JSON source/payload nonmutation.

**Actual four-panel result (unchanged static pose):** certified rest-flip
topology still has **36** poor triangles (protected reference **37**), maximum
seam gap **188.452062 mm**, RMS gap **117.400268 mm**, maximum principal
extension **2389.417878%**, **496** sampled avatar penetrations, **24** static
same-panel intersections, and **935** inter-panel broadphase potentials.
The off-body seed has **345.000 mm** maximum seam gap, **192.074 mm** RMS,
negligible sampled principal extension, zero sampled avatar penetrations and
zero static same-panel intersections, but is **not sewn or physically
accepted**. No real-garment contact count improvement is claimed. The
four-panel off-body seed search took **344.43 ms** in one QA observation;
prior contact-only 74.04 ms was a different workload and is **not** a valid
performance comparison. Nonmutation assertions passed.

**Native checkpoint:** read-only dry-run verified executable/parameter hashes,
**10/10** completed two-panel candidates, **zero** remaining; no candidate
was repeated. At initial inspection the data volume reported approximately
**13.4 GiB free**, above both the 1 GiB research threshold and 8 GiB build
floor, but no native build was needed or run. No native experiment, checkpoint
write, garment save, UI/app change, deletion, cleanup, reset, commit, push or
deployment. **Next:** extend shared-edge fold-over handling and conservative
swept contact gating, then seek a candidate that actually reduces both seam
gaps without excessive principal strain or avatar/cloth intersections.
Neither continuous collision detection, safe avatar entry nor CLO3D parity
is verified.

## October 23 continuation — vertex-neighbor static self-contact false-negative guard

**Bounded source/test improvement:** `nativeIntrapanelContactResearch.js`
previously skipped *every* pair of same-panel faces sharing any material
vertex. This can miss two folded triangles sharing exactly one vertex whose
world-space interiors overlap over a positive coplanar area. The static
research narrowphase now retains the existing edge-neighbor exclusion but
examines vertex-only neighbors for **positive-area coplanar overlap**. It
does not count mere shared-corner touching as penetration; it reports the
number of vertex-only pairs screened and overlapping. Noncoplanar
vertex-only crossings, shared-edge fold-over, thickness clearance, swept
triangle contact and avatar entry are **not** certified by this change.

Independent synthetic negative/positive controls demonstrate that the new
check detects coplanar area overlap that the old vertex-neighbor skip missed,
without reporting coplanar or noncoplanar single-point touching as a hit.
The actual four-panel Foundation Tee's protected and certified rest-topology
payloads were screened in memory, with no source mutation:

| Static self-contact metric | Protected baseline | Certified rest flip |
| --- | ---: | ---: |
| Candidate face pairs screened | 76,912 | 76,912 |
| Vertex-only neighbor pairs now screened | 3,083 | 3,087 |
| Vertex-only coplanar area overlaps | 0 | 0 |
| Total static same-panel intersections | 24 | 24 |
| Physical fit accepted | No | No |

The two contact audits together took **74.04 ms** in one uncontrolled
observation; this is **not** a native solver runtime comparison. The
separately validated four-panel payload still has **188.452062 mm maximum
seam gap, 117.400268 mm RMS gap, 2389.417878% maximum principal extension,
496 sampled avatar penetrations and 935 inter-panel broadphase potentials**
on both meshes. These metrics were not improved by the contact-only change.
Project and both candidate payloads passed JSON nonmutation checks.

Eight targeted suites passed **57/57** in **2.18 s**; JS syntax and
`git diff --check` passed. The existing two-panel native checkpoint remains
**10/10 complete**, with zero untried candidates; read-only dry-run verified
its executable/parameter hashes and SHA-256
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
No completed trial was repeated. Free disk was **under 0.5 GiB**, below both
the **1 GiB experiment** and **8 GiB native-build** safety thresholds.
No native build, garment save, UI/app modification, cache cleanup, deletion,
branch reset, commit, GitHub push or deployment occurred.

**Next:** extend vertex-neighbor static narrowphase to independently distinguish
genuine noncoplanar crossings from harmless shared-point contact, then add
cloth/cloth static and swept rejection to coupled seam/hinge candidate
acceptance. Do not infer safe continuous cloth collision, avatar entry or
CLO3D-equivalent fitting from these discrete static checks.

## October 23 continuation — independent rest-length verification

Expanded the material-retriangulation regression with a separate oracle for
structural and bending rest lengths. It independently recomputes distances
from 2D material vertices, catching positive but stale spring lengths that
previous connectivity-only checks could not detect. The exact-distance test
is restricted to the Foundation Tee's zero-shrink fabric.

Both protected and certified four-panel meshes passed 2,304 rest-length checks
(1,264 structural, 1,040 bending), with at most 1.04e-16 m discrepancy.
The certified mesh still has 36 poor triangles versus 37 previously. Maximum
seam gap remains 188.452062 mm, RMS gap 117.400268 mm, maximum principal
extension 2389.417878%, 496 sampled avatar penetrations, 24 static same-panel
intersections and 935 inter-panel broadphase potentials. Physical fit remains
rejected. Seven targeted regression suites passed 57/57 in about 2.08 s.
The two-panel benchmark remains complete at 10/10; its executable hash matches
the checkpoint and no completed candidate was repeated. No native build,
garment save, UI change, app modification, deletion, cleanup, reset, commit
or push was performed. Full swept collision and safe avatar entry remain
unverified. Next: independently screened strain-aware seam/hinge trials.

## 23:35 local continuation — certified rest flips now regenerate actual native constraints

**Source-level improvement:** added the opt-in `experimentalCertifiedPoorFaceFlips`
research flag to `buildNativeSimulationPayload` and `buildSimulation`. It runs
the previously validated, bounded diagonal-flip search **before** native
particles, structural edges, bending opposite-vertex constraints, sewing,
pins and collision exclusions are generated. The normal mesh, saved garment,
UI and installed app paths remain unchanged. The flag fails closed unless
mesh optimization is explicitly enabled, and cannot be combined with the
material-moving interior smoother.

**Independent QA on the real four-panel EXO Foundation Tee:** a face-derived
graph oracle verified that the new payload contains exactly **1,264 structural
edges and 1,040 bending opposite-vertex constraints**, with no stale/missing
endpoints after the one certified back-panel edge flip. The rest mesh improved
from **37 to 36** poorly conditioned triangles; exactly **two face records**
changed, and original material coordinates, boundaries, hinge edges, 500
particle positions, sewing correspondences, 2 anchors and virtual seams were
preserved. A synthetic negative control independently rejects stale structural
edges, stale bending pairs and invalid constraint rest lengths.

| Four-panel static metric | Protected optimized baseline | Regenerated certified candidate |
| --- | ---: | ---: |
| Maximum seam gap | 188.452062 mm | **188.452062 mm** |
| RMS seam gap | 117.400268 mm | **117.400268 mm** |
| Maximum principal fabric extension | 2389.417878% | **2389.417878%** |
| Sampled avatar penetrations | 496 | **496** |
| Static same-panel intersections | 24 | **24** |
| Inter-panel AABB potential contacts | 935 | **935** |
| Ill-conditioned rest triangles | 37 | **36** |
| Physical fit accepted | No | **No** |

One observed candidate native-payload **in-memory construction** took
approximately **66.72 ms** in combined QA; this is not a native solver
simulation or controlled performance benchmark. Original project, baseline
payload, original payload and experimental candidate were all checked for
JSON nonmutation. **44/44** combined targeted regression tests passed
(material retriangulation, protected hinge, rest fidelity, principal strain,
seam gate and static self-contact); source syntax and diff whitespace checks
passed. The two-panel checkpoint's existing executable and parameters were
verified by read-only dry-run: **10/10 complete, zero remaining**; no candidate
was repeated. Disk was about **2.7 GiB**, below the **8 GiB** native-build
floor. No native builds, UI edits, saved-garment writes, file deletions,
branch changes, commits or pushes were performed.

**Still blocked:** 36 ill-conditioned rest triangles, very large principal
extension, open seams, sampled body penetration and static cloth collisions.
Regenerated constraints are structurally coherent, but have not been advanced
through a native solver; no feasible coupled folding, continuous CCD, safe
avatar entry or CLO3D parity is established. Next: bounded, strain-aware
hinge/seam candidate evaluation on the new constraint graph with independent
contact checks, and material-boundary-aware remeshing for the remaining slivers.

## 22:40 local continuation — bounded sequential sliver-targeted material edge flips

**Concrete research-only improvement:** extended
`src/core/physics/materialRetriangulationResearch.js` with
`searchCertifiedPoorFaceFlips`. The deterministic search examines a bounded
number of interior edges (`maxCandidates=2400` per panel), accepts at most
four changes per panel, and independently certifies **each** diagonal change
against its immediately preceding mesh. Every accepted step must strictly
reduce the count of rest faces failing the **2 mm minimum-altitude / 25:1
aspect** screen without decreasing the minimum altitude of its two affected
faces. All original 2D material coordinates, polygon boundaries and protected
material hinge edges are preserved. This is an opt-in rest-topology research
utility, not a default mesher or cloth solver modification.

On the **actual four-panel Foundation Tee** after the existing eight-pass
protected-hinge edge-flip baseline, the bounded search certified **one
additional flip on the back panel**, reducing poorly conditioned rest faces
from **37/768 to 36/768** (front **17→17**, back **20→19**, sleeves **0→0**).
It scanned **1,361** eligible interior-edge observations across four panels;
the targeted four-panel research QA took **95.38 ms** in one uncontrolled
observation. The experiment did **not** regenerate native constraints, change
world-space vertices or simulate the retriangulated garment. Consequently,
there are **no newly measured seam, strain or contact results** for this
candidate, and it is **not** a physically accepted fit.

For context, the **unchanged, separately measured protected-flip baseline**
remains **188.452 mm maximum seam gap, 117.400 mm RMS gap, 2389.418% maximum
principal extension, 496 avatar penetration samples, 24 detected static
self-intersections, and 935 inter-panel broadphase potentials**. Those values
must **not** be attributed to the new topology candidate. The off-body
two-hinge research trajectory also remains rejected (345.000 mm max gap;
192.074→192.685 mm RMS; 12 unresolved swept self-contact observations).

**Independent QA:** new synthetic sliver repair, protected-edge/budget
negative controls, and four-panel strict-improvement/nonmutation checks;
combined material-retriangulation, protected-hinge and material-fidelity QA
**17/17 PASS**. Source syntax checks and `git diff --check` passed. Original
project, payload and baseline rest meshes remained byte-identical in QA.
Read-only native checkpoint dry-run verified the binary/parameters and **10/10
completed, zero remaining candidates**; no completed native trial repeated.
Free disk was about **2.9 GiB**, above the 1 GiB experiment threshold but
below the 8 GiB native-build floor. No native build, installed-app/UI change,
saved garment mutation, cleanup, deletion, branch reset, commit, push or
deployment.

**Next:** regenerate all cloth constraints for the independently certified
36-poor-face topology *in memory*, then independently measure principal
strain, seam alignment, static and swept cloth contact, and avatar clearance.
Do not infer safe avatar entry, full CCD or CLO3D parity from a rest-quality
improvement.

## 21:38 local continuation — exact-coordinate single-flip material retriangulation certificate

**New bounded research-only source and independent QA:** added
`src/core/physics/materialRetriangulationResearch.js` and
`scripts/qa-exo-material-retriangulation-20261022.mjs`. The local certificate
accepts at most **one interior diagonal flip** at a time, with **identical
original 2D material vertex coordinates**, unchanged manifold boundary,
unchanged local signed material area and orientation, and preservation of
explicitly protected hinge edges. It rejects fake replacements, reversed
triangles, moved coordinates, missing protected edges and multi-face changes.
This is an independent *local rest-topology* preflight, not a solver change or
general retriangulation approval. It deliberately does not use the earlier
same-face-connectivity fidelity gate, which would reject every legitimate flip.

**Actual four-panel Foundation Tee:** one protected-hinge-safe local flip on
the **front** panel was certified in memory: diagonal **48–49** becomes
**17–50**, changing exactly two faces (**1 and 3**). Their minimum rest
altitude improved from **1.578410 cm to 1.895400 cm**, while both triangles
were already above the existing 0.2 cm / 25:1 poor-face thresholds
(**0 -> 0 poor faces** for this pair). This is **not** a repair of any of the
remaining **37/768** ill-conditioned triangles. No constraints were regenerated,
no world-space garment pose was changed, and the candidate was not passed to
the solver. The previous protected-flip baseline's physical metrics remain
**188.452 mm max seam gap, 117.400 mm RMS seam gap, 2389.418% maximum
principal extension, 496 sampled avatar penetrations, 24 static same-panel
intersections, and 935 inter-panel broadphase potentials**; these are prior
baseline measurements, **not** fresh post-retriangulation validation.
Contact validity, physical fitting and avatar entry remain **rejected or
unverified**. The separate off-body two-hinge experiment still had
345.000 mm max seam gap, 192.074 -> 192.685 mm RMS (worse), 12 unresolved
swept self-contact observations, and 37 poor rest faces; it was not rerun.

**QA:** 4/4 new independent tests passed (including real-garment source and
payload JSON nonmutation); the combined new-retriangulation, protected-hinge,
and rest-fidelity suites passed **14/14**. Both JS syntax checks and
`git diff --check` passed. The full new test file took approximately
**134 ms** in isolation; the combined 14-test run took approximately
**653 ms** (uncontrolled single observations). The separate two-panel checkpoint was checked with a
read-only dry-run: executable hash/parameters matched, **10/10 complete,
zero candidates remaining**; no native trial was repeated. Disk was about
**0.43 GiB free**, below both the 1 GiB experiment and 8 GiB build floors.
No native build, saved garment mutation, installed-app/UI modification,
cleanup, deletion, branch reset, commit, push or deployment occurred.

**Next:** evaluate a bounded sequence of *individually certified* interior
flips against the **37 actual slivers**, preserving original 2D material
coordinates and protected fold edges; regenerate all native constraints
before evaluating seam, principal strain, static/swept cloth contact and
avatar clearance. Do not promote rest-quality improvements as a physical fit.

## 20:35 local continuation — bounded material-fidelity-constrained interior smoothing

**Research-only source/test change:** `smoothInteriorTriangleQuality` now accepts
optional `fidelityLimits` (2 mm maximum original-to-candidate interior move,
10% maximum ORIGINAL material-edge drift by default when explicitly enabled).
Every proposed step checks all incident original material edges and the
original vertex location; limits cannot be evaded by accumulating individually
small moves across passes. An extended backtracking schedule allows small
bounded steps. Without this option, existing smoothing behavior is unchanged.
The limits are provisional numerical research screens, not manufacturer specs.

On the real four-panel Foundation Tee after the existing protected edge flips,
the constrained method moved 27 front and 24 back interior vertices but did
**not** remove any of the 37 ill-conditioned rest triangles. Maximum original
material-edge drift was **9.974%** (front) / **9.914%** (back), and maximum
interior movement **1.902 mm** / **1.861 mm**, independently checked using
meter-unit inputs to `auditRestMeshFidelity`. This is materially safer than
the prior unconstrained smoother (422.31% edge drift, 17.57 mm movement),
but **does not repair the mesh**. The 51 accepted vertex-step events are
not equivalent to 51 unique vertices or 51 repaired faces.

| Actual four-panel static-pose measurement | Protected-flip baseline | Capped research candidate |
| --- | ---: | ---: |
| Ill-conditioned rest triangles | 37 / 768 | **37 / 768** |
| Maximum seam gap | 188.452 mm | **188.452 mm** |
| RMS seam gap | 117.400 mm | **117.400 mm** |
| Maximum principal extension | 2389.418% | **1529.465% (still invalid)** |
| Sampled avatar penetrations | 496 | **496** |
| Static same-panel intersections | 24 | **24** |
| Inter-panel broadphase potential contacts | 935 | **935** |
| Physical fit accepted | No | **No** |

The candidate exists only as an in-memory rest-coordinate comparison; world
positions and sewing constraints were deliberately not changed. Consequently
unchanged seam and static contact metrics are expected and **not** proof of
better draping. The bounded four-panel QA observation took approximately
**143 ms**, not a controlled performance benchmark. Source project and
baseline payload passed JSON nonmutation assertions. Six targeted tests passed,
including original-edge drift and protected-geometry negative controls.

The two-panel native checkpoint remains **10/10 complete**, SHA-256
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`
matches the existing executable, and the dry-run reports zero remaining
candidates. No completed experiment was repeated. **Disk fell to roughly
0.38–0.43 GiB free (100% volume usage)** during this bounded continuation:
below both the 1 GiB research-batch floor and the 8 GiB native-build floor.
No native experiment, build, save, cache deletion, offload, branch change,
commit, GitHub push, app/UI change or deployment was performed.

**Next:** the strict edge/displacement caps reveal that simple vertex
averaging cannot resolve the sliver mesh while retaining material fidelity.
Investigate topology-preserving or provenance-aware material remeshing,
including whether a different initial triangulation can avoid the 37 faces
without modifying the original 2D pattern. Validate material correspondence,
strain and collision independently before any production promotion. Continuous
cloth/avatar CCD, safe avatar entry and CLO3D parity remain unverified.

## 19:33 local continuation — independent material-pattern fidelity gate for sliver repair

**New bounded test-level safeguard:** added
`src/core/physics/restMeshFidelityResearch.js` and
`scripts/qa-exo-rest-mesh-fidelity-20261022.mjs`. The independent gate
compares every *original* 2D material edge against its smoothed counterpart,
checks protected/boundary vertices, interior displacement, signed face
orientation, total panel area and unchanged face topology. It rejects
unbounded internal rest-coordinate movement even if triangle quality and
total polygon area improve. The research-only provisional limits are **2 mm
interior displacement and 10% maximum material-edge length drift**; these
are safety-screen thresholds, **not calibrated manufacturer tolerances**.

**Newly detected false win:** existing opt-in interior smoothing on the real
four-panel tee reduces the remaining **37/768 poorly conditioned triangles
to 0/768**, but moves internal rest vertices by as much as **17.571 mm**
and changes individual *material* edge lengths by as much as **422.311%**
(back panel; front **284.253%**). The panel boundary, total area and
protected hinge vertices remain unchanged, yet those large interior changes
redefine the original material coordinate system. Therefore the new
independent **material-fidelity gate rejects** this apparently successful
sliver repair. Do not promote it as manufacturer-faithful remeshing or as
a valid fitted cloth solution. This audit does not change the existing
experimental smoother or the installed application.

| Actual four-panel initial-pose metric | Protected edge flips | Plus unconstrained interior smoothing |
| --- | ---: | ---: |
| Ill-conditioned rest faces | 37 | **0 (material-fidelity rejected)** |
| Maximum seam gap | 188.452 mm | 188.452 mm |
| RMS seam gap | 117.400 mm | 117.400 mm |
| Maximum principal extension | 2389.418% | 533.894% (still invalid) |
| Avatar penetrating samples | 496 | 496 |
| Detected static same-panel intersections | 24 | 24 |
| Inter-panel broadphase potential contacts | 935 | 832 (not certified clear) |
| Largest interior rest-vertex displacement | 0 mm relative to protected-flip baseline | 17.571 mm |
| Largest relative material-edge length change | 0% | 422.311% |
| Physical fit accepted | No | **No** |

**Independent QA:** four new fidelity tests (identity/small safe movement,
area-preserving but material-invalid displacement, protected vertices and
topology, and the actual four-panel garment) passed. Twelve selected
four-panel engineering suites including existing interior smoothing passed
**76/76** in approximately **1.99 s** on final rerun. JS syntax and `git diff --check`
passed. The actual candidate payload build was approximately **95 ms** in
one uncontrolled observation, not a controlled performance comparison.
Project and native payload passed JSON nonmutation checks; no garment save.

The existing **two-panel** native benchmark checkpoint remains complete
at **10/10**, its executable SHA-256 still matches
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`,
and the bounded dry-run reported **zero remaining candidates**. No completed
trial was rerun or checkpoint rewritten. Disk was approximately **1.60 GiB
free**, below the **8 GiB native-build floor**; no native build, cleanup,
offload, deletion, installed-app/UI change, branch reset, commit, push or
deployment occurred.

**Next:** introduce cumulative original-edge and displacement caps into an
explicitly opt-in interior smoother, then measure how many slivers can be
removed *without* invalidating the material coordinate system. Independently
validate all seam, strain and contact gates before considering coupled folding.
Swept cloth/avatar CCD, safe avatar entry and CLO3D parity remain unverified.

## 18:37 local continuation — identify mesh slivers behind persistent contact vetoes

**New bounded, research-only source/test improvement:**
`src/core/backends/nativeClothContactTopologyResearch.js` now diagnoses
unresolved same-panel face pairs using the *rest* triangle graph and geometric
conditioning. The coupled cloth gate exposes minimum material-edge hops,
both rest-face altitudes/aspects and the number of ill-conditioned faces for
each bounded unresolved example. No topology-based contact exemption is ever
granted: even adjacent material faces can violate thickness or intersect.
Disconnected patches and malformed topology are handled explicitly.

The actual four-panel off-body tee's **12 unresolved swept observations** are
still just **two unique stationary pairs**: front `23/115` and back `16/23`.
Both have **one material-edge hop** between their distinct face vertex sets,
and each contains **one sliver triangle** (rest minimum altitude
**0.281642275 mm**, aspect **49.442:1**). The other face in each pair is
not ill-conditioned by the existing 2 mm / 25:1 thresholds. Their static
coplanar gap remains **0.376376569 mm**, below the research 1 mm clearance
by **0.623623431 mm**. This ties the persistent veto to specific, nearby,
poorly conditioned rest geometry rather than an undiscovered sleeve hinge
trajectory; it does **not** prove that the two faces physically intersect.

| Actual four-panel off-body measurement | Current bounded result |
| --- | ---: |
| Initial maximum / RMS seam gap | 345.000 / 192.074 mm |
| Candidate maximum / RMS seam gap | 345.000 / 192.685 mm (RMS worse) |
| Maximum principal extension / compression | <1e-9% / <1e-9% |
| Sampled avatar penetrations | 0 |
| Sampled inter-panel / static same-panel intersections | 0 / 0 |
| Swept same-panel AABB / separated / unresolved | 4,484 / 4,472 / 12 |
| Rest ill-conditioned triangles | 37 / 768 |
| Coupled audit runtime (one uncontrolled observation) | 493.71 ms |
| Original state mutated / physical fit accepted | No / No |

**Independent QA:** 12/12 targeted tests and 69/69 combined deterministic
tests passed; JS syntax checks and `git diff --check` passed. Added a
synthetic disconnected-face negative control and a distinct-face one-hop
topology control. The existing garment, native payload and off-body seed
passed byte-equivalent JSON nonmutation assertions. The existing two-panel
native checkpoint is **10/10 complete**, the executable SHA-256 still equals
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`,
and `--dry-run` reports zero remaining cases; none were repeated. Free disk
was approximately **3.02 GiB**, below the **8 GiB** native-build floor.
No native build, checkpoint rewrite, saved garment change, cache deletion,
offload, UI/app modification, branch reset, commit, push or deployment.

**Next:** repair the identified sliver rest triangles while preserving the
material boundary and hinge graph; independently verify the 1 mm thickness
rule against material adjacency before altering any collision exclusions.
Then search for seam improvement under the existing strain/contact gates.
Neither swept cloth/avatar CCD, avatar entry nor CLO3D parity is certified.

## 18:34 local continuation — verified stationary coplanar clearance deficit

**Bounded research-only diagnostic improvement:** The swept same-panel gate now
measures actual coplanar triangle separation for its bounded unresolved
**stationary** face examples, using projected edge/edge distance, edge
crossings and containment. Noncoplanar pairs report `null`, not a fictitious
3D clearance. The diagnostic never relaxes the existing contact veto. An
independent overlapping-triangle negative control verifies that a true static
overlap reports zero gap and remains rejected. This is **not** swept CCD,
cloth-thickness certification or improved garment fit.

On the real four-panel Foundation Tee, the two unique unresolved pairs are
`front:23/115` and `back:16/23`. Each is stationary during the sleeve-only
hinges, and each has **0.376376569 mm** coplanar separation: a **0.623623431
mm deficit** against the existing 1 mm experimental cloth clearance. The 12
interval observations are repeats of these two pairs, not 12 distinct hits.
There are **zero detected static triangle intersections**; near-clearance is
not proof of penetration. This isolates a rest-geometry/clearance-model
conflict which additional sleeve-hinge sampling cannot resolve.

| Bounded four-panel metric | Measured |
| --- | ---: |
| Initial maximum / RMS seam gap | 345.000 / 192.074 mm |
| Candidate maximum / RMS seam gap | 345.000 / 192.685 mm (RMS worse) |
| Maximum principal extension / compression, all triangles | <1e-9% / <1e-9% |
| Sampled avatar penetrations | 0 |
| Sampled static self intersections | 0 |
| Swept same-panel AABB / axis-separated / unresolved | 4,484 / 4,472 / 12 |
| Rest-mesh poorly conditioned triangles | 37 / 768 |
| Single uncontrolled four-panel evaluation runtime | 508.35 ms |
| Physically accepted / certified | No / No |

**Validation:** 11/11 targeted deterministic tests passed, including a
coplanar-overlap negative control, real four-panel clearance assertions and
original-state byte-equivalent JSON assertions. Both JS syntax checks and
`git diff --check` passed. Available disk was approximately **3.01 GiB**,
below the **8 GiB native-build floor**. No native build, saved garment,
checkpoint rewrite, cleanup, deletion, offload, app/UI change, commit, push
or deployment. The two-panel ten-trial benchmark was not rerun.

**Next:** inspect whether these distinct triangles are legitimately nearby
within one continuous pattern surface, or reflect a meshing defect; do not
weaken the global clearance rule without a material-thickness and adjacency
model. Pursue actual seam closure only with simultaneously acceptable
principal strain and continuous cloth/avatar contact.

## 17:41 local continuation — rigid-side swept-contact certificate and actionable face diagnostics

**Source-level research improvement:** The coupled cloth trajectory gate now
recognizes nonadjacent triangles that share the *same* rigid hinge motion
(or remain fixed) and checks their **time-invariant relative separation**.
This can certify some safe pairs even when the union of their swept bounding
boxes overlaps. Vertices on the fold axis are conservatively inflated by the
maximum displacement caused by the existing world-axis tolerance; the gate
does not assume those vertices are mathematically collinear. Unresolved pairs
still veto acceptance. This is a bounded static-separation certificate for
specific same-side pairs, **not** general swept narrowphase, cloth thickness
validation or continuous collision detection.

The new deterministic synthetic positive control creates two separated
triangles co-rotating through a 2.8-radian hinge. It confirms that the
rigid-motion certificate resolves overlapping swept boxes without accepting
the independent negative-control case where moving cloth crosses a fixed
patch between sampled poses. Added a bounded diagnostic (at most 16 examples)
recording panel, face IDs, stage and interval for genuinely unresolved swept
same-panel pairs. No saved garment, production solver or UI was changed.

On the **actual four-panel off-body Foundation Tee**, this extra certificate
resolved **0** of the remaining **12** potentials; the existing separating-axis
filter still resolves **4,472 of 4,484** swept-box overlaps. Crucially, the
12 observations are only **two distinct stationary-panel triangle pairs**,
repeated across six hinge intervals: `front` faces **23/115** and `back`
faces **16/23**. Both are on the front/back panels while the tested hinges
rotate the sleeves. They are not independently confirmed collisions; their
coplanar/near-clearance geometry requires a static triangle-distance and
material-adjacency investigation, not another identical midpoint subdivision.

| Real four-panel off-body measurement | Before | After |
| --- | ---: | ---: |
| Initial max / RMS seam gap | 345.000 / 192.074 mm | **unchanged** |
| Candidate max / RMS seam gap | 345.000 / 192.685 mm | **unchanged** |
| Maximum principal extension / compression | ~0% / ~0% | **unchanged (<1e-9%)** |
| Sampled avatar penetrations | 0 | **0** |
| Sampled / swept inter-panel potential contacts | 0 / 0 | **0 / 0** |
| Swept same-panel box potentials | 4,484 | **4,484** |
| Separated by swept axes / rigid invariance | 4,472 / 0 | **4,472 / 0** |
| Unresolved swept same-panel potentials | 12 | **12** |
| Static same-panel intersections | 0 | **0** |
| Poorly conditioned rest triangles | 37 | **37** |
| Physical fit accepted | No | **No** |

The new isolated coupled evaluation was approximately **647 ms**; the combined
test observation was approximately **1,080 ms**. These are uncontrolled
observations, not comparable throughput benchmarks. The original garment,
native payload and seed passed byte-identity nonmutation assertions.
Independent combined eleven-script QA passed **69/69**, including the new
synthetic control and persistent-pair diagnostic assertions. Source syntax and
diff-whitespace checks passed. The separate two-panel native parameter grid
remains **10/10 complete**; `--dry-run` found **zero remaining candidates**,
and the executable SHA-256 still matches checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Available disk was approximately **3.13 GiB**, below the **8 GiB native-build
floor**. No native build, checkpoint rewrite, saved garment mutation, cleanup,
deletion, app/UI modification, branch change, commit, push or deployment.

**Next:** independently measure true static triangle-triangle separation for
the two identified front/back face pairs, distinguishing legitimate material
neighbors from unsafe near-contact without weakening the clearance rule.
Then pursue seam reduction under the coupled strain, anchor and contact gate.
Avatar entry, complete swept CCD and CLO3D parity remain unverified.

## 17:02 local continuation — rejected swept-midpoint subdivision experiment

One bounded in-memory research comparison on the **actual four-panel** off-body
Foundation Tee tested an exact angular-midpoint, two-half-interval conservative
separating-axis refinement for unresolved swept triangle pairs. The experiment
was **rejected and its source/test edits reverted**: it resolved **0 of the 12**
remaining within-panel swept-contact potentials (4,484 swept AABB potentials;
4,472 already eliminated by the existing separating-axis filter). The two
uncontrolled observations were ~644 ms without refinement and ~767 ms with it.
This does not establish an actual collision among the 12 unresolved pairs.

The same candidate retained 345.000 mm maximum seam gap, 192.074 -> 192.685 mm
RMS seam gap (worse), approximately zero principal stretch/compression, zero
sampled avatar penetrations, 37 poorly conditioned rest triangles and no
accepted physical fit. The bounded targeted research test passed **8/8** and
source syntax/diff-whitespace checks passed before rejection. No two-panel
benchmark trial was rerun. Available disk was ~3.16 GiB after the experiment,
below the 8 GiB native-build floor. No native build, persistent garment save,
cleanup, deletion, offload, UI/app replacement, commit, push or deployment.
**Next:** distinguish true contact from conservative near-clearance pairs with
a physically grounded triangle narrowphase; do not repeat naive midpoint SAT
refinement without a changed separation criterion.

## 16:41 local continuation — conservative swept separating-axis false-positive reduction

**Concrete source-level improvement:** The research-only two-hinge cloth-contact
gate now runs a bounded **swept separating-axis filter** after its existing
curved-arc swept AABB test, for both inter-panel and nonadjacent same-panel
triangle pairs. For each triangle, the two endpoint vertex positions plus
the analytically conservative circular-arc sagitta enclose every intervening
vertex position. Projections onto endpoint face normals, in-plane edge normals,
and endpoint edge-cross axes can therefore **prove separation** when their
inflated intervals are disjoint. Unresolved pairs still veto research
acceptance; the filter does not infer contact absence from a discrete sample.
It is a conservative separating-axis rejection filter, **not** exact swept
triangle narrowphase, fabric-thickness certification or continuous CCD.

| Four-panel off-body two-hinge metric | Previous swept AABB gate | New swept axis filter |
| --- | ---: | ---: |
| Initial maximum seam gap | 345.000 mm | **345.000 mm** |
| Candidate maximum seam gap | 345.000 mm | **345.000 mm** |
| Initial seam RMS | 192.074 mm | **192.074 mm** |
| Candidate seam RMS | 192.685 mm | **192.685 mm** |
| Maximum principal extension | <0.000001% | **<0.000001%** |
| Sampled avatar penetrations | 0 | **0** |
| Sampled inter-panel AABB potentials | 0 | **0** |
| Swept inter-panel unresolved potentials | 0 | **0** |
| Swept same-panel AABB potentials | 4,484 | **4,484** |
| **Swept same-panel provably separated pairs** | Not checked | **4,472** |
| **Swept same-panel unresolved potentials** | **4,484** | **12** |
| Static same-panel intersections detected | 0 | **0** |
| Ill-conditioned rest triangles (this seed) | 37 | **37** |
| Contact screen clear / candidate accepted | No / No | **No / No** |
| Isolated coupled evaluation runtime | 482.41 ms | **642.83 ms** (targeted) / **1021.26 ms** (combined QA) |

The new filter eliminates **99.73% (4,472/4,484)** of the conservative
same-panel swept-box potentials in this one motion while retaining **12
unresolved pairs**. The remaining pairs are *potential* contacts, not
confirmed intersections; no fit was accepted. These uncontrolled runtimes
are not a benchmark and must not be compared as stable performance numbers.
The independent regression now explicitly checks false-positive elimination,
count conservation, and the earlier analytically witnessed hidden same-panel
and inter-panel collisions, which remain rejected. Targeted **8/8 PASS**;
combined eleven-script solver QA **68/68 PASS**; both source syntax checks
and diff-whitespace checks passed. Project, native payload and seed were
asserted byte-identical before/after the real-garment test.

The separate two-panel benchmark checkpoint is **10/10 complete**, with
SHA-256 `1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`
matching the existing native executable. No completed trial was rerun.
Available disk at start was approximately **3.4 GiB**, below the **8 GiB**
native-build safety floor. No native build, default solver/UI/installed-app
change, saved garment mutation, cleanup, deletion, branch change, commit,
push or deployment occurred. The separate opt-in interior smoothing experiment
has shown zero *rest-quality* failures but worsened its comparison strain;
it is **not** the off-body seed measured here and is not approved for fitting.

**Next:** investigate the 12 unresolved swept same-panel pairs with a
stronger bounded conservative interval subdivision/narrowphase, and seek
actual seam reduction under material, anchor, avatar and cloth-contact
constraints. Safe avatar entry, full CCD and CLO3D parity remain unverified.

## 15:46 local continuation — conservative swept within-panel self-contact gate

**Concrete research-only source and test improvement:** The existing coupled
two-hinge evaluator screened within-panel triangle intersections at seven
sampled poses but did not examine self-contact **between** those poses.
`nativeCoupledClothContactResearch.js` now checks conservative curved-arc
swept AABBs for **nonadjacent same-panel** triangle pairs on every hinge
interval, in addition to the existing inter-panel interval broadphase.
The preflight work budget now accounts for both kinds of swept checks,
before allocating candidates. Invalid clearance tolerances fail closed.
No production solver, interface or default mesh path was modified.

An independent negative-control test places a disconnected static patch
within the same synthetic panel, verifies a genuine hidden triangle
intersection at an analytically selected intermediate hinge angle with the
independent static narrowphase, and shows that all ordinary sampled poses
miss it. The new swept self-contact screen correctly rejects that motion.
A separate control documents **false positives** from swept AABB overlap
between nonintersecting faces; a positive-control fan triangulation remains
eligible for research acceptance. The new screen is deliberately
conservative, **not** swept triangle narrowphase or continuous collision
certification. AABB potentials must not be reported as confirmed impacts.

| Four-panel off-body two-hinge metric | Previous discrete/inter-panel gate | With swept same-panel gate |
| --- | ---: | ---: |
| Initial maximum seam gap | 345.000 mm | **345.000 mm** |
| Candidate maximum seam gap | 345.000 mm | **345.000 mm** |
| Initial seam RMS | 192.074 mm | **192.074 mm** |
| Candidate seam RMS | 192.685 mm | **192.685 mm** |
| Maximum principal extension | <0.000001% | **<0.000001%** |
| Sampled avatar penetration count | 0 | **0** |
| Sampled inter-panel AABB potentials | 0 | **0** |
| Swept inter-panel AABB potentials | 0 | **0** |
| Sampled same-panel triangle intersections | 0 | **0** |
| **Swept same-panel AABB potentials** | Not checked | **4,484** |
| **Swept same-panel pairs checked** | Not checked | **443,034** |
| Ill-conditioned rest triangles | 37 | **37** |
| Research contact screen clear | Yes (incomplete) | **No (conservative veto)** |
| Research candidate accepted / fit certified | No / No | **No / No** |
| Single experimental evaluation runtime | 400.20 ms | **482.41 ms** |

Runtime figures are isolated uncontrolled observations, not a speed
benchmark. The additional conservative screen reveals **4,484 potential
within-panel interval contacts**, not 4,484 verified collisions. It cannot
separate real collisions from overlapping swept boxes without a more exact
continuous narrowphase. The garment's seam alignment still fails to improve;
rest conditioning of this off-body seed remains unsafe at 37 triangles.
The project, original native payload and off-body seed passed byte-identity
nonmutation assertions.

Targeted coupled-contact tests **8/8 PASS**; independent combined solver QA
across eleven scripts **68/68 PASS**; syntax checks passed. The two-panel
native checkpoint remains complete at **10/10** with executable SHA-256
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`;
no completed trial was rerun. Free disk remained approximately **3.1 GiB**,
below the **8 GiB native-build floor**. No native build, installed-app/UI
change, garment save, deletion, cleanup, branch change, commit, push or
deployment occurred.

**Next:** reduce conservative swept-box false positives with a bounded,
independently validated swept triangle narrowphase, then combine the
already demonstrated opt-in rest-mesh conditioning with a strain/contact
merit objective before attempting genuine four-panel seam closure. Neither
avatar-entry swept collision safety nor CLO3D parity is certified.

## 15:39 local continuation — corrected rest-mesh altitude units; all 768 triangles pass conditioning screen

**Verified research-only improvement:** The optional interior smoothing
penalty was comparing centimeter-space mesh altitudes against **0.002 cm**
(0.02 mm), whereas `inspectClothMesh` requires **0.2 cm** (2 mm). This
100-fold unit mismatch left five low-altitude triangles untreated despite
acceptable aspect ratios. Corrected the smoothing penalty and poor-face
predicate to use the same 0.2 cm criterion as the independent quality gate.
The existing production/default simulation path remains unchanged; this
requires the explicit experimental mesh-optimization and interior-smoothing
flags.

One bounded diagnostic and one targeted deterministic regression run on the
**actual four-panel** EXO Foundation Tee (500 particles, 768 triangles)
established the following comparison. The new test includes an independent
synthetic negative control with aspect <25 but altitude <2 mm, which the old
0.002 cm predicate could not improve.

| Objective metric | Prior experimental smoothing | Corrected experimental smoothing |
| --- | ---: | ---: |
| Rest triangles failing quality screen | 5 / 768 | **0 / 768** |
| Worst triangle aspect ratio | 23.536:1 | **23.536:1** |
| Maximum seam gap | 188.452 mm | **188.452 mm** |
| RMS seam gap | 117.400 mm | **117.400 mm** |
| Maximum principal extension | 436.676% | **533.894% (worse)** |
| Maximum principal compression | 89.041% | **89.041%** |
| Avatar penetrating endpoint samples | 496 | **496** |
| Within-panel static self-intersections | 24 | **24** |
| Inter-panel potential AABB contacts | 826 | **832 (worse)** |
| Candidate fit certified | No | **No** |

The corrected option also improves on the edge-flip-only baseline of 37
poor rest triangles and 2,389.418% maximum principal extension, but the
comparison against the *immediately previous smoothed candidate* reveals
a material-strain regression. **Do not promote** this to the solver or call
it an improved physical fit. No actual sewing closure, collision-free
trajectory, cloth/avatar validity or swept CCD has been established.

The candidate native-payload construction measured **29.492 ms** in one
uncontrolled observation; the three targeted regression tests passed **3/3**
in **308 ms** total, and both syntax and diff-whitespace checks passed.
Tests preserve original garment/project, native default payload, 14 sewing
groups, 2 anchors, 4 hinge axes, polygon boundaries and face topology, and
reject static contact regressions. No persistent garment save, native build,
installed-app/UI modification, deletion, offload, commit, push or deploy.
Disk was **3.1 GiB free** before the iteration, below the 8 GiB build floor.
The separate completed **two-panel** ClothCraft `tshirt` benchmark was not
rerun and must not be used as evidence for this four-panel garment.

**Next:** use a coupled strain/contact merit objective to remove the
principal-strain regression while retaining valid rest-mesh conditioning,
then seek physically valid seam closure and avatar-safe folding.

## 15:16 local continuation — opt-in interior smoothing removes 32 of 37 poor rest triangles

**Verified source-only research improvement:** Added
`src/core/physics/interiorMeshSmoothingResearch.js` as an explicitly opt-in
post-edge-flip conditioning step, integrated through the existing
`experimentalOptimizeMesh` path with a separate
`experimentalSmoothInteriorMesh:true` flag. The algorithm adjusts only
interior rest-mesh vertices, using bounded one-ring quality descent with
backtracking. It freezes every polygon boundary vertex and every protected
material-hinge edge endpoint, preserves triangle indices and sewing
correspondence, rejects orientation inversions, and never turns a locally
previously acceptable face into a poor face. The ordinary EXO simulation
and default native payload are unchanged. The new feature is **research
only**, not an automatic garment repair or production solver replacement.

**One bounded comparison on the actual four-panel Foundation Tee**, using
the same protected-hinge edge-flipped baseline and regenerated native
constraints:

| Metric | Protected edge flips only | Plus opt-in interior smoothing |
| --- | ---: | ---: |
| Poorly conditioned rest triangles (768 total) | **37** | **5** |
| Worst rest triangle aspect ratio | 49.442:1 | **23.536:1** |
| Maximum initial seam gap | 188.452 mm | **188.452 mm** |
| Initial seam RMS | 117.400 mm | **117.400 mm** |
| Maximum principal extension | 2389.418% | **436.676%** |
| Maximum principal compression | 89.041% | **89.041%** |
| Avatar penetrating endpoint samples | 496 | **496** |
| Inter-panel potential AABB contacts | 935 | **826** |
| Within-panel actual static self-intersections | 24 | **24** |
| Physically accepted / fit certified | **No / No** | **No / No** |

The decrease from 37 to 5 is an **86.5% reduction** in the remaining
poor rest elements, with the worst rest aspect ratio now under 25:1.
The 5 remaining elements still violate the 2 mm minimum-altitude screen.
More importantly, **436.7%** principal extension, **89.0%** compression,
**496** sampled avatar penetrations and **24** static within-panel
self-intersections make this starting pose physically unacceptable.
Potential AABB contacts are conservative candidates, not proven
intersections. Sewing gaps are unchanged, so this is a conditioning
improvement only. There is no verified collision-free folding trajectory,
triangle CCD, safe avatar entry or CLO3D-equivalent fitting.

New deterministic tests in
`scripts/qa-exo-interior-smoothing-20261022.mjs` passed **2/2**;
syntax and whitespace checks passed. Tests verify original project and
native payload byte-identity, unchanged four-panel topology and 500
particles, 14 seam groups, sewing correspondence, protected hinge axes,
all boundary coordinates, anchors, default code path and no new static
contact regressions. The experimental payload build took **38.6 ms**
in one uncontrolled observation (not a throughput benchmark).
The independent two-panel ClothCraft native checkpoint remains **10/10
complete** and was not rerun. Free disk remained about **3.1 GiB**,
below the **8 GiB** build threshold. No native builds, persisted garment
saves, user-file deletions, installed-app/UI changes, Git commits, pushes
or deployments occurred.

**Next:** eliminate the final five rest-altitude failures while preserving
protected hinges, then test actual seam-reducing folding under the full
material, contact, anchor and mesh-quality gates. Do not promote this
experimental initial pose as a fitted garment.

## 14:38 local continuation — conservative inter-sample hinge-arc cloth broadphase

**Concrete research-only improvement:** Updated
`src/core/backends/nativeCoupledClothContactResearch.js` and its independent
`scripts/qa-exo-coupled-cloth-contact-20261022.mjs` suite. Previous coupled
cloth-contact screening checked inter-panel triangle AABBs at seven discrete
poses. It could miss an inter-panel collision entirely **between** those
poses. Each rigid-hinge interval now bounds the full curved vertex motion:
the chord endpoints are inflated by the analytically conservative circular
arc sagitta `0.5 * chordLength * tan(abs(deltaAngle)/4)`. Swept triangle AABBs
are compared across different panels for **every interval** of both hinges.
Any possible swept inter-panel contact vetoes research acceptance. The
additional work is included in the preflight pair budget (4,000,000 default,
5,000,000 hard maximum), rather than silently expanding the search.

**Independent negative control:** A small stationary cloth panel at
`z = 0.15 m` intersects the moving front-panel fold at about `0.31 rad`,
while all checked endpoint/interior poses at `0`, `0.6`, and `1.2 rad` have
zero inter-panel broadphase contacts. The test independently checks the
actual intersection location using the folded plane equation, then verifies
that the new interval broadphase rejects the candidate. A separate assertion
confirms interval pairs count against the bounded work budget. The original
fixture remains byte-identical. Targeted **6/6 PASS**; combined solver
regression **63/63 PASS**; syntax checks passed.

**Actual four-panel EXO Foundation Tee**, one bounded two-sleeve hinge
trajectory from the existing `+0.35 m` off-body seed:

| Metric | Seed | Tested two-hinge trajectory |
| --- | ---: | ---: |
| Maximum seam gap | 345.000 mm | **345.000 mm (unchanged)** |
| RMS seam gap | 192.074 mm | **192.685 mm (worse)** |
| Maximum principal extension/compression | ~0% | **<5e-11%** |
| Sampled avatar penetrations | 0 | **0** |
| Discrete inter-panel AABB potential contacts | 0 | **0 / 1,516,032 pairs** |
| **Conservative interval inter-panel potential contacts** | Not previously checked | **0 / 1,299,456 pairs** |
| Discrete same-panel triangle intersections | 0 | **0 / 516,873 pairs** |
| Ill-conditioned rest triangles | 37 | **37 (unresolved)** |
| Candidate accepted / fit certified | No / No | **No / No** |

The additional interval screen performed **1,299,456** pair comparisons,
bringing the preflighted total to **3,332,361** pair checks. The coupled
research evaluation took **400.20 ms** in one isolated targeted test and
**640.74 ms** in a concurrent combined test run; these are uncontrolled
wall-clock observations, not a speed benchmark. Source project, native
payload and off-body seed remained byte-identical. The screen is a
**conservative broadphase for inter-panel rigid hinge arcs only**: overlapping
swept boxes may be false positives, and it does not prove swept narrow-phase,
within-panel continuous self-collision freedom, fabric thickness clearance,
safe avatar entry, or CLO3D-equivalent fitting. The candidate is rejected
because sewing did not improve and rest conditioning is still unsafe.

The separate **two-panel** parameter grid remains **10/10 complete**, and
the existing native executable SHA-256 remains
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`;
no trials were repeated. Free disk was approximately **3.0 GiB**, below
the **8 GiB native-build floor**. No native builds, UI edits, garment saves,
installed-app changes, cleanup, deletions, branch changes, commits, pushes,
or deployments occurred. **Next:** remove the remaining 37 poor rest triangles
without sacrificing protected fold axes, then seek a strictly seam-reducing
trajectory while independently verifying cloth/body and cloth/cloth contact.

## 13:33 local continuation — independent two-hinge cloth-contact and seam acceptance gate

**Concrete source-level research improvement:** Added
`src/core/backends/nativeCoupledClothContactResearch.js` and
`scripts/qa-exo-coupled-cloth-contact-20261022.mjs`. The existing
two-stage hinge search checked avatar endpoints and avatar hinge arcs, but
could not rule out **cloth-to-cloth contact** between panels or within a
panel during the folds. The new *opt-in, read-only* audit samples both true
curved hinge trajectories (not merely endpoint chords) and all three
endpoints. Every sampled pose independently checks sampled avatar clearance,
conservative cross-panel triangle AABBs, nonadjacent same-panel triangle
intersections, full principal material strain and axis-specific soft-anchor
displacement. It reuses the independent seam-candidate gate for max/RMS and
per-group sewing residuals, rest-mesh conditioning, pins and topology. Pair
counts are preflighted against a strict global work budget; incomplete
avatar coverage, invalid anchors and excessive work fail closed. The audit
does not change the production solver, UI or stored garment.

**Independent negative controls:** a deliberately placed narrow cloth panel
intersects a moving panel's *intermediate curved hinge pose*, although the
initial, intermediate-stage and final endpoints are clear; the candidate is
rejected. A second control moves a soft anchor on its constrained Z axis
while all sampled contacts remain clear; it is also rejected. A separated
two-panel synthetic fixture demonstrates that two rest-isometric folds can
reduce both seam metrics without measured stretch or sampled cloth contact.
All **5/5 new tests passed**, and a combined run of **62/62 relevant solver
regression tests passed** (approximately 1.74 s total, uncontrolled).

**Actual EXO four-panel Foundation Tee:** One bounded two-sleeve hinge
trajectory from the previously validated rest-isometric +0.35 m off-body
seed, sampled at three endpoints and four interior hinge poses:

| Independent metric | Before | Two-hinge research candidate |
| --- | ---: | ---: |
| Maximum sewn seam gap | 345.000 mm | **345.000 mm (no improvement)** |
| RMS sewn seam gap | 192.074 mm | **192.685 mm (worse)** |
| Maximum principal extension/compression | ~0% | **<5e-11%** |
| Sampled avatar penetration points | 0 | **0** across evaluated poses |
| Cross-panel AABB potential contacts | 0 in static seed | **0 / 1,516,032 evaluated pairs** |
| Nonadjacent same-panel triangle intersections | 0 in static seed | **0 / 516,873 evaluated pairs** |
| Maximum constrained-axis soft-anchor displacement | ~0 mm | **0 mm** |
| Ill-conditioned rest triangles | 37 | **37 (still unacceptable)** |
| Research screen passed / fitted | No / No | **No / No** |

The independent four-panel audit took **380.31 ms** in one standalone
uncontrolled run (approximately 735 ms when run concurrently with the full
test suite). The proposed motion is strain-preserving and clear under these
*discrete* avatar/inter-panel/intra-panel samples, but **it does not reduce
maximum seam gap, worsens RMS seam gap and retains 37 unsafe rest triangles**.
It is therefore rejected and not applied. Sampled contact cannot certify
cloth thickness, continuous collision detection, avatar entry or CLO3D
parity. Project, native payload and seed were asserted byte-identical in QA.

The separate **two-panel** native parameter checkpoint is **10/10 complete**
and the existing executable SHA-256 still matches
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`;
no completed trials were rerun. Free disk after testing was approximately
**3.0 GiB**, below the **8 GiB native-build safety floor**. No native build,
UI change, garment save, installed-app modification, deletion, cleanup,
branch change, commit, GitHub push or deployment was performed. **Next:**
repair the 37 ill-conditioned rest triangles without losing hinge axes,
then search for a strictly seam-improving trajectory under this new combined
cloth/avatar/anchor/material gate.

## 12:49 local continuation — sampled within-panel contact along a folding path

**One bounded, source-only research improvement:** Added
`src/core/backends/nativeIntrapanelSampledPathResearch.js` and
`scripts/qa-exo-intrapanel-sampled-path-20261022.mjs`. The existing
same-panel narrow-phase checked static endpoints only. The new opt-in
discrete trajectory screen independently checks nonadjacent triangles
at intermediate fractions, supports a supplied curved hinge trajectory
as well as a linear chord, validates unchanged topology and fails closed
when the strict triangle-pair work budget is exceeded. A synthetic
negative control demonstrates a genuine *mid-path self-intersection with
both endpoints clear*; a second control proves that a curved motion can
intersect even when its endpoint chord does not. No installed application
or production solver behavior is changed.

**Real EXO four-panel fixture, one +0.15 rad left-sleeve isometric hinge
from the previously validated rest-isometric off-body seed:** maximum seam
gap **345.000 -> 345.000 mm** (unchanged); seam RMS **192.074 ->
193.816 mm** (worse); peak principal extension/compression below
**5e-11%**; endpoint avatar penetration **0/1268** sampled points;
inter-panel AABB potential contact **0**; endpoint same-panel
intersections **0**; sampled-path same-panel intersections **0/221,517**
nonadjacent triangle pairs over three interior fractions. The bounded
measurement took **347.74 ms** (single uncontrolled run). **Reject
promotion:** RMS seam gap regressed and continuous CCD, cloth thickness,
avatar re-entry and sewn fit remain unverified. All **5/5** new tests
passed. The earlier **10/10 two-panel ClothCraft fixture** remains
separate and unchanged.

Free disk was approximately **2.2 GiB**, still below the 8 GiB
native-build threshold. No native build, saved garment edit, cleanup,
bulk download, installed-app change, UI change, Git commit/push or
deployment was performed. Next: combine developable seam-reducing folds
with all avatar, inter-panel, within-panel, anchor, strain and mesh-quality
screens before any promotion; discrete sampling alone never certifies
swept CCD.

## 12:37 local continuation — same-panel triangle self-intersection veto

**One bounded, source-only engineering improvement:** Added
`src/core/backends/nativeIntrapanelContactResearch.js`, with independent
`scripts/qa-exo-intrapanel-contact-20261022.mjs` tests, and integrated its
static screen into the opt-in `searchNativeOffbodyRestSeeds` initializer.
Previously, the seed could pass the avatar and cross-panel screens while
containing a *self-intersection between nonadjacent triangles of the same
cloth panel*. The new screen enumerates nonadjacent triangle pairs under a
strict work budget, uses AABBs for pruning, then checks candidate overlaps
with a 3D triangle separating-axis test or coplanar 2D polygon clipping.
**Actual detected static intersections veto the seed**; AABB overlaps
without triangle intersection do not. The original garment, pins, soft
anchors, topology, installed UI and native payload are never modified.

**Independent negative controls:** Two coplanar triangles with overlapping
area, and two noncoplanar crossing triangles, are detected. Two triangles
with overlapping AABBs but no geometric intersection, and triangles merely
touching at a boundary, are *not* mislabeled as penetrations. Adjacent
triangles sharing mesh vertices are excluded. Malformed geometry and an
exceeded pair budget fail closed. A disposable two-panel seed containing
within-panel overlap is rejected even when its synthetic avatar and
inter-panel screens report clear. All tests confirm source nonmutation.

| Four-panel metric | Existing optimized initial pose | Rest-isometric off-body research seed |
| --- | ---: | ---: |
| Maximum seam gap | 188.452 mm | 345.000 mm (worse) |
| RMS seam gap | 117.400 mm | 192.074 mm (worse) |
| Maximum principal extension | 2389.418% previously measured | ~0% (4.25e-11%) |
| Sampled avatar penetrations | 496 / 1,268 previously measured | 0 / 1,268 |
| Cross-panel AABB potential contacts | Not independently established | 0 / 216,576 pairs |
| Same-panel nonadjacent AABB candidates | Not independently established | 762 |
| Same-panel nonadjacent triangle intersections | Not independently established | **0 / 73,839 pairs** |
| Certified sewn fit / swept CCD | No / No | No / No |

The new screen successfully distinguishes the **762** harmless broadphase
candidate pairs from **zero** actual static nonadjacent triangle
intersections on the research seed. Four bounded off-body offsets and all
screens took **481.14 ms** in the combined regression run (uncontrolled
wall-clock timing; not a performance benchmark). The new 5-test negative
control suite plus existing off-body and six related material/seam/hinge
regression suites passed **51/51** in approximately **1.55 seconds**.
The previous 10/10 two-panel native candidate grid remains complete;
the existing experimental binary SHA-256
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`
matches its checkpoint. No candidates were rerun.

**Scope limits:** This is a bounded *static* nonadjacent-triangle screen.
Topologically adjacent triangles are intentionally excluded; positive-area
coplanar intersections smaller than the geometric tolerance may be missed;
cloth thickness/clearance and intermediate folding trajectories are not
certified. Neither this screen nor the existing discrete avatar/contact
checks proves continuous collision detection, safe avatar entry, complete
self-collision freedom, sewn assembly or CLO3D-equivalent fit. The
rest-isometric seed still has **worse sewing gaps**, so it is not promoted.

Free disk at validation was approximately **2.2 GiB**, below the **8 GiB**
native-build threshold. No native build, save, deletion, cleanup, install,
UI edit, branch change, commit, Git push or deployment was performed.
**Next:** test nonadjacent *within-panel swept* contact along isometric
hinge arcs, then seek seam reduction from the static-clear seed while
retaining material/anchor constraints and conservative collision gates.

## 12:26 local continuation — soft-anchor-aware off-body staging guard

**Verified experimental validation improvement:** The rest-isometric four-panel
off-body seed now independently checks all active *soft* anchor constraints,
not only particles with `invMass === 0`. A proposed seed that moves an anchored
particle along one of its constrained axes by more than 1 mm is rejected,
without changing its anchor target or strength. Unsupported anchor-axis
metadata and malformed anchor constraints fail closed. A deterministic
negative control changes a disposable research copy's anchor from Y-only to
Z-only and confirms that the proposed +0.35 m off-body shift is rejected.

**Important correction discovered during testing:** The actual EXO Foundation
Tee has **two Y-only shoulder anchors**, not XYZ anchors. Its off-body shift
changes their Z positions by roughly 275–425 mm, but their *constrained Y
positions remain unchanged* (maximum constrained-axis displacement less than
2e-12 mm). Consequently, the real research seed **remains eligible** under
this new anchor guard. An initial assertion incorrectly treated the anchors
as XYZ and failed; it was corrected after inspecting their actual `axes: 'y'`
fields. Final deterministic test suite: **4/4 PASS** (approximately 0.50 s).

The real four-panel test still reports **345.000 mm max / 192.074 mm RMS**
seam gap, effectively zero principal extension/compression, zero sampled
avatar penetration points out of 1,268, zero inter-panel AABB potential
contacts, and **76.934 mm** minimum inter-panel AABB distance. The previous
EXO initial pose's **188.452 mm max / 117.400 mm RMS** seams remain better.
This is a safer *validation of an unsewn staging pose*, not improved sewing,
self-collision, swept contact, avatar re-entry or certified fit.

The completed two-panel ClothCraft `tshirt` benchmark remains unchanged at
10/10 and is not used as evidence for the real four-panel garment. The Mac
had approximately **3.3 GiB** free, below the 8 GiB build threshold. No
native build, garment save, installed-app change, file deletion, Git push or
deployment was performed.

## 11:38 local continuation — independent inter-panel cloth contact broadphase

**New experimental safety improvement:** Added
`src/core/backends/nativeInterpanelBroadphaseResearch.js` and integrated
it into the opt-in `searchNativeOffbodyRestSeeds` initializer. The prior
off-body seed search checked the avatar but could accept two **cloth panels
overlapping one another**, even when every avatar sample was clear.
The new bounded audit examines **every cross-panel triangle pair** using
conservative 3D axis-aligned bounding boxes, with a 1 mm clearance margin.
An AABB near-overlap vetoes the candidate; false positives are possible,
but a separated AABB pair cannot contain intersecting triangles at that
instant. It does not check same-panel self-contact, triangle narrow-phase,
the motion between poses, or continuous collision detection.

The actual four-panel EXO Foundation Tee's previously established
rest-isometric off-body seed at **+0.35 m** still passes the added
inter-panel *static broadphase*: **zero potential cross-panel contact pairs
out of 216,576 checked triangle pairs**,
**76.934 mm** minimum cross-panel AABB distance, **zero of 1,268**
sampled avatar penetration points, and approximately zero principal
material extension/compression (below 5e-11%). The **345.000 mm maximum**
and **192.074 mm RMS** seam gaps are **worse** than the initial EXO
pose's **188.452 / 117.400 mm**, so this remains an unsewn
research initializer, **not a fitted garment**. Four offset trials took
**117.75 ms** in one uncontrolled local run.

**Independent negative control:** Deliberately placed the front, back and
sleeves in the same material-depth plane while an avatar-only callback
reported all samples clear. The new cross-panel check found potential
cloth/cloth contact and rejected the seed. Separate synthetic cases cover
exactly overlapping triangles, a 0.5 mm near-contact, and a 20 mm
separation. Source project and native payload remain unchanged; no user
garment is written. The six related lightweight suites passed **46/46**
tests in approximately **0.99 s**, including **4/4** seed tests.

The separate ClothCraft **two-panel** native preset grid is complete at
10/10 with the same binary SHA-256 as its checkpoint; no candidates were
repeated. Disk had **~3.3 GiB** free, below the **8 GiB** build/save
threshold. No native builds, installs, saves, file cleanup, UI edits,
branch changes, commits, pushes, or deployments occurred.
**Next:** static *within-panel* nonadjacent triangle narrow-phase,
conservative cloth/cloth swept contact, and an isometric seam-reducing
fold from the new seed; do not certify avatar entry or CLO3D parity.

## 11:23 local continuation — rest-isometric offbody initialization, four-panel EXO tee

**One bounded source-only research iteration:** Added
`src/core/backends/nativeOffbodyRestSeedResearch.js` and
`scripts/qa-exo-offbody-rest-seed-20261022.mjs`. The tool generates a
**disposable in-memory** rest-isometric staging pose from the actual 2D
material coordinates of the EXO four-panel Foundation Tee. It preserves
sewing correspondences, faces, material rest geometry and the source project,
refuses to move pinned cloth, and screens up to six bounded avatar offsets.
It is **not** a fitted garment, a self-collision solution, a collision-safe
avatar entry or an installed solver change.

On the opt-in edge-flip mesh (500 particles, 768 faces, 102 seam samples),
four Z-offset candidates were tested at 0.35, 0.70, 1.05 and 1.40 m.
The nearest offset with zero sampled avatar penetration was **0.35 m**.
Its independent full-triangle principal extension and compression were both
numerically **0%** (under 5e-11%); all **1,268** vertex/centroid avatar
screen samples were clear. This establishes a material-isometric,
avatar-clear **starting pose**, not a physically valid sewing result.

| Independent four-panel metric | Existing optimized EXO initial pose | Research offbody seed |
| --- | ---: | ---: |
| Maximum sewn gap | 188.452 mm | **345.000 mm (worse)** |
| RMS sewn gap | 117.400 mm | **192.074 mm (worse)** |
| Full-triangle principal extension | 2389.418% previously measured | **~0%** |
| Full-triangle principal compression | Invalid initial pose | **~0%** |
| Sampled avatar penetrations | 496 / 1,268 previously measured | **0 / 1,268** |
| Sewn, safe re-entry, self CCD, fitted | No | **No** |

**Decision:** Retain the research-only rest-isometric initializer as a
non-destructive foundation for future collision-aware developable folding;
**reject the pose as an assembled shirt** because seam maximum and RMS both
regress. The bounded four-trial search took **39.06 ms** in one uncontrolled
observation. Two new deterministic tests passed, including pinned-cloth,
duplicate/unbounded offsets and incomplete contact-screen negative controls.
Neither the source garment nor the input native payload changed.

Available disk was approximately **3.6 GiB**, below the **8 GiB** native
build/save threshold. No native builds, saves, bulk downloads, offloads,
deletions, UI modifications, Git pushes or deployments were performed.

## 10:40 local continuation — staged two-hinge research

Added `nativeCoupledHingeResearch.js` and `qa-exo-coupled-hinge-20261022.mjs`.
The bounded two-hinge search evaluates at most 16 angle combinations. It
checks the initial, intermediate and final avatar samples; spectral stretch
and compression; pins; sewn-group residuals; and discretely sampled straight
and curved paths for both folds. It permits an intermediate seam regression
only if the final pose passes the independent candidate gate. It does not
modify editable garments or certify continuous collision detection.

On a synthetic fixture, the maximum/RMS seam gap changes from 150.147 mm to
331.356 mm after the first fold, then to 63.969 mm after the second fold,
with zero principal extension/compression and zero sampled penetrations.
The isolated test took approximately 2.4 ms.

On the actual four-panel EXO tee, four protected-mesh hinge combinations
were evaluated. Baseline maximum/RMS gaps were 188.452/117.400 mm; the best
trial measured 184.119/113.501 mm, but had 2389.418% principal extension,
496 initial avatar penetration samples, 622 intermediate and 635 final
penetrations, and 16,846 penetrating sampled path points. All four trials
were rejected; the in-memory experiment took about 414–450 ms.

Five new tests passed, and the five related research suites passed 42/42.
Source garment and native payload remained unchanged. The separate native
two-panel grid is already complete at 10/10 with matching executable SHA.
Free disk was approximately 3.7 GiB, below the 8 GiB native-build threshold.
No native build, saved-garment change, UI change, push or deployment occurred.
Next: fix 37 poorly conditioned rest triangles and initial fabric/contact
validity before interpreting coupled folds as physical sewing progress.

## 09:57 local continuation — rigid-panel registration feasibility limit (four-panel fixture)

**One bounded, read-only research iteration:** On the real EXO Foundation Tee
(front/back/left sleeve/right sleeve), generated rigidly isometric 3D panel
poses from the existing optimized 2D rest mesh and solved relative per-panel
translations by a small anchored least-squares seam graph. Compared 18 bounded
panel-orientation combinations (back: 0/180 degrees; sleeves: -90/0/+90
degrees). This was an in-memory diagnostic, not a solver or UI modification.

| Independent four-panel metric | Existing opt-in optimized 3D pose | Best rigid-isometric translation trial |
| --- | ---: | ---: |
| Maximum seam gap | 188.452 mm | **345.000 mm (worse)** |
| RMS seam gap | 117.400 mm | **162.227 mm (worse)** |
| Maximum principal extension | 2389.418% | **approximately 0% (better)** |
| Maximum principal compression | Invalid existing pose | **approximately 0%** |
| Analytic avatar penetrating samples / 1268 | 496 | **826 (worse)** |
| Swept CCD / certified fit | No / No | **No / No** |

The 18-configuration search and metrics took about **176.49 ms** in one
uncontrolled local run. No rigid registration trial passed the seam/contact
acceptance criteria; no candidate was promoted. The source project and native
payload were independently verified byte-unchanged after the iteration.

**Actionable geometric obstruction:** The actual Foundation Tee includes
`seam-sleeve-l-underarm` and `seam-sleeve-r-underarm`, each sewing **two edges
of the same sleeve panel** (`src/data/defaultProject.js`, seam definitions).
A whole-panel rigid translation or rotation cannot reduce the distance
between those within-panel seam endpoints. Therefore rigid-panel placement
alone cannot solve this garment's sewing problem, even with exactly zero
material strain. The next solver change must provide material-compatible
**intra-panel folding** (preserved hinge lines or well-conditioned bending)
and collision-safe assembly; simply optimizing panel transforms is inadequate.

The previously completed ten-trial native `tshirt` checkpoint remains a
**different two-panel** research fixture and was not rerun. Available disk
was approximately **3.6–3.7 GiB**, below the 8 GiB native-build threshold.
No native builds, garment saves, offloads, deletes, UI edits, commits, pushes
or deployments occurred. This is a **negative feasibility result**, not a
physical fitting improvement or CLO3D parity evidence.

## 09:37 local continuation — fold-line-preserving constrained remesh, actual four-panel tee

**Concrete opt-in source improvement:** The existing `optimizeTriangleQuality`
edge-flip pass can now accept explicit `protectedEdges` and refuses to flip
those interior diagonals. New `materialHingeProtectedEdges` derives **all**
mesh segments lying on an existing material fold line, rejects fold axes
that cut through a triangle, and prevents accidental partial hinge removal.
The native payload builder now accepts a research-only
`experimentalProtectedHingeAxesByPiece` option **when experimental mesh
optimization is explicitly enabled**. The physics mesher performs the
protected flips **before constructing particles, seam constraints and bending
constraints**, so the resulting research payload has consistent regenerated
constraint topology. Default garment simulation and user interface remain
unchanged. This does not certify cloth contact or physically valid fitting.

**Actual four-panel EXO Foundation Tee:** Selected one originally executable
material fold line on each panel (`front`/`back`: `[69,70]`; both sleeves:
`[33,34]`). Independently compared the unmodified source mesh, prior opt-in
edge flips and the new protected-edge opt-in, without saving or changing the
project. The protected variant preserves **14 executable hinge sides**, up
from **6** with ordinary edge flips, while maintaining **37 poorly
conditioned rest triangles** (down from 192 without edge flips). The protected
and ordinary optimized meshes have identical initial seam maximum
**188.452 mm**, RMS **117.400 mm**, maximum principal extension **2389.418%**,
and **496** penetrating endpoint avatar samples. Thus this improves the
available developable folding degrees of freedom **without improving physical
fit**. One protected native payload generation took approximately **31.58 ms**
in a single in-process observation; this is not a throughput benchmark.

**One bounded new-hinge experiment:** The newly retained back-panel fold
axis `[69,70]` was tested at `-0.2` and `+0.2` radians with independent seam,
spectral material, endpoint contact, straight-chord and curved-hinge-arc
screens. The `+0.2` candidate reduced seam maximum/RMS from
**188.452/117.400 mm** to **173.713/110.853 mm**, but still had
**2389.418%** maximum principal extension, **89.04%** maximum compression,
**705** endpoint penetrating samples and **8801** penetrating intermediate
samples (17,752 checks). The `-0.2` candidate worsened seam maximum/RMS to
**265.535/142.226 mm**. **Both were rejected**; neither can be promoted.
The two-angle search took approximately **135.74 ms** in one local run.

**Validation:** Added `scripts/qa-exo-protected-hinge-remesh-20261022.mjs`
with four new positive/negative/regression tests. The new suite passed **4/4**
and the four prior related suites passed **34/34**, **38/38 combined**.
Independent assertions verified unchanged source garment, original native
payload, sewing-group correspondences, virtual sewing anchors, particle
count, full test result determinism, and unchanged default native payload.
The existing two-panel native trial grid remains complete at **10/10**;
compiled binary SHA-256 still matches the checkpoint and no candidate was
repeated. Free space was approximately **3.7 GiB**, below the **8 GiB**
native-build threshold. No native build, save, UI change, cache deletion,
offload, branch reset, Git push or deployment occurred. **Full coupled
cloth/body/self collision, continuous collision detection, avatar entry and
CLO3D-equivalent fitting remain unverified.**


## 08:39 local continuation — material-hinge discovery on the actual four-panel garment

**New source-level capability:** `discoverNativeDevelopableHinges` in
`src/core/backends/nativeDevelopableHingeResearch.js` enumerates internal
rest-mesh edges that genuinely divide a panel without cutting through a
triangle. It independently checks current-world hinge-axis collinearity,
moving pinned vertices, material-side partitioning and bounded deterministic
candidate ranking. It does not mutate the original garment or claim contact
or physical-fit approval. The corresponding independent tests are in
`scripts/qa-exo-developable-hinge-20261022.mjs`.

**Measured geometric tradeoff on EXO's actual four-panel Foundation Tee:**

| In-memory rest/pose inventory | Original 768-face mesh | Existing opt-in edge-flip mesh |
| --- | ---: | ---: |
| Mesh-aligned material fold axes | **220** | **39** |
| Axes also collinear in current 3D pose | **20** | **3** |
| Executable (unpinned) hinge sides | **40** | **6** |
| Ill-conditioned rest triangles (prior independent check) | 192 | **37** |

**Interpretation:** Edge flips improve conditioning but remove many mesh-edge
fold lines. A future remesher must jointly preserve seam boundaries,
triangle conditioning **and intended material fold axes**. Neither set of
geometric axes implies that a valid body-safe, low-strain sewing trajectory
exists.

**Bounded real-garment experiment:** Evaluated all six currently executable
opt-in hinge sides at angles -0.2 and +0.2 radians, **12** in-memory trials
with independent seam, spectral strain, pin, endpoint avatar and seven-sample
chord-plus-arc contact checks. Best observed seam residual was **184.119 mm
maximum / 111.626 mm RMS**, compared with **188.452 mm / 117.400 mm**
before the fold. The best trial still had **2389.418% peak principal
extension**, **622** penetrating endpoint samples and **8066** penetrating
intermediate chord-plus-arc samples (17,752 checked). **0/12 candidates
accepted**. One bounded sweep took about **696 ms**; this is not a throughput
benchmark. Original project and native input payload were byte-identical
after the sweep. This is an independent test of the *real four-panel mesh*,
not the completed separate two-panel ClothCraft parameter grid.

**Validation:** Four lightweight suites passed **34/34** in approximately
**990 ms**, including new positive, negative, deterministic and real-garment
hinge-discovery/selection tests. Syntax and diff-whitespace checks passed.
The two-panel checkpoint remains complete at 10/10 and its native binary
SHA-256 still matches; it was not rerun. The Mac had approximately **3.6 GiB
free**, below the **8 GiB** native-build floor. No Rust build, persistent
garment save, UI/installed-app modification, file cleanup, branch reset,
Git push or deployment was performed. **No CLO3D parity, physical fit,
continuous collision detection, or avatar-entry certification is claimed.**

## 07:35 local continuation — verify every contact sample and compare opt-in remeshing after sewing

**Verified research-safety fix:** The seam-candidate gate previously trusted
the aggregate contact `checked` count. A malicious or buggy contact report
could skip a sampled pose and overcount a different pose while preserving the
same aggregate. `src/core/backends/nativeSeamCandidateGate.js` now requires a
per-pose `samples` record, exact expected garment vertex-plus-triangle-centroid
coverage **at each intermediate pose**, consistent penetration counts and
intrusion maxima, and valid time fractions. The hinge research path now
preserves both chord and true hinge-arc sample records when combining their
coverage. Six new negative-control cases reject masked/omitted or inconsistent
records. The four lightweight suites passed **30/30**; no native builds,
garment saves, UI edits, commits, pushes or app replacements were performed.

**One bounded real four-panel A/B experiment:** Compared the existing 700-step
experimental seam assembly with original versus **opt-in** edge-flip mesh,
holding the 4-piece garment, 500 particles, 102 seam pairs, material settings
and 8-point sampled-contact path constant. Original project and both native
input payloads remained byte-identical after the run. Measurements are
single local observations, not repeatable throughput benchmarks:

| Four-panel experimental metric | Original mesh | Opt-in edge flips |
| --- | ---: | ---: |
| Final maximum seam gap | 1.44287 mm | **1.34444 mm** |
| Final seam RMS | 0.53704 mm | **0.50201 mm** |
| Maximum principal extension | 3112.05% | **851.78%** |
| Maximum principal compression | 50.78% | **41.60%** |
| Triangles exceeding 5% extension | 390 | **116** |
| Triangles exceeding 5% compression | 80 | **50** |
| Penetrating avatar samples (1268 checked) | **977** | 1024 |
| Penetrating intermediate-path samples (8876 checked) | **6187** | 6224 |
| Total in-process observation | 148.93 ms | 123.66 ms |

**Decision: REJECT both poses.** Although the opt-in mesh substantially
reduces material distortion and slightly improves seam closure, avatar
penetration worsens, and both poses violate the material limit by hundreds
of percentage points. Existing edge flips also leave 37 poor-quality rest
triangles. These results are **not** a valid fit, collision-free garment,
certified swept CCD or production performance improvement. No opt-in feature
was enabled by default. Available disk was approximately **3.7 GiB**, still
below the **8 GiB** native-build floor. The 10/10 two-panel benchmark
checkpoint remains unchanged and is not used as evidence for this four-panel
experiment.

## 07:34 local continuation — test the actual hinge arc, not only the endpoint chord

**New research-only contact safety improvement:** `src/core/backends/nativeDevelopableHingeResearch.js`
now exports `inspectNativeHingeArcContactPath`, which samples the real
Rodrigues-rotation trajectory of a developable material-aligned fold at seven
intermediate angles. The bounded hinge search requires **both** its previous
straight-chord contact screen and the new curved hinge-arc screen to pass the
independent candidate gate. Every arc sample must cover the full declared
garment vertex-and-triangle-centroid set; partial reports are rejected.
The search reports chord and arc penetration counts separately, and its
combined contact coverage includes both paths. This is a conservative
research screen, **not** continuous collision detection or avatar entry.

**New negative control:** a narrow synthetic obstacle lies on the circular
hinge trajectory while both endpoints and every straight-chord sample are
clear. The new arc screen detects **one** intermediate penetration and the
hinge search rejects the candidate. Another test rejects malformed or
partial per-sample coverage and unbounded subdivisions. The original
synthetic developable hinge still improves max and RMS seam gap from
**203.961 mm to 5.317 mm**, with **0%** principal extension, effectively
**0%** compression, no sampled penetrations on its clear-body fixture and
**1.415 ms** observed evaluation time. Source-state nonmutation remains
asserted. This synthetic result is not the real four-panel tee.

**Independent regression:** four bounded lightweight suites passed
**29/29** in about **294 ms**. The actual EXO Foundation Tee is still
**rejected**: last measured staged seam max **1.44 mm**, RMS **0.537 mm**,
peak principal extension **3112.05%**, endpoint avatar penetrations
**977/1268**, and seven-sample chord penetrations **6187/8876**; its last
measured full research assembly/audit runtime was approximately **103 ms**.
The new hinge arc screen has **not** produced a feasible actual four-panel
fold and must not be interpreted as a physical-fit improvement.

The separate two-panel native parameter grid remains **10/10 complete**.
The compiled executable SHA-256 still matches the checkpoint, so no
candidate was rerun. Current free disk was about **3.7 GiB**: above the
1 GiB research-preview floor but below the **8 GiB** native-build floor.
No Rust build, UI/garment/installed-app mutation, project save, cache
deletion, offload, branch reset, Git push or deployment occurred. The next
engineering task remains boundary-preserving conditioning of the 37
remaining opt-in sliver faces, followed by hinge placement on the real
four-panel mesh and genuine cloth/body/self swept collision handling.

## 06:42 local continuation — a material-aligned, developable hinge proposal

**New source implementation:** `src/core/backends/nativeDevelopableHingeResearch.js`
adds a bounded, deterministic **internal panel fold** primitive and a small
candidate-angle search. Unlike whole-panel rigid registration, the proposal
can rotate **only one side of a panel** around a rest-mesh-aligned hinge line.
It refuses hinges that cut through an unsplit triangle, off-axis hinge
vertices, moving pinned vertices, invalid axes or unbounded angles. A true
mesh-aligned hinge rotates each affected triangle rigidly, preserving its
material deformation singular values. The source garment is cloned, never
edited; all proposals are still independently checked by the existing seam
max/RMS, per-group, principal stretch/compression, rest conditioning, pins,
endpoint avatar and seven-intermediate-pose contact screens. No candidate
is approved for production or swept-CCD certification.

**Independent QA:** `scripts/qa-exo-developable-hinge-20261022.mjs`
adds seven tests including material isometry, seam closure, invalid
triangulation, pins, malformed hinge geometry, bounded angle search,
contact rejection and an independently detected nonisometric perturbation.
The full lightweight regression suite (new hinge + seam gate + four-panel
spectral + four-panel mesh comparison) passed **27/27 tests** in approximately
**294 ms**. The new synthetic two-piece, mesh-aligned fold fixture improved
seam **max and RMS from 203.961 mm to 5.317 mm**, with effectively **0%
principal extension/compression**, zero sampled contact penetrations under
the fixture's *synthetic* empty-body screen, and **1.46 ms** in-process
evaluation in one observation. Source state remained byte-identical.
**This is not a new result for the real EXO Foundation Tee.**

The **real EXO four-panel Foundation Tee** remains unchanged and rejected:
its preexisting staged candidate has **188.45 -> 1.44 mm** max seam gap,
**117.400 -> 0.537 mm** RMS, **3112.05%** peak principal extension,
**977/1268** endpoint penetrating samples and **6187/8876** intermediate
penetrating samples; the latest lightweight repeat measured about **106 ms**
for assembly/audits. Rest-mesh conditioning still has **192** invalid
sliver faces before opt-in edge flips and **37** after them. No mesh-aligned
hinge path has been certified for this actual garment; no physical fit,
cloth/body/self continuous collision detection or avatar entry was
established.

The prior **two-panel** native parameter grid remains **10/10 complete**,
with executable SHA-256 matching its checkpoint; it was not repeated.
Free disk was approximately **719–722 MiB**, below both the 1 GiB
native-preview threshold and the 8 GiB native-build floor. No native build,
garment save, UI change, branch reset, cache deletion, file offload,
installed-app replacement, Git push or deployment occurred.

## 06:39 local continuation — reject incomplete contact screens

The native two-panel checkpoint remains complete at **10/10** and was not
rerun. The EXO four-panel experimental candidate gate now independently
requires endpoint avatar sampling coverage equal to the total number of
garment vertices **plus** triangle centroids, and sampled-path coverage equal
to that count multiplied by the number of intermediate poses. It also
rejects impossible contact counts. Previously, a caller could supply a
clearance report covering only one vertex and have it treated as full-garment
contact evidence. A new negative-control regression demonstrates rejection
of such incomplete endpoint and path reports. This strengthens *research
candidate rejection*, not cloth-body collision solving or certification.

One bounded lightweight deterministic regression run passed **20/20** tests
in approximately **274 ms**. On the actual EXO four-panel Foundation Tee,
the preexisting seam assembly experiment still reports **188.45 -> 1.44 mm**
maximum seam gap, **117.400 -> 0.537 mm** RMS seam gap, **3112.05%** maximum
principal extension, **977/1268** endpoint body-penetration samples and
**6187/8876** sampled intermediate penetrations; assembly and audits took
approximately **103 ms** in this observation. The candidate is still
**rejected**. Independent mesh optimization telemetry remains 192 -> 37
poorly conditioned rest faces, but is not enabled for production.

Disk had **720 MiB** free after the run, below the **8 GiB** native-build
floor. No native build, persistent garment save, installed app replacement,
download, file deletion, unverified offload, deployment or Git push occurred.
The research gate does not recompute a caller's avatar clearance values; it
only validates their declared coverage, so it is not a tamper-proof proof of
collision freedom or swept triangle CCD.

## 05:40 local continuation — sampled pose-path contact rejection

The existing native ClothCraft **two-panel** `tshirt` parameter checkpoint is
still complete (**10/10**). The executable SHA-256 still matches the recorded
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
No candidates were repeated. Free disk was approximately **913–915 MiB**,
below the 1 GiB native experiment floor and 8 GiB Rust build floor; no native
process, rebuild, save, cache deletion, backup offload or installer action ran.

**Concrete safety improvement:** added
`src/core/backends/nativeSampledContactPath.js`, an independent, bounded,
nonmutating contact screen for **seven intermediate linearly interpolated
poses** between the original and candidate garment (eight subdivisions).
It uses the existing sampled avatar-clearance screen on every intermediate
vertex and triangle centroid. The experimental seam assembly now records
this screen and its candidate gate **requires intermediate-path clearance**
as well as endpoint clearance, valid rest mesh, material stretch/compression,
pins, and per-group max/RMS seam improvements. Missing intermediate evidence
cannot silently count as a successful research candidate.

**Independent negative control:** a synthetic garment starts and finishes
outside a narrow body slab while its interpolated trajectory passes through
the slab. Endpoint checks are clear; the new intermediate screen detects
the crossing and the research candidate gate rejects it. Malformed meshes,
nonfinite coordinates, missing screen callbacks and excessive subdivisions
are rejected. The source project, native payload, installed app, UI and
existing worktree remain unchanged by the research evaluation.

**Actual four-panel EXO Foundation Tee, bounded in-memory run:**

| Metric | Original pose | Experimental staged candidate |
| --- | ---: | ---: |
| Maximum seam gap | 188.45 mm | 1.44 mm |
| RMS seam gap | 117.4003 mm | 0.5370 mm |
| Maximum principal triangle extension | Not comparable to accepted fit | **3112.05%** |
| Triangles exceeding 5% principal extension | Not accepted | **390 / 768** |
| Sampled endpoint avatar penetrations | Not accepted | **977 / 1268** |
| Intermediate path penetration samples | — | **6187 / 8876** (seven poses) |
| Experimental assembly + research audits | — | **103.95 ms** (one observation) |
| Research candidate accepted | — | **NO** |

The path screen is a **discrete rejection diagnostic**, not true swept
triangle/triangle CCD or a proof of safe avatar entry. Interpolation is a
candidate displacement diagnostic, **not the real solver trajectory**; a
collision may still occur between the seven samples. The experiment remains
unfit and unapproved. The next engineering target remains safe conditioned
rest-mesh remeshing (37 slivers after opt-in flips), developable constrained
folding, and independently validated cloth/body and cloth/self swept CCD.

**Validation:** `node --test scripts/qa-exo-seam-candidate-gate-20261022.mjs
scripts/qa-exo-four-panel-principal-strain-20261022.mjs
scripts/qa-exo-four-panel-mesh-optimization-20261022.mjs` returned **19/19
PASS**, approximately **262 ms** combined. Source syntax and diff whitespace
checks passed. These are research QA results, not physical-fit certification.

## 04:37 local continuation — opt-in rest-mesh edge-flip comparison

One bounded, in-memory comparison tested EXO's existing **opt-in**
`experimentalOptimizeMesh` against the unmodified four-panel Foundation Tee
(`quality: 'quality'`), using the same 500 particles, 768 triangles and 102
sewing correspondences. New deterministic regression:
`node --test scripts/qa-exo-four-panel-mesh-optimization-20261022.mjs`
**1/1 PASS**, approximately 0.19 seconds total. This did not rebuild Rust,
save a garment, edit the original project, change the installed application,
or enable mesh optimization by default.

| Initial-pose metric | Original mesh | Existing opt-in edge flips |
| --- | ---: | ---: |
| Ill-conditioned rest triangles (768 total) | 192 | **37** |
| Worst rest aspect ratio | 263.01:1 | **49.44:1** |
| Max seam gap | 188.452 mm | 188.452 mm |
| Seam RMS gap | 117.400 mm | 117.400 mm |
| Max principal extension (already-invalid initial pose) | 7933.80% | **2389.42%** |
| Penetrating analytic avatar samples (1268 tested) | 500 | **496** |
| Measured in-process comparison runtime | 37.8 ms | 31.2 ms |

All 14 individual sewn-group residuals were unchanged; the project and
both payloads passed nonmutation checks. This is a **measured numerical
conditioning improvement from a pre-existing opt-in algorithm**, not a new
physically valid garment or a certified speed improvement. The optimized mesh
still contains 37 badly conditioned triangles, violates the material strain
limit and penetrates the avatar. Do not promote it into production, interpret
the initial pose as a fitted state, or claim collision-safe assembly. Next
engineering target: boundary-preserving rest-mesh remeshing that resolves the
remaining slivers, followed by constrained folding and real swept contact.
Disk space was approximately **903 MiB free**, below the 8 GiB native-build
floor. No offload or deletion was attempted.

## 04:33 local continuation — individual seam-group regression prevention

The native two-panel parameter grid remains complete (10/10); it was not rerun.
The Mac had 912 MiB available, below the 1 GiB experiment floor and 8 GiB
native-build threshold. Work was limited to source-level validation.

The experimental four-panel candidate gate now measures RMS residual for each
named sewn group, and rejects a candidate when *any* group's maximum or RMS
seam gap worsens, even if overall maximum and RMS improve. It also validates
group identities and pair counts. Two negative-control tests demonstrate the
previously missed case: the bodice can improve while an underarm seam opens by
50 mm, and the new gate rejects that candidate. Reordered groups remain valid;
missing or duplicated groups are rejected. The combined deterministic suites
passed 15/15 in approximately 249 ms.

On the real four-panel Foundation Tee, one 81.6 ms experimental comparison
measured maximum seam gap 188.452 to 1.443 mm and RMS 117.400 to 0.537 mm;
none of its 14 seam groups regressed. Nevertheless, the candidate remained
rejected: 3112.05% maximum principal extension, 50.78% maximum principal
compression, 192 ill-conditioned rest triangles and 977/1268 penetrating
avatar sample points. Original project and native payload remained unchanged.
This is a safety-gate improvement, not validated garment fitting, safe avatar
entry, swept collision certification or a controlled speed benchmark.

## 04:13 local continuation — verified rest-mesh conditioning guard

One bounded in-memory four-panel research iteration compared the original EXO
Foundation Tee to a rigid-flat, translation-registered variant without saving
or altering the original garment. Baseline: **188.452 mm max / 117.400 mm RMS**
seam gap, **7933.80%** maximum principal extension, 500 sampled body
penetrations. Rigid-flat variant: **345.000 mm max / 133.633 mm RMS** seam
gap, effectively **0%** principal extension/compression, 491 sampled body
penetrations. Runtime for the bounded comparison was approximately **75 ms**.
The candidate failed both seam and contact acceptance, so it was rejected.

Independent rest-geometry inspection found **192 of 768** four-panel mesh
triangles below the 2 mm altitude or above 25:1 aspect conditioning
threshold: front 64, back 64, left sleeve 32, right sleeve 32. Worst
aspects are **151.096:1 front**, **263.012:1 back**, and **32.55:1** in
each sleeve. These are *rest mesh* defects; even a zero-strain rigid pose
does not make the solver's inverse rest matrices well-conditioned.

The research-only `nativeSeamCandidateGate.js` now recomputes mesh
conditioning from actual rest triangles and requires it for a research
candidate to pass. This prevents accepting a superficially good seam
candidate on sliver meshes. The existing installed EXO UI, native binary,
saved garments and application release behavior were not changed. **13/13**
deterministic regression tests passed, including a new negative control
where rigid seam closure, zero strain and clear endpoint contact are all
insufficient because the rest triangle is dangerously slender. This is a
validated *safety-gate improvement*, **not** improved physical draping.
Disk remained at about **738 MiB free**, so no native builds, persisted
garment saves, large downloads or unverified offloads were performed.

**Verified:** 2026-10-22 (local). **Scope:** already compiled experimental ClothCraft CPU VBD+OGC research; EXO Foundation Tee four-panel browser/native staging; no native builds, installer replacements, Git pushes, UI changes, or edits to personal garments. Current branch retains its original uncommitted work.

## Critical correction: two unrelated T-shirt fixtures

The benchmark at `integrations/clothcraft/qa-tee-solver-iteration-loop-20261022.mjs` opens **ClothCraft's `tshirt` engineering preset with only TWO panels** (front/back). Source proof: `research/oss/clothcraft-upstream-solver-review-20261020/src/garment/presets.rs` builds panels from `[('front', 0.38), ('back', -0.15)]` and begins with 530 mm seam gap. Its ten parameter variations are a valid repeatable research test of this **two-panel specimen**, NOT a measured completion percentage or quality improvement for the actual **four-panel** EXO Foundation Tee.

By contrast, `createTemplateProject('tee')` in EXO yields **four panels: front, back and left/right sleeves**, with 500 particles, 768 triangles, 102 sewing pair samples across 14 sewn groups, and 2 anchors. Its own baseline is **188.45 mm maximum seam opening**, 105.69 mm mean sewn gap and **139.31% peak material rest-edge strain** in the initial 3D pose. These are different starting garments, geometry, solvers and constraint classes; **never compare their numeric results as if they describe the same sewn shirt**.

## Research loop — completed and checkpointed

- `npm run qa:tee-iteration-loop` implements a bounded, resumable search of 10 strict 5%-principal-extension parameter choices using the *pre-existing* native executable, a frozen T-shirt preset and one disposable session per invocation.
- The saved checkpoint `docs/qa/clothcraft-tee-loop-20261022.json` contains all 10 results, unchanged compiled executable SHA, configuration hash and completed state. The script is bounded by default to 3 trials and a 180s budget, demands at least 1 GiB free for this lightweight research job, verifies its initial session remains unchanged, and never saves a garment. This 1 GiB limit is **not** safe for Rust builds (separate >=8 GiB floor).
- Best configuration: 40 rigid registrations, 10 off-body nonrigid registrations, 2 fabric rings, 2 sweeps and 20 VBD steps. **530 mm -> 229.887806 mm max gap**, final **146.608634 mm seam RMS**, strict <=5% principal extension, **zero** accepted dynamic nonrigid blocks and 2,560 rejected strain trials. Alternative nearby choices failed to make meaningful additional gains. Native preview explicitly marks avatar entry and swept CCD unverified.
- This is a parameter-selection ceiling, **not** a fully sewn T-shirt, physically accepted garment or true AVBD replacement.

## Real four-panel EXO tee — independent physical metric catches a false win

Implemented `src/core/backends/nativePrincipalStrainAudit.js` as an independent numerical audit of every rest 2D-to-world 3D triangle. Unlike an edge-length-only check, it computes the **largest singular value of the 3x2 deformation gradient** to detect extreme material shear/stretch, and reports maximum, p95, violating triangle count, degenerate rest elements and five worst triangles. Degenerate/invalid elements cannot accidentally pass its declared strain check. It does **not** assert triangle CCD, real fabric calibration or fit approval.

The *experimental* `src/core/backends/seamAssembly.js` now attaches this independent `principalStrainAudit` to its `assemblyExperiment` metadata, **without enabling** invalid preassembly in production or changing EXO UI. `npm run qa:four-panel-principal-strain` executes deterministic tests of rigid rotation, 10% uniform extension, nearly degenerate/sheared triangle, exact degenerate rejection, actual seam rest-length correspondence and the complete EXO tee candidate. **8/8 PASS after the October 22 compression-gate correction.**

**03:21 local continuation:** A new independent negative control demonstrated that a 50% uniformly compressed triangle was incorrectly reported as *within* the nominal 5% material-strain limit, because the initial checker examined only the largest singular value. This has been corrected in `nativePrincipalStrainAudit.js`: the smallest singular value now detects material compression, and a collapsed world triangle cannot pass. Added two deterministic negative-control tests; all 8 pass in about 0.24 seconds. This corrects **experimental safety telemetry**, not the garment's physical sewing or production fit. The four-panel 700-step trial remains rejected. In one read-only four-panel comparison, initial seam maximum/RMS were 188.45/117.4003 mm; staged maximum/RMS were 1.44/0.5370 mm, with 3,112.05% maximum principal extension, 390 extension violations and 977 avatar-screen penetrating samples. Runtime was about 105.5 ms (single uncontrolled observation). Original project and particle positions were unchanged. Mac had about 760 MiB free; native builds, persistent saves and unverified offloads remained prohibited.

| Measured on EXO's 4-panel tee | Initial EXO pose | Experimental 700-step seam correction |
| --- | ---: | ---: |
| Maximum seam opening | **188.45 mm** | **1.44 mm** |
| Peak rest edge-length strain | **139.31%** | **18.49%** |
| Peak *principal* triangle extension | Not used as legacy initial preflight gate | **3112.05%** |
| P95 principal triangle extension | Not used as legacy initial preflight gate | **1782.50%** |
| Triangles exceeding a nominal 5% principal extension | Not used as legacy initial preflight gate | **390 / 768** |
| Analytic avatar screen penetrating sample count | Not directly comparable | **977** sample points |
| Physically certified / suitable for app promotion | **No** | **No** |

The misleadingly good 1.44 mm seam opening comes with *extreme* spectral distortion and body penetrations. Some initial triangles have very poor aspect ratios (previous audit found >100:1 in bodice meshes), making material deformation estimates both physically alarming and numerically ill-conditioned; that demands remeshing/conditioning and a real material law. The 5% ceiling is an **experimental** bound, not a calibrated threshold for all knit fabrics. Neither proximity nor endpoint samples certify full swept cloth/body or cloth/self collisions.

Additional source experiment: stiff rest-edge maintenance with 700 bounded sewing iterations can attain ~3.11 mm seam gap and ~14.12% peak *edge* strain for some settings, but **does not** eliminate body intrusions and is not certified by the independent spectral oracle. Moving the entire sheet off-body removes current analytic body overlap but does **not** provide a safe trajectory back onto a person, nor a self-collision certificate. Therefore keep all such results as **research-only**.

## Next meaningful solver work

1. **Fix mesh conditioning and actual full-panel geometry:** document worst faces via `principalStrainAudit.worstTriangles` and improve triangulation for aspect ratio/altitude. Compare original 2D rest area and post-relaxation 3D deformations; do not certify slender invalid elements by ignoring them.
2. **Feasible constrained folding:** drive seam residuals down with hinge/developable panel motions, bounded spectral strain, true cloth/body/self-contact, independently checked high-quality mesh and a coupled merit function. Test the actual **four-panel** fixture, not only a native two-panel convenience preset.
3. **Separate off-body assembly and avatar re-entry:** any staged outcome must have a verified collision-safe time-dependent approach; a teleport is not acceptable. Implement real swept triangle/triangle CCD before promotion.
4. **Runtime experiments:** only after >=8 GiB free and preserved worktree, rebuild an isolated native binary and test 200/1000-step acceptance against known external fixtures. Source-only JS regression checks remain useful under low disk, but do not resolve the physical fit failure.

## Storage / operational blocker

During this continuation the Blender Mac's data volume dropped from approximately **1.7 GiB to ~0.5 GiB available**, showing 100% capacity. The historically verified SSH path to the physical Expansion drive timed out; **no backup was transferred/deleted**, and no unsafely temporary Rust build was attempted. Full native build and persisted garment-save verification are **blocked** until safe headroom and a working verified backup path exist. No user file was intentionally purged.

**Decision:** keep the high-integrity spectral quality gate and the frozen numerical evidence; reject off-body seam-close-only wins; preserve the normal EXO interface. The user-authorized ongoing work loop can resume safe bounded research checks when disk and connector access permit. The installed app is unchanged.

## 2026-10-25 10:42 local — bounded two-angle contact-first candidate admission

The frozen two-panel native parameter grid remains **10/10 complete** and was
not repeated. The on-disk `exo-session` SHA-256 is
`8256ccda544abe3cd348fac6e37e7518e3222e39e4442b1da3641a541298279e`,
different from the checkpoint's
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
The data volume had **2,570,640 KiB free (~2.45 GiB)**, below the 8 GiB
native-build floor. No native iteration or build ran, and no candidate was
repeated.

New research-only `nativeSleeveCoupledCandidateAdmissionResearch20261025.js`
and `qa-exo-sleeve-coupled-candidate-admission-20261025.mjs` implement a
bounded, fail-closed candidate-ranking gate for **sequential** sleeve hinge
motion followed by seam translation. It rejects candidates with individual
seam-group regressions, excess principal extension/compression, invalid static
contact, unresolved inter-panel motion intervals, ill-conditioned rest faces,
or incomplete evidence. An adversarial control proves a lower-RMS colliding
candidate is rejected in favor of a higher-RMS research-screened candidate.
The validator enforces unique coverage of all three other panels, the three
motion samples, and consistent angle/translation evidence. A diagnostic-best
candidate is **never** automatically promoted as physically feasible.

Independent real four-panel QA evaluated the right sleeve at **-0.2 and +0.2
radians** with the existing detached crease remesh and bounded translation
optimizer, using the same **102 sewing correspondences / 14 groups**. Both
were rejected by all five safety categories:

| Real Foundation Tee pose | Max seam gap | RMS seam gap | Peak principal extension | Peak compression | Static contact | Screened |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Unmodified four-panel source | 188.452 mm | 117.400 mm | 7,933.803% | 89.041% | Invalid | No |
| Right sleeve -0.2 rad + translation | 343.276 mm | 144.667 mm | 7,933.803% | 89.041% | Invalid | No |
| Right sleeve +0.2 rad + translation | 343.276 mm | 144.605 mm | 7,933.803% | 89.041% | Invalid | No |

The two-angle experiment took approximately **1.71 s** in one uncontrolled
run; combined new and predecessor QA **7/7 PASS** in approximately **3.99 s**.
Independent seam and principal-strain oracles agreed with the candidate
metrics; source payload, detached mesh, and folded payloads passed JSON
nonmutation checks. Syntax and Git whitespace checks passed. Only the new
research module/test and this engineering report were changed.

**Scope limitation:** The two stages were screened separately. This is **not**
simultaneous coupled-path CCD, deformable same-panel continuous collision
certification, calibrated solver integration, avatar entry, or CLO3D parity.
No UI, editable garment, native app, installed software, branches, or existing
worktree changes were reset, deleted, or promoted. Next target: an actually
joint fold-angle/translation trajectory with conservative contact rejection
and independently verified fabric constraints on a better-conditioned mesh.

## 2026-10-25 11:38 local — actual simultaneous sleeve hinge + translation path

The two-panel frozen native candidate grid is still **10/10 complete**.
Read-only executable SHA-256 is
`8256ccda544abe3cd348fac6e37e7518e3222e39e4442b1da3641a541298279e`,
not checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
The data volume had **2,369,488 KiB free (~2.26 GiB)**, below the 8 GiB
native-build floor. No completed candidate was repeated; no native trial/build.

Created detached research module
`src/core/backends/nativeSleeveSimultaneousMotionResearch20261025.js`
and independent numerical/adversarial test
`scripts/qa-exo-sleeve-simultaneous-motion-20261025.mjs`.
Unlike the previous two-stage screening, this module constructs one prescribed
**simultaneous** right-sleeve crease rotation and rigid translation from the
original flattened sleeve, verifies that its terminal pose agrees with the
independently constructed fold-then-translation endpoint, and runs conservative
inter-panel interval checks separately against front, back and opposite sleeve.
It also measures actual intermediate seam, principal strain and static contact
at path fractions 0, 0.5 and 1. This is a rigid-hinge kinematic experiment,
**not** a deformable solver trajectory or complete cloth/self/avatar CCD.

| Actual four-panel configuration | Maximum seam gap | RMS seam gap | Principal extension | Principal compression | Static contact |
| --- | ---: | ---: | ---: | ---: | --- |
| Original authored garment | 188.452 mm | 117.400 mm | 7,933.803% | 89.041% | Failed |
| Simultaneous right sleeve path, t=0 | 345.000 mm | 154.885 mm | 7,933.803% | 89.041% | Failed |
| Simultaneous right sleeve path, t=0.5 | 344.569 mm | 147.428 mm | 7,933.803% | 89.041% | Failed |
| Simultaneous right sleeve path, t=1 | 343.276 mm | 144.605 mm | 7,933.803% | 89.041% | Failed |

The independently scoped interval screen **rejects** the moving sleeve vs.
back: exact sampled **0 mm** triangle separation at path fraction **0.9375**
(right-sleeve face 12 vs. back face 148). It clears the two other *inter-panel*
pair screens under its conservative prescribed-motion assumptions. Static
intra-panel intersections remain **3** at all three samples; inter-panel
near-clearance pairs are **61 / 66 / 64**. The result fails seam regression,
rest-mesh quality, principal strain, static contact, and motion contact gates.
All physical acceptance, auto-apply, continuous deformable CCD, avatar entry,
and CLO3D parity claims remain **false**.

**QA:** 2 new focused tests plus 7 predecessor admission/merit tests:
**9/9 PASS**, zero failures, approximately **4.30 s** combined. The actual
simultaneous screening study took approximately **0.43 s** in one uncontrolled
observation (excluding preceding detached remesh, fold and merit construction).
Independent Rodrigues midpoint construction, original sewing and principal
strain oracles, static contact counts, endpoint equivalence, malformed motion,
sewing, topology and budget rejection, and JSON source/input nonmutation were
checked. JavaScript syntax passed. No production UI, saved garment, installed
application, branch, unrelated worktree entry, cache, or native build was
changed by this research run; no reset, cleanup, install, commit or push.

**Next:** repair poorly conditioned material triangles and the initial body
strain, then optimize simultaneous hinge/translation under verified contact
and sewing-group constraints. A cleared rigid inter-panel interval would still
not establish deformable same-panel continuous collision safety or avatar entry.

**Independent adversarial follow-up:** a separate read-only reviewer found
that the first version accepted stale source sleeve geometry, nonboolean
nonmutation flags and altered terminal sewing metadata. The research preflight
now requires exact independently regenerated Foundation Tee fixture identity,
strict boolean evidence, original/remeshed material face winding and area,
and source/base/folded/optimized sewing, anchors and stationary-panel
provenance. Focused regressions reproduce and reject these alterations.
After hardening, the combined **9/9 tests pass in ~4.22 s**, and the
new simultaneous study itself took **~0.47 s** in an uncontrolled observation.
These stronger input checks do not alter the rejected physical result.

## 2026-10-25 12:39 local — bounded same-sleeve disjoint-face interval veto

**New source-level research safety check:**
`src/core/backends/nativeSleeveDisjointSweptContactResearch20261025.js`
screens a prescribed hinge-plus-translation sleeve trajectory for **material-
disjoint same-panel triangle pairs**, using swept AABB lower bounds and
bounded midpoint-distance interval subdivision. It rejects sampled sub-1 mm
contacts, unresolved motion bounds, malformed face/particle ownership and
exceeded work budgets. It deliberately **does not** certify shared-edge or
shared-vertex contact, deformable CCD, avatar contact or physical acceptance.
Integrated this additional veto into the existing detached simultaneous
motion research gate; the production solver, saved garment and UI are untouched.

On the actual right sleeve, the new interval inventory has **15,753 total
face pairs**, including **14,814 material-disjoint pairs** and **939 adjacent
pairs explicitly not certified**. At maximum interval depth 10, the bounded
screen independently identifies **faces 97 and 101** at path fraction **0.5**
with **0.584016 mm** exact triangle separation, below the 1 mm research
clearance. This is a *specific near-contact witness*, not a new full-sleeve
collision certification. The check rejected the trajectory after **79,471
distance evaluations**, within its 100,000-evaluation budget. A shallower
depth-8 check conservatively returned an unresolved-motion-bound blocker;
depth 10 resolves this to an actual sampled near-clearance violation. A
separate independent triangle-distance oracle on reconstructed midpoint
positions reproduced the 0.584016 mm witness.

**Physical comparison (no new accepted pose):** the original four-panel tee
still has **188.452 / 117.400 mm** maximum/RMS seam gap; the existing
simultaneous right-sleeve path at t=0.5 has **344.569 / 147.428 mm**, and its
endpoint has **343.276 / 144.605 mm**. Maximum principal extension remains
**7,933.803%**, compression **89.041%**; three same-panel static intersections
persist at each sample, and the separate inter-panel path still has a zero-
distance sleeve/back collision at fraction 0.9375. **Contact validity fails;
physical acceptance remains false.** No new solver fit or calibrated fabric
parameters were produced.

**QA:** added `scripts/qa-exo-sleeve-disjoint-swept-contact-20261025.mjs`
with synthetic swept-contact, clean-disjoint, adjacency-not-certified,
malformed-input and source-nonmutation controls; strengthened the existing
simultaneous-motion test with independent midpoint face-distance verification.
Focused suites **6/6 PASS** in approximately **3.13 seconds**; expanded
regression with prior folded-seam and admission suites **13/13 PASS** in
approximately **3.50 seconds**. The complete
four-panel research study took **~1.66–1.71 seconds** in uncontrolled runs,
including the new conservative disjoint-face interval check; these are not
native solver benchmarks. Source/test syntax passed.

**Native safety preflight:** saved two-panel grid **10/10 complete** and
executable SHA-256 `8256ccda544abe3cd348fac6e37e7518e3222e39e4442b1da3641a541298279e`
does **not** match frozen checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Data volume had **2,431,912 KiB free (~2.32 GiB)** at preflight and
**2,438,568 KiB** at final inspection, below the
8 GiB native-build threshold. **No native iteration/build or completed
candidate repeat.** No cache cleanup, reset, installation, commit, push,
branch switch, UI edit or saved garment mutation.

**Next:** improve material conditioning and the severe body-panel rest strain,
then seek coupled poses that pass individual seam groups and both inter-panel
and intra-panel static/interval contact. Neighboring-face swept contact,
deformable CCD, safe avatar entry and CLO3D parity remain unverified.

## 2026-10-25 13:42 local — planar body-panel staging with contact-constrained depth grid

**New source-level research candidate:** added
`src/core/backends/nativeFoundationTeePlanarBodyDepthResearch20261025.js`.
Instead of repeating the completed native registration grid or only remeasuring
the failing sleeve trajectory, this constructs **new four-panel poses**:
front/back body particles are re-embedded from their authored 2D material
coordinates into two rigidly offset planes, while both sleeves, sewing
correspondences, material UVs, face topology and constraints are retained.
It tests six bounded symmetric depth offsets
`[0, .005, .01, .013, .014, .02] m` and selects the smallest RMS seam
residual **only among candidates that independently preserve body edge metrics
and pass exact static inter-panel contact**. A lower-RMS candidate with
inter-panel contact is explicitly vetoed. This is detached research output,
never an applied garment or calibrated coupled solver trajectory.

The original four-panel source has **188.452 / 117.400 mm** maximum/RMS
sewing gap, **7,933.803%** peak principal extension, **89.041%**
peak compression, **6** same-panel static intersections and **122**
inter-panel near-clearance pairs. Independent per-panel isolation shows that
the front and back each have **7,933.803%** maximum principal extension,
whereas the sleeves each have **751.535%**. This identifies the original
curved body geometry, not only the sleeves, as the dominant spectral-stretch
blocker.

| New planar body depth | Maximum seam gap | RMS seam gap | Full-garment principal extension | Inter-panel near-clearance pairs | Depth research screen |
| --- | ---: | ---: | ---: | ---: | --- |
| 0 mm | 170.093 mm | 143.741 mm | 751.535% | 0 | Clear |
| 5 mm | 166.809 mm | 139.045 mm | 751.535% | 0 | Clear |
| 10 mm | 164.603 mm | 134.463 mm | 751.535% | 0 | Clear |
| **13 mm (selected)** | **163.338 mm** | **131.773 mm** | **751.535%** | **0** | **Clear** |
| 14 mm | 162.926 mm | 130.887 mm | 751.535% | 38 | **Vetoed** |
| 20 mm | 160.566 mm | 125.687 mm | 751.535% | 155 | **Vetoed** |

For the selected 13 mm pose, all **1,440** front/back triangle-edge
measurements preserve their rest length within **2.3e-16 m**, and the
front/back principal extension and compression are numerically zero
(<1e-9%). Compared with the original source, maximum seam gap decreases by
**25.114 mm** and peak full-garment extension decreases by **7,182.268
percentage points**, but RMS seam gap **worsens by 14.373 mm**. The remaining
**751.535%** sleeve extension, **89.041%** compression and **6**
same-panel intersections keep full strain and static contact **invalid**.
An independent named-seam comparison also rejects the staged geometry:
**10 of 14 sewing groups regress** against the original source. Both side
seam groups gain approximately **122.43 mm** maximum gap and **122.98 mm**
RMS gap. This pinpoints the central geometric limitation of rigid planar
front/back staging: two separated planes cannot bring both left and right
side seams together. The selected pose is useful only as a material-isometric
diagnostic, not a sewing candidate for solver handoff.
The clear inter-panel *endpoint* screen does not prove a safe trajectory,
adjacent-face swept CCD, deformable CCD, avatar entry or physical fit.
All candidates report `physicalAcceptance:false`,
`safeToAutoApply:false` and `continuousDeformableCCDCertified:false`.

The existing two-panel native checkpoint remains **10/10 complete**,
and read-only executable SHA-256
`8256ccda544abe3cd348fac6e37e7518e3222e39e4442b1da3641a541298279e`
does not match the frozen
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Data-volume headroom was **2,402,780 KiB (~2.29 GiB)** at preflight,
well below the 8 GiB native-build floor. No native build, experiment repeat,
installation, cache deletion, saved garment change, UI change, reset,
branch switch, commit or push occurred. One uncontrolled six-depth research
evaluation took approximately **0.69 s**; it is not a native-solver
performance benchmark. Pre-existing relevant sleeve research regression
**13/13 PASS** (~3.23 s). An independently authored
`scripts/qa-exo-foundation-tee-planar-body-depth-20261025.mjs`
reconstructs all six poses without calling the staging constructor, recomputes
all **102** seam gaps and **1,440** body edge lengths, checks static
intra-/inter-panel contacts, validates source-state nonmutation and rejects
tampered source geometry, changed sewing, invalid clearances and malformed
depth grids. New independent QA **3/3 PASS** (~1.62 s); expanded new +
predecessor suites **16/16 PASS**, **0 failures** (~3.80 s). Source and test
JavaScript syntax checks and engineering-report whitespace check passed.
Disk headroom at combined QA completion: **2,400,280 KiB (~2.29 GiB)**;
subsequent read-only final check: **2,378,936 KiB (~2.27 GiB)**.

**Next:** explore bounded crease-/facet-conforming developable body bending
that can wrap both side seams without stretching rest material, followed by
joint body/sleeve seam alignment under same-panel collision constraints,
with no promotion until individual sewing groups, material strain and
continuous deformable contact pass independent acceptance tests.

## 2026-10-25 14:39 local — conforming centreline body hinges, bounded seam/contact grid

**Concrete new research-only geometry:**
`src/core/backends/nativeFoundationTeeHingedBodyResearch20261025.js`
splits each actual Foundation Tee body triangle that crosses its material
`x=0` centreline, deduplicates crossing-edge vertices, and rigidly rotates
the two resulting body half-panels toward the opposite body panel. Unlike
rotating unsplit crossing triangles, this preserves the **piecewise planar
material metric** without imposing artificial centreline stretch. The
original 102 sewing constraints and all original particle indices remain
untouched; the 45 new particles and 90 additional body triangles are research
geometry only. Existing solver structural/bending/mass constraints have **not**
been reconstructed for this split mesh.

| Material split | Front | Back |
| --- | ---: | ---: |
| Original triangles | 240 | 240 |
| Original triangles crossing hinge | 20 | 27 |
| Added vertices | 19 | 26 |
| Resulting triangles | 278 | 292 |
| Signed material-area error (m²) | 5.55e-17 | 5.55e-17 |

A separate read-only reviewer independently counted **20 front / 27 back**
shared centreline hinge edges, with **zero unmatched hinge boundaries** and
**zero nonmanifold edges** in either split mesh. This checks topological
continuity, not calibrated bending behavior.

Evaluated the bounded **4 fold angles × 2 symmetric depth offsets** grid
`angles=[0,0.2,0.4,0.6] rad`, `depths=[0,13] mm` on the actual four-panel
tee, independently measuring every candidate's seam residual, material-edge
metric, principal strain and static same/inter-panel contact. All 1,710
resulting body triangle edges preserve rest length to at most **2.24e-16 m**.

| Pose | Maximum seam gap | RMS seam gap | Peak full-garment extension | Inter-panel near-clearance pairs | Same-panel intersections | Scoped inter-panel screen |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Original authored tee | 188.452 mm | 117.400 mm | 7,933.803% | 122 | 6 | Failed |
| Planar 0 rad, 13 mm depth | 163.338 mm | 131.773 mm | 751.535% | 0 | 6 | Clear |
| Fold 0.2 rad, 13 mm depth | 146.302 mm | 99.580 mm | 751.535% | 132 | 6 | **Vetoed** |
| Fold 0.4 rad, 0 mm depth | 139.705 mm | 90.258 mm | 751.535% | 158 | 6 | **Vetoed** |
| Fold 0.4 rad, 13 mm depth | 142.603 mm | **90.191 mm** | 751.535% | **312** | 6 | **Vetoed** |

The 0.4-radian / 13-mm configuration is a **new lower-seam-error pose**:
maximum seam gap improves by 45.849 mm and RMS by 27.209 mm relative to
the authored four-panel source, while the body panels themselves remain
material-isometric. Only **two** of 14 seam groups regress against the source
at this angle, compared with **ten** in the planar staging. But it has 312
inter-panel near-clearance violations, six same-panel intersections,
**751.535%** residual sleeve extension and **89.041%** compression. It is
explicitly **rejected**, not selected or applied. Six of eight poses have
better RMS than the static-inter-panel-clear planar candidate, but all six
fail the scoped inter-panel screen. The 0-radian / 13-mm diagnostic clears
only **inter-panel** contact; it still has six same-panel intersections.
Independent adversarial review caught an initial research selection fail-open:
this diagnostic was marked `researchScreenClear:true` despite
`staticContactValid:false`. The research gate now requires **both** intra-
and inter-panel static clearance, with a regression that rejects every
contact-invalid pose. **No candidate is selected or auto-applied**; a
separately flagged `splitTopologyPayload` is exposed only for numerical QA,
not as a simulated or approved garment. No tested pose passes full physical
acceptance.

**Independent numerical QA:** new
`scripts/qa-exo-foundation-tee-hinged-body-20261025.mjs` independently
reconstructs all eight posed body coordinate fields from the split rest mesh,
recalculates 102 sewing gaps, verifies area/winding and absence of
hinge-crossing triangles, recomputes body edge metrics and static contact,
checks unchanged sleeves and sewing provenance, and rejects malformed
grids, altered source geometry, sewing or topology. Following a second
independent adversarial review, the option preflight also rejects Proxy-
backed inputs, accessor grids/options and unknown approval keys before
executing any caller traps; the new regression asserts **zero traps**.
New + planar predecessor + disjoint swept-contact predecessor:
**11/11 PASS**, zero failures, approximately **2.47 seconds** combined in
one uncontrolled run. The eight
candidate research evaluation took approximately **0.99 seconds** in an
uncontrolled run, not a native solver benchmark. JavaScript syntax and
Git whitespace checks passed; input/source JSON nonmutation passed.
The independent reviewer then reran the exact former option bypasses against
the final source: unknown `manufacturingApproved`, accessor clearance,
Proxy grid and Proxy options all **rejected**, with **zero traps invoked**;
the focused new suite independently passed **4/4**. The final sequential
expanded suite passed **11/11** in approximately **4.79 seconds**.

**Native preflight:** frozen two-panel grid remains **10/10 complete**.
The existing native executable SHA-256
`8256ccda544abe3cd348fac6e37e7518e3222e39e4442b1da3641a541298279e`
still differs from checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Disk headroom at this run's first check was **1,211,384 KiB (~1.16 GiB)**,
below the **8 GiB native-build floor**. The final read-only free-space check
was **1,296,284 KiB (~1.24 GiB)**. No completed candidate was repeated,
no native trial/build was attempted, and no UI, editable garment, installed
app, branch or unrelated worktree state was changed. No reset, cleanup,
cache deletion, installation, commit or push.

**Next:** repair same-panel foldover/contact, sleeve strain and poor rest
triangles, then reconstruct all mass/structural/bending constraints on the
split body mesh before any coupled body/sleeve optimization. Static contact
screening is not a motion trajectory or continuous deformable CCD certificate;
safe avatar entry and CLO3D parity remain unverified.

## 2026-10-25 15:36 local — detached split-body constraint and contact inventory

**Concrete research-only source/test improvement:** added
`src/core/backends/nativeFoundationTeeHingedBodyConstraintInventory20261025.js`
and independent
`scripts/qa-exo-foundation-tee-hinged-body-constraints-20261025.mjs`.
The module inventories the existing conforming centreline split **without
changing the production solver, user interface, garment or native binary**.
It checks canonical source identity, preserved original particles, unchanged
sewing/anchors/sleeves, generated crossing-edge material interpolation and
copied-particle provenance, positive face winding, individual source-face area
conservation, manifold edge incidence, complete interior centreline hinges,
and positive lumped material-area weights. Face-pair adjacency is inventoried
without creating unsafe collision exclusions.

| Per body panel | Original front | Split front | Original back | Split back |
| --- | ---: | ---: | ---: | ---: |
| Vertices | 155 | **174** | 155 | **181** |
| Triangles | 240 | **278** | 240 | **292** |
| Structural edges | 394 | **451** | 394 | **472** |
| Interior bending hinges | 326 | **383** | 326 | **404** |
| Centreline crease hinges | Not conforming | **20** | Not conforming | **27** |
| Material area (m²) | 0.339835 | **0.339835** | 0.346260 | **0.346260** |

The two body panels require **135 additional structural edges and 135
additional bending hinges** relative to the original topology, including
**47** centreline crease hinges; **45** new particles are material-area
weighted. Face-pair classification covers all **38,503** front and **42,486**
back pairs (front: 383 shared-edge, 1,058 shared-vertex, 37,062 disjoint;
back: 404 shared-edge, 1,119 shared-vertex, 40,963 disjoint). **Zero** contact
exclusions are introduced. All **102** garment sewing correspondences and
**56** constraints touching each body panel remain untouched (the same seam
constraint can touch both body panels). These are geometric inventories, not
calibrated XPBD constraints or verified contact policies.

The previous physical results remain unchanged because **no new pose or
solver step** was run: original four-panel maximum/RMS seam gap
**188.452/117.400 mm**, versus the previously best-RMS 0.4-radian/13-mm
folded pose **142.603/90.191 mm**. Maximum principal extension/compression
remain **751.535%/89.041%** in that pose; it has **312** inter-panel
near-clearance pairs and **6** same-panel intersections. The improved seam
numbers **do not** pass static contact, strain or physical acceptance. The
research inventory does not alter these measurements, prove a safe trajectory,
or establish continuous deformable collision certification.

Focused new independent QA checks material area, every rest-edge length,
every hinge incidence and face-pair classification, sewing preservation,
source/split nonmutation, and adversarial missing/duplicate/reversed/escaped
faces, generated-particle tampering, and sewing/sleeve corruption. Initial
QA exposed an overly strict generated-particle provenance assumption: the
source split copies the oriented clipping-edge start, which can be either
endpoint of its sorted edge identifier. A subsequent independent adversarial
review demonstrated that accepting **either** endpoint is itself fail-open:
it allows a forged generated particle with incorrect world coordinates and
pattern metadata. The final audit independently reconstructs the **first
oriented crossing edge** from the authored face/clip order and requires the
exact source particle clone from that endpoint. The previously accepted
wrong-endpoint adversarial input is now explicitly rejected by regression.
Final combined new + hinged + planar suites **10/10 PASS**, zero failures,
approximately **4.17 s**; JavaScript syntax checks passed. Native checkpoint
remains **10/10 complete** and
binary SHA-256 `8256ccda...` still differs from checkpoint `1f9417e2...`.
The independent reviewer finally reran the exact forged-other-endpoint probe
against the hardened source: **REJECTED**, with focused suite **3/3 PASS**.
Disk fell from **1,166,288 KiB (~1.11 GiB)** to **622,432 KiB (~0.59 GiB)**
on subsequent read-only checks amid concurrent workspace activity, below the
8 GiB native-build floor. No native build/trial, completed-candidate repeat,
cleanup, cache deletion, reset, installation, branch switch, commit or push.

**Next:** independently audit source-face partition overlap/T-junction
coverage and same-panel foldovers, then map *measured* fabric density and
stretch/bending constitutive parameters to the solver with preserved sewing
and collision rules. This inventory is not solver integration, avatar-entry
CCD proof or CLO3D parity.

## 2026-10-25 16:39 local — split-body material partition overlap and T-junction preflight

**Source-level safety improvement:** added research-only
`src/core/backends/nativeBodyMaterialPartitionAudit20261025.js` and integrated
its preflight into `nativeFoundationTeeHingedBodyConstraintInventory20261025.js`.
Per-source-face material area totals alone cannot establish that a mesh covers
the original triangle: equal-area holes and overlapping faces can cancel.
The new gate independently checks all AABB-overlapping split-triangle pairs
using strict separating axes, **regardless of assigned source-face owner**,
and rejects positive-area overlap. It also checks every **used** material
vertex against every nonincident material edge, rejecting geometric
T-junctions even across different source faces. The gate creates
no contact exclusions and does not change the native solver, editable garment,
installed app, or UI.

**Actual four-panel tee:** the generated hinged body passes both checks:
front **1,517** AABB-overlapping face-pair comparisons and **77,572**
nonincident vertex-edge checks; back **1,529** overlap comparisons and
**84,488** vertex-edge checks. No overlap or T-junction was found in these
specific generated rest meshes. The pre-existing body inventory remains
front **174 vertices / 278 faces / 451 structural edges / 383 bending hinges**,
back **181 / 292 / 472 / 404**. Material area and 102 sewing correspondences
remain preserved, and source/split JSON nonmutation checks pass.

New independent regression fixtures include an **exactly area-conserving**
pair of triangles with overlapping material and an equal-area hole (rejected),
a nonoverlapping diagonal-edge T-junction (rejected), and a conforming
shared-edge/vertex control (accepted). Independent adversarial review found
that the first version accepted cross-owner overlap, near-endpoint T-junctions,
and extremely thin overlaps, while falsely rejecting unused vertices on an
edge. The implementation was hardened to check all owners, use strict
separating axes, check active vertices only, and reject coincident distinct
active vertices. Regressions now cover these cases, including a used vertex
at material-edge fraction 5e-11. New + previous constraint inventory,
hinged-body and planar-body suites: **17/17 PASS** in approximately **2.76 s**
of uncontrolled test execution; source syntax and Git whitespace checks pass.
This is a material-topology certificate for these bounded inputs, not static
world-space contact clearance or deformable continuous CCD.

**Native experiment preflight:** the frozen two-panel checkpoint still records
**10/10 completed, zero remaining**. During this run the executable SHA-256
was `c0ac8ff87858b51f658f34cdb4da6dbc950e8f10bbcef8ceca1e486939ddc9a2`,
which **does not match** checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
The executable may be changing concurrently; no trial was launched or
completed candidate repeated. Disk free was **2,279,944 KiB (~2.17 GiB)**,
below the **8 GiB native-build floor**. No native build, app modification,
cache deletion, cleanup, reset, branch change, commit or push was performed.

**Physical acceptance unchanged:** previous original four-panel max/RMS seam
gap **188.452/117.400 mm**; best measured hinged pose **142.603/90.191 mm**;
max principal extension/compression **751.535%/89.041%** in that pose;
**312** inter-panel near-clearance pairs and **6** same-panel intersections.
Both configurations remain contact-invalid and physically rejected. No new
pose or solver timing measurement was produced by this topology preflight.
Next: resolve actual same-panel intersections and sleeve strain while keeping
material partitions conforming; separately calibrate solver bending and
contact. Avatar-entry continuous collision certification and CLO3D parity
remain unverified.

## 2026-10-25 17:41 local — bidirectional shared-edge foldover thickness veto

**Concrete contact safety fix:** updated
`src/core/backends/nativeIntrapanelContactResearch.js` so a shared-edge
near-foldover is evaluated from **both** incident triangle planes. Previously
the static thickness warning depended on face ordering: with a 0.1-mm-high
triangle followed by a 20-mm-high triangle folded back by 0.1 radian, the
broad triangle's opposite vertex is approximately 1.997 mm from the narrow
plane, while the narrow triangle's opposite vertex is approximately 0.00998
mm from the broad plane. At a 1-mm clearance, the first ordering incorrectly
reported `staticDisjointThicknessScreenClear:true`; reversing face order
reported a foldover. The patched gate rejects **both** orders. An opened
hinge and a 0.001-mm warning threshold remain clear in the bounded fixture.
This is a symmetric conservative **static** warning, not a complete adjacent
triangle thickness oracle or continuous deformable CCD.

Added `scripts/qa-exo-intrapanel-foldover-symmetry-20261025.mjs` with an
independent plane-distance oracle, two face-order regressions, an opened-hinge
negative control, a tighter-clearance control, and source-state nonmutation.
Updated the affected exact-count regression in
`scripts/qa-exo-sleeve-crease-quality-contact-20261025.mjs`: on the original
four-panel tee, the improved detector now reports **62** near-foldover pairs
instead of **44**; the detached split-sleeve comparison reports **68** instead
of **50**. These **18 additional warnings** expose previously missed contact
risks; they do **not** represent a newly worsened garment pose. Existing
same-panel intersections remain **6** and static contact remains **invalid**.

The focused plus downstream six-file sequential QA command passed **49/49**
tests, zero failures, approximately **2.25 seconds** of uncontrolled Node test
wall time. JavaScript syntax and Git whitespace checks passed. Original
garment input and test fixtures remained unchanged. A separate independent
review also identified a limitation of the standalone material-partition
API: empty or incomplete disconnected face sets can return its local
nonoverlap flag without proving expected-domain coverage. The hinged-body
integration independently checks source-face containment and area, but the
standalone flag must **not** be interpreted as a complete coverage proof.
Independent read-only review of the new symmetric contact fix passed a
separate **26/26** focused four-script suite and independently reproduced
both folded face orders as one warning/zero intersections, with both opened
orders clear. No new indexing bug was found. The reviewer noted that this
conservative projection-and-plane-distance heuristic may over-warn for
highly unequal triangle sizes; an exact finite-thickness adjacent-hinge
oracle is still needed before interpreting a warning as penetration.

**No new physical pose or native trial:** previously measured original tee
maximum/RMS seam gap **188.452/117.400 mm**, best hinged candidate
**142.603/90.191 mm**; best hinged maximum principal extension/compression
**751.535%/89.041%**; **312** inter-panel near-clearance pairs and **6**
same-panel intersections. All remain physically rejected. The frozen two-panel
checkpoint remains **10/10 complete**, executable SHA-256
`c0ac8ff87858b51f658f34cdb4da6dbc950e8f10bbcef8ceca1e486939ddc9a2`
differs from checkpoint `1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Free disk was approximately **2.11 GiB**, below the 8-GiB native-build floor.
No completed trial repeated, native build, solver installation, app/garment
change, cleanup, cache deletion, reset, branch change, commit or push.

## 2026-10-25 18:41 local — explicit material-domain coverage gate for hinged-body contact topology

**Concrete source/test change:** strengthened the standalone
`nativeBodyMaterialPartitionAudit20261025.js` so local nonoverlap and
T-junction checks cannot be confused with coverage of the original material
domain. Empty face inventories now fail closed. The optional fourth argument
supplies the original source triangles in owner order; the audit then checks
source winding, per-face ownership, barycentric containment of each split
triangle, and **per-source-face** area coverage within declared numerical
error bounded by `max(1e-15 m², 1e-14 × source-face area)`, in addition to
the pre-existing global overlap and T-junction
checks. Without original source triangles, it explicitly returns
`sourceDomainCoverageVerified:false` and `materialPartitionCertified:false`
even when the local mesh is conforming. This is a bounded, tolerance-based
material-domain preflight, **not** world-space contact or continuous CCD.

The hinged-body constraint inventory now supplies the actual authored
front/back source faces to the partition audit and refuses an uncertified
partition. Both actual split body panels pass the stronger gate: front
**240 original faces / 278 split faces**, back **240 / 292**; existing
overlap comparisons **1,517 / 1,529**, vertex-edge checks
**77,572 / 84,488**, zero positive-area overlaps and zero T-junctions.
All **102** sewing correspondences remain unchanged; no contact exclusions
or solver constraints were created. Independent regression cases reject
an omitted source face, a missing split face, out-of-range and forged owner
labels, reversed source winding, a resolvable **1e-10 m² missing sliver**
and empty split inventories. Full valid
source-domain controls pass; source and split state remain unmodified.

**Bounded QA:** four relevant suites passed **20/20**, zero failures,
approximately **2.62 s** Node test wall time in this environment; syntax
checks passed. A separate read-only independent reviewer passed **23/23**
adversarial direct-helper probes (13 + 6 + 4) with source-state nonmutation,
including missing areas of **1e-10 and 1e-12 m²**. The reviewer confirmed an
important scope limitation: a caller can supply a consistently truncated
source domain and split faces and receive a certificate **relative to that
truncated domain**. This helper does not independently authenticate the
source domain; the Foundation Tee integration separately compares its source
against a freshly constructed canonical fixture before supplying the authored
source triangles. Material coordinates are treated as 2D (first two axes).
No new garment pose or native solver experiment was run.
Previously measured original four-panel seam maximum/RMS remains
**188.452/117.400 mm**; previous best hinged candidate **142.603/90.191 mm**,
principal extension/compression **751.535%/89.041%**, **312** inter-panel
near-clearance pairs and **6** same-panel intersections. Static contact and
physical acceptance remain **failed**; these numbers are historical
measurements, not changed by the domain gate. Research-only test runtime is
not production-solver runtime. Original/split JSON nonmutation checks pass.

The frozen **two-panel** native checkpoint is **10/10 complete**. Current
executable SHA-256 `ce42fb557bf2821f0f0199dc73f86b15293c9b5d662c9b8e7f90e52183d4b6c6`
differs from checkpoint `1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
No candidate was repeated. Available disk was approximately **1.8 GiB**,
below the **8 GiB** native-build floor. No native build, installed-app/UI or
saved-garment change, cache deletion, reset, branch switch, commit or push.

**Next:** use the now source-domain-checked rest mesh to localize and remove
the **six actual same-panel world-space intersections**, then jointly gate
underarm seam maxima/RMS, sleeve principal strain, bending energy, and
static/swept contact. Material-domain coverage does not resolve the remaining
**751.535%** extension or establish avatar-entry safety, calibrated solver
integration, continuous deformable CCD or CLO3D parity.

## 2026-10-25 19:36 local — complete same-panel contact witness inventory and strict-crossing classification

**Concrete source-level change:** `nativeIntrapanelContactResearch.js` now
supports a bounded `maxIntersectionWitnesses` option (0–256; default 5),
reports whether the retained inventory is complete, provides per-piece
intersection counts and records material adjacency for each witness. This
fixes the earlier diagnostic blind spot where six warnings existed but only
five face pairs could be inspected. The contact gate and its conservative
zero-distance rejection are **unchanged**. Added detached
`nativeFoundationTeeSelfContactWitnessResearch20261025.js`, which rechecks
the reported face pairs using an independent strict interior segment/triangle
crossing test, exact triangle distance and coincident-but-material-distinct
vertex/sewing correspondence checks. It never exempts contacts, modifies the
editable garment or claims collision certification.

**Actual authored four-panel Foundation Tee:** all six warnings already exist
in the original unsplit garment, before body hinging. Three belong to each
mirrored sleeve: face pairs **(37,58), (37,64), (37,117)** on both left and
right. There are **zero shared material indices** per pair, but each pair
contains coincident world-space sleeve vertices **4 and 7**, separated by
**345 mm in material coordinates** and connected by an actual authored
underarm seam constraint. The closest triangle distances are approximately
zero; the independent strict interior crossing test finds **0/6 proven
transverse piercings**. This is important diagnostic evidence that the six
SAT intersection warnings may include sewing-boundary touching, **not proof
that all six are physically penetrating**. Conversely, absence of a strict
transverse witness does not clear tangency, coplanar overlap, finite cloth
thickness or continuous motion. **All six warnings retain the contact veto.**
The best hinged-body pose leaves the sleeve positions unchanged and therefore
retains the same six warnings; changing body hinges alone cannot repair them.

**Physical comparison (historical poses, no new solver pose):** original
maximum/RMS seam gap **188.452/117.400 mm**; prior best hinged pose
**142.603/90.191 mm**; peak principal extension/compression
**751.535%/89.041%** in that pose, with **312** inter-panel near-clearance
pairs. Static contact and physical acceptance remain **failed**. This new
classification improves the diagnostic evidence only, not fabric strain,
sewing residuals or contact clearance. Native runtime was not benchmarked.

**QA:** `scripts/qa-exo-foundation-tee-self-contact-witness-20261025.mjs`
independently verifies all six face IDs, the actual underarm sewing endpoint
mapping, strict transverse piercing positive control, coplanar-overlap
negative control, bounded evidence truncation, unchanged sleeve coordinates
under body folding and JSON source nonmutation. Existing hinge and
shared-edge contact suites remain in the regression set. No solver, UI,
installed app, source garment, constraint exclusions or saved state was
modified. The frozen two-panel checkpoint remains **10/10 complete** and
its expected binary hash `1f9417e2...` differs from current
`ce42fb55...`; no completed trial repeated and no native build was run.

**Final QA and independent adversarial correction:** five focused suites
passed **29/29** tests in approximately **2.83 seconds** of uncontrolled
Node test wall time, with syntax and scoped whitespace checks passing.
An independent read-only reviewer reproduced the six original sleeve
contacts, tested strict crossings, tangency, coplanar overlap, near-parallel
clearance and source nonmutation, and stress-tested **130** and **257**
independent synthetic piercing pairs. The reviewer identified an ambiguity
when a 256-witness cap left one uninspected pair incorrectly grouped with
sampled unresolved warnings. The diagnostic now reports these **separately**:
the 257-pair regression verifies **256 proven sampled piercings, zero sampled
unresolved pairs, one uninspected pair**, with evidence completeness false
and the contact veto retained. Final disk was approximately **2.46 GiB**
available, below the separate 8 GiB native-build floor. No production-solver
runtime was measured; source nonmutation passed. One additional standalone
actual-tee witness audit took **83.585 ms** (uncontrolled, excluding fixture
construction), returned six complete warnings and zero strict piercings,
and independently confirmed unchanged JSON source state.
Two additional established intrapanel/static-path suites passed **20/20**
in approximately **0.53 seconds**, yielding **49/49 total focused tests**
across seven suites, zero failures. These are separate bounded test runs,
not production performance measurements.

**Next:** distinguish sewn-boundary point touching from non-sewn thickness
violations with a finite-thickness, topology-aware oracle, without removing
the existing conservative veto. Separately repair the severe sleeve rest/pose
strain and seek a coupled trajectory improving both max and RMS seam gaps
with no per-group regression or unresolved inter-panel contact. Neither
avatar-entry CCD, physical fit, calibrated solver integration nor CLO3D
parity is established.

## 2026-10-25 20:41 local — material-tip-excised sewn contact locality audit (research only)

**New source and regression:**
`src/core/backends/nativeSewnEndpointThicknessLocalityResearch20261025.js`
and `scripts/qa-exo-sewn-endpoint-thickness-locality-20261025.mjs`.
The detached, bounded static diagnostic first obtains the complete
same-panel contact witness inventory, requires a unique **direct authored
sewing correspondence** at a world-coincident pair of material-distinct
vertices, and refuses to reclassify proven strict transverse piercings.
For each eligible witness it removes a declared length from **both material
edges incident to the sewn corner** on each triangle, retaining the exact
remaining quadrilateral as two triangles. Four independent triangle-distance
evaluations measure the separation of those retained portions. This is a
material-edge-length tip trim, **not a circular material-space exclusion**.
The omitted neighborhood remains wholly unverified; the supplied authored
seam inventory is not independently authenticated by this helper.

**New measured locality evidence on the original four-panel Foundation Tee:**
all six static same-panel intersection warnings remain, with three per sleeve
at face pairs (37,58), (37,64), (37,117). At a **5 mm material-edge tip
excision** and **1 mm clearance**:

| Face pair, identical on both sleeves | Retained-portion separation | Scoped result |
| --- | ---: | --- |
| (37,58) | **0.880969 mm** | **Below 1 mm; remains a non-sewn-neighborhood thickness blocker** |
| (37,64) | **5.100614 mm** | Retained portions clear only; excised neighborhood unresolved |
| (37,117) | **5.561362 mm** | Retained portions clear only; excised neighborhood unresolved |

Thus **2/6** contacts remain sub-thickness *even after* a 5 mm tip
excision, and **4/6** have scoped separation outside that excision. At
**1 mm excision**, the (37,58) separation is **0.176194 mm**; at
**10 mm excision**, it is **1.761937 mm** and all six retained portions
exceed 1 mm. Increasing the excluded region does **not** make the
unexamined material safe. Original contact veto and physical rejection
remain unchanged for every radius. This localizes a finite-thickness
blocker to the sewn underarm neighborhood without inventing a sewn-contact
exemption or claiming a true collision-free fabric thickness model.
The narrow (37,58) threshold is bracketed by a **5.675 mm** edge trim
(**0.999899 mm** separation, still below clearance) and **5.700 mm**
(**1.004304 mm**, retained portion above clearance); this is a scoped
locality threshold, **not** a safe material-removal instruction.

**Physical metrics unchanged; no new pose or native trial:** original
Foundation Tee max/RMS sewing gap **188.452/117.400 mm**; previously
rejected best hinged-body pose **142.603/90.191 mm**. Its maximum principal
extension/compression remain **751.535%/89.041%**, with **312** inter-panel
near-clearance warnings and **6** same-panel intersections. Both poses fail
static contact and physical acceptance. No solver runtime was measured;
the four 1/3/5/10 mm locality observations each took approximately
**69–107 ms** in uncontrolled JavaScript runs, excluding fixture
construction. Source JSON nonmutation checks passed.

**Focused QA:** four Node suites including new sewn-tip locality,
existing full witness classification, original static intrapanel contact
and shared-edge symmetry returned **32/32 PASS**, zero failures,
approximately **1.70 seconds** sequential test-runner wall time. New
negative controls cover direct seam omission, malformed/duplicate seam
IDs, strict transverse piercing, positive-area coplanar overlap, excision
larger than a material edge and invalid work/clearance/excision budgets.
An independent read-only reviewer initially passed **8/8** new focused
tests and independently reproduced the actual 5 mm **4 clear / 2 persistent**
inventory. They found a concrete provenance-quality gap: a fabricated
direct seam constraint without a `seamId` was counted as sewing evidence
(`[undefined]`), although it never waived the contact veto. The new
helper now requires nonblank, unique string seam IDs; the exact malformed
and duplicated cases are covered by a new regression. This still does
**not** authenticate a valid-looking forged seam against the canonical
garment. **Independent post-fix read-only retest PASS:** the original
missing-`seamId` exploit now yields **zero tested / zero clear** witnesses,
blank IDs also fail closed, and a valid-looking forged seam remains explicitly
unauthenticated and physically rejected. The reviewer independently ran the
expanded new suite **9/9 PASS** (about **0.50 seconds**). Syntax and scoped
whitespace checks passed. This remains a
detached, research-only evidence gate.

**Native preflight:** two-panel checkpoint **10/10 complete**, no remaining
candidates. Current existing `research/oss/clothcraft/target/debug/exo-session`
SHA-256 is `c6941b0a904f80fa34f987534b0d2401c6c42922a69ffa05d8711847eb085fc0`,
which **does not match** checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Free disk was approximately **2.21 GiB** at final inspection, below the
8 GiB native-build floor. No completed candidate was repeated; no native
experiment or build, solver install, UI/app/garment edit, cache cleanup,
disk reclamation, branch reset, commit or GitHub push occurred.

**Next:** resolve the underarm (37,58) retained-portion sub-thickness
contact and the omitted sewn neighborhood through material-valid sleeve
topology and a true finite-thickness contact model. Jointly reduce
underarm seam max/RMS and sleeve principal strain with no unresolved
intra/inter-panel contact. This audit does not certify adjacent-hinge
thickness, deformable swept CCD, safe avatar entry, calibrated solver
integration or CLO3D parity.

## 2026-10-25 21:33 local — canonical Foundation Tee sewing/material identity preflight

**New bounded source-level research guard:**
`src/core/backends/nativeCanonicalTeeSewnContactProvenanceResearch20261025.js`
and adversarial regression
`scripts/qa-exo-canonical-tee-sewn-contact-provenance-20261025.mjs`.
The previous static sewn-tip locality helper explicitly trusted the supplied
seam inventory, so a forged but syntactically valid underarm seam could be
described as sewing evidence. The new opt-in Foundation Tee-specific wrapper
regenerates a separate reference from `createTemplateProject('tee')` and
`buildNativeSimulationPayload(...,{quality:'quality'})` instead of deriving
the expected inventory from the candidate. It requires **exact original
material vertex coordinates, face topology/winding, global particle mapping,
piece ownership, and all 102 authored direct seam ID/endpoint identities**.
Reversed endpoint order is allowed; extra, missing, duplicated, relabeled or
endpoint-swapped seams and altered source material are rejected. It allows
world-space particle motion for future pose experiments, without implying
that any changed pose has valid strain, contact or a safe path. This wrapper
does **not** apply to remeshed sleeve/body candidate topologies.

**Independent adversarial correction:** the first version bound material
mesh and seam endpoint identity but still accepted forged seam rest/stiffness,
fabric identity/law, particle thickness, collision exclusions and a modified
structural constraint. A read-only reviewer independently reproduced six
accepted adversarial changes. The wrapper was strengthened to bind **all
original static project and solver metadata, piece fabric metadata, particle
static parameters, and the full 2,470-constraint structural/bend/finish/sewing
inventory including rest lengths and stiffness**, while allowing world-space
particle positions and previous positions to differ. A dedicated regression
now rejects ten related parameter/tamper modes. The source-code-derived
reference remains unsigned and the static locality checker still does not
authenticate dynamic velocities or certify fabric physics.

**Actual original tee diagnostic after identity preflight:** the same six
same-panel contact warnings remain, with **four** retained portions clear
outside 5 mm material-tip excisions and **two** (both sleeve faces 37/58)
remaining below 1 mm separation. The preflight does not change geometry,
the existing contact veto or the unverified excised regions. A reference
regenerated from source code is **not independently signed/authenticated**;
the output explicitly retains `authoredSewingProvenanceAuthenticated:false`,
`physicalAcceptance:false`, and `safeToAutoApply:false`.

**Physical metrics unchanged, no new solver pose:** original four-panel tee
maximum/RMS sewn gap **188.452/117.400 mm** and previously rejected hinged
candidate **142.603/90.191 mm**. The hinged candidate still has maximum
principal extension/compression **751.535%/89.041%**, **312** inter-panel
near-clearance warnings and **6** same-panel intersection warnings. Neither
pose passes contact or physical acceptance. This work strengthens provenance
of a static locality diagnostic; it does not improve sewing, strain, bending
or contact clearance and does not benchmark native solver runtime.

**Final prime QA:** four focused Node suites **29/29 PASS**, zero failures,
approximately **4.87 seconds** combined in the final uncontrolled run.
Ten new cases cover original
fixture, world-space rigid translation, forged valid-looking seam endpoint,
extra direct sewing, missing/duplicate/relabel/reversed seam, altered material
and topology, altered solver/fabric physics, invalid source structure and
source JSON nonmutation. Three uncontrolled final wrapper calls took
**404.297, 325.949, 404.217 ms**, including
canonical fixture reconstruction and locality analysis. Source nonmutation
passed. The initial independent review exposed the physics-provenance bypass
above. **Independent post-fix read-only retest PASS:** the exact six original
accepted forgeries now all reject, without mutating source JSON; the focused
new provenance suite passed **8/8**, and the canonical contact-positive
control still retained the contact veto and `physicalAcceptance:false`.

**Additional independent TOCTOU finding and fix:** a malicious options
`clearanceM` getter could mutate seam stiffness/rest *after* the initial
canonical preflight, then pass the underlying diagnostic's own snapshot and
misreport `sourceNonmutationVerified:true`. The wrapper now snapshots only
three explicitly allowed **own data-property** options *before* preflight,
rejects accessors and unexpected fields, and independently revalidates
canonical identity after the locality audit. A hostile Proxy descriptor trap
can mutate its caller's source before validation, but cannot obtain an
authenticated result for that altered source. Both exact accessor and Proxy
negative controls are covered by the final 29-test suite. No untrusted
options object reaches the underlying contact diagnostic.
**Independent final exact getter replay PASS:** the original malicious
`clearanceM` getter was rejected with `Invalid canonical sewn-tip options`,
executed **zero times**, left the original seam rest length **0.008 m**
unchanged and preserved byte-equivalent JSON input. This is a focused
adversarial regression, not a general proof against every hostile JavaScript
object or a physical contact certification.

**Native preflight:** checkpoint contains **10/10** completed two-panel
candidates, current existing executable SHA-256
`c6941b0a904f80fa34f987534b0d2401c6c42922a69ffa05d8711847eb085fc0`
differs from expected
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Free disk at this run was approximately **2.17 GiB**, below the **8 GiB**
native-build floor. Zero native experiments/builds or repeated candidates;
no cleanup, reset, install, app/UI/editable-garment change, branch change,
commit or GitHub push. Remaining physical blockers: underarm finite-thickness
contact, excessive sleeve strain, unclosed seams and full coupled
strain/contact-valid motion. Continuous deformable CCD, avatar entry,
calibrated solver integration and CLO3D parity are unverified.

## 2026-10-25 22:39 local — bounded canonical underarm contact/seam sensitivity

**New detached research-only source and QA:**
`src/core/backends/nativeCanonicalTeeUnderarmSensitivityResearch20261025.js`
and `scripts/qa-exo-canonical-tee-underarm-sensitivity-20261025.mjs`.
The experiment regenerates the original four-panel Foundation Tee and first
authenticates the candidate's static sewing/material/solver identity against
the independent code-derived canonical reference. It additionally requires
the **original canonical particle positions AND previous positions**, rather
than accepting an arbitrarily altered starting pose. For each sleeve's known
face **37/58** underarm contact, it perturbs each of the two other face-58
vertices by **+/-0.5 mm along the opposing face-37 normal**: exactly eight
detached trials, no native solver call, no saved garment modification. Some
of these neighboring vertices participate in an **underarm sewing group**;
this is an intentionally *diagnostic* seam/contact tradeoff, not an admissible
sewing-preserving cloth bend. Each trial recomputes all 102 sewn gaps and
per-group regressions, principal strain, complete static same/inter-panel
contact, the canonical finite-tip locality audit, pins and rest conditioning.

| Actual original four-panel metric | Canonical starting pose | Best retained-distance perturbation |
| --- | ---: | ---: |
| Maximum seam gap | 188.452062 mm | **188.452062 mm** |
| RMS seam gap | 117.400268 mm | **117.400292 mm** |
| Maximum principal extension | 7933.803349% | **7933.803349%** |
| Maximum principal compression | 89.040793% | **89.040793%** |
| Face 37/58 separation outside 5 mm tip excision | **0.880969 mm** | **0.885377 mm** |
| Same-panel intersections / near-clearance pairs | 6 / 231 | **6 / 231** |
| Same-panel near-foldover warnings | 62 | **62** |
| Inter-panel near-clearance pairs | 122 | **122** |
| Static contact / physical acceptance | Failed / rejected | **Failed / rejected** |

The maximum scoped separation gain is only **0.004408 mm** from a **0.5 mm**
single-vertex displacement; the retained portion still violates the **1 mm**
clearance requirement. The best trial (`sleeve-left:64:-1`, with mirrored
right-sleeve equivalent) moves a vertex belonging to the authored underarm
sewing group and increases overall RMS sewing error by approximately
**0.000024 mm**; a group regresses. Displacing local vertex 65, which has
no direct sewing constraint, has **zero measured effect** on the target
retained separation at this step. All eight trials retain six same-panel
intersection warnings, two persistent sewn-tip warnings, invalid strain and
static contact. No trial is promoted. These are local finite-difference
diagnostics, **not** a gradient for a calibrated cloth constitutive model.

**Prime focused QA:** four sequential Node suites **32/32 PASS**, zero
failures, approximately **2.92 s** runner wall time in an uncontrolled run.
The new suite independently reconstructs the best perturbed particle and
remeasures exact locality, raw 102-pair sewing residuals, principal strain
and both static contact oracles. Adversarial cases reject altered initial
position/previous state, forged sewing rest law, changed material winding
and changed thickness. Source JSON nonmutation, JavaScript syntax and scoped
whitespace checks passed. The complete eight-trial research evaluation took
approximately **1.87–2.20 s** in uncontrolled observations, **not** a native
solver benchmark.

**Independent read-only QA returned PASS:** 24/24 focused tests across the
new sensitivity (5), canonical provenance (10) and sewn locality (9) suites.
Eight independent adversarial controls rejected seven invalid payload
mutations; the eighth, reversal of a sewn pair's endpoint ordering, is
intentionally allowed by the documented unordered sewing identity contract.
No concrete acceptance bypass was found. The reviewer confirmed all eight
trials remain contact/strain rejected, the 0.004408 mm scoped distance gain
comes with an RMS seam regression, and the source payload remains unchanged.

**Preflight:** frozen two-panel checkpoint remains **10/10 complete** with
zero candidates remaining. Existing executable SHA-256
`c6941b0a904f80fa34f987534b0d2401c6c42922a69ffa05d8711847eb085fc0`
does not match frozen
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Disk was approximately **1.59 GiB** free, below the 8 GiB native-build floor.
No completed native candidate was repeated. No native trial/build, cleanup,
reset, installation, UI/app/editable-garment change, branch change, commit or
GitHub push occurred.

**Next:** investigate **coupled multi-vertex, sewn-pair-preserving underarm
bending**, rather than independent normal offsets. Any proposed pose must
reduce both maximum and RMS sewn gaps without regressing individual sewing
groups, satisfy independently checked principal strain and static contact,
and eventually pass a calibrated deformable solver and continuous collision
checks. Finite-thickness safety of the excised sewn tip, avatar entry,
continuous deformable CCD and CLO3D parity remain unverified.

## 2026-10-26 04:47 local — sampled per-sewing-group excursion admission

**Bounded source-level improvement, no new solver pose:** the detached
simultaneous hinge/translation study now reports all **14 named sewing groups**
at each of the three sampled states and for the independently regenerated
original Foundation Tee. The research admission gate rejects any sample whose
named group's maximum or RMS sewing gap exceeds its original group baseline,
even when **both global gap measurements improve**. This specifically closes
an underarm sewing-regression blind spot in the existing aggregate-only gate.

The gate also checks group identity, correspondence counts totaling **102**,
nonnegative finite measurements, per-group RMS bounds, and recomputes each
reported global maximum and weighted RMS from its groups. It fails closed on
missing, sparse, duplicate, renamed, count-inconsistent or numerically
contradictory group evidence. These checks apply only to three sampled states;
they do **not** certify the unsampled intervals or physically calibrate a
deformable solver. Source payloads and the editable garment are not modified.

**Actual four-panel seam diagnosis:** original maximum/RMS gaps remain
**188.452062/117.400268 mm**. Original right-underarm group (five sewing
correspondences) has maximum/RMS **29.791130/18.284905 mm**; the existing
fold-and-translate research path instead reports that group's sampled
maximum/RMS as **345.000000/332.617460 mm** at t=0,
**344.568840/332.201775 mm** at t=0.5, and
**343.276437/330.955759 mm** at t=1. Its terminal global maximum/RMS are
**343.276437/144.605395 mm**. Maximum principal extension/compression remain
**7933.803349%/89.040793%**. Terminal static contact still fails with
**3 same-panel intersections and 64 inter-panel near-clearance pairs**;
simultaneous swept disjoint contact also fails. All candidate poses remain
rejected. The new group evidence identifies a concrete seam to protect during
future *coupled*, sewing-aware underarm deformation; it does not improve it.

**QA:** the updated admission suite, simultaneous-motion suite and staged
admission suite passed **18/18 Node tests**, with an approximately **4.65 s**
uncontrolled combined runner duration. The real-case admission computation
took approximately **3.94 s**, including detached fixture construction and
contact research, not native solver execution. Independent numeric checks
recomputed original and terminal named-group residuals from the real native
payload. Adversarial synthetic tests covered a hidden per-group regression
with globally improved gaps, altered group identities, missing group samples,
pair-count inconsistencies and inconsistent aggregate metrics. JavaScript
syntax and scoped whitespace checks passed.

**Independent reviewer finding and correction:** the reviewer identified a
producer/ranker inconsistency: the producer's `researchScreenPass` originally
checked terminal aggregate sewing merit, whereas the new ranker rejected
intermediate global and per-group excursions. The producer now computes
`sampledSeamGapNonworse` and `sampledSeamGroupsNonworse` directly from all
three poses and includes both in its research pass; the ranker recomputes
these decisions and rejects contradictory flags. The independent midpoint
oracle additionally recomputes every named group from the detached pose.
These are evidence consistency checks, not collision or fit certification.
**Independent post-fix read-only retest PASS:** the reviewer confirmed
producer/ranker parity for all three sampled states, original named-group
identity and counts, and fail-closed contradictory flags. The independent
focused admission suite completed **12/12 PASS**, zero failures, in an
approximately **4.11 s** uncontrolled run; no further defect was found in
the reviewed scope.

**Native/storage preflight:** frozen two-panel checkpoint is **10/10 complete**,
with zero untested candidates. Existing binary SHA-256
`c6941b0a904f80fa34f987534b0d2401c6c42922a69ffa05d8711847eb085fc0`
does not match the checkpoint's
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Available disk was approximately **0.35 GiB**, below the 1 GiB native-trial
floor and 8 GiB native-build floor. **Zero** native trials, builds, completed
candidate repeats, cache deletions, resets, installations, branch changes,
commits or pushes. Installed app, UI, editable garment and unrelated worktree
changes remain untouched. Continuous deformable CCD, safe avatar entry,
calibrated coupled bending/contact and CLO3D parity remain unverified.
At final preflight, free disk had decreased to approximately **0.30 GiB**;
no space was reclaimed or other projects modified.

## 2026-10-26 05:44 local — differentiable coupled seam/bend/contact merit prototype

**New detached, research-only source and independent numerical QA:**
`src/core/backends/nativeCoupledSeamBendContactMeritResearch20261026.js`
and `scripts/qa-exo-coupled-seam-bend-contact-merit-20261026.mjs`.
The bounded pure evaluator combines seam-pair closure, rest-length bending-edge
regularization and point-pair finite-clearance penalties on shared 3D vertices.
It reports analytic gradients, separate energies, seam max/RMS, bend error and
contact margin without mutating the input. This is a **point-pair surrogate**:
it does not compute cloth dihedral bending, triangle-triangle thickness,
deformable CCD, solver calibration, or a new Foundation Tee pose. Physical
acceptance and automatic application remain unconditionally false.

**Independent QA: 5/5 PASS**, approximately **68 ms** Node test runner wall
time. Central finite differences independently agree with all analytic
coordinate derivatives to 1e-7; a detached gradient step reduces the combined
merit; source JSON is unchanged; coincident penetrating contacts and malformed
inputs fail closed. An exact two-point analytic control establishes a critical
limitation: with seam weight 2, contact weight 4 and 3 mm clearance, the
stationary energy minimum occurs at 2 mm separation, leaving a **1 mm contact
violation despite zero gradient**. Therefore soft contact penalties alone
cannot certify clearance; future optimization requires hard contact admission.

**No new physical results:** original four-panel maximum/RMS sewing gaps remain
**188.452062/117.400268 mm**, existing prescribed folded/translated candidate
**343.276437/144.605395 mm** (worse); full-tee principal extension/compression
**7933.803349%/89.040793%**; candidate static contact **3** same-panel
intersections and **64** inter-panel near-clearance warnings, plus failing
simultaneous swept contact. The 10/10 frozen two-panel native grid is complete,
the last verified executable hash differs from its checkpoint, and available
disk was only **~0.18 GiB**. No native batch, native build, completed-candidate
repeat, cleanup, installation, UI/editable-garment change, reset, commit or push.
Next: derive an authenticated triangle-based contact barrier and calibrated
dihedral bending gradient before attempting a coupled constrained step; the
existing garment remains rejected and CLO3D/avatar-entry parity unverified.

## 2026-10-26 06:40 local — detached hard triangle-clearance descent prototype

**New source/test:**
`src/core/backends/nativeCoupledTriangleClearanceStepResearch20261026.js` and
`scripts/qa-exo-coupled-triangle-clearance-step-20261026.mjs`.
The bounded backtracking research step descends the existing differentiable
seam/bending-edge merit only when **every disjoint pair among all supplied
triangles** remains above an exact static triangle-to-triangle clearance.
It reuses `measureNativeTriangleDistanceM`, including transverse face-piercing
handling. It additionally requires reduced total energy, nonworsening maximum
and RMS seam gaps, and valid point-pair clearance. The input is never edited;
the candidate is a detached array, never saved or auto-applied. Invalid
initial static clearance blocks rather than authorizing a move out of contact.

**Focused QA:** 13/13 combined Node tests PASS in approximately
87 ms uncontrolled runtime, covering analytic merit regression, static
triangle clearance, backtracking past an unsafe first step, transverse face
piercing, all-pair enumeration, bounded per-vertex motion,
malformed/sparse topology, and input
nonmutation. JavaScript syntax PASS. A synthetic pair of parallel triangles
demonstrates seam maximum/RMS 3.0/3.0 -> 2.4/2.4 mm, combined merit
4.5 -> 2.88 and exact static triangle separation 3.0 -> 2.4 mm while
preserving the scoped 1 mm clearance. This is **not** a Foundation Tee pose or a
native solver benchmark.

**Independent review and correction:** a separate read-only reviewer passed
the initial 6/6 focused tests and adversarially verified baseline separation,
transverse piercing, sparse outer arrays, malformed coordinates and seams,
frozen-source nonmutation, and rejection of degenerate faces. The reviewer
identified one bounded backtracking defect: a trial-specific coincident
positive-rest bending edge could throw before smaller step sizes were tried.
The implementation now catches only that precise unresolved-coincidence
RangeError and continues backtracking, while propagating unexpected errors;
the exact 8-vertex regression passes. This is numerical robustness, not a
new physical feasibility result.
**Independent post-fix read-only retest PASS:** the exact new backtracking
regression passed 1/1; a separately replayed eight-vertex case accepted only
the smaller 0.1 step with unchanged input, and two unrelated malformed-edge
errors still propagated rather than being swallowed.

**Explicit limitations:** only supplied triangle inventory is screened;
adjacent material faces sharing vertices are excluded. There is no authenticated
four-panel mesh inventory, calibrated sewn-neighbor contact exclusions,
dihedral bending energy, principal-strain check,
intermediate-path clearance, deformable CCD, avatar contact, or physical
acceptance. The full tee remains rejected: original maximum/RMS sewing gaps
188.452062/117.400268 mm versus existing folded/translated candidate
343.276437/144.605395 mm, maximum principal extension/compression
7933.803349%/89.040793%, and terminal candidate contact warnings of
3 same-panel intersections plus 64 inter-panel near-clearance pairs.

**Preflight:** frozen two-panel checkpoint remains 10/10 complete, no new
candidate to run. Current executable SHA-256
`c6941b0a904f80fa34f987534b0d2401c6c42922a69ffa05d8711847eb085fc0`
differs from checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
Disk was approximately 0.16 GiB free, below the 1 GiB experiment floor and
8 GiB native-build floor. No native trials/builds, repeat candidates, cache
deletions, resets, installations, commits, pushes, UI or garment changes.

## 2026-10-26 07:35 local — conservative straight-path triangle-clearance bound

**Source-level research improvement:** `nativeCoupledTriangleClearanceStepResearch20261026.js`
now screens each backtracking candidate along the **linear vertex interpolation**
from source to candidate, not just its endpoint. For every disjoint triangle
pair it measures static separation at five evenly spaced poses and subtracts
one-eighth of the sum of the two faces' maximum vertex travel. This is a
conservative Lipschitz lower bound for this particular straight vertex path;
a narrow crossing between sample fractions cannot pass just because the
samples are clear. A degenerate sampled face rejects that trial, allowing
smaller backtracking steps. This is NOT general deformable CCD, an adjacent-face
contact certificate, a strain check or an auto-apply mechanism.

**Reproduced pre-fix bypass:** a detached moving triangle traveled from
z=+3 mm to z=-3.6 mm across a stationary z=0 triangle; the endpoint-only gate
accepted its improved sewing gap despite a mid-path intersection. A second
case moved from z=+3 mm to z=-21 mm and intersected at t=1/8, strictly
between sample fractions, while all five sampled separations were at least
3 mm. Both now fail the conservative path bound. A small, path-clear
seam-improving control remains accepted with a lower bound above 1 mm.

**Focused QA:** 15/15 combined Node tests PASS, zero failures, approximately
130 ms uncontrolled runner wall time; JavaScript syntax and whitespace checks
PASS. Controls cover both crossing cases, feasible backtracking, transverse
piercing, all disjoint pairs, displacement cap, and input nonmutation.

**Physical comparison unchanged:** no new four-panel Foundation Tee pose.
Original maximum/RMS seam gaps remain 188.452062/117.400268 mm versus
343.276437/144.605395 mm for the rejected coupled candidate. Principal
extension/compression remain 7933.803349%/89.040793%. The candidate retains
3 same-panel intersection and 64 inter-panel near-clearance warnings; contact
validity and physical acceptance FAIL. The completed 10/10 two-panel grid
was not repeated; current binary SHA-256 c6941b0a... still differs from
checkpoint 1f9417e2.... Available disk was about 0.11–0.19 GiB, below the
1 GiB experiment and 8 GiB native-build floors. No native trials/builds,
cleanup, reset, installation, commits, pushes, UI or garment modifications.

**Independent read-only QA:** separate reviewer passed 10/10 focused tests,
confirmed both crossing regressions, and checked 180 adversarial seam targets
using a dense 10,001-time-sample oracle on all 30 admitted controls: zero
observed false accepts (150 candidates rejected). Four additional accepted
noncrossing controls had independently sampled minimum separations of
1.6, 3, 3 and 3 mm, respectively, each exceeding the reported conservative
bound. No source edits by reviewer. The geometric Lipschitz reasoning was
independently checked, but both implementations share the same static
triangle-distance primitive. Conservative false rejections remain possible;
this does not establish deformable continuous-collision certification.
