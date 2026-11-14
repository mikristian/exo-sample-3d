import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(os.tmpdir(), `exo-web-source-candidate-20261112-${process.pid}`)
const report = process.env.EXO_WEB_SOURCE_CANDIDATE_REPORT ||
  path.join(root, 'docs/reports/EXO_WEB_SOURCE_CANDIDATE_20261112.json')
const trackedInputs = ['index.html', 'vite.config.mjs', 'package.json', 'package-lock.json',
  'src/main.jsx', 'src/App.jsx', 'src/components/ClothCraftWorkspace.jsx',
  'src/components/NativeGradeCatalogPersistence20261025.jsx',
  'src/core/scopedNativeGradeHistory20261112.js',
  'src/core/exoNativeGradeCommandV1.js']
const bytes = async p => (await fs.stat(p)).size
async function sha(file) {
  const hash = createHash('sha256')
  const stream = (await import('node:fs')).createReadStream(file)
  for await (const chunk of stream) hash.update(chunk)
  return hash.digest('hex')
}
async function walk(dir, prefix = '') {
  const result = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const rel = path.join(prefix, entry.name)
    if (entry.isDirectory()) result.push(...await walk(path.join(dir, entry.name), rel))
    else if (entry.isFile()) result.push(rel)
    else throw Error(`Unexpected symlink or special output entry: ${rel}`)
  }
  return result.sort()
}
async function fingerprints() {
  const found = {}
  for (const rel of trackedInputs) {
    try { found[rel] = await sha(path.join(root, rel)) }
    catch (error) { found[rel] = `UNAVAILABLE:${error.code || error.message}` }
  }
  return found
}
async function dirBytes(dir) {
  let total = 0
  for (const f of await walk(dir)) total += await bytes(path.join(dir, f))
  return total
}
async function freeBytes() {
  const { statfs } = await import('node:fs/promises')
  const stat = await statfs(root)
  return Number(stat.bavail) * Number(stat.bsize)
}
const state = { date: new Date().toISOString(), root, output, status: 'PREFLIGHT', inputHashesBefore: await fingerprints(), diskFreeBeforeBytes: await freeBytes(), outputFiles: [], buildLogTail: '' }
try {
  const publicBytes = await dirBytes(path.join(root, 'public'))
  state.publicBytes = publicBytes
  const minimumFree = 2.5 * 1024 ** 3
  const additionalEstimate = publicBytes * 2 + 400 * 1024 ** 2
  state.diskGuard = { minimumFreeBytes: minimumFree, estimatedUpperBytes: additionalEstimate, maximumAdditionalBytes: 3 * 1024 ** 3 }
  if (state.diskFreeBeforeBytes < minimumFree || additionalEstimate > 3 * 1024 ** 3) throw Error('DISK_GUARD: insufficient free space or output bound exceeds 3 GiB')
  await fs.access(path.join(root, 'node_modules/.bin/vite'))
  await fs.mkdir(output, { recursive: false })
  state.status = 'BUILDING'
  const chunks = []
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(path.join(root, 'node_modules/.bin/vite'), ['build', '--outDir', output, '--emptyOutDir'], { cwd: root, env: { ...process.env, NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'] })
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { chunks.push(chunk.toString()); if (chunks.length > 5000) chunks.shift() })
    child.on('error', reject)
    child.on('close', resolve)
  })
  state.buildExitCode = exitCode
  state.buildLogTail = chunks.join('').slice(-12000)
  if (exitCode !== 0) throw Error(`Vite build returned ${exitCode}`)
  state.outputFiles = await walk(output)
  state.outputBytes = await dirBytes(output)
  state.outputManifest = {}
  for (const rel of state.outputFiles) state.outputManifest[rel] = { bytes: await bytes(path.join(output, rel)), sha256: await sha(path.join(output, rel)) }
  const html = await fs.readFile(path.join(output, 'index.html'), 'utf8')
  const references = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1])
  state.indexReferences = references.map(ref => ({ reference: ref, present: ref.startsWith('data:') ? true : ref.startsWith('/') ? state.outputFiles.includes(decodeURIComponent(ref.slice(1))) : state.outputFiles.includes(decodeURIComponent(ref)), inlineData: ref.startsWith('data:') }))
  state.hasJS = state.outputFiles.some(f => f.endsWith('.js'))
  state.hasCSS = state.outputFiles.some(f => f.endsWith('.css'))
  state.hasIndex = state.outputFiles.includes('index.html')
  const bundledJS = await fs.readFile(path.join(output,
    state.outputFiles.find(f => /^assets\/index-[^/]+\.js$/.test(f))), 'utf8')
  state.scopedGradingSourceGuardIncluded =
    bundledJS.includes('Native Rust history may have completed, but the local grading draft changed during its transaction.') &&
    bundledJS.includes('Redo verified Rust grading catalog')
  const ports = new Set()
  for (const file of state.outputFiles.filter(f => /\.(?:js|css|html|json)$/.test(f))) {
    const data = await fs.readFile(path.join(output, file), 'utf8')
    for (const match of data.matchAll(/(?:127\.0\.0\.1|localhost|0\.0\.0\.0)(?::|%3A)(\d{2,5})/gi)) ports.add(match[0])
  }
  state.detectedLocalPortLiterals = [...ports].sort()
  state.inputHashesAfter = await fingerprints()
  state.sourceHashesStable = JSON.stringify(state.inputHashesBefore) === JSON.stringify(state.inputHashesAfter)
  state.diskFreeAfterBytes = await freeBytes()
  state.status = state.hasIndex && state.hasJS && state.hasCSS &&
    state.scopedGradingSourceGuardIncluded && state.indexReferences.every(ref => ref.present) &&
    state.sourceHashesStable ? 'VERIFIED_BUILD_CANDIDATE' : 'FAILED_VERIFICATION'
} catch (error) {
  state.error = String(error?.stack || error)
  state.status = 'BLOCKED_OR_FAILED'
  state.inputHashesAfter = await fingerprints()
  state.diskFreeAfterBytes = await freeBytes()
}
await fs.writeFile(report, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx' })
console.log(JSON.stringify({ status: state.status, output: state.output, outputBytes: state.outputBytes, publicBytes: state.publicBytes, diskFreeAfterBytes: state.diskFreeAfterBytes, buildExitCode: state.buildExitCode, outputCount: state.outputFiles.length, localPorts: state.detectedLocalPortLiterals, error: state.error, report }, null, 2))
if (state.status !== 'VERIFIED_BUILD_CANDIDATE') process.exitCode = 1
