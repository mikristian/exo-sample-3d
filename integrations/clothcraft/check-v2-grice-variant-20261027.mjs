// Grice-informed production-vs-3D article inventory, exercised against a
// disposable real Rust workspace. Read-only; not a Modaris-format interchange.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createWorkspace} from './workspace.mjs'
import {buildGriceVariantReadiness20261027 as inspect} from '../../src/core/grice3DProductionVariant20261027.js'

const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-grice-variant-rust-'))
const workspace=createWorkspace(root)
let snapshot
const send=async data=>{
  const response=await workspace.request({revision:snapshot?.revision,...data})
  assert.equal(response.ok,true,response.error)
  if(response.data?.template)snapshot=response.data
  return response.data
}
const definition=()=>({version:1,sourceRevision:snapshot.revision,
  pieces:snapshot.template.panels.map(panel=>({
    panelId:panel.id,fabricId:panel.fabric,quantity:1,
    production:true,sendTo3D:true,
  }))})
try{
  await send({op:'open',preset:'tshirt'})
  const source=structuredClone(snapshot)
  const plan=definition()
  const good=inspect(snapshot,plan)
  assert.equal(good.ok,true,good.blockers.join('; '))
  assert.equal(good.readyFor3D,true,good.warnings.join('; '))
  assert.equal(good.manufacturerApproved,false)
  assert.equal(good.pieceRows.length,snapshot.template.panels.length)
  assert.equal(good.sourceRevision,snapshot.revision)
  assert.deepEqual(snapshot.template,source.template)
  const sewn=snapshot.template.seams[0]
  assert(sewn,'Real Rust T-shirt must have at least one sewn relationship')
  const absent=structuredClone(plan)
  const end=absent.pieces.find(p=>p.panelId===sewn.a.panel)
  assert(end)
  end.sendTo3D=false
  const missing=inspect(snapshot,absent)
  assert.equal(missing.readyFor3D,false)
  assert(missing.blockers.some(x=>/excluded from 3D/.test(x)))
  const paired=structuredClone(plan)
  paired.pieces[0].quantity=2
  const unproven=inspect(snapshot,paired)
  assert.equal(unproven.readyFor3D,false)
  assert(unproven.warnings.some(x=>/paired piece requires review/.test(x)))
  const changed=structuredClone(plan)
  changed.pieces[0].fabricId='a-different-fabric'
  assert.equal(inspect(snapshot,changed).ok,false)
  const stale=structuredClone(plan)
  stale.sourceRevision--
  assert.equal(inspect(snapshot,stale).ok,false)
  const saved=await send({op:'save'})
  await send({op:'open',project:saved.project})
  const reopened=inspect(snapshot,definition())
  assert.equal(reopened.readyFor3D,true,reopened.blockers.join('; '))
  assert.equal(reopened.manufacturerApproved,false)
  console.log(JSON.stringify({passed:true,checks:[
    'real Rust sewn garment article inventory accepts exact production and 3D membership',
    'missing sewn 3D piece, stale source and wrong fabric refuse',
    'paired quantity without two compiled instances requires review',
    'read-only inspection does not mutate the garment and survives save/reopen',
  ],factoryApproved:false,copyOfBookSaved:false}))
}finally{
  workspace.close()
  fs.rmSync(root,{recursive:true,force:true})
}
