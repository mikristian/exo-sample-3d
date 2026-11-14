import { cloneProject, touchProject, edgeLength } from './project.js'

const round = value => Number(value.toFixed(2))
const bodyIds = ['front', 'back']
const sleeveIds = ['sleeve-left', 'sleeve-right']

/** Convert a designer's style request into bounded stitch-line changes in centimeters. */
export function interpretExoFashionTeeCommand(command) {
  if (typeof command !== 'string') return null
  const phrase = command.toLowerCase().replace(/[–—]/g, '-').trim()
  const oversized = /\b(over\s*size(?:d)?|loose(?:r)?\s+fit|baggy)\b/.test(phrase)
  const boxy = /\bbox(?:y|ier)\b/.test(phrase)
  const cropped = /\b(crop(?:ped|ping)?|shorten|shorter)\b/.test(phrase)
  if (!oversized && !boxy && !cropped) return null
  const slight = /\b(slightly|a little|subtly|bit|mildly)\b/.test(phrase)
  const explicit = phrase.match(/\b(\d+(?:\.\d+)?)\s*(?:cm|centimeters?)\b/)
  let cropCm = cropped ? (slight ? 4 : 8) : 0
  if (cropped && explicit) cropCm = Number(explicit[1])
  return {
    kind: 'tee-style', oversized, boxy, cropped,
    widthAddHalfCm: oversized ? (slight ? 3 : 5) : boxy ? (slight ? 2 : 3.5) : 0,
    cropCm,
    source: command,
  }
}

function assertValidProject(project) {
  if (!project || project.templateId !== 'tee' || project.units !== 'cm') {
    throw new Error('Fashion T-shirt edits require an editable Foundation Tee project in cm')
  }
  for (const id of [...bodyIds, ...sleeveIds]) {
    const piece = project.pieces?.find(item => item.id === id)
    if (!piece || piece.locked || !Array.isArray(piece.points) || piece.points.length !== (bodyIds.includes(id) ? 12 : 7)) {
      throw new Error(`Unsupported or locked Foundation Tee pattern piece: ${id}`)
    }
    if (piece.points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error(`Invalid pattern coordinates: ${id}`)
  }
}

function measurements(project) {
  const front = project.pieces.find(p => p.id === 'front')
  const back = project.pieces.find(p => p.id === 'back')
  const metrics = piece => ({
    lengthCm: round(Math.max(piece.points[0].y, piece.points[9].y) - (piece.points[4].y + piece.points[5].y) / 2),
    hemWidthCm: round(piece.points[5].x - piece.points[4].x),
    underarmWidthCm: round(piece.points[6].x - piece.points[3].x),
    armscyeLengthCm: round([1, 2, 6, 7].reduce((n, edge) => n + edgeLength(piece, edge), 0)),
    necklineLengthCm: round([9, 10, 11].reduce((n, edge) => n + edgeLength(piece, edge), 0)),
  })
  return { front: metrics(front), back: metrics(back) }
}

/** Pure, undo-friendly edit: never mutate input; returned project can be committed as one history step. */
export function applyExoFashionTeeEdit(project, request) {
  assertValidProject(project)
  const style = typeof request === 'string' ? interpretExoFashionTeeCommand(request) : request
  if (!style || style.kind !== 'tee-style') throw new Error('No supported tee fit change found')
  const width = Number(style.widthAddHalfCm ?? 0)
  const crop = Number(style.cropCm ?? 0)
  if (!Number.isFinite(width) || width < 0 || width > 8 || !Number.isFinite(crop) || crop < 0 || crop > 20) {
    throw new Error('Supported bounds: 0–8 cm added per half-panel side, 0–20 cm cropped')
  }
  const before = measurements(project)
  const shortest = Math.min(before.front.lengthCm, before.back.lengthCm)
  if (crop > shortest - 48) throw new Error('Crop would leave less than 48 cm of body length')
  const next = cloneProject(project)
  for (const id of bodyIds) {
    const piece = next.pieces.find(p => p.id === id)
    // The underarm/armscye/shoulder/neckline are frozen to preserve sleeve seam fit.
    // A gently widened side seam between underarm and hem creates a boxier silhouette.
    piece.points[4].x -= width
    piece.points[5].x += width
    piece.points[4].y += crop
    piece.points[5].y += crop
  }
  // No sleeve-cap alteration: no mismatch to front/back armholes or notch mappings.
  // Existing curves, edge indices, notches, seam allowances and bindings survive intact.
  const after = measurements(next)
  const changed = width !== 0 || crop !== 0
  const warnings = [
    'Shoulder, neckline and armscye geometry remain unchanged; oversized here means a roomier torso and hem, not a dropped shoulder.',
    'Production sample, ease assessment, graded sizes, shrinkage and sleeve balance require physical validation.',
  ]
  if (changed) {
    next.productionSpec = {
      ...next.productionSpec,
      approvalStatus: 'FIT_SAMPLE_AND_FACTORY_VALIDATION_REQUIRED',
      stylingNotes: [...(next.productionSpec?.stylingNotes || []), `Designer fit edit: +${round(width)} cm each body side at hem; hem raised ${round(crop)} cm.`],
      referenceBodyLengthCm: after.front.lengthCm,
      referenceHemWidthCm: after.front.hemWidthCm,
    }
    touchProject(next)
  }
  return {
    project: next, changed, style, before, after,
    adjustmentsCm: { hemWidthPerPanel: round(width * 2), bodyLength: round(-crop), chestAtUnderarm: 0, shoulder: 0, sleeveCap: 0 },
    changedPieces: changed ? bodyIds : [],
    warnings,
  }
}
