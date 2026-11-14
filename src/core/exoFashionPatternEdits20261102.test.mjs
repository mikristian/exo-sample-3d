import test from 'node:test'
import assert from 'node:assert/strict'
import { createTemplateProject } from '../data/templates.js'
import { edgeLength } from './project.js'
import { interpretExoFashionTeeCommand, applyExoFashionTeeEdit } from './exoFashionPatternEdits20261102.js'

test('understands natural T-shirt styling requests', () => {
  assert.deepEqual([true, true, true], ['make it oversized and slightly cropped', 'crop the T-shirt', 'make it boxy'].map(command => Boolean(interpretExoFashionTeeCommand(command))))
  assert.equal(interpretExoFashionTeeCommand('turn the shirt blue'), null)
  assert.equal(interpretExoFashionTeeCommand('crop the T-shirt by 6 cm').cropCm, 6)
})

test('edits real tee without modifying input, indexed seams, neckline or sleeve caps', () => {
  const input = createTemplateProject('tee')
  const snapshot = structuredClone(input)
  const result = applyExoFashionTeeEdit(input, 'make it oversized and slightly cropped')
  assert.equal(result.changed, true)
  assert.equal(result.adjustmentsCm.bodyLength, -4)
  assert.equal(result.adjustmentsCm.hemWidthPerPanel, 6)
  assert.deepEqual(input, snapshot)
  assert.equal(result.project.revision, input.revision + 1)
  assert.deepEqual(result.project.seams, input.seams)
  for (const id of ['front', 'back', 'sleeve-left', 'sleeve-right']) {
    const a = input.pieces.find(p => p.id === id)
    const b = result.project.pieces.find(p => p.id === id)
    assert.equal(a.points.length, b.points.length)
    assert.deepEqual(a.curves, b.curves)
    assert.deepEqual(a.notches, b.notches)
    for (const edge of [1, 2, 6]) assert.ok(Math.abs(edgeLength(a, edge) - edgeLength(b, edge)) < 1e-8)
    if (id.startsWith('sleeve')) assert.deepEqual(a.points, b.points)
  }
  assert.equal(result.after.front.lengthCm, result.before.front.lengthCm - 4)
  assert.equal(result.after.back.hemWidthCm, result.before.back.hemWidthCm + 6)
})

test('rejects unsafe geometry requests and unrelated templates', () => {
  const tee = createTemplateProject('tee')
  assert.throws(() => applyExoFashionTeeEdit(tee, 'crop 30 cm'), /bounds/)
  assert.throws(() => applyExoFashionTeeEdit(createTemplateProject('hoodie'), 'make it boxy'), /Foundation Tee/)
  const locked = structuredClone(tee)
  locked.pieces.find(p => p.id === 'front').locked = true
  assert.throws(() => applyExoFashionTeeEdit(locked, 'make it boxy'), /locked/)
})
