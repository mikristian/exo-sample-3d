import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,generateKeyPairSync,sign} from 'node:crypto'
import {zipSync} from 'fflate'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createApprovedGradedNotchGeometryDraft20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {createTrustedFactoryZipReceivingBoundary20261031 as createBoundary} from './industrialSignedFactoryZipTrustedBoundary20261031.mjs'

// Disposable six-size factory package and local test signer: NOT third-party
// receiving-CAD acceptance, cutter approval or sewn-sample evidence.
const project=createTeeTemplate()
// Reuse the established 503-file, 18-fabric, six-size disposable exporter
// fixture from industrialSignedFactoryZipIsolated20261030.test.mjs.
for(let i=0;i<17;i++){
  const id=`isolation-${i}`
  project.fabrics[id]={...structuredClone(project.fabrics.main),id,name:`Disposable ${i}`}
  project.pieces.push({id,name:`Disposable Panel ${i}`,fabricId:id,
    points:[{x:100+i*40,y:100},{x:112+i*40,y:100},
      {x:112+i*40,y:112},{x:100+i*40,y:112}],
    curves:{},notches:[],seamAllowance:1,layout2d:{x:100+i*40,y:100}})
}
const files=buildFactoryPackageFiles(project)
assert.equal(Object.keys(files).length,503)
const archive=zipSync(files,{level:6})
const sourceId='disposable-factory-tee:rev-01'
const sourceRevision='disposable-source-revision-01'
const keys=generateKeyPairSync('ed25519')
const draft=createApprovedGradedNotchGeometryDraft20261023(project,sourceRevision)
const trustedKeyConfig={publicKey:keys.publicKey,
  pinnedSpkiSha256:createHash('sha256').update(keys.publicKey.export({format:'der',type:'spki'})).digest('hex')}
const approval={manifest:draft.manifest,sha256:draft.sha256,
  signatureBase64:sign(null,Buffer.from(draft.payload),keys.privateKey).toString('base64')}
const noAuthority=result=>{
  for(const key of ['independentlyReceived','licensedReceiverCadAccepted',
    'physicalNotchStationsCertified','physicalCuttingAuthorized',
    'factoryCertified','bulkProductionAuthorized'])assert.equal(result[key],false,key)
}
const make=(resolveSource,resolveApproval=async()=>approval)=>createBoundary({
  trustedKeyConfig,resolveSource,resolveApproval})

test('admission bounds pre-authorization ZIP snapshots across independently created boundaries',async()=>{
  let release,entered=0
  const gate=new Promise(resolve=>{release=resolve})
  const stalled=make(async id=>{
    assert.equal(id,sourceId)
    entered++
    await gate
    throw Error('disposable record store unavailable')
  })
  const first=stalled({archive,sourceId})
  const second=stalled({archive,sourceId})
  assert.equal(entered,2)
  let unexpectedReads=0
  const competing=make(async()=>{unexpectedReads++;return {project,sourceRevision}})
  const blocked=await competing({archive,sourceId})
  assert.equal(blocked.status,'BLOCKED')
  assert.equal(blocked.issues[0].code,'ZIP_TRUSTED_INTAKE_CAPACITY')
  assert.equal(unexpectedReads,0,'rejected request must not begin backend lookup')
  noAuthority(blocked)
  release()
  const results=await Promise.all([first,second])
  for(const result of results){
    assert.equal(result.issues[0].code,'ZIP_TRUSTED_RESOLUTION_FAILED')
    noAuthority(result)
  }
  // After the two failures, a genuine signed 503-file disposable garment can
  // still be inspected, proving no capacity leak and preserving compatibility.
  const verified=await competing({archive,sourceId})
  assert.equal(verified.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(verified.issues))
  assert.equal(verified.rows.length,6*project.pieces.length)
  assert.equal(verified.rows.reduce((sum,row)=>sum+row.expectedMarks,0),72)
  assert.equal(unexpectedReads,1)
  noAuthority(verified)
})

test('malformed and oversized archives fail before trusted record access or slot reservation',async()=>{
  let reads=0
  const inspect=make(async()=>{reads++;return {project,sourceRevision}})
  const oversized=await inspect({archive:new Uint8Array(16*1024*1024+1),sourceId})
  assert.equal(oversized.issues[0].code,'ZIP_TRUSTED_ARCHIVE_BUDGET')
  const malformed=await inspect({archive,sourceId,physicalCuttingAuthorized:true})
  assert.equal(malformed.issues[0].code,'ZIP_TRUSTED_REQUEST_SCHEMA')
  assert.equal(reads,0)
  noAuthority(oversized)
  noAuthority(malformed)
})

test('expired noncooperative source and approval reads retain admission until they settle',async()=>{
  let releaseLateSource,releaseLateApproval,approvalReads=0
  const lateSource=new Promise(resolve=>{releaseLateSource=resolve})
  const lateApproval=new Promise(resolve=>{releaseLateApproval=resolve})
  const sourceHung=make(async()=>lateSource,async()=>{
    approvalReads++
    return approval
  })
  const approvalHung=make(async()=>({project,sourceRevision}),
    async()=>lateApproval)
  const first=sourceHung({archive,sourceId})
  const second=approvalHung({archive,sourceId})
  const competing=make(async()=>{throw Error('disposable offline backend')})
  const third=await competing({archive,sourceId})
  assert.equal(third.issues[0].code,'ZIP_TRUSTED_INTAKE_CAPACITY')
  const timedOut=await Promise.all([first,second])
  for(const result of timedOut){
    assert.equal(result.issues[0].code,'ZIP_TRUSTED_RESOLUTION_FAILED')
    noAuthority(result)
  }
  // Both timed-out callers have returned, but their backend I/O ignored
  // AbortSignal. A new request must NOT evade the capacity limit.
  const stillBlocked=await competing({archive,sourceId})
  assert.equal(stillBlocked.issues[0].code,'ZIP_TRUSTED_INTAKE_CAPACITY')
  noAuthority(stillBlocked)
  releaseLateSource({project,sourceRevision})
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(approvalReads,0,'late source must not start approval lookup')
  releaseLateApproval(approval)
  await Promise.resolve()
  await Promise.resolve()
  const healthy=make(async()=>({project,sourceRevision}))
  const after=await healthy({archive,sourceId})
  assert.equal(after.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(after.issues))
  noAuthority(after)
})

test('deadline sends AbortSignal to both independent backend lookup stages and never grants CUT',async()=>{
  const observed=[]
  let cancelled=0
  const pending=signal=>new Promise((_,reject)=>{
    signal.addEventListener('abort',()=>{
      cancelled++
      reject(signal.reason)
    },{once:true})
  })
  const sourceHung=make(async(id,{signal})=>{
    assert.equal(id,sourceId)
    assert.equal(signal.aborted,false)
    observed.push(['source',signal])
    return pending(signal)
  })
  const approvalHung=make(async(id,{signal})=>{
    assert.equal(id,sourceId)
    assert.equal(signal.aborted,false)
    return {project,sourceRevision}
  },async(id,{signal})=>{
    assert.equal(id,sourceId)
    observed.push(['approval',signal])
    return pending(signal)
  })
  const results=await Promise.all([
    sourceHung({archive,sourceId}),approvalHung({archive,sourceId})
  ])
  assert.deepEqual(observed.map(([stage])=>stage),['source','approval'])
  assert.equal(cancelled,2,'cooperating record-store operations must receive cancellation')
  for(const [,signal] of observed){
    assert.equal(signal.aborted,true,'backend I/O must receive timeout cancellation')
    assert.match(String(signal.reason),/deadline/)
  }
  for(const result of results){
    assert.equal(result.issues[0].code,'ZIP_TRUSTED_RESOLUTION_FAILED')
    noAuthority(result)
  }
  const healthy=make(async()=>({project,sourceRevision}))
  const verified=await healthy({archive,sourceId})
  assert.equal(verified.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(verified.issues))
  noAuthority(verified)
})

test('synchronous blocking source cannot bypass deadline by delaying the timer callback',async()=>{
  let approvalReads=0,signal
  const inspect=make((id,context)=>{
    assert.equal(id,sourceId)
    signal=context.signal
    // Block without CPU spinning. This reproduces a synchronous backend
    // resolver holding Node's event loop past the 15-second deadline.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,15100)
    return {project,sourceRevision}
  },async()=>{approvalReads++;return approval})
  const result=await inspect({archive,sourceId})
  assert.equal(result.status,'BLOCKED')
  assert.equal(result.issues[0].code,'ZIP_TRUSTED_RESOLUTION_FAILED')
  assert.equal(signal.aborted,true)
  assert.equal(approvalReads,0,'late source must never reach approval verification')
  noAuthority(result)
})
