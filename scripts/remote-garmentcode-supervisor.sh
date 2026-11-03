#!/usr/bin/env bash
# Run on the Expansion Mac, using the local /Volumes/Expansion disk (not WebDAV).
# Continue interrupted downloads with checksum verification and source archives.
# Exits successfully only when every discovered batch is indexed, cloud-archived,
# and its original full Parquet source is retained. No factory DXF approval.
set -euo pipefail

ROOT="${EXO_GARMENTCODE_ROOT:-/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2}"
PYTHON_BIN="${EXO_GARMENTCODE_PYTHON:-/Users/jarvismikristian/.venvs/exo-garmentcodedata-v2/bin/python}"
TOOLS="${EXO_GARMENTCODE_TOOL_DIR:-$ROOT/tools}"
INDEX="$ROOT/data/pattern-index.sqlite3"
PID_FILE="$ROOT/remote-ingest.pid"
LOG="$ROOT/remote-ingest.log"
MAX_BACKOFF_SECONDS=300
export EXO_GARMENTCODE_FAST_STAGING=1

test -f "$INDEX" || { echo 'Missing restored source SQLite index' >&2; exit 1; }
test -x "$PYTHON_BIN" || { echo 'Missing Python ingestion environment' >&2; exit 1; }
"$PYTHON_BIN" -c 'import pyarrow.parquet'

stats() {
  "$PYTHON_BIN" - "$INDEX" "$ROOT/data/original-parquet" <<'PY'
import pathlib, sqlite3, sys
db = sqlite3.connect(sys.argv[1])
processed = db.execute('SELECT count(*) FROM processed_batches').fetchone()[0]
archived = db.execute('SELECT count(*) FROM archived_batches').fetchone()[0]
patterns = db.execute('SELECT count(*) FROM patterns').fetchone()[0]
db.close()
parquets = sum(1 for _ in pathlib.Path(sys.argv[2]).rglob('*.parquet'))
print(f'{processed} {archived} {parquets} {patterns}')
PY
}

retry_without_progress=0
last_progress=''
while :; do
  read -r processed archived parquet patterns <<<"$(stats)"
  echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') status: ${patterns} patterns, ${processed}/40 indexed batches, ${archived}/40 archived, ${parquet}/40 full Parquet sources" | tee -a "$ROOT/supervisor.log"
  if (( processed >= 40 && archived >= 40 && parquet >= 40 )); then
    if "$PYTHON_BIN" "$TOOLS/audit_garmentcodedata_v2_completion.py" \
      --root "$ROOT" --deep --prepare-repairs \
      --status-file "$ROOT/full-dataset-audit.json" >> "$ROOT/supervisor.log" 2>&1; then
      echo 'ALL_SOURCE_BATCHES_VERIFIED_AND_RETAINED' | tee -a "$ROOT/supervisor.log"
      exit 0
    fi
    echo 'All 40 files were counted, but independent integrity audit failed; continuing/retrying' | tee -a "$ROOT/supervisor.log"
  fi

  # Respect an import that was launched before this supervisor was installed.
  if test -f "$PID_FILE"; then
    running_pid="$(cat "$PID_FILE")"
    if [[ "$running_pid" =~ ^[0-9]+$ ]] && kill -0 "$running_pid" 2>/dev/null; then
      state="$(ps -p "$running_pid" -o stat= 2>/dev/null || true)"
      if [[ "$state" != *Z* && -n "$state" ]]; then
        sleep 20
        continue
      fi
    fi
  fi

  progress="${processed}:${archived}:${parquet}"
  if [[ "$progress" != "$last_progress" ]]; then
    last_progress="$progress"
    retry_without_progress=0
  fi
  # Keep retrying recoverable network and storage interruptions; do not exit
  # permanently just because a connection failed twelve times in a row.
  # Errors are kept in logs for inspection, and retry frequency is bounded.

  args=(--remote --body both --batch all --output "$ROOT/data"
        --cloud-output "$ROOT" --keep-parquet --prune-local-after-archive
        --reserve-gb 5)
  if (( processed >= 40 && parquet < 40 )); then
    # Backfill the full mesh/label Parquet files for the initial batches that
    # were saved as 2D-only JSON before the expansion machine came online.
    args+=(--backfill-existing-parquet)
  fi

  echo "Launching verified import, retry count=${retry_without_progress}" | tee -a "$ROOT/supervisor.log"
  "$PYTHON_BIN" -u "$TOOLS/ingest_garmentcodedata_v2.py" "${args[@]}" >> "$LOG" 2>&1 &
  child=$!
  printf '%s\n' "$child" > "$PID_FILE"
  if wait "$child"; then
    echo 'Import pass exited normally' >> "$ROOT/supervisor.log"
    retry_without_progress=0
  else
    result=$?
    echo "Importer exited with code $result; inspecting verified checkpoint" | tee -a "$ROOT/supervisor.log"
    retry_without_progress=$((retry_without_progress + 1))
  fi
  delay=15
  if (( retry_without_progress > 3 )); then
    delay=$((15 * (retry_without_progress - 2)))
    if (( delay > MAX_BACKOFF_SECONDS )); then delay=$MAX_BACKOFF_SECONDS; fi
    echo "Retrying after ${delay}s backoff; verified archived files untouched" | tee -a "$ROOT/supervisor.log"
  fi
  sleep "$delay"
done
