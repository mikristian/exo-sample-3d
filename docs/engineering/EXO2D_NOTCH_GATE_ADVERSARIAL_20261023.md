# EXO2D independent adversarial notch gate review — 2026-10-23

Scope: development-only `manufacturingNotchReadiness20261023.js`, `standaloneNotchPreflight20261023.js` and independent authored source inventory comparison. This evidence does **not** certify manufacturing readiness, CUT-layer geometry, external CAD import, or garment samples.

## Focused verification

Run: `node --test src/core/industrialNotchGateAdversarial20261023.test.mjs`.

Adversarial cases cover numeric-string `edgeIndex`, nonfinite station, negative depth, unsupported notch type, partial coordinate cache, duplicate/non-string/missing-base size runs, no authored notches, deletion from authored source measured against a separately captured baseline, endpoint double notch, injected fake pass metadata, and source immutability. The tests intentionally inspect observed behavior at the endpoint rather than asserting that endpoint cutting is safe.

## Observed strengths

The standalone gate rejects invalid notch geometry in its configured graded run; empty source notch inventory cannot establish standalone success. Added fabricated `factoryCertified`, `standaloneNotchGatePass`, and `standaloneNotchAudit` input properties did not override a real bad `edgeIndex`. Returned manufacturing authorization flags remain false, and test specimens remained unchanged after checks. A separately retained baseline catches removal of an authored source notch with `AUTHORED_NOTCH_MISSING`.

## Release concerns and limitations

1. **Endpoint double-notch physical cuts remain unverified.** `standaloneNotchPreflight20261023.js:74-80` accepts `type:'double'` with `t:0` or `t:1`; `:106` records a semantic check without examining the two CUT paths, their containment, clipping, orientation or potential overlap at a corner. This passes the standalone gate on a template specimen. Reject endpoint double notches or independently compare the emitted DXF geometry before any manufacturing release.
2. **Source disappearance requires a trusted independent baseline.** `standaloneNotchPreflight20261023.js:37-42,108-110` derives the expected inventory from the current project. If an authored notch disappears from the source, the runtime preflight cannot reconstruct its former existence. `authoredNotchInventory20261023.js:48-69,72-119` provides an experimental comparison, but the baseline must be persisted externally and reviewed for authenticity; `approved:false` is deliberately not an approval signature. The combined gate currently does not call this comparison.
3. **Factory CUT geometry is outside the inspection scope.** The standalone preflight uses edge station and allowance geometry but does not export and parse physical DXF entities, test receiving CAD conventions, or guarantee graded notch synchronization to tool paths. Its own output advertises `factoryDxfGeometryVerified:false`; combined readiness always sets factory approval and cutting authorization false.
4. **Potential trust issue in reported diagnostic fields.** The combined gate consumes an `inspectManufacturingReleaseReadiness` result and reports an engineering geometry status. This is diagnostic composition rather than an authenticated release record; a real factory handoff needs a fresh independent export comparison and controlled source/baseline provenance.

## Follow-up tests before reconsidering manufacturing block

Independently parse CUT paths for single/double notches at curved-edge stations and near both endpoints; check double-notch spacing, contour containment, cut depth and seam-allowance remainder in every configured size. Exercise hostile grade transforms and grade-loss cases with an oracle independent of `gradeProject`. Compare persisted, immutable source-notch ID inventory before the gate and verify missing or added pieces and notches block. Keep all factory certifications false pending human inspection and external CAD validation.
