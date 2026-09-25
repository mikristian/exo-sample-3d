import { buildSimulation, refreshSimulationAnalysis } from '../physics.js'
import { buildNativeSimulationPayload } from './nativePayload.js'
import { DEFAULT_NATIVE_SERVICE_URL, stepNativePayload } from './nativeServiceClient.js'

function flattenSimulationParticles(simulation) {
  return [...simulation.pieces.values()].flatMap((piece) => piece.particles)
}

function updateNativePayloadState(payload, result) {
  const state = result?.state?.particles
  if (!Array.isArray(state) || state.length !== payload.particles.length) {
    throw new Error(`Native state particle count mismatch: expected ${payload.particles.length}, got ${state?.length || 0}`)
  }
  for (let index = 0; index < state.length; index += 1) {
    const next = state[index]
    payload.particles[index].position = [...next.position]
    payload.particles[index].previous = [...next.previous]
  }
}

function applyNativeStateToSimulation(session, result) {
  const state = result?.state?.particles
  if (!Array.isArray(state) || state.length !== session.particleRefs.length) {
    throw new Error(`Native state particle count mismatch: expected ${session.particleRefs.length}, got ${state?.length || 0}`)
  }
  for (let index = 0; index < state.length; index += 1) {
    const particle = session.particleRefs[index]
    const next = state[index]
    particle.position.set(next.position[0], next.position[1], next.position[2])
    particle.previous.set(next.previous[0], next.previous[1], next.previous[2])
    particle.contactDepth = Math.max(0, Number(next.contactDepth || 0))
  }
  session.simulation.elapsed = session.frame / 60
}

export const nativeServiceBackend = {
  id: 'native-xpbd',
  label: 'Native XPBD · Local',
  kind: 'external-batch',
  maturity: 'experimental',
  async: true,
  capabilities: {
    platform: ['macos'],
    gpu: false,
    native: true,
    anisotropy: true,
    selfCollision: true,
    avatarCollision: true,
    layeredGarments: true,
    attachments: true,
    fusedLayers: true,
    dynamicAnimation: true,
    contactAnalysis: true,
    strainAnalysis: true,
  },

  create(project) {
    const simulation = buildSimulation(project)
    const payload = buildNativeSimulationPayload(project, {
      clothModel: project.simulation?.nativeClothModel || 'distance',
      bendingModel: project.simulation?.nativeBendingModel || 'distance',
    })
    const particleRefs = flattenSimulationParticles(simulation)
    if (particleRefs.length !== payload.particles.length) {
      throw new Error(`Native topology mismatch: browser ${particleRefs.length}, payload ${payload.particles.length}`)
    }
    return {
      backendId: this.id,
      project,
      simulation,
      payload,
      particleRefs,
      frame: 0,
      pending: null,
      failedUntil: 0,
      lastError: null,
      lastResult: null,
      lastElapsedMs: 0,
      serviceUrl: project.simulation?.nativeServiceUrl || DEFAULT_NATIVE_SERVICE_URL,
    }
  },

  step() {},

  stepAsync(session, frames = 8) {
    if (session.pending) return session.pending
    if (Date.now() < session.failedUntil) return Promise.resolve(session)
    session.pending = stepNativePayload(session.payload, {
      frames,
      baseUrl: session.serviceUrl,
    }).then((response) => {
      updateNativePayloadState(session.payload, response.result)
      session.frame += Number(response.result?.frames || frames)
      applyNativeStateToSimulation(session, response.result)
      refreshSimulationAnalysis(session.simulation, session.project)
      session.lastResult = response.result
      session.lastElapsedMs = Number(response.elapsedMs || 0)
      session.lastError = null
      return session
    }).catch((error) => {
      session.lastError = error
      session.failedUntil = Date.now() + 2000
      throw error
    }).finally(() => {
      session.pending = null
    })
    return session.pending
  },

  reset(session, project = session.project) {
    return this.create(project)
  },

  getStats(session) {
    return {
      frame: session.frame,
      elapsedMs: session.lastElapsedMs,
      serviceError: session.lastError?.message || null,
      native: session.lastResult?.stats || null,
    }
  },

  dispose(session) {
    session.pending = null
  },
}
