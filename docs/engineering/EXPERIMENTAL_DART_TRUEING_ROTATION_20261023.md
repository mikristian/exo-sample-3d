# Experimental dart rotation and leg trueing — 2026-10-23

New isolated pure math module: `src/core/experimentalDartGeometry20261023.js`. Functions operate on planar `{x,y}` coordinates in **centimeters**; angles are **radians**, positive counterclockwise. Inputs must be finite. The wedge validator requires distinct base legs and apex strictly on the designated interior side. Rotations preserve distances and signed polygon area for a *single rigid material sector*.

`measureDartWedge20261023` reports intake, perpendicular depth, triangle wedge area, leg lengths and angle. `alignDartLegs20261023` rotates the moving leg onto the fixed-leg ray about the common apex; it reports signed longitudinal overhang in cm and transverse residual. Unequal leg radii remain unequal. `trueingRequired` flags the mismatch; it does not trim, extend, warp or reconstruct the paper cutline. The original material coordinates are not mutated.

## Factory blockers / next targeted steps

* Identify the exact **moving sector and adjoining seam** from source topology before rotating a dart. Detect crossings with other boundaries, holes, internal guides, allowance contours and seam/notch stations. No such topology processing is implemented here.
* Construct actual dart-leg **trueing of the folded edge** using a validated seam tangent, fold direction and desired sewing treatment. Record any changed seam length and preserve pattern measurements; overhang alone does not define the intended paper cutline.
* Validate all sizes through grade transforms, walks and notches; compare in external receiving CAD; sew sample and obtain trained patternmaker approval. The sector rigid-body invariants do **not** prove sewn dart balance, cloth distortion, fabric easing, or production pattern parity.

**Disposition:** EXPERIMENTAL_ONLY_FACTORY_APPROVAL_REQUIRED. No production module or factory release gate is changed.
