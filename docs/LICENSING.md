# Licensing and Third-Party Policy

The final license for original Garment Studio source has not yet been selected. This document records boundaries that must be preserved while the project is opened publicly.

## Important rule

A public Git repository is not automatically permission to copy, redistribute or commercially use all code/assets in it. Source code, checkpoints, body models, datasets and sample garments can have different terms.

## Current integration categories

### Permissive candidates

Examples currently under evaluation include GarmentCode/PyGarment (MIT), PositionBasedDynamics (MIT), HOOD code (MIT), ContourCraft code (MIT), ReMu core (MIT) and XRTailor core (Apache-2.0), subject to each project's bundled third-party components.

### Copyleft/native application path

Blender is GPL. A distributed Blender-derived application must follow Blender/GPL obligations. GPL components should not be casually mixed into otherwise permissive modules without understanding the resulting distribution obligations.

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
