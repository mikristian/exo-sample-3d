import test from 'node:test'
import assert from 'node:assert/strict'
import { createHoodieTemplate } from '../data/templates.js'
import { transformHoodieFitGeometry, measureHoodieFitGeometry } from './exoHoodieFitGeometry20261102.js'

test('width, body length, immutability, and attached seam lengths', () => {
  const source = createHoodieTemplate()
  const frozenSnapshot = JSON.stringify(source)
  const { project, before, after, diagnostics } = transformHoodieFitGeometry(source, { widthScale: 1.18, bodyLengthDeltaCm: -6 })
  assert.equal(JSON.stringify(source), frozenSnapshot)
  assert.notEqual(project, source)
  assert.equal(project.revision, source.revision + 1)
  assert.ok(Math.abs(after.frontChestWidthCm / before.frontChestWidthCm - 1.18) < 1e-10)
  assert.ok(Math.abs(after.backHemWidthCm / before.backHemWidthCm - 1.18) < 1e-10)
  assert.ok(Math.abs(after.frontBodyLengthCm - before.frontBodyLengthCm + 6) < 1e-10)
  assert.ok(Math.abs(after.backBodyLengthCm - before.backBodyLengthCm + 6) < 1e-10)
  assert.ok(diagnostics.seamDiagnostics.length >= 20)
  assert.ok(diagnostics.seamDiagnostics.every(item => Number.isFinite(item.mismatchPercent)))
  assert.ok(diagnostics.seamDiagnostics.every(item => item.afterDifferenceCm <= item.beforeDifferenceCm * 1.18 + 0.20))
  assert.ok(diagnostics.seamDiagnostics.filter(item => item.id.includes('-neck-')).every(item => item.afterDifferenceCm < 0.005))
  const oldFront = source.pieces.find(p => p.id === 'front')
  const newFront = project.pieces.find(p => p.id === 'front')
  assert.equal(oldFront.points[1].y, newFront.points[1].y)
  assert.equal(oldFront.points[3].y, newFront.points[3].y)
  assert.equal(measureHoodieFitGeometry(project).frontBodyLengthCm, after.frontBodyLengthCm)
})

test('rejects unsupported drops and malformed pattern without mutating source', () => {
  const source = createHoodieTemplate()
  assert.throws(() => transformHoodieFitGeometry(source, { dropShoulderCm: 4 }), /Dropped shoulder/)
  assert.throws(() => transformHoodieFitGeometry(source, { widthScale: Infinity }), /widthScale/)
  assert.throws(() => transformHoodieFitGeometry(source, { bodyLengthDeltaCm: -21 }), /bodyLengthDeltaCm/)
  const broken = structuredClone(source)
  broken.pieces.find(p => p.id === 'front').points.pop()
  assert.throws(() => transformHoodieFitGeometry(broken, {}), /topology/)
})
