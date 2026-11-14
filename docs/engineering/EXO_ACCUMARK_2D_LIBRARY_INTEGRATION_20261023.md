# EXO ClothCraft 2D AccuMark engineering library integration

Source workspace: `research/accumark-v10-playlist/` (61 playlist entries, 58 frame sets, 116 official help entries and 33 engineered function specifications). The new 2D sidebar **TOOLS · 33 / GRADE** opens an in-app searchable command library, native grading workbench and 116 vendor reference page links.

The grading workbench reuses the existing industrial point grade engine. It previews every configured size, toggles the size nest, creates point-specific industrial grading rules, edits unequal X/Y size-break values in any of three grading modes, and copies/pastes per-point grading rules after validating the ordered sizes and base size. Changes go through `mutateProject` in `App.jsx` with the established undo path.

The function cards contain engineering inputs, steps, outputs, invariants, tests and code locations. Command routing uses `src/core/accumark2dCommandRegistry.js`: executable entries call the existing EXO slots or inspectors, while unimplemented research topics are read-only and link to vendor help. A listed reference is not represented as a working operation. The 116 official topics include broad reference pages, menus, and UI sections as well as commands; they are not 116 implemented functions. Native 2D slots handle trace contour (A07), notch (A08), seam allowance (A09) and seam walk (A10). Grade preview, rule editing and graded nest run against existing grading state.

The registry currently contains **18 executable routes and 15 reference-only contracts**. Of ten grading-domain contracts, six are routed to existing editing/preview operations; grading QA is also routed to the production inspector. Distinct advanced grading geometry tools (signed offset, intersection, keep angle and smooth grade) are displayed as references until independently implemented and tested.

## Validation

- `node --test src/components/AccuMarkGradeActions.test.mjs src/core/accumark2dCommandRegistry.test.mjs`: five tests passed.
- `node_modules/.bin/esbuild src/App.jsx --bundle --format=esm --platform=browser --external:react --external:react-dom '--external:*.css' --outfile=/tmp/exo-accumark-app-check.mjs`: compiled successfully, with one preexisting unrelated duplicate-key warning in `cloPropertyCommands.js`.
- `node scripts/qa-accumark-2d-library-20261023.mjs` on an EXO dev server at port 5174 verifies render/search/grade preview/nest, point rule editor and engineering details in a headless isolated browser. The production factory CAD/physical receiver and native Mac app packaging are beyond this UI regression.

## Deployment and limitations

Changes are made in repository source, with the Vite development workspace at `http://127.0.0.1:5174/?desktop=1&engine=clothcraft`. The previously installed macOS app is a separately packaged build. No heavyweight app build, install, or external factory approval was performed: free disk was approximately 4.4 GiB, below the existing 25 GiB safeguard. Advanced AccuMark grading functions (e.g. signed offset, keep angle, smoothing and constraint intersection) remain documented engineering contracts until complete geometry-edit behavior is implemented and verified.
