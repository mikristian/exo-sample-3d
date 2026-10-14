# Licensing and Third-Party Policy

**Project license choice: GNU GPL version 3.0 only (GPL-3.0-only), selected by the project owner on 2026-10-13.** The official GPL-3.0 license text is in the repository root `LICENSE`. This selection covers original project code only to the extent the project has the rights to license it. A public release still requires author/contributor rights verification, third-party notice completion, asset removal and history/secret scanning.

## Important rule

A public Git repository is not automatically permission to copy, redistribute or commercially use all code/assets in it. Source code, checkpoints, body models, datasets and sample garments can have different terms.

## Current integration categories

### Permissive candidates

Examples currently under evaluation include GarmentCode/PyGarment (MIT), PositionBasedDynamics (MIT), HOOD code (MIT), ContourCraft code (MIT), ReMu core (MIT), XRTailor core (Apache-2.0) and ZOZO/ST-Tech PPF Contact Solver (Apache-2.0), subject to each project's bundled third-party components.

MakeHuman graphical assets, including the staged base mesh used by the viewport, are released as CC0. Keep the upstream asset-license notice beside redistributed copies and continue to review any additional MakeHuman/MPFB clothing, rigs or community assets separately because add-on assets can carry their own terms.

### Copyleft/native application path

Blender is GPL. Seamly2D is GPL-3.0+. A distributed Blender-derived application must follow Blender/GPL obligations. Seamly should remain behind an external-process/document bridge unless the final Garment Studio license strategy intentionally accepts the implications of deeper GPL integration. GPL components should not be casually mixed into otherwise permissive modules without understanding the resulting distribution obligations.

### Restricted/unclear research

Research-only, non-commercial or unclear-license implementations remain references/lab integrations until permission is resolved. Model checkpoints, SMPL-family assets, AMASS and similar datasets/body-model resources require their own review.

## Research folder

Third-party repositories cloned under `research/oss/` are ignored by Git. They are evaluation inputs, not automatically vendored dependencies.

## Before adding a dependency

Record:

- repository + commit/tag
- source-code license
- transitive/bundled native dependencies
- model/checkpoint license
- dataset/body-model license
- redistribution restrictions
- whether it can run as an optional external service instead of being linked into the application


## PPF runtime note

The evaluated macOS arm64 PPF Contact Solver distribution identifies ZOZO’s solver as Apache-2.0. Its included `THIRD_PARTY_LICENSES.txt` also states that the Python/Rust dependency enumeration is incomplete. For that reason Garment Studio keeps the runtime under ignored `research/ppf-local/` and treats it as an optional external backend until all bundled/transitive licenses are enumerated and approved for the intended distribution model.
