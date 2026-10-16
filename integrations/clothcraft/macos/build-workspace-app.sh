#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
export CARGO_HOME="$ROOT/research/runtime/clothcraft-rust-toolchain/cargo"
export RUSTUP_HOME="$ROOT/research/runtime/clothcraft-rust-toolchain/rustup"
export PATH="$CARGO_HOME/bin:/usr/local/bin:$PATH"
if [[ -e research/oss/clothcraft/src/bin/exo-session.rs ]] && \
   ! cmp -s integrations/clothcraft/exo-session.rs research/oss/clothcraft/src/bin/exo-session.rs; then
  echo 'Refusing to overwrite different local Rust session work in the ClothCraft checkout.' >&2
  echo 'Review src/bin/exo-session.rs and integrations/clothcraft/exo-session.rs before packaging.' >&2
  exit 1
fi
cp integrations/clothcraft/exo-session.rs research/oss/clothcraft/src/bin/exo-session.rs
(cd research/oss/clothcraft && cargo build --locked -j 2 --bin exo-session)
export EXO_DESKTOP_DEST="${EXO_DESKTOP_DEST:-$HOME/Applications/EXO ClothCraft Studio.app}"
export EXO_DESKTOP_SWIFT_SOURCE=integrations/clothcraft/macos/EXOClothCraftWorkspace.swift
export EXO_BUILD_BRIDGE_URL=http://127.0.0.1:5285
bash integrations/clothcraft/macos/build.sh
/usr/libexec/PlistBuddy -c 'Set :CFBundleIdentifier com.mikristian.exo.clothcraft.workspace' "$EXO_DESKTOP_DEST/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleDisplayName EXO ClothCraft Studio' "$EXO_DESKTOP_DEST/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleShortVersionString 0.2.0' "$EXO_DESKTOP_DEST/Contents/Info.plist"
/usr/bin/codesign --force --deep --sign - "$EXO_DESKTOP_DEST"
/usr/bin/codesign --verify --deep --strict "$EXO_DESKTOP_DEST"
