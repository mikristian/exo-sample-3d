# EXO Rust migration — dependency-ranked task board

> **Planning board, not a live GitHub assignment system.** Status is proposed/unclaimed until a maintained issue records acceptance. Start small PRs. Do not claim upstream ClothCraft ownership from this EXO-only board.

**Snapshot:** EXO Git `985bc9a8e5031a9fa02666a44390802aff8e04ce`; 41 legacy mapped systems; 5.16% Rust *source lines in that mapped backend scope*. No valid repository-wide **migration completion %** is known.

| Order | Priority | Task | System | Rust code / mapped LOC | Dependencies |
|---:|:---:|---|---|---:|---|
| 1 | **P0** | [EXO-RUST-037](SYSTEM_PLANS.md#sys-37) | Native Rust engine shared core | **94.9%** (447/471) | — |
| 2 | **P0** | [EXO-RUST-001](SYSTEM_PLANS.md#sys-01) | Project model / source-of-truth | **1.6%** (54/3,277) | `37` |
| 3 | **P0** | [EXO-RUST-033](SYSTEM_PLANS.md#sys-33) | API / processes / transport | **23.0%** (1,630/7,093) | `01`, `37` |
| 4 | **P0** | [EXO-RUST-029](SYSTEM_PLANS.md#sys-29) | Persistence / undo / history / restore | **4.0%** (98/2,469) | `01`, `33` |
| 5 | **P1** | [EXO-RUST-003](SYSTEM_PLANS.md#sys-03) | Curves, freehand and geometry | **30.0%** (770/2,567) | `01`, `33`, `37` |
| 6 | **P1** | [EXO-RUST-005](SYSTEM_PLANS.md#sys-05) | Parametric references / formulas | **0.0%** (0/1,493) | `01`, `03`, `29` |
| 7 | **P1** | [EXO-RUST-007](SYSTEM_PLANS.md#sys-07) | Measurements / POM / body charts | **5.0%** (93/1,865) | `01`, `05` |
| 8 | **P1** | [EXO-RUST-002](SYSTEM_PLANS.md#sys-02) | Drafting primitives and snapping | **4.8%** (134/2,815) | `01`, `03`, `33` |
| 9 | **P1** | [EXO-RUST-004](SYSTEM_PLANS.md#sys-04) | Topology / split / unfold / mirror | **14.6%** (154/1,058) | `01`, `03`, `29` |
| 10 | **P1** | [EXO-RUST-006](SYSTEM_PLANS.md#sys-06) | Pattern grading / size runs | **3.5%** (260/7,408) | `01`, `03`, `05`, `07`, `29` |
| 11 | **P1** | [EXO-RUST-010](SYSTEM_PLANS.md#sys-10) | Allowance / notch / cutline | **4.5%** (142/3,170) | `01`, `03`, `04`, `06` |
| 12 | **P1** | [EXO-RUST-008](SYSTEM_PLANS.md#sys-08) | Sewing / seam matching | **9.0%** (316/3,508) | `01`, `04`, `06`, `10` |
| 13 | **P1** | [EXO-RUST-011](SYSTEM_PLANS.md#sys-11) | Cloth mesh / tessellation | **16.9%** (196/1,161) | `01`, `08`, `10` |
| 14 | **P1** | [EXO-RUST-016](SYSTEM_PLANS.md#sys-16) | Fabric mechanics / materials | **8.6%** (262/3,052) | `01`, `11` |
| 15 | **P1** | [EXO-RUST-023](SYSTEM_PLANS.md#sys-23) | DXF / CAD interop | **0.3%** (33/11,648) | `01`, `03`, `06`, `10` |
| 16 | **P1** | [EXO-RUST-015](SYSTEM_PLANS.md#sys-15) | Avatar / pose / animation | **0.0%** (0/794) | `01` |
| 17 | **P2** | [EXO-RUST-012](SYSTEM_PLANS.md#sys-12) | Cloth physics and solver | **3.2%** (505/15,839) | `11`, `16`, `33` |
| 18 | **P2** | [EXO-RUST-013](SYSTEM_PLANS.md#sys-13) | Collision / contact / penetration | **9.4%** (487/5,157) | `11`, `12`, `15` |
| 19 | **P2** | [EXO-RUST-014](SYSTEM_PLANS.md#sys-14) | Garment fit / stage / drape | **2.9%** (185/6,460) | `01`, `11`, `12`, `13`, `15` |
| 20 | **P2** | [EXO-RUST-022](SYSTEM_PLANS.md#sys-22) | Marker layout / nesting / yield | **5.2%** (226/4,352) | `06`, `10`, `23` |
| 21 | **P2** | [EXO-RUST-024](SYSTEM_PLANS.md#sys-24) | SVG / PDF / physical plot | **2.6%** (39/1,473) | `10`, `22`, `23` |
| 22 | **P2** | [EXO-RUST-025](SYSTEM_PLANS.md#sys-25) | Factory preflight / measurement QA | **3.6%** (130/3,635) | `01`, `06`, `08`, `10`, `23`, `24` |
| 23 | **P2** | [EXO-RUST-018](SYSTEM_PLANS.md#sys-18) | Hardware / fastener / trims | **0.0%** (0/877) | `01`, `08`, `14` |
| 24 | **P2** | [EXO-RUST-027](SYSTEM_PLANS.md#sys-27) | Techpacks / BOM / specification | **2.8%** (218/7,894) | `07`, `18`, `22` |
| 25 | **P2** | [EXO-RUST-009](SYSTEM_PLANS.md#sys-09) | Darts / pleats / facings | **0.0%** (0/824) | `03`, `04`, `05`, `08` |
| 26 | **P2** | [EXO-RUST-021](SYSTEM_PLANS.md#sys-21) | 3D export and scene assets | **0.0%** (0/351) | `01`, `11` |
| 27 | **P2** | [EXO-RUST-030](SYSTEM_PLANS.md#sys-30) | Libraries / templates / presets | **0.0%** (0/4,251) | `01`, `07`, `33` |
| 28 | **P2** | [EXO-RUST-039](SYSTEM_PLANS.md#sys-39) | Workspace commands / tools / preferences | **4.9%** (108/2,208) | `29`, `33`, `37` |
| 29 | **P2** | [EXO-RUST-031](SYSTEM_PLANS.md#sys-31) | Image digitizing / vision / references | **0.0%** (0/742) | `02`, `03`, `33` |
| 30 | **P2** | [EXO-RUST-034](SYSTEM_PLANS.md#sys-34) | Collaboration / security / sync | **17.3%** (151/871) | `01`, `29`, `33` |
| 31 | **P2** | [EXO-RUST-036](SYSTEM_PLANS.md#sys-36) | Native Rust editor / backend UI glue | **0.0%** (0/0) | `01`, `02`, `29`, `33`, `37` |
| 32 | **P3** | [EXO-RUST-020](SYSTEM_PLANS.md#sys-20) | Foam / padding / trapunto | **24.7%** (141/570) | `08`, `11`, `12`, `16` |
| 33 | **P3** | [EXO-RUST-017](SYSTEM_PLANS.md#sys-17) | Fabric visuals / textures / PBR | **14.4%** (242/1,682) | `16`, `21`, `36` |
| 34 | **P3** | [EXO-RUST-019](SYSTEM_PLANS.md#sys-19) | Garment print graphics / embroidery | **0.0%** (0/405) | `01`, `11`, `17`, `27` |
| 35 | **P3** | [EXO-RUST-026](SYSTEM_PLANS.md#sys-26) | Production packages / factory orders | **0.0%** (0/8,746) | `22`, `23`, `24`, `25`, `27` |
| 36 | **P3** | [EXO-RUST-028](SYSTEM_PLANS.md#sys-28) | Cost / pricing / estimates | **21.6%** (107/495) | `16`, `22`, `27` |
| 37 | **P3** | [EXO-RUST-032](SYSTEM_PLANS.md#sys-32) | AI assistant / generation / automation | **0.0%** (0/3,828) | `01`, `29`, `33`, `25` |
| 38 | **P3** | [EXO-RUST-035](SYSTEM_PLANS.md#sys-35) | Diagnostics / performance / misc | **0.0%** (0/221) | `12`, `25`, `33` |
| 39 | **P3** | [EXO-RUST-038](SYSTEM_PLANS.md#sys-38) | Unclassified JS business logic | **0.0%** (0/9,221) | `01`, `33`, `39` |
| 40 | **P3** | [EXO-RUST-040](SYSTEM_PLANS.md#sys-40) | macOS native host / lifecycle | **0.0%** (0/3,680) | `33`, `36`, `37` |
| 41 | **P3** | [EXO-RUST-041](SYSTEM_PLANS.md#sys-41) | Other backend source | **0.0%** (0/539) | `27`, `33`, `38` |

## Working rules

- **P0:** pin upstream and establish Rust document/IPC/edit authority before rewriting features. **P1:** prove a complete graded tee workflow and DXF interchange. **P2:** simulation, materials and manufacturing validation. **P3:** secondary features, AI, collaboration and optional Rust-native UI replacement.
- Read [SYSTEM_PLANS.md](SYSTEM_PLANS.md) for each system’s current code, precise first PR slice, upstream attachment, dependencies and positive/negative acceptance requirements.
- The board order is *dependency-aware*: all listed parents appear earlier. A proposed priority does not make a task eligible for implementation if its dependency tests have not passed.
- For **upstream ClothCraft work**, read its [COORDINATION.md](https://github.com/erythrofr/ClothCraft/blob/main/COORDINATION.md) and use its actual registered issue: post `/coord claim <agent-id>` and wait for **accepted** coordinator assignment *before editing upstream files*.
- For **EXO work**, create a narrowly scoped issue/PR referencing an ID here; include a source baseline SHA, allowed files, fixtures, tests and a handoff. This Markdown file does not reserve GitHub issues.
- Keep the running personal app, project files, CLO3D private assets, credentials and local machine paths out of all PRs and evidence packs.
- Code % is **not** an amount complete. Move status from proposed only on reviewable tests and a merged, source-pinned implementation. Keep legacy JS/C++ parity harnesses until removal is independently verified.

## Release/acceptance gates

1. Clean ClothCraft upstream baseline + EXO adapter tests; no unreviewed patches to upstream checkout.
2. Typed Rust document/RPC, explicit SI/mm conversions, stable IDs and crash-safe undo/reopen.
3. A traced six-size tee edit → grade → seam → mesh → solver → DXF → save/reopen in real desktop UI.
4. Validated native-service/WASM hashes, dependency licenses, no private media/home paths, signed isolated bundle and clean-Mac rollback.
5. Separate external CAD/printer and measured cloth-fit acceptance. Compiler pass and screenshot alone are not industrial certification.

Read [METHODOLOGY.md](METHODOLOGY.md) before interpreting percentages.
