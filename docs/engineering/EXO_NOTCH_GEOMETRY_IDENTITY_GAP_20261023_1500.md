# EXO signed notch inventory: geometry identity gap (2026-10-23 15:00)

## Scope and observed behavior

`src/core/approvedNotchInventory20261023.js` is an isolated signed *identity inventory* experiment. Its canonical signature bytes include `schema`, caller-supplied `sourceRevision`, `baseSize`, `sizes`, and sorted `{pieceId, notchIds}` rows. `src/core/authoredNotchInventory20261023.js` collects notch IDs from source garments without capturing stations or physical geometry. A valid Ed25519 signature therefore authenticates those manifest bytes relative to a supplied public key, **not** the physical garment or DXF geometry.

The focused `src/core/approvedNotchIdentityGap20261023_1500.test.mjs` signs a real fixture with Node's `crypto.generateKeyPairSync('ed25519')` and `sign(null, ...)`, then modifies the source garment while retaining every piece and notch ID and passing the same claimed revision. Six negative-path cases show that changing `edgeIndex`, fractional station `t`, physical `type`, physical `depthCm`, piece contour `points`, or piece `curves` leaves both canonical manifest bytes and SHA-256 unchanged and still returns `status: 'signed_inventory_identity_match'`, `authenticatedAgainstSuppliedKey: true`, and zero blockers. Each asserts the verifier did not mutate source and that `factoryCertified`, `factoryCuttingAuthorized`, and `bulkProductionAuthorized` remain `false`.

These are explicit **KNOWN GAP** characterization tests. They describe current verifier behavior rather than approving any geometry; no production code was changed. They do not establish that every changed contour could produce a valid manufactured garment; they establish that this signature layer cannot detect these changes.

## Provenance implications

The verifier compares `sourceRevision` as a supplied string. If that string is reused after altering geometry, the identity manifest cannot independently detect the changed project. The signature does not establish who controls the signing key; an independently pinned authorized public key and independently evidenced, immutable source revision remain necessary. Even both controls, by themselves, cannot prove physical station coordinates unless the approved payload binds the relevant geometry and downstream output. A signature passing here does not imply graded-size parity, physical notch placement, DXF equivalence, sewability, sample acceptance, or factory authorization.

## Proposed remediation

Introduce a separately versioned, independently approved geometry manifest with deterministic serialization and units. Bind the full relevant source content or content-addressed revision: stable piece identities, ordered seamline vertices and curves, edge topology, grading parameters or individually realized geometry for **every size**, and per-notch IDs together with `pieceId`, `edgeIndex`, `t`, explicit physical type, depth, and any allowance or matching-seam data that affects output. Normalize finite numeric values and ordering, reject omitted/ambiguous fields and malformed geometry, and digest the canonical bytes. Explicitly attest the source revision against an independently stored immutable source artifact, rather than trusting a caller-supplied revision label. Keep trusted key pinning and approver authorization outside mutable garment data.

For release, compare independently generated graded geometry and physical DXF notch coordinates against the signed approved artifact, including endpoints, curves, double notches and all sizes. Fail closed on any mismatch and require separate factory sampling and sign-off. Add regression cases showing station, contour, curves, notch physical metadata, graded results, revision and export divergence reject under the *new* verifier; retain these known-gap tests until the ID-only experiment is retired or explicitly scoped to identity bookkeeping.

## Limits

The test fixture uses local ephemeral Ed25519 keys solely to exercise real signature validation, not an authorized factory approver. Tests have no external provenance check or physical DXF verification. No certification or cutting permission is created or implied.
