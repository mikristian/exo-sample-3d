#!/usr/bin/env bash
# Rebuild EXO's VectorCraft-derived Rust pen WebAssembly from reviewed source.
# Requires external CARGO_TARGET_DIR; never silently fill the internal Mac SSD.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
if [ -z "$(printenv CARGO_TARGET_DIR || true)" ];then
  echo "Set CARGO_TARGET_DIR on a build volume (Jarvis Expansion build/use-expansion.sh)" >&2
  exit 2
fi
command -v cargo >/dev/null || { echo "Rust Cargo required" >&2; exit 1; }
command -v node >/dev/null || { echo "Node.js required" >&2; exit 1; }
if ! rustup target list --installed | grep -qx 'wasm32-unknown-unknown';then
  echo "Rust WebAssembly target missing: rustup target add wasm32-unknown-unknown" >&2
  exit 2
fi
cd "$ROOT"
cargo test --manifest-path rust/exo_vectorcraft_pen_kernel/Cargo.toml
cargo build --release --target wasm32-unknown-unknown --manifest-path rust/exo_vectorcraft_pen_kernel/Cargo.toml
FROM="$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/exo_vectorcraft_pen_kernel.wasm"
TO="$ROOT/public/wasm/exo_vectorcraft_pen_kernel.wasm"
test -s "$FROM"
mkdir -p "$(dirname "$TO")"
cp "$FROM" "$TO"
shasum -a 256 "$FROM" "$TO"
node --test \
  src/core/rustVectorcraftPenKernel20261115.test.mjs \
  src/core/vectorcraftAnchorPort.test.mjs \
  src/core/vectorcraftPenGesture20261023.test.mjs \
  src/core/vectorcraftPenGesture.anchorHit20261025.test.mjs \
  src/core/vectorcraftPenDimensions20261025.test.mjs
echo "Rust pen WASM rebuilt and parity-tested; the rest of EXO still needs migration."
