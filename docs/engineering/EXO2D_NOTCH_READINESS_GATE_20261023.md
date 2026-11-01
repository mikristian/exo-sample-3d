# EXO 2D Standalone Notch Readiness Gate — 2026-10-23

The production manufacturing readiness checker currently evaluates *paired sewing notches* through `inspectGradedNotchPairs`, but its `engineeringGeometryPass` does not include standalone physical notches. An unpaired authored notch with `edgeIndex: 999` can therefore remain invisible to the existing release geometry summary even though the manufacturing DXF exporter may skip it.

`src/core/manufacturingNotchReadiness20261023.js` provides an additive read-only study wrapper around `inspectManufacturingReleaseReadiness` and `inspectStandaloneNotchesAllSizes20261023`. It computes the existing release report and the independent physical-notch inventory over every configured graded size. The wrapper marks its own geometry verdict false if the standalone audit is blocked, incomplete, or has no verified physical notches. The original checker and its output remain untouched.

Each notch issue appears in the combined blocker list with its code, message, size, piece ID and notch ID. The audit covers source inventory/IDs, missing notches or pieces after grading, integer edge references, curve geometry, fractional edge stations, allowable depth, recognized single/double type and invalid or stale cached coordinate pairs. Source garments and exporter paths are never rewritten by this wrapper.

The adapter is **development-only** and must not be represented as an integrated factory release gate. It does not validate physical CUT offsets, double-notch cut geometry or receiving-CAD interoperability. Passing its digital checks cannot certify a factory sample, authorize cutting, or approve bulk production. Empty inventories are treated as unverified in this study, which may require a future explicit documented zero-notch exception for garments intentionally designed without notches.

Run the focused regression suite with `node --test src/core/manufacturingNotchReadiness20261023.test.mjs`. Certification remains blocked pending exporter-level checks, physical sample verification and independent operator approval.
