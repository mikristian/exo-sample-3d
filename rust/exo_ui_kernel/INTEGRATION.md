# POM label anchor Rust/WASM interface

The native Rust entry is `pom_label_anchor(Point, Point, normal_offset, dx, dy) -> Option<Point>`.
The browser adapter is `src/core/rustPomKernel.js`: initialize with
`await initializeRustPomKernel()` and call `rustPomLabelAnchor(left,right,{normalOffset:0,dx:3.9,dy:-1.8})`.
Inputs and outputs are **SVG viewBox coordinates**, never centimeters. Both platforms use
the same Rust function; WASM exports split x/y for an allocation-free C ABI.

The precise insertion point is `src/components/PatternEditor.jsx` inside the
`clo-pom-station` mapping around the `clo-pom-measurement-label` element currently at
line ~1208, after `left`, `right`, and `mid` are derived with `svgPoint`.
Replace its existing `x={mid.x+3.9}` and `y={mid.y-1.8}` with the adapter's
anchor coordinates, guarded by readiness. The geometry preserves that same
location for `normalOffset:0,dx:3.9,dy:-1.8`. For offset POM callouts, select
`normalOffset` in viewBox units. Import/initialize the adapter at the containing
component lifecycle boundary and trigger a React update after readiness; the
current adapter does not automatically rerender React. **The editor is not yet wired.**

Build from repository root with `cargo test --manifest-path rust/exo_ui_kernel/Cargo.toml`
and `cargo build --manifest-path rust/exo_ui_kernel/Cargo.toml --release --target wasm32-unknown-unknown`.
Copy `rust/exo_ui_kernel/target/wasm32-unknown-unknown/release/exo_ui_kernel.wasm`
to `public/wasm/exo_ui_kernel.wasm` to serve it at the adapter's default URL.
