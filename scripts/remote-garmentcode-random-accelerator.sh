#!/bin/bash
# Extract the already SHA-256 verified random-body Parquet sources while the
# primary sequential importer handles default-body batches. SQLite WAL has one
# authoritative index; only the primary importer publishes its cloud snapshot.
set -euo pipefail

ROOT="${EXO_GARMENTCODE_ROOT:-/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2}"
PYTHON="${EXO_GARMENTCODE_PYTHON:-/Users/jarvismikristian/.venvs/exo-garmentcodedata-v2/bin/python}"
TOOLS="${EXO_GARMENTCODE_TOOL_DIR:-$ROOT/tools}"
export EXO_GARMENTCODE_FAST_STAGING=1

test -f "$ROOT/data/pattern-index.sqlite3" || exit 1
test -x "$PYTHON" || exit 1

while :; do
  read -r indexed archived <<<"$("$PYTHON" - "$ROOT/data/pattern-index.sqlite3" <<'PY'
import sqlite3,sys
with sqlite3.connect(sys.argv[1],timeout=60) as db:
    a=db.execute("select count(*) from processed_batches where body='random'").fetchone()[0]
    b=db.execute("select count(*) from archived_batches where body='random'").fetchone()[0]
    print(a,b)
PY
)"
  printf '%s Random-body ingestion: %s/20 indexed, %s/20 archived\n' "$(date -u +%FT%TZ)" "$indexed" "$archived" >> "$ROOT/random-accelerator.log"
  if [ "$indexed" -ge 20 ] && [ "$archived" -ge 20 ]; then
    echo 'ALL_RANDOM_BODY_SPECIFICATIONS_ARCHIVED' >> "$ROOT/random-accelerator.log"
    exit 0
  fi
  if "$PYTHON" -u "$TOOLS/ingest_garmentcodedata_v2.py" \
    --remote --body random --batch all --output "$ROOT/data" \
    --cloud-output "$ROOT" --keep-parquet --prefetched-only \
    --no-index-backup --prune-local-after-archive --reserve-gb 5 \
    >> "$ROOT/random-accelerator.log" 2>&1; then
    sleep 45
  else
    echo 'Random worker paused after error; retained originals and SQLite batches preserved' >> "$ROOT/random-accelerator.log"
    sleep 60
  fi
done
