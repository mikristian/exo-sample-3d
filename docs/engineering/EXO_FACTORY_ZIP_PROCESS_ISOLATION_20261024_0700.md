# Factory ZIP process isolation: independent assessment (2026-10-24 07:00)

## Scope and invariant

The process-isolated ZIP audit is intended as a bounded validation step ahead of later factory-package operations. Even a successful audit must return `manufacturingApproved: false`. It cannot establish actual manufacturing approval, which requires independent downstream verification and authorization.

The independent test suite `src/core/factoryZipIsolatedIndependent20261024_0700.test.mjs` covers a generated Foundation Tee six-size factory ZIP, small six-size DEFLATE ZIP, matching forged local and central decoded-size fields, corrupted compressed payloads, invalid inputs, byte-offset views, bounded deadline behavior, and unchanged input bytes. It invokes the public entry point `auditFactoryZipInIsolatedProcess20261024_0700`. The current factory fixture contains 61 ZIP entries; only three slots remain under the 64-entry preflight cap.

## What isolation provides

Executing the decompression and CRC/size checks in a separate Node process creates a distinct JavaScript heap and failure boundary. A configured V8 old-space heap cap can limit that worker's managed heap growth. A parent-enforced wall-clock deadline can stop an unresponsive child and cause the caller to reject the archive. On child crash, signal exit, malformed child response, abnormal exit, spawn error, timeout, or ZIP verification failure, the parent must return a structured failure with `ok: false` and `manufacturingApproved: false`.

These protections depend on correct parent orchestration: the parent must enforce a finite limit, close or terminate the child on deadline and exceptional paths, handle IPC/stdio failure, validate the child response, and never accept a partial successful report. The parent should bound input before process transfer and should avoid copying unbounded buffers into IPC or command arguments. ZIP metadata preflight must precede decompression, and decoded size, CRC, expansion ratio, total size and entry count require independent checks.

## Limits and residual risk

`--max-old-space-size` (or an equivalent V8 heap setting) is **not an OS memory limit**. Native allocations, Buffer/ArrayBuffer memory, C++ runtime resources, page cache, process overhead, and the parent process can exceed the configured V8 old-space cap. A subprocess alone provides **no hard RSS, virtual-memory, CPU-time, disk-I/O, or operating-system process isolation**. The deadline is an elapsed-time watchdog, not a CPU quota; scheduling delays and termination/reaping behavior can extend actual resource usage. A per-process heap limit does not constrain the entire process tree if child process spawning is permitted. True OS resource containment would require separately enforced platform controls and measurements.

The ZIP audit checks integrity and bounded decoding, but neither establishes that arbitrary DXF or PDF contents are safe for every parser nor proves full garment geometry or manufacturing parity. Successful verification is a gate input, not a certificate of production readiness. Adversarial ZIP fixtures are small and bounded; no stress build, huge decompression fixture, or OS-limit claim is implied by these tests.

## Verification

`node --test src/core/factoryZipIsolatedIndependent20261024_0700.test.mjs` completed with exit code 0: **8 passed, 0 failed**, total duration 4453.726958 ms. The genuine Foundation Tee factory ZIP passed isolated integrity validation; the forged decoded-size, corruption, malformed-input, invalid-deadline, and one-millisecond deadline probes were rejected as expected, with `manufacturingApproved: false`. The suite tests an actual spawned Node child and a V8 heap cap of 64 MiB as implemented, but does not benchmark peak RSS or CPU and therefore makes no operating-system resource containment claim.
