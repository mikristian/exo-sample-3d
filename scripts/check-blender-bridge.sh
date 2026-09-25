#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
if [[ ! -x "$BLENDER" ]]; then
  echo "Blender bridge check skipped: Blender executable not found at $BLENDER" >&2
  exit 0
fi
cd "$ROOT"
node scripts/export-blender-fixture.mjs tee blender_bridge/fixtures/tee.garment.json >/tmp/garment-studio-blender-fixture.json
"$BLENDER" --background --factory-startup --python blender_bridge/import_garment.py -- \
  --input blender_bridge/fixtures/tee.garment.json \
  --output blender_bridge/output/tee.blend >/tmp/garment-studio-blender-import.log 2>&1
"$BLENDER" --background --factory-startup blender_bridge/output/tee.blend --python blender_bridge/check_blend.py -- 4 14
