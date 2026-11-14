import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseValentinaMeasurements} from './valentinaMeasurements20261031.js'
import {applyValentinaVitMeasurementEdits20261031,updateValentinaVitMeasurement20261031} from './valentinaSourceMeasurementEdit20261031.js'

const source=readFileSync(new URL('./fixtures/valentina/MaleShirt.vit',import.meta.url),'utf8')
test('changes one real Valentina .vit measurement while preserving every other source field',()=>{
  const result=updateValentinaVitMeasurement20261031(source,'bust_circ',110)
  assert.equal(parseValentinaMeasurements(result).measurements.bust_circ.valueCm,110)
  assert.equal(parseValentinaMeasurements(result).measurements.waist_circ.valueCm,92)
  assert.equal(result.replace('name="bust_circ" value="110"','name="bust_circ" value="102"'),source)
})
test('applies multiple original Valentina numeric measurement edits, rejecting unknown/non-numeric',()=>{
  const result=applyValentinaVitMeasurementEdits20261031(source,{bust_circ:110,waist_circ:'95'})
  assert.equal(parseValentinaMeasurements(result).measurements.bust_circ.valueCm,110)
  assert.equal(parseValentinaMeasurements(result).measurements.waist_circ.valueCm,95)
  for(const values of [{waist_circ:'abc'},{waist_circ:0},{waist_circ:NaN},{not_real:4},{waist_circ:''}])
    assert.throws(()=>applyValentinaVitMeasurementEdits20261031(source,values))
})
test('never edits a Valentina .vst table or expression-valued body measurement',()=>{
  const vst='<vst><unit>cm</unit><body-measurements><m name="height" base="173"/></body-measurements></vst>'
  assert.throws(()=>updateValentinaVitMeasurement20261031(vst,'height',180),/individual/)
  const formula='<vit><unit>cm</unit><body-measurements><m name="height" value="waist_circ+3"/></body-measurements></vit>'
  assert.throws(()=>updateValentinaVitMeasurement20261031(formula,'height',180),/Expression/)
})
