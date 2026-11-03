#!/bin/bash
# launchd entry point on the Expansion Mac: do not start duplicate importers.
set -euo pipefail

ROOT=/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2
PYTHON=/Users/jarvismikristian/.venvs/exo-garmentcodedata-v2/bin/python
TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export EXO_GARMENTCODE_TOOL_DIR="$TOOLS"
MODE="${1:-import}"

test -f "$ROOT/data/pattern-index.sqlite3" || exit 1
test -x "$PYTHON" || exit 1

if [ "$MODE" = import ]; then
  PIDFILE="$ROOT/supervisor.pid"
  MATCH=remote-garmentcode-supervisor.sh
  RUNNER="$TOOLS/remote-garmentcode-supervisor.sh"
elif [ "$MODE" = prefetch ]; then
  PIDFILE="$ROOT/prefetch.pid"
  MATCH=prefetch_garmentcodedata_v2.py
  RUNNER="$TOOLS/prefetch_garmentcodedata_v2.py"
  COMPLETE="$(find "$ROOT/data/original-parquet" -type f -name '*.parquet' 2>/dev/null | wc -l | tr -d ' ')"
  [ "${COMPLETE:-0}" -lt 40 ] || exit 0
elif [ "$MODE" = random ]; then
  PIDFILE="$ROOT/random-accelerator.pid"
  MATCH=remote-garmentcode-random-accelerator.sh
  RUNNER="$TOOLS/remote-garmentcode-random-accelerator.sh"
else
  echo "Unrecognized mode: $MODE" >&2
  exit 2
fi

if [ -f "$PIDFILE" ]; then
  PID="$(cat "$PIDFILE")"
  if [[ "$PID" =~ ^[0-9]+$ ]] && kill -0 "$PID" 2>/dev/null &&
     ps -p "$PID" -o command= | grep -q "$MATCH"; then
    exit 0
  fi
fi

printf '%s\n' "$$" > "$PIDFILE"
if [ "$MODE" = import ] || [ "$MODE" = random ]; then
  exec /bin/bash "$RUNNER"
else
  exec "$PYTHON" -u "$RUNNER" --output "$ROOT/data" --workers 2 --reserve-gb 10
fi
