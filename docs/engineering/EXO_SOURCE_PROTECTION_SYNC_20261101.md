# EXO ClothCraft V2 — source protection and synchronization

Status (2026-11-01): **local changes protected by a recovery archive; GitHub NOT yet synchronized**.

## What is running and what is version-controlled

- Development worktree: `exo-clothcraft-v2`, branch `feature/studio-v2-clo-visuals`.
- GitHub remote: `mikristian/exo-sample-3d`.
- Installed macOS app: `~/Applications/EXO ClothCraft Studio V2.app`, which contains a copied web bundle and services. Installing/rebuilding is a separate explicit step from Git synchronization.
- Initial snapshot: `~/EXO-Recovery/20261101-131041/`. Contains `pre-sync-tracked.patch` (tracked changes), `untracked-source.tar.gz` (selected untracked code files), corresponding file list, original local HEAD and original remote SHA. This is **source protection**, not a complete backup of downloadable assets, installed programs or generated research data.

## Rules during architecture stabilization

1. Never run blanket `git add .`, `git clean`, `git reset --hard`, forced pushes, or destructive branch switches on a live, dirty worktree.
2. Check the remote before synchronizing: `bash scripts/engineering/exo-guarded-sync-20261101.sh check`.
3. Use reviewed, narrowly scoped `git add -- <paths>`, inspect `git diff --cached --stat`, `git diff --cached --check`, and commit on a recovery or dedicated integration branch. Review for secrets/private data and massive binaries before adding files.
4. If the remote is ahead or diverged, fetch **without changing the dirty worktree**, review the new commit, and integrate into a separate clean worktree after preserving the snapshot. Do not overwrite the local source.
5. Push only once local HEAD includes the fetched remote tip, review/tests pass and the worktree is clean: `bash scripts/engineering/exo-guarded-sync-20261101.sh push`. This script refuses remote divergence and never forces a push.
6. Confirm the resulting GitHub SHA separately from the installed app. Rebuild/install the app only after smoke tests; record its web-resource build identity and source commit.

## Sync cadence

- **Start of work:** `check`, and refresh the recovery snapshot before high-risk refactors.
- **After a verified milestone:** review changed files, run affected tests, commit and guarded-push; record commit SHA.
- **Before architecture/Rust migration:** freeze feature merges, resolve the remote-ahead commit, preserve the installed app, and establish one immutable review baseline.
- **End of work:** run `check`; a green result only certifies Git HEAD parity, not installed-app parity or uncommitted files.

## Risks still open

- More than 3,000 uncommitted/untracked worktree entries existed at snapshot time. These may include other agents' work and unrelated experiments.
- Remote `feature/studio-v2-clo-visuals` contained commit `901443b` absent from local HEAD `53041a6` when protection started.
- Recoverable source snapshot excludes unselected binary assets, external downloads and ignored files. Preserve separately if needed.
- An installed app's bundle may not contain the latest development files. Check installed build provenance, not just branch name.
