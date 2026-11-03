import test from 'node:test'
import assert from 'node:assert/strict'
import { interpretExoGarmentPhotoRgba20261102 as analyze,
  interpretExoGarmentPhotoFile20261102 as fileAnalyze } from './exoGarmentPhotoReference20261102.js'

const WIDTH = 160, HEIGHT = 160
function photo(background = [245, 245, 245]) {
  const rgba = new Uint8ClampedArray(WIDTH * HEIGHT * 4)
  for (let i = 0; i < WIDTH * HEIGHT; i++) rgba.set([...background, 255], i * 4)
  return rgba
}
function rect(rgba, x0, y0, x1, y1, color = [32, 67, 114]) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++)
    rgba.set([...color, 255], (y * WIDTH + x) * 4)
}
function hoodiePhoto() {
  const rgba = photo()
  rect(rgba, 54, 45, 106, 130)
  rect(rgba, 35, 50, 55, 78)
  rect(rgba, 105, 50, 125, 78)
  rect(rgba, 66, 25, 94, 47)
  return rgba
}

test('real colored foreground is segmented as local photo evidence; no manufactured pattern claims', () => {
  const output = analyze({ rgba: hoodiePhoto(), width: WIDTH, height: HEIGHT })
  assert.equal(output.ok, true, JSON.stringify(output))
  assert.equal(output.kind, 'photo-reference')
  assert.ok(output.normalizedContour.length > 8)
  assert.ok(output.normalizedContour.every(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1))
  assert.ok(output.silhouetteAspectRatio > .5)
  assert.equal(output.measurementCalibrationVerified, false)
  assert.equal(output.manufacturingApproved, false)
  assert.equal(output.needsHumanReview, true)
  assert.equal(output.referenceAttributes.garmentFamily, 'unknown')
  assert.ok(output.referenceAttributes.dominantForegroundRgbApprox)
  assert.equal(output.evidence.significantComponents, 1)
  assert.ok(output.evidence.widthBands.length >= 4)
})

test('solid background without object rejects without contour', () => {
  const output = analyze({ rgba: photo(), width: WIDTH, height: HEIGHT })
  assert.equal(output.code, 'NO_FOREGROUND')
  assert.equal(output.normalizedContour, null)
})

test('busy photographic background rejects rather than guessing', () => {
  const rgba = hoodiePhoto()
  for (let x = 0; x < WIDTH; x++) {
    rgba.set(x % 2 ? [245, 245, 245, 255] : [30, 170, 50, 255], x * 4)
  }
  const output = analyze({ rgba, width: WIDTH, height: HEIGHT })
  assert.equal(output.code, 'BUSY_BACKGROUND')
})

test('two separated garments reject as multiple objects', () => {
  const rgba = photo()
  rect(rgba, 20, 35, 61, 125)
  rect(rgba, 99, 35, 140, 125)
  const output = analyze({ rgba, width: WIDTH, height: HEIGHT })
  assert.equal(output.code, 'MULTIPLE_OBJECTS')
})

test('partially transparent photographic input rejects', () => {
  const rgba = hoodiePhoto()
  rgba[3] = 0
  const output = analyze({ rgba, width: WIDTH, height: HEIGHT })
  assert.equal(output.code, 'TRANSPARENT_IMAGE')
})

test('cropped foreground rejects', () => {
  const rgba = photo()
  rect(rgba, 10, 25, 85, 125)
  rect(rgba, 0, 65, 11, 80)
  const output = analyze({ rgba, width: WIDTH, height: HEIGHT })
  assert.ok(['CROPPED_OBJECT', 'BUSY_BACKGROUND'].includes(output.code), output.code)
  assert.equal(output.ok, false)
})

test('unsupported file metadata rejected without browser dependencies', async () => {
  const output = await fileAnalyze({ type: 'image/svg+xml', size: 500 })
  assert.equal(output.code, 'INVALID_FILE')
  assert.equal(output.kind, 'photo-reference')
})
