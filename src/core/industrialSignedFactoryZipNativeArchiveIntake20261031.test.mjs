import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,generateKeyPairSync,sign} from 'node:crypto'
import {zipSync,strToU8} from 'fflate'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createApprovedGradedNotchGeometryDraft20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {inspectSignedFactoryZipHandoffIsolated20261030 as inspect} from './industrialSignedFactoryZipIsolated20261030.mjs'

// Local disposable six-size garment and self-signed draft: NOT independent
// receiving-CAD acceptance, physical cutting authority, or factory release.
const garment=createTeeTemplate()
const files=buildFactoryPackageFiles(garment)
const archive=zipSync(files,{level:6})
const revision='disposable-native-archive-intake-20261031'
const keys=generateKeyPairSync('ed25519')
const draft=createApprovedGradedNotchGeometryDraft20261023(garment,revision)
assert.equal(draft.status,'draft_for_external_review')
assert.equal(garment.grading.sizes.length,6)
const options={sourceRevision:revision,
  approval:{manifest:draft.manifest,sha256:draft.sha256,
    signatureBase64:sign(null,Buffer.from(draft.payload),keys.privateKey).toString('base64')},
  trustedKeyConfig:{publicKey:keys.publicKey,pinnedSpkiSha256:createHash('sha256')
    .update(keys.publicKey.export({format:'der',type:'spki'})).digest('hex')}}
const noAuthority=result=>{
  for(const key of ['independentlyReceived','licensedReceiverCadAccepted',
    'physicalNotchStationsCertified','physicalCuttingAuthorized',
    'factoryCertified','bulkProductionAuthorized'])assert.equal(result[key],false,key)
}
const poisonOwnAccessors=value=>{
  let called=0
  for(const key of ['byteLength','length','buffer','byteOffset',Symbol.iterator]){
    Object.defineProperty(value,key,{configurable:true,get(){called++;throw Error('untrusted archive accessor')}})
  }
  return ()=>called
}

test('genuine signed disposable garment ignores poisoned own byte/iterator accessors',async()=>{
  const supplied=Uint8Array.from(archive)
  const calls=poisonOwnAccessors(supplied)
  const result=await inspect(garment,supplied,options)
  assert.equal(calls(),0,'archive accessors must never execute')
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  assert.equal(result.rows.length,garment.grading.sizes.length*garment.pieces.length)
  noAuthority(result)
})

test('native Buffer with poisoned own accessors remains a valid signed input',async()=>{
  const supplied=Buffer.from(archive)
  const calls=poisonOwnAccessors(supplied)
  const result=await inspect(garment,supplied,options)
  assert.equal(calls(),0)
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  noAuthority(result)
})

test('subclass overriding archive byte length is refused before child admission',async()=>{
  let called=0
  class ForgedArchive extends Uint8Array{
    get byteLength(){called++;return 22}
    get length(){called++;throw Error('subclass length')}
  }
  const supplied=new ForgedArchive(archive)
  const result=await inspect(garment,supplied,options)
  assert.equal(result.issues[0]?.code,'ZIP_ISOLATED_ARCHIVE_BUDGET')
  assert.equal(called,0)
  noAuthority(result)
})

test('real 16 MiB archive budget cannot be hidden by forged byteLength',async()=>{
  const supplied=new Uint8Array(16*1024*1024+1)
  let called=0
  Object.defineProperty(supplied,'byteLength',{get(){called++;return 22}})
  const result=await inspect(garment,supplied,options)
  assert.equal(result.issues[0]?.code,'ZIP_ISOLATED_ARCHIVE_BUDGET')
  assert.equal(called,0)
  noAuthority(result)
})

test('proxied typed arrays cannot impersonate native byte storage',async()=>{
  let called=0
  const proxy=new Proxy(Uint8Array.from(archive),{get(){called++;throw Error('proxy getter')}})
  const result=await inspect(garment,proxy,options)
  assert.equal(result.issues[0]?.code,'ZIP_ISOLATED_INPUT')
  assert.equal(called,0)
  noAuthority(result)
})

test('native snapshot still rejects fabricated receiving-CAD and CUT claims',async()=>{
  const forged=zipSync({...files,'receiver-approval.json':strToU8(
    '{"licensedReceiverCadAccepted":true,"physicalCuttingAuthorized":true}')},{level:6})
  const supplied=Uint8Array.from(forged)
  const calls=poisonOwnAccessors(supplied)
  const result=await inspect(garment,supplied,options)
  assert.equal(calls(),0)
  assert.equal(result.status,'BLOCKED')
  noAuthority(result)
})
