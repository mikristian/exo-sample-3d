# EXO VectorCraft Pen — Rust/WASM kernel

Stage A React-first backend migration, 2026-11-15.

**Upstream provenance:** Original Rust VectorCraft source at
https://github.com/storytold/vectorcraft/tree/73f40e3fd3fd6957508f18af1bf3bff93a9eb3e7/crates/geom/src/path.rs.
Original VectorCraft contributors; MIT OR Apache-2.0 licensing. This EXO
adaptation uses the VectorCraft Anchor::set_handle behavior and the EXO pen
gestures expressed in metres rather than absolute screen/document pixels.
Original notices and license texts: public/licenses/vectorcraft.

## What executes in Rust
- Pen tangent and Shift angle snapping
- Cubic Bézier control evaluation (used by anchor insertion and draft segment previews)
- Nearest curved segment parameter selection (actual Bézier, not chord midpoint)
- Smooth/corner anchor classification (millimetre-safe)
- Opposing smooth anchor-handle rotation with length preservation

Pure Rust f64 math is compiled as WebAssembly, loaded on the existing React
pen tool through src/core/rustVectorcraftPenKernel20261115.js.
The loader checks the versioned WASM ABI and exposes a status reporter.
Until the module loads, the existing JS draft preview works unchanged;
backend status explicitly says javascript-fallback, not Rust-verified.

The actual final Polygon commit already routes from the React pen tool to
the existing EXO/ClothCraft native Rust session via authenticated /workspace,
with revision-pinned edits and Rust Undo/Redo. The standalone
scripts/qa_exo_v3_native_pen_polygon_20261115.mjs test passed against a real
compiled exo-session on Jarvis Expansion. It is not a browser E2E test.

## Build and regression tests

On Jarvis, use the external Expansion environment:

    sh /Volumes/Expansion/EXO-Engineering/EXO-V3-Rust-React-Hybrid-20261115-7a06468/build/use-expansion.sh \
      bash scripts/release/build-exo-vectorcraft-pen-wasm-20261115.sh

The script requires a preinstalled wasm32-unknown-unknown Rust target and
CARGO_TARGET_DIR on external storage, then runs the 7 Rust tests, builds
public/wasm/exo_vectorcraft_pen_kernel.wasm and runs 29 JavaScript/VectorCraft
tests. Rebuild the full React UI separately with npm run build.

## Still pending

This is **partial pen backend migration**, not full tool parity or 41-system
completion. React retains SVG string composition, provisional draft state,
selection/gesture orchestration, numerical dimension widgets and some
segment-reshape/insert structural transformations. More Rust ports and real
browser pointer tests remain. All 2D/3D garment state and dependencies need
one canonical Rust document before the broader Stage A completion gate.
The six-size tee physical simulation still fails its real seam/strain fit gate.
