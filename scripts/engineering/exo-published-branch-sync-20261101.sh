#!/usr/bin/env bash
# Published EXO baseline synchronization monitor: never stages or rewrites files.
set -euo pipefail
cd "$(dirname "$0")/../.."
branch="$(git symbolic-ref --quiet --short HEAD)"
remote="${EXO_SYNC_REMOTE:-origin}"
if [[ "$branch" != backup/exo-v2-integrated-20261101-1340 ]]; then
  echo 'BLOCKED: unexpected branch for published baseline'; exit 2
fi
dirty="$(git status --porcelain=v1 --untracked-files=all)"
if [[ -n "$dirty" ]]; then echo 'PENDING: unpublished changes; no automatic stage or push'; exit 0; fi
local_sha="$(git rev-parse HEAD)"
remote_sha="$(git ls-remote --heads "$remote" "$branch" | awk '{print $1}')"
if [[ -z "$remote_sha" ]]; then echo 'BLOCKED: GitHub branch missing'; exit 2; fi
if [[ "$local_sha" == "$remote_sha" ]]; then
 echo "SYNCED: $branch at $local_sha"; exit 0
fi
if git cat-file -e "$remote_sha^{commit}" 2>/dev/null && git merge-base --is-ancestor "$remote_sha" "$local_sha"; then
  git push "$remote" "HEAD:refs/heads/$branch"
  echo "SYNCED: safely pushed clean fast-forward $local_sha"
else
  echo 'BLOCKED: GitHub advanced or diverged; do not force-push'; exit 2
fi
