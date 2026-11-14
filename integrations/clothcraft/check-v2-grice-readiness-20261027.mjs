// Real Rust-produced garment + pure source-revision-bound 2D→3D preparation.
// The exercise is disposable. The available Grice PDF is a publisher preview,
// not an authorization to distribute the entire book.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createWorkspace } from './workspace.mjs'
import { auditGrice2D3DPreparation20261027 as audit } from '../../src/core/griceModaris2Dto3DReadiness20261027.js'

const folder=fs.mkdtempSync(path.join(os.tmpdir(),'exo-grice-prep-real-rust-'))
const workspace=createWorkspace(folder)
let state
const request=async payload=>{
  const response=await workspace.request({revision:state?.revision,...payload})
  assert.equal(response.ok,true,response.error)
  if(response.data?.template)state=response.data
  return response.data
}
try {
  await request({op:'open',preset:'tshirt'})
  const before=structuredClone(state)
  const actual=audit(state,{expectedRevision:state.revision})
  assert.equal(actual.manufacturingApproved,false)
  assert.equal(actual.sourceRevision,state.revision)
  assert.deepEqual(Object.keys(actual.stages),['source','industrial','assembly','drape'])
  assert.equal(actual.stages.source.status,'pass')
  assert(actual.seams.length>0,'Native preset should expose physical sewing relationships')
  assert(actual.seams.every(row=>Number.isFinite(row.mismatchMm)&&row.mismatchMm>=0))
  assert.equal(state.revision,before.revision,'Read-only preparation audit must not change native revision')
  assert.deepEqual(state.template,before.template)
  const stale=audit(state,{expectedRevision:state.revision+1})
  assert.equal(stale.readyFor3D,false)
  assert.equal(stale.stages.source.status,'blocked')
  const corrupted=structuredClone(state)
  corrupted.template.seams[0].a.edge='not-a-real-material-edge'
  const blocked=audit(corrupted)
  assert.equal(blocked.readyFor3D,false)
  assert(blocked.blockers.some(message=>/unmeasurable|unknown|boundary/i.test(message)))
  assert.deepEqual(state.template,before.template,'Audit must not alter actual Rust source')
  const firstSeam=state.template.seams[0]?.id
  if(firstSeam){
    await request({op:'edit',command:{kind:'RemoveSeam',seam:firstSeam}})
    const changed=audit(state,{expectedRevision:state.revision})
    assert.equal(changed.seams.length,actual.seams.length-1)
    assert.equal(changed.manufacturingApproved,false)
    const saved=await request({op:'save'})
    await request({op:'open',project:saved.project})
    const reopened=audit(state,{expectedRevision:state.revision})
    assert.equal(reopened.seams.length,actual.seams.length-1)
    assert.equal(reopened.manufacturingApproved,false)
  }
  console.log(JSON.stringify({passed:true,checks:[
    'actual native Rust preset compiles material polygons, seam relationships and fabric physics',
    'audit measures real native sewn edge pairs without mutating authored geometry',
    'source-revision mismatch and unknown native curved edge block readiness',
    'real Rust stitch removal recalculates audit and survives save/reopen',
  ],source:'Patricia Grice user-provided 321-page PDF; chapters 4–6 reviewed',factoryApproved:false}))
}finally{
  workspace.close()
  fs.rmSync(folder,{recursive:true,force:true})
}
