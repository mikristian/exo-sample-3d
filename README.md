# Garment Studio

Garment Studio is an open garment-CAD, cloth-simulation and apparel-production platform in active development. The project is building a workflow for 2D sewing patterns, 3D fitting, fabric simulation, avatars, grading, markers, DXF, tech packs, rendering and programmable/AI garment operations.

The goal is not to copy proprietary software or assets. The goal is an interoperable, extensible open platform for computational fashion.

## Current capabilities

- editable 2D pattern pieces with quadratic curves, internal lines and seam allowances
- sewing graph with partial seams, reverse direction, ease/gather/elastic treatments
- real-time browser cloth preview with self/body collision and fit analysis
- multiple garment foundations including tee, hoodie, zip hoodie and pants
- fabrics with directional stretch/shrink, bend, thickness, damping and friction
- avatars with measurement-driven body dimensions and arm pose
- trims including zippers, buttons, buttonholes, bindings, topstitching and fasteners
- lining and fused interfacing layers
- per-point grading, grade nests and multi-size production runs
- polygon marker placement and multi-fabric markers
- DXF import/export, OBJ/GLB export, POM CSV, tech-pack and factory-package export
- GarmentCode/PyGarment JSON bridge
- swappable simulation-backend protocol
- live native PositionBasedDynamics XPBD backend on Apple Silicon with resumable stepping, self/body collision and fit/pressure analysis

## Architecture direction

Garment Studio keeps one canonical garment document and treats major engines as replaceable backends:

- **Pattern CAD:** Garment Studio + GarmentCode/PyGarment adapters
- **Simulation:** browser preview, native XPBD/PBD, optional CUDA/neural backends
- **3D platform:** Blender integration for scene, mesh, avatar, rendering and animation
- **Production:** Garment Studio grading, marker, DXF, BOM, POM and factory handoff
- **Automation:** stable document/backend APIs for agents and external tools

See `docs/ARCHITECTURE.md` and `research/OPEN_SOURCE_ACCELERATION.md`.

## Quick start

```bash
npm install
npm run dev
```

For the full local stack with the compiled native XPBD solver available in the Fit backend selector:

```bash
npm run dev:full
```

This starts the Vite UI and the local native solver sidecar on `127.0.0.1:5194`. The browser-only solver remains available when the sidecar is not running.

Production build:

```bash
npm run build
```

Core regression suite:

```bash
npm run check
```

Focused integration checks:

```bash
npm run check:garmentcode
npm run check:backend
npm run check:native-xpbd
npm run check:native-garment
npm run check:native-service
npm run check:blender
```

The native XPBD check builds the upstream MIT PositionBasedDynamics core from a local research clone under `research/oss/PositionBasedDynamics`. Research clones are deliberately ignored by Git.

## Contributing

Start with `CONTRIBUTING.md`. Major solver or document-format changes require an RFC/architecture discussion because the project is designed for multiple independent backends.

High-value contribution areas include cloth physics, collision, pattern CAD, Blender integration, avatars, rendering, industrial DXF, marker optimization, fabric calibration and benchmark garments.

## Licensing status

The project is being prepared for public open-source development, but the final license for original Garment Studio code has **not yet been selected**. Do not assume that third-party research code, checkpoints, body models or datasets can be redistributed merely because their repositories are public.

See `docs/LICENSING.md` before adding dependencies.

## License and public-release status

Garment Studio original source is intended to be distributed under **GNU GPL-3.0-only**; see [`LICENSE`](LICENSE). Third-party components and assets retain their own licenses. The current local working tree is **not yet a cleared public distribution**: proprietary avatars, third-party dependency notices, contributor rights and Git history must be audited before publishing.
