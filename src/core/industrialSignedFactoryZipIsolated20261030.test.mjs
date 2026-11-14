import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,generateKeyPairSync,sign} from 'node:crypto'
import {zipSync,strToU8} from 'fflate'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createApprovedGradedNotchGeometryDraft20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {inspectSignedFactoryZipHandoffIsolated20261030 as inspect} from './industrialSignedFactoryZipIsolated20261030.mjs'

// Local disposable source/key are NOT independent receiving CAD attestations.
const project=createTeeTemplate()
for(let i=0;i<17;i++){
  const id=`isolation-${i}`
  project.fabrics[id]={...structuredClone(project.fabrics.main),id,name:`Disposable ${i}`}
  project.pieces.push({id,name:`Disposable Panel ${i}`,fabricId:id,
    points:[{x:100+i*40,y:100},{x:112+i*40,y:100},
      {x:112+i*40,y:112},{x:100+i*40,y:112}],
    curves:{},notches:[],seamAllowance:1,layout2d:{x:100+i*40,y:100}})
}
const files=buildFactoryPackageFiles(project)
const archive=zipSync(files,{level:6})
const sourceRevision='disposable-isolated-signed-503-file-zip'
const keys=generateKeyPairSync('ed25519')
const draft=createApprovedGradedNotchGeometryDraft20261023(project,sourceRevision)
assert.equal(draft.status,'draft_for_external_review')
const options={
  sourceRevision,
  approval:{manifest:draft.manifest,sha256:draft.sha256,
    signatureBase64:sign(null,Buffer.from(draft.payload),keys.privateKey).toString('base64')},
  trustedKeyConfig:{publicKey:keys.publicKey,pinnedSpkiSha256:createHash('sha256')
    .update(keys.publicKey.export({format:'der',type:'spki'})).digest('hex')},
}
const smallProject=createTeeTemplate()
const smallArchive=zipSync(buildFactoryPackageFiles(smallProject),{level:6})
const smallRevision='disposable-small-isolated-signed-zip'
const smallDraft=createApprovedGradedNotchGeometryDraft20261023(smallProject,smallRevision)
const smallOptions={
  ...options,sourceRevision:smallRevision,
  approval:{manifest:smallDraft.manifest,sha256:smallDraft.sha256,
    signatureBase64:sign(null,Buffer.from(smallDraft.payload),keys.privateKey).toString('base64')},
}
const noRelease=result=>{
  assert.equal(result.independentlyReceived,false)
  assert.equal(result.licensedReceiverCadAccepted,false)
  assert.equal(result.physicalCuttingAuthorized,false)
  assert.equal(result.factoryCertified,false)
  assert.equal(result.bulkProductionAuthorized,false)
}

test('503-file, six-size, 18-fabric signed factory ZIP passes in bounded child only',async()=>{
  assert.equal(Object.keys(files).length,503)
  const result=await inspect(project,archive,options)
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  assert.equal(result.rows.length,6*project.pieces.length)
  assert.equal(result.rows.reduce((sum,row)=>sum+row.expectedMarks,0),72)
  noRelease(result)
})

test('caller event loop remains responsive while child verifies ZIP and signatures',async()=>{
  const pending=inspect(smallProject,smallArchive,smallOptions)
  let ticked=false
  await new Promise(resolve=>setImmediate(()=>{ticked=true;resolve()}))
  assert.equal(ticked,true)
  const result=await pending
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  noRelease(result)
})

test('shared mutable archive is snapshotted before child launch',async()=>{
  const shared=new Uint8Array(new SharedArrayBuffer(smallArchive.length))
  shared.set(smallArchive)
  const pending=inspect(smallProject,shared,smallOptions)
  shared.fill(0)
  assert.equal((await pending).status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH')
  const result=await inspect(smallProject,shared,smallOptions)
  assert.equal(result.status,'BLOCKED')
  noRelease(result)
})

test('project mutation after invocation cannot rewrite child-bound signed source',async()=>{
  const mutable=structuredClone(smallProject)
  const pending=inspect(mutable,smallArchive,smallOptions)
  mutable.pieces[0].points[0].x+=17
  const original=await pending
  assert.equal(original.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(original.issues))
  const changed=await inspect(mutable,smallArchive,smallOptions)
  assert.equal(changed.status,'BLOCKED')
  assert(changed.issues.some(issue=>issue.code.startsWith('SIGNED_BASELINE_')))
  noRelease(changed)
})

test('deadline kills isolated child and never authorizes cutting',async()=>{
  const result=await inspect(project,archive,{...options,timeoutMs:1})
  assert.equal(result.status,'BLOCKED')
  assert.equal(result.issues[0].code,'ZIP_ISOLATED_TIMEOUT')
  noRelease(result)
})

test('invalid source revision cannot be replaced by ZIP-provided self-approval',async()=>{
  const result=await inspect(project,archive,{...options,sourceRevision:'forged-revision'})
  assert.equal(result.status,'BLOCKED')
  assert(result.issues.some(issue=>issue.code.startsWith('SIGNED_BASELINE_')))
  noRelease(result)
})

test('forged extra factory approval artifact is refused inside isolated process',async()=>{
  const forged=zipSync({...files,'receiver-cad-acceptance.json':strToU8('{"approved":true}')},{level:6})
  const result=await inspect(project,forged,options)
  assert.equal(result.status,'BLOCKED')
  noRelease(result)
})

test('project accessors and invalid timeout are rejected without executing getters',async()=>{
  let called=0
  const malicious=Object.create(null)
  Object.defineProperty(malicious,'pieces',{enumerable:true,get(){called++;throw Error('getter')}})
  const blocked=await inspect(malicious,archive,options)
  assert.equal(blocked.issues[0].code,'ZIP_ISOLATED_INPUT')
  assert.equal(called,0)
  assert.equal((await inspect(project,archive,{...options,timeoutMs:0})).issues[0].code,'ZIP_ISOLATED_OPTIONS')
  const maliciousOptions=Object.create(null)
  Object.defineProperty(maliciousOptions,'timeoutMs',{enumerable:true,get(){called++;throw Error('getter')}})
  assert.equal((await inspect(project,archive,maliciousOptions)).issues[0].code,'ZIP_ISOLATED_INPUT')
  assert.equal(called,0)
})

test('8 MiB inflation is refused by stricter guarded 4 MiB member budget in child',async()=>{
  const random=new Uint8Array(64*1024)
  let state=0x12345678
  for(let i=0;i<random.length;i++){
    state^=state<<13;state^=state>>>17;state^=state<<5
    random[i]=state&255
  }
  const inflated=new Uint8Array(8*1024*1024)
  for(let at=0;at<inflated.length;at+=random.length)inflated.set(random,at)
  const forged=zipSync({...buildFactoryPackageFiles(smallProject),
    'markers/unapproved-extra.svg':inflated},{level:6})
  assert(forged.byteLength<32_000_000)
  const result=await inspect(smallProject,forged,smallOptions)
  assert.equal(result.status,'BLOCKED')
  assert(result.issues.some(issue=>issue.code==='ZIP_GUARDED_RESOURCE_ENTRY_SIZE_BUDGET'),
    JSON.stringify(result.issues))
  noRelease(result)
})

test('malformed ZIP is blocked rather than accepted by worker protocol',async()=>{
  const damaged=Uint8Array.from(archive)
  damaged.fill(0,0,16)
  const result=await inspect(project,damaged,options)
  assert.equal(result.status,'BLOCKED')
  noRelease(result)
})
