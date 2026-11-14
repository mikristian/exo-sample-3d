# Rust grading connected acceptance — 2026-11-12

New executable: `node scripts/qa-rust-grading-connected-migration-20261112.mjs`.

This acceptance loads `public/wasm/exo_grading_kernel.wasm` via the actual public grading wrapper, verifies its recorded SHA-256, and requires `rustGradingKernelStatus().backend === 'rust-wasm'`. It opens a disposable, real `exo-session` through `integrations/clothcraft/workspace.mjs`; a live native `tshirt` template supplies actual panel and point geometry. Explicit mappings assign numeric WASM piece IDs to native panel IDs and numeric point IDs to native point indexes. Each of six adjacent break-table sizes is generated through the active Rust WASM path, checked against independently calculated uniform geometric scales, then used to construct the native `grade-run-commit` catalog.

The native Rust session commits and persists the mapped six-size catalog, checks the stored JSON, activates all six sizes to inspect the returned native 2D template and nonempty 3D mesh, and restores the exact authored source after each activation. Negative cases reject duplicate piece IDs, invalid point IDs, nonfinite and missing break vectors, stale native revisions, and unknown size activation; rejected native requests leave the saved source/catalog bytes unchanged. The sandbox is removed after the test.

Verified result on 2026-11-12: PASS. 2 panels; 28 base points; 6 sizes; 336 coordinate comparisons; 7 negative controls; 6 successful native activations. WASM SHA-256 `b3b31fb4321e86b3e673abbb803b4d32b7ae8bb0c323a09859643eca1b6db975`.

Scope: acceptance evidence for the specific WASM-to-native polygon mapping and native lifecycle. This does not mean that the browser UI calls this mapping, that all production grading models use it, or that patterns have been manufacturing certified. The production code, installed app, existing garments and native user projects were not changed.
