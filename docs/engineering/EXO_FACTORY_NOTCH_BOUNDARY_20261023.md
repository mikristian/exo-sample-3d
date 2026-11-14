# EXO factory ZIP notch boundary audit — 2026-10-23

## Observed export path

`src/App.jsx` `exportFactoryPackage()` calls `buildFactoryPackageZip(project)` and downloads returned bytes. It reads the UI's `productionPreflight.blockers` only for the success message. `src/core/factoryPackage.js` calls `buildFactoryPackageFiles`, emits graded manufacturing-mode DXFs through `projectToDxf(gradeProject(...), size, {cutlineMode:'manufacturing'})`, serializes original `garment-source.json`, and embeds `industrial-notch-qa.json` and `manufacturing-release-readiness.json`. This is an export of an **unapproved study**, regardless of readiness status; only reference-only imports are explicitly refused in the package builder.

`inspectManufacturingReleaseReadiness` aggregates `inspectGradedNotchPairs` into `SEWING_NOTCH_QA`. The notch checker inspects notches that carry either `matchGroupId` or `matchedSeamId`, so standalone notches with invalid `edgeIndex` are outside this check. A paired notch that refers to the wrong sewn edge produces a blocker. **The tested factory ZIP path fails closed on the invalid standalone edge**: `createRecipientCadExchangeProtocol` calls manufacturing `projectToDxf` and throws `Invalid manufacturing DXF notch edgeIndex on front: 29`. No ZIP is returned. A different direct-DXF test previously documented silent omission; that observation does not hold for this current factory ZIP path.

## Boundary and risk

The embedded readiness status always explicitly denies factory certification, cutting authorization and bulk production authorization. A `BLOCKED_NOT_APPROVED` status is represented inside otherwise exportable ZIPs and does not prevent the UI from offering/downloading them. Standalone invalid notches do **not** produce a `SEWING_NOTCH_QA` blocker, but the tested factory ZIP writer aborts before delivery. This is a readiness diagnostics/integration gap rather than a confirmed factory ZIP omission. ZIP SHA-256 manifest entries confirm bytes, not authored-notch completeness.

## Required production integration (not implemented in this audit)

Expand readiness diagnostics for **every authored notch** across graded sizes, including standalone/unpaired notches: validate integer `edgeIndex` in `[0, points.length)`, finite `t` in `[0,1]`, finite positive safe depth, and the physical CUT output for each declared notch. Surface the existing DXF rejection in a structured, size/piece/notch-specific preflight result; preserve its fail-closed export behavior. Keep independent receiving CAD, plot, sewing sample, and named human approval requirements.

## Regression

Run `node --test scripts/qa-factory-package-notch-boundary-20261023.test.mjs`. The tests demonstrate the standalone-notch readiness diagnostic gap, verify factory ZIP rejects the same malformed notch, and distinguish paired-notch readiness detection. These tests **document the exact boundary**; passing is not factory approval.
