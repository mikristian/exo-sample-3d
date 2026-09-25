import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildNativeSimulationPayload, nativePayloadSummary } from '../src/core/backends/nativePayload.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const host = process.env.GS_NATIVE_HOST || '127.0.0.1'
const port = Number(process.env.GS_NATIVE_PORT || 5194)
const binary = path.join(root, 'native_backend/bin/garment_xpbd_cli')
const buildScript = path.join(root, 'native_backend/scripts/build_garment_xpbd_cli.sh')
const maxBodyBytes = 20 * 1024 * 1024
let buildPromise = null

function binaryIsFresh() {
  if (!fs.existsSync(binary)) return false
  const binaryMtime = fs.statSync(binary).mtimeMs
  const inputs = [
    path.join(root, 'native_backend/src/garment_xpbd_cli.cpp'),
    buildScript,
  ]
  return inputs.every((input) => !fs.existsSync(input) || fs.statSync(input).mtimeMs <= binaryMtime)
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': 'no-store',
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, { ...corsHeaders(), 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

async function readJson(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > maxBodyBytes) throw Object.assign(new Error('Request body too large'), { statusCode: 413 })
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function ensureBinary() {
  if (binaryIsFresh()) return binary
  if (!buildPromise) {
    buildPromise = Promise.resolve().then(() => {
      const stdout = execFileSync(buildScript, [], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 120000,
      })
      if (!fs.existsSync(binary)) throw new Error(`Native build completed without producing ${binary}: ${stdout}`)
      return binary
    }).finally(() => { buildPromise = null })
  }
  return buildPromise
}

function solveNative(payload, frames) {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'garment-studio-native-'))
  const input = path.join(runDir, 'request.json')
  const output = path.join(runDir, 'result.json')
  try {
    fs.writeFileSync(input, JSON.stringify(payload))
    const started = performance.now()
    const stdout = execFileSync(binary, [input, output, String(frames)], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
      maxBuffer: 8 * 1024 * 1024,
    })
    const elapsedMs = performance.now() - started
    const result = JSON.parse(fs.readFileSync(output, 'utf8'))
    let cliSummary = null
    try { cliSummary = JSON.parse(stdout.trim().split(/\r?\n/).at(-1)) } catch {}
    return { result, elapsedMs, cliSummary }
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true })
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }
  try {
    if (req.method === 'GET' && req.url === '/health') {
      const available = fs.existsSync(binary)
      sendJson(res, 200, {
        ok: true,
        service: 'garment-studio-native-xpbd',
        version: 1,
        binaryReady: available,
        binaryFresh: binaryIsFresh(),
        binary,
        models: {
          cloth: ['distance', 'strain-triangle'],
          bending: ['distance', 'isometric-xpbd'],
        },
      })
      return
    }

    if (req.method === 'POST' && req.url === '/simulate') {
      const body = await readJson(req)
      if (!body.project?.pieces?.length) {
        sendJson(res, 400, { ok: false, error: 'project.pieces is required' })
        return
      }
      await ensureBinary()
      const frames = Math.max(1, Math.min(600, Math.round(Number(body.frames ?? 60))))
      const clothModel = ['distance', 'strain-triangle'].includes(body.clothModel) ? body.clothModel : 'distance'
      const bendingModel = ['distance', 'isometric-xpbd'].includes(body.bendingModel) ? body.bendingModel : 'distance'
      const payload = buildNativeSimulationPayload(body.project, { clothModel, bendingModel })
      const { result, elapsedMs, cliSummary } = solveNative(payload, frames)
      sendJson(res, 200, {
        ok: true,
        elapsedMs,
        payload: nativePayloadSummary(payload),
        cliSummary,
        result,
      })
      return
    }

    if (req.method === 'POST' && req.url === '/step') {
      const body = await readJson(req)
      const payload = body.payload
      if (payload?.protocol !== 'garment-studio.native-xpbd' || !payload?.particles?.length || !payload?.pieces?.length) {
        sendJson(res, 400, { ok: false, error: 'A valid native payload is required' })
        return
      }
      await ensureBinary()
      const frames = Math.max(1, Math.min(120, Math.round(Number(body.frames ?? 8))))
      const { result, elapsedMs, cliSummary } = solveNative(payload, frames)
      sendJson(res, 200, {
        ok: true,
        elapsedMs,
        payload: nativePayloadSummary(payload),
        cliSummary,
        result,
      })
      return
    }

    sendJson(res, 404, { ok: false, error: 'Not found' })
  } catch (error) {
    const status = Number(error.statusCode || 500)
    sendJson(res, status, {
      ok: false,
      error: error.message || String(error),
    })
  }
})

server.listen(port, host, () => {
  console.log(JSON.stringify({
    service: 'garment-studio-native-xpbd',
    url: `http://${host}:${port}`,
    binaryReady: fs.existsSync(binary),
  }))
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
