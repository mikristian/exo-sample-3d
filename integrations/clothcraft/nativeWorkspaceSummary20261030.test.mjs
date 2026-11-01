import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {nativeWorkspaceSummary20261030 as summarize} from './nativeWorkspaceSummary20261030.mjs'
const example=()=>({
  revision:19,
  template:{name:'Garment',panels:[{id:'front',points:[1,2,3]}]},
  positions:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]],
  uv:[[0,0],[1,0],[0,1]],body:{privateMesh:'must-not-serialize'},
  gradeRun:{sizes:['XS','S','M','L','XL','XXL']},
  activeGradedSize:'M',canUndo:true,canRedo:false,
})
test('summary includes source revision and units but never full geometry',()=>{
  const full=example(),previous=structuredClone(full)
  const result=summarize(full,{busy:true,running:false})
  assert.equal(result.format,'exo.native-workspace-status.v1')
  assert.equal(result.sourceRevision,19)
  assert.equal(result.nativeCoordinateUnit,'m')
  assert.equal(result.pieceCount,1)
  assert.equal(result.triangleCount,1)
  assert.equal(result.canUndo,true)
  assert.equal(result.busy,true)
  assert.equal(result.factoryCertified,false)
  assert.ok(Object.isFrozen(result))
  for(const forbidden of ['template','positions','triangles','uv','body','gradeRun'])
    assert.equal(forbidden in result,false)
  assert.deepEqual(full,previous)
})
test('missing revision and unbounded geometry fail closed',()=>{
  for(const mutation of [
    x=>{x.revision=NaN},x=>{x.template.panels=null},
    x=>{x.positions=new Array(2_000_001)},
    x=>{x.triangles=new Array(4_000_001)},
  ]){
    const x=example();mutation(x)
    assert.throws(()=>summarize(x),/INVALID_SOURCE/)
  }
})
test('workspace routes summary without changing the full snapshot API',()=>{
  const source=readFileSync(new URL('./workspace.mjs',import.meta.url),'utf8')
  assert.match(source,/data\.op==='snapshot-metadata'&&current/)
  assert.match(source,/nativeWorkspaceSummary20261030\(current,\{busy,running\}\)/)
  assert.match(source,/data\.op==='snapshot'&&current/)
})
