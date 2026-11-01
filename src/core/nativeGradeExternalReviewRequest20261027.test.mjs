import test from 'node:test'
import assert from 'node:assert/strict'
import {webcrypto} from 'node:crypto'
import {createAccuMarkNativeRuleSet,editAccuMarkNativePointRule} from './accumarkNativePointRuleSet20261023.js'
import {createNativeGradingPOM20261025,inspectNativeGradingPOM20261025} from './nativeGradingPOM20261025.js'
import {buildNativeGradeExternalReviewRequest20261027 as build} from './nativeGradeExternalReviewRequest20261027.js'
import {sha256NativeGradeReview20261027} from './nativeGradeIndependentReviewEvidence20261027.js'

if(!globalThis.crypto)globalThis.crypto=webcrypto

const SIZES=['XS','S','M','L','XL','XXL']
function fixture(){
 const snapshot={revision:34,template:{panels:[{id:'front',polygon:{points:[[0,0],[.2,0],[.2,.3],[0,.3]],edges:['a','b','c','d']}}],seams:[],fabrics:[]}}
 const rules=createAccuMarkNativeRuleSet(snapshot).ruleSet
 const created=createNativeGradingPOM20261025(snapshot,rules,{panelId:'front',fromPoint:0,toPoint:1,label:'physical width',toleranceMm:2})
 assert(created.ok,created.reason)
 const rows=inspectNativeGradingPOM20261025(snapshot,rules,[created.definition]).rows
 const definitions=[{...created.definition,targetsMm:Object.fromEntries(rows.map(row=>[row.size,row.actualMm]))}]
 const cutResponse={format:'exo-native-graded-cutlines.v1',revision:34,sourceRevision:34,
  manufacturerReady:false,cuttingAuthorized:false,
  sizes:SIZES.map(size=>({size,panels:[{panel_id:'front',cut:{points:[{x:0,y:0},{x:.2,y:0},{x:.2,y:.3},{x:0,y:.3}],area_m2:.06}}],seams:[]}))}
 const cutAudit={ok:true,sourceRevision:34,sourceTemplate:structuredClone(snapshot.template),sourceRuleSet:structuredClone(rules),
  verifiedSizes:[...SIZES],authoritativeRust:false,independentlyVerified:false,cuttingAuthorized:false}
 return {snapshot,rules,definitions,cutResponse,cutAudit}
}

test('six-size full-rule CUT and verified POM specifications generate deterministic evidence request, not factory approval',()=>{
 const f=fixture(),before=JSON.stringify(f)
 const result=build(f.snapshot,f.rules,f.definitions,f.cutResponse,f.cutAudit)
 assert(result.ok,result.reason)
 const again=build(f.snapshot,f.rules,f.definitions,f.cutResponse,f.cutAudit)
 assert.equal(result.json,again.json)
 assert.match(result.filename,/r34-NOT-APPROVED/)
 assert.equal(result.manifest.requiredIndependentEvidence.length,4)
 for(const field of ['sourceTemplateSha256','sourceRuleSetSha256','fullRuleSetSha256','pomDefinitionsSha256','pomSha256','nativeCutSha256'])
  assert.match(result.manifest[field],/^[0-9a-f]{64}$/)
 assert.equal(result.manifest.fullRuleSetSha256,result.manifest.sourceRuleSetSha256)
 assert.equal(result.manifest.pomSha256,result.manifest.pomDefinitionsSha256)
 assert.equal(result.packet.nativeCutStudy.sizes.length,6)
 assert.equal(result.manifest.manufacturingApproved,false)
 assert.equal(result.manufacturingApproved,false)
 assert.equal(JSON.stringify(f),before)
})

test('no request for stale grade offsets, changed source, malformed size inventories or forged approvals',()=>{
 const f=fixture()
 const variants=[
  f=>{f.snapshot.revision++},
  f=>{f.snapshot.template.panels[0].polygon.points[0][0]=.01},
  f=>{f.cutResponse.revision++},
  f=>{f.cutResponse.sizes.pop()},
  f=>{f.cutResponse.sizes[0].size='XL'},
  f=>{f.cutResponse.sizes[0].panels[0].panel_id='other'},
  f=>{f.cutResponse.manufacturerReady=true},
  f=>{f.cutAudit.independentlyVerified=true},
  f=>{f.cutAudit.sourceRuleSet.panels.front.pointOffsetsMm.L[1][0]=12},
  f=>{f.rules.panels.front.pointOffsetsMm.L[1][0]=12},
  f=>{f.definitions[0].targetsMm.XS=null},
 ]
 for(const mutate of variants){
  const item=fixture();mutate(item)
  const result=build(item.snapshot,item.rules,item.definitions,item.cutResponse,item.cutAudit)
  assert.equal(result.ok,false,result.filename||JSON.stringify(mutate.toString()))
  assert.equal(result.cuttingAuthorized,false)
 }
})

test('duplicate physical CUT panel cannot replace a missing source panel in a six-size review request',()=>{
 const f=fixture()
 const second={id:'back',polygon:{points:[[0,0],[.1,0],[.1,.2],[0,.2]],edges:['a','b','c','d']}}
 f.snapshot.template.panels.push(second)
 f.cutAudit.sourceTemplate=structuredClone(f.snapshot.template)
 // Duplicating front used to satisfy the old count + membership checks despite missing back.
 for(const size of f.cutResponse.sizes)size.panels.push({...size.panels[0]})
 const result=build(f.snapshot,f.rules,f.definitions,f.cutResponse,f.cutAudit)
 assert.equal(result.ok,false)
 assert.equal(result.cuttingAuthorized,false)
})

test('review request rejects missing, nonphysical or nonfinite CUT panel geometry',()=>{
 for(const mutate of [
  f=>{delete f.cutResponse.sizes[0].panels[0].cut},
  f=>{f.cutResponse.sizes[0].panels[0].cut.points.pop();f.cutResponse.sizes[0].panels[0].cut.points.pop()},
  f=>{f.cutResponse.sizes[1].panels[0].cut.points[2].x=NaN},
  f=>{f.cutResponse.sizes[2].panels[0].cut.area_m2=0},
  f=>{f.cutResponse.sizes[3].panels[0].cut.area_m2=.5},
  f=>{f.cutResponse.sizes[4].panels[0].cut.points[2].y=0},
  f=>{f.cutResponse.sizes[5].panels[0].cut.points=[
   {x:0,y:0},{x:.2,y:.3},{x:0,y:.3},{x:.2,y:0}]},
  f=>{f.cutResponse.sizes[5].panels[0].cut.points[1]={x:0,y:0}},
  f=>{f.cutResponse.sizes[5].panels[0].cut.points=Array.from({length:4097},(_,i)=>({
   x:Math.cos(i*2*Math.PI/4097)*.1,y:Math.sin(i*2*Math.PI/4097)*.1}))},
  f=>{f.cutResponse.sizes[5].panels[0].cut.points.push({x:0,y:0})},
 ]){
  const f=fixture();mutate(f)
  const result=build(f.snapshot,f.rules,f.definitions,f.cutResponse,f.cutAudit)
  assert.equal(result.ok,false)
  assert.equal(result.cuttingAuthorized,false)
 }
})

test('review request hash pins exactly match independently signed reviewer verifier canonical hashes',async()=>{
 const f=fixture()
 const result=build(f.snapshot,f.rules,f.definitions,f.cutResponse,f.cutAudit)
 assert(result.ok,result.reason)
 assert.equal(result.manifest.sourceTemplateSha256,await sha256NativeGradeReview20261027(f.snapshot.template))
 assert.equal(result.manifest.fullRuleSetSha256,await sha256NativeGradeReview20261027(f.rules))
 assert.equal(result.manifest.pomSha256,await sha256NativeGradeReview20261027(f.definitions))
})
