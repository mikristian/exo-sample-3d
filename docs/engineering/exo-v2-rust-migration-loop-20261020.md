# EXO ClothCraft Studio V2 — Rust migration continuation (2026-10-20)

## Scope

This source milestone moves five computations called by the current 2D board
and production preflight into native Rust compiled as browser WebAssembly.
The editor remains React/JavaScript, its synchronous API contracts remain
unchanged, and each entrypoint retains the previous JavaScript calculation
while WASM is unavailable. The original project, installed desktop app,
native service and garments were not rewritten or redeployed.

| Existing active source path | Rust kernel | Responsibility |
| --- | --- | --- |
| `src/core/patternAllowancePreview.js` | `rust/exo_allowance_preview_kernel` | Right-hand seam allowance polyline offsets in material metres, exact miter joins, bounded bevels, duplicate removal |
| `src/core/patternSewingGuideSampling.js` | `rust/exo_sewing_guide_kernel` | Sewing correspondence index selection, true first/last index retention, ambient versus emphasized density |
| `src/core/patternLabelPlacement.js` | `rust/exo_label_layout_kernel` | Bounded SVG label placement, collision counts and deterministic priority |
| `src/core/patternGuideTracks.js` | `rust/exo_material_guide_kernel` | Union of occupied intervals where a drafting guide crosses triangulated material, preserving cutouts |
| `src/core/productionPreflight.js` | `rust/exo_preflight_crossing_kernel` | Strict nonadjacent sampled cutline intersections for production warnings/blockers |

Each WASM kernel is built with a version-checked ABI, its own offline/locked
Cargo build script and tests. The macOS V2 source packaging scripts
`integrations/clothcraft/macos/build.sh` and `build-web-only-v2.sh` now
compile and require all five WASM binaries before staging a release.
Running a source package build is distinct from signing and installing an app.

## Acceptance and limitations

- Seam allowance: 3/3 Rust tests, 706 differential JavaScript/WASM cases and
  10,324 individual coordinate comparisons, 4/4 existing preview tests pass.
- Sewing guide sampling: 3/3 Rust tests, 4/4 JS tests, including over 5,000
  reference comparisons for short, dense and maximum safe integer counts.
- Pattern label placement: 3/3 Rust tests and 600 seeded layouts compared
  through direct kernel and the existing synchronous caller.
- Production preflight crossing: 4/4 Rust tests, 806 independently generated
  intersection fixtures compared in JS fallback, direct WASM and production
  wrapper; two manufacturing report cases checked.
- Material guide interval regression and differential tests: 3/3 Rust tests,
  15/15 editor guide and Rust adapter tests, and over 5,000 parity fixtures
  including separate cutout islands and malformed/degenerate triangles.
- `npm run build` passed after all five conversions, transforming
  2,032 modules. Both packaging scripts passed `bash -n`; `git diff --check`
  passed.
- A headless browser loaded all five WASM modules at source Vite port
  5297 and returned correct allowance, sewing, label, occupied-interval,
  and production crossing sample results.
  This probe did not establish actual 2D board DOM readiness on that page
  (board selector absent), so it is a real browser kernel test, not an
  installed-app interaction acceptance.

The independent Rust source inventory presently counts **468 first-party
non-Rust files** across the seven configured app surfaces (182 JS, 73 JSX,
23 MJS, 181 C/C++ and 9 Swift), plus 19 Rust files inside those surfaces.
This audit excludes the standalone Rust kernel crates and the separate Rust
garment solver. The increase over the earlier source-file inventory reflects
new JavaScript compatibility bridges and unrelated source additions; it is not
a measure of numerical functionality migrated or a conversion percentage.

## Remaining work

The UI still uses React/Three.js and JavaScript state; the Node workspace,
collaboration and MCP service, Swift macOS host, and remaining C++ code are
not converted. Geometry bridges still have JavaScript fallbacks; deleting
them before broad UI and error-path parity would cause startup regressions.
Complete Rust ownership of pattern transactions, render/update state,
transport, host control and 3D scene interaction requires additional staged
API migrations and tests. The pre-existing GPU VBD installed-release gate
also remains unresolved; source tests do not clear it.
