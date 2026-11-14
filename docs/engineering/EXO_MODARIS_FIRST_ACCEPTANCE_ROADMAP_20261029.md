# EXO ClothCraft V2 — Modaris-first 2D engineering acceptance roadmap

**Date:** 2026-10-29. **Purpose:** measurable work order for the authorized recurring Modaris-first 2D engineering loop, followed by AccuMark depth, then Optitex manufacturing automation. This is a forward acceptance specification, **not** a claim of licensed Lectra interoperability or a released product. Existing user garments, installed EXO app, and factory approvals are unchanged.

## Objective and definition of completion

First complete a **professional connected 2D patternmaking subset**: edit source measurements/geometry; regenerate every affected graded piece and industrial marking; preserve stable identities; undo, redo, save, and reopen the exact committed garment; then produce dimensionally testable CUT/STITCH outputs. Full Modaris Expert equivalence is a separate, stronger target requiring a licensed reference session, verified command behavior and independent production evidence. An internal QA success cannot silently promote one target into the other.

The existing strict 79-function Modaris ledger remains **0/79 independently accepted** (14 internally verified subsets, five external acceptance needs, 60 open at the cited baseline). The fixed core grading test remains **27/30** until its original external G27/G29/G30 requirements actually pass. The later 2026-10-29 connected source Chromium test proves a particular six-size grading Save→real-pointer Undo→Redo→save/reopen path, but **not** this full specification or the installed macOS desktop path.

## Acceptance gates — all required for scoped release

| ID | Engineering gate | Required positive acceptance | Required failure / independence check |
| --- | --- | --- | --- |
| M2D-01 | Canonical garment authority | One source revision, piece ID, graded size ID and unit semantics from UI through native Rust, CUT, and exported artifact | A second disconnected JS/legacy project, swapped identity, stale source or cross-revision handoff must not be counted |
| M2D-02 | Authoritative measurement chart | Typed units and named formulas drive multiple dependent source points/panels, including curved descendants, across at least six named sizes | Cycles, invalid units, unknown names and inconsistent source graph reject with no mutation; independent saved chart after edit and Undo/Redo |
| M2D-03 | Linked derivative and geometric topology | Change a curved bodice source edge and regenerate a facing and companion piece, maintaining point/edge IDs, sewn references, marks and allowances | Unsupported sewn attachment, hole, self-intersection or orphan descendant rejects *atomically*, not by silently dropping source metadata |
| M2D-04 | Advanced operations | One dart transfer, pleat alteration, split/trace, unfold and one independently generated facing retain valid sewn/graded identity and editable histories | Topology mutation with unremappable attachments fails closed; source remains byte/structure-equivalent after rejection |
| M2D-05 | All-size native grading | Six distinct nonuniform point-rule sizes; show overlays, preserve curve control and physical CUT for each; add 24-size synthetic stress regression | Independent multi-panel curved metrology and arbitrary named size correspondence still required for external G27; reject changed or duplicate size identities |
| M2D-06 | Industrial seam engineering | Interactive walk/compare/true seam pairs with size-specific POM/ease limits; verified graded notches, grain, CUT/STITCH and allowance corner semantics | Bad notch direction, lost drill/fold, corner inversion, mismatched seam or invalid CUT blocks downstream release |
| M2D-07 | Durable complete history | Real pointer/keyboard BoardV2→Rust→Undo/Redo→Save→reopen, both normal and interrupted/resumed process, with exact graph/geometry/grade/mark identity | Fault-injected crash between project and journal changes must either recover correct matched generation or explicitly fail closed; never silently advertise lost history |
| M2D-08 | Physical-scale output | Graded A4/Letter tiles and vector/DXF include correct units, calibrated 100×100 mm ruler, distinct cut/stitch/notch identities and measured POM | Independently printed 1:1 X/Y 100 mm check and real third-party CAD import/re-export required; internal SVG/PDF scale alone does not approve G29 |
| M2D-09 | Industrial order invariants | Same authoritative source revision and all-size piece counts across manifest, marker, cutroom rolls, lay plan and available print/export | Invalid overlapping CUT, mixed lots/groups, forged source/quantities or changed material must fail with cuttingAuthorized=false |
| M2D-10 | Installed desktop acceptance | Exact signed packaged executable, matching source binary provenance, native macOS pointer/keyboard and full workflow across reopen; preserve real user garment unchanged | Candidate source tests or isolated development browser are insufficient; do not overwrite production app until separate safe acceptance |

**Independent external gates:** G27 curved multi-panel grade measurement and size correspondence; G29 import/edit/save/re-export in a licensed Modaris (and later AccuMark/Optitex) receiver with tolerance evidence; G30 measured physical plots, sewn samples, and factory/cutter approval. No automated run may set `factoryApproved` or `cuttingAuthorized` true based only on local unit/browser tests. Actual commercial software availability and physical equipment are external dependencies, not automatically solvable by coding.

## Reference garment sequence

1. **Six-size three-panel tee with curved sleeve and companion facing:** authoritative POM change, source curve reconstruction, grade rule, notch/seam association, physical CUT and full history roundtrip.
2. **Six-size hoodie (five or more panels):** graded hood, sleeve, body and cuff relationships; asymmetric size-specific alteration; one dart or fullness transformation; every dependent CUT/POM/notch refreshed.
3. **Complex reference corpus:** trousers with curved pocket/facing, darted dress with pleat and lining, and jacket with distinct material groups and construction marks.
4. **External receiving and paper witness:** compare the unchanged 100 mm ruler on both print axes, independent coordinates/POM/notations, re-export and physical sample results with named reviewer and accepted tolerances. A source-only fixture is not this step.

## Order of execution for every engineering iteration

1. Record live Git status, source SHA, available APFS space, active Rust/browser/build processes and worker file ownership. Preserve shared dirty work; no reset, bulk cleanup or user-project edits.
2. Choose one **not-yet-demonstrated** gate and reproduce the missing behavior or false-positive with a focused positive/negative fixture. Never increase a percent just because a UI route exists.
3. Implement a bounded actual source behavior change; prefer one shared authoritative path over another detached inspection-only interface. Run syntax, focused unit tests and one connected native/real UI test as resources allow; explain absent tests.
4. Record exact changed files, before/after behavior, rejected invalid case, source-vs-packaged coverage, regression result and the next highest-value gap in a dated report.
5. Independently audit acceptance; leave the gate open if the installed runtime or external physical proof has not passed. Only then advance the Modaris gate, next AccuMark command-depth work and finally Optitex end-to-end manufacturing.

## Planning ranges, not commitments

- **6–10 weeks:** focused 2D professional beta under sustained work and existing source foundations; not complete licensed equivalence.
- **3–6 months:** competitive daily-use Modaris-like 2D drafting, grading and connected pattern subset with a dedicated 3–5-engineer team and strong automated acceptance.
- **12–24+ months:** extensive Modaris Expert industrial function breadth and independent vendor/physical validation, subject to access, staff, hardware, rework and actual receiving results.

The supported recurring task cadence is at most **hourly**. Hourly safe progress/checkpoints cannot be described as literally nonstop compilation, guaranteed workstation access, or the equivalent of 3–5 full-time staff. If another heavy process owns the source or storage is low, the iteration must downgrade to read-only QA and preserve data.

## Evidence anchors

- `docs/reports/EXO_MODARIS_14_STAGE_LEDGER_20261029_RUN34.md`
- `docs/reports/EXO_2D_NATIVE_GRADING_POINTER_ACCEPTANCE_20261029.md`
- `docs/reports/EXO_NATIVE_2D_CUTROOM_DEEP_ENGINEERING_RUN45_20261029.md`
- `docs/research/EXO_VS_MODARIS_2D_WORKSPACE_FULL_FEATURE_COMPARISON_2026-10-27.md`
- `docs/reports/EXO_RUN48_DEEP_ENGINEERING_20261029.md`
