#!/usr/bin/env bash
# Ingest all available garment pattern specifications to ExpansionCloud.
# All downloads are resumable. Run in a terminal attached to the Mac, with the
# ExpansionCloud WebDAV tunnel mounted and the Mac's local disk still writable.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL="$ROOT/download/garment-dxf-library-20261023/garmentcodedata-v2"
CLOUD="${EXO_GARMENTCODE_CLOUD_DIR:-$HOME/ExpansionCloud/EXO-ClothCraft/GarmentCodeData-v2}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if ! mount | grep -F " on $HOME/ExpansionCloud (webdav" >/dev/null; then
  echo 'ERROR: ExpansionCloud WebDAV tunnel is not mounted; refusing to store archives on the local disk instead.' >&2
  exit 1
fi

"$PYTHON_BIN" -c 'import pyarrow.parquet' || {
  echo 'ERROR: install pyarrow in the active Python environment first.' >&2
  exit 1
}

mkdir -p "$LOCAL" "$CLOUD"
# A safe connectivity test; do not depend on df(1), because this WebDAV server
# reports unknown quota as zero capacity.
"$PYTHON_BIN" - "$CLOUD" <<'PY'
import pathlib,sys,uuid
folder=pathlib.Path(sys.argv[1])
probe=folder/('.exo-write-test-'+str(uuid.uuid4()))
try:
    probe.write_bytes(b'EXO GarmentCodeData v2 tunnel write test\n')
    if probe.read_bytes()!=b'EXO GarmentCodeData v2 tunnel write test\n':
        raise RuntimeError('remote byte readback mismatch')
finally:
    probe.unlink(missing_ok=True)
PY

echo "Dataset original 2D specifications -> $CLOUD"
echo "Local SQLite and temporary Parquet -> $LOCAL"

"$PYTHON_BIN" -u "$ROOT/download/garment-dxf-library-20261023/tools/ingest_garmentcodedata_v2.py" \
  --output "$LOCAL" --remote --body both --batch all \
  --cloud-output "$CLOUD" --prune-local-after-archive --reserve-gb 5

echo 'Verified archive ingestion finished; source patterns are research-only (not factory certified).'
