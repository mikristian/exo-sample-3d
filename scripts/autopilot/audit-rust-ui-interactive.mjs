#!/usr/bin/env node
// Independent syntax QA of *generated* Rust candidates from the actual V2 JSX source.
// Uses rustfmt for parsing, not Cargo builds or any modifications to installed EXO.
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const converter = join(project, 'scripts/rust-ui-interactive-codemod.mjs')
const rustfmt = join(homedir(), '.cargo/bin/rustfmt')
const rustc = join(homedir(), '.cargo/bin/rustc')
const eguiIndex = process.argv.indexOf('--egui-rlib')
const eguiRlib = eguiIndex >= 0 ? resolve(process.argv[eguiIndex + 1]) : null
if (eguiRlib && !existsSync(eguiRlib)) throw Error('Real egui .rlib not found')
const tmp = mkdtempSync(join(tmpdir(), 'exo-native-ui-qa-'))
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
    const item = join(path, entry.name)
    return entry.isDirectory() ? walk(item) : entry.isFile() && /\.jsx$/.test(entry.name) ? [item] : []
  }).sort()
}
const run = (exe, args) => spawnSync(exe, args, { cwd: project, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 })
const result = { date: new Date().toISOString(), source: 'current V2 JSX source', scanned: 0, generated: 0,
  stateControls: 0, commandControls: 0, textControls: 0, selectControls: 0, sliderControls: 0, gatedControls: 0,
  inspectedControls: 0, rejectedControls: 0, syntaxPassed: 0, realEguiCompiled: 0,
  eguiVersionValidation: eguiRlib ? 'prebuilt native egui library' : 'not requested', failures: [] }
try {
  for (const path of walk(join(project, 'src'))) {
    result.scanned++
    const file = relative(project, path)
    const dir = join(tmp, String(result.scanned))
    const codegen = run(process.execPath, [converter, '--file', path, '--emit', dir, '--json'])
    if (codegen.status !== 0) {
      result.failures.push({ file, error: (codegen.stderr || String(codegen.error)).slice(0, 500) })
      continue
    }
    let row
    try { row = JSON.parse(codegen.stdout) } catch { result.failures.push({ file, error: 'bad JSON result' }); continue }
    for (const key of ['stateControls', 'commandControls', 'textControls', 'selectControls', 'sliderControls', 'gatedControls', 'inspectedControls', 'rejectedControls']) {
      result[key] += row[key] || 0
    }
    if (!row.output) continue
    result.generated++
    const formatted = run(rustfmt, ['--emit', 'stdout', '--edition', '2021', row.output])
    if (formatted.status !== 0) result.failures.push({ file, error: (formatted.stderr || String(formatted.error)).slice(0, 500) })
    else result.syntaxPassed++
    if (eguiRlib && formatted.status === 0) {
      const compile = run(rustc, ['--edition=2024', '--crate-name', 'exo_ui_audit', '--crate-type', 'lib', '--emit', 'metadata',
        '-L', 'dependency=' + dirname(eguiRlib), '--extern', 'egui=' + eguiRlib,
        '-o', join(tmp, 'audit.rmeta'), row.output])
      if (compile.status !== 0) result.failures.push({ file, error: (compile.stderr || String(compile.error)).slice(0, 600) })
      else result.realEguiCompiled++
    }
  }
} finally { rmSync(tmp, { recursive: true, force: true }) }
result.scope = 'Rust syntax and restricted control contracts only, NOT full egui integration, rendering parity, data persistence, 2D/3D or garment functionality.'
const outIndex = process.argv.indexOf('--report')
if (outIndex >= 0) {
  const destination = resolve(process.argv[outIndex + 1])
  writeFileSync(destination, JSON.stringify(result, null, 2) + '\n')
}
console.log(JSON.stringify(result, null, 2))
if (result.failures.length) process.exitCode = 1
