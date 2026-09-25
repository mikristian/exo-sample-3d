import { buildSimulation } from '../physics.js'

function nativeSpringStiffness(stiffness = 0.9) {
  const normalized = Math.max(0.001, Math.min(0.9999, Number(stiffness ?? 0.9)))
  return {
    normalized,
    springK: 12000 + 488000 * Math.pow(normalized, 4),
  }
}

export function buildNativeSimulationPayload(project, options = {}) {
  const simulation = buildSimulation(project)
  const particles = []
  const particleIndex = new Map()
  const simIndexToNative = new Map()
  const pieces = []

  for (const [pieceId, piece] of simulation.pieces.entries()) {
    const indices = []
    for (const particle of piece.particles) {
      const index = particles.length
      particleIndex.set(particle, index)
      simIndexToNative.set(particle.simIndex, index)
      indices.push(index)
      particles.push({
        id: particle.id,
        pieceId,
        position: [particle.position.x, particle.position.y, particle.position.z],
        previous: [particle.previous.x, particle.previous.y, particle.previous.z],
        invMass: Number(particle.invMass ?? 1),
        wrapMode: particle.wrapMode || '',
        patternU: Number.isFinite(particle.patternU) ? particle.patternU : null,
        collisionSideZ: Number(particle.collisionSideZ || 0),
        constructionSideZ: Number(particle.constructionSideZ || 0),
        seamBoundary: Boolean(particle.seamBoundary),
        seamIds: [...(particle.seamIds || [])],
        thickness: Number(piece.fabric?.thickness ?? 0.002),
        friction: Number(piece.fabric?.friction ?? 0.3),
        layerIndex: Number(piece.layerIndex || 0),
      })
    }
    pieces.push({
      id: pieceId,
      name: piece.piece?.name || pieceId,
      fabricId: piece.piece?.fabricId || 'main',
      grainAngleDeg: Number(piece.piece?.grainAngleDeg || 0),
      fabric: {
        stretchWarp: Number(piece.fabric?.stretchWarp ?? 0.05),
        stretchWeft: Number(piece.fabric?.stretchWeft ?? 0.05),
        bend: Number(piece.fabric?.bend ?? 0.65),
        shear: Number(piece.fabric?.shear ?? (0.45 + Number(piece.fabric?.bend ?? 0.65) * 0.45)),
      },
      particleIndices: indices,
      flatVerticesM: piece.flatVertices.map((point) => [point.x * 0.01, point.y * 0.01, 0]),
      faces: piece.faces.map((face) => [...face]),
    })
  }

  const nativeConstraintTypes = new Set(['structural', 'bend', 'seam', 'edge-treatment', 'topstitch', 'zipper-tape', 'fuse'])
  const constraints = simulation.constraints
    .filter((constraint) => nativeConstraintTypes.has(constraint.type) && constraint.a && constraint.b && Number.isFinite(constraint.rest))
    .map((constraint) => {
      const { normalized, springK } = nativeSpringStiffness(constraint.stiffness)
      return {
        type: constraint.type,
        a: particleIndex.get(constraint.a),
        b: particleIndex.get(constraint.b),
        rest: Number(constraint.rest),
        stiffness: springK,
        sourceStiffness: normalized,
        seamId: constraint.seamId || null,
      }
    })
    .filter((constraint) => Number.isInteger(constraint.a) && Number.isInteger(constraint.b))

  const anchors = (simulation.anchorConstraints || []).map((anchor) => ({
    particle: particleIndex.get(anchor.particle),
    target: [anchor.target.x, anchor.target.y, anchor.target.z],
    stiffness: Math.max(0, Math.min(1, Number(anchor.stiffness ?? 0.2))),
    axes: anchor.axes || null,
    type: anchor.type || 'anchor',
  })).filter((anchor) => Number.isInteger(anchor.particle))

  return {
    protocol: 'garment-studio.native-xpbd',
    version: 1,
    project: { id: project.id, name: project.name, templateId: project.templateId || 'custom' },
    avatar: project.avatar,
    settings: {
      gravity: Number(project.simulation?.gravity ?? 9.81),
      damping: Number(options.damping ?? 0.994),
      iterations: Math.max(4, Number(project.simulation?.iterations ?? 7)),
      substeps: Math.max(1, Math.min(4, Number(project.simulation?.substeps ?? 2))),
      dt: Number(options.dt ?? 1 / 60),
      collisions: project.simulation?.collisions !== false,
      collisionMargin: Number(project.simulation?.collisionMargin ?? 0.012),
      selfCollision: project.simulation?.selfCollision !== false,
      selfCollisionMargin: Number(project.simulation?.selfCollisionMargin ?? 0.002),
      maxThickness: Number(simulation.maxThickness ?? 0.002),
      structuralStiffness: Number(project.simulation?.stiffness ?? 0.92),
      clothModel: options.clothModel || 'distance',
      bendingModel: options.bendingModel || 'distance',
    },
    particles,
    pieces,
    constraints,
    anchors,
    collisionExclusions: [...(simulation.collisionExclusions || [])].map((entry) => {
      const [left, right] = String(entry).split(':').map(Number)
      return [simIndexToNative.get(left), simIndexToNative.get(right)]
    }).filter(([left, right]) => Number.isInteger(left) && Number.isInteger(right)),
    fusedPiecePairs: [...(simulation.fusedPiecePairs || [])],
  }
}

export function nativePayloadSummary(payload) {
  return {
    project: payload.project?.name || 'Untitled',
    pieces: payload.pieces?.length || 0,
    particles: payload.particles?.length || 0,
    constraints: payload.constraints?.length || 0,
    anchors: payload.anchors?.length || 0,
    clothModel: payload.settings?.clothModel || 'distance',
    bendingModel: payload.settings?.bendingModel || 'distance',
  }
}
