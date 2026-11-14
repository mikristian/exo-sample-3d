# Double-notch release readiness integration — 2026-10-23 14:00

`inspectManufacturingReleaseReadiness` now calls `inspectIndustrialDoubleNotches20261023(project)` independently of the caller-provided `checks` object. This uses the live source project and all configured graded sizes to inspect physical cutting-edge geometry, including the DXF double-notch endpoint clamp.

Any inspection exception or malformed result blocks engineering geometry readiness. Each reported physical notch issue creates a release blocker with its size, piece ID, notch ID and diagnostic code. `digitalCounts.industrialDoubleNotchBlockers` exposes the inspection issue count; `engineeringGeometryPass` becomes false for any industrial double-notch QA blocker. Existing standalone physical-notch checks and the independent human release requirements remain in force.

Endpoints `t=0` and `t=1` can cause the generated two-mark fractions to be clamped to `[0.01, 0.99]`, shifting marks away from the authored station. The physical DXF rejection is reflected in the independent readiness gate. Valid interior stations are not blocked by this clipping check.

Adversarial coverage: `src/core/manufacturingDoubleNotchGate20261023_1400.test.mjs` checks both endpoints across all configured sizes, injected zero-blocker summaries (the same trust boundary factory package cached checks use), read-only project behavior and interior-position control. This engineering diagnostic does not grant Gerber approval, physical factory approval, cutting authorization or bulk production authorization. Those require external receiving CAD and sample evidence.
