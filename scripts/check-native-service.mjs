import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTeeTemplate } from '../src/data/templates.js'
import { buildNativeSimulationPayload } from '../src/core/backends/nativePayload.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.GS_NATIVE_TEST_PORT || 5195)
const baseUrl = `http://127.0.0.1:${port}`
const child = spawn('node', ['native_backend/server.mjs'], {
  cwd: root,
  env: { ...process.env, GS_NATIVE_PORT: String(port) },
  stdio: ['ignore', 'ignore', 'pipe'],
})
let stderr = ''
child.stderr.on('data', (chunk) => { stderr += chunk.toString() })

async function waitForHealth() {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`, { cache: 'no-store' })
      if (response.ok) return response.json()
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  throw new Error(`Native service did not become healthy: ${stderr || 'timeout'}`)
}

async function stopChild() {
  if (child.exitCode != null || child.killed) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ])
  if (child.exitCode == null) child.kill('SIGKILL')
}

try {
  const health = await waitForHealth()
  const project = createTeeTemplate()
  const response = await fetch(`${baseUrl}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, frames: 60, clothModel: 'distance', bendingModel: 'distance' }),
  })
  const payload = await response.json()
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`)
  const result = payload.result
  if (result.backendId !== 'native-pbd-xpbd') throw new Error(`Unexpected backend ${result.backendId}`)
  if (result.pieces?.length !== 4) throw new Error(`Expected 4 pieces, got ${result.pieces?.length}`)
  if (result.stats?.particles !== 500) throw new Error(`Expected 500 particles, got ${result.stats?.particles}`)
  if (result.stats?.constraints !== 2454) throw new Error(`Expected 2454 constraints, got ${result.stats?.constraints}`)
  if (result.stats?.finite !== true) throw new Error('Native service produced non-finite state')
  if (!(result.stats?.seamAverageDistance < 0.02)) throw new Error(`Average seam distance too large: ${result.stats?.seamAverageDistance}`)
  if (!(result.stats?.seamMaxDistance < 0.03)) throw new Error(`Peak seam distance too large: ${result.stats?.seamMaxDistance}`)
  const vertices = result.pieces.flatMap((piece) => piece.vertices || [])
  if (!vertices.length || !vertices.flat().every(Number.isFinite)) throw new Error('Native service result lost finite mesh vertices')
  const ys = vertices.map((vertex) => vertex[1])
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  if (!(minY > 1.0 && minY < 1.15 && maxY > 1.65 && maxY < 1.78)) throw new Error(`Native body bounds regressed: ${minY}..${maxY}`)

  const resumablePayload = buildNativeSimulationPayload(project)
  const stepOnce = async (payloadToStep) => {
    const stepResponse = await fetch(`${baseUrl}/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: payloadToStep, frames: 8 }),
    })
    const stepBody = await stepResponse.json()
    if (!stepResponse.ok || !stepBody?.ok) throw new Error(stepBody?.error || `Step HTTP ${stepResponse.status}`)
    return stepBody
  }
  const firstStep = await stepOnce(resumablePayload)
  const firstState = firstStep.result?.state?.particles
  if (!Array.isArray(firstState) || firstState.length !== resumablePayload.particles.length) throw new Error('Native step did not return resumable particle state')
  if (!firstState.every((particle) => Number.isFinite(Number(particle.contactDepth ?? 0)) && Number(particle.contactDepth ?? 0) >= 0)) {
    throw new Error('Native step returned invalid contact-depth telemetry')
  }
  if (!firstState.some((particle) => Number(particle.contactDepth || 0) > 0)) throw new Error('Native tee produced no collision contact telemetry')
  for (let i = 0; i < firstState.length; i += 1) {
    resumablePayload.particles[i].position = [...firstState[i].position]
    resumablePayload.particles[i].previous = [...firstState[i].previous]
  }
  const firstAverageY = firstState.reduce((sum, item) => sum + item.position[1], 0) / firstState.length
  const secondStep = await stepOnce(resumablePayload)
  const secondState = secondStep.result?.state?.particles
  if (!Array.isArray(secondState) || secondState.length !== firstState.length) throw new Error('Second native step lost particle state')
  const secondAverageY = secondState.reduce((sum, item) => sum + item.position[1], 0) / secondState.length
  if (Math.abs(secondAverageY - firstAverageY) < 1e-6) throw new Error('Native resumed step did not advance garment state')
  console.log(JSON.stringify({
    health: { ok: health.ok, binaryReady: health.binaryReady, binaryFresh: health.binaryFresh },
    elapsedMs: Number(payload.elapsedMs.toFixed(2)),
    payload: payload.payload,
    stats: result.stats,
    bodyBoundsM: { minY: Number(minY.toFixed(3)), maxY: Number(maxY.toFixed(3)) },
    resume: {
      first8FramesMs: Number(firstStep.elapsedMs.toFixed(2)),
      second8FramesMs: Number(secondStep.elapsedMs.toFixed(2)),
      averageYDeltaMm: Number(((secondAverageY - firstAverageY) * 1000).toFixed(3)),
    },
  }, null, 2))
} finally {
  await stopChild()
}
