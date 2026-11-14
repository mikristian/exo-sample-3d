#!/usr/bin/env bash
# Portable first-party EXO source to physical Jarvis Expansion. SOURCE ONLY.
# Excludes personal paths and nonessential CLO/third-party media. Does not touch
# the installed .app, source worktree, existing backups or user projects.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
cd "$ROOT"
HOST="${EXO_JARVIS_SSH_HOST:-jarvis-lan}"
REMOTE_ROOT='/Volumes/Expansion/EXO-Engineering/SourceRebuilds'
# Never quietly use a stale local cached origin/main. Resolve the actual
# published head, or use a caller-supplied exact immutable commit.
if [[ "${1:-}" == '--dry-run' ]]; then
  SHA="${2:-}"
else
  SHA="${1:-}"
fi
if [[ -z "$SHA" ]]; then
  SHA="$(git ls-remote --heads origin main | awk '{print $1}')"
fi
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'Refuse: require a full 40-hex Git commit' >&2; exit 2; }
[[ "$HOST" =~ ^[A-Za-z0-9._-]+$ ]] || { echo 'Refuse: untrusted SSH host alias' >&2; exit 3; }
git cat-file -e "$SHA^{commit}"
STAMP="$(date +%Y%m%d-%H%M%S)"
RUN="EXO-V2-${STAMP}-${SHA:0:8}"
TARGET="$REMOTE_ROOT/$RUN"
if [[ "${1:-}" == '--dry-run' ]]; then
  printf 'SOURCE_ONLY_STAGING_DRY_RUN commit=%s host_alias=%s relative_folder=%s\n' "$SHA" "$HOST" "$RUN"
  exit 0
fi
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=8 -o ServerAliveInterval=20 -o ServerAliveCountMax=3)
"${SSH[@]}" "$HOST" /bin/bash -s -- "$TARGET" <<'REMOTE_SETUP'
set -euo pipefail
TARGET="$1"
mount | grep -Fq ' on /Volumes/Expansion (exfat,' || { echo 'Jarvis physical Expansion not mounted'; exit 15; }
[[ "$TARGET" == /Volumes/Expansion/EXO-Engineering/SourceRebuilds/EXO-V2-* ]] || exit 16
test ! -e "$TARGET" || { echo 'Refuse: staging destination already exists'; exit 17; }
mkdir -p "$TARGET/source-public-safe" "$TARGET/inputs" "$TARGET/evidence" "$TARGET/builds"
REMOTE_SETUP
# Allowlist source/build inputs only. The historical installed source variants
# are retained; downloaded CLO3D project containers and user files are not.
git archive --format=tar "$SHA" \
 LICENSE README.md package.json package-lock.json index.html vite.config.mjs \
 src integrations/clothcraft native_app native_cpp native_backend ppf_backend blender_bridge \
 rust scripts tools apps techpack-studio website/clothcraft-characters \
 research/accumark-v10-playlist research/oss/clothcraft public \
 benchmarks/golden-garments docs/LICENSING.md \
 docs/reports/EXO_V2_INSTALLED_RUNTIME_SOURCE_PARITY_20261114.md \
 source-snapshots/exo-v2-installed-20261103 \
 | "${SSH[@]}" "$HOST" "set -euo pipefail; tar -xf - -C '$TARGET/source-public-safe'"
scp -q -o BatchMode=yes scripts/release/audit-exo-portable-expansion-source-20261114.py \
 "$HOST:$TARGET/inputs/audit-source.py"
"${SSH[@]}" "$HOST" /bin/bash -s -- "$TARGET" "$SHA" <<'REMOTE_VERIFY'
set -euo pipefail
TARGET="$1"
SHA="$2"
python3 "$TARGET/inputs/audit-source.py" \
 --source "$TARGET/source-public-safe" \
 --manifest "$TARGET/evidence/portable-source-manifest.json" \
 --git-commit "$SHA" --sanitize --omit-optional-media
ARC="exo-v2-public-portable-${SHA:0:8}.tar.gz"
cd "$TARGET/source-public-safe"
tar -cf - . | gzip -1 > "$TARGET/inputs/$ARC.partial"
gzip -t "$TARGET/inputs/$ARC.partial"
tar -tzf "$TARGET/inputs/$ARC.partial" >/dev/null
shasum -a 256 "$TARGET/inputs/$ARC.partial" > "$TARGET/evidence/$ARC.sha256"
mv "$TARGET/inputs/$ARC.partial" "$TARGET/inputs/$ARC"
printf 'SOURCE_ONLY_ARCHIVE_READY relative=%s sha256=' "$ARC"
awk '{print $1}' "$TARGET/evidence/$ARC.sha256"
REMOTE_VERIFY
printf 'EXO_PORTABLE_SOURCE_COMPLETE commit=%s relative_folder=%s\n' "$SHA" "$RUN"
