#!/bin/bash
# Update only hashed Vite JS/CSS and the entrypoint inside the existing V2 app.
# Large stage/avatar/texture libraries and the native Rust solver are preserved.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
BUILD="${EXO_V2_WEB_BUILD_DIR:-$ROOT/dist}"
APP="${EXO_DESKTOP_DEST:-$HOME/Applications/EXO ClothCraft Studio V2.app}"
WEB="$APP/Contents/Resources/web"
BACKUPS="$HOME/Library/Application Support/EXO-ClothCraft-Studio-V2/Backups"
# An incremental install can still copy hundreds of MiB before code signing.
# Refuse before any service-module repair, backup or web replacement if local
# space cannot hold a recoverable signed installation.
FREE_INSTALL_KIB="$(/bin/df -Pk "$APP" | /usr/bin/awk 'END {print $4}')"
if [[ ! "$FREE_INSTALL_KIB" =~ ^[0-9]+$ ]] || (( FREE_INSTALL_KIB < 1048576 )); then
  echo "EXO_WEB_INCREMENTAL_INSTALL_REFUSED_LOCAL_DISK_HEADROOM: require >=1GiB before touching installed app; have ${FREE_INSTALL_KIB:-unknown} KiB" >&2
  exit 6
fi
[[ -s "$WEB/index.html" ]] || { echo "Installed V2 web entrypoint missing" >&2; exit 1; }
[[ -s "$BUILD/index.html" ]] || { echo "V2 web build entrypoint missing: $BUILD" >&2; exit 1; }
[[ -s "$BUILD/cursors/cad-anchor-convert.svg" ]] || {
  echo "Refusing V2 install without the native 2D Anchor Point cursor" >&2; exit 1;
}
grep -rlqF 'http://127.0.0.1:5385' "$BUILD/assets" || {
  echo "Refusing bundle without the V2 native bridge URL" >&2; exit 1;
}
# Fail before replacing any UI asset if installed service dependencies are
# incomplete. Repair small, source-backed ESM modules in place; never modify
# saved projects or native solver binaries during this incremental update.
SERVICE="$APP/Contents/Resources"
for file in \
  integrations/clothcraft/avatarPersistenceContract.mjs \
  integrations/clothcraft/agent-key-store.mjs \
  integrations/clothcraft/workspace-auth.mjs \
  integrations/clothcraft/collaboration.mjs \
  integrations/clothcraft/apple-vision-hand.mjs \
  integrations/clothcraft/pattern-intelligence-catalog.mjs \
  integrations/clothcraft/seamly2dEngineRoute20261023.mjs \
  integrations/clothcraft/seamly2dNativeEngine20261023.mjs \
  integrations/clothcraft/seamlyAamaReceivingRoundtrip20261023.mjs \
  integrations/clothcraft/gridcraftBridge.mjs \
  src/core/backends/nativeOrderedAssembly20261025.mjs \
  src/core/seamlyAamaManufacturingSemantics20261023.mjs; do
  [[ -s "$ROOT/$file" ]] || { echo "EXO service dependency missing from source: $file" >&2; exit 1; }
  if [[ ! -s "$SERVICE/$file" ]]; then
    mkdir -p "$(dirname "$SERVICE/$file")"
    cp "$ROOT/$file" "$SERVICE/$file"
  fi
done
"$SERVICE/bin/node" --input-type=module -e 'import(process.argv[1]).then(()=>console.log("EXO native service dependency closure: OK"))' "$SERVICE/integrations/clothcraft/workspace.mjs" || {
  echo "EXO installed localhost bridge dependency verification failed" >&2; exit 1;
}
mkdir -p "$BACKUPS"
BACKUP="$(mktemp -d "$BACKUPS/web-assets-incremental-XXXXXXXX")"
cp "$WEB/index.html" "$BACKUP/index.html"
CURSOR="$WEB/cursors/cad-anchor-convert.svg"
if [[ -e "$CURSOR" ]]; then cp "$CURSOR" "$BACKUP/cad-anchor-convert.svg"; fi
cp -R "$BUILD/assets/." "$WEB/assets/"
# The Tech Pack demo must use the actual archived native T-shirt render;
# hashed JS alone cannot load this named, source-backed reference. This is a
# private local sample, not retail or commercial licensed Nike merchandise.
if [[ -s "$BUILD/techpack-demo/nike-saved-native-render.webp" ]]; then
  mkdir -p "$WEB/techpack-demo"
  cp "$BUILD/techpack-demo/nike-saved-native-render.webp" "$WEB/techpack-demo/nike-saved-native-render.webp"
fi
# Optional *user-local*, purchased private technical-flat reference. The build
# never contains it unless the user separately prepares their own private
# asset; no licensed SEAGGS files are checked into EXO public source. Copy
# this single allowlisted filename rather than distributing an asset folder.
PRIVATE_SEAGGS="$BUILD/private-mockups/seaggs-tshirt-private-transparent.png"
if [[ -s "$PRIVATE_SEAGGS" ]]; then
  PRIVATE_SIZE="$(/usr/bin/stat -f %z "$PRIVATE_SEAGGS")"
  (( PRIVATE_SIZE > 0 && PRIVATE_SIZE < 240000 )) || { echo "Private T-shirt reference exceeds local import limit" >&2; exit 1; }
  mkdir -p "$WEB/private-mockups"
  cp "$PRIVATE_SEAGGS" "$WEB/private-mockups/seaggs-tshirt-private-transparent.png"
fi
for VIEW in front back; do
  PRIVATE_SEAGGS_SVG="$BUILD/private-mockups/seaggs-tshirt-$VIEW-vector.svg"
  if [[ -s "$PRIVATE_SEAGGS_SVG" ]]; then
    VECTOR_SIZE="$(/usr/bin/stat -f %z "$PRIVATE_SEAGGS_SVG")"
    (( VECTOR_SIZE > 100 && VECTOR_SIZE < 285000 )) || { echo "Private vector artwork exceeds local import limit" >&2; exit 1; }
    mkdir -p "$WEB/private-mockups"
    cp "$PRIVATE_SEAGGS_SVG" "$WEB/private-mockups/seaggs-tshirt-$VIEW-vector.svg"
  fi
done
# Small, integrity-checked user project reference snapshots needed by the
# one-time native File Library importer. Never overwrite an existing saved
# garment asset with a different payload or touch the app's live workspace.
if [[ -d "$BUILD/saved-garments" ]]; then
  mkdir -p "$WEB/saved-garments"
  for SOURCE in "$BUILD"/saved-garments/*.json; do
    [[ -f "$SOURCE" ]] || continue
    DEST="$WEB/saved-garments/$(basename "$SOURCE")"
    if [[ -e "$DEST" ]]; then
      cmp -s "$SOURCE" "$DEST" || { echo "Existing preserved garment differs: $DEST" >&2; exit 1; }
    else
      cp "$SOURCE" "$DEST"
    fi
  done
fi
mkdir -p "$WEB/cursors"
cp "$BUILD/cursors/cad-anchor-convert.svg" "$CURSOR"
TEMP_ENTRY="$(mktemp "$WEB/.index-XXXXXXXX")"
cp "$BUILD/index.html" "$TEMP_ENTRY"
mv "$TEMP_ENTRY" "$WEB/index.html"
if ! /usr/bin/codesign --force --deep --sign - "$APP" ||
   ! /usr/bin/codesign --verify --deep --strict "$APP"; then
  cp "$BACKUP/index.html" "$WEB/index.html"
  if [[ -f "$BACKUP/cad-anchor-convert.svg" ]]; then
    cp "$BACKUP/cad-anchor-convert.svg" "$CURSOR"
  else
    rm -f "$CURSOR"
  fi
  /usr/bin/codesign --force --deep --sign - "$APP" || true
  echo "Install failed. Previous entrypoint restored." >&2
  exit 1
fi
echo "Installed incremental V2 web assets. Previous entrypoint: $BACKUP/index.html"
