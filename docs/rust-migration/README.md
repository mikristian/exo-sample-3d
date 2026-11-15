# EXO Rust migration research hub

**41 systems · code-mix dashboard · dependency-ranked engineering board · detailed Rust/ClothCraft migration plan · portable research ZIP**

The entire hub is based on the public EXO Git source revision `985bc9a8e5031a9fa02666a44390802aff8e04ce`. It does not publish private CLO3D garments/assets, user projects, local machine home paths, application installers or secrets. This is a **planning and measurement resource**, not proof that every subsystem is migrated or externally certified.

**Current measured first-party Rust source share: 9.30%** (24,046 Rust lines out of 258,496 tracked production-source lines). **The older mapped-backend scope remains 5.16%.** Those are different code populations; neither is a percentage of features completed or proven to run in Rust.

## Start here

| Resource | Purpose |
|---|---|
| [**GitHub dashboard — 41 systems**](CODE_DASHBOARD.md) | Rust source percentage for every system, ordered by engineering priority, with source-line progress bars that display natively in GitHub |
| [**Interactive HTML dashboard**](dashboard.html) | Download to use live search and P0–P3 filters offline; GitHub may display HTML source unless Pages is configured |
| [**Prioritized task board**](TASK_BOARD.md) | 4 P0, 12 P1, 15 P2, 10 P3 dependency-ordered tasks with IDs and parent gates |
| [**Deep technical migration plan for all 41 systems**](SYSTEM_PLANS.md) | Current files, line counts, upstream target hypotheses, precise first PR, dependencies, negative/positive tests and Definition of Done |
| [**Priority roadmap**](PRIORITY_ROADMAP.md) | Rust core-first approach, engineering architecture diagram, first 16 atomic PR slices and gated delivery milestones |
| [**Research and ClothCraft coordination**](RESEARCH_AND_COORDINATION.md) | Source URLs, upstream invariants, contributor claims, scope ownership and handoff format |
| [**Engineering findings and blockers**](RESEARCH_FINDINGS.md) | Specific path-level risk notes from read-only public audits: dual Undo journals, ASTM DXF limits, existing Rust integration and QA caveats |
| [**Measurement methodology**](METHODOLOGY.md) | Exact numerators, counted code, exclusions, differences in population and why code % ≠ features migrated |
| [**CSV**](systems.csv) / [**JSON**](dashboard-data.json) | Machine-readable system audits and code mix for agents/automations |
| [**Download research ZIP**](EXO_RUST_RESEARCH_PACK_20261114.zip) | Offline pack of the dashboard, roadmap, 41-system plans, structured data and linked source snapshots; source/documentation only |

## Snapshot summary

| Metric | Evidence-based value |
|---|---:|
| Engineering systems mapped in previous audit | **41** |
| Git-tracked first-party production source in a broader, separate scope | **258,496 lines**, of which **24,046 (9.30%)** are Rust |
| Prior backend *mapped code lines* | **138,170** |
| Prior mapped backend Rust lines | **7,128 (5.16%)** |
| Upstream-derived ClothCraft Rust source, **not** included in first-party count | **33,918 lines** |
| React/CSS Rust-native share in the prior separate UI counting scope | **0%** |
| Functional migration completion or exact installed-app parity | **Not independently measurable as a percentage** |

The 5.16% and 9.30% have **different denominators** and cannot be averaged. Upstream Rust source existing in the repo does not prove that the corresponding EXO tool is wired to it at runtime. Don't mark a subsystem complete based on LOC, a file being present, one test passing or a polished 3D screenshot.

## What should become Rust first?

**P0: shared source, project schema, typed commands and persistence.** Without these, geometry, grade, sewing, simulation and export risk becoming incompatible duplicate implementations. **P1:** numerical pattern editing, grading/POM, allowance, seams, mesh and DXF. **P2:** fabric/solver/contact/drape plus independent factory validation. **P3:** AI, advanced materials, collaboration, diagnostics and an optional Rust-native UI. Keep React/Swift working throughout.

The [exact ordered board](TASK_BOARD.md) lists every task and its dependencies, and [the deep plan](PRIORITY_ROADMAP.md) explains each milestone and acceptance gate.

## How to participate

EXO task IDs (`EXO-RUST-001` etc.) are **proposed local planning IDs**, not live GitHub issues. Turn one into a scoped EXO issue and PR. For upstream [`erythrofr/ClothCraft`](https://github.com/erythrofr/ClothCraft) changes, follow its own [COORDINATION.md](https://github.com/erythrofr/ClothCraft/blob/main/COORDINATION.md): claim an existing registered task on its issue and **wait for coordinator acceptance before editing upstream**. The two projects have distinct ownership and licensing obligations.

## Regenerate the metrics reproducibly

```sh
python3 scripts/research/build_exo_rust_migration_dashboard.py \
  --ref 985bc9a8e5031a9fa02666a44390802aff8e04ce \
  --repo . --out docs/rust-migration
```

Python 3.9+ and Git are sufficient. The command reads immutable Git blob content, uses the previous 41-system baseline as explicit historical input and writes fresh dashboards/CSV/JSON/boards without scanning personal files. See [methodology](METHODOLOGY.md). The research ZIP is assembled separately to avoid accidentally including private or executable files.
