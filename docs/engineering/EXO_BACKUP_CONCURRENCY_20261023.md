# EXO backup concurrency and integrity audit — 2026-10-23

Scope: read-only assessment of `scripts/overnight-cad/backup-verified.mjs`, plus isolated test coverage in `scripts/overnight-cad/backup-concurrent-integrity-20261023.test.mjs`. No backup was sent; mock `processRunner` records SSH/rsync commands and uses a temporary local fixture. The shared production runner and existing tests were left untouched.

## Verified protections

- Sources are explicitly allowlisted and checked for symlinks, regular files, and containment in the repository; paths with traversal characters are rejected.
- Local SHA-256 digests build a manifest, whose canonical JSON file array determines the SHA-256 snapshot directory suffix. Distinct content results in distinct destination names.
- Copy mode demands an SSH identity, uses pinned SSH options, creates the remote snapshot directory with exclusive `mkdir` (an existing directory fails before rsync), and copies with `--ignore-existing`.
- Verification uses `rsync -r -c -n` without `--ignore-existing`, rejecting nonempty difference output. After copying, local entries are re-enumerated and all bytes re-hashed; modified, removed, or added files fail verification.
- All failures tested throw and do not return the `verified_by_rsync_checksum_dry_run` status. No deletion command exists in the production runner.

## Gaps and risk boundaries

1. **No atomic source freeze.** Source changes can occur between initial hash and rsync, during rsync, or after the final local hash. The post-copy pass catches changes still present at its check, including same-size rewrites, but cannot detect an ABA rewrite (file changes and then returns to its original bytes) or modifications after the final check. A truly point-in-time consistent backup needs immutable local staging, filesystem snapshots, or guarded source locking honored by writers.
2. **Remote tree identity is not pinned.** The command checks `test ! -L '${REMOTE_BASE}'` and exclusive `mkdir`, but does not verify every ancestor path, remote mount identity (that Expansion remains the physical target), or directory identity before every subsequent mkdir/rsync. A concurrent remote actor may replace a parent or snapshot subtree between commands. Exclusive creation prevents simple collision but is not a transactional filesystem lock.
3. **Process runner is trusted.** A zero exit code and empty rsync stdout are interpreted as an accurate remote comparison. Current isolated tests mock those returns and therefore demonstrate control flow and failure behavior; they cannot certify SSH/rsync or remote disk integrity.
4. **Rsync output contract is narrow.** The runner treats nonempty `--out-format=%n` stdout as mismatches and an empty stdout as equality. Real macOS/openrsync versions and warning/status behavior should be checked on a deliberately disposable remote fixture; stderr with a zero exit code is not examined.
5. **Manifest is returned but not independently retained remotely.** The snapshot directory uses an SHA based on the manifest, but a signed or durable remote manifest is not uploaded and independently validated. External audit or restore tooling cannot establish provenance from remote files alone.
6. **Race during directory traversal and hashing.** `realpath(base)` happens before recursive walking, which uses filesystem names again; a concurrent local actor who can swap directories or symlinks between checks can create a TOCTOU path race. Secure descriptor-based traversal or an immutable staging tree would be stronger.

## Recommended safeguards

Before unattended factory-critical use: stage an immutable same-volume snapshot (checking available disk space first), hash from that frozen tree, upload a manifest into a uniquely created destination, and verify against remote files from that same snapshot. Validate the remote mount's device identity and all path components before and after transfer; keep exclusive remote snapshot creation and fail closed on any identity drift. Record incomplete snapshot failures in a separate append-only log. Keep factory release gated independently of backup success.

## Test commands

Run `node --test scripts/overnight-cad/backup-concurrent-integrity-20261023.test.mjs` and `node --test scripts/overnight-cad/backup-verified.test.mjs`. All tests run in small OS temp directories, never invoke real SSH/rsync, and create no production backup. These checks deliberately do not call `backupVerified({copy:true})` without an injected mock transport.
