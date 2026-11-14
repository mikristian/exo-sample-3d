import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseValentinaMeasurements} from './valentinaMeasurements20261031.js'
import {evaluateValentinaGradedMeasurements20261031 as grade,evaluateValentinaSizeRun20261031 as run} from './valentinaGradedMeasurements20261031.js'

const real=readFileSync(new URL('./fixtures/valentina/GOST_man_ru_20261031.vst',import.meta.url),'utf8')
const mm=parseValentinaMeasurements(real,{filename:'GOST_man_ru_20261031.vst'})
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} differs from ${b}`)

test('authentic original Valentina GOST .vst grades bust independently along size and height in source units',()=>{
  assert.equal(mm.kind,'vst')
  assert.equal(mm.measurements.bust_circ.raw.base,'1044')
  assert.equal(mm.measurements.bust_circ.raw.size_increase,'38')
  assert.equal(mm.measurements.bust_circ.raw.height_increase,'2')
  const base=grade(mm,{patternUnit:'cm'})
  const large=grade(mm,{sizeSteps:2,heightSteps:1,patternUnit:'cm'})
  near(base.measurements.bust_circ,104.4)
  near(large.measurements.bust_circ,112.2)
  near(large.measurementsCm.height,mm.measurements.height.valueCm+1*mm.measurements.height.heightIncreaseCm)
  assert.equal(large.sizeBase,500)
  assert.equal(large.heightBase,1760)
  assert.equal(large.sizeAxisStepKnown,false)
  assert.equal(large.manufacturingApproved,false)
})
test('original Valentina source grade emits exact 5-size input run, not fake graded CUT pieces',()=>{
  const matrix=run(mm,{sizeSteps:[-2,-1,0,1,2],heightSteps:[0],patternUnit:'mm'})
  assert.equal(matrix.cases.length,5)
  for(let i=0;i<5;i++)near(matrix.cases[i].measurements.bust_circ,1044+(i-2)*38)
  assert.ok(matrix.cases.every(c=>c.manufacturingApproved===false))
})
test('individual measurements stay individual and source formula/size rejection fails closed',()=>{
  const sample=readFileSync(new URL('./fixtures/valentina/MaleShirt.vit',import.meta.url),'utf8')
  near(grade(sample,{patternUnit:'cm'}).measurements.bust_circ,102)
  assert.throws(()=>grade(sample,{sizeSteps:1}),/do not define/)
  assert.throws(()=>grade(mm,{sizeSteps:21}),/between -20 and 20/)
  assert.throws(()=>grade(mm,{heightSteps:1.5}),/integer/)
  assert.throws(()=>run(mm,{sizeSteps:[0,0]}),/Duplicate/)
  const bad=structuredClone(mm)
  bad.measurements.bust_circ={...bad.measurements.bust_circ,isFormula:true}
  assert.throws(()=>grade(bad),/expression evaluation/)
})
