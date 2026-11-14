import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseValentinaMeasurements } from './valentinaMeasurements20261031.js'

test('authentic Valentina MaleShirt .vit file preserves nine body measurements',()=>{
  const xml=readFileSync(new URL('./fixtures/valentina/MaleShirt.vit',import.meta.url),'utf8')
  const result=parseValentinaMeasurements(xml,{filename:'MaleShirt.vit'})
  assert.equal(result.kind,'vit')
  assert.equal(result.sourceUnit,'cm')
  assert.equal(result.measurementCount,9)
  assert.equal(result.measurements.height.valueCm,173)
  assert.equal(result.measurements.bust_circ.valueCm,102)
  assert.equal(result.manufacturingApproved,false)
})

test('individual Valentina vit measurements convert units and retain formulas without evaluation', () => {
  const xml='<vit><unit>inch</unit><body-measurements><m name="waist" value="32" description="Waist"/><m name="front" value="waist / 4 + 2"/></body-measurements></vit>'
  const result=parseValentinaMeasurements(xml,{filename:'sample.vit'})
  assert.equal(result.measurements.waist.valueCm,81.28)
  assert.equal(result.measurements.front.valueCm,null)
  assert.equal(result.measurements.front.expression,'waist / 4 + 2')
  assert.equal(result.hasUnevaluatedFormulas,true)
  assert.equal(result.manufacturingApproved,false)
})

test('multisize Valentina vst keeps grading increments and size table axis metadata',()=>{
  const xml='<vst><unit>cm</unit><size base="50" step="2" min="44" max="60"/><height base="176" step="6"/><body-measurements><m name="bust" base="100" size_increase="4" height_increase="-1"/></body-measurements></vst>'
  const result=parseValentinaMeasurements(xml,{filename:'grading.vst'})
  assert.equal(result.size.base,50)
  assert.equal(result.measurements.bust.sizeIncreaseCm,4)
  assert.equal(result.measurements.bust.heightIncreaseCm,-1)
})

test('rejects XML entity expansion, invalid units, duplicate identifiers, mismatched roots and missing measurement values',()=>{
  const cases=['<!DOCTYPE vit [<!ENTITY x "bad">]><vit/>','<vit><unit>parsec</unit><body-measurements><m name="x" value="3"/></body-measurements></vit>','<vit><unit>cm</unit><body-measurements><m name="x" value="1"/><m name="x" value="2"/></body-measurements></vit>','<vit><unit>cm</unit><body-measurements><m name="x"/></body-measurements></vit>']
  for(const xml of cases) assert.throws(()=>parseValentinaMeasurements(xml))
  assert.throws(()=>parseValentinaMeasurements('<vit><unit>cm</unit><body-measurements><m name="x" value="1"/></body-measurements></vit>',{filename:'wrong.vst'}))
})
