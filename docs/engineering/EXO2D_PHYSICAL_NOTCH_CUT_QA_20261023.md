# EXO 2D physical notch cut QA — 2026-10-23

## Scope and evidence

`scripts/qa-exo2d-physical-notch-cut-20261023.test.mjs` independently parses the manufacturing DXF `LINE` and `POLYLINE` entities and measures physical millimetre geometry against factory `CUT_*` polygons. Run with `node --test scripts/qa-exo2d-physical-notch-cut-20261023.test.mjs`. This regression uses a tee source fixture with its pre-existing authored marks cleared, inserts one controlled single or double notch, and checks every configured graded size. No source geometry or production implementation is changed.

## Observed implementation details and manufacturing risks

* `src/core/dxf.js:63-99` places the start of an explicit factory notch on the sampled, allowance-offset physical cutter boundary. The notch points toward the stitch contour, with depth in centimetres; `entityLine` at lines 5-16 multiplies by 10 for millimetres. This distinction prevents testing a sewing-edge glyph as a cutter notch.
* `src/core/dxf.js:168-204` generates one line for `single`, two for `double`; lines 206-218 exclude inferred seam auto-notches from factory mode. Graded exports need physical verification for each size, not only base size.
* `src/core/dxf.js:176,180` defaults absent `t` to 0.5 and absent `depthCm` to 0.45. An incomplete authored mark may therefore produce apparently valid physical DXF instead of failing provenance validation. This is an unresolved manufacturing acceptance gap.
* `src/core/dxf.js:188-190` clamps double-notch stations at 0.01 and 0.99. Near either extreme two marks can approach or coincide after clamping, so a single/double type declaration alone does not prove two distinct physical cuts. Require a minimum calibrated station separation per size.
* `src/core/dxf.js:170` converts `edgeIndex` through `Number`; numeric strings may pass, hiding malformed authored metadata. Strict typed provenance should be enforced before factory certification.
* The tee template has ten pre-existing physical notches across its pieces. A fixture that adds a single mark without clearing that inventory correctly exports eleven, and cannot be used as a one-notch acceptance test.

## Exact acceptance criteria

1. Factory DXF `CUT_*` is the actual offset cutter polygon. Every explicit notch begins on its associated physical cutter contour within 0.011 mm and has finite coordinates.
2. A 0.30 cm authored single notch generates exactly one 3.00 mm physical `NOTCH_*` line; an authored double generates exactly two distinct 3.00 mm physical lines for every graded size. Current regression allows 0.01 mm numerical tolerance on length and rejects stations separated by less than 0.1 mm.
3. No authored marks means zero physical notch `LINE` entities even when sewing seams exist. Missing, duplicated, collapsed, detached, scaled, and non-finite lines must fail the consumer audit.
4. Depth beyond available allowance, invalid station fraction, invalid edge assignment, missing required authoring metadata, and unknown notch type must block factory approval; no implicit substitution should certify a source mark.
5. Every source-expected notch identity must be accounted for independently in every configured size; zero emitted notches is acceptable only when expected inventory is explicitly empty. A full factory release still needs independent AAMA/ASTM receiver confirmation and physical sample signoff.

## QA boundaries

These Node tests establish DXF entity-level anchor, number, physical depth, station uniqueness, negative-fixture detection, and all-size traversal for the selected tee fixture. They do not establish industrial interoperability, seam allowance clipping along arbitrary concave/cusped contours, arbitrary curved notch stations to sub-sampling precision, verified original-source notch inventory, or factory certification. Keep certification blocked pending separate preflight and receiver tests.
