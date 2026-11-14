import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {evaluateValentinaConnectedSizeRun20261031 as sizeRun} from './valentinaConnectedSizeRun20261031.js'

const basic=readFileSync(new URL('./fixtures/valentina/Basic_block_women-2016.val',import.meta.url),'utf8')
const gost=readFileSync(new URL('./fixtures/valentina/GOST_man_ru_20261031.vst',import.meta.url),'utf8')
test('Valentina measurement-sized 2D source construction points recompute across actual source size run',()=>{
  const linked=basic.replace('formula="92" name="#CG"','formula="bust_circ" name="#CG"')
  assert.notEqual(linked,basic,'genuine source increment #CG must be connected to GOST bust')
  const result=sizeRun(linked,gost,{sizeSteps:[-1,0,1],heightSteps:[0]})
  assert.equal(result.cases.length,3)
  assert.equal(result.sourceUnit,'cm')
  assert.ok(result.cases.every(c=>c.pointCount>50))
  const names=result.cases.map(c=>c.measurements.bust_circ)
  for(const [index,expected] of [100.6,104.4,108.2].entries())
    assert.ok(Math.abs(names[index]-expected)<1e-9,`size ${index}: ${names[index]}`)
  assert.ok(result.comparisons[0].movedCount>0)
  assert.equal(result.comparisons[1].movedCount,0)
  assert.ok(result.comparisons[2].movedCount>0)
  assert.equal(result.manufacturingApproved,false)
})
test('Valentina measured grading is bounded and reports unsupported source geometry without fabricating',()=>{
  assert.throws(()=>sizeRun(basic,gost,{sizeSteps:[-2,-1,0,1,2],heightSteps:[-2,-1,0,1,2]}),/Bounded/)
  const source=sizeRun(basic,gost,{sizeSteps:[0,1],heightSteps:[0],maxPoints:2000})
  assert.ok(source.cases[0].diagnostics.some(v=>/UNSUPPORTED|UNRESOLVED|GEOMETRY_ERROR/.test(v.code)))
  assert.equal(source.manufacturingApproved,false)
})
