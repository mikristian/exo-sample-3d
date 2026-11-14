# EXO ClothCraft V2 — constrained seam candidate screening

**Verified 2026-10-22, 03:38–03:43 EDT.** Experimental source-only iteration on branch
`feature/studio-v2-clo-visuals`. No installed-app changes, UI changes, user
garment edits, native build, save, remote push, or data deletion.

## Input and decision

The existing `docs/qa/clothcraft-tee-loop-20261022.json` records **10/10**
completed two-panel native `tshirt` parameter trials; the native executable
SHA-256 matches the checkpoint
`1f9417e2a0f7f1f124ef094e534d54ba699b7e4b3268055e5d33fe8f201ceb9c`.
No trial was repeated. Best **two-panel** max/RMS seam gaps remain
229.887806/146.608634 mm at 5% max principal extension. Zero dynamic
nonrigid blocks were accepted in that configuration. This does **not**
measure EXO's actual four-panel shirt.

The Mac had approximately **757–763 MiB** available. Because this is below
the 1 GiB lightweight experiment threshold and far below the 8 GiB build
threshold, no native simulation, Rust build, disk-heavy save, or offload
was attempted.

## New independent candidate gate

Added `src/core/backends/nativeSeamCandidateGate.js` and attached its
`candidateGate` result to the existing *research-only*
`src/core/backends/seamAssembly.js` preview metadata.

The candidate screen independently measures **maximum and RMS seam gap**,
including barycentric virtual seams. It requires a Pareto improvement in
both metrics, verifies all rest-UV triangles and sewing correspondences
are unchanged, checks **full principal stretch and compression**, enforces
immovable pins, and rejects unverified or penetrating endpoint contact
samples. It never claims avatar-entry safety, swept triangle CCD, fitting
approval, or permission to auto-apply a candidate.

The new test `scripts/qa-exo-seam-candidate-gate-20261022.mjs` includes a
synthetic **rigid 60-degree hinge**: seam max gap drops from 200 mm to
100 mm without fabric stretch or pinned movement. This is a feasible
*geometric candidate*, not an avatar-entry or collision-safe fitting.
Negative controls reject triangle collapse, sampled body penetration,
missing contact evidence, moved pins, worsening RMS and invalid virtual
seam barycentric weights.

The real **four-panel EXO Foundation Tee** remains correctly rejected:

| Independent metric | Value |
| --- | ---: |
| Sewing pairs | 102 |
| Initial maximum gap | 188.45 mm |
| Staged maximum gap | 1.44 mm |
| Initial seam RMS | 117.400268 mm |
| Staged seam RMS | 0.537037 mm |
| Maximum principal triangle extension | 3,112.05% |
| Extension-violating triangles (>5%) | 390 of 768 |
| Penetrating sampled avatar points | 977 |
| Candidate research screen | **FAIL** |
| Live fit or swept CCD certified | **NO** |

The excellent seam closure is a **false physical win**. No solver candidate
has yet satisfied the simultaneous seam, strain, contact and trajectory
requirements.

## Validation

`node --test scripts/qa-exo-seam-candidate-gate-20261022.mjs scripts/qa-exo-four-panel-principal-strain-20261022.mjs`
returned **12/12 PASS** in approximately 0.24 s. Independent checks also
verified the input four-panel project and native payload remain byte-identical
after research assembly. Source syntax checks passed.

## Remaining work

Build a non-stretching, piecewise-developable hinge/bending search using
this independent candidate oracle, coupled to valid intermediate cloth/body
and cloth/self collision handling. The endpoint screen cannot substitute
for swept continuous triangle collision detection. Native compilation and
persisted round-trip tests remain blocked until at least 8 GiB of safe
free space is available. Do not silently purge or offload user data.
