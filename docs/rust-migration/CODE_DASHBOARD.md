# EXO — Rust percentage dashboard (GitHub-readable)

**Pinned public source:** `985bc9a8e5031a9fa02666a44390802aff8e04ce`. **41 mapped systems**; 7,128 of 138,170 mapped backend source lines are Rust (**5.16%**). This is **code-language mix, not 5.16% of the product migrated**. Actual migrated/verified functionality remains **unknown**, not zero or 100.

## System-by-system Rust source share

| Priority order | Task | System | Rust source mix (visual) | Rust / total mapped LOC |
|---:|---|---|---|---:|
| 01 · P0 | [EXO-RUST-037](SYSTEM_PLANS.md#sys-37) | Native Rust engine shared core | `▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░` **94.9%** | 447 / 471 |
| 02 · P0 | [EXO-RUST-001](SYSTEM_PLANS.md#sys-01) | Project model / source-of-truth | `░░░░░░░░░░░░░░░░░░░░` **1.6%** | 54 / 3,277 |
| 03 · P0 | [EXO-RUST-033](SYSTEM_PLANS.md#sys-33) | API / processes / transport | `▓▓▓▓▓░░░░░░░░░░░░░░░` **23.0%** | 1,630 / 7,093 |
| 04 · P0 | [EXO-RUST-029](SYSTEM_PLANS.md#sys-29) | Persistence / undo / history / restore | `▓░░░░░░░░░░░░░░░░░░░` **4.0%** | 98 / 2,469 |
| 05 · P1 | [EXO-RUST-003](SYSTEM_PLANS.md#sys-03) | Curves, freehand and geometry | `▓▓▓▓▓▓░░░░░░░░░░░░░░` **30.0%** | 770 / 2,567 |
| 06 · P1 | [EXO-RUST-005](SYSTEM_PLANS.md#sys-05) | Parametric references / formulas | `░░░░░░░░░░░░░░░░░░░░` **0.0%** | 0 / 1,493 |
| 07 · P1 | [EXO-RUST-007](SYSTEM_PLANS.md#sys-07) | Measurements / POM / body charts | `▓░░░░░░░░░░░░░░░░░░░` **5.0%** | 93 / 1,865 |
| 08 · P1 | [EXO-RUST-002](SYSTEM_PLANS.md#sys-02) | Drafting primitives and snapping | `▓░░░░░░░░░░░░░░░░░░░` **4.8%** | 134 / 2,815 |
| 09 · P1 | [EXO-RUST-004](SYSTEM_PLANS.md#sys-04) | Topology / split / unfold / mirror | `▓▓▓░░░░░░░░░░░░░░░░░` **14.6%** | 154 / 1,058 |
| 10 · P1 | [EXO-RUST-006](SYSTEM_PLANS.md#sys-06) | Pattern grading / size runs | `▓░░░░░░░░░░░░░░░░░░░` **3.5%** | 260 / 7,408 |
| 11 · P1 | [EXO-RUST-010](SYSTEM_PLANS.md#sys-10) | Allowance / notch / cutline | `▓░░░░░░░░░░░░░░░░░░░` **4.5%** | 142 / 3,170 |
| 12 · P1 | [EXO-RUST-008](SYSTEM_PLANS.md#sys-08) | Sewing / seam matching | `▓▓░░░░░░░░░░░░░░░░░░` **9.0%** | 316 / 3,508 |
| 13 · P1 | [EXO-RUST-011](SYSTEM_PLANS.md#sys-11) | Cloth mesh / tessellation | `▓▓▓░░░░░░░░░░░░░░░░░` **16.9%** | 196 / 1,161 |
| 14 · P1 | [EXO-RUST-016](SYSTEM_PLANS.md#sys-16) | Fabric mechanics / materials | `▓▓░░░░░░░░░░░░░░░░░░` **8.6%** | 262 / 3,052 |
| 15 · P1 | [EXO-RUST-023](SYSTEM_PLANS.md#sys-23) | DXF / CAD interop | `░░░░░░░░░░░░░░░░░░░░` **0.3%** | 33 / 11,648 |
| 16 · P1 | [EXO-RUST-015](SYSTEM_PLANS.md#sys-15) | Avatar / pose / animation | `░░░░░░░░░░░░░░░░░░░░` **0.0%** | 0 / 794 |
| 17 · P2 | [EXO-RUST-012](SYSTEM_PLANS.md#sys-12) | Cloth physics and solver | `▓░░░░░░░░░░░░░░░░░░░` **3.2%** | 505 / 15,839 |
| 18 · P2 | [EXO-RUST-013](SYSTEM_PLANS.md#sys-13) | Collision / contact / penetration | `▓▓░░░░░░░░░░░░░░░░░░` **9.4%** | 487 / 5,157 |
| 19 · P2 | [EXO-RUST-014](SYSTEM_PLANS.md#sys-14) | Garment fit / stage / drape | `▓░░░░░░░░░░░░░░░░░░░` **2.9%** | 185 / 6,460 |
| 20 · P2 | [EXO-RUST-022](SYSTEM_PLANS.md#sys-22) | Marker layout / nesting / yield | `▓░░░░░░░░░░░░░░░░░░░` **5.2%** | 226 / 4,352 |
| 21 · P2 | [EXO-RUST-024](SYSTEM_PLANS.md#sys-24) | SVG / PDF / physical plot | `▓░░░░░░░░░░░░░░░░░░░` **2.6%** | 39 / 1,473 |
| 22 · P2 | [EXO-RUST-025](SYSTEM_PLANS.md#sys-25) | Factory preflight / measurement QA | `▓░░░░░░░░░░░░░░░░░░░` **3.6%** | 130 / 3,635 |
| 23 · P2 | [EXO-RUST-018](SYSTEM_PLANS.md#sys-18) | Hardware / fastener / trims | `░░░░░░░░░░░░░░░░░░░░` **0.0%** | 0 / 877 |
| 24 · P2 | [EXO-RUST-027](SYSTEM_PLANS.md#sys-27) | Techpacks / BOM / specification | `▓░░░░░░░░░░░░░░░░░░░` **2.8%** | 218 / 7,894 |
| 25 · P2 | [EXO-RUST-009](SYSTEM_PLANS.md#sys-09) | Darts / pleats / facings | `░░░░░░░░░░░░░░░░░░░░` **0.0%** | 0 / 824 |
| 26 · P2 | [EXO-RUST-021](SYSTEM_PLANS.md#sys-21) | 3D export and scene assets | `░░░░░░░░░░░░░░░░░░░░` **0.0%** | 0 / 351 |
| 27 · P2 | [EXO-RUST-030](SYSTEM_PLANS.md#sys-30) | Libraries / templates / presets | `░░░░░░░░░░░░░░░░░░░░` **0.0%** | 0 / 4,251 |
| 28 · P2 | [EXO-RUST-039](SYSTEM_PLANS.md#sys-39) | Workspace commands / tools / preferences | `▓░░░░░░░░░░░░░░░░░░░` **4.9%** | 108 / 2,208 |
| 29 · P2 | [EXO-RUST-031](SYSTEM_PLANS.md#sys-31) | Image digitizing / vision / references | `░░░░░░░░░░░░░░░░░░░░` **0.0%** | 0 / 742 |
| 30 · P2 | [EXO-RUST-034](SYSTEM_PLANS.md#sys-34) | Collaboration / security / sync | `▓▓▓░░░░░░░░░░░░░░░░░` **17.3%** | 151 / 871 |
| 31 · P2 | [EXO-RUST-036](SYSTEM_PLANS.md#sys-36) | Native Rust editor / backend UI glue | `░░░░░░░░░░░░░░░░░░░░` **0.0%** | 0 / 0 |
| 32 · P3 | [EXO-RUST-020](SYSTEM_PLANS.md#sys-20) | Foam / padding / trapunto | `▓▓▓▓▓░░░░░░░░░░░░░░░` **24.7%** | 141 / 570 |
| 33 · P3 | [EXO-RUST-017](SYSTEM_PLANS.md#sys-17) | Fabric visuals / textures / PBR | `▓▓▓░░░░░░░░░░░░░░░░░` **14.4%** | 242 / 1,682 |
| 34 · P3 | [EXO-RUST-019](SYSTEM_PLANS.md#sys-19) | Garment print graphics / embroidery | `░░░░░░░░░░░░░░░░░░░░` **0.0%** | 0 / 405 |
| 35 · P3 | [EXO-RUST-026](SYSTEM_PLANS.md#sys-26) | Production packages / factory orders | `░░░░░░░░░░░░░░░░░░░░` **0.0%** | 0 / 8,746 |
| 36 · P3 | [EXO-RUST-028](SYSTEM_PLANS.md#sys-28) | Cost / pricing / estimates | `▓▓▓▓░░░░░░░░░░░░░░░░` **21.6%** | 107 / 495 |
| 37 · P3 | [EXO-RUST-032](SYSTEM_PLANS.md#sys-32) | AI assistant / generation / automation | `░░░░░░░░░░░░░░░░░░░░` **0.0%** | 0 / 3,828 |
| 38 · P3 | [EXO-RUST-035](SYSTEM_PLANS.md#sys-35) | Diagnostics / performance / misc | `░░░░░░░░░░░░░░░░░░░░` **0.0%** | 0 / 221 |
| 39 · P3 | [EXO-RUST-038](SYSTEM_PLANS.md#sys-38) | Unclassified JS business logic | `░░░░░░░░░░░░░░░░░░░░` **0.0%** | 0 / 9,221 |
| 40 · P3 | [EXO-RUST-040](SYSTEM_PLANS.md#sys-40) | macOS native host / lifecycle | `░░░░░░░░░░░░░░░░░░░░` **0.0%** | 0 / 3,680 |
| 41 · P3 | [EXO-RUST-041](SYSTEM_PLANS.md#sys-41) | Other backend source | `░░░░░░░░░░░░░░░░░░░░` **0.0%** | 0 / 539 |

## Prior mapped backend source by phase

| Phase | Mapped lines | Rust lines | Rust code mix |
|---|---:|---:|---:|
| F0 Core contracts | 13,310 | 2,229 | 16.75% |
| F1 2D CAD | 20,376 | 1,553 | 7.62% |
| F2 Sewing and meshing | 5,493 | 512 | 9.32% |
| F3 Simulation and 3D | 31,302 | 1,439 | 4.60% |
| F4 Materials and assets | 8,136 | 383 | 4.71% |
| F5 Factory and exports | 38,243 | 753 | 1.97% |
| F6 Agents, tools and platform | 17,630 | 259 | 1.47% |
| F7 Rust-native UI | 3,680 | 0 | 0.00% |

## Separate current Git production-source audit

This second measurement has different inclusion rules. It includes presentation/source integrations absent from the legacy mapped backend, so the percentages **must not be averaged**. Upstream-derived ClothCraft Rust is kept separate.

| Language | EXO first-party production files | Physical lines | Share |
|---|---:|---:|---:|
| JavaScript / TypeScript | 1,269 | 184,118 | 71.23% |
| Rust | 99 | 24,046 | 9.30% |
| CSS | 133 | 19,936 | 7.71% |
| C / C++ | 181 | 15,997 | 6.19% |
| Python | 61 | 9,510 | 3.68% |
| Swift | 10 | 4,889 | 1.89% |

**EXO scoped source:** 1,753 tracked production files, 258,496 physical lines; 24,046 Rust lines (**9.30%**).

**Upstream-derived ClothCraft (separate):** 73 `.rs` files, 33,918 lines, 100% Rust within that **selected source directory**, not proof of EXO integration.

## Critical interpretation

- A Rust file may be compiled but unused by the installed EXO app; this audit does not know active-call percentages or feature completion.
- Legacy mapped system percentages come from the prior 41-system baseline; the current Git tracked source audit uses an independently declared set of roots/extensions.
- **Correct prioritization follows dependencies**, not the percentage. A 95% Rust shared core still needs source-ownership and interface verification; a 0% Rust exporter may depend on unfinished geometry.
- Source links, concrete first PR deliverables and acceptance tests: [SYSTEM_PLANS.md](SYSTEM_PLANS.md). For methodology and limitations: [METHODOLOGY.md](METHODOLOGY.md).
- To interactively filter/search, download [dashboard.html](dashboard.html) and open locally. GitHub code view may show its HTML source unless Pages hosting is separately enabled.
