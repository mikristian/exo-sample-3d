// Plan a safe 2D outline vertex deletion before starting an undo transaction.
// All coordinates remain in the existing EXO pattern unit (centimetres).
import { inspectDraftTopology } from './draftingTopology.js'

const EDGE_ATTACHMENTS = ['topstitches', 'bindings', 'zippers']

export function deletedPointEdgeIndex(edgeIndex, pointIndex, count) {
  if (!Number.isInteger(edgeIndex) || edgeIndex < 0 || edgeIndex >= count) return null
  const previous = (pointIndex - 1 + count) % count
  if (edgeIndex === previous || edgeIndex === pointIndex) return null
  return pointIndex === 0 ? edgeIndex - 1 : (edgeIndex > pointIndex ? edgeIndex - 1 : edgeIndex)
}

export function planDraftPointDeletion(piece, pointIndex) {
  const count = piece?.points?.length || 0
  if (!piece || piece.locked) throw new Error('Unlock the pattern before deleting a point')
  if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= count) {
    throw new Error('Select a valid pattern point')
  }
  if (count <= 3) throw new Error('A closed pattern needs at least three points')
  const previous = (pointIndex - 1 + count) % count
  if ((piece.notches || []).some(n => n.edgeIndex === previous || n.edgeIndex === pointIndex)) {
    throw new Error('Move or remove notches on either adjacent edge before deleting this point')
  }
  for (const collection of EDGE_ATTACHMENTS) {
    if ((piece[collection] || []).some(item => item.edgeIndex === previous || item.edgeIndex === pointIndex)) {
      throw new Error(`Remove ${collection} on the adjacent edges before deleting this point`)
    }
  }
  const curves = {}
  for (const [key, value] of Object.entries(piece.curves || {})) {
    const index = Number(key)
    const mapped = deletedPointEdgeIndex(index, pointIndex, count)
    if (mapped !== null) curves[mapped] = value
  }
  const points = piece.points.filter((_, index) => index !== pointIndex)
  if (!inspectDraftTopology({ ...piece, points, curves }, {curveSamples: 24}).valid) {
    throw new Error('Deleting this point would make an invalid or self-intersecting cutline')
  }
  return { points, curves, previous, count }
}
