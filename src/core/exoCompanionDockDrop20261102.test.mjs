import test from 'node:test'
import assert from 'node:assert/strict'
import { getExoCompanionDockDrop20261102 as target } from './exoCompanionDockDrop20261102.js'

const shell = { left: 0, top: 0, width: 1200, height: 800 }
const viewport = { left: 200, top: 70, width: 800, height: 650 }
const run = (x, y, extras = {}) => target({ pointer: { x, y }, shell, viewport, ...extras })

test('five docking targets resolve and previews stay inside shell', () => {
 for (const [name, x, y] of [['left', 5, 400], ['right', 1195, 400], ['top', 600, 3], ['bottom', 600, 796], ['center-wide', 600, 395]]) {
  const result = run(x, y)
  assert.equal(result?.target, name)
  const r = result.preview
  assert.ok(r?.width > 0 && r?.height > 0)
  assert.ok(r.left >= 0 && r.top >= 0 && r.right <= 1200 && r.bottom <= 800)
 }
})

test('nearest normalized border wins overlapping corner bands', () => {
 assert.equal(run(2, 80).target, 'left')
 assert.equal(run(120, 1).target, 'top')
 assert.equal(run(1199, 799).target, 'right')
})

test('outside shell releases into floating, cancellation and offscreen release reject', () => {
 assert.equal(run(-15, 350)?.target, 'floating')
 assert.equal(run(1280, 350)?.target, 'floating')
 assert.equal(run(600, 400, { cancelled: true }), null)
 assert.equal(run(1300, 400, { bounds: { left: 0, top: 0, width: 1200, height: 800 } }), null)
 assert.equal(run(Number.NaN, 0), null)
})

test('small viewport provides stable docks and positive finite bounded previews', () => {
 const smallShell = { left: 20, top: 30, width: 310, height: 240 }
 const smallView = { left: 55, top: 55, width: 240, height: 195 }
 for (const [expected, x, y] of [['left', 21, 145], ['right', 329, 145], ['top', 175, 31], ['bottom', 175, 269], ['center-wide', 175, 145]]) {
  const result = run(x, y, { shell: smallShell, viewport: smallView })
  assert.equal(result.target, expected)
  assert.ok(result.preview.width > 0 && result.preview.height > 0)
  assert.ok(result.preview.left >= 20 && result.preview.top >= 30 && result.preview.right <= 330 && result.preview.bottom <= 270)
 }
})
