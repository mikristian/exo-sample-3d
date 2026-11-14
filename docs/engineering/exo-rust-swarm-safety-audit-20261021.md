# EXO Rust migration swarm safety audit — 2026-10-21

## Scope and verified observations

Read-only inspection of `scripts/rust-migration-autopilot.mjs`, `scripts/autopilot/coding-worker.mjs`, the coordinator tests and the live queue. This document is a scheduling proposal, not an implemented 20-worker dispatcher or evidence of 20 simultaneous model slots. The host constraint reported for this review is **16 GB RAM and approximately 1.4 GB free internal disk**; rerun resource checks before each action because these numbers change.

The queue currently shows **RUST-033 active**, token `3b452732-03de-4597-b3f7-30f6f5f3d605`, with ownership of `src/core/physics.js`, isolated `rust/exo_structural_strain_kernel`, its bridge/build script and strain QA. Treat these paths and any adjacent shared build artifacts as reserved until the owner and prime report completion. Reading the queue is observational: this audit did not claim, requeue, complete or block that task.

## Existing exclusion and failure behavior

* The coordinator creates `<queue>.lock` via atomic `mkdirSync`; mutations read and atomically rename the queue under this lock. `claim` explicitly rejects any second **active** task, not merely the same task. `progress`, `complete` and `block` require matching task ID and run token. `requeue` of an active task requires that token and puts the burden of stopping the old worker on the caller. Lock directories have **no stale-lock recovery**, so a crash between `mkdir` and `rmdir` can prevent all future mutations until a human verifies ownership and recovers the lock.
* `status` and `next` are unlocked reads. An atomic rename protects readers from a partial JSON write, but the `next` result is only advisory: another worker can claim in between. The later locked `claim` is authoritative. The queue has no machine-readable file ownership sets, resource reservations, worker heartbeat, lease expiry, dependency DAG or merge conflict detector.
* `coding-worker.mjs` independently acquires a single `<output>/worker.lock`, records a PID, and skips if another detached worker holds it. It recovers only locks older than two hours with a dead recorded PID or missing/invalid PID. Lock recovery uses `rmSync` followed by `mkdirSync`, which is **not atomic ownership transfer** under multiple stale-lock contenders. The process-wide `finally` removes the lock directory; never run this worker with a second process managing the same output lock.
* The detached worker checks `next`, then performs its own queued `claim`; it skips when **any** queue task is active. It snapshots committed Git `HEAD` via `git archive`, explicitly excluding uncommitted and untracked source. This means its candidate cannot safely assume current RUST-033 in-progress changes or new crates are present. `sourceDirty` is recorded but does **not** stop snapshot creation. The candidate runs in disposable temp storage; generated patch/report artifacts are review-only and the task becomes `blocked`, not `done`. No automatic patch integration occurs.
* Worker timeouts default to 600 seconds (allowed 10 seconds to one hour); snapshot tar may buffer up to 96 MiB, Codex output up to 4 MiB, patch capture up to 20 MiB. Snapshot initialization, Rust builds, dependency caches and temp extraction have no stated disk or memory budget. A long-running build or orphaned child can still consume resources beyond the nominal coordinator critical section. The `finally` removes temp files, but the output artifact remains.
* Candidate path validation rejects specified forbidden paths, symlinks and oversized **new** files, but does not enforce the task-specific allowed file set for modified existing files. It is therefore insufficient for automatically merging two candidate patches. `git archive HEAD` may not include relevant uncommitted tests, and a snapshot-based PASS does not prove live worktree or source Chrome integration.

## Operational model: 20 workstreams, at most two active people/agents

Maintain a **backlog of 20 independently scoped workstreams** as planning cards. Only **two lightweight workers** may be active across the entire shared host: one owner working on a narrow source change, and one read-only auditor/QA author on disjoint files. With RUST-033 active, its source owner is worker 1 and the only permitted worker 2 is independent review/QA/documentation outside the owned paths. Do not start a detached Codex snapshot runner alongside those two, even if its own lock is free. Its queue `claim` should naturally reject active RUST-033; retain that guard.

Suggested workstream slots, each awaiting an audit of current ownership before becoming executable:

| Slot | Workstream | Scheduling prerequisite |
| --- | --- | --- |
| 01 | RUST-033 structural strain | **Reserved** until existing owner closes claim |
| 02 | Structural strain Chrome source QA | Separate new QA file; coordinate exported API with owner |
| 03 | Structural strain native parity review | Read-only; no build under low disk |
| 04 | Physics architecture regression review | Read-only while 01 is active |
| 05 | Physics fallback and NaN audit | Read-only while 01 is active |
| 06 | Physics bridge ABI inventory | Read-only while 01 is active |
| 07 | Solver provenance and certification gap | Read-only, no solver claims |
| 08 | Pattern construction numeric candidate | Only after source ownership assigned |
| 09 | Curve/edge geometry candidate | Distinct source ownership verified |
| 10 | Drafting transform candidate | Distinct source ownership verified |
| 11 | SVG import numeric candidate | Parser/security retained in JS |
| 12 | Staging/interpolation candidate | Disjoint owned files verified |
| 13 | Quality-gate candidate | Certification policy stays in JS |
| 14 | Contact/collision candidate | Coordinate with solver owner |
| 15 | Garment metadata serialization audit | Read-only before any write plan |
| 16 | Project undo/restore parity audit | Read-only before any write plan |
| 17 | Rust crate dependency/license audit | No downloads; inventory local manifests |
| 18 | Build/packaging reproducibility audit | Read-only; no shared script edits |
| 19 | Browser differential QA backlog | New isolated file per claimed test |
| 20 | Performance/resource benchmarking plan | Design only until resource gates clear |

These are **planning lanes rather than 20 automatically claimed queue tasks**. Slots 02–07 and 17–20 can supply low-cost audit work while code ownership is blocked. Never issue parallel queue claims to simulate 20 lanes: the live coordinator supports precisely one active task.

## Mandatory admission gates

1. **Queue gate:** Obtain fresh `status` immediately before work. If RUST-033 remains active, preserve its token and stop any new source-changing migration claim. If it is unexpectedly stale, request prime/owner confirmation that the running process stopped before attempting token-authorized `requeue`; do not infer abandonment from elapsed time alone.
2. **Ownership gate:** Record exact allowed file paths for both active workers and check overlapping file, generated bridge, WASM artifact, build script, package and queue dependencies. Any overlap means reduce to one worker or schedule the second as read-only. Assign one owner for `src/core/physics.js`; no second writer to it during RUST-033.
3. **RAM gate:** Inspect available memory and memory pressure before running code/builds. On this 16 GB Mac, permit no concurrent Rust/Vite/browser/Node heavy test processes; if memory pressure or swapping is elevated, pause workers and remain read-only. There is no evidence supporting 20 concurrent builds.
4. **Disk gate:** With roughly 1.4 GB free, **block snapshot extraction, Rust compilation, npm/Vite builds, dependency installation and candidate generation** until space is reclaimed safely by a separately authorized process and measured. Conservative initial admission target: at least 8 GB free on both the snapshot/temp volume and build/cache volume, plus projected peak requirement and 2 GB headroom; check actual volume via `df`, not just repo location. Do not delete unknown caches or user files to meet this gate.
5. **Worker gate:** Cap at two logical workers, with **one** potentially writing code and the other limited to read-only/isolated QA documents. One heavyweight job in flight globally; add a separate explicit resource reservation before considering detached candidate execution. A launch frequency (hourly or otherwise) is not concurrency or completion assurance.
6. **Safety gate:** Require verified base commit and live `git status`, ownership-aware diff allowlist, license/security suitability review for any external GitHub source, no secret-bearing or user-garment paths, and rollback notes. Treat generated snapshots as untrusted candidate patches for human/prime integration.
7. **Validation gate:** Demand task-specific Rust unit and seeded frozen JS parity, real source Chrome path where relevant, existing architecture/physics checks, relevant native C++ parity and build only when resource gates pass. Distinguish *not run*, *blocked by disk*, *candidate-only PASS* and *live integrated PASS*. Do not equate numerical parity with certified cloth fit.
8. **Closure gate:** Worker 1 reports changed files and exact tests; worker 2 independently reviews the diff, conflicts and behavior; prime alone integrates, reruns appropriate live gates and uses `complete` with matching run token. If evidence is incomplete, mark `blocked` with reason; never fabricate completion to free a slot.

## Safe next actions with RUST-033 active

First, limit concurrent work to the RUST-033 implementation owner and a disjoint QA/documentation worker. Second, inspect fresh file ownership and queue state before allocating another task. Third, defer all build, archive, installation and browser-heavy activity until measured disk and RAM gates pass. Fourth, once the current task genuinely completes, let prime schedule the next code owner and auditor pair, one workstream at a time. Fifth, add future coordinator support for file ownership, process liveness, resource reservations and atomic stale-lock recovery **in a separately reviewed change**, after current migration ownership clears. No queue or implementation changes were made by this audit.

## Evidence and limitations

Source references: `scripts/rust-migration-autopilot.mjs` lines 11–39, 55–112; `scripts/autopilot/coding-worker.mjs` lines 10–25, 30–81, 82–125; queue entry `RUST-033`; coordinator test `scripts/rust-migration-autopilot.test.mjs`. Inspection only; no benchmark, dry run or mutation test was executed. Resource numbers come from the task's stated host context and are **not fresh telemetry**. Lock races described here are potential paths based on source code, not observed exploit or recorded data loss.
