import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {generateEditablePatternCandidate} from './exoLearnedPatternGenerator20261102.js'

const fixture=JSON.parse(readFileSync(new URL('../../blender_bridge/fixtures/tee.garment.json',import.meta.url),'utf8'))
test('draft preserves seam graph and notch indexing and scales authored curves without modifying source',()=>{
  const original=structuredClone(fixture)
  const result=generateEditablePatternCandidate(fixture,{scalePercent:2})
  assert.equal(result.ok,true,result.reason)
  assert.deepEqual(fixture,original)
  assert.deepEqual(result.project.seams,fixture.seams)
  assert.deepEqual(result.project.pieces[0].notches.map(x=>x.edgeIndex),fixture.pieces[0].notches.map(x=>x.edgeIndex))
  const first=fixture.pieces[0]
  const generated=result.project.pieces[0]
  assert.equal(generated.points.length,first.points.length)
  assert.ok(Math.abs((generated.points[0].x-generated.points[1].x)/(first.points[0].x-first.points[1].x)-1.02)<1e-9)
  assert.ok(Math.abs(generated.seamAllowance-first.seamAllowance*1.02)<1e-9)
  assert.notDeepEqual(generated.curves,first.curves)
})
test('invalid seam endpoint and industrial linked documents reject without mutation',()=>{
  const broken=structuredClone(fixture)
  broken.seams[0].a.edgeIndex=999
  assert.match(generateEditablePatternCandidate(broken).reason,/invalid a endpoint/)
  assert.match(generateEditablePatternCandidate({...fixture,modarisSizeLinkedGrade:{}}).reason,/Connected industrial/)
  assert.equal(generateEditablePatternCandidate(fixture,{scalePercent:20}).ok,false)
})
