# EXO ClothCraft V2 — recurring Rust migration system

This is the source-of-truth handoff for ChatGPT's recurring task and the
connected **Chat On Steroids Core** coding tool on Jarvis.

## Operating model

The configured ChatGPT task requests source review/integration **hourly**
(the highest supported ChatGPT task cadence). An additional macOS
LaunchAgent `com.exo.clothcraft.rust-candidate-worker` now attempts
actual Codex CLI headless coding **every five minutes** in a private
committed-HEAD snapshot. Headless coding and an independent full fake-queue
candidate run passed. Its output is a private reviewable patch, not an
automatically merged or deployed garment-app change. It cannot promise
uninterrupted model use, and needs Jarvis awake and connected.

The durable queue lives at
`docs/engineering/exo-v2-rust-autopilot-queue.json`. The coordinator is
`scripts/rust-migration-autopilot.mjs`. Every run continues from this queue
instead of assuming that a previous chat session is still live. Candidates
are private under `~/Library/Application Support/exo-rust-candidates/`.
They are built from committed HEAD only, excluding existing uncommitted
work and the nested native solver; staged patches always require
independent review, conflict checking and complete source QA.

## Run contract

1. From the EXO repository root, use Chat On Steroids Core to run
   `node scripts/rust-migration-autopilot.mjs status`. If paused, stop.
   **Review blocked staged candidate patches first** (`candidate.patch`,
   `report.json`, `agent-report.txt`), inspect source baseline and
   conflicts, verify tests, then reconcile with the coordinator. Blocked
   technical audits without an actual candidate must not be auto-completed.
   Never start a competing active task.
2. Read applicable repository instructions and current `git status`.
   Preserve all unrelated changes. Keep existing garments, backups, running
   services and the signed production/QA applications intact.
3. Claim the next task with
   `node scripts/rust-migration-autopilot.mjs claim`. The command returns
   a UUID run token and an explicit acceptance contract.
4. Implement one bounded, real Rust conversion directly in the project's
   existing production call path. Use isolated source modules where
   possible. Keep initial synchronous JavaScript compatibility behavior
   until the Rust module and browser bootstrap are proven. Never infer
   completeness from the existence of a Rust crate alone.
5. Validate with Rust unit tests, Rust/JS differential tests and real
   integration tests; run relevant web build, existing authoring, sewing,
   persistence and export checks. Preserve exact report shapes/error text
   when migrating contracts. Audit existing user changes before any edit.
6. Record a successful slice with
   `node scripts/rust-migration-autopilot.mjs complete TASK_ID RUN_UUID
   "source files, tests, exact PASS evidence"`. For a real blocker, run
   `block TASK_ID RUN_UUID "specific failure"`. For partial ongoing work
   run `progress TASK_ID RUN_UUID "current state"` and reconcile the
   active task at the next hourly pass.
7. When the finite queue is exhausted, use a fresh source inventory and
   actual call graphs to append concrete tests-first tasks using
   `node scripts/rust-migration-autopilot.mjs add RUST-007
   "Title" "Concrete implementation" "Acceptance"`. Continue until
   **all five** verified completion gates in the queue pass. An empty queue
   by itself does not mean the conversion is complete.

## Common commands

```bash
node scripts/rust-migration-autopilot.mjs status
node scripts/rust-migration-autopilot.mjs next
node scripts/rust-migration-autopilot.mjs claim
node scripts/rust-migration-autopilot.mjs progress RUST-001 RUN_UUID "partial verified work"
node scripts/rust-migration-autopilot.mjs complete RUST-001 RUN_UUID "tests all pass"
node scripts/rust-migration-autopilot.mjs block RUST-001 RUN_UUID "exact failure"
node scripts/rust-migration-autopilot.mjs requeue RUST-001 RUN_UUID "previous worker ended"
node scripts/rust-migration-autopilot.mjs pause
node scripts/rust-migration-autopilot.mjs resume
node --test scripts/rust-migration-autopilot.test.mjs
```

The coordinator writes atomically and accepts only one active task. A
leftover `.lock` folder from abrupt process termination must be investigated
and cleared deliberately after confirming no coordinator is running.
The run token prevents another instance from incorrectly completing work.
Tests operate only on temporary fixture queues.

## Guards and stopping

The recurring run may inspect, edit and locally test source. It must not
force-push, deploy, replace signed desktop installations, overwrite saved
garments or delete user assets. Publishing/release requires the separate
existing acceptance process. Do not claim any rust percentage from source
file counts alone.

If the user asks to stop, pause the coordinator, disable the ChatGPT
scheduled task, and boot out the local candidate LaunchAgent using
`launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.exo.clothcraft.rust-candidate-worker.plist"`.
The diagnostic watchdog can be disabled separately. If a run lacks a
live Chat On Steroids Core connection, it
must say so and leave the queue untouched. If actual conversion is
demonstrably complete against all five gates, publish the evidence to the
user and disable the scheduled task.
