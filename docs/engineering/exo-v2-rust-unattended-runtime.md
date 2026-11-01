# EXO Rust unattended runtime: verified 2026-10-21

## Active system, as installed by prime

The Jarvis-user launchd job `com.exo.clothcraft.rust-candidate-worker`
has been installed with a five-minute interval. It calls the isolated
Codex CLI 0.163.0 (authenticated using the pre-existing ChatGPT login)
via `scripts/autopilot/coding-worker.mjs`. The CLI successfully made
and unit-tested a real Rust edit without any interactive chat, and a
complete disposable fake-queue Codex run produced a new Rust crate,
a private 1,321-byte patch and a task marked BLOCKED for review.
The script is designed never to apply patches to the live source,
deploy, sign or modify installed apps, nor to mark its own
candidate complete. Prime also triggered the newly installed
LaunchAgent against the real queue; assess its actual outcome through
`~/Library/Application Support/exo-rust-candidates/launchd.stdout.jsonl`
and the coordinator, not merely launchd process state.

ChatGPT's separate hourly `EXO Rust Migration` task asks the connected
Chat On Steroids agent to review those candidates, compare against the
dirty working tree, run complete Rust/browser protocol QA, and apply
only independently verified safe changes. The candidate runner
operates from an explicitly scoped tracked committed HEAD snapshot,
omitting existing uncommitted app changes and the nested native solver.
This is **genuine headless candidate coding, not guaranteed automatic
production integration or 24/7 compute uptime**. Availability remains
dependent on local power, network and provider limits.

## Codex autonomous candidate worker (2026-10-20 update)

**Snapshot archive fix (2026-10-20):** The full `git archive HEAD` measured 781,312,000 bytes, exceeding the former 256 MiB subprocess buffer. The worker now archives only the vetted committed paths `src`, `rust`, `scripts`, `integrations/clothcraft`, `native_app`, `native_cpp`, `native_backend`, `ppf_backend`, `techpack-studio/src`, `docs/engineering`, `package.json`, `package-lock.json`, `index.html`, and `vite.config.mjs`. The measured archive is 44,984,320 bytes (1,696 files reported by prime); the worker caps its archive buffer at 96 MiB. Candidate `report.json` records `snapshotScope`, `snapshotExcluded`, and measured `snapshotArchiveBytes`. The untracked nested `research/oss/clothcraft` solver and all uncommitted changes are absent: this worker **cannot certify native solver coverage**, including RUST-006. Candidates remain review-only, never auto-complete. The full fake-queue run succeeded and saved a reviewable patch; the real LaunchAgent has also produced the RUST-007 candidate (see top section).

Prime verified Codex CLI 0.163.0 at `~/.local/share/exo-rust-codex/node_modules/.bin/codex`, ChatGPT login, and an actual disposable Rust edit using `codex exec`. Coding-agent invocation is now proven independently; the candidate worker below passed a full isolated Rust patch-generation test, and the installed LaunchAgent has now generated an actual review-gated RUST-007 candidate.

`scripts/autopilot/coding-worker.mjs` checks the queue for an existing active claim before attempting work, acquires an exclusive directory lock, checks the CLI/login, and claims one coordinator task using the coordinator's original claim protocol. It exports the source repository's **committed HEAD** into an isolated temporary Git snapshot. It then invokes Codex in workspace-write sandbox, with `--ignore-user-config --ephemeral --skip-git-repo-check`, a ten-minute default timeout (maximum one hour), and `PATH=$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin`. It captures a Git diff, including safe untracked source files via intent-to-add, in a private per-task folder at `~/Library/Application Support/exo-rust-candidates`, together with a structured report and Codex's final report (private, not printed). Environment variables passed to Codex are restricted to HOME, user, locale, TMPDIR, PATH and queue path. The user's dirty source worktree remains untouched. A candidate **always goes to coordinator `block` for prime review**, with its valid claim token; it is never auto-applied or incorrectly marked complete. Prime handles final integration, verification, and completion. Files that are symlinks, larger than 1 MiB each, or unsafe names are rejected from intent-to-add; they require manual inspection. Existing queue tasks active under other workers are never stolen or reset. Locks older than two hours can be recovered only when the recorded PID is no longer alive.

Offline tests and preview (no model calls):

```sh
node scripts/autopilot/coding-worker.test.mjs
node scripts/autopilot/coding-worker.mjs --dry-run
python3 scripts/autopilot/make-coding-launchd-plist.py > /tmp/exo-rust-candidate-worker.plist
plutil -lint /tmp/exo-rust-candidate-worker.plist
```

**Installed by prime after end-to-end disposable acceptance:** create the output folder first: `mkdir -p "$HOME/Library/Application Support/exo-rust-candidates"`; generate the plist to `~/Library/LaunchAgents/com.exo.clothcraft.rust-candidate-worker.plist`, then `launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.exo.clothcraft.rust-candidate-worker.plist"`. This job wakes every 300 seconds and exits immediately when the queue is blocked, empty, or another worker is active. To remove it, `launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.exo.clothcraft.rust-candidate-worker.plist"`. Launchd has now been installed and bootstrapped by prime; these commands remain useful when reprovisioning Jarvis. Candidate artifacts are private and should not be published until reviewed.

Operational limitation: this worker is deliberately **review-gated**, so it cannot continuously complete an unlimited queue without prime reviewing and requeuing tasks. The ten-minute synchronous CLI timeout provides a wall-time bound, but the process does not currently impose OS-level memory/CPU quotas or forcibly kill an entire descendant process group. Do not claim strict resource isolation or 24/7 completion until those limits and a fully supervised live candidate run have been validated.

## Observed capabilities

The Chat On Steroids macOS app is running, and launchd reports `com.openclaw.personal-captain.engine` and `com.openclaw.chat-on-steroids-memory-sync` as active services. Their existence **does not establish that they accept a supported unattended coding command**. No `openclaw`, `codex`, or `chat-on-steroids` executable was found on PATH or the inspected common Homebrew binary paths. This is a point-in-time observation, not proof an executable cannot exist elsewhere. The repository's `scripts/rust-migration-autopilot.mjs` is a task coordinator and explicitly says it does not launch an LLM. The previously configured hourly ChatGPT automation has not been validated as an always-on coding runtime.

**Historical status before the Codex installation:** no verified headless coding trigger. That gap is now resolved for *isolated candidates*, not for unattended merging. Never interpret a healthy process or claimed task as proof that a candidate was implemented or tested; rely on the saved patch, reports, and independent QA.

## Diagnostic watchdog

`scripts/autopilot/health-check.sh` probes exact known launchd labels, the
isolated Codex executable, and queue metadata only. It emits one bounded
JSON record without credentials or task contents. It does not mutate the
queue, run models or restart services. `coding_trigger_verified` becomes
true when the already-tested candidate-only LaunchAgent and executable
are present; `automatic_integration_verified` deliberately remains false.
Neither boolean is proof a particular migration task succeeded.

Manual dry run:

```sh
/bin/sh scripts/autopilot/health-check.sh
python3 scripts/autopilot/make-launchd-plist.py > /tmp/exo-rust-health-watchdog.plist
plutil -lint /tmp/exo-rust-health-watchdog.plist
```

Optional installation on the appropriate logged-in macOS user (operator action, **not performed by this worker**):

```sh
mkdir -p "$HOME/Library/LaunchAgents"
python3 scripts/autopilot/make-launchd-plist.py > "$HOME/Library/LaunchAgents/com.exo.clothcraft.rust-health-watchdog.plist"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.exo.clothcraft.rust-health-watchdog.plist"
```

This runs hourly and at agent load. The JSONL and stderr paths are generated inside `scripts/autopilot/`; rotate them as needed and exclude them from commits. To stop it: `launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.exo.clothcraft.rust-health-watchdog.plist"`. The diagnostics process is short-lived, performs no network calls and never runs the model. Its status is not a coding heartbeat.

## Conditions required before enabling an actual coding worker

## Personal Captain service inspection (follow-up)

The actual user LaunchAgent `com.openclaw.personal-captain.engine` launches Node against `bin/captain.mjs serve --host 127.0.0.1 --port 4739` within a separate Personal Captain installation. Its source explicitly documents media-editing commands such as `create-job`, `index-media`, `transcribe`, `analyze-beats`, `validate-plan`, and `doctor`. The small local HTTP server provides `GET /health` and `POST /run`; the latter uses an allowlist of media tasks and verification utilities and invokes the CLI through Node's child-process API. It is **not a shell-free coding task endpoint**, and no `submit-prompt`, `coding-task`, or general agent-runner command appears in the inspected CLI dispatcher or server allowlist. It does not accept Rust migration instructions through its documented commands.

The safe smoke check `python3 scripts/autopilot/probe-personal-captain.py` sends one HTTP `GET /health` to the known loopback port, validates the service identity, and prints only whitelisted response facts. It never sends a `POST /run`, executes media commands, or prints the returned installation path. The observed response was HTTP 200 with identity `personal-captain-engine`. This proves only that the media service is accessible, not that model coding can be triggered. The health route has no authentication, while `/run` is a command dispatcher, so do not expose this service outside loopback or repurpose it as a general task API.

**Historical blocker, solved by installing authenticated Codex CLI:** the Personal Captain service itself lacks a general coding interface. A Personal Captain media HTTP endpoint cannot supply one. The separate Codex CLI now provides the supported noninteractive coding interface; credentials should stay in that runtime's secure storage and should never be copied into the watchdog. No extra credential is required for this read-only probe. No server configuration or running service was changed.

Obtain a documented, supported headless interface that can start an authorized model job for this repository under a known user account. In an isolated test, prove the interface starts a worker without a foreground chat, edits a disposable checkout, runs acceptance tests, records evidence, survives process restart, and rejects concurrent claims. Bound CPU/memory, retry frequency, credentials, and spending; require human review before publishing or destructive operations. Only then create a separate launchd worker and mark continuous coding as verified. The current scripts do none of this.
