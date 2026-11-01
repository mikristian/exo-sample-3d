import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,generateKeyPairSync,sign} from 'node:crypto'
import {zipSync} from 'fflate'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createApprovedGradedNotchGeometryDraft20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {createAuthorizedFactoryZipReceivingBoundary20261031 as createBoundary} from './industrialSignedFactoryZipAuthorizedSnapshot20261031.mjs'

// Disposable six-size, 18-fabric garment, locally generated signatures and mock atomic
// backend records. NOT a licensed receiving-CAD or physical factory sign-off.
const project=createTeeTemplate()
for(let i=0;i<17;i++){
  const id=`stress-${i}`
  project.fabrics[id]={...structuredClone(project.fabrics.main),id,name:`Disposable Fabric ${i}`}
  project.pieces.push({id,name:`Disposable Panel ${i}`,fabricId:id,
    points:[{x:100+i*40,y:100},{x:112+i*40,y:100},
      {x:112+i*40,y:112},{x:100+i*40,y:112}],
    curves:{},notches:[],seamAllowance:1,layout2d:{x:100+i*40,y:100}})
}
const files=buildFactoryPackageFiles(project)
assert.equal(project.grading.sizes.length,6)
assert.equal(Object.keys(files).length,503)
const archive=zipSync(files,{level:6})
const sourceId='tenant-a:tee-01'
const sourceRevision='revision-pinned-01'
const keys=generateKeyPairSync('ed25519')
const trust={publicKey:keys.publicKey,pinnedSpkiSha256:createHash('sha256')
  .update(keys.publicKey.export({format:'der',type:'spki'})).digest('hex')}
const draft=createApprovedGradedNotchGeometryDraft20261023(project,sourceRevision)
assert.equal(draft.status,'draft_for_external_review')
const approval={manifest:draft.manifest,sha256:draft.sha256,
  signatureBase64:sign(null,Buffer.from(draft.payload),keys.privateKey).toString('base64')}
const principal={subjectId:'operator-01',tenantId:'tenant-a'}
const snapshot={authorized:true,sourceId,tenantId:principal.tenantId,
  subjectId:principal.subjectId,sourceRevision,approvalSourceRevision:sourceRevision,
  approvalSourceId:sourceId,approvalTenantId:principal.tenantId,project,approval}
const make=({identity=principal,record=snapshot,resolvePrincipal,resolveAuthorizedSnapshot,
  key=trust}={})=>{
  let authCalls=0,recordCalls=0
  const inspect=createBoundary({trustedKeyConfig:key,
    resolvePrincipal:resolvePrincipal||(async()=>{authCalls++;return identity}),
    resolveAuthorizedSnapshot:resolveAuthorizedSnapshot||(async args=>{
      recordCalls++
      assert.equal(args.sourceId,sourceId)
      assert.deepEqual(args.principal,principal)
      assert(Object.isFrozen(args)&&Object.isFrozen(args.principal))
      return record
    })})
  return {inspect,reads:()=>[authCalls,recordCalls]}
}
const noAuthority=result=>{
  for(const field of ['independentlyReceived','licensedReceiverCadAccepted',
    'physicalNotchStationsCertified','physicalCuttingAuthorized','factoryCertified',
    'bulkProductionAuthorized'])assert.equal(result[field],false,field)
}
const expectBlocked=async(inspect,request={archive,sourceId})=>{
  const result=await inspect(request)
  assert.equal(result.status,'BLOCKED',JSON.stringify(result.issues))
  noAuthority(result)
  return result
}

test('one authorized atomic six-size source/approval snapshot yields local match, never CUT authorization',async()=>{
  const boundary=make()
  const result=await boundary.inspect({archive,sourceId})
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  assert.equal(result.rows.length,6*project.pieces.length)
  assert.equal(result.rows.reduce((sum,row)=>sum+row.expectedMarks,0),72)
  assert.deepEqual(boundary.reads(),[1,1])
  noAuthority(result)
})

test('unauthenticated identity and cross-tenant source access fail before signed inspection',async()=>{
  const noLogin=make({identity:null})
  const missing=await expectBlocked(noLogin.inspect)
  assert.equal(missing.issues[0].code,'ZIP_TRUSTED_RESOLUTION_FAILED')
  assert.deepEqual(noLogin.reads(),[1,0])
  const crossTenant=make({record:{...snapshot,tenantId:'tenant-b'}})
  await expectBlocked(crossTenant.inspect)
  assert.deepEqual(crossTenant.reads(),[1,1])
  const crossUser=make({record:{...snapshot,subjectId:'other-operator'}})
  await expectBlocked(crossUser.inspect)
})

test('mixed source/approval revision, source ID and tenant bindings all fail closed',async()=>{
  for(const mutation of [
    {approvalSourceRevision:'older-approved-revision'},
    {approvalSourceId:'tenant-a:other-style'},
    {approvalTenantId:'tenant-b'},
    {authorized:false},
    {sourceId:'tenant-b:tee-01'},
  ]){
    const boundary=make({record:{...snapshot,...mutation}})
    const result=await expectBlocked(boundary.inspect)
    assert.equal(result.issues[0].code,'ZIP_TRUSTED_RESOLUTION_FAILED')
  }
})

test('request cannot inject principal, approval or manufacturing approval fields',async()=>{
  const boundary=make()
  for(const field of [
    {principal:{subjectId:'admin',tenantId:'tenant-a'}},
    {approval},
    {physicalCuttingAuthorized:true},
    {licensedReceiverCadAccepted:true},
  ]){
    const result=await expectBlocked(boundary.inspect,{archive,sourceId,...field})
    assert.equal(result.issues[0].code,'ZIP_TRUSTED_REQUEST_SCHEMA')
  }
  assert.deepEqual(boundary.reads(),[0,0])
})

test('archive bytes are captured before asynchronous authorization resolves',async()=>{
  let release
  const hold=new Promise(resolve=>{release=resolve})
  const mutable=Uint8Array.from(archive)
  const boundary=make({resolvePrincipal:async()=>{await hold;return principal}})
  const pending=boundary.inspect({archive:mutable,sourceId})
  mutable.fill(0)
  release()
  const result=await pending
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  noAuthority(result)
})

test('backend signer configuration cannot be swapped after boundary construction',async()=>{
  const mutable={...trust}
  const boundary=make({key:mutable})
  const attacker=generateKeyPairSync('ed25519')
  mutable.publicKey=attacker.publicKey
  mutable.pinnedSpkiSha256=createHash('sha256')
    .update(attacker.publicKey.export({format:'der',type:'spki'})).digest('hex')
  const result=await boundary.inspect({archive,sourceId})
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  noAuthority(result)
})

test('separately resolved approval signature from a different signer fails closed',async()=>{
  const attacker=generateKeyPairSync('ed25519')
  const forged={...approval,signatureBase64:sign(null,Buffer.from(draft.payload),
    attacker.privateKey).toString('base64')}
  const result=await expectBlocked(make({record:{...snapshot,approval:forged}}).inspect)
  assert(result.issues.some(issue=>issue.code.startsWith('SIGNED_BASELINE_')),
    JSON.stringify(result.issues))
})

test('authorized snapshot store failure never creates local acceptance',async()=>{
  const boundary=make({resolveAuthorizedSnapshot:async()=>{throw Error('transaction unavailable')}})
  const result=await expectBlocked(boundary.inspect)
  assert.equal(result.issues[0].code,'ZIP_TRUSTED_RESOLUTION_FAILED')
})

test('untrusted nested source accessor is rejected without being invoked before receiving clone',async()=>{
  let invoked=0
  const malicious=structuredClone(project)
  Object.defineProperty(malicious,'unexpected',{enumerable:true,get(){invoked++;return 'side effect'}})
  const result=await expectBlocked(make({record:{...snapshot,project:malicious}}).inspect)
  assert.equal(result.issues[0].code,'ZIP_TRUSTED_RESOLUTION_FAILED')
  assert.equal(invoked,0,'backend snapshot traversal must not execute nested getters')
})

test('cumulative source metadata beyond receiver budget is rejected before full clone',async()=>{
  const excessive={...project,untrustedDescription:'x'.repeat(6_100_000)}
  const result=await expectBlocked(make({record:{...snapshot,project:excessive}}).inspect)
  assert.equal(result.issues[0].code,'ZIP_TRUSTED_RESOLUTION_FAILED')
})

test('cyclic authorized approval metadata is rejected before isolated worker admission',async()=>{
  const cyclic={...approval}
  cyclic.self=cyclic
  const result=await expectBlocked(make({record:{...snapshot,approval:cyclic}}).inspect)
  assert.equal(result.issues[0].code,'ZIP_TRUSTED_RESOLUTION_FAILED')
})

test('authenticated principal and atomic snapshot share an un-aborted cancellation signal on valid 503-file receiving',async()=>{
  let principalSignal,transactionSignal
  const boundary=make({
    resolvePrincipal:async({signal})=>{
      principalSignal=signal
      assert.equal(signal.aborted,false)
      return principal
    },
    resolveAuthorizedSnapshot:async(args,{signal})=>{
      transactionSignal=signal
      assert.equal(signal.aborted,false)
      assert.equal(args.sourceId,sourceId)
      return snapshot
    }
  })
  const result=await boundary.inspect({archive,sourceId})
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  assert.equal(principalSignal,transactionSignal)
  assert.equal(transactionSignal.aborted,false)
  assert.equal(result.rows.length,6*project.pieces.length)
  noAuthority(result)
})

test('authorized atomic transaction receives deadline abort and cannot create late CAD acceptance',async()=>{
  let transactionSignal,transactionStarted=0
  const boundary=make({
    resolvePrincipal:async()=>principal,
    resolveAuthorizedSnapshot:async(args,{signal})=>{
      transactionStarted++
      assert.equal(args.sourceId,sourceId)
      transactionSignal=signal
      return new Promise(()=>{})
    }
  })
  const result=await expectBlocked(boundary.inspect)
  assert.equal(result.issues[0].code,'ZIP_TRUSTED_RESOLUTION_FAILED')
  assert.equal(transactionStarted,1)
  assert.equal(transactionSignal.aborted,true)
  noAuthority(result)
})
