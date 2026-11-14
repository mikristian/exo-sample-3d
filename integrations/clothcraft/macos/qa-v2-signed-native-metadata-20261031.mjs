#!/usr/bin/env node
// Against ONLY a separately launched, authenticated and disposable SIGNED
// stage. Intentionally no production ports, installed .app or user documents.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const candidates=path.join(root,'integrations/clothcraft/output/release-candidates')
const app=path.resolve(process.env.EXO_STAGING_APP_PATH||'')
const support=process.env.EXO_STAGING_SUPPORT_NAME
const stageUrl='http://127.0.0.1:5485'
const webUrl='http://127.0.0.1:5486'
let stage='preflight',revision
const checks=[]
const fail=error=>{
  console.error(JSON.stringify({ok:false,stage,error:String(error?.message||error),checks,
    productionPortsAccessed:false,fitCertified:false,factoryApproved:false},null,2))
  process.exitCode=1
}
try {
  assert.equal(process.env.EXO_STAGING_DISPOSABLE_SESSION,'YES',
    'Refuse all writes unless EXO_STAGING_DISPOSABLE_SESSION=YES')
  assert.equal(path.dirname(app),candidates,'Refuse non-candidate signed app')
  assert.match(path.basename(app),/^EXO-ClothCraft-V2-Candidate-[A-Za-z0-9-]+\.app$/)
  assert.ok(!fs.lstatSync(app).isSymbolicLink())
  assert.match(support||'',/^EXO-ClothCraft-Studio-V2-Staging-[A-Za-z0-9-]{1,48}$/)
  const plist=path.join(app,'Contents/Info.plist')
  assert.equal(execFileSync('/usr/libexec/PlistBuddy',
    ['-c','Print :EXOStagingSupportName',plist],{encoding:'utf8'}).trim(),support)
  assert.equal(execFileSync('/usr/libexec/PlistBuddy',
    ['-c','Print :CFBundleIdentifier',plist],{encoding:'utf8'}).trim(),
    'com.mikristian.exo.clothcraft.workspace.v2.candidate')
  execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',app])
  const tokenPath=path.join(os.homedir(),'Library/Application Support',support,
    'Output/workspace-auth-token')
  const token=fs.readFileSync(tokenPath,'utf8').trim()
  assert.ok(token.length>=32)
  const fetchBounded=(url,options={})=>fetch(url,{
    signal:AbortSignal.timeout(30000),redirect:'error',...options})
  const health=await (await fetchBounded(stageUrl+'/health')).json()
  assert.equal(health.ok,true)
  assert.equal(health.nativeReady,true)
  assert.equal(health.workspaceAuthIdentity,crypto.createHash('sha256').update(token).digest('hex'))
  const resources=path.join(app,'Contents/Resources')
  const manifest=JSON.parse(fs.readFileSync(path.join(resources,'runtime-provenance.json'),'utf8'))
  assert.equal(health.runtimeProvenance?.identity,manifest.identity)
  assert.equal(health.runtimeProvenance?.verified,true)
  checks.push('Signed AppKit candidate, isolated native data namespace, exact runtime/auth identity')
  const served=await (await fetchBounded(webUrl+'/')).text()
  assert.equal(served,fs.readFileSync(path.join(resources,'web/index.html'),'utf8'))
  checks.push('Signed web HTML is byte-identical to the running native web server')
  const rpc=async(request,auth=token)=>{
    const response=await fetchBounded(stageUrl+'/workspace',{
      method:'POST',headers:{'content-type':'application/json',
        ...(auth?{authorization:'Bearer '+auth}:{})},
      body:JSON.stringify(request),
    })
    const body=await response.json()
    return {...body,httpStatus:response.status}
  }
  assert.equal((await rpc({op:'snapshot'},null)).httpStatus,401)
  assert.equal((await rpc({op:'snapshot'},'bad-token')).httpStatus,401)
  const send=async request=>{
    const body=await rpc({...(revision===undefined?{}:{revision}),...request})
    assert.equal(body.httpStatus,200,request.op+': HTTP '+body.httpStatus)
    assert.equal(body.ok,true,request.op+': '+(body.error||'native operation rejected'))
    if(Number.isSafeInteger(body.data?.revision))revision=body.data.revision
    return body.data
  }
  const save=async()=> (await send({op:'save'})).project
  const authored=project=>{
    const result=structuredClone(project)
    delete result.native_commit
    return result
  }
  stage='cold-start'
  const opened=await send({op:'open',preset:'tshirt'})
  assert.ok(opened.template.panels.length>=2 && opened.triangles.length>0)
  const base=await save()
  const panel=base.template.panels[0].id
  const fabric=base.template.fabrics[0].id
  assert.ok(base.native_commit?.project_id && base.native_commit.generation>=1)
  assert.equal(base.propertyMetadata.version,2)
  const nativeId=base.native_commit.project_id
  const namespace=base.propertyMetadata.metadataProjectId
  stage='metadata'
  await send({op:'set-property',target:'panel',id:panel,field:'itemNo',value:'QA-NATIVE-001'})
  await send({op:'set-property',target:'fabric',id:fabric,
    field:'appearance.color',value:'#123abc'})
  const afterMetadata=await save()
  assert.equal(afterMetadata.native_commit.project_id,nativeId)
  assert.ok(afterMetadata.native_commit.generation>base.native_commit.generation)
  assert.equal(afterMetadata.propertyMetadata.metadataProjectId,namespace)
  assert.equal(afterMetadata.propertyMetadata.panels[panel].itemNo,'QA-NATIVE-001')
  assert.equal(afterMetadata.propertyMetadata.fabrics[fabric].appearance.color,'#123abc')
  const workspacePath=path.join(os.homedir(),'Library/Application Support',support,
    'Output/workspace/fitting-project.json')
  assert.equal(fs.existsSync(workspacePath+'.properties.json'),false,
    'New metadata edits must not write a separate auxiliary JSON sidecar')
  assert.deepEqual(JSON.parse(fs.readFileSync(workspacePath+'.native','utf8')).propertyMetadata,
    afterMetadata.propertyMetadata)
  checks.push('Rust-authoritative panel/fabric properties advance document UUID/generation without sidecar')
  stage='2d-3d-history'
  const sourceCount=afterMetadata.template.panels.length
  const edited=await send({op:'edit',command:{kind:'Polygon',fabric,
    points:[[0,0],[.4,0],[.4,.32],[0,.32]]}})
  assert.equal(edited.template.panels.length,sourceCount+1)
  assert.ok(edited.triangles.length>0)
  const added=edited.template.panels.find(p=>!afterMetadata.template.panels.some(x=>x.id===p.id))
  assert.ok(added)
  const editedProject=await save()
  await send({op:'undo'})
  assert.deepEqual((await save()).template,afterMetadata.template)
  await send({op:'redo'})
  assert.deepEqual((await save()).template,editedProject.template)
  checks.push('Real native 2D polygon edit/3D regeneration and linked Undo/Redo')
  stage='graded-sizes'
  const sizes=['XS','S','M','L','XL','XXL']
  const baseTemplate=structuredClone(edited.template)
  await send({op:'bindings-store',nativeBindings:{
    measurements:{width:{valueMm:400}},
    bindings:[
      {id:'qa_width_top',panelId:added.id,pointIndex:1,mode:'polar',
        a:0,b:0,angleDeg:0,distanceFormula:'width',dependsOn:[]},
      {id:'qa_width_bottom',panelId:added.id,pointIndex:2,mode:'polar',
        a:3,b:3,angleDeg:0,distanceFormula:'width',dependsOn:[]},
    ],
  }})
  const offsets=[-.015,-.007,0,.005,.010,.014]
  const gradedTemplates=sizes.map((_,i)=>{
    const template=structuredClone(baseTemplate)
    const piece=template.panels.find(p=>p.id===added.id)
    piece.polygon.points[1][0]+=offsets[i]
    piece.polygon.points[2][0]+=offsets[i]
    return template
  })
  await send({op:'grade-run-commit',gradeRun:{schemaVersion:1,sizes,baseSize:'M',
    baseTemplate,gradedTemplates,pomSpecs:[]}})
  const grade=await save()
  assert.deepEqual(grade.grade_run.sizes,sizes)
  for(const size of sizes) {
    const active=await send({op:'grade-run-activate',size})
    assert.ok(active.triangles.length>0)
    await send({op:'grade-run-restore'})
    assert.deepEqual(authored(await save()),authored(grade))
  }
  checks.push('XS–XXL grades activate linked 3D and preserve authored source')
  stage='reopen'
  const reloaded=await send({op:'open',project:grade})
  assert.ok(reloaded.triangles.length>0)
  const final=await save()
  assert.equal(final.propertyMetadata.metadataProjectId,namespace)
  assert.deepEqual(final.propertyMetadata,grade.propertyMetadata)
  assert.deepEqual(final.grade_run.sizes,sizes)
  checks.push('Saved native garment, metadata and six-size grade catalog reopen')
  console.log(JSON.stringify({ok:true,stage:'complete',checks,
    sourceOnly:false,signedApp:true,productionPortsAccessed:false,
    fitCertified:false,factoryApproved:false,physicalPrintCalibrationVerified:false},null,2))
}catch(error){fail(error)}
