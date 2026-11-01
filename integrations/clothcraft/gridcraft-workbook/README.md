# EXO GridCraft workbook CLI

## Verified integration (no build required)

`workbookCli.mjs` invokes the already installed native `gridcraft-cli` through its documented `run --script` command. Import `recalculateWorkbook` and pass `string[][]`; it returns `{values: (number | string | boolean | null)[][]}`. Each input is applied by GridCraft's `cell.set` engine command and all formula references, ranges and dependencies are calculated by the native engine. Temporary command scripts are private (`0600`) and removed after the run. The subprocess has a timeout and does not use a shell. Run `node --test workbookCli.test.mjs` for live verification.

## Optional Rust adapter source (not yet built)

Pinned source: [storytold/gridcraft](https://github.com/storytold/gridcraft), commit `1f4c67ef0a0200e48d832c7cbbb5570b743b7837`, GridCraft 0.13.0. Source is checked out at `upstream/` and licensed MIT OR Apache-2.0.

Build from the pinned upstream workspace: `~/.cargo/bin/cargo build --release --manifest-path upstream/Cargo.toml -p exo-gridcraft-workbook` (compile only the adapter and GridCraft calculation dependencies; no UI). The expected binary is `upstream/target/release/exo-gridcraft-workbook`. This build has **not been verified**: upstream Cargo workspace patch overrides reference Git revisions of egui that are unavailable in the local offline cache. The verified installed-CLI adapter above is the recommended production interface.

Protocol: one JSON object on stdin, for example `{"cells":[["2","3","=SUM(A1:B1)"],["=C1*2","=SUM(A1:C1)"]]}`. On success stdout is `{"values":[[2,3,5],[10,10]]}`. Formula values include A1 references, rectangular ranges and recalculation across dependent cells. A blank is `null`, a number/bool/string is its JSON primitive, and a spreadsheet error is an error string such as `#DIV/0!`. Invalid input exits nonzero with a short stderr code; the process must be invoked without a shell and with a caller-side timeout.

Bounds: maximum 100 rows, 50 columns, 4,096 bytes per cell, and 256,000 bytes aggregate. Only the supplied rectangle is emitted. The adapter deliberately does not parse or maintain styles, formatting, table semantics, or project provenance; the caller owns those separately. Isolate process per request to prevent cross-request workbook state leakage.

This adapter links GridCraft's real `gridcraft-calc`, `gridcraft-model`, and `gridcraft-core`; it does not emulate the spreadsheet formula engine. Run a smoke test after building with `printf '%s' '{"cells":[["2","3","=SUM(A1:B1)"],["=C1*2","=SUM(A1:C1)"]]}' | upstream/target/release/exo-gridcraft-workbook`.
