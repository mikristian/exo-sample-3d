/** Connected grading acceptance: active Rust WASM -> native Rust workspace.
 * All durable writes are confined to a disposable OS temporary directory.
 * This checks mapping and active native geometry, not browser/UI integration.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {initializeRustGradingKernel,rustGradingKernelStatus,gradeMultiPieceBreakTable} from '../src/core/rustGradingKernel.js'
import {createWorkspace} from '../integrations/clothcraft/workspace.mjs'
import {inspectNativeVerifiedProductionSourceRun37,createNativeVerifiedProductionOrderRun37} from '../integrations/clothcraft/native-verified-production-order-run37.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const wasmPath=path.join(root,'public/wasm/exo_grading_kernel.wasm')
const bin=path.join(root,'research/oss/clothcraft/target/debug/exo-session')
assert(fs.statSync(bin).isFile(),'Native Rust exo-session must be installed')
const bytes=fs.readFileSync(wasmPath)
const wasmSha256=createHash('sha256').update(bytes).digest('hex')
const declared=fs.readFileSync(path.join(root,'public/wasm/exo_grading_kernel.sha256'),'utf8').trim().split(/\s+/)[0]
assert.equal(wasmSha256,declared,'WASM artifact differs from recorded digest')
assert.equal(await initializeRustGradingKernel({bytes}),true)
assert.equal(rustGradingKernelStatus().backend,'rust-wasm','Grading must actually use Rust WASM')
const wasm=(await WebAssembly.instantiate(bytes,{})).instance.exports
assert.equal(wasm.exo_grading_batch_abi_version(),1)

const sizes=['XS','S','M','L','XL','XXL']
const factors=[0.98,0.99,1,1.01,1.02,1.03]
const baseSize='M'
const tolerance=2e-8
const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'exo-rust-grading-connected-'))
const previousEnv={
 EXO_CLOTHCRAFT_REPO:process.env.EXO_CLOTHCRAFT_REPO,
 EXO_CLOTHCRAFT_SESSION_BIN:process.env.EXO_CLOTHCRAFT_SESSION_BIN,
 EXO_CLOTHCRAFT_GPU:process.env.EXO_CLOTHCRAFT_GPU,
}
process.env.EXO_CLOTHCRAFT_REPO=path.join(root,'research/oss/clothcraft')
process.env.EXO_CLOTHCRAFT_SESSION_BIN=bin
process.env.EXO_CLOTHCRAFT_GPU='0'
let workspace
const sameJson=(a,b,message)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),message)
const near=(actual,expected,message)=>assert(Math.abs(actual-expected)<=tolerance,`${message}: ${actual} vs ${expected}`)
let negativeControls=0
try{
 workspace=createWorkspace(sandbox)
 const request=async body=>{
  const response=await workspace.request(body)
  assert.equal(response.ok,true,`${body.op}: ${response.error||'unknown error'}`)
  return response.data
 }
 let opened=await request({op:'open',preset:'tshirt'})
 // Factory CUT generation requires an explicit real cutting allowance on
 // every source panel edge. Draft/fitted grading may succeed without them,
 // but manufacturing must reject missing allowances rather than invent one.
 for(const panel of [...opened.template.panels])for(const edge of panel.polygon.edges){
   opened=await request({op:'edit',revision:opened.revision,
     command:{kind:'SeamAllowance',panel:panel.id,edge,width_m:.012}})
 }
 const source=(await request({op:'save'})).project
 const original=structuredClone(source.template)
 assert(original.panels.length>=2,'Expected a multi-panel native garment')
 // Ordered panel IDs and point indexes form the explicit wire mapping. Each
 // point receives an adjacent signed X/Y break in native polygon units (m).
 const mapping=original.panels.map((panel,pieceIndex)=>({
  pieceId:pieceIndex+1,panelId:panel.id,points:panel.polygon.points.map((xy,index)=>({
   pointId:index+1,pointIndex:index,xy,
  })),
 }))
 const pieces=mapping.map(item=>({id:item.pieceId,points:item.points.map(point=>({
  id:point.pointId,x:point.xy[0],y:point.xy[1],
  steps:factors.slice(1).map((factor,index)=>({
   dx:point.xy[0]*(factor-factors[index]),dy:point.xy[1]*(factor-factors[index]),
  })),
 }))}))
 const expectedInput=structuredClone({pieces,sizes,baseSize})
 const graded=gradeMultiPieceBreakTable({pieces,sizes,baseSize})
 assert.equal(graded.length,sizes.length)
 assert.equal(graded[0].pieces.length,mapping.length)
 assert.deepEqual({pieces,sizes,baseSize},expectedInput,'WASM mutated source points')
 let checkedCoordinates=0
 const templates=graded.map((row,sizeIndex)=>{
  assert.equal(row.size,sizes[sizeIndex])
  const template=structuredClone(original)
  row.pieces.forEach((piece,pieceIndex)=>{
   const relation=mapping[pieceIndex]
   assert.equal(piece.id,relation.pieceId)
   const destination=template.panels.find(panel=>panel.id===relation.panelId)
   assert(destination,`Missing mapped native panel ${relation.panelId}`)
   assert.equal(piece.points.length,destination.polygon.points.length)
   piece.points.forEach((point,pointIndex)=>{
    const reference=relation.points[pointIndex]
    assert.equal(point.id,reference.pointId)
    near(point.x,reference.xy[0]*factors[sizeIndex],`${row.size}/${relation.panelId}/${pointIndex}/x`)
    near(point.y,reference.xy[1]*factors[sizeIndex],`${row.size}/${relation.panelId}/${pointIndex}/y`)
    destination.polygon.points[reference.pointIndex]=[point.x,point.y]
    checkedCoordinates+=2
   })
  })
  return template
 })
 sameJson(templates[2],original,'Base-size mapping must be lossless')
 const catalog={schemaVersion:1,sizes,baseSize,baseTemplate:structuredClone(original),gradedTemplates:templates,pomSpecs:[]}
 const committed=await request({op:'grade-run-commit',revision:opened.revision,gradeRun:catalog})
 assert.equal(committed.gradeCatalogResult.persisted,true)
 const status=await request({op:'grade-run-status',revision:committed.revision})
 assert.equal(status.persistedInProject,true)
 sameJson(status.catalog.gradedTemplates,templates,'Rust native catalog differs from WASM mapped templates')
 const cutlines=await request({op:'grade-run-cutlines',revision:committed.revision})
 assert.equal(cutlines.format,'exo-native-graded-cutlines.v1',
   'Native Rust manufacturing cutline contract changed')
 assert.equal(cutlines.sourceRevision,committed.revision)
 assert.equal(cutlines.manufacturerReady,false)
 assert.equal(cutlines.cuttingAuthorized,false)
 assert.equal(cutlines.sizes.length,sizes.length)
 for(let i=0;i<sizes.length;i++){
   assert.equal(cutlines.sizes[i].size,sizes[i],`Native Rust cutline missing size ${sizes[i]}`)
   assert.equal(cutlines.sizes[i].panels.length,mapping.length,
     `Native Rust cutline missing garment panels for ${sizes[i]}`)
 }
 const observedProduction=await inspectNativeVerifiedProductionSourceRun37(workspace)
 assert.deepEqual(observedProduction.sizes,sizes)
 assert.equal(observedProduction.revision,committed.revision)
 assert.equal(observedProduction.factoryApproved,false)
 const operatorOrder={expectedRevision:observedProduction.revision,
   quantitiesBySize:Object.fromEntries(sizes.map(size=>[size,Object.fromEntries(
     observedProduction.panels.map(panel=>[panel.id,2]))])),
   materialsByPanel:Object.fromEntries(observedProduction.panels.map(panel=>[
     panel.id,{fabricId:panel.sourceFabricId,groupId:'source-approved'}])),
 }
 const verifiedOrder=await createNativeVerifiedProductionOrderRun37(workspace,operatorOrder)
 assert.equal(verifiedOrder.workflow,'exo-native-verified-graded-production-order.v1')
 assert.equal(verifiedOrder.factoryApproved,false)
 assert.equal(verifiedOrder.cuttingAuthorized,false)
 assert.equal(verifiedOrder.sourceRevision,committed.revision)
 await assert.rejects(()=>createNativeVerifiedProductionOrderRun37(workspace,
   {...operatorOrder,expectedRevision:opened.revision}),/STALE_NATIVE_PRODUCTION_REVISION/)
 const saved=JSON.parse(fs.readFileSync(path.join(sandbox,'workspace/fitting-project.json'),'utf8'))
 sameJson(saved.grade_run.gradedTemplates,templates,'Durable native save lost mapped geometry')
 sameJson(saved.template,original,'Native catalog commit changed source template')
 const persistedBefore=fs.readFileSync(path.join(sandbox,'workspace/fitting-project.json'))

 // Reject invalid wire IDs and malformed step data while the active WASM is loaded.
 for(const alter of [
  value=>{value.pieces[1].id=value.pieces[0].id},
  value=>{value.pieces[0].points[0].id=0},
  value=>{value.pieces[0].points[0].steps[1].dx=NaN},
  value=>{value.pieces[0].points[0].steps.pop()},
  value=>{delete value.pieces[0].points[0].steps[0]},
 ]){
  const invalid=structuredClone(expectedInput)
  alter(invalid)
  assert.throws(()=>gradeMultiPieceBreakTable(invalid),TypeError)
  negativeControls++
 }
 let revision=committed.revision
 const stale=await workspace.request({op:'grade-run-activate',revision:opened.revision,size:'XXL'})
 assert.equal(stale.ok,false,'Stale revision was accepted')
 negativeControls++
 const unknown=await workspace.request({op:'grade-run-activate',revision,size:'UNKNOWN'})
 assert.equal(unknown.ok,false,'Unmapped native size was accepted')
 negativeControls++
 assert.deepEqual(fs.readFileSync(path.join(sandbox,'workspace/fitting-project.json')),persistedBefore)
 for(let sizeIndex=0;sizeIndex<sizes.length;sizeIndex++){
  const size=sizes[sizeIndex]
  const active=await request({op:'grade-run-activate',revision,size})
  assert.equal(active.activeGradedSize,size)
  assert.equal(active.gradedSizePreview,true)
  sameJson(active.template,templates[sizeIndex],`Native Rust activation diverged at ${size}`)
  assert(active.positions.length>0 && active.triangles.length>0,`Native 3D mesh missing for ${size}`)
  revision=active.revision
  const restored=await request({op:'grade-run-restore',revision})
  revision=restored.revision
  sameJson(restored.template,original,`Original native source not restored for ${size}`)
 }
 const end=(await request({op:'save'})).project
 sameJson(end.template,original,'Grading/activation changed saved source garment')
 sameJson(end.grade_run.gradedTemplates,templates,'Grading/activation changed saved catalog')
 // Native Rust authoring history is independent from React's local grading
 // draft journal. Verify the committed grade catalog itself is reversible.
 const undone=await request({op:'undo',revision})
 assert.equal(undone.gradeRunPersisted,false,'Native Undo did not remove the committed grade catalog')
 sameJson(undone.template,original,'Native Undo changed original garment')
 const redone=await request({op:'redo',revision:undone.revision})
 assert.equal(redone.gradeRunPersisted,true,'Native Redo did not restore the committed grade catalog')
 sameJson(redone.template,original,'Native Redo changed original garment')
 const finalSave=(await request({op:'save'})).project
 sameJson(finalSave.grade_run.gradedTemplates,templates,'Native Redo did not durably restore grading')
 console.log(JSON.stringify({pass:true,wasmSha256,nativeRustSession:true,panels:mapping.length,
  points:pieces.reduce((sum,piece)=>sum+piece.points.length,0),sizes:sizes.length,
  checkedCoordinates,negativeControls,nativeCommitted:true,nativeActivatedSizes:sizes.length,
  durableCatalog:true,originalPreserved:true,gradedNativeCutlines:sizes.length,
  nativeGradeUndoRedoVerified:true,
  verifiedProductionOrder:true,productionQuantitiesVerified:true,
  uiIntegrationVerified:false,manufacturingApproved:false}))
}finally{
 workspace?.close()
 fs.rmSync(sandbox,{recursive:true,force:true})
 for(const [key,value] of Object.entries(previousEnv)){
  if(value===undefined)delete process.env[key]
  else process.env[key]=value
 }
}
