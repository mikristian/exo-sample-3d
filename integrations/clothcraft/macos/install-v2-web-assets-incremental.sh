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
# Bridge releases must install their service entrypoint as well as web assets.
# Preserve earlier native modules and archive data; only overwrite the three
# explicit archive-search release files, with a recoverable backup.
BRIDGE_RELEASE=(
  integrations/clothcraft/server.mjs
  integrations/clothcraft/pattern-archive-search-20261102.py
  integrations/clothcraft/pattern-source-geometry-20261102.py
  integrations/clothcraft/source-geometry-bridge-20261102.mjs
  integrations/clothcraft/research-contour-bridge-20261102.mjs
  integrations/clothcraft/research-seam-bridge-20261102.mjs
  integrations/clothcraft/photo-vision-semantic-20261102.mjs
  integrations/clothcraft/seam-prediction-research-20261102.py
  download/garment-dxf-library-20261023/tools/exo_contour_decoder_20261102.py
  src/core/exoArchivePatternRetrieval20261102.js
)
for file in "${BRIDGE_RELEASE[@]}"; do
  [[ -s "$ROOT/$file" ]] || { echo "Missing archive-search service source: $file" >&2; exit 1; }
done
# The native Swift launcher verifies a signed manifest before loading the UI.
# Previous incremental installs omitted both this manifest refresh and a small
# compiled validator required by its source list, leaving startup permanently
# blocked even though the localhost workspace bearer itself was valid.
RUNTIME_VALIDATOR="integrations/clothcraft/rust-agent-api/target/debug/exo-agent-validator"
[[ -x "$ROOT/$RUNTIME_VALIDATOR" ]] || { echo "Native runtime validator missing: $RUNTIME_VALIDATOR" >&2; exit 1; }
[[ -s "$ROOT/integrations/clothcraft/runtime-provenance.mjs" ]] || {
  echo 'Native runtime provenance verifier missing from source' >&2; exit 1;
}
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
# Resolve all local ESM imports in the source bridge, then add only missing
# installed modules. This prevents a newer server from importing absent deps.
DEPENDENCY_MANIFEST="$(mktemp)"
/usr/bin/python3 - "$ROOT" > "$DEPENDENCY_MANIFEST" <<'PY'
import pathlib,re,sys
root=pathlib.Path(sys.argv[1]); initial=pathlib.Path('integrations/clothcraft/server.mjs')
pending=[initial]; seen=set()
while pending:
    rel=pending.pop()
    if rel in seen: continue
    seen.add(rel)
    source=root/rel
    if not source.is_file(): raise SystemExit('Missing source import: '+str(rel))
    for spec in re.findall(r'''(?:from\s*|import\s*\(|import\s*)['"](\.[^'"]+)['"]''',source.read_text()):
        dep=pathlib.Path(__import__('os').path.normpath(str(rel.parent/spec)))
        if dep.suffix in ('.mjs','.js','.json'):
            pending.append(dep)
for rel in sorted(seen): print(rel)
PY
while IFS= read -r file; do
  [[ -n "$file" ]] || continue
  [[ -s "$ROOT/$file" ]] || { echo "Missing native bridge dependency: $file" >&2; exit 1; }
  if [[ ! -s "$SERVICE/$file" ]]; then
    mkdir -p "$(dirname "$SERVICE/$file")"
    cp "$ROOT/$file" "$SERVICE/$file"
  fi
done < "$DEPENDENCY_MANIFEST"
rm -f "$DEPENDENCY_MANIFEST"
if [[ ! -x "$SERVICE/$RUNTIME_VALIDATOR" ]]; then
  mkdir -p "$(dirname "$SERVICE/$RUNTIME_VALIDATOR")"
  cp "$ROOT/$RUNTIME_VALIDATOR" "$SERVICE/$RUNTIME_VALIDATOR"
  chmod 755 "$SERVICE/$RUNTIME_VALIDATOR"
fi
if [[ ! -s "$SERVICE/integrations/clothcraft/runtime-provenance.mjs" ]]; then
  cp "$ROOT/integrations/clothcraft/runtime-provenance.mjs" "$SERVICE/integrations/clothcraft/runtime-provenance.mjs"
fi
mkdir -p "$BACKUPS"
SERVICE_BACKUP="$(mktemp -d "$BACKUPS/archive-search-service-XXXXXXXX")"
for file in "${BRIDGE_RELEASE[@]}"; do
  if [[ -e "$SERVICE/$file" ]]; then
    mkdir -p "$SERVICE_BACKUP/$(dirname "$file")"
    cp -p "$SERVICE/$file" "$SERVICE_BACKUP/$file"
  fi
  mkdir -p "$(dirname "$SERVICE/$file")"
  cp "$ROOT/$file" "$SERVICE/$file"
done
"$SERVICE/bin/node" --input-type=module -e 'import(process.argv[1]).then(m=>{if(typeof m.searchExoArchivePatterns!=="function")process.exit(2)})' "$SERVICE/src/core/exoArchivePatternRetrieval20261102.js"
"$SERVICE/bin/node" --check "$SERVICE/integrations/clothcraft/server.mjs"
/usr/bin/python3 - "$SERVICE/integrations/clothcraft/pattern-archive-search-20261102.py" <<'PY'
import ast,sys
ast.parse(open(sys.argv[1]).read())
import numpy as np
assert hasattr(np, 'load') and hasattr(np, 'argsort'), 'Geometry embedding similarity requires numpy'
PY
"$SERVICE/bin/node" --input-type=module -e 'import(process.argv[1]).then(()=>console.log("EXO native service dependency closure: OK"))' "$SERVICE/integrations/clothcraft/workspace.mjs" || {
  echo "EXO installed localhost bridge dependency verification failed" >&2; exit 1;
}
mkdir -p "$BACKUPS"
BACKUP="$(mktemp -d "$BACKUPS/web-assets-incremental-XXXXXXXX")"
cp "$WEB/index.html" "$BACKUP/index.html"
if [[ -f "$SERVICE/runtime-provenance.json" ]]; then
  cp -p "$SERVICE/runtime-provenance.json" "$BACKUP/runtime-provenance.json"
fi
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
# The manifest binds the actual updated server, source modules and active web
# assets. Create it before code signing, then verify the signed resource bytes.
if ! "$SERVICE/bin/node" "$SERVICE/integrations/clothcraft/runtime-provenance.mjs" "$SERVICE" ||
   ! /usr/bin/codesign --force --deep --sign - "$APP" ||
   ! /usr/bin/codesign --verify --deep --strict "$APP" ||
   ! "$SERVICE/bin/node" "$SERVICE/integrations/clothcraft/runtime-provenance.mjs" --verify "$SERVICE"; then
  cp "$BACKUP/index.html" "$WEB/index.html"
  if [[ -f "$BACKUP/runtime-provenance.json" ]]; then
    cp "$BACKUP/runtime-provenance.json" "$SERVICE/runtime-provenance.json"
  else
    rm -f "$SERVICE/runtime-provenance.json"
  fi
  for file in "${BRIDGE_RELEASE[@]}"; do
    if [[ -f "$SERVICE_BACKUP/$file" ]]; then
      cp -p "$SERVICE_BACKUP/$file" "$SERVICE/$file"
    fi
  done
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
