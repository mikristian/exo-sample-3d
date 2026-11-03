import test from 'node:test'
import assert from 'node:assert/strict'
import { interpretExoSketchRgba20261102, interpretExoSketchFile20261102 } from './exoSketchPatternInterpreter20261102.js'

const W = 120, H = 120
function image(shape) {
  const rgba = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = 4 * (y * W + x), black = shape(x, y)
    rgba[i] = rgba[i+1] = rgba[i+2] = black ? 0 : 255
    rgba[i+3] = 255
  }
  return { rgba, width: W, height: H }
}

test('filled high-contrast single shape creates editable retrieval seed, never manufacturing approval', () => {
  const result = interpretExoSketchRgba20261102(image((x,y) => x >= 27 && x <= 90 && y >= 19 && y <= 99))
  assert.equal(result.ok, true)
  assert.equal(result.mode, 'solid-silhouette')
  assert.ok(result.contourPx.length >= 4)
  assert.ok(result.normalizedContour.every(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1))
  assert.equal(result.possiblePatternSeed.unit, 'relative-image-coordinates')
  assert.equal(result.evidence.frontBackDetermined, false)
  assert.equal(result.confidence.measurements, 'none')
  assert.equal(result.manufacturingApproved, false)
  assert.equal(result.needsHumanReview, true)
})

test('closed black pen outline detects enclosed white interior', () => {
  const result = interpretExoSketchRgba20261102(image((x,y) =>
    ((x === 25 || x === 94) && y >= 20 && y <= 100) ||
    ((y === 20 || y === 100) && x >= 25 && x <= 94)))
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(result.mode, 'closed-line-drawing')
  assert.ok(result.evidence.enclosedPixels > 4000)
})

test('shirt-like drawing widens at upper sleeve region without claiming garment identity', () => {
  const result = interpretExoSketchRgba20261102(image((x,y) =>
    y >= 15 && y <= 103 && (y <= 38 ? x >= 10 && x <= 109 : x >= 37 && x <= 82)))
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(result.evidence.possibleSleeveExtension.detected, true)
  assert.equal(result.evidence.garmentCategory, 'unknown')
  assert.equal(result.evidence.view, 'unknown')
})

test('open thin line fails closed instead of becoming a factory pattern', () => {
  const result = interpretExoSketchRgba20261102(image((x,y) =>
    (x === 25 && y >= 20 && y <= 98) || (y === 98 && x >= 25 && x <= 95) ||
    (x === 95 && y >= 20 && y <= 98)))
  assert.equal(result.ok, false, JSON.stringify(result))
  assert.ok(['UNCLOSED_OUTLINE','OPEN_OR_FRAGMENTARY_SKETCH'].includes(result.code))
})

test('two independent silhouettes fail rather than silently discard one', () => {
  const result = interpretExoSketchRgba20261102(image((x,y) =>
    (x >= 10 && x <= 40 && y >= 20 && y <= 70) ||
    (x >= 75 && x <= 107 && y >= 25 && y <= 80)))
  assert.equal(result.ok, false)
  assert.equal(result.code, 'MULTIPLE_SILHOUETTES')
})

test('cropped drawing, empty drawing, transparency, and oversized image reject', () => {
  assert.equal(interpretExoSketchRgba20261102(image((x,y) => x < 55 && y > 19 && y < 90)).ok, false)
  assert.equal(interpretExoSketchRgba20261102(image(() => false)).code, 'NO_DRAWING')
  const transparent = image(() => true)
  transparent.rgba.forEach((_,i) => { if (i % 4 === 3) transparent.rgba[i] = 0 })
  assert.equal(interpretExoSketchRgba20261102(transparent).code, 'NO_DRAWING')
  assert.equal(interpretExoSketchRgba20261102({ rgba: new Uint8ClampedArray(4), width: 2000, height: 2000 }).code, 'INVALID_IMAGE')
})

test('file API validates type without browser or decoding', async () => {
  assert.equal((await interpretExoSketchFile20261102({type:'application/pdf',size:400})).code, 'INVALID_FILE')
  assert.equal((await interpretExoSketchFile20261102({type:'image/png',size:9_000_000})).code, 'INVALID_FILE')
  assert.equal((await interpretExoSketchFile20261102({type:'image/png',size:120})).code, 'BROWSER_REQUIRED')
})
