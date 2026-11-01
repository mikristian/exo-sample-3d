#!/usr/bin/env node
// Acceptance against an ALREADY RUNNING signed staging candidate. No processes launched.
// EXO_STAGING_WORKSPACE_TOKEN must be the token configured on the staging bridge.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import crypto from 'node:crypto'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const allowed=path.join(root,'integrations/clothcraft/output/release-candidates')
const app=path.resolve(process.env.EXO_STAGING_APP_PATH||
  path.join(allowed,'EXO-ClothCraft-V2-Candidate-Expansion-20261030.app'))
const bundled=path.join(app,'Contents/Resources/web')
const token=process.env.EXO_STAGING_WORKSPACE_TOKEN
const stageUrl='http://127.0.0.1:5485'
const webUrl='http://127.0.0.1:5486'
let stage='preflight',revision,baseline
const checks=[]
const request=async (url,options={})=>fetch(url,{signal:AbortSignal.timeout(30000),...options})
const rpc=async (packet,authorization=token)=>{
  const response=await request(stageUrl+'/workspace',{
    method:'POST',headers:{'content-type':'application/json',...(authorization?{authorization:`Bearer ${authorization}`}:{})},
    body:JSON.stringify(packet),
  })
  const result=await response.json()
  return {status:response.status,...result}
}
const send=async packet=>{
  const result=await rpc({...(revision===undefined?{}:{revision}),...packet})
  assert.equal(result.status,200,`${packet.op}: HTTP ${result.status}`)
  assert.equal(result.ok,true,`${packet.op}: ${result.error||'native failure'}`)
  if(result.data?.template)revision=result.data.revision
  return result.data
}
const saved=async()=> (await send({op:'save'})).project
const snapshot=async()=>send({op:'snapshot'})
const panel=(template,id)=>{
  const value=template.panels.find(p=>p.id===id)
  assert.ok(value,`missing panel ${id}`)
  return value
}
const assertGeometry=state=>{
  assert.ok(state.template?.panels?.length>=2,'No 2D panels')
  assert.ok(state.triangles?.length>0,'No compiled 3D triangles')
  assert.ok(state.template.panels.every(p=>p.polygon?.points?.length>=3),'Invalid 2D polygon')
}
try {
  assert.equal(path.dirname(app),allowed,'Staging candidate must live in repository release-candidates')
  assert.ok(app.endsWith('.app'),'Only signed staging .app accepted')
  assert.ok(token&&token.length>=32,'Set EXO_STAGING_WORKSPACE_TOKEN to signed staging bridge token')
  assert.equal(process.env.EXO_STAGING_DISPOSABLE_SESSION,'YES',
    'REFUSE_SHARED_STAGING: use a separately launched staging bridge with disposable output dir and session project path')
  assert.ok(fs.existsSync(path.join(bundled,'index.html')),'Signed candidate web resources missing')
  const healthResponse=await request(stageUrl+'/health')
  assert.equal(healthResponse.status,200)
  const health=await healthResponse.json()
  assert.equal(health.ok,true)
  assert.equal(health.nativeReady,true)
  assert.equal(health.workspaceAuthIdentity,crypto.createHash('sha256').update(token).digest('hex'),
    'Staging token does not match running bridge')
  assert.equal((await rpc({op:'snapshot'},null)).status,401,'Unauthenticated workspace accepted')
  assert.equal((await rpc({op:'snapshot'},'invalid-token')).status,401,'Invalid staging token accepted')
  checks.push('Staging authentication and native readiness')
  stage='signed-web'
  const localIndex=fs.readFileSync(path.join(bundled,'index.html'),'utf8')
  const served=await request(webUrl+'/')
  assert.equal(served.status,200)
  assert.equal(await served.text(),localIndex,'Served web HTML differs from signed candidate bundle')
  const assetNames=[...localIndex.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(m=>m[1])
  assert.ok(assetNames.length>0,'No candidate JS/CSS asset references')
  for(const asset of assetNames){
    const local=path.join(bundled,asset.slice(1))
    assert.ok(fs.existsSync(local),`Signed bundle missing ${asset}`)
    const response=await request(webUrl+asset)
    assert.equal(response.status,200,`Failed to serve ${asset}`)
    const received=Buffer.from(await response.arrayBuffer())
    assert.equal(crypto.createHash('sha256').update(received).digest('hex'),
      crypto.createHash('sha256').update(fs.readFileSync(local)).digest('hex'),`Asset mismatch ${asset}`)
  }
  checks.push('Signed web HTML and referenced assets byte-identical to staging server')
  stage='disposable-native-workspace'
  const original=await snapshot()
  baseline=await saved()
  const opened=await send({op:'open',preset:'tshirt'})
  assertGeometry(opened)
  const base=await saved()
  assert.ok(base.template?.fabrics?.length>0)
  const previousIds=new Set(opened.template.panels.map(p=>p.id))
  stage='2d-edit-3d'
  const edited=await send({op:'edit',command:{kind:'Polygon',fabric:base.template.fabrics[0].id,
    points:[[0,0],[.4,0],[.4,.32],[0,.32]]}})
  assertGeometry(edited)
  const added=edited.template.panels.filter(p=>!previousIds.has(p.id))
  assert.equal(added.length,1,'Native 2D polygon edit did not persist')
  assert.equal(added[0].polygon.points.length,4)
  checks.push('Native 2D edit created panel and regenerated 3D triangles')
  stage='history'
  const editedProject=await saved()
  await send({op:'undo'})
  assert.deepEqual(await saved(),base,'Undo did not restore source project')
  await send({op:'redo'})
  assert.deepEqual(await saved(),editedProject,'Redo did not restore edited project')
  checks.push('Native Undo and Redo reproduce exact saved project')
  stage='grading'
  const t=structuredClone(edited.template)
  const sizes=['XS','S','M','L','XL','XXL']
  const offsets=[-.015,-.007,0,.005,.010,.014]
  await send({op:'bindings-store',nativeBindings:{measurements:{width:{valueMm:400}},bindings:[
    {id:'qa_width_upper',panelId:added[0].id,pointIndex:1,mode:'polar',a:0,b:0,angleDeg:0,distanceFormula:'width',dependsOn:[]},
    {id:'qa_width_lower',panelId:added[0].id,pointIndex:2,mode:'polar',a:3,b:3,angleDeg:0,distanceFormula:'width',dependsOn:[]},
  ]}})
  const gradedTemplates=sizes.map((size,index)=>{
    const copy=structuredClone(t)
    const p=panel(copy,added[0].id)
    p.polygon.points[1][0]+=offsets[index]
    p.polygon.points[2][0]+=offsets[index]
    return copy
  })
  await send({op:'grade-run-commit',gradeRun:{schemaVersion:1,sizes,baseSize:'M',
    baseTemplate:structuredClone(t),gradedTemplates,pomSpecs:[]}})
  const gradeProject=await saved()
  assert.deepEqual(gradeProject.grade_run?.sizes,sizes)
  for(const size of sizes){
    const active=await send({op:'grade-run-activate',size})
    assertGeometry(active)
    await send({op:'grade-run-restore'})
    assert.deepEqual(await saved(),gradeProject,`Grade ${size} restoration changed project`)
  }
  checks.push('Six physical grades activate 3D and restore the same project')
  stage='save-reopen'
  const reopen=await send({op:'open',project:gradeProject})
  assertGeometry(reopen)
  assert.deepEqual(await saved(),gradeProject,'Reopen did not preserve grades and geometry')
  checks.push('Saved grade project round-trips exactly through native reopen')
  stage='print-capability'
  // Print layout and calibrated physical output require actual browser/print hardware validation.
  const webFiles=fs.readdirSync(path.join(bundled,'assets')).filter(f=>f.endsWith('.js'))
  assert.ok(webFiles.length>0,'Missing signed JavaScript assets')
  checks.push('Print/calibration requires browser GUI and physical scale verification (unverified)')
  console.log(JSON.stringify({pass:true,stage:'native-completed',checks,
    printCalibrationVerified:false,browserGuiVerified:false,factoryApproved:false,
    stagingPorts:[5485,5486],productionPortsAccessed:false},null,2))
}catch(error){
  console.error(JSON.stringify({pass:false,stage,error:String(error.message||error),checks,
    productionPortsAccessed:false},null,2))
  process.exitCode=1
}finally{
  // The native grade operation writes a durable digest-bound Undo/Redo sidecar.
  // Reopening an older baseline in that same session path is correctly rejected.
  // Prime must stop the isolated bridge and discard its entire disposable output
  // directory; no request here may overwrite a journal or shared staging project.
  if(baseline)console.log(JSON.stringify({disposableSessionCleanupRequired:true,
    originalProjectRetainedInMemoryOnly:true,action:'Stop disposable staging bridge and discard its isolated output directory'}))
}
