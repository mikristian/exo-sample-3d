import test from 'node:test'
import assert from 'node:assert/strict'
import { interpretExoFashionIntent, EXO_FASHION_BRAND_VOCABULARY } from './exoFashionIntent20261102.js'

test('Balenciaga reference yields grounded proportions and clearly pending shoulder engineering', () => {
  const result = interpretExoFashionIntent('Make my tee a Balenciaga oversized type fit')
  assert.equal(result.brandReference, 'Balenciaga')
  assert.equal(result.measurementsCm.torsoHalfSideAdd.valueCm, 5)
  assert.equal(result.operations[0].handler, 'applyExoFashionTeeEdit')
  assert.equal(result.operations[0].widthAddHalfCm, 5)
  assert.ok(result.pendingConstruction.includes('drop-shoulder'))
  assert.equal(result.executable, false)
  assert.match(result.provenance, /no proprietary pattern/)
})

test('explicit fit parameters remain bounded, and a requested shoulder alteration is not faked as a tee edit', () => {
  const fit = interpretExoFashionIntent('Boxy cropped tee crop 6 cm and dropped shoulder 3 cm')
  assert.equal(fit.measurementsCm.crop.valueCm, 6)
  assert.equal(fit.measurementsCm.shoulderDrop.valueCm, 3)
  assert.equal(fit.operations[0].cropCm, 6)
  assert.ok(fit.pendingConstruction.includes('drop-shoulder'))
  const unsafe = interpretExoFashionIntent('Crop 90 cm')
  assert.equal(unsafe.measurementsCm.crop.withinBounds, false)
  assert.equal(unsafe.operations.length, 0)
  assert.ok(unsafe.pendingConstruction.includes('out-of-bounds-measurement'))
})

test('other houses map to descriptions, ambiguity stays an interpretation and unrelated speech is ignored', () => {
  assert.ok(Object.keys(EXO_FASHION_BRAND_VOCABULARY).length >= 10)
  const owens = interpretExoFashionIntent('Rick Owens draped longer lines', { garment: 'hoodie' })
  assert.equal(owens.brandReference, 'Rick Owens')
  assert.equal(owens.operations.length, 0)
  assert.ok(owens.pendingConstruction.includes('draped'))
  assert.equal(interpretExoFashionIntent('turn off nest grading lines'), null)
  assert.equal(interpretExoFashionIntent('not oversized').status, 'needs-clarification')
  assert.equal(interpretExoFashionIntent('x'.repeat(2100)), null)
})
