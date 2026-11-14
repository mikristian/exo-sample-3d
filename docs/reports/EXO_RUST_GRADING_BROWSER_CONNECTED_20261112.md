# Rust grading browser-connected acceptance — 2026-11-12

## Result of the single bounded execution

**BLOCKED at existing browser preflight.** The run returned exit code 2 with:

```json
{"pass":false,"uiEventVerified":false,"bridgeVerified":false,"nativeSessionVerified":false,"undoRedoVerified":false,"savedVerified":false,"existingBrowserReused":false,"blocker":"REUSABLE_BROWSER_CDP_UNAVAILABLE: fetch failed","stage":"existing browser preflight"}
```

The Mac has an existing Google Chrome process (PID 671 at inspection), but the process was not started with a remote debugging endpoint and no listener was found on the usual CDP ports 9222, 9223, or 9333. The available connector tools did not provide a Desktop browser tabs/snapshot interface. The installed app's production Node service was found on port 5386; it was deliberately not restarted, proxied, or used as a test target. Existing Vite on port 5173 belongs to another workspace and was likewise left alone.

The bounded test therefore stopped **before** spawning a Node server, opening an app page, creating a disposable workspace, writing any garment data, or clicking a UI control. No completed browser-to-Node-to-native grading claim can be made from this execution. `node --check scripts/qa-rust-grading-browser-connected-20261112.mjs` passed.

## Evidence and intended request chain

Source read-only inspection identifies the real EXO React action in `src/components/ClothCraftWorkspace.jsx`: `commitNativeGradeCatalog` calls `request({op:'save'})`, `prepareNativeGradeCatalog20261025`, then `request({op:'grade-run-commit',revision,gradeRun})`, followed by `request({op:'grade-run-status'})`. `integrations/clothcraft/workspace.mjs` verifies revision, protects the prior project, dispatches `grade-run-commit` to the native Rust RPC, obtains a Rust snapshot, and finishes the linked native disk/mirror commit. These are **source-derived request connections**, not an observed browser event in this run.

Existing `scripts/qa-native-grade-studio-loop-20261025.mjs` exercises the real React button `Edit Grading`, `Start zero-offset grading`, and `Save six-size catalog to Rust`, but starts a new Chrome; `integrations/clothcraft/qa-v2-browser-native-3d-marker-chain-run34-20261029.mjs` exercises grading-table save and live React `exo-clothcraft-command` Undo/Redo events, also with a new Chrome. Reusing those selectors and event names requires a controllable current browser session to independently confirm their behavior now.

## Concrete handoff

New script: `scripts/qa-rust-grading-browser-connected-20261112.mjs`. It uses `chromium.connectOverCDP` to attach to an **already running** CDP-enabled Chrome; it does not launch another Chrome or browser debug profile. On successful preflight it creates only a temporary browser context, an isolated Node grading bridge, an isolated Vite instance, and a real `exo-session` rooted in a temporary output directory. It captures real `/workspace` request/response operations from UI events, checks native catalog persistence, and attempts actual React Undo/Redo events with Rust save verification. It closes the temporary context and processes after the test.

Provide an existing, explicitly authorized browser automation endpoint via `EXO_REUSE_CHROME_CDP=http://127.0.0.1:<port>` and rerun:

```sh
EXO_REUSE_CHROME_CDP=http://127.0.0.1:9222 node scripts/qa-rust-grading-browser-connected-20261112.mjs
```

The URL above is an invocation example, **not** a presently available endpoint. If an already connected Desktop browser automation interface becomes available, the same acceptance can be adapted to its established tab without opening a debug session. Require passing real event receipts before marking the React UI grading path and native Undo/Redo connected.

Status: **React action source traced; live UI event, bridge receipt, save and Undo/Redo unverified**. No manufacturing approval, UI integration claim, or user-project mutation.
