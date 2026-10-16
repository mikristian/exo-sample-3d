# EXO × ClothCraft — personal integration branch

This integration lives on the separate `integration/clothcraft-private` branch. The canonical EXO worktree and the upstream ClothCraft contribution branch are independent. ClothCraft remains upstream MIT-licensed software; EXO's original files remain GPL-3.0-only. The bridge preserves source EXO projects and runs ClothCraft's actual CPU Rust utilities as separate processes, after generating compatible template JSON using EXO's existing native C++ exporter.

## Run from the EXO private worktree

For the live personal UI, run `npm run clothcraft:start` to launch both local servers from one terminal (Ctrl+C stops both). Alternatively, start `npm run clothcraft:serve` in one terminal and `npm run clothcraft:dev` in another. Open `http://127.0.0.1:5174` and select the **Production** workspace; the two ClothCraft controls near the bottom validate the editable EXO garment in Rust or bake downloadable ClothCraft OBJ + template JSON. Baking opens an orbitable, read-only 3D preview of the actual ClothCraft mesh inside EXO, alongside saving the OBJ. The private port 5174 allows the original EXO server to stay on 5173 without interference. The localhost bridge listens on 5193 and accepts only requests from the EXO development origins.

### Installed standalone macOS application

The same personal integration also has a **real signed macOS `.app`** in `~/Applications/EXO Sample 3D ClothCraft.app`. Double-click it from Finder/Applications or launch with:

```sh
open -a "$HOME/Applications/EXO Sample 3D ClothCraft.app"
```

It opens a native AppKit window with an embedded WebKit interface rather than a Chrome tab. The bundle contains the compiled EXO interface, native C++ exporter, ClothCraft Rust template/fit executables, a locally licensed CC0 mannequin and its own Node runtime. The app **automatically starts** its two loopback services on ports 5284 (interface) and 5283 (Rust bridge), then stops those processes when quitting normally. No Vite dev server or terminal command is needed just to open the installed app. Browser downloads in the standalone app go to your `~/Downloads` folder, while generated intermediate Rust artifacts are stored outside the signed app in `~/Library/Application Support/EXO-Sample-3D-ClothCraft/Output/`.

Rebuild/reinstall after changes with `npm run clothcraft:build-app` (requires Xcode Swift compiler, locally built EXO C++ CLI and ClothCraft Rust binaries). This is a **personal arm64 macOS build** with an ad-hoc local signature, not a notarized or publicly distributed app. Full ClothCraft solver convergence, on-avatar fit and independent industrial file approvals are still unverified.

Clone ClothCraft into `research/oss/clothcraft` (ignored) or set `EXO_CLOTHCRAFT_REPO` to an existing checkout. Install an appropriate Rust toolchain; ClothCraft's README lists Windows as the only locally validated desktop. The EXO CAD exporter needs to be built once:

```sh
python3 -m cmake -S native_cpp -B native_cpp/build-cmake -DGARMENT_BUILD_QT=OFF
python3 -m cmake --build native_cpp/build-cmake --target garment_cad_cli --parallel 2
node integrations/clothcraft/bridge.mjs status
node integrations/clothcraft/bridge.mjs export
node integrations/clothcraft/bridge.mjs validate
node integrations/clothcraft/bridge.mjs bake
node integrations/clothcraft/bridge.mjs simulate --steps 5
node integrations/clothcraft/bridge.mjs prepare
node integrations/clothcraft/bridge.mjs fit --steps 1
```

`export` requires only the EXO C++ CLI; `validate`, `bake` and `simulate` delegate to the actual ClothCraft `cloth-template` Rust executable or `cargo run` with the CPU-only build. Choose a custom garment with `--input path/to/project.json`. The generated candidate template and diagnostic report are under `integrations/clothcraft/output/` (ignored); `--output` chooses another directory. `prepare` creates a ClothCraft fitting project referencing the licensed CC0 mannequin; `fit` attempts a CPU fitting step and records failures; `open` launches the native ClothCraft editor with `cloth-fit --view`. Use `--avatar /path/to/model.obj` if needed. All commands fail visibly if the backend is missing or rejects the data.

## Scope and limitations

The C++ exporter preserves source panel IDs, named seam references, converted quadratic Bézier controls, and basic fabrics/grain parameters. ClothCraft does not automatically receive EXO's notches, production annotations, grading, fasteners, calibrated materials or avatar-specific fittings. The EXO project remains the source of truth. EXO's exported separated panels can have unacceptable initial seam gaps, and existing ClothCraft CPU solver contact/fit remains experimental; do not use any result as factory or body-fit certification. Mac GPU window availability is unverified. See [native ClothCraft compatibility research](../../docs/CLOTHCRAFT_CPP_RUST_INTEROP_2026-10-15.md) and upstream `docs/template-format.md` for format assumptions.

### First real integration check (15 October 2026)

- C++ export parity passed using `node scripts/check-clothcraft-interchange.mjs` (4 panels, 14 seams, 18 curve controls).
- ClothCraft's actual Rust `cloth-template validate` accepted the emitted tee: 2,006 vertices, 3,619 triangles; initial maximum seam gap 1.4842 m.
- Rust `cloth-template bake` created `cloth.obj`, `patterns.svg`, `fibers.json`, `grain-guides.obj` and its template snapshot. The live EXO Production buttons returned a `.json` and `.obj`, and the baked OBJ displayed in the internal interactive preview without page errors.
- Rust reference CPU `cloth-template simulate --steps 5` executed all steps but reported **0 converged steps**, so the process returned an error by design. The final maximum seam gap was 0.1085 m; this is still an unacceptable cloth assembly.
- The experimental `cloth-fit` CPU VBD/OGC path ran one step with 8 contacts, but its maximum seam gap remained 1.3982 m. Neither experiment validates body contact, continuous collision detection, industrial fit or a stable sewn T-shirt.

These fixture measurements are diagnostics at one source revision, not generalized physical or cross-platform performance claims. Improving initial piece placement, seam closure, motion and collision testing is the next real simulation integration milestone.

Upstream contributions should be developed independently against `erythrofr/ClothCraft`, tested under its MIT licensing requirements, and submitted as focused PRs. Neither worktree is automatically merged into the other.
