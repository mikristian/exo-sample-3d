import { cloneProject, seamLengthReport, edgeLength } from './project.js'

const BODY_IDS = ['front', 'back']
const REQUIRED_IDS = [...BODY_IDS, 'sleeve-left', 'sleeve-right', 'hood-left', 'hood-right', 'rib-cuff-left', 'rib-cuff-right', 'rib-waistband', 'kangaroo-pocket']
const finite = value => typeof value === 'number' && Number.isFinite(value)
const bounds = points => ({
  minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
  minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)),
})

/** Measurements are seamline coordinates in centimetres, before seam allowances. */
export function measureHoodieFitGeometry(project) {
  const front = project?.pieces?.find(p => p.id === 'front')
  const back = project?.pieces?.find(p => p.id === 'back')
  if (!front || !back || front.points?.length !== 13 || back.points?.length !== 13) {
    throw new Error('Unsupported hoodie torso topology: expected split-neck 13-point front and back')
  }
  const f = bounds(front.points), b = bounds(back.points)
  return {
    frontHemWidthCm: f.maxX === f.minX ? 0 : Math.abs(front.points[5].x - front.points[4].x),
    backHemWidthCm: Math.abs(back.points[5].x - back.points[4].x),
    frontChestWidthCm: Math.abs(front.points[6].x - front.points[3].x),
    backChestWidthCm: Math.abs(back.points[6].x - back.points[3].x),
    frontBodyLengthCm: f.maxY - f.minY,
    backBodyLengthCm: b.maxY - b.minY,
    shoulderSpanCm: Math.abs(front.points[8].x - front.points[1].x),
    shoulderDropCm: (front.points[0].y + front.points[9].y) / 2 - (front.points[1].y + front.points[8].y) / 2,
  }
}

const coordinateFields = (object, xFactor, yFactor = 1, yOrigin = 0) => {
  if (!object || typeof object !== 'object') return
  if (finite(object.x)) object.x *= xFactor
  if (finite(object.y)) object.y = yOrigin + (object.y - yOrigin) * yFactor
  if (finite(object.cx)) object.cx *= xFactor
  if (finite(object.cy)) object.cy = yOrigin + (object.cy - yOrigin) * yFactor
}

function transformBodyLength(piece, extraCm) {
  // Keep the entire armscye, neck, shoulder and hood seat unchanged. Move only
  // the hem down and graduate the side seam below the underarm line (50 cm).
  const underarm = Math.min(piece.points[3].y, piece.points[6].y)
  if (!(underarm > 0)) throw new Error('Unsupported torso hem/underarm coordinates')
  const scaleY = (underarm + extraCm) / underarm
  if (!(scaleY > 0.5)) throw new RangeError('Requested torso shortening is excessive')
  const shift = p => {
    if (finite(p.y) && p.y < underarm) p.y = underarm + (p.y - underarm) * scaleY
    if (finite(p.cy) && p.cy < underarm) p.cy = underarm + (p.cy - underarm) * scaleY
  }
  piece.points.forEach(shift)
  Object.values(piece.curves || {}).forEach(shift)
  for (const item of piece.internalLines || []) {
    shift(item.a); shift(item.b)
  }
}

/**
 * Reversible geometric fit edit for Foundation Hoodie. Keeps every seam endpoint
 * and piece ID intact. Width scaling is global to maintain sleeve-cap, hood,
 * cuff and waistband seam matching; this also changes sleeve and hood widths.
 * Shoulder redrafting is deliberately rejected until a validated sleeve-cap
 * redistribution implementation is available.
 */
export function transformHoodieFitGeometry(project, options = {}) {
  if (!project || !['hoodie', 'zip-hoodie'].includes(project.templateId)) {
    throw new Error('Fit transform requires a Foundation Hoodie project')
  }
  const pieceMap = new Map((project.pieces || []).map(piece => [piece.id, piece]))
  for (const id of REQUIRED_IDS) if (!pieceMap.has(id)) throw new Error(`Unsupported hoodie topology: missing ${id}`)
  for (const id of BODY_IDS) if (pieceMap.get(id).points?.length !== 13) throw new Error(`Unsupported torso topology for ${id}`)
  if (options.dropShoulderCm !== undefined && options.dropShoulderCm !== 0) {
    throw new Error('Dropped shoulder requires sleeve-cap and armscye redrafting; no safe transform exists for this topology')
  }
  const widthScale = options.widthScale ?? 1
  const bodyLengthDeltaCm = options.bodyLengthDeltaCm ?? 0
  if (!finite(widthScale) || widthScale < 0.8 || widthScale > 1.5) throw new RangeError('widthScale must be between 0.8 and 1.5')
  if (!finite(bodyLengthDeltaCm) || Math.abs(bodyLengthDeltaCm) > 20) throw new RangeError('bodyLengthDeltaCm must be between -20 and 20')
  if (project.pieces.some(piece => piece.locked && REQUIRED_IDS.includes(piece.id))) throw new Error('Cannot edit a locked hoodie piece')
  const before = measureHoodieFitGeometry(project)
  const originalSeams = (project.seams || []).map(seam => ({ id: seam.id, ...seamLengthReport(project, seam) }))
  const next = cloneProject(project)
  for (const piece of next.pieces) {
    // The shell and all attached trims are part of one seam-connected graph.
    if (!REQUIRED_IDS.includes(piece.id)) continue
    piece.points.forEach(point => coordinateFields(point, widthScale))
    Object.values(piece.curves || {}).forEach(curve => coordinateFields(curve, widthScale))
    for (const line of piece.internalLines || []) {
      coordinateFields(line.a, widthScale)
      coordinateFields(line.b, widthScale)
    }
    for (const attachment of piece.surfaceAttachments || []) {
      coordinateFields(attachment.targetA, widthScale)
      coordinateFields(attachment.targetB, widthScale)
    }
    // Hood placement references are in metres in arrangement3d: preserve them.
    if (BODY_IDS.includes(piece.id)) transformBodyLength(piece, bodyLengthDeltaCm)
  }
  // Hood neckline is a chain of straight edges, while the corresponding neck
  // body curves gain arclength non-linearly during width changes. Re-walk each
  // neckline segment and rebuild its straight hood attachment edge exactly.
  for (const hoodId of ['hood-left', 'hood-right']) {
    const hood = next.pieces.find(piece => piece.id === hoodId)
    const attachmentSeams = [0, 1, 2, 3].map(index => next.seams.find(seam => seam.id === `${hoodId}-neck-${index}`))
    if (attachmentSeams.some(seam => !seam || seam.a.pieceId !== hoodId || seam.a.edgeIndex > 3)) {
      throw new Error(`Unsupported neckline seam topology for ${hoodId}`)
    }
    const originalTotal = hood.points[4].x - hood.points[0].x
    let cursor = hood.points[0].x
    for (let i = 0; i < 4; i += 1) {
      const seam = attachmentSeams[i]
      const body = next.pieces.find(piece => piece.id === seam.b.pieceId)
      cursor += edgeLength(body, seam.b.edgeIndex)
      hood.points[i + 1].x = cursor
    }
    const expansion = (cursor - hood.points[0].x) / originalTotal
    for (let i = 5; i < hood.points.length; i += 1) hood.points[i].x = hood.points[0].x + (hood.points[i].x - hood.points[0].x) * expansion
    for (const [index, control] of Object.entries(hood.curves || {})) {
      if (Number(index) >= 4) control.cx = hood.points[0].x + (control.cx - hood.points[0].x) * expansion
    }
  }
  next.revision = (project.revision || 0) + 1
  next.updatedAt = new Date().toISOString()
  const after = measureHoodieFitGeometry(next)
  const seamDiagnostics = (next.seams || []).map((seam, index) => {
    const report = seamLengthReport(next, seam)
    return { id: seam.id, beforeDifferenceCm: originalSeams[index].difference, afterDifferenceCm: report.difference,
      lengthA: report.lengthA, lengthB: report.lengthB, mismatchPercent: report.mismatchPercent }
  })
  const worsened = seamDiagnostics.filter(s => s.afterDifferenceCm > s.beforeDifferenceCm + 0.15)
  return { project: next, before, after, diagnostics: {
    widthScale, bodyLengthDeltaCm, shoulderRedrafted: false,
    dimensions: 'cm seamline', seamDiagnostics,
    warnings: [
      'Horizontal fit changes scale sleeves, hood, waistband and cuffs to preserve seam topology; physical sample fitting is required.',
      ...(worsened.length ? [`${worsened.length} seams increased their absolute mismatch by over 0.15 cm`] : []),
    ],
  } }
}

export const applyOversizedHoodieGeometry = transformHoodieFitGeometry
