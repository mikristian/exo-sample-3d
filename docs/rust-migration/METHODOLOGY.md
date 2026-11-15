# How EXO Rust percentages were measured

**Pinned EXO source:** `985bc9a8e5031a9fa02666a44390802aff8e04ce` (public `main` snapshot, November 14, 2026). Results do **not** depend on the developer's dirty working tree, private installed `.app`, machine paths or CLO3D private assets. To regenerate, run:

```sh
python3 scripts/research/build_exo_rust_migration_dashboard.py \
  --repo . --ref 985bc9a8e5031a9fa02666a44390802aff8e04ce \
  --out docs/rust-migration
```

## Three distinctly different measurements

1. **41-system mapped backend source-language baseline:** An existing source audit, [`EXO_V2_RUST_ALL_SYSTEMS_PLAN_20261114.json`](../reports/EXO_V2_RUST_ALL_SYSTEMS_PLAN_20261114.json), classified 1,239 file *assignments* into 41 systems, totaling **138,170 backend lines**, of which **7,128** are Rust: **5.16% Rust by mapped source lines**. Each row's percentage = mapped Rust lines / mapped system source lines. For UI, that audit separately measured 61,552 JS/JSX + 19,576 CSS lines, with no Rust in that counted React/CSS UI scope. These are the per-system percentages displayed in the dashboard and exported CSV. The baseline mapping may include heuristic or overlapping assignments; they are *not* a reclassification of every Git path performed by this new script. We validated that all **41 system records** have unique IDs, that the baseline numerator/denominator sum to their documented totals, and that **all of the legacy listed example source paths exist in the pinned public Git tree**. That does not prove a legacy file-classification methodology is exhaustive or uniquely partitions files.
2. **Current Git-tracked production-source code mix:** The reproducible script reads Git objects directly from the pinned commit and line-counts source extensions under the explicitly listed roots. Excludes test/spec files, fixtures, vendor/`node_modules`, generated build folders, snapshots, `public/` media and documentation. It counts one tracked file once. **EXO first-party scoped source:** 1,753 files, 258,496 physical source/style lines, including **24,046 Rust lines = 9.30%**. This scope is intentionally broader than the 41-system backend classification and includes React/CSS and a wide range of EXO integrations and research-derived application scripts. **Upstream-derived ClothCraft** source under `research/oss/clothcraft/src/`: separate 73 Rust files, **33,918 Rust lines**, 100% Rust *within that selected subtree*. Source-line totals are not source ownership, ABI parity or code quality. These populations have different denominators, so **never average 9.3% and 5.16%**, and never add the upstream count to first-party code without labeling it separately.
3. **Functional Rust migration completion:** **Unknown / not measured.** Neither a `.rs` file nor a passing unit test guarantees that EXO's active UI routes every command through that code, that industrial exports are safe or that the installed desktop binary equals GitHub. We therefore publish **`null`** for `allSystemsMigrationCompletionPercent` and `functionalParityVerifiedPercent` in `dashboard-data.json`. Do **not** plot them as 0% or 100%. Each completed task needs an independently reviewed runtime-proof checklist.

## Current production-source mix (scope #2)

| Language group | First-party files | First-party physical lines | Relative share of first-party scope |
|---|---:|---:|---:|
| JavaScript / TypeScript | 1,269 | 184,118 | 71.23% |
| Rust | 99 | 24,046 | 9.30% |
| CSS | 133 | 19,936 | 7.71% |
| C / C++ | 181 | 15,997 | 6.19% |
| Python | 61 | 9,510 | 3.68% |
| Swift | 10 | 4,889 | 1.89% |
| **Total** | **1,753** | **258,496** | **100%** |

The C/C++ group includes headers; the JavaScript group includes JS, JSX, MJS, CJS, TS and TSX; CSS is counted as style code; SQLite/data JSON, test scripts, generated WASM/binaries, docs, binary assets and vendor media are excluded. The `sourceClassificationMethod` object in `dashboard-data.json` records the exact prefixes and extension map used. Lines are physical (`\n`-separated) source lines, not semantic statements, executable counts, complexity, cost, correctness or developer hours. A large JSX shell can dominate a line-based denominator without indicating where engineering physics runs.

## Why the dashboard is priority-ranked but not a live assignment registry

The previous 41-system plan specifies exact source examples, dependencies, upstream file hypotheses and acceptance tests. This project's `TASK_BOARD.md` adds explicit priorities and assigns a small first PR for every system. It uses a deterministic dependency-aware ordering; the task's listed parents always precede it. **Priority is a proposed engineering recommendation, not a funded project schedule, current GitHub issue, upstream task claim, or proven completion.** The board marks tasks unclaimed until maintainers explicitly accept work in an actual issue.

The upstream ClothCraft live ownership board is [issue #8](https://github.com/erythrofr/ClothCraft/issues/8), **not** our EXO Markdown planning file. `COORDINATION.md` says to choose a registered issue, post `/coord claim <agent-identifier>` and wait for an explicit accepted assignment before implementing an upstream change. "Ready" in its static task catalog does not mean free. Do not modify upstream `coordination/tasks.json`, cross-repo ownership or upstream source simply because this dashboard names it as an integration target.

## Recorded evidence, not earned feature percentages

Existing November 14 EXO reports show an isolated public-mode source-built macOS candidate launched successfully with signed runtime provenance, two-panel native Rust session and GPU one-step smoke. They also describe **62 EXO-session Rust tests**, **7 Rust service tests**, and five WASM modules rebuilt (four byte-matched; geometry differed). These are **bounded dated results** with distinct source/compiler conditions; they are not exhaustive 41-system coverage, factory fit approval, clean-machine notarization or a proof that the installed personal EXO app is reproduced byte-for-byte. Details: [public candidate QA](../reports/EXO_V2_PUBLIC_CANDIDATE_SOURCE_BUILD_QA_20261114.md) and [Expansion source rebuild](../reports/EXO_EXPANSION_PUBLIC_SOURCE_REBUILD_20261114.md).

## Data validation checks

- The system IDs are exactly 1–41 with no missing or duplicate IDs; their dependencies reference actual IDs and contain no cycles.
- A generated task never precedes its dependency, even if the dependency's priority is lower.
- Mapped per-system Rust LOC never exceeds mapped total source LOC, percentages are bounded 0–100, baseline totals sum correctly and the source SHA remains explicit in every generated data file.
- A stale/nonexistent example file is reported as a **missing example** in the per-system plan instead of being silently substituted. At this snapshot, no example paths were missing.
- Future revisions must rerun with a new immutable SHA, retain the old audit for comparisons and publish changed inclusion rules before comparing trends.

No source content, tokens, personal computer paths, original garments or restricted assets are embedded in the CSV/JSON/HTML dashboard. Source paths shown are **repository-relative public code paths**.
