#!/usr/bin/env bash
# Non-destructive Git sync gate for EXO. Never force-push or stage automatically.
set -euo pipefail
action="${1:-check}"
case "$action" in check|push) ;; *) echo 'Usage: exo-guarded-sync-20261101.sh [check|push]' >&2; exit 64;; esac
root="$(git rev-parse --show-toplevel)"
cd "$root"
branch="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ -z "$branch" ]]; then echo 'BLOCKED: detached HEAD' >&2; exit 2; fi
remote="${EXO_SYNC_REMOTE:-origin}"
ref="refs/heads/$branch"
echo "EXO sync gate: $remote/$branch"
if [[ "$action" == push ]]; then
  if [[ -n "$(git status --porcelain=v1 --untracked-files=all)" ]]; then
    echo 'BLOCKED: working tree is dirty; snapshot/review and commit scoped files first.' >&2
    exit 2
  fi
fi
if ! git diff --check; then echo 'BLOCKED: whitespace or patch errors' >&2; exit 2; fi
remote_sha="$(git ls-remote --heads "$remote" "$branch" | awk '{print $1}')"
if [[ -z "$remote_sha" ]]; then echo 'BLOCKED: remote branch not found; refusing automatic creation' >&2; exit 2; fi
local_sha="$(git rev-parse HEAD)"
echo "Local:  $local_sha"
echo "Remote: $remote_sha"
if [[ "$local_sha" == "$remote_sha" ]]; then
  echo 'SYNCED: local HEAD equals GitHub remote branch (uncommitted changes are NOT included).'
  exit 0
fi
if ! git cat-file -e "$remote_sha^{commit}" 2>/dev/null; then
  echo 'BLOCKED: remote commit is not available locally. Fetch/review first; no automatic merge.' >&2
  exit 2
fi
if git merge-base --is-ancestor "$remote_sha" "$local_sha"; then
  if [[ "$action" == push ]]; then
    git push "$remote" "HEAD:$ref"
    echo 'PUSHED: fast-forward only; confirm remote state with check.'
  else
    echo 'LOCAL AHEAD: can fast-forward remote after reviewed commit; no files changed.'
  fi
else
  echo 'BLOCKED: remote has commits not contained in local HEAD; fetch/rebase after snapshot and review. Never force-push.' >&2
  exit 2
fi
