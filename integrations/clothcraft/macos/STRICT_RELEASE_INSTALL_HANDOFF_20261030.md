# Staged release ABI handoff (not an installer)

`EXO_STRICT_RELEASE_MODE=1` is opt-in and valid only alongside
`EXO_BUILD_STAGING=1`. The builder requires an externally reviewed
`EXO_REVIEWED_RELEASE_IDENTITY` (64 lowercase SHA-256 hex digits). The value
must be derived from and reviewed against the completed candidate manifest;
manually entering a hash does not certify, attest or authorize production.

The staging builder checks the lock after packaging/signing and full resource
provenance verification using `v2-release-abi-gate-20261030.mjs --offline`.
An incorrect lock causes a nonzero exit and leaves the candidate for analysis;
the builder never moves, removes or promotes the installed application.
Normal developer builds continue without this optional gate. Before a build,
`v2-release-candidate-preflight-20261030.mjs` checks that strict mode has the
staging flag and syntactically valid identity; it cannot prove a candidate's
final bytes until the candidate exists.

Future **atomic install/switch** operation must be a separate authorized
transaction. Require (1) stopped and isolated candidate services, (2) signed
bundle verification, (3) byte-verified candidate resources against the reviewed
lock, (4) verified live candidate bridge identity and native executable process
binding, (5) user garment/history preservation, (6) an existing-app rollback
anchor and sufficient disk space, and (7) same-volume atomic rename/switch
with post-switch health and rollback on any failed check. Recheck the candidate
immediately before the switch; reject symlinks and mismatched roots. No current
script performs this install operation, and no token or manual lock is a
substitute for independent release review.
