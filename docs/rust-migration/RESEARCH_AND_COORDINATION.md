# EXO and upstream ClothCraft — research and coordination guide

**Public reference baseline:** EXO [`985bc9a8`](https://github.com/mikristian/exo-sample-3d/tree/985bc9a8e5031a9fa02666a44390802aff8e04ce) and upstream [`erythrofr/ClothCraft`](https://github.com/erythrofr/ClothCraft) main observed November 14, 2026 (at time of research, remote HEAD `16761c55600342334a2fd585c80f9fe811c2b20c`). **Pin and reconfirm the upstream SHA before coding**; upstream may move after publication.

## Primary sources to read (do not substitute historical proposals for implemented behavior)

- [Upstream coordination process](https://github.com/erythrofr/ClothCraft/blob/main/COORDINATION.md) — issue registration, claims, ownership, heartbeat, review and release.
- [Upstream AI_START_HERE](https://github.com/erythrofr/ClothCraft/blob/main/AI_START_HERE.md) and [AGENTS](https://github.com/erythrofr/ClothCraft/blob/main/AGENTS.md) — architecture, physics/cad invariants, CPU/GPU test policy.
- [Upstream task catalog](https://github.com/erythrofr/ClothCraft/blob/main/coordination/TASKS.md) and [live board issue #8](https://github.com/erythrofr/ClothCraft/issues/8) — static statuses are not proof of availability; check issue conversations and active PRs.
- [Upstream EXO feature audit](https://github.com/erythrofr/ClothCraft/blob/main/docs/exo-feature-audit.md) — gaps versus experiments and already implemented features.
- [Upstream interoperability contract](https://github.com/erythrofr/ClothCraft/blob/main/docs/interoperability.md), [document model](https://github.com/erythrofr/ClothCraft/blob/main/docs/documents-and-sewing.md), [solver/OGC](https://github.com/erythrofr/ClothCraft/blob/main/docs/ogc.md), [GPU contact](https://github.com/erythrofr/ClothCraft/blob/main/docs/gpu-contact-search.md), and [fabric evidence](https://github.com/erythrofr/ClothCraft/blob/main/docs/fabrics.md).
- EXO [architecture](../EXO_ARCHITECTURE.md), [full 41-system audit](../reports/EXO_V2_RUST_ALL_SYSTEMS_PLAN_20261114.md), [first Rust migration milestone](../reports/EXO_RUST_FIRST_MIGRATION_MILESTONE_20261112.md), [native build QA](../reports/EXO_V2_PUBLIC_CANDIDATE_SOURCE_BUILD_QA_20261114.md), and [installed runtime source parity](../reports/EXO_V2_INSTALLED_RUNTIME_SOURCE_PARITY_20261114.md).

## Ownership and coordination (two distinct repositories)

1. **EXO-only development:** Open an EXO issue against the `EXO-RUST-NNN` task from [our board](TASK_BOARD.md). Include its source SHA, allowed file list, owner, dependency/PR links, exact fixture and measurable exit checks. Implement in a separate EXO branch with tests; maintainers merge to EXO when approved.
2. **Upstream ClothCraft contribution:** First read `COORDINATION.md`, the registered task issue, task catalog (`coordination/tasks.json`) and live board. If eligible and not actively assigned, post the exact `/coord claim <short-agent-id>` command on that **registered issue**, then **wait for coordinator acceptance before coding**. A comment or an EXO task entry is not a claim. If a needed task is unregistered, ask a maintainer to register it before starting; if coordinator workflow fails, stop and leave evidence.
3. **During upstream work:** Respect the exact accepted files/dependencies and avoid other agents' shared contract files. Follow the heartbeat/review/release forms from the latest protocol. Do not claim a different worker's completion or mark a task finished because a local test passed. If blocked, leave a reproducible handoff and release the claim.
4. **EXO ↔ ClothCraft integration:** EXO keeps its own UI, product packaging and adapter code. The upstream owner reviews any ClothCraft-level change; never transplant EXO's private application shell into upstream, replace upstream invariants or use another contributor's code without rights/provenance.

## Upstream engineering invariants to protect

- **Rest shape:** pattern coordinates are material rest coordinates in metres. Never regenerate rest shape from deformed/draped 3D positions; explicit mm↔metre conversions in EXO CAD/export contracts.
- **Identity:** keep panel/edge/boundary IDs and material coordinates stable through sewing, splits, grading, meshing and serialization; avoid persisted mesh vertex/triangle indices.
- **Invalidation:** edits to rest geometry, grain or physical material properties must coherently invalidate dependent meshes/solver caches. Optical-only changes should not reset simulation arbitrarily.
- **Physics:** preserve upstream solver/energy/contact invariants; OGC broadphase must conservatively cover contact pairs and overflow retries; no false stable/fit-certified status from zero-motion or screenshots.
- **Seams:** seam constraints belong in the integrated objective/gradients/Hessians; arbitrary post-solve projections are not a substitute for validated sewing.
- **Tests:** run CPU tests without GPU by default, with `-j 2 -- --test-threads=2` and `--locked --no-default-features` where supported; GPU QA is explicitly opt-in and uses actual physics/material comparison. State failures honestly.
- **License/privacy:** keep the EXO main project and upstream license/attribution separate; no private CLO3D media, restricted manufacturer assets, tokens, local personal paths or user garment data in GitHub research packs.

## Current upstream capability caution

ClothCraft has Rust authoring, CPU reference/Newton, VBD/OGC, optional hybrid GPU work, an egui/wgpu interface and bounded DXF functionality. Its docs explicitly distinguish implemented features from experimental alternate solvers and unimplemented industrial dialects. A generic DXF import does **not** prove complete AAMA/ASTM factory interchange. No universal plugin ABI or solver selection interface should be assumed. Evaluate real source and test cases rather than treating old EXO feature lists as current upstream capability.

## Handoff format for agents

```text
Agent: <account>/<agent-session>
Task: EXO-RUST-NNN (EXO issue) or registered upstream task ID
Repo / base SHA: <exact upstream or EXO commit>
Scope: <smallest agreed list of files and APIs>
Observed baseline: <command, fixture, raw result, revision>
Change: <what was implemented and why>
Validation: <tests run, including negatives; not just intended tests>
Compatibility: <Rust↔JS/C++ parity and source ID/units evidence>
Known failures: <what is not yet proven; any regression>
Branch / PR: <link>
Next: <remaining dependencies and handoff>
```

Prefer opening one focused task and committing one verifiable slice over simultaneous broad rewrites. An EXO planning document does not grant permission to write or claim an upstream issue on someone else's behalf.
