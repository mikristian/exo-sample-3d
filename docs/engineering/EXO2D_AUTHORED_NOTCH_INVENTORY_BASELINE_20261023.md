# EXO2D authored-notch inventory baseline — 2026-10-23

## Problem and bounded improvement

The previous all-size standalone-notch preflight checks the notches currently present in the source against graded results. It cannot detect a notch deleted from the source **before** grading, because the deleted ID is absent from both source and graded outputs. This new standalone module captures an identity inventory **before** later editing, so a separately retained baseline can expose lost or unexpectedly added notch identities.

Source: `src/core/authoredNotchInventory20261023.js`; tests: `src/core/authoredNotchInventory20261023.test.mjs`.

## Data and trust rules

The baseline stores the explicit ordered size run, base size, each piece ID, and sorted notch IDs. It deliberately does not snapshot raw notch coordinates: moving a notch should not automatically be treated as deleting it. Capture refuses malformed size runs, duplicate piece IDs, duplicate/missing notch IDs and all-empty notch inventories. Comparison reports missing source notches, unreviewed additions, lost pieces, size-set changes and invalid baseline schemas. Neither operation mutates the garment. A baseline must be stored **separately from the edited source** and approved by an independent patternmaker/reviewer before it can provide meaningful release evidence. The current `approved:false` field is a deliberate denial, **not** a cryptographic signature or authorization; comparison accepts only the study schema with `approved:false` to avoid accidentally representing an unimplemented approval workflow.

## Explicit limitations

Identity matching does not check geometry, CUT offsets, double-notch cut paths, grading, physical DXF, factory acceptance or the physical sample. An adversary who modifies both the baseline and source can defeat this comparison; an explicit regression demonstrates that a syntactically valid forged baseline can return `identity_match_only` after deletion, **while factory authority remains false**. A future reviewed integration needs signed/hardened external provenance and a release policy. Do not wire this study into production or label a garment factory-ready based on these tests. Existing production readiness and factory-package files remain untouched.

## Next integration contract

After independent ownership review, capture inventory at approved pattern revision, store it in a protected release record with source revision/hash, compare against every release candidate, then run all-size physical-notch geometry checks, the fail-closed DXF exporter, receiver CAD roundtrip, and physical sample sign-off. A missing source notch must be a named blocker, never an empty-but-passing notch list.
