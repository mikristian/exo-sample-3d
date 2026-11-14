import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,generateKeyPairSync,sign} from 'node:crypto'
import {zipSync,strToU8} from 'fflate'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createApprovedGradedNotchGeometryDraft20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {createTrustedFactoryZipReceivingBoundary20261031 as createBoundary} from './industrialSignedFactoryZipTrustedBoundary20261031.mjs'

// All records are disposable in-memory stand-ins for separately controlled
// backend records. Their signatures are NOT external receiving-CAD evidence.
const project=createTeeTemplate()
const files=buildFactoryPackageFiles(project)
const archive=zipSync(files,{level:6})
const sourceId='disposable-tee:revision-01'
const sourceRevision='disposable-backend-pinned-revision-01'
const keys=generateKeyPairSync('ed25519')
const attacker=generateKeyPairSync('ed25519')
const draft=createApprovedGradedNotchGeometryDraft20261023(project,sourceRevision)
assert.equal(draft.status,'draft_for_external_review')
const pin=key=>createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex')
const trust={publicKey:keys.publicKey,pinnedSpkiSha256:pin(keys.publicKey)}
const approval={manifest:draft.manifest,sha256:draft.sha256,
  signatureBase64:sign(null,Buffer.from(draft.payload),keys.privateKey).toString('base64')}
const make=({source={project,sourceRevision},signedApproval=approval,key=trust}={})=>{
  let sourceReads=0,approvalReads=0
  const inspect=createBoundary({trustedKeyConfig:key,
    resolveSource:async id=>{sourceReads++;assert.equal(id,sourceId);return source},
    resolveApproval:async id=>{approvalReads++;assert.equal(id,sourceId);return signedApproval}})
  return {inspect,reads:()=>[sourceReads,approvalReads]}
}
const noAuthority=result=>{
  for(const key of ['independentlyReceived','licensedReceiverCadAccepted',
    'physicalNotchStationsCertified','physicalCuttingAuthorized','factoryCertified',
    'bulkProductionAuthorized'])assert.equal(result[key],false,key)
}

test('trusted backend source, pinned signer and six-size exporter ZIP pass local inspection only',async()=>{
  const boundary=make()
  const result=await boundary.inspect({archive,sourceId})
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  assert.equal(result.rows.length,6*project.pieces.length)
  assert.deepEqual(boundary.reads(),[1,1])
  noAuthority(result)
})

test('mutable browser ZIP is snapshotted before asynchronous trusted record lookup',async()=>{
  const mutable=Uint8Array.from(archive)
  let release
  const lookup=new Promise(resolve=>{release=resolve})
  const inspect=createBoundary({trustedKeyConfig:trust,
    resolveSource:async()=>{await lookup;return {project,sourceRevision}},
    resolveApproval:async()=>approval})
  const pending=inspect({archive:mutable,sourceId})
  mutable.fill(0)
  release()
  const result=await pending
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  noAuthority(result)
})

test('browser-supplied signer, approval, source revision or factory claims are rejected before record reads',async()=>{
  const boundary=make()
  for(const claim of [
    {trustedKeyConfig:{publicKey:attacker.publicKey,pinnedSpkiSha256:pin(attacker.publicKey)}},
    {approval:{signatureBase64:'forged'}},
    {sourceRevision:'self-attested'},
    {physicalCuttingAuthorized:true},
    {licensedReceiverCadAccepted:true},
  ]){
    const result=await boundary.inspect({archive,sourceId,...claim})
    assert.equal(result.issues[0]?.code,'ZIP_TRUSTED_REQUEST_SCHEMA')
    noAuthority(result)
  }
  assert.deepEqual(boundary.reads(),[0,0])
})

test('request getters and malformed source IDs fail closed without executing getters',async()=>{
  const boundary=make()
  let called=0
  const malicious={sourceId}
  Object.defineProperty(malicious,'archive',{enumerable:true,get(){called++;throw Error('executed')}})
  const result=await boundary.inspect(malicious)
  assert.equal(result.issues[0]?.code,'ZIP_TRUSTED_RESOLUTION_FAILED')
  assert.equal(called,0)
  const bad=await boundary.inspect({archive,sourceId:'../untrusted'})
  assert.equal(bad.issues[0]?.code,'ZIP_TRUSTED_SOURCE_ID')
  assert.deepEqual(boundary.reads(),[0,0])
  noAuthority(result)
  noAuthority(bad)
})

test('typed-array subclass accessors cannot execute during archive snapshot',async()=>{
  let called=0
  class MaliciousBytes extends Uint8Array{
    get byteLength(){called++;throw Error('executed byteLength getter')}
    [Symbol.iterator](){called++;throw Error('executed iterator')}
  }
  const boundary=make()
  const result=await boundary.inspect({archive:new MaliciousBytes(archive),sourceId})
  assert.equal(result.issues[0]?.code,'ZIP_TRUSTED_ARCHIVE_BUDGET')
  assert.equal(called,0)
  assert.deepEqual(boundary.reads(),[0,0])
  noAuthority(result)
})

test('own typed-array byteLength and iterator overrides cannot alter inspected ZIP bytes',async()=>{
  let called=0
  const mutable=Uint8Array.from(archive)
  Object.defineProperty(mutable,'byteLength',{get(){called++;throw Error('own getter executed')}})
  Object.defineProperty(mutable,Symbol.iterator,{value(){called++;throw Error('own iterator executed')}})
  const result=await make().inspect({archive:mutable,sourceId})
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  assert.equal(called,0)
  noAuthority(result)
})

test('independently configured key pin mismatch cannot create receiving boundary',()=>{
  assert.throws(()=>make({key:{publicKey:attacker.publicKey,pinnedSpkiSha256:trust.pinnedSpkiSha256}}),
    /key\/pin mismatch/)
  assert.throws(()=>make({key:{publicKey:keys.publicKey,pinnedSpkiSha256:'x'}}),
    /Ed25519 pin required/)
})

test('forged KeyObject shape and constructor getters cannot choose trusted signer',()=>{
  let called=0
  const fake={get type(){called++;return 'public'},
    asymmetricKeyType:'ed25519',export(){called++;return keys.publicKey.export({format:'der',type:'spki'})}}
  assert.throws(()=>make({key:{publicKey:fake,pinnedSpkiSha256:pin(keys.publicKey)}}),
    /public key format required/)
  assert.equal(called,0)
  const config={resolveSource:async()=>({project,sourceRevision}),
    trustedKeyConfig:trust}
  Object.defineProperty(config,'resolveApproval',{enumerable:true,get(){called++;throw Error('executed')}})
  assert.throws(()=>createBoundary(config),/missing data property/)
  assert.equal(called,0)
})

test('attacker-signed replacement approval fails against backend-pinned signer',async()=>{
  const forged={...approval,signatureBase64:sign(null,Buffer.from(draft.payload),
    attacker.privateKey).toString('base64')}
  const result=await make({signedApproval:forged}).inspect({archive,sourceId})
  assert.equal(result.status,'BLOCKED')
  assert(result.issues.some(issue=>issue.code.startsWith('SIGNED_BASELINE_')),
    JSON.stringify(result.issues))
  noAuthority(result)
})

test('mismatched backend source revision and forged ZIP receiver approval both fail closed',async()=>{
  const revisionResult=await make({source:{project,sourceRevision:'different-backend-revision'}})
    .inspect({archive,sourceId})
  assert.equal(revisionResult.status,'BLOCKED')
  noAuthority(revisionResult)
  const forgedZip=zipSync({...files,'receiver-cad-acceptance.json':strToU8(
    '{"licensedReceiverCadAccepted":true,"physicalCuttingAuthorized":true}')},{level:6})
  const zipResult=await make().inspect({archive:forgedZip,sourceId})
  assert.equal(zipResult.status,'BLOCKED')
  noAuthority(zipResult)
})

test('backend resolver failures never produce local acceptance',async()=>{
  const boundary=createBoundary({trustedKeyConfig:trust,
    resolveSource:async()=>{throw Error('offline record store')},
    resolveApproval:async()=>approval})
  const result=await boundary({archive,sourceId})
  assert.equal(result.issues[0]?.code,'ZIP_TRUSTED_RESOLUTION_FAILED')
  noAuthority(result)
})
