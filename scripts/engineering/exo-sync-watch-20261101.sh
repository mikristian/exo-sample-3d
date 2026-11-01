#!/usr/bin/env bash
# Non-destructive EXO synchronization monitor. Never commits or pushes dirty edits.
set -euo pipefail
cd "$(dirname "$0")/../.."
root="$(git rev-parse --show-toplevel)"
cd "$root"
branch="$(git symbolic-ref --short HEAD)"
remote="${EXO_SYNC_REMOTE:-origin}"
current="$(git rev-parse HEAD)"
remote_head="$(git ls-remote --heads "$remote" "$branch" | awk '{print $1}')"
if [[ -z "$remote_head" ]]; then echo "BLOCKED: missing remote $remote/$branch"; exit 2; fi
if [[ -n "$(git status --porcelain=v1 --untracked-files=all)" ]]; then
  echo "PENDING: $branch has uncommitted work. Changes are preserved locally; no automatic push."
  exit 0
fi
if [[ "$current" == "$remote_head" ]]; then
  echo "SYNCED: clean local HEAD matches $remote/$branch."
  exit 0
fi
if ! git cat-file -e "$remote_head^{commit}" 2>/dev/null; then
  echo 'PENDING: remote contains a new commit not fetched locally. Review before integration.'
  exit 0
fi
if git merge-base --is-ancestor "$remote_head" "$current"; then
  if [[ "${EXO_SYNC_AUTO_PUSH:-0}" == 1 ]]; then
    git push "$remote" "HEAD:refs/heads/$branch"
    echo 'SYNCED: pushed reviewed clean fast-forward commit.'
  else
    echo 'PENDING: clean local commits ready; set EXO_SYNC_AUTO_PUSH=1 to permit guarded pushes.'
  fi
else
  echo 'PENDING: branch is behind or diverged. No automatic merge, pull, reset or force-push.'
fi
