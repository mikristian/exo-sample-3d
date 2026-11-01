# EXO ClothCraft Studio V2 grading release — 2026-10-23

User explicitly requested continuing 2D/grading completion and reopening the app with updates. Updated regular ~/Applications/EXO ClothCraft Studio V2.app (not only QA). Frontend build and existing compiled WASM assets installed; native solver retained byte-for-byte. The open garment was paused and saved before closing; its template hash matched after reopen. Original entry and WASM assets backed up in docs/qa/grading-release-20261023/installed-web-backup; old hashed frontend assets retained. Ad-hoc code signing and strict verification pass; regular app reopened and activated.

## Verified
9 focused tests pass. Native handoff regression passes against the installed Rust binary in an isolated project, including grade, undo/redo, save/reopen, stale revision rejection, notches and allowances. Built production UI tested with installed native binary in a disposable server: manual +17 mm grade and configurable -12.5/-6.25 mm grade, validation guards, reopen and reference download pass. Final read-only smoke on installed port5386 shows editable increments, A4/Letter tiled printing and reference export, with zero mutations, browser errors or failed JS/CSS/WASM requests.

Earlier full source browser test also passed both A4 and Letter PDF geometry/page count (49 pages for the test multi-panel sheet), 100mm digital calibration and native engineering cutline preservation, rejecting unsafe proof SVG and invalid units. Physical paper calibration is not performed.

## Not 100%
Open requirements: persistent professional native multi-size point-rule/nest UI; linked whole-garment grade transaction; full dependent geometry including holes/internal lines; size-by-size seam and POM acceptance across representative fixtures; independent CAD and physical print acceptance. Current native grade operation still rejects holes/internal lines and edit-batch supports only BoardTransform. Legacy graded-point IDs/rules now survive grade/JSON reopen, but that is not proof of native multi-size authoring.

Final disk headroom 1.8GiB, below8GiB native compile gate. No new Rust compiler execution, native solver replacement, source cleanup, external publication or physical-fit claim. No background work scheduled. Software-only frontend build was possible and passed; do not describe the entire task as blocked before delivering this installed improvement.
