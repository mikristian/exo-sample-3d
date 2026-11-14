# EXO 2D CAD — storage and Tailnet read-only preflight (2026-10-23, 11:04 EDT)

**Status:** heavy native builds, desktop installations, backup pruning, and unattended bulk transfers **blocked**. This report authorizes no deletion, archive move, git action or factory release.

## Observed on Blender Mac

- Current repository: `/blender-mac-workspace/exo-clothcraft-v2` (resolved by shell to `~/Chat On Steroids Workspace/exo-clothcraft-v2`).
- `df -Pk .`: 8,462,252 KiB free on `/System/Volumes/Data` at the last sample, approximately **8.07 GiB**; 99% utilization displayed by `df -h`.
- Target safe build headroom: **25 GiB**. Shortfall is approximately **16.93 GiB**. Do not run Rust/C++/WASM/native build or signed app installation below the gate.
- `integrations/clothcraft/output`: approximately 3.9 GiB total; `output/app-backups` approximately 2.7 GiB. These are *candidates for review*, not confirmed disposable files.
- Eight individual old web-build snapshots each occupy approximately 266–381 MiB. The backup directory alone cannot recover the full headroom target.
- `node_modules`: approximately 161 MiB. No dependency cleanup or reinstall was attempted.
- `git status --porcelain=v1` reported more than 900 dirty/untracked paths during this pass. This makes blind cleanup, reset and unattended source overwrite especially unsafe.

## Tailscale

The local Tailnet listed `jarviss-macbook-pro` (`100.82.90.101`) as **offline, last seen approximately five hours earlier**. No SSH backup or remote file transfer was attempted during this pass. The previously verified physical Expansion mount is not a current guarantee of reachability or available space.

## Safe recovery sequence (not executed)

1. Re-establish authenticated Jarvis Tailnet/SSH reachability and confirm `/Volumes/Expansion` is the *physical mounted disk*, not a WebDAV alias.
2. Inventory exact, inactive generated build snapshots; exclude installed applications, source code, project garments, active rollback references, Rust queues and any user-authored data.
3. Stage immutable, no-overwrite `rsync` copies to unique destination directories on Expansion, retaining local originals.
4. Verify independent file counts and `rsync -rcn` content checksums; record a manifest with source and remote hashes.
5. Only after explicit review of a complete offload manifest consider removing individual verified inactive local copies. **This engineering pass does not authorize or perform removal.**
6. Remeasure local disk headroom before any heavy build. If below 25 GiB, continue only lightweight, source-level tests and read-only analysis.

## Why this is a blocker, not a failure of the spec

The industrial CAD specification requires deterministic source preservation, isolated worker ownership and independently reproducible release evidence. Skipping the disk gate could strand partial binaries or corrupt project checkpoints. No task may claim installed-app verification or overnight 24/7 execution while these resources remain unavailable.
