import test from 'node:test'
import assert from 'node:assert/strict'
import {webcrypto} from 'node:crypto'
import {buildAccuMarkExplorerOrder20261024} from './accumarkExplorerProductionFoundation20261024.js'
import {buildAccuMarkCutRoomPlan} from './accumarkCutRoomPlan20261024.js'
import {buildIndustrialCadOrderHandoff20261028} from './industrialCadOrderHandoff20261028.mjs'
import {parseAccuMarkGradedDxfWire20261023} from './accumarkGradedDxfRoundtripAudit20261023.js'
import {sha256Bytes} from './sha256Bytes.js'
import {canonicalNativeGradeReviewJson20261027 as canonical,
 sha256NativeGradeReview20261027 as digest,
 verifyNativeGradeIndependentReviewEvidence20261027 as verify,
} from './nativeGradeIndependentReviewEvidence20261027.js'
import {inspectIndustrialNativeGradeReviewArtifactIntake20261031 as inspect} from './industrialNativeGradeReviewArtifactIntake20261031.mjs'
import {verifyIndustrialNativeSourceProvenance20261031 as verifySource}
 from './industrialNativeSourceProvenance20261031.mjs'

if(!globalThis.crypto)globalThis.crypto=webcrypto
const SIZES=['XS','S','M','L','XL','XXL']
const ROLES=['cut','receiving-cad','sewn-samples']
const encoder=new TextEncoder()
const now=Date.parse('2026-10-31T19:00:00Z')
const hash=bytes=>sha256Bytes(bytes)
const file=(filename,bytes)=>({filename,byteLength:bytes.length,sha256:hash(bytes),bytes})

// Real EXO DXF exporter, two fabrics and all six sizes. The native/.RUL
// fixtures below are explicitly synthetic bytes, not licensed CAD output.
function disposableGarmentWires(){
 const project={id:'disposable-review-artifacts',grading:{sizes:SIZES,baseSize:'M',
  widthPerSizeCm:0,lengthPerSizeCm:0},pieces:[
  {id:'front',name:'Front',fabricId:'shell',cutQuantity:2,grainAngleDeg:0,
   seamAllowance:1,notches:[{edgeIndex:0,t:.25,depthCm:.3}],
   points:[{x:0,y:0},{x:12,y:0},{x:12,y:9},{x:0,y:9}]},
  {id:'collar',name:'Collar',fabricId:'rib',cutQuantity:1,grainAngleDeg:0,
   seamAllowance:1,points:[{x:0,y:0},{x:8,y:0},{x:8,y:3},{x:0,y:3}]},
 ]}
 const quantitiesBySize=Object.fromEntries(SIZES.map(size=>[size,1]))
 const explorer=buildAccuMarkExplorerOrder20261024(project,
  {styleId:'TEE-REVIEW-ARTIFACTS',orderId:'ORDER-REVIEW-ARTIFACTS',quantitiesBySize})
 assert.equal(explorer.ok,true,JSON.stringify(explorer.issues))
 const plans={}
 for(const fabricId of ['shell','rib']){
  plans[fabricId]=buildAccuMarkCutRoomPlan(project,{fabricId,quantitiesBySize,
   fabricWidthCm:60,spacingCm:1,nap:true,maxPlyCount:2,
   rolls:[{rollId:`${fabricId}-ROLL`,batchId:`${fabricId}-BATCH`,fabricId,
    shade:'SHADE-1',nap:true,usableLengthCm:1000,costPerMeter:20,widthCm:60}]})
  assert.equal(plans[fabricId].ok,true,JSON.stringify(plans[fabricId].issues))
 }
 const handoff=buildIndustrialCadOrderHandoff20261028(project,explorer,plans)
 assert.equal(handoff.ok,true,JSON.stringify(handoff.issues))
 for(const size of SIZES){
  const parsed=parseAccuMarkGradedDxfWire20261023(handoff.wiresBySize[size])
  assert.equal(parsed.ok,true,`${size}: ${JSON.stringify(parsed.issues)}`)
  assert(parsed.entities.length>0,`${size}: expected actual exported DXF entities`)
 }
 return handoff.wiresBySize
}

async function fixture(){
 const wires=disposableGarmentWires()
 const inventory={
  native:file('native/tee-review.pds',encoder.encode('SYNTHETIC PDS FIXTURE; NOT A NATIVE CAD PARSE')),
  rules:file('rules/tee-review.rul',encoder.encode('SYNTHETIC RUL FIXTURE; NOT A RULE INTERPRETATION')),
  received:{},returned:{},
 }
 for(const size of SIZES){
  const bytes=encoder.encode(wires[size])
  inventory.received[size]=file(`received/${size}.dxf`,bytes)
  inventory.returned[size]=file(`returned/${size}.dxf`,new Uint8Array(bytes))
 }
 const expectedSourceArtifactHashes={nativeSha256:inventory.native.sha256,
  rulesSha256:inventory.rules.sha256}
 const sourceTemplate={panels:[{id:'front',polygon:{points:[[0,0],[1,0]],
  edges:['edge-1'],seam_allowances:{'edge-1':.01},
  notches:{'edge-1':[{id:'n-1',t:.5}]}}}],name:'Disposable Tee'}
 const fullRuleSet={sizes:SIZES,panels:{front:{points:{XS:1}}}}
 const pomDefinitions=[{id:'chest',targetsMm:Object.fromEntries(
  SIZES.map((size,i)=>[size,500+i*20])),toleranceMm:5}]
 const pins={sourceTemplateSha256:await digest(sourceTemplate),
  fullRuleSetSha256:await digest(fullRuleSet),pomSha256:await digest(pomDefinitions)}
 const trustedPublicKeys={},keys={},reports=[]
 for(const role of ROLES){
  const reviewerId=`disposable-${role}`
  keys[reviewerId]=await webcrypto.subtle.generateKey('Ed25519',true,['sign','verify'])
  trustedPublicKeys[reviewerId]={role,publicKey:keys[reviewerId].publicKey}
  const sizeReports=SIZES.map((size,i)=>{
   if(role==='cut')return {size,cutJobId:`cut-${size}`,materialLotId:'lot-disposable',
    calibration:{equipmentId:'cutter-disposable',calibrationCertificateId:'cal-disposable',
     calibratedAt:'2026-10-01T00:00:00Z',expiresAt:'2026-11-30T00:00:00Z',
     measuredErrorMm:.1,maxErrorMm:.2},
    allowanceReports:[{panelId:'front',edgeId:'edge-1',requiredMm:10,measuredMm:10,
     toleranceMm:.2}],
    notchReports:[{panelId:'front',notchId:'n-1',expectedPositionMm:100,
     measuredPositionMm:100,toleranceMm:.5}]}
   if(role==='receiving-cad')return {size,returnedFileName:`${size}.dxf`,
    returnedFileSha256:inventory.returned[size].sha256,
    receivedFileSha256:inventory.received[size].sha256,
    receiptId:`receipt-${size}`,geometryParityPassed:true,
    allowancesPreserved:true,notchesPreserved:true}
   return {size,specimenId:`specimen-${size}`,sewingBatchId:'batch-disposable',
    pomMeasurements:[{pomId:'chest',targetMm:500+i*20,actualMm:500+i*20,
     toleranceMm:5,instrumentId:'caliper-disposable'}]}
  })
  reports.push({role,evidenceId:`evidence-${role}`,reviewerId,
   recordedAt:'2026-10-31T18:00:00Z',sourceRevision:12,...pins,sizes:[...SIZES],
   factoryApproved:false,cuttingAuthorized:false,
   ...(role==='receiving-cad'?{receivingCadApplication:'LOCAL_FIXTURE',
    receivingCadVersion:'test-1'}:{}),sizeReports})
 }
 const evidence={schema:'exo.native-grade-independent-review-evidence.v1',
  sourceRevision:12,...pins,sizes:[...SIZES],reports}
 const sign=async()=>{
  for(const report of reports){
   const {signatureBase64,...body}=report
   const signed=await webcrypto.subtle.sign('Ed25519',
    keys[report.reviewerId].privateKey,encoder.encode(canonical(body)))
   report.signatureBase64=Buffer.from(signed).toString('base64')
  }
 }
 await sign()
 return {sourceRevision:12,sourceTemplate,fullRuleSet,pomDefinitions,
  evidence,trustedPublicKeys,now,artifactInventory:inventory,
  expectedSourceArtifactHashes,sign}
}

test('six-size two-fabric real DXF byte inventory crosschecks bytes without unproven audit readiness',async()=>{
 const f=await fixture()
 const signedOnly=await verify({...f,artifactInventory:null,expectedSourceArtifactHashes:null})
 assert.equal(signedOnly.ok,true,JSON.stringify(signedOnly))
 assert.equal(signedOnly.releaseReadyForIndependentAudit,false)
 assert.equal(signedOnly.artifactBytesCrosschecked,false)
 const result=await verify(f)
 assert.equal(result.ok,true,JSON.stringify(result))
 assert.equal(result.releaseReadyForIndependentAudit,false)
 assert.equal(result.artifactBytesCrosschecked,true)
 assert.equal(result.nativeCadParsed,false)
 assert.equal(result.gradingRulesParsed,false)
 for(const key of ['physicalTruthVerified','factoryApproved','manufacturingApproved','cuttingAuthorized'])
  assert.equal(result[key],false)
 const local=inspect(f.evidence,f.artifactInventory,f.expectedSourceArtifactHashes)
 assert.equal(local.ok,true,JSON.stringify(local))
 assert.equal(local.files.length,14)
 assert(local.files.filter(row=>row.filename.endsWith('.dxf')).every(row=>row.byteLength>200))
})

test('missing, empty, extra and swapped files fail closed',async()=>{
 const scenarios=[
  f=>{delete f.artifactInventory.received.XS},
  f=>{f.artifactInventory.rules.bytes=new Uint8Array()},
  f=>{f.artifactInventory.returned.XXXL=f.artifactInventory.returned.XXL},
  f=>{const a=f.artifactInventory.received.XS,b=f.artifactInventory.received.S;
   f.artifactInventory.received.XS=b;f.artifactInventory.received.S=a},
  f=>{f.artifactInventory.native.filename='../../fake.pds'},
 ]
 for(const mutate of scenarios){
  const f=await fixture();mutate(f)
  const result=await verify(f)
  assert.equal(result.ok,false,JSON.stringify(result))
  assert.equal(result.releaseReadyForIndependentAudit,false)
  assert.equal(result.factoryApproved,false)
 }
})

test('modified bytes, invented digests, and unpinned native/rule hashes fail closed',async()=>{
 const scenarios=[
  f=>{f.artifactInventory.returned.M.bytes[40]^=1},
  f=>{f.artifactInventory.received.L.sha256='a'.repeat(64)},
  f=>{f.artifactInventory.native.bytes[0]^=1},
  f=>{f.expectedSourceArtifactHashes.rulesSha256='b'.repeat(64)},
  f=>{f.artifactInventory.returned.XL.byteLength++},
 ]
 for(const mutate of scenarios){
  const f=await fixture();mutate(f)
  const result=await verify(f)
  assert.equal(result.ok,false,JSON.stringify(result))
  assert.equal(result.artifactBytesCrosschecked,false)
 }
})

test('re-signed arbitrary CAD hash or ghost filename cannot substitute actual returned bytes',async()=>{
 for(const mutate of [
  f=>{f.evidence.reports[1].sizeReports[2].returnedFileSha256='a'.repeat(64)},
  f=>{f.evidence.reports[1].sizeReports[2].returnedFileName='ghost.dxf'},
 ]){
  const f=await fixture();mutate(f);await f.sign()
  const result=await verify(f)
  assert.equal(result.ok,false,JSON.stringify(result))
  assert.equal(result.releaseReadyForIndependentAudit,false)
 }
})

test('shared memory, proxies and accessor-based byte claims are rejected',async()=>{
 const f=await fixture()
 if(typeof SharedArrayBuffer!=='undefined'){
  const old=f.artifactInventory.returned.XS.bytes
  const shared=new Uint8Array(new SharedArrayBuffer(old.length));shared.set(old)
  f.artifactInventory.returned.XS.bytes=shared
  assert.equal((await verify(f)).ok,false)
 }
 const proxy=await fixture()
 proxy.artifactInventory.returned.M.bytes=new Proxy(proxy.artifactInventory.returned.M.bytes,{})
 assert.equal((await verify(proxy)).ok,false)
 const accessor=await fixture();let calls=0
 Object.defineProperty(accessor.artifactInventory.received.S,'bytes',
  {enumerable:true,get(){calls++;return encoder.encode('forged')}})
 assert.equal((await verify(accessor)).ok,false)
 assert.equal(calls,0)
})

test('stale source revision still fails signed review despite matching supplied file bytes',async()=>{
 const f=await fixture()
 f.sourceRevision++
 const result=await verify(f)
 assert.equal(result.ok,false)
 assert.equal(result.releaseReadyForIndependentAudit,false)
})

test('rehashed synthetic native and rule bytes remain locally consistent but cannot create independent readiness',async()=>{
 const f=await fixture()
 f.artifactInventory.native=file('native/tee-review.pds',encoder.encode('UNRELATED SYNTHETIC NATIVE BYTES'))
 f.artifactInventory.rules=file('rules/tee-review.rul',encoder.encode('UNRELATED SYNTHETIC RULE BYTES'))
 f.expectedSourceArtifactHashes.nativeSha256=f.artifactInventory.native.sha256
 f.expectedSourceArtifactHashes.rulesSha256=f.artifactInventory.rules.sha256
 const result=await verify(f)
 assert.equal(result.ok,true,JSON.stringify(result))
 assert.equal(result.artifactBytesCrosschecked,true)
 assert.equal(result.releaseReadyForIndependentAudit,false)
 assert.equal(result.nativeCadParsed,false)
 assert.equal(result.gradingRulesParsed,false)
})

test('a re-signed arbitrary returned file cannot become licensed receiving CAD evidence',async()=>{
 const f=await fixture()
 const size='S'
 f.artifactInventory.returned[size]=file(`returned/${size}.dxf`,
  encoder.encode('NOT A CAD REEXPORT; DISPOSABLE NEGATIVE CONTROL'))
 f.evidence.reports[1].sizeReports[1].returnedFileSha256=
  f.artifactInventory.returned[size].sha256
 await f.sign()
 const result=await verify(f)
 assert.equal(result.ok,true,JSON.stringify(result))
 assert.equal(result.artifactBytesCrosschecked,true)
 assert.equal(result.releaseReadyForIndependentAudit,false)
 assert.equal(result.receivingCadVerified,false)
 assert.equal(result.cuttingAuthorized,false)
})

async function signedSourceFixture(){
 const f=await fixture()
 const sourceKeyId='disposable-source-key'
 const key=await webcrypto.subtle.generateKey('Ed25519',true,['sign','verify'])
 const sourceManifest={
  format:'exo.native-grade-source-artifact-manifest.v1',sourceKeyId,
  sourceRevision:f.sourceRevision,
  sourceTemplateSha256:await digest(f.sourceTemplate),
  fullRuleSetSha256:await digest(f.fullRuleSet),
  pomSha256:await digest(f.pomDefinitions),
  nativeFilename:f.artifactInventory.native.filename,
  nativeSha256:f.artifactInventory.native.sha256,
  rulesFilename:f.artifactInventory.rules.filename,
  rulesSha256:f.artifactInventory.rules.sha256,
  issuedAt:'2026-10-31T17:00:00.000Z',
  expiresAt:'2026-11-01T17:00:00.000Z',
 }
 const sign=async()=>Buffer.from(await webcrypto.subtle.sign('Ed25519',
  key.privateKey,encoder.encode(canonical(sourceManifest)))).toString('base64')
 return {...f,sourceManifest,sourceManifestSignatureBase64:await sign(),
  trustedSourceKeys:{[sourceKeyId]:{purpose:'native-grade-source',publicKey:key.publicKey}},
  expectedSourceKeyId:sourceKeyId,signSource:sign}
}

test('separately signed source manifest binds six-size real DXF review to native/RUL bytes without granting release',async()=>{
 const f=await signedSourceFixture()
 const result=await verifySource(f)
 assert.equal(result.ok,true,JSON.stringify(result))
 assert.equal(result.sourceManifestSignatureVerified,true)
 assert.equal(result.artifactBytesCrosschecked,true)
 assert.equal(result.independentlySignedEvidenceVerified,true)
 for(const flag of ['releaseReadyForIndependentAudit','nativeCadParsed','gradingRulesParsed',
  'independentReceiverAuthenticated','receiverCadVerified','physicalTruthVerified',
  'cuttingAuthorized','factoryApproved','manufacturingApproved'])
  assert.equal(result[flag],false,flag)
})

test('source revision, template and grading-rule drift refuse signed native provenance',async()=>{
 for(const mutate of [
  f=>{f.sourceRevision++},
  f=>{f.sourceTemplate.name='Different Tee'},
  f=>{f.fullRuleSet.panels.front.points.XS=2},
  f=>{f.sourceManifest.sourceRevision++},
 ]){
  const f=await signedSourceFixture();mutate(f)
  const result=await verifySource(f)
  assert.equal(result.ok,false,JSON.stringify(result))
  assert.equal(result.releaseReadyForIndependentAudit,false)
 }
})

test('rehashed synthetic native/RUL substitution cannot bypass separately signed source manifest',async()=>{
 for(const kind of ['native','rules']){
  const f=await signedSourceFixture()
  const original=f.artifactInventory[kind]
  f.artifactInventory[kind]=file(original.filename,encoder.encode('REPLACED SYNTHETIC ARTIFACT'))
  const result=await verifySource(f)
  assert.equal(result.ok,false,JSON.stringify(result))
  assert.equal(result.sourceManifestSignatureVerified,false)
  assert.equal(result.releaseReadyForIndependentAudit,false)
 }
})

test('tampered signatures, unknown source keys, expired windows and extra manifest fields fail closed',async()=>{
 for(const mutate of [
  f=>{f.sourceManifestSignatureBase64='A'.repeat(86)+'=='},
  f=>{f.expectedSourceKeyId='unknown-source-key'},
  f=>{f.sourceManifest.expiresAt='2026-10-31T18:00:00.000Z'},
  f=>{f.sourceManifest.unexpected='not signed'},
  f=>{f.trustedSourceKeys[f.expectedSourceKeyId].purpose='receiver'},
 ]){
  const f=await signedSourceFixture();mutate(f)
  const result=await verifySource(f)
  assert.equal(result.ok,false,JSON.stringify(result))
  assert.equal(result.releaseReadyForIndependentAudit,false)
 }
})
