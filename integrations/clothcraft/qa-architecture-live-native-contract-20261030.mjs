#!/usr/bin/env node
// Disposable real-Rust architecture acceptance. No server/port, GUI, installed
// garment or staging Application Support is involved. Creates only mkdtemp().
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {performance} from 'node:perf_hooks'
import {createWorkspace} from './workspace.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const override=process.env.EXO_QA_NATIVE_BIN_OVERRIDE
// Explicitly selected source-built binaries are permitted ONLY as disposable
// QA artifacts under /tmp, never an installed EXO bundle or an arbitrary
// executable supplied by a project. The normal contract stays unchanged.
if(override)assert.ok(path.resolve(override).startsWith('/tmp/exo-session-native-property-'),
  'Native QA override must be the separately source-built property test binary')
const binary=override||path.join(root,'research/oss/clothcraft/target/debug/exo-session')
const avatar=path.join(root,'research/oss/clothcraft/assets/makehuman/mannequin.obj')
assert.ok(fs.statSync(binary).isFile() && fs.statSync(avatar).isFile(),
  'Use the existing compiled Rust native binary and public mannequin; no Cargo build permitted')
assert.ok(fs.statfsSync(root).bavail*fs.statfsSync(root).bsize>2*1024**3,
  'Insufficient disk headroom for disposable native journal acceptance')
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'exo-architecture-native-'))
const previous={
  EXO_CLOTHCRAFT_REPO:process.env.EXO_CLOTHCRAFT_REPO,
  EXO_CLOTHCRAFT_SESSION_BIN:process.env.EXO_CLOTHCRAFT_SESSION_BIN,
  EXO_CLOTHCRAFT_GPU:process.env.EXO_CLOTHCRAFT_GPU,
  EXO_CLOTHCRAFT_AVATAR_MAKEHUMAN_OBJ:process.env.EXO_CLOTHCRAFT_AVATAR_MAKEHUMAN_OBJ,
}
Object.assign(process.env,{
  EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:binary,
  EXO_CLOTHCRAFT_GPU:'0',
  EXO_CLOTHCRAFT_AVATAR_MAKEHUMAN_OBJ:avatar,
})
let workspace,stage='preflight',lastRevision=null,resultPacket=null,snapshotMetrics=null
const checks=[]
const call=async data=>{
  const result=await workspace.request(data)
  assert.equal(result?.ok,true,`${stage}/${data.op}: ${result?.error||'Native Rust rejected request'}`)
  if(Number.isSafeInteger(result?.data?.revision))lastRevision=result.data.revision
  return result.data
}
const project=async()=> (await call({op:'save'})).project
// Every successful save deliberately advances Rust's authoritative
// UUID/generation. Compare the authored document separately from that
// transactional clock; assert the clock increments independently.
const authoredDocument=project=>{
 const copy=structuredClone(project)
 delete copy.native_commit
 return copy
}
const savedPath=path.join(temporary,'workspace','fitting-project.json')
try {
  workspace=createWorkspace(temporary)
  stage='cold-start-native-bootstrap'
  assert.equal(workspace.status().loaded,false,
    'A newly launched local Node bridge must initially report an unloaded Rust session')
  // This is the same initial authenticated operation sent by the signed
  // AppKit bootstrap before it mounts WKWebView. A separate op:open shortcut
  // would conceal the circular startup readiness regression.
  const opened=await call({op:'snapshot'})
  assert.equal(workspace.status().loaded,true,
    'The first native snapshot must initialize the actual Rust process')
  assert.ok(opened.template.panels.length>=2)
  assert.ok(opened.triangles.length>0)
  const fullSnapshot=await call({op:'snapshot'})
  const lightSnapshot=await call({op:'snapshot-metadata'})
  const fullBytes=Buffer.byteLength(JSON.stringify(fullSnapshot))
  const lightBytes=Buffer.byteLength(JSON.stringify(lightSnapshot))
  const medianSerializationMs=value=>{
    const timings=[]
    for(let i=0;i<90;i++){
      const started=performance.now()
      JSON.stringify(value)
      timings.push(performance.now()-started)
    }
    timings.sort((a,b)=>a-b)
    return Number(timings[Math.floor(timings.length/2)].toFixed(5))
  }
  snapshotMetrics={fullBytes,lightBytes,
    serializedByteReductionPercent:Number((100*(1-lightBytes/fullBytes)).toFixed(2)),
    fullMedianJsonMs:medianSerializationMs(fullSnapshot),
    summaryMedianJsonMs:medianSerializationMs(lightSnapshot)}
  assert.equal(lightSnapshot.format,'exo.native-workspace-status.v1')
  assert.equal(lightSnapshot.sourceRevision,opened.revision)
  assert.equal(lightSnapshot.nativeCoordinateUnit,'m')
  assert.equal(lightSnapshot.pieceCount,opened.template.panels.length)
  assert.equal(lightSnapshot.triangleCount,opened.triangles.length)
  assert.ok(lightBytes<fullBytes*0.1,
    'Read-only status must save >90% of native geometry transfer bytes')
  checks.push('Native status response carries source revision in fewer than 10% of full snapshot bytes')
  if(override){
    stage='native-property-transaction'
    const panelId=opened.template.panels[0].id
    const fabricId=opened.template.fabrics[0].id
    const beforeMetadata=await project()
    assert.equal(beforeMetadata.propertyMetadata.version,2)
    const metadataNamespace=beforeMetadata.propertyMetadata.metadataProjectId
    const initialGeneration=beforeMetadata.native_commit.generation
    const panelReceipt=await call({op:'set-property',revision:lastRevision,
      target:'panel',id:panelId,field:'itemNo',value:'EXO-001'})
    assert.equal(panelReceipt.propertyMetadata.panels[panelId].itemNo,'EXO-001')
    const fabricReceipt=await call({op:'set-property',revision:lastRevision,
      target:'fabric',id:fabricId,field:'appearance.color',value:'#123abc'})
    assert.equal(fabricReceipt.propertyMetadata.fabrics[fabricId].appearance.color,'#123abc')
    const saved=await project()
    assert.equal(saved.propertyMetadata.metadataProjectId,metadataNamespace)
    assert.equal(saved.propertyMetadata.panels[panelId].itemNo,'EXO-001')
    assert.equal(saved.propertyMetadata.fabrics[fabricId].appearance.color,'#123abc')
    assert.ok(saved.native_commit.generation>initialGeneration)
    assert.equal(fs.existsSync(savedPath+'.properties.json'),false,
      'A new Rust-authoritative project must not require a second metadata sidecar')
    // Prove this is not just in-memory React/Node state: kill the disposable
    // Rust worker, construct a new bridge and cold-open the exact saved
    // project+journal pair with no property sidecar.
    workspace.close()
    workspace=createWorkspace(temporary)
    const restored=await call({op:'snapshot'})
    assert.equal(restored.propertyMetadata.panels[panelId].itemNo,'EXO-001')
    assert.equal(restored.propertyMetadata.fabrics[fabricId].appearance.color,'#123abc')
    assert.equal((await project()).propertyMetadata.metadataProjectId,metadataNamespace)
    checks.push('Native panel/fabric property edits atomically save with Rust UUID/generation and survive cold reopen without sidecar')
  }
  const original=await project()
  checks.push('Cold signed-bridge contract: initial unloaded Rust accepts first snapshot and reports loaded')
  checks.push('Compiled Rust opened 2D T-shirt and generated 3D triangles')
  stage='edit'
  const fabric=original.template.fabrics[0].id
  const oldIds=new Set(original.template.panels.map(p=>p.id))
  const edited=await call({op:'edit',revision:lastRevision,
    command:{kind:'Polygon',fabric,points:[[0,0],[.4,0],[.4,.3],[0,.3]]}})
  assert.equal(edited.template.panels.length,opened.template.panels.length+1)
  assert.ok(edited.triangles.length>0)
  const added=edited.template.panels.find(p=>!oldIds.has(p.id))
  const newDocument=await project()
  checks.push('Native 2D polygon edit persisted and 3D scene regenerated')
  stage='undo-redo'
  await call({op:'undo',revision:lastRevision})
  const undone=await project()
  assert.deepEqual(authoredDocument(undone),authoredDocument(original))
  if(undone.native_commit&&original.native_commit){
   assert.equal(undone.native_commit.project_id,original.native_commit.project_id)
   assert.ok(undone.native_commit.generation>original.native_commit.generation)
  }
  await call({op:'redo',revision:lastRevision})
  assert.deepEqual(authoredDocument(await project()),authoredDocument(newDocument))
  checks.push('Native Undo and Redo preserve exact Rust documents')
  stage='grade'
  const sizes=['XS','S','M','L','XL','XXL'],template=structuredClone(edited.template)
  await call({op:'bindings-store',revision:lastRevision,nativeBindings:{
    measurements:{width:{valueMm:400}},bindings:[
      {id:'top_width',panelId:added.id,pointIndex:1,mode:'polar',a:0,b:0,angleDeg:0,
        distanceFormula:'width',dependsOn:[]},
      {id:'bottom_width',panelId:added.id,pointIndex:2,mode:'polar',a:3,b:3,angleDeg:0,
        distanceFormula:'width',dependsOn:[]},
    ]}})
  const offsets=[-.014,-.007,0,.005,.010,.014]
  const gradedTemplates=sizes.map((size,i)=>{
    const source=structuredClone(template)
    const piece=source.panels.find(p=>p.id===added.id)
    piece.polygon.points[1][0]+=offsets[i]
    piece.polygon.points[2][0]+=offsets[i]
    return source
  })
  const graded=await call({op:'grade-run-commit',revision:lastRevision,
    gradeRun:{schemaVersion:1,sizes,baseSize:'M',baseTemplate:template,
      gradedTemplates,pomSpecs:[]}})
  assert.ok(graded.catalog||graded)
  const withGrade=await project()
  assert.deepEqual(withGrade.grade_run.sizes,sizes)
  checks.push('Native Rust committed exact six-size grading with linked journal')
  stage='persisted-journal'
  const journal=`${savedPath}.native.undo-v1.json`
  assert.ok(fs.existsSync(journal) && fs.statSync(journal).size>100)
  const intent=`${savedPath}.native-mirror-intent-v1.json`
  const owner=`${savedPath}.native-mirror-owner-v1.json`
  assert.equal(fs.existsSync(intent),false)
  assert.equal(fs.existsSync(owner),false)
  assert.deepEqual(JSON.parse(fs.readFileSync(savedPath)),withGrade)
  assert.deepEqual(JSON.parse(fs.readFileSync(savedPath+'.native')),withGrade)
  checks.push('Native and JS mirror agree; Undo journal committed; owner and intent cleared')
  stage='sized-viewport'
  for(const size of sizes){
    const activated=await call({op:'grade-run-activate',revision:lastRevision,size})
    assert.ok(activated.triangles.length>0)
    await call({op:'grade-run-restore',revision:lastRevision})
    assert.deepEqual(authoredDocument(await project()),authoredDocument(withGrade))
  }
  checks.push('XS–XXL viewport activation never changed durable base garment')
  resultPacket={ok:true,sourceOnly:true,compiledRust:true,
    tempOnly:true,stage:'complete',checks,snapshotMetrics,initialPanels:opened.template.panels.length,
    editedPanels:edited.template.panels.length,sizes,productionAppTouched:false,
    fitCertified:false,factoryApproved:false}
}catch(error){
  resultPacket={ok:false,stage,error:String(error.message||error),
    checks,productionAppTouched:false}
  process.exitCode=1
}finally{
  workspace?.close()
  // Rust's SIGTERM is asynchronous. Do not remove its native project beneath
  // an exiting child; wait for the exact disposable session command line.
  const projectArgument=path.join(temporary,'workspace','fitting-project.json.native')
  const stillRunning=()=>{
    const scan=spawnSync('/bin/ps',['-axo','pid=,command='],{
      encoding:'utf8',timeout:2500,maxBuffer:2*1024*1024})
    if(scan.status!==0)throw Error('NATIVE_QA_CLEANUP_PROCESS_SCAN_FAILED')
    return scan.stdout.split('\n').some(line=>line.includes(binary+' ') &&
      line.includes(' '+projectArgument))
  }
  let childActive=true
  try {
    for(let attempt=0;attempt<60;attempt++){
      childActive=stillRunning()
      if(!childActive)break
      await new Promise(resolve=>setTimeout(resolve,50))
    }
  }catch(error){
    resultPacket={...resultPacket,ok:false,cleanupError:String(error.message||error)}
    process.exitCode=1
  }
  for(const [name,value] of Object.entries(previous)){
    if(value===undefined)delete process.env[name]
    else process.env[name]=value
  }
  if(childActive){
    resultPacket={...resultPacket,ok:false,cleanupError:resultPacket.cleanupError||
      'DISPOSABLE_RUST_SESSION_NOT_STOPPED',preservedEvidencePath:temporary}
    process.exitCode=1
  }else{
    fs.rmSync(temporary,{recursive:true,force:true})
    resultPacket={...resultPacket,cleanup:'native-child-exited-before-temp-removal'}
  }
  console.log(JSON.stringify(resultPacket,null,2))
}
