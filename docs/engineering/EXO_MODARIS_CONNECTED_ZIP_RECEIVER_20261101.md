# EXO ClothCraft V2 — Connected-Development ZIP Digital Receiver

Date: 2026-11-01
Status: **Internal digital receiving only; NOT approved for cutting or bulk production**

## Entry points

- Producer: `src/core/modarisConnectedDevelopmentPackage20261101.js`
- Independent digital receiver: `src/core/modarisConnectedDevelopmentReceiver20261101.js`
- Independent v1 printed-PDF plot reader: `src/core/modarisConnectedDevelopmentPdfReceipt20261101.js`
- Separate-process disk receipt: `scripts/qa-modaris-connected-development-receiver-20261101.mjs`
- Positive and adversarial tests: `src/core/modarisConnectedDevelopmentReceiver20261101.test.mjs`
- UI: the linked-development ZIP download in `src/App.jsx` runs the digital receiver **before** creating the downloadable Blob. If the receiver refuses, no development ZIP is downloaded.

## Reproducible commands

```sh
npm run qa:modaris-connected-receiver

# Independently inspect an existing ZIP file in a fresh Node process:
node scripts/qa-modaris-connected-development-receiver-20261101.mjs /path/to/connected-development-review.zip
```

Success prints JSON with `ok: true`, `factoryCertified: false`, `factoryApproved: false`, `receiptType: "INTERNAL_DIGITAL_ONLY"`, size-level CUT counts, and verified file count. Failure prints `Connected development receiving REFUSED: ...` and exits nonzero. The CLI does not write or extract the input archive.

## Verification contract

1. Read ZIP central and local directory metadata **before** inflation. Only single-disk ZIP32 with supported stored/deflated entries is accepted. Reject duplicate names, path traversal, local/central mismatches, unexpected ZIP extras/comments, hidden entry data, excessive archive counts, oversized declared uncompressed files and bad ZIP CRC32. The receiver also verifies the actual inflated byte count.
2. Require a complete, canonical v1 manifest and SHA-256 byte match for every nonmanifest file. The manifest and review status have strict fields. Reject malformed/duplicate-key JSON and unsafe embedded JSON keys.
3. Require a source-pinned Modaris linked graph, valid piece identities and exact size coverage. Rebuild the linked size run from the archived source and compare to the archived size run.
4. Independently parse each archived manufacturing DXF and require exact size/project identity, correct millimetre units, valid physical CUT entities, complete named layers, CUT topology and physical outline vertex sequence matching the final graded pieces (allowing piece placement translation). Also parse closed STITCH polylines and require stitch geometry to match the graded sewn outlines, along with deliberate NOTCH LINE station, endpoints, depth, count and shared CUT/STITCH translation against the graded source. Validate CUT preflight and apply per-DXF complexity budgets before expensive polygon parsing.
5. Validate the closed file vocabulary, marker and QA inventory, coverage for each size/fabric and expected marker placement quantity under bounded resource limits. Marker SVG contour coordinates are corroborated against ten-subdivision graded physical outlines and permitted grain/cross-grain rotation, not just counted. Reject moved/overlapping printed placements, incorrect fabric widths, unexpected transforms/attributes, active SVG constructs, unrecognized ZIP payload files, and orphan print-calibration files.
6. Parse the PDF's real page dictionaries, physical `MediaBox` point dimensions, immutable size/fabric identifiers, page sequence/start/end stations, byte-exact xref table and content streams. Compare **actual plotted PDF CUT vertex sequences** with the received marker SVG contours using physical centimetre/point conversion, including multi-page print artifacts. This is a separate digital read-back of the supplied PDF bytes; it does not regenerate the PDF from the same writer to establish acceptance.
7. Enforce the explicit development-only release status, false factory approval/certification, and four remaining external checks.

## Positive receiving evidence

Representative fixtures verified in separate test cases:

- Three linked sizes `S, M, L` with two physical CUT contours per size (25 ZIP entries).
- Six linked sizes `XS, S, M, L, XL, XXL` with two contours per size (40 ZIP entries).
- Four-piece full Foundation Tee with authored notches, nontrivial curves and seams, graded across six sizes with four physical CUT contours each (40 ZIP entries).
- Multiple fabrics (`main`, `lining`) and a quantity-two CUT demand.
- Real two-page marker PDF (`S/M/L`, narrow roll, high cut quantity), verifying full page station coverage and original CUT paths; altered PDF plot coordinates refused with both PDF byte length and ZIP manifest recalculated.
- Actual ZIP bytes written to disk, received by a separate Node process, then refused after DXF byte modification.

The test suite includes deliberately malformed archives, duplicate names, over-limit entries, changed hashes/manifests, altered size runs, rehashed physical CUT/STITCH and NOTCH station geometry, incorrect DXF identity/units, manipulated QA and release statuses, malicious and structurally damaged marker graphics, modified SVG polygon geometry, overlapping placement/incorrect width, unexpected SVG transforms, altered PDF page geometry or plotted coordinates, unexpected extra files and inconsistent ZIP CRC metadata. Tests do not grant licensed CAD or physical acceptance.

### Latest local verification (2026-11-01)

- `npm run qa:modaris-connected-receiver`: **32/32 passing** (including real ZIP-on-disk receiving, four-piece/six-size grading and two-page PDF verification)
- Adjacent source-linked manufacturing DXF, grading persistence, overlap and marker parity suites: **27/27 passing**
- Vite production bundle: **build passed** (existing large-chunk warning remains; it is not a receiver error)
- Factory approval: **BLOCKED**, as specified below

## Limits and outstanding approvals

- **SHA-256 is an unkeyed checksum, not a signature.** A party that replaces the complete ZIP and recalculates its manifest can create a self-consistent new archive. There is no external identity/trust anchor, signed factory receiver record or immutable original hash attestation here.
- CUT polygon geometry is cross-checked against EXO grading, but this is still EXO's internal geometry logic; it is not an independent licensed Modaris or AccuMark interpretation.
- Internal marker SVG/PDF plotted CUT geometry, PDF page station dimensions, and physical NOTCH positions/depths are digitally checked against the **same EXO source**. This is **not** an independent external measurement, calibrated real-world print-scale check, complete PDF annotations/ink semantic validation, physical cutter accuracy proof, or licensed CAD interpretation. Further non-CUT DXF and print semantics remain outside the receiver's scope.
- The receiver is bound to the v1 EXO ZIP format and bounded resource budgets; it is not a universal ZIP/CAD consumer.
- Required external gates remain: **licensed receiving CAD import**, **calibrated actual-size plotting/measurement**, **physical cut and sewn sample**, and **factory approval**. All factory-release claims remain blocked.

## Repository concurrency note

The working tree includes many unrelated edits from active EXO workstreams. Changes in this receiver task are scoped to the receiver module, its new dedicated tests and CLI, a small import/receipt gate in `src/App.jsx`, the npm test command and this evidence note. Do not interpret a broad `git status` or `src/App.jsx` diff as work performed by this receiver pass.
