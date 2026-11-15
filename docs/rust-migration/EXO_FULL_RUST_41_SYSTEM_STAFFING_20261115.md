# EXO ClothCraft Studio V2 — 41-system FULL Rust conversion staffing and migration plan

**Source snapshot verified:** [EXO public main @ f7d007d2](https://github.com/mikristian/exo-sample-3d/tree/f7d007d2cbddad179f4272437af7e29189e15ee9) (2026-11-15). This is an evidence-informed **estimate**, not a staffing commitment, feature-completion percentage or factory release authorization.

## What “fully Rust” means

**Target A (recommended first):** 100% of authoritative project math, CAD, grade, sewn mesh, physics, factory rules, command, transactions and security run through source-pinned Rust. The app can retain React UI and small macOS Swift entry points while the Rust engine is canonical.

**Target B (this document, full-native):** Replace the first-party React/JavaScript business logic and authoring UI, Node control plane, C++ production engines, and main Swift/WKWebView app shell with Rust-native egui/wgpu/typed IPC/packaging. It still legitimately uses OS SDKs, graphics shader code, libraries, external CAD receivers and outside AI models. “100% Rust” cannot literally mean all dependencies, platform APIs, drivers, assets or cloud inference are written in Rust.

**Measured baseline caution:** GitHub’s 41-system inventory is based on the older mapped backend: **7,128 Rust lines of 138,170 mapped lines = 5.16%**. The broader public first-party source mix in the audit was **24,046 of 258,496 lines = 9.30%** at older revision `985bc9a8`; the current commit adds newer integration. **Neither number measures functionality migrated or production readiness.**

## Staffing interpretation

- The “engineers in system” field is the number of people **concurrently assigned while the system is active**, not 41 independent teams. Reuse the same experts across systems. A person-month is one FTE engineer for one month including scoped testing.
- The month intervals are non-contractual ranges based on code dependencies, numerical difficulty, cross-platform porting and manufacturing validation. Estimates do not assume a 1:1 rewrite of existing files.
- The full 41-system work packages total **493–866 engineer-months (41.1–72.2 engineer-years)** before a separately managed 15–20% program integration/risk reserve. Conversion remains critically dependent on real garment seam closure, cloth stability, factory receiver verification and UI behavior.
- **Staffing recommendation:** ~**24–30 people at peak** across engineering, release/QA and apparel specialists; a 30–42 month funded program is a reasonable planning range but not guaranteed. A smaller 12–16-person backend-only Rust team may be viable for 20–32 months by keeping React and Swift.


---

## AI-agent-inclusive 30-day conversion scenario (2026-11-15 addendum)

**Question addressed:** What if the goal is *one month* and AI agents are explicitly included, and the scope is **only the existing active EXO functionality** converted to Rust—**not** a full new CLO3D/Optitex competitor, new features or repairs to pre-existing physical inaccuracies?

**Estimate, not a commitment:** For a high-risk 30-day *attempt* at an all-Rust-native active-feature port, **40–70 experienced human engineers plus roughly 100–200 distinct AI coding-agent assignments/worker identities managed across the month**, using **20–40 concurrent AI execution lanes where infrastructure and review capacity permit**. A representative sprint organization has **53 human engineers and 128 scoped AI agent assignments**. It is not responsible to promise bug-free parity within 30 days with any headcount. Agents are productivity helpers, **not equivalent to 128 additional human FTEs**, and 128 need not run simultaneously. Connector limits and budgets must be verified; this is not a claim that Chat On Steroids has that many concurrent slots available.

### Three different 30-day objectives

| Target at the end of 30 calendar days | Humans | AI coding-agent assignments | Realistic interpretation |
|---|---:|---:|---|
| **Small, coherent Rust-core vertical slice** (Rust garment document, six-size grade and sewing contracts, durable editing, original React UI retained) | 8–12 | 20–40 | Achievable sprint goal **if major schema decisions and test fixtures are ready**; not every active feature and physical fit remains a known blocker. |
| **Wide first-pass Rust backend port** while keeping existing React/Swift UI, existing errors allowed | 15–25 | 40–90 | Aggressive trial. Modules may compile and tests may run, but unported edge cases, native IPC, source-of-truth duplication and integration remain. **Not a guaranteed fully converted, drop-in application**. |
| **Full Rust-native desktop with parity for existing active features** (including React/Swift UI replacement, Node/C++ control engine retirement) | **40–70** | **100–200** | Extraordinary 30-day program with highly experienced teams and large automation infrastructure; **likely to miss comprehensive parity despite large staffing**. Do not describe code generation as validated conversion. |

### Representative full-native 30-day sprint staffing

| Workstream | Human engineers | Distinct scoped AI agent assignments over the month | Primary deliverable |
|---|---:|---:|---|
| Canonical Rust document, migrations and ABI | 6 | 10 | One authoritative revisioned garment, stable size/seam/edge identities and versioned errors |
| 2D pattern CAD, measurements and grading | 9 | 24 | Port active drafting/curves/formulas/POM/grading tools, compare every command against V2 |
| Sewing, 3D mesh and garment data | 7 | 17 | Sewing interval matching, edit-to-mesh remap, native six-size garment persist/restore |
| Existing Rust cloth solver and materials integration | 6 | 16 | Wire existing physics and fabric settings into native Rust app, retain known limitations |
| DXF, markers, techpacks and other current exports | 7 | 16 | Port existing processing paths and compare output bytes/dimensions; no new factory approval claim |
| Native Rust editor and viewport replacement | 10 | 25 | egui/wgpu view, inspectors, 2D commands and 3D viewport matching active V2 interactions |
| App shell, platform APIs, packaging and process boundary | 3 | 8 | macOS dialogs, app lifecycle, Rust process launch, build distribution, rollback |
| QA, test automation, deterministic replay and integration | 5 | 12 | Replay V2 active-feature fixtures against Rust V3, reject stale files, report failures visibly |
| **Total** | **53** | **128** | **Illustrative capacity, not verified output or guaranteed full parity** |

**Important scheduling rule:** Those AI assignments are *scoped agent jobs* (for example, test conversion, narrow Rust port, behavior comparison, documentation). Aim for only **20–40 independent parallel agent sessions maximum** until CI capacity, token cost, code-review throughput and integration throughput have been demonstrated. More agents can make progress *slower* when they edit overlapping files or generate unreviewed code.

### Four weeks with reality-based gates

1. **Days 1–7:** Freeze source SHA, inventory *active reachable* UI/engine flows (exclude tests/dead experiments), pin ClothCraft Rust and Rust V3, create one native project schema and complete parity tests for save/reopen, six-size pattern identity and original edit history. Gate: Rust-authoritative document, no silent field drops.
2. **Days 8–14:** Parallelize 2D CAD, grading, sewing, material records and DXF paths under fixed Rust command contracts, while a separate Rust UI squad recreates the primary editor views. Gate: first real V2-to-V3 edit command from app UI and unchanged document/geometry across cold restart.
3. **Days 15–21:** Integrate 3D meshing, existing solver, markers, techpacks, asset tools, keyboard behavior and industrial exports. Gate: executable source-built Mac app can replay a selection of real V2 active operations; module test/build failures are counted, not hidden.
4. **Days 22–30:** Harden native UI, Undo/Redo and mixed editing, compare outputs, fix crashes/data loss and release only a separate preview build with explicit missing-function list and rollback. Gate: no false claim of complete parity if V2 commands are missing or physical solver outcomes fail.

**Hard constraints:** 30 days cannot remove inherent dependencies (document → curves/seams/grades → mesh → 3D → export), 207+ current JSX/TSX UI module paths and many JS/C++/Swift functions require behavioral reconciliation, and the latest actual four-piece tee QA still fails physical seam closure and strain. Porting must preserve those current limitations *honestly*; it cannot claim production accuracy simply because the application is Rust-based.

**Staffing extrapolation basis:** Earlier AI-assisted normal-speed scenario for current active functionality was **6–8 humans with 20–30 AI agents over roughly 6–9 months**. Compressing equivalent work to one month yields approximately **36–72 human engineer-months and 120–270 AI-agent task-months before coordination losses**, which helps explain the *scale* of the aggressive staffing proposal. This is not a linear productivity model or an externally validated throughput measurement. Heavy integration/review, Rust UI and cross-module dependency chains make 30-day equivalence uncertain even at the higher extreme.

**Recommended decision:** Do not authorize a claim that “all current EXO is now Rust” based on language shares, compiled binaries or a first-month code port. Make the first month an **evaluated Rust V3 parity sprint**. Report each existing user-visible function as native Rust verified / wrapped legacy / missing / failed. Only retire the old app after its required functions and user projects are proven compatible. A 3–6 month milestone path for a narrower Rust backend, or a 6–12 month track for a thoroughly tested active-function Rust-native app, remains more credible than a guaranteed 30-day full conversion.

## Complete system-by-system estimates

| Rank | System | Priority | Concurrent engineers | Engineer-months | Specialists | What to port + exit test |
|---:|---|:---:|---:|---:|---|---|
| 1 | [EXO-RUST-037](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-37): Native Rust engine shared core | P0 | **2–3** | 5–8 | Rust platform and build | Pin reviewed ClothCraft upstream, factor EXO Rust adapters; prove both native and WASM with reproducible provenance |
| 2 | [EXO-RUST-001](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-1): Project model / source-of-truth | P0 | **3–4** | 12–18 | Rust architecture and document schema | Canonical versioned garment/size/seam IDs; one Rust mutation owner; legacy migrations and atomic negative tests |
| 3 | [EXO-RUST-033](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-33): API / processes / transport | P0 | **2–3** | 8–14 | Rust backend and security | Typed authenticated Rust IPC/RPC commands, process supervision and errors; retire Node decision making |
| 4 | [EXO-RUST-029](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-29): Persistence / undo / history / restore | P0 | **3–4** | 12–20 | Rust persistence and reliability | One transactional project/grade/Undo journal, crash recovery, cold restart, rollback and exact revision CAS |
| 5 | [EXO-RUST-003](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-3): Curves, freehand and geometry | P1 | **2–3** | 9–15 | Geometry/CAD engineers | Robust 2D Bézier/free curves, arclength and tolerances; match existing output and malformed geometry rejection |
| 6 | [EXO-RUST-005](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-5): Parametric references / formulas | P1 | **2–3** | 7–12 | Rust expression graph engineers | Typed dimensional measurement formulas, dependency tracking and cycle rejection; regenerate dependent pattern geometry |
| 7 | [EXO-RUST-007](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-7): Measurements / POM / body charts | P1 | **2–3** | 6–10 | Pattern engineer and Rust CAD | Body charts, size-specific POM and geometric measuring; validated targets and factory tolerances |
| 8 | [EXO-RUST-002](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-2): Drafting primitives and snapping | P1 | **2–3** | 9–15 | CAD tools and interaction Rust | Snap, pick, point and drawing commands; 2D client becomes Rust document command consumer |
| 9 | [EXO-RUST-004](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-4): Topology / split / unfold / mirror | P1 | **2–3** | 8–13 | Computational geometry | Split/unfold/mirror and orientation-safe topology with stable seam/notch/vertex IDs and undo |
| 10 | [EXO-RUST-006](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-6): Pattern grading / size runs | P1 | **3–4** | 13–22 | Industrial grading and Rust CAD | Size-rule graph and six-/multi-size grades, seam/notch propagation, POM and size persistence without duplicate authorities |
| 11 | [EXO-RUST-010](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-10): Allowance / notch / cutline | P1 | **2–3** | 9–15 | Geometry and industrial patterns | Offset-cut paths, variable seam allowances, single/double notches and matched sewn correspondence; plot/cutter checks |
| 12 | [EXO-RUST-008](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-8): Sewing / seam matching | P1 | **3–4** | 12–20 | Garment seam and simulation Rust | Seam stitch maps, orientation, ease, arclength and authored notches; closure tolerances in physics |
| 13 | [EXO-RUST-011](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-11): Cloth mesh / tessellation | P1 | **2–3** | 10–17 | Mesh and numerical geometry | Deterministic 2D triangulation, UV/panel provenance and exact mapping between editable edges and 3D mesh |
| 14 | [EXO-RUST-016](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-16): Fabric mechanics / materials | P1 | **3–4** | 12–20 | Material modeling/numerics | Anisotropic stretch, bending, thickness, friction, shrink and measured-fabric calibration; reproducible stress |
| 15 | [EXO-RUST-023](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-23): DXF / CAD interop | P1 | **3–5** | 16–28 | Industrial CAD import/export | AAMA/ASTM/DXF read/write with size/pattern IDs and robust roundtrip; independent CAD receiver/cutter sign-off |
| 16 | [EXO-RUST-015](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-15): Avatar / pose / animation | P1 | **2–3** | 9–16 | 3D rigging, geometry and Rust | Avatar mesh/measurements, poses, skeleton and body collision, preserving fit landmark/size semantics |
| 17 | [EXO-RUST-012](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-12): Cloth physics and solver | P2 | **4–6** | 32–58 | Numerical solver, Rust, GPU | Rust VBD/OGC solver parity, stable convergence, CPU and wgpu/Metal kernels, reproducible physics metrics |
| 18 | [EXO-RUST-013](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-13): Collision / contact / penetration | P2 | **4–6** | 28–50 | Collision detection, geometry, GPU | Body/self contact, broad/narrow phase and CCD, penetration-free stepping, rejection/recovery of invalid states |
| 19 | [EXO-RUST-014](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-14): Garment fit / stage / drape | P2 | **3–5** | 24–42 | 3D garment fitting and validation | Physically close real assembled seams, fit varied bodies/materials and multi-frame drape without extreme stretch |
| 20 | [EXO-RUST-022](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-22): Marker layout / nesting / yield | P2 | **3–4** | 14–24 | Nesting optimization and factory CAD | Grain/nap, fabric-width, mirrored part quantities and multi-size markers; yield and exact physical cut instances |
| 21 | [EXO-RUST-024](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-24): SVG / PDF / physical plot | P2 | **2–3** | 6–11 | Rust graphics/printing | Metric SVG/PDF layers and 1:1 plot scale with notch/grain/calibration ruler verification |
| 22 | [EXO-RUST-025](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-25): Factory preflight / measurement QA | P2 | **2–4** | 12–21 | Manufacturing QA and Rust testing | Fail-closed dimensional/sewing/material/DXF release gates, sample/receiver records and acceptance manifest |
| 23 | [EXO-RUST-018](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-18): Hardware / fastener / trims | P2 | **2–3** | 6–11 | Garment construction and assets | Physical fastener/hardware/trims anchors and geometry, reversible editing, specification quantities |
| 24 | [EXO-RUST-027](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-27): Techpacks / BOM / specification | P2 | **2–4** | 11–20 | Garment production data and Rust | Canonical multi-size techpacks, BOM, assembly notes and POM against same garment revision as DXF |
| 25 | [EXO-RUST-009](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-9): Darts / pleats / facings | P2 | **2–3** | 10–18 | Pattern topology/construction | Native darts/pleats/facings/tucks with reversible edge identity, grading and sewing integration |
| 26 | [EXO-RUST-021](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-21): 3D export and scene assets | P2 | **2–3** | 7–12 | 3D scene/interchange | Rust glTF/OBJ scene export with stable fabric, mesh, avatar and texture identities |
| 27 | [EXO-RUST-030](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-30): Libraries / templates / presets | P2 | **2–3** | 7–12 | Rust data migration/presets | Versioned pattern/fabric/avatar libraries; metadata, licensing, import/export and migrations |
| 28 | [EXO-RUST-039](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-39): Workspace commands / tools / preferences | P2 | **2–3** | 8–14 | Rust commands and editor tooling | Typed tools, workspaces, selection, settings and preferences; deterministic state/undo and schema migration |
| 29 | [EXO-RUST-031](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-31): Image digitizing / vision / references | P2 | **2–3** | 9–17 | Computer vision and CAD | Digitize scanned paper/image patterns into editable Rust geometry with scaling and quality review |
| 30 | [EXO-RUST-034](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-34): Collaboration / security / sync | P2 | **2–4** | 12–22 | Network/security and Rust | Optimistic revision-aware collaboration, permissions, secure offline sync and deterministic conflict rejection |
| 31 | [EXO-RUST-036](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-36): Native Rust editor / backend UI glue | P2 | **5–8** | 48–85 | Rust egui/wgpu desktop UI | Replace React 2D/3D authoring and inspector with Rust-native UI, keyboard/accessibility parity and golden screenshots |
| 32 | [EXO-RUST-020](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-20): Foam / padding / trapunto | P3 | **2–3** | 10–18 | 3D padding mechanics and Rust | Parametric foam/trapunto loft, layer thickness and compression across grades, seams and CUT outputs |
| 33 | [EXO-RUST-017](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-17): Fabric visuals / textures / PBR | P3 | **2–4** | 11–20 | GPU shaders, color and Rust | Typed PBR textures/materials, UV/color-space management and wgpu rendering pixel parity |
| 34 | [EXO-RUST-019](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-19): Garment print graphics / embroidery | P3 | **2–3** | 9–16 | Graphics and embroidery/CAD | Source-linked placement, vector/art asset provenance and graded print/embroidery handoff |
| 35 | [EXO-RUST-026](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-26): Production packages / factory orders | P3 | **2–4** | 13–23 | Factory systems and Rust | Revision-pinned manufacturing packages, order quantities, markers, checksums and signed approved release state |
| 36 | [EXO-RUST-028](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-28): Cost / pricing / estimates | P3 | **1–2** | 4–8 | Cost/yield model engineers | Rust costing rules from actual marker yield, BOM, SKUs and supplier price inputs; audit totals |
| 37 | [EXO-RUST-032](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-32): AI assistant / generation / automation | P3 | **2–4** | 13–25 | AI tool safety and Rust integration | Move AI tool schema, command validation and orchestration to Rust; external inference remains API/model |
| 38 | [EXO-RUST-035](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-35): Diagnostics / performance / misc | P3 | **2–3** | 6–11 | Performance and diagnostics | Rust numerical diagnostics, structured tracing/provenance and reproducible profiles for failed and passed quality gates |
| 39 | [EXO-RUST-038](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-38): Unclassified JS business logic | P3 | **3–5** | 14–26 | Rust porting and source archaeology | Classify every unmapped JS business module; port authoritative logic and delete duplicated authority only with tests |
| 40 | [EXO-RUST-040](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-40): macOS native host / lifecycle | P3 | **3–5** | 17–30 | macOS Rust host and release | Replace Swift/WKWebView shell via Rust app framework and Apple FFI; sign/notarize/recover app bundles |
| 41 | [EXO-RUST-041](https://github.com/mikristian/exo-sample-3d/blob/f7d007d2cbddad179f4272437af7e29189e15ee9/docs/rust-migration/SYSTEM_PLANS.md#sys-41): Other backend source | P3 | **1–2** | 5–9 | Rust backend/CLI | Retire/migrate miscellaneous C++/Node/Python runtime command logic, keep external tool adapters explicit |

## Estimated work by audit priority

| Priority | Systems | Engineer-months | Why |
|---|---:|---:|---|
| P0 | 4 | 37–60 | Single Rust garment document, typed IPC and crash-safe history; work needed before downstream authoritative migration. |
| P1 | 12 | 120–203 | Correct 2D CAD, graded geometry, allowance, sewing and real industrial DXF interfaces. |
| P2 | 15 | 234–417 | High-risk collision/cloth solver, physical fitting, markers, factory QA, security, 3D assets and Rust-native editor. |
| P3 | 10 | 102–186 | Advanced materials/AI/costing/packaging, residual JS modules and replacement macOS native shell. |
| **Total** | **41** | **493–866** | **Not 493–866 calendar months** |

## Recommended team that can actually execute the work

| Discipline | Peak team slots | Primary systems |
|---|---:|---|
| Technical lead / Rust architect | 1 | 037, 001, whole architecture |
| Rust schema, APIs, history and security | 4 | 001, 033, 029, 034, 039 |
| CAD topology, curves, grading and sewing | 4 | 002–011, 009 |
| Cloth numerical solver, GPU and collision | 4 | 011–016 |
| Industrial CAD/DXF, markers and manufacturing data | 3 | 010, 022–028 |
| Native Rust UI, graphics and macOS app | 5 | 017, 021, 036, 040 |
| AI, vision, other integrations and libraries | 2 | 030–032, 038, 041 |
| QA, reliability, performance and release | 3 | All, especially 012, 013, 023–029 |
| Apparel patternmaking, fit and factory validation specialists | 2 | Sample construction, graded POM, external receiver and physical approval |
| **Representative peak team** | **28 people** | **26 technical/release people + 2 apparel specialists** |

## Four waves with dependency gates (not an unqualified 41-project parallel rewrite)

**Wave 0 — architecture (approx months 0–6):** six–nine engineers prove one Rust canonical model, typed commands, document history and source-pinned ClothCraft. Deliver an EXO project that retains IDs through Rust edit, save, crash and cold reopen. Every old JS/C++ backend call has an explicit Rust command mapping and compatibility test.

**Wave 1 — complete engineering garment (approx months 4–15):** ramp to 14–22 people. Migrate drafting, measurement graphs, six-size grading, edge offsets, sewing, meshing and independent AAMA/ASTM DXF. One physically manufactured, measured six-size tee is the milestone. Existing 2026-11-15 engineering tee smoke is a baseline, not fit approval.

**Wave 2 — accurate physical solver + factory chain (approx months 9–30):** 22–30 people across specialized squads. Rust CPU/GPU solver, OGC/CCD/self and body contacts, real seam closure, fabric lab calibration, plot/cutter tests and factory package acceptance. Iterate until all sizes pass multi-frame stress, stability, pattern-to-cut and sewn sample tests.

**Wave 3 — full Rust-native desktop + advanced systems (approx months 18–42):** Rust egui/wgpu editor, material/PBR tools, print/foam/AI, C++/Node replacement, macOS Rust host, packaging, accessibility and external certification. No deleting legacy code until parity and reversible rollout exist. All waves overlap once predecessors are stable.

## Non-negotiable definition of done for every system

1. Actual app or CLI directly calls the source-pinned Rust implementation. A Rust source file existing by itself does not count. All JS/C++/Swift computational authority in that scope is removed or explicitly proved UI/FFI-only.
2. Positive parity test on golden garment and real six-size tee, with negative malformed/stale input rejection, measurement units and stable IDs. Tests cover desktop native and WASM only when relevant.
3. Rust command mutation is transactional; Undo/Redo and cold restart exactly restore the garment, sizes, seam/notch IDs and material records. Crash-injection tests protect last good project.
4. Physics systems additionally need multi-frame drape convergence and measured seam gap, strain, contact, CPU/GPU repeatability, physical fabric/fit data and no body/self penetration.
5. Factory systems additionally require independent CAD receiving and size-by-size physical cutter/plot verification, physical sewn sample/wash testing, accurate BOM/POM and manufacturing signoff.
6. New Rust desktop UI additionally requires complete view/tool parity, keyboard and mouse editing, native dialogs, accessibility, signing/notarization, macOS cold install and safe rollback.

## Source pointers

- [41-system migration plan](https://github.com/mikristian/exo-sample-3d/blob/main/docs/rust-migration/SYSTEM_PLANS.md)
- [Mapped code dashboard](https://github.com/mikristian/exo-sample-3d/blob/main/docs/rust-migration/CODE_DASHBOARD.md)
- [Dependency-ranked task board](https://github.com/mikristian/exo-sample-3d/blob/main/docs/rust-migration/TASK_BOARD.md)
- [Current real six-size tee QA (physical fit currently FAIL)](https://github.com/mikristian/exo-sample-3d/blob/main/docs/reports/EXO_FOUNDATION_TEE_SIX_SIZE_E2E_QA_20261115.md)

**Private source, installed macOS app, dirty Git branch and personal garments were not modified.**
