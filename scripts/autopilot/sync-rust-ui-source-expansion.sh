#!/bin/bash
# Safely mirror JSX/TSX source changes to Jarvis's actual Expansion drive.
# No deletions, build caches, WebDAV staging, Git writes, or installed-app changes.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PEER="${EXO_JARVIS_PEER:-jarvismikristian@100.82.90.101}"
KEY="${EXO_JARVIS_KEY:-$HOME/.ssh/jarvis_os_bridge_ed25519}"
DEST="/Volumes/Expansion/EXO-Rust-UI-Autopilot/project/src"
[[ -r "$KEY" && -d "$ROOT/src" ]] || { echo 'Source or SSH identity unavailable' >&2; exit 2; }
SSH=(ssh -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=8 -i "$KEY")
"${SSH[@]}" "$PEER" 'mount | grep -q " on /Volumes/Expansion (" && test -w /Volumes/Expansion/EXO-Rust-UI-Autopilot/project/src' || {
  echo 'Verified physical Expansion drive unavailable; no internal-disk fallback' >&2
  exit 3
}
RSYNC_RSH="ssh -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=8 -i $KEY"
rsync -az --no-perms --no-owner --no-group \
  --include='*/' --include='*.jsx' --include='*.tsx' --exclude='*' \
  -e "$RSYNC_RSH" "$ROOT/src/" "$PEER:$DEST/"
echo 'EXO_RUST_UI_JSX_SYNC_PASS (no deletion or production changes)'
