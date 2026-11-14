import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,generateKeyPairSync,sign} from 'node:crypto'
import {zipSync,strToU8} from 'fflate'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createApprovedGradedNotchGeometryDraft20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {inspectSignedFactoryZipHandoffIsolated20261030 as inspect} from './industrialSignedFactoryZipIsolated20261030.mjs'

// Self-signed disposable garment only: no receiving-CAD, physical CUT or factory approval.
const garment=createTeeTemplate()
const files=buildFactoryPackageFiles(garment)
const zip=zipSync(files,{level:6})
const revision='disposable-input-budget-20261031'
const keys=generateKeyPairSync('ed25519')
const draft=createApprovedGradedNotchGeometryDraft20261023(garment,revision)
assert.equal(draft.status,'draft_for_external_review')
const options={sourceRevision:revision,
  approval:{manifest:draft.manifest,sha256:draft.sha256,
    signatureBase64:sign(null,Buffer.from(draft.payload),keys.privateKey).toString('base64')},
  trustedKeyConfig:{publicKey:keys.publicKey,pinnedSpkiSha256:createHash('sha256')
    .update(keys.publicKey.export({format:'der',type:'spki'})).digest('hex')}}
function noAuthorization(result){
  for(const field of ['independentlyReceived','licensedReceiverCadAccepted',
    'physicalNotchStationsCertified','physicalCuttingAuthorized','factoryCertified',
    'bulkProductionAuthorized'])assert.equal(result[field],false,field)
}

test('normal signed disposable garment survives cumulative pre-snapshot budget',async()=>{
  const result=await inspect(garment,zip,options)
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  assert.equal(result.rows.length,6*garment.pieces.length)
  noAuthorization(result)
})

test('repeated individually legal large garment metadata strings fail before IPC snapshot',async()=>{
  const repeated='X'.repeat(750_000)
  const adversarial={...garment,productionNotes:Array(24).fill(repeated)}
  const result=await inspect(adversarial,zip,{...options,timeoutMs:1})
  assert.equal(result.status,'BLOCKED')
  assert.equal(result.issues[0]?.code,'ZIP_ISOLATED_INPUT')
  noAuthorization(result)
})

test('oversized approval metadata is refused before spawning receiving child',async()=>{
  const repeated='A'.repeat(700_000)
  const result=await inspect(garment,zip,{...options,
    approval:{...options.approval,untrustedNotes:Array(20).fill(repeated)},timeoutMs:1})
  assert.equal(result.issues[0]?.code,'ZIP_ISOLATED_INPUT')
  noAuthorization(result)
})

test('large aggregate object property names are budgeted, not only values',async()=>{
  const extra={...garment}
  for(let i=0;i<10;i++)extra[`note-${i}-`+'k'.repeat(690_000)]=i
  const result=await inspect(extra,zip,{...options,timeoutMs:1})
  assert.equal(result.issues[0]?.code,'ZIP_ISOLATED_INPUT')
  noAuthorization(result)
})

test('large optional undefined property names omitted by JSON do not reject valid garment',async()=>{
  const extra={...garment}
  for(let i=0;i<10;i++)extra[`unused-${i}-`+'u'.repeat(690_000)]=undefined
  const result=await inspect(extra,zip,options)
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  noAuthorization(result)
})

test('JSON escape amplification remains blocked by final serialized project budget',async()=>{
  // 4 MB of backslashes expands beyond 6 MB when JSON-escaped. The traversal
  // intentionally counts a lower bound; the exact serialized guard must stay.
  const extra={...garment,productionNotes:Array(5).fill('\\'.repeat(800_000))}
  const result=await inspect(extra,zip,{...options,timeoutMs:1})
  assert.equal(result.status,'BLOCKED')
  assert.equal(result.issues[0]?.code,'ZIP_ISOLATED_PROJECT_BUDGET')
  noAuthorization(result)
})

test('unauthorized fabricated licensed receiving approval remains blocked',async()=>{
  const forged=zipSync({...files,'receiver-cad-acceptance.json':strToU8(
    '{"licensedReceiverCadAccepted":true,"physicalCuttingAuthorized":true}')},{level:6})
  const result=await inspect(garment,forged,options)
  assert.equal(result.status,'BLOCKED')
  noAuthorization(result)
})
