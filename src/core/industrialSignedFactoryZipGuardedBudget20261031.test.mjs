import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,generateKeyPairSync,sign} from 'node:crypto'
import {zipSync,strToU8} from 'fflate'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createApprovedGradedNotchGeometryDraft20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {auditFactoryZipResourceThenCrc20261024_0600} from './factoryZipResourceBudget20261024_0600.mjs'
import {inspectSignedFactoryZipHandoffIsolated20261030 as inspect} from './industrialSignedFactoryZipIsolated20261030.mjs'

// Disposable, locally signed source; never receiving-CAD or physical CUT approval.
const project=createTeeTemplate()
const files=buildFactoryPackageFiles(project)
const revision='disposable-guarded-budget-20261031'
const keys=generateKeyPairSync('ed25519')
const draft=createApprovedGradedNotchGeometryDraft20261023(project,revision)
assert.equal(draft.status,'draft_for_external_review')
const options={
  sourceRevision:revision,
  approval:{manifest:draft.manifest,sha256:draft.sha256,
    signatureBase64:sign(null,Buffer.from(draft.payload),keys.privateKey).toString('base64')},
  trustedKeyConfig:{publicKey:keys.publicKey,pinnedSpkiSha256:createHash('sha256')
    .update(keys.publicKey.export({format:'der',type:'spki'})).digest('hex')},
}
const noRelease=result=>{
  assert.equal(result.status,'BLOCKED')
  assert.equal(result.independentlyReceived,false)
  assert.equal(result.licensedReceiverCadAccepted,false)
  assert.equal(result.physicalCuttingAuthorized,false)
  assert.equal(result.factoryCertified,false)
  assert.equal(result.bulkProductionAuthorized,false)
}
const randomBytes=size=>{
  const bytes=new Uint8Array(size)
  let state=0x12345678
  for(let i=0;i<size;i++){
    state^=state<<13;state^=state>>>17;state^=state<<5
    bytes[i]=state&255
  }
  return bytes
}

test('signed isolated receiver accepts genuine guarded-size factory ZIP without CUT approval',async()=>{
  const archive=zipSync(files,{level:6})
  assert.equal(auditFactoryZipResourceThenCrc20261024_0600(archive).ok,true)
  const result=await inspect(project,archive,options)
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  assert.equal(result.licensedReceiverCadAccepted,false)
  assert.equal(result.physicalCuttingAuthorized,false)
})

test('100x guarded ZIP expansion ceiling is enforced before signed receiving',async()=>{
  const archive=zipSync({...files,'markers/extra.svg':new Uint8Array(2*1024*1024)},{level:6})
  assert.equal(auditFactoryZipResourceThenCrc20261024_0600(archive).diagnostics[0].code,'RESOURCE_EXPANSION_RATIO')
  const result=await inspect(project,archive,options)
  noRelease(result)
  assert.equal(result.issues[0].code,'ZIP_GUARDED_RESOURCE_EXPANSION_RATIO')
})

test('4 MiB guarded entry limit is enforced before signed receiving',async()=>{
  const archive=zipSync({...files,'markers/extra.svg':randomBytes(5*1024*1024)},{level:0})
  assert.equal(auditFactoryZipResourceThenCrc20261024_0600(archive).diagnostics[0].code,'RESOURCE_ENTRY_SIZE_BUDGET')
  const result=await inspect(project,archive,options)
  noRelease(result)
  assert.equal(result.issues[0].code,'ZIP_GUARDED_RESOURCE_ENTRY_SIZE_BUDGET')
})

test('16 MiB guarded aggregate limit is enforced before signed receiving',async()=>{
  const expanded=new Uint8Array(3584*1024)
  const seed=randomBytes(expanded.length/64)
  for(let i=0;i<seed.length;i++)expanded[i*64]=seed[i]
  const extras=Object.fromEntries(Array.from({length:5},(_,i)=>[`markers/extra-${i}.svg`,expanded]))
  const archive=zipSync({...files,...extras},{level:6})
  assert.equal(auditFactoryZipResourceThenCrc20261024_0600(archive).diagnostics[0].code,'RESOURCE_TOTAL_BUDGET')
  const result=await inspect(project,archive,options)
  noRelease(result)
  assert.equal(result.issues[0].code,'ZIP_GUARDED_RESOURCE_TOTAL_BUDGET')
})

test('guarded CRC rejection occurs before signed source parity',async()=>{
  const archive=zipSync(files,{level:0})
  const damaged=Uint8Array.from(archive)
  const view=new DataView(damaged.buffer,damaged.byteOffset,damaged.byteLength)
  const dataStart=30+view.getUint16(26,true)+view.getUint16(28,true)
  damaged[dataStart]^=1
  assert.equal(auditFactoryZipResourceThenCrc20261024_0600(damaged).diagnostics[0].code,'CRC_MISMATCH')
  const result=await inspect(project,damaged,options)
  noRelease(result)
  assert.equal(result.issues[0].code,'ZIP_GUARDED_CRC_MISMATCH')
})

test('recomputed valid ZIP CRC cannot conceal modified graded XL notch geometry',async()=>{
  const path='tee-development/neckband-proposal-xl.dxf'
  const original=new TextDecoder().decode(files[path])
  assert(original.includes('\n10\n0\n20\n0\n'))
  const altered=original.replace('\n10\n0\n20\n0\n','\n10\n1.5\n20\n0\n')
  assert.notEqual(createHash('sha256').update(altered).digest('hex'),
    createHash('sha256').update(files[path]).digest('hex'))
  const archive=zipSync({...files,[path]:strToU8(altered)},{level:6})
  // ZIP metadata, CRC and guarded resource limits are all internally valid.
  assert.equal(auditFactoryZipResourceThenCrc20261024_0600(archive).ok,true)
  const result=await inspect(project,archive,options)
  noRelease(result)
  assert(result.issues.some(issue=>issue.code==='PACKAGE_FILE_HASH_OR_SIZE_MISMATCH'&&issue.scope===path),
    JSON.stringify(result.issues))
})

test('oversized compressed input is refused by parent before child IPC allocation',async()=>{
  const tooLarge=new Uint8Array(16*1024*1024+1)
  const result=await inspect(project,tooLarge,options)
  noRelease(result)
  assert.equal(result.issues[0].code,'ZIP_ISOLATED_ARCHIVE_BUDGET')
})
