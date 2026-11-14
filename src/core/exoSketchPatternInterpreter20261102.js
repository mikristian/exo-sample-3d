// Local, conservative sketch interpretation. Coordinates are observed image pixels,
// not calibrated garment dimensions. Never generate cutting/sewing instructions here.
import { traceAccuMarkPhotoSilhouette20261024 } from './accumarkPhotoDigitize20261024.js'

const fail = (code, reason, evidence = {}) => ({
  ok: false, code, reason, evidence, manufacturingApproved: false,
  physicalCalibrationVerified: false, needsHumanReview: true,
})

const bounded = (value, low, high) => Math.max(low, Math.min(high, value))

function floodBackground(ink, width, height) {
  const visited = new Uint8Array(ink.length)
  const queue = new Int32Array(ink.length)
  let head = 0, tail = 0
  const offer = index => { if (!ink[index] && !visited[index]) { visited[index] = 1; queue[tail++] = index } }
  for (let x = 0; x < width; x++) { offer(x); offer((height - 1) * width + x) }
  for (let y = 1; y < height - 1; y++) { offer(y * width); offer(y * width + width - 1) }
  while (head < tail) {
    const idx = queue[head++], x = idx % width
    if (x) offer(idx - 1)
    if (x < width - 1) offer(idx + 1)
    if (idx >= width) offer(idx - width)
    if (idx < (height - 1) * width) offer(idx + width)
  }
  return visited
}

function toRgba(mask, width, height) {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < mask.length; i++) {
    const value = mask[i] ? 0 : 255
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = value
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

function measure(shape, width, height) {
  const bounds = shape.pixelBounds
  const bw = bounds.xMax - bounds.xMin, bh = bounds.yMax - bounds.yMin
  const points = shape.observedPoints
  const bands = [0.12, 0.28, 0.52, 0.78].map(fraction => {
    const target = bounds.yMin + fraction * bh
    // Intersections with image-space polygon, not inferred fabric dimensions.
    const xs = []
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length]
      if ((a.y <= target && b.y > target) || (b.y <= target && a.y > target))
        xs.push(a.x + (target - a.y) * (b.x - a.x) / (b.y - a.y))
    }
    xs.sort((a, b) => a - b)
    return xs.length >= 2 ? { fraction, widthFraction: (xs.at(-1) - xs[0]) / bw, intersections: xs.length } : { fraction, widthFraction: null, intersections: xs.length }
  })
  const upper = Math.max(bands[0].widthFraction ?? 0, bands[1].widthFraction ?? 0), center = bands[2].widthFraction
  const sleeveLike = upper !== null && center !== null && upper > center * 1.27
  const topCenter = points.filter(p => Math.abs(p.x - (bounds.xMin + bounds.xMax) / 2) < bw * .15)
  const topSides = points.filter(p => Math.abs(p.x - (bounds.xMin + bounds.xMax) / 2) > bw * .25 && p.y < bounds.yMin + bh * .35)
  const notchDepth = topCenter.length && topSides.length
    ? (Math.min(...topCenter.map(p => p.y)) - Math.min(...topSides.map(p => p.y))) / bh : null
  return {
    boundsPx: bounds, aspectRatio: Number((bw / bh).toFixed(4)),
    widthBands: bands,
    possibleSleeveExtension: { detected: sleeveLike, confidence: sleeveLike ? 'low' : 'none', basis: 'relative upper versus middle silhouette width' },
    possibleNecklineRecess: { detected: notchDepth !== null && notchDepth > .035, confidence: notchDepth > .035 ? 'low' : 'none', depthFraction: notchDepth === null ? null : Number(notchDepth.toFixed(4)) },
    view: 'unknown', frontBackDetermined: false, seamTopologyDetermined: false,
    garmentCategory: 'unknown',
  }
}

/** Process RGBA pixels from a local, high-contrast single-garment sketch.
 * Returns ONLY source pixel evidence and an editable suggestion contour.
 * It is not a production pattern, nor a verified identification of panels.
 */
export function interpretExoSketchRgba20261102({ rgba, width, height, threshold = 150,
  maxPoints = 512, minPixels = 80 } = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 24 || height < 24 ||
    width * height > 1_000_000 || !rgba || rgba.length !== width * height * 4 ||
    !Number.isInteger(threshold) || threshold < 30 || threshold > 230 ||
    !Number.isInteger(maxPoints) || maxPoints < 16 || maxPoints > 1024 ||
    !Number.isInteger(minPixels) || minPixels < 20 || minPixels > width * height / 3)
    return fail('INVALID_IMAGE', 'Image must be 24px or larger, at most 1 megapixel, with valid RGBA data and settings.')

  const ink = new Uint8Array(width * height)
  let inkPixels = 0
  for (let i = 0; i < ink.length; i++) {
    const a = rgba[i * 4 + 3] / 255
    // Composite on white; transparent content cannot be treated as dark ink.
    const luminance = a * (.2126 * rgba[i * 4] + .7152 * rgba[i * 4 + 1] + .0722 * rgba[i * 4 + 2]) + (1 - a) * 255
    ink[i] = luminance < threshold ? 1 : 0
    inkPixels += ink[i]
  }
  if (inkPixels < minPixels) return fail('NO_DRAWING', 'No sufficiently large dark sketch was found.')
  if (inkPixels > ink.length * .85) return fail('BACKGROUND_SELECTED', 'Image is predominantly dark; provide dark lines on a light background.')

  let xMin = width, xMax = 0, yMin = height, yMax = 0
  for (let i = 0; i < ink.length; i++) if (ink[i]) {
    const x = i % width, y = Math.floor(i / width)
    xMin = Math.min(xMin, x); xMax = Math.max(xMax, x)
    yMin = Math.min(yMin, y); yMax = Math.max(yMax, y)
  }

  const exterior = floodBackground(ink, width, height)
  let interiorCount = 0
  const mask = new Uint8Array(ink.length)
  for (let i = 0; i < mask.length; i++) {
    if (!ink[i] && !exterior[i]) interiorCount++
    mask[i] = ink[i] || !exterior[i] ? 1 : 0
  }
  const mode = interiorCount >= minPixels ? 'closed-line-drawing' : 'solid-silhouette'
  const lineDensity = inkPixels / Math.max(1, (xMax - xMin + 1) * (yMax - yMin + 1))
  if (interiorCount < minPixels && lineDensity < .18)
    return fail('UNCLOSED_OUTLINE', 'Sketch contains thin or open strokes without a confirmed enclosed silhouette.',
      { inkPixels, enclosedPixels: interiorCount, lineDensity })
  const traced = traceAccuMarkPhotoSilhouette20261024({
    rgba: toRgba(mask, width, height), width, height,
    minPixels, simplifyTolerancePx: .9, maxPoints,
  })
  if (!traced.ok) return fail(traced.code, traced.reason, { mode, inkPixels, enclosedPixels: interiorCount })
  const b = traced.pixelBounds
  const boxPixels = (b.xMax - b.xMin) * (b.yMax - b.yMin)
  const occupancy = traced.sourcePixelCount / boxPixels
  if (occupancy < .22) return fail('OPEN_OR_FRAGMENTARY_SKETCH',
    'The contour is mostly line strokes or thin fragments. Close the outline or provide a filled silhouette.',
    { mode, occupancy, inkPixels, enclosedPixels: interiorCount })
  if (mode === 'solid-silhouette' && interiorCount < minPixels && occupancy < .45)
    return fail('UNCLOSED_OUTLINE', 'Sketch outline was not demonstrably closed; close the outer boundary.',
      { mode, occupancy, inkPixels, enclosedPixels: interiorCount })

  const evidence = measure(traced, width, height)
  const normalizedContour = traced.observedPoints.map(p => ({
    x: Number(((p.x - b.xMin) / (b.xMax - b.xMin)).toFixed(6)),
    y: Number(((p.y - b.yMin) / (b.yMax - b.yMin)).toFixed(6)),
  }))
  return {
    ok: true, mode, source: 'local-rgba-pixel-analysis',
    bbox: b, silhouetteAspectRatio: evidence.aspectRatio,
    garmentFamilyHint: evidence.possibleSleeveExtension.detected ? 'upper-body-candidate' : 'unknown',
    measurementCalibrationVerified: false,
    contourPx: traced.observedPoints, normalizedContour,
    evidence: { ...evidence, inkPixels, enclosedPixels: interiorCount,
      contourPoints: traced.outlinePoints, occupancy: Number(occupancy.toFixed(4)),
      segmentationAreaChange: traced.areaChangeRatio },
    confidence: { outerContour: occupancy >= .45 ? 'medium' : 'low',
      garmentIdentification: 'none', frontBack: 'none', panelTopology: 'none',
      measurements: 'none', neckline: evidence.possibleNecklineRecess.confidence,
      sleeves: evidence.possibleSleeveExtension.confidence },
    possiblePatternSeed: { kind: 'uncalibrated-outer-outline', normalizedContour,
      unit: 'relative-image-coordinates', usableFor: 'template-retrieval-or-human-review' },
    physicalCalibrationVerified: false, manufacturingApproved: false, needsHumanReview: true,
    warning: 'Drawing interpretation only. No scale, panel cuts, seam pairs, notches, allowance, fit, or front/back view is established.',
  }
}

// Friendly entry point for the generator: output is evidence for template
// selection only and is intentionally uncalibrated.
export const interpretSketchRgba = interpretExoSketchRgba20261102

/** Decode a user-provided PNG/JPEG/WebP Blob in-browser; no uploads/network. */
export async function interpretExoSketchFile20261102(file, options = {}) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    !Number.isFinite(file.size) || file.size <= 0 || file.size > 8_000_000)
    return fail('INVALID_FILE', 'Upload PNG, JPEG, or WebP no larger than 8 MB.')
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined')
    return fail('BROWSER_REQUIRED', 'Image decoding requires a browser with canvas support.')
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
    if (bitmap.width < 24 || bitmap.height < 24 || bitmap.width * bitmap.height > 1_000_000)
      return fail('INVALID_DIMENSIONS', 'Image must be at least 24 pixels each way and no more than 1 megapixel.')
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width; canvas.height = bitmap.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return fail('CANVAS_UNAVAILABLE', 'Unable to read sketch pixels from canvas.')
    context.drawImage(bitmap, 0, 0)
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
    return interpretExoSketchRgba20261102({ ...options, rgba: data, width: bitmap.width, height: bitmap.height })
  } catch {
    return fail('DECODE_FAILED', 'Unable to decode image or inspect pixels; try a standard PNG.')
  } finally {
    bitmap?.close?.()
  }
}
