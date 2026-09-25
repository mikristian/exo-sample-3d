import { cloneProject } from './project.js'

export const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export function sizeOffset(grading, size) {
  const sizes = grading?.sizes?.length ? grading.sizes : DEFAULT_SIZES
  const baseSize = grading?.baseSize || 'M'
  const baseIndex = Math.max(0, sizes.indexOf(baseSize))
  const sizeIndex = Math.max(0, sizes.indexOf(size))
  return sizeIndex - baseIndex
}

export function gradePointForPiece(piece, grading, size, point) {
  const offset = sizeOffset(grading, size)
  if (!offset) return { ...point }
  const widthPerSize = Number(grading?.widthPerSizeCm ?? 3)
  const lengthPerSize = Number(grading?.lengthPerSizeCm ?? 1.2)
  const pieceBounds = bounds(piece.points)
  const centerX = (pieceBounds.minX + pieceBounds.maxX) * 0.5
  const height = Math.max(1, pieceBounds.maxY - pieceBounds.minY)
  const halfWidthDelta = (widthPerSize * offset) * 0.5
  const lengthDelta = lengthPerSize * offset
  const side = Math.sign(point.x - centerX)
  const normalizedY = (point.y - pieceBounds.minY) / height
  const widthInfluence = 0.55 + 0.45 * (1 - normalizedY)
  const lengthInfluence = 1 - normalizedY
  const automatic = {
    x: point.x + side * halfWidthDelta * widthInfluence,
    y: point.y - lengthDelta * lengthInfluence,
  }
  const rule = point.gradeRule
  if (!rule?.enabled) return automatic
  return {
    x: Number.isFinite(Number(rule.dxPerSize)) ? point.x + Number(rule.dxPerSize) * offset : automatic.x,
    y: Number.isFinite(Number(rule.dyPerSize)) ? point.y + Number(rule.dyPerSize) * offset : automatic.y,
  }
}

function bounds(points = []) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

export function gradePiece(piece, grading, size) {
  const offset = sizeOffset(grading, size)
  if (!offset) {
    return {
      ...piece,
      points: piece.points.map((point) => ({ ...point })),
      curves: piece.curves ? Object.fromEntries(Object.entries(piece.curves).map(([key, curve]) => [key, { ...curve }])) : undefined,
      internalLines: (piece.internalLines || []).map((line) => ({
        ...line,
        a: { ...line.a },
        b: { ...line.b },
      })),
    }
  }
  const transform = (point) => gradePointForPiece(piece, grading, size, point)

  const points = piece.points.map(transform)
  const curves = piece.curves
    ? Object.fromEntries(Object.entries(piece.curves).map(([edgeIndex, curve]) => {
      const transformed = transform({ x: curve.cx, y: curve.cy })
      return [edgeIndex, { cx: transformed.x, cy: transformed.y }]
    }))
    : undefined
  const internalLines = (piece.internalLines || []).map((line) => ({
    ...line,
    a: transform(line.a),
    b: transform(line.b),
  }))

  return {
    ...piece,
    points,
    curves,
    internalLines,
    gradeSize: size,
  }
}

export function gradeProject(project, size) {
  const graded = cloneProject(project)
  graded.previewSize = size
  graded.pieces = project.pieces.map((piece) => gradePiece(piece, project.grading, size))
  graded.customMeasurements = (project.customMeasurements || []).map((measurement) => {
    const piece = project.pieces.find((item) => item.id === measurement.pieceId)
    if (!piece) return cloneProject(measurement)
    return {
      ...cloneProject(measurement),
      a: gradePointForPiece(piece, project.grading, size, measurement.a),
      b: gradePointForPiece(piece, project.grading, size, measurement.b),
    }
  })
  return graded
}

export function buildSizeRun(project) {
  const sizes = project.grading?.sizes?.length ? project.grading.sizes : DEFAULT_SIZES
  return Object.fromEntries(sizes.map((size) => [size, gradeProject(project, size)]))
}
