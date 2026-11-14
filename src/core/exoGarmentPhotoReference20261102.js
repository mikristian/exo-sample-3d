// Local photo evidence extractor. Pixel contours are never sewing patterns.
import { traceAccuMarkPhotoSilhouette20261024 } from './accumarkPhotoDigitize20261024.js'

const KIND = 'photo-reference'
const safety = { measurementCalibrationVerified: false, physicalCalibrationVerified: false, manufacturingApproved: false, needsHumanReview: true }
const safe = value => Number(value.toFixed(4))
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
function result(code, reason, evidence = {}, referenceAttributes = {}) {
  return { kind: KIND, ok: false, code, reason, normalizedContour: null, silhouetteAspectRatio: null,
    evidence, referenceAttributes, ...safety }
}

function rgbDistance(r, g, b, color) {
  return Math.hypot(r - color[0], g - color[1], b - color[2])
}

/** Interpret an isolated garment photo as visual evidence, with no inferred measurements or seam topology.
 * The foreground is compared to an empirically sampled, nearly uniform image border.
 * Busy backgrounds, cropped objects, transparency and multiple objects are rejected.
 */
export function interpretExoGarmentPhotoRgba20261102({ rgba, width, height, maxPoints = 512 } = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 32 || height < 32 ||
      width * height > 1_000_000 || !rgba || rgba.length !== width * height * 4 ||
      !Number.isInteger(maxPoints) || maxPoints < 16 || maxPoints > 1024)
    return result('INVALID_IMAGE', 'Provide RGBA pixels at least 32 by 32 and no more than one megapixel.')

  const n = width * height
  let transparent = 0
  for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] < 250) transparent++
  if (transparent > 0)
    return result('TRANSPARENT_IMAGE', 'Use an opaque garment photo; transparent image regions are not reliable photo evidence.',
      { transparentFraction: safe(transparent / n) })

  // Sample all four border sides, at a modest stride, to detect actual photographic background.
  const samples = []
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 120))
  const add = (x, y) => { const i = (y * width + x) * 4; samples.push([rgba[i], rgba[i + 1], rgba[i + 2]]) }
  for (let x = 0; x < width; x += stride) { add(x, 0); add(x, height - 1) }
  for (let y = stride; y < height - 1; y += stride) { add(0, y); add(width - 1, y) }
  const median = channel => {
    const values = samples.map(s => s[channel]).sort((a, b) => a - b)
    return values[Math.floor(values.length / 2)]
  }
  const background = [median(0), median(1), median(2)]
  const distances = samples.map(s => rgbDistance(...s, background)).sort((a, b) => a - b)
  const p90 = distances[Math.floor(.9 * (distances.length - 1))]
  const p98 = distances[Math.floor(.98 * (distances.length - 1))]
  const backgroundEvidence = { backgroundRgb: background, borderDistanceP90: safe(p90),
    borderDistanceP98: safe(p98), method: 'border-color-distance-and-connected-components' }
  if (p90 > 29 || p98 > 65)
    return result('BUSY_BACKGROUND', 'The image border contains varied colors or objects. Use one garment against a plain background.', backgroundEvidence)

  const threshold = clamp(Math.max(33, p90 * 2.2 + 14), 33, 67)
  const mask = new Uint8Array(n)
  let foreground = 0
  for (let i = 0; i < n; i++) {
    const j = i * 4
    if (rgbDistance(rgba[j], rgba[j + 1], rgba[j + 2], background) >= threshold) {
      mask[i] = 1
      foreground++
    }
  }
  const commonEvidence = { ...backgroundEvidence, segmentationThreshold: safe(threshold),
    foregroundFraction: safe(foreground / n), foregroundPixels: foreground }
  if (foreground < Math.max(120, n * .015))
    return result('NO_FOREGROUND', 'No sufficiently distinct garment was found against the background.', commonEvidence)
  if (foreground > n * .77)
    return result('BACKGROUND_AMBIGUOUS', 'Most pixels differ from the sampled border; the background cannot be separated reliably.', commonEvidence)

  const visited = new Uint8Array(n)
  const queue = new Int32Array(n)
  const components = []
  const minimumComponent = Math.max(100, Math.floor(n * .006))
  for (let seed = 0; seed < n; seed++) {
    if (!mask[seed] || visited[seed]) continue
    let head = 0, tail = 1, xMin = width, xMax = -1, yMin = height, yMax = -1, touchesEdge = false
    queue[0] = seed
    visited[seed] = 1
    while (head < tail) {
      const i = queue[head++], x = i % width, y = Math.floor(i / width)
      if (x < xMin) xMin = x
      if (x > xMax) xMax = x
      if (y < yMin) yMin = y
      if (y > yMax) yMax = y
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) touchesEdge = true
      const near = [x ? i - 1 : -1, x < width - 1 ? i + 1 : -1,
        y ? i - width : -1, y < height - 1 ? i + width : -1]
      for (const next of near) if (next >= 0 && mask[next] && !visited[next]) {
        visited[next] = 1
        queue[tail++] = next
      }
    }
    if (tail >= minimumComponent) components.push({ pixels: tail, xMin, xMax, yMin, yMax, touchesEdge })
  }
  components.sort((a, b) => b.pixels - a.pixels)
  const evidence = { ...commonEvidence, significantComponents: components.length,
    componentPixelAreas: components.slice(0, 8).map(c => c.pixels) }
  if (!components.length) return result('FRAGMENTED_FOREGROUND', 'No coherent garment silhouette was found.', evidence)
  if (components.length > 1 && components[1].pixels >= components[0].pixels * .08)
    return result('MULTIPLE_OBJECTS', 'Multiple significant foreground objects were found. Isolate one garment.', evidence)

  const main = components[0]
  evidence.foregroundBoundsPx = { xMin: main.xMin, xMax: main.xMax, yMin: main.yMin, yMax: main.yMax }
  evidence.dominantComponentFraction = safe(main.pixels / foreground)
  if (main.touchesEdge)
    return result('CROPPED_OBJECT', 'Foreground touches the image edge; show the entire garment.', evidence)
  if (main.pixels / foreground < .88)
    return result('FRAGMENTED_FOREGROUND', 'Too many detached foreground regions for a reliable garment silhouette.', evidence)
  const boundingArea = (main.xMax - main.xMin + 1) * (main.yMax - main.yMin + 1)
  const occupancy = main.pixels / boundingArea
  evidence.boundingBoxOccupancy = safe(occupancy)
  if (occupancy < .26)
    return result('AMBIGUOUS_POSE', 'The silhouette is too fragmented or widely extended for reliable isolated-garment analysis.', evidence)

  // The established contour tracer rejects holes/ambiguous boundaries and bounds simplification error.
  // Apply it to a binary image created from the color-distance foreground.
  const mono = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    const value = mask[i] ? 0 : 255, j = i * 4
    mono[j] = mono[j + 1] = mono[j + 2] = value
    mono[j + 3] = 255
  }
  const traced = traceAccuMarkPhotoSilhouette20261024({
    rgba: mono, width, height, threshold: 120, minPixels: minimumComponent,
    maxPoints, simplifyTolerancePx: .9,
  })
  if (!traced.ok)
    return result(traced.code, traced.reason, { ...evidence, traceError: traced.code })

  const b = traced.pixelBounds, bw = b.xMax - b.xMin, bh = b.yMax - b.yMin
  if (!bw || !bh) return result('DEGENERATE_CONTOUR', 'The contour has no visible width or height.', evidence)
  const rowWidths = [0.15, 0.3, 0.5, 0.7, 0.85].map(fraction => {
    const y = Math.min(height - 1, Math.floor(b.yMin + fraction * bh))
    let left = width, right = -1
    for (let x = b.xMin; x < b.xMax; x++) if (mask[y * width + x]) {
      left = Math.min(left, x)
      right = Math.max(right, x)
    }
    return { heightFraction: fraction, widthFraction: right >= left ? safe((right - left + 1) / bw) : null }
  })
  const upperWidth = Math.max(rowWidths[0].widthFraction ?? 0, rowWidths[1].widthFraction ?? 0)
  const middleWidth = rowWidths[2].widthFraction
  const sleeveLike = middleWidth != null && upperWidth > middleWidth * 1.3
  const rgbCounts = new Map()
  for (let y = main.yMin; y <= main.yMax; y += 2) for (let x = main.xMin; x <= main.xMax; x += 2) {
    const i = y * width + x
    if (!mask[i]) continue
    const j = i * 4
    const key = [rgba[j], rgba[j + 1], rgba[j + 2]].map(v => Math.round(v / 32) * 32).join(',')
    rgbCounts.set(key, (rgbCounts.get(key) ?? 0) + 1)
  }
  const modal = [...rgbCounts].sort((a, b) => b[1] - a[1])[0]
  const dominantColorRgb = modal ? modal[0].split(',').map(v => Math.min(255, Number(v))) : null
  const referenceAttributes = { dominantForegroundRgbApprox: dominantColorRgb,
    colorSampling: 'coarse foreground RGB histogram; affected by lighting and shadows',
    possibleSleeveExtension: sleeveLike ? 'low-confidence' : 'unresolved',
    view: 'unknown', garmentFamily: 'unknown', seamTopology: 'unknown' }
  evidence.widthBands = rowWidths
  evidence.possibleSleeveExtension = { detected: sleeveLike, confidence: 'low', basis: 'relative upper-to-midline foreground width' }
  evidence.traceAreaChangeRatio = traced.areaChangeRatio
  evidence.contourPoints = traced.outlinePoints
  const normalizedContour = traced.observedPoints.map(p => ({
    x: Number(((p.x - b.xMin) / bw).toFixed(6)),
    y: Number(((p.y - b.yMin) / bh).toFixed(6)),
  }))
  return { kind: KIND, ok: true, source: 'local-photo-rgba-segmentation',
    mode: 'isolated-garment-photo', bbox: b, normalizedContour,
    contourPx: traced.observedPoints, silhouetteAspectRatio: safe(bw / bh),
    garmentFamilyHint: sleeveLike ? 'upper-body-candidate' : 'unknown',
    evidence, referenceAttributes, confidence: { segmentation: 'medium', outerContour: 'medium',
      garmentIdentification: 'none', construction: 'none', size: 'none' },
    possiblePatternSeed: { kind: 'uncalibrated-photo-outline', normalizedContour,
      unit: 'relative-image-coordinates', usableFor: 'visual-reference-or-human-review' },
    warning: 'A photo provides appearance and outer silhouette evidence only. Perspective, folds, pose and fabric conceal the actual cut panels and measurements.',
    ...safety }
}

export const interpretGarmentPhotoRgba = interpretExoGarmentPhotoRgba20261102

/** Decode PNG/JPEG/WebP locally and bound analysis to <=1 megapixel. */
export async function interpretExoGarmentPhotoFile20261102(file, options = {}) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      !Number.isFinite(file.size) || file.size <= 0 || file.size > 8_000_000)
    return result('INVALID_FILE', 'Use PNG, JPEG or WebP no larger than 8 MB.')
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined')
    return result('BROWSER_REQUIRED', 'Photo decoding requires local browser canvas support.')
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
    if (bitmap.width < 32 || bitmap.height < 32)
      return result('INVALID_DIMENSIONS', 'Photo must be at least 32 pixels in each direction.')
    const scale = Math.min(1, Math.sqrt(1_000_000 / (bitmap.width * bitmap.height)))
    const width = Math.max(1, Math.floor(bitmap.width * scale))
    const height = Math.max(1, Math.floor(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return result('CANVAS_UNAVAILABLE', 'Unable to read decoded photo pixels.')
    context.drawImage(bitmap, 0, 0, width, height)
    const rgba = context.getImageData(0, 0, width, height).data
    const analysis = interpretExoGarmentPhotoRgba20261102({ ...options, rgba, width, height })
    return { ...analysis, evidence: { ...analysis.evidence, originalDimensionsPx: {
      width: bitmap.width, height: bitmap.height }, analysisDimensionsPx: { width, height } } }
  } catch {
    return result('DECODE_FAILED', 'Unable to decode the image or inspect pixels.')
  } finally {
    bitmap?.close?.()
  }
}

export const interpretGarmentPhotoFile = interpretExoGarmentPhotoFile20261102
