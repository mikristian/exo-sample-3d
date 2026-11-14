#!/usr/bin/env node
// Agent-free, resumable source conversion. Only writes under --output and never patches V2.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const argv = process.argv.slice(2)
const arg = name => argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined
const mode = argv.includes('--once') ? 'once' : argv.includes('--status') ? 'status' : 'loop'
const output = arg('--output') ? resolve(arg('--output')) : ''
const interval = Number(arg('--interval-ms') || '300000')
const countLimit = Number(arg('--limit') || '8')
const codegen = join(project, 'scripts/rust-ui-codemod.mjs')
const interactiveCodegen = join(project, 'scripts/rust-ui-interactive-codemod.mjs')
const report = data => console.log(JSON.stringify({ at: new Date().toISOString(), ...data }))
if (!output || output === '/' || output === project || project.startsWith(output + sep)) throw Error('Specify a separate --output directory')
if (!Number.isInteger(countLimit) || countLimit < 1 || countLimit > 100) throw Error('--limit must be 1..100')
if (!Number.isInteger(interval) || interval < 10000 || interval > 86400000) throw Error('Invalid interval')
const statePath = join(output, 'state.json')
const lockPath = join(output, '.runner-lock')
const staging = join(output, 'generated')
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const safeWrite = (path, value) => {
  mkdirSync(dirname(path), { recursive: true })
  const temp = path + '.next-' + process.pid
  writeFileSync(temp, value)
  renameSync(temp, path)
}
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
    const target = join(path, entry.name)
    return entry.isDirectory() ? walk(target) : entry.isFile() && /\.jsx$/.test(entry.name) ? [target] : []
  }).sort()
}
const fresh = () => ({ schema: 1, created: new Date().toISOString(), files: {}, completed: 0, failures: 0 })
function load() {
  if (!existsSync(statePath)) return fresh()
  const state = JSON.parse(readFileSync(statePath, 'utf8'))
  if (state.schema !== 1 || typeof state.files !== 'object') throw Error('Invalid saved state')
  return state
}
function runCycle() {
  if (!existsSync(project) || !existsSync(codegen) || !existsSync(interactiveCodegen)) throw Error('V2 source/codemods unavailable')
  if (!existsSync(output) || !statSync(output).isDirectory()) throw Error('Output drive missing')
  let locked = false
  try {
    mkdirSync(lockPath)
    locked = true
  } catch (error) {
    if (error.code === 'EEXIST') { report({ event: 'skip', reason: 'runner already active' }); return }
    throw error
  }
  try {
    const state = load()
    const files = walk(join(project, 'src'))
    // An updated rule engine must revisit previously analyzed components once.
    const converterSha = createHash('sha256').update(readFileSync(codegen)).update(readFileSync(interactiveCodegen)).digest('hex')
    const pending = files.filter(file => {
      const id = relative(project, file)
      return state.files[id]?.sourceSha !== digest(file) || state.files[id]?.converterSha !== converterSha || state.files[id]?.status === 'failed'
    }).slice(0, countLimit)
    for (const file of pending) {
      const id = relative(project, file)
      const fileSha = digest(file)
      // Stable per-path directory avoids collisions between identically named JSX files.
      const destination = join(staging, id.replace(/\.jsx$/, ''))
      const generatedDir = join(destination, 'rust')
      mkdirSync(generatedDir, { recursive: true })
      const runTool = (tool, dir) => spawnSync(process.execPath, [tool, '--file', file, '--emit', dir, '--json'], {
        cwd: project, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024,
      })
      const job = runTool(codegen, generatedDir)
      const interactive = job.status === 0 ? runTool(interactiveCodegen, join(destination, 'interactive')) : null
      if (job.status !== 0 || interactive?.status !== 0) {
        const failed = job.status !== 0 ? job : interactive
        state.files[id] = { sourceSha: fileSha, converterSha, status: 'failed',
          error: String(failed?.stderr || failed?.error?.message || 'unknown').slice(0, 500), lastRun: new Date().toISOString() }
        state.failures++
      } else {
        const data = JSON.parse(job.stdout)
        const result = data.files[0]
        const interactiveResult = JSON.parse(interactive.stdout)
        state.files[id] = { sourceSha: fileSha, converterSha,
          status: result?.output || interactiveResult.output ? 'generated' : 'analyzed',
          staticFragments: result?.staticFragments || 0, hooks: result?.hooks || 0, eventHandlers: result?.eventHandlers || 0,
          interactiveControls: interactiveResult.controls || 0,
          stateControls: interactiveResult.stateControls || 0,
          commandControls: interactiveResult.commandControls || 0,
          textControls: interactiveResult.textControls || 0,
          selectControls: interactiveResult.selectControls || 0,
          sliderControls: interactiveResult.sliderControls || 0,
          guardedControls: interactiveResult.gatedControls || 0,
          rejectedControls: interactiveResult.rejectedControls || 0,
          blockers: result?.blockers || [], lastRun: new Date().toISOString() }
        state.completed++
      }
      state.updated = new Date().toISOString()
      safeWrite(statePath, JSON.stringify(state, null, 2) + '\n')
    }
    report({ event: 'cycle', scanned: files.length, attempted: pending.length, analyzed: Object.keys(state.files).length,
      generatedFiles: Object.values(state.files).filter(item => item.status === 'generated').length, failures: state.failures,
      interactiveControls: Object.values(state.files).reduce((sum, item) => sum + (item.interactiveControls || 0), 0),
      output, note: 'Static and guarded interactive Rust source fragments; native application integration and visual parity unproven' })
  } finally {
    if (locked) rmSync(lockPath, { recursive: true, force: true })
  }
}
if (mode === 'status') {
  const state = existsSync(statePath) ? load() : fresh()
  report({ event: 'status', output, analyzed: Object.keys(state.files).length, completed: state.completed, failures: state.failures })
} else {
  const stop = () => { report({ event: 'stopped' }); process.exit(0) }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  do {
    if (!existsSync(output)) { report({ event: 'paused', reason: 'Expansion output missing', output }); break }
    try { runCycle() } catch (error) { report({ event: 'error', message: error.message }); if (mode === 'once') process.exitCode = 1 }
    if (mode === 'once') break
    await new Promise(resolve => setTimeout(resolve, interval))
  } while (true)
}
