#!/usr/bin/env bash
# Install a separate macOS .app; never overwrite EXO V2 or ClothCraft upstream.
set -euo pipefail
mode="${1:-}"
if [[ -n "$mode" && "$mode" != "--backup-existing" ]]; then
  echo "Usage: bash install-macos.sh [--backup-existing]" >&2
  exit 2
fi

app_root="$(cd "$(dirname "$0")" && pwd)"
exo_root="$(cd "$app_root/../.." && pwd)"
cargo="${CARGO_BIN:-$HOME/.cargo/bin/cargo}"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$exo_root/research/oss/clothcraft/target}"

"$cargo" build --offline --locked -j 2 --manifest-path "$app_root/Cargo.toml"

target="$HOME/Applications/EXO ClothCraft Studio V3.app"
if [[ -e "$target" && "$mode" != "--backup-existing" ]]; then
  echo "Refusing to overwrite existing V3 app: $target" >&2
  echo "Use --backup-existing to retain the previous V3 .app while installing this build." >&2
  exit 1
fi

binary="$CARGO_TARGET_DIR/debug/exo-clothcraft-v3"
[[ -x "$binary" ]] || { echo "Compiled V3 binary not found: $binary" >&2; exit 1; }
mkdir -p "$HOME/Applications"
staging="$(mktemp -d "$HOME/Applications/.exo-v3-install.XXXXXX")"
staged_app="$staging/EXO ClothCraft Studio V3.app"
backup=""
cleanup() { [[ ! -d "$staging" ]] || rm -rf "$staging"; }
trap cleanup EXIT
mkdir -p "$staged_app/Contents/MacOS" "$staged_app/Contents/Resources/licenses"
cp "$binary" "$staged_app/Contents/MacOS/exo-clothcraft-v3"
cp "$exo_root/research/oss/clothcraft/LICENSE" "$staged_app/Contents/Resources/licenses/ClothCraft-MIT.txt"
cp "$exo_root/LICENSE" "$staged_app/Contents/Resources/licenses/EXO-GPL-3.0.txt"
cat > "$staged_app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleExecutable</key><string>exo-clothcraft-v3</string>
  <key>CFBundleIdentifier</key><string>com.mikristian.exo-clothcraft-v3</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>EXO ClothCraft Studio V3</string>
  <key>CFBundleDisplayName</key><string>EXO ClothCraft V3</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST

if command -v codesign >/dev/null 2>&1; then
  codesign --force --sign - --timestamp=none "$staged_app"
fi
if [[ -e "$target" ]]; then
  backup_root="$HOME/Applications/EXO ClothCraft V3 Backups"
  mkdir -p "$backup_root"
  backup="$backup_root/EXO ClothCraft Studio V3 $(date +%Y%m%d-%H%M%S).app"
  if [[ -e "$backup" ]]; then
    echo "Refusing to replace an existing V3 backup: $backup" >&2
    exit 1
  fi
  mv "$target" "$backup"
fi
if ! mv "$staged_app" "$target"; then
  if [[ -n "$backup" && ! -e "$target" ]]; then
    mv "$backup" "$target"
  fi
  echo "V3 install failed; previous installed app restored when possible" >&2
  exit 1
fi
[[ -z "$backup" ]] || echo "Previous V3 preserved: $backup"
echo "Created isolated native Rust application: $target"
echo "This is a local ad-hoc-signed prototype, not a notarized public release."
