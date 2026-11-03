// Real native Rust multi-piece measurement regeneration witness (not factory certification).
// Independent of the UI / grading sidecar; isolated garment and one native revision.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createWorkspace} from './workspace.mjs'
import {verifyNativeSixSizePreview20261028 as previewProof,verifyNativeSixSizeCommit20261028 as commitProof} from '../../src/core/nativeSixSizeCommandContract20261028.js'

const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-grade-reactive-three-'))
let workspace=createWorkspace(root)
const sizes=['XS','S','M','L','XL','XXL']
const offsets={XS:-.012,S:-.006,M:0,L:.006,XL:.012,XXL:.018}
let snapshot
const send=async payload=>{
 const result=await workspace.request({revision:snapshot?.revision,...payload})
 assert(result.ok,`${payload.op}: ${result.error}`)
 if(result.data?.template)snapshot=result.data
 return result.data
}
const panel=(template,id)=>template.panels.find(piece=>piece.id===id)
const content=project=>({...project,native_commit:project.native_commit?{...project.native_commit,generation:0}:undefined})
try{
 await send({op:'open',preset:'tshirt'})
 const ids=new Set(snapshot.template.panels.map(piece=>piece.id))
 const fabric=snapshot.template.fabrics[0]?.id
 for(let i=0;i<3;i++){
  await send({op:'edit',command:{kind:'Polygon',fabric,
   points:[[0,0],[.4,0],[.4,.3],[0,.3]]}})
 }
 const targets=snapshot.template.panels.filter(piece=>!ids.has(piece.id)).map(piece=>piece.id)
 assert.equal(targets.length,3)
 for(const id of targets){
  const edge=panel(snapshot.template,id).polygon.edges[0]
  await send({op:'edit',command:{kind:'SetMeasurement',panel:id,measurement:{id:'width-pom',label:'Width stations',a:{edge,t:.15},b:{edge,t:.85}}}})
 }
 await send({op:'bindings-store',nativeBindings:{
  measurements:{width:{valueMm:400},otherWidth:{valueMm:400},a:1,b:2,ratio:{formula:"1 / (b - a)"}},
  bindings:targets.map((id,index)=>({id:`grade-linked-${index}`,panelId:id,
   pointIndex:1,mode:'polar',a:0,b:0,angleDeg:0,distanceFormula:index===0?'width':'otherWidth',dependsOn:[]})),
 }})
 const base=structuredClone(snapshot.template)
 const run={schemaVersion:1,sizes,baseSize:'M',baseTemplate:structuredClone(base),
  gradedTemplates:sizes.map(size=>{
   const template=structuredClone(base)
   for(const id of targets)panel(template,id).polygon.points[1][0]+=offsets[size]
   return template
  }),pomSpecs:[]}
 await send({op:'grade-run-commit',gradeRun:run})
 assert.equal(snapshot.gradeRunPersisted,true)
 const untouched=targets.slice(1)
 let rounds=0
 for(const width of [382,410,395]){
  const initial=(await send({op:'save'})).project
  const before=structuredClone(snapshot),revision=snapshot.revision
  const overrides={width}
  const diskBefore=fs.readFileSync(path.join(root,'workspace/fitting-project.json.native'))
  const preview=await send({op:'bindings-grade-regenerate-preview',overrides})
  assert.equal(snapshot.revision,revision)
  assert.deepEqual(fs.readFileSync(path.join(root,'workspace/fitting-project.json.native')),diskBefore,'Preview changed native disk document')
  assert.equal(preview.changedPanels,1)
  assert.deepEqual(preview.panelIds,[targets[0]])
  assert.equal(preview.perSizeMeasurements.length,6)
  for(const row of preview.perSizeMeasurements){
   assert.equal(row.measurements.length,3)
   for(const m of row.measurements){
    const expected=(m.panelId===targets[0]?width:400)+offsets[row.size]*1000
    assert(Math.abs(m.afterMm-expected*.7)<1e-7)
    if(m.panelId!==targets[0])assert.equal(m.afterMm,m.beforeMm)
   }
  }
  const proof=previewProof(before,overrides,preview)
  assert(proof.ok,proof.reason)
  assert.deepEqual(content((await send({op:'save'})).project),content(initial),'Preview mutated saved garment')
  const committed=await send({op:'bindings-grade-regenerate',overrides})
  const receipt=commitProof(before,proof,committed)
  assert(receipt.ok,receipt.reason)
  assert.equal(snapshot.revision,revision+1)
  const after=(await send({op:'save'})).project
  for(let i=0;i<6;i++){
   const value=panel(after.grade_run.gradedTemplates[i],targets[0]).polygon.points[1][0]
   assert(Math.abs(value-(width/1000+offsets[sizes[i]]))<1e-8)
   for(const id of [...ids,...untouched]){
    assert.deepEqual(panel(after.grade_run.gradedTemplates[i],id),
     panel(initial.grade_run.gradedTemplates[i],id),`Unchanged ${id}/${sizes[i]} drifted`)
   }
  }
  for(const id of [...ids,...untouched])assert.deepEqual(panel(after.template,id),panel(initial.template,id))
  assert.deepEqual(after.template.seams,initial.template.seams)
  const noOp=await workspace.request({op:'bindings-grade-regenerate',revision:snapshot.revision,overrides})
  assert.equal(noOp.ok,false,'No-op must not create an Undo revision')
  assert.deepEqual(content((await send({op:'save'})).project),content(after))
  for(const invalid of [{width:5500},{width:0},{width:.01}]){
   const bad=await workspace.request({op:'bindings-grade-regenerate',revision:snapshot.revision,overrides:invalid})
   assert.equal(bad.ok,false)
   assert.deepEqual(content((await send({op:'save'})).project),content(after))
  }
  await send({op:'undo'})
  const undone=(await send({op:'save'})).project
  for(const key of ['template','grade_run','native_point_bindings'])assert.deepEqual(undone[key],initial[key])
  await send({op:'redo'})
  const redone=(await send({op:'save'})).project
  for(const key of ['template','grade_run','native_point_bindings'])assert.deepEqual(redone[key],after[key])
  workspace.close()
  workspace=createWorkspace(root)
  snapshot=null
  await send({op:'snapshot'})
  const reopened=(await send({op:'save'})).project
  for(const key of ['template','grade_run','native_point_bindings'])assert.deepEqual(reopened[key],after[key])
  rounds++
 }
 const batchBefore=structuredClone(snapshot)
 const overrides={a:2,b:4,width:380}
 const batchPreview=await send({op:'bindings-grade-regenerate-preview',overrides})
 const batchProof=previewProof(batchBefore,overrides,batchPreview)
 assert(batchProof.ok,batchProof.reason)
 const batchCommitted=await send({op:'bindings-grade-regenerate',overrides})
 assert(commitProof(batchBefore,batchProof,batchCommitted).ok)
 const batchSaved=(await send({op:'save'})).project
 const invalidBatch=await workspace.request({op:'bindings-grade-regenerate',revision:snapshot.revision,overrides:{b:2,width:390}})
 assert.equal(invalidBatch.ok,false)
 assert.deepEqual(content((await send({op:'save'})).project),content(batchSaved))
 console.log(JSON.stringify({passed:true,batchFormulaAtomicity:true,nativeRust:true,selectivePiece:targets[0],rounds,persistentPoms:true,
  sizes:6,sizePieceChecks:18,unaffectedPanelsPreservedExactly:true,
  previewNoMutation:true,noOpNoMutation:true,invalidOverrideRejected:true,
  undoRedoSaveReopen:true,unboundSeamsPreserved:true,factoryApproved:false}))

}finally{
 workspace.close()
 fs.rmSync(root,{recursive:true,force:true})
}
