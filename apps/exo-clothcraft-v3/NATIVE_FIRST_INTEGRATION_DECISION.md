# EXO ClothCraft V3: build on the current ClothCraft native editor

**Decision (2026-11-03):** Use ClothCraft's **`cloth-fit` / `src/atelier.rs` editor** as the long-term EXO V3 native-Rust desktop foundation. Treat the standalone `apps/exo-clothcraft-v3` application as a proven small Rust authoring/2D+3D/sewing prototype and a source of regression tests, **not** a second production editor to maintain indefinitely.

## Verified current upstream baseline (November 3, 2026)

- **Repository:** `https://github.com/erythrofr/ClothCraft`
- **Official main commit, verified again after the build:** `5a7400f0bea90ca8ab0d289efe204ed18a681ccc` (2026-11-02 16:08:46 +0100), *Propose measurement draft document integration scope (#236)*.
- **Clean local source:** `research/oss/clothcraft-latest-20261103`, created as a detached worktree. Do not turn it into a dirty feature tree; fork work onto a dedicated EXO integration branch.
- **Fresh native macOS application:** `~/Applications/ClothCraft Upstream Latest.app`. Built using Rust `cargo build --locked --bin cloth-fit`; opened and verified running. The app bundle stores `Resources/UPSTREAM_COMMIT.txt` so the code provenance is unambiguous.
- **Separate application workspace:** `~/Library/Application Support/ClothCraft Upstream Latest/Workspace`. It does not read, overwrite or replace the earlier `ClothCraft.app`, EXO V2, or EXO V3.
- **Installer:** `apps/exo-clothcraft-v3/install-latest-upstream-macos.sh` packages this pinned build without replacing any previous application.

Upstream `main` can advance after this observation. When beginning a new development milestone, compare `git ls-remote origin refs/heads/main` with the baseline, then intentionally update the protected EXO integration branch and rebuild.

## Why

The current upstream ClothCraft `main` editor already owns a native fitting project, a true wgpu 3D renderer, native 2D editing, selection and sewing, simulation workers, viewport controls, workspace layout/persistence and a typed native command registry. Building another equivalent renderer and editor in the independent V3 prototype would duplicate substantial work.

The older *installed* `~/Applications/ClothCraft.app` contains an Oct 16 `cloth-fit` binary. The checked-out `research/oss/clothcraft` tree also lags current upstream and has **many uncommitted EXO-specific edits**. Neither should be overwritten or used as an implicit new baseline. Use a new protected integration worktree/branch from a **verified upstream commit**, plus reviewed migrations of EXO-owned changes.

## Source ownership and integration points

| Responsibility | Long-term owner | EXO integration |
| --- | --- | --- |
| App entry and native desktop boot | `src/bin/cloth-fit.rs` | Fork the native executable under EXO branding; do not wrap or launch a separate external editor. |
| Native EXO window and controls | `src/atelier.rs` + `src/atelier/chrome.rs` + `src/atelier/layout.rs` | Recreate the EXO toolbar, panels, workspaces and appearance using `egui` while retaining ClothCraft's viewport and interactions. |
| 2D editing, sewing, selecting and Undo | `src/atelier/authoring_ui.rs`, `board.rs`, `sewing_ui.rs`, `selection.rs` | Route EXO buttons to *real existing* native tools and commands, not new frontend-only garment copies. |
| Capability and dispatch | `src/atelier/commands.rs` and its native dispatcher | One authoritative verified command registry; disabled/coming-soon EXO UI when no proven backend exists. |
| Authoritative editable garment | `FittingProject` / `GarmentTemplate` in `src/fitting.rs`, `src/garment/template.rs` | Extend versioned native format only after explicit compatibility, reference and persistence tests. No sidecar duplicate of CAD state. |
| True 3D and solver | `src/render.rs`, `src/atelier/worker.rs`, Rust VBD/OGC modules | Reuse existing actual 3D renderer, state generation and worker safety. Never label the current V3 resting-mesh preview as live simulation. |
| EXO-specific capability migration | EXO Rust modules and verified API adapters | Port one complete EXO tool at a time, measure units and preserve seams, IDs, correct Undo and cold reload. |

## Product boundaries

1. **One downloadable EXO V3 application.** The native editor and garment engine live in one Rust process; alternate EXO views edit the same native garment. No second constantly running EXO editor or Node bridge is required for Rust-native editing.
2. **Upstream remains independent.** ClothCraft's upstream `main` is owned by its maintainers, who review individual Rust changes. EXO's *product* main branch is separately controlled by EXO. Do not wholesale merge the React app or GPL-covered EXO implementation into MIT upstream without an explicit rights-compatible grant.
3. **Do not delete the standalone V3.** Retain its verified Rust geometry/sewing/round-trip tests as fixtures while consolidating the code. Never discard the real work from V2 or replace user projects in place.
4. **Interface-first remains valid.** EXO's existing React UI is the interaction/design specification. Rebuild its visual presentation as native `egui` widgets, keeping unavailable tools inactive or hidden in public builds. The React source is not automatically translated into Rust.

## Migration stages and acceptance checks

**Stage A — protected native baseline:** Record the current installed app, source commit and local modifications. Obtain the most recent verified upstream `main` in a separate worktree with a unique build and app identity. Test baseline editor create/sew/save/reopen/simulation without changing the installed ClothCraft or current EXO V2.

**Stage B — EXO shell over native Atelier:** Reproduce the EXO top bar, side tool strips, object browser, panel layouts, selection and keyboard shortcuts inside `egui`. Keep the original working native viewport and editor underneath. Maintain a tool inventory mapping each EXO control to a native command, unavailable or requires-port state. Add UI smoke tests.

**Stage C — single-authority functionality:** Route working EXO tool commands through the native `FittingProject`/authoring/history APIs. Confirm that 2D, 3D, save, and actual solver state stay consistent for edited polygons and sewn edges; reject invalid topology or stale worker generations transactionally.

**Stage D — advanced functionality:** Port EXO-only drafting, grading, tech packs, marker nesting and production export as independently tested Rust modules, one end-to-end tool at a time. Never silently discard unsupported EXO project fields. Preserve original EXO V2 files and provide non-destructive, loss-reporting import/export.

**Stage E — EXO V3 release:** Validate cross-platform native build, manufacturer-critical geometry, crash-safe project save, fresh-install/open, licensing, code signing and migration coverage. Disable unfinished controls in public downloads. Retire the old bridge **only after** feature parity for required workflows is demonstrated.

## Immediate first implementation slice

Begin on a separate EXO branch/worktree with *only* the native ClothCraft `cloth-fit` editor plus EXO-branded application title and EXO-style toolbar shell. Wire one existing command such as `Duplicate selected panel` through the upstream typed action registry and validate native Undo/Redo, save/reload and both viewports. Next connect seam operations, with automated regression tests for their exact boundary ownership. Preserve all current V3 tests while comparing both implementations. Do not attempt the complete EXO UI migration as a monolithic patch.

## Operational constraint

At this assessment the Mac has approximately **6 GB free**, and the vendored Rust debug target directory is about **8 GB**. Avoid creating another full `target/` tree or downloading/installing redundant app copies. Build with a shared target cache only when compatible and monitor free space; never remove existing files or user assets without review.
