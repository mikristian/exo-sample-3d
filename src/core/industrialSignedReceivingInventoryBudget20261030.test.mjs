import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,generateKeyPairSync,sign} from 'node:crypto'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createApprovedGradedNotchGeometryDraft20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {inspectSignedFactoryNotchHandoff20261030} from './industrialSignedNotchReceivingGate20261030.mjs'

// Disposable, locally generated signatures and garment geometry only. No
// independent receiver approval, cutter clearance, or sewn-sample evidence.
const project=createTeeTemplate()
for(let i=0;i<17;i++){
  const id=`stress-${i}`
  project.fabrics[id]={...structuredClone(project.fabrics.main),id,name:`Disposable Fabric ${i}`}
  project.pieces.push({
    id,name:`Disposable Panel ${i}`,fabricId:id,
    points:[{x:100+i*40,y:100},{x:112+i*40,y:100},
      {x:112+i*40,y:112},{x:100+i*40,y:112}],
    curves:{},notches:[],seamAllowance:1,layout2d:{x:100+i*40,y:100},
  })
}
const files=buildFactoryPackageFiles(project)
const sourceRevision='disposable-18-fabric-six-size-source'
const keys=generateKeyPairSync('ed25519')
const draft=createApprovedGradedNotchGeometryDraft20261023(project,sourceRevision)
assert.equal(draft.status,'draft_for_external_review')
const options={
  approval:{manifest:draft.manifest,sha256:draft.sha256,
    signatureBase64:sign(null,Buffer.from(draft.payload),keys.privateKey).toString('base64')},
  trustedKeyConfig:{publicKey:keys.publicKey,pinnedSpkiSha256:createHash('sha256')
    .update(keys.publicKey.export({format:'der',type:'spki'})).digest('hex')},
  sourceRevision,
}
const inspect=packageFiles=>inspectSignedFactoryNotchHandoff20261030(project,packageFiles,options)
const bytes=text=>new TextEncoder().encode(text)
const rehash=copy=>{
  const manifest=JSON.parse(new TextDecoder().decode(copy['manifest.json']))
  manifest.files=Object.keys(copy).sort()
  manifest.sha256=Object.fromEntries(Object.entries(copy)
    .filter(([name])=>name!=='manifest.json')
    .map(([name,data])=>[name,createHash('sha256').update(data).digest('hex')]))
  copy['manifest.json']=bytes(JSON.stringify(manifest))
  return copy
}
const expectBlocked=(copy,code)=>{
  const result=inspect(copy)
  assert.equal(result.status,'BLOCKED',JSON.stringify(result.issues))
  assert(result.issues.some(issue=>issue.code===code),JSON.stringify(result.issues))
  assert.equal(result.physicalCuttingAuthorized,false)
  assert.equal(result.licensedReceiverCadAccepted,false)
}

test('real exporter: signed 18-fabric, six-size 503-file handoff is not rejected by an arbitrary 500-file cap',()=>{
  assert.equal(project.grading.sizes.length,6)
  assert.equal(new Set(project.pieces.map(piece=>piece.fabricId)).size,18)
  assert.equal(Object.keys(files).length,503)
  assert(Object.values(files).reduce((sum,data)=>sum+data.byteLength,0)<100_000_000)
  const result=inspect(files)
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  assert.equal(result.rows.length,6*project.pieces.length)
  assert(result.rows.every(row=>row.status==='PASS'))
  assert.equal(result.rows.reduce((sum,row)=>sum+row.expectedMarks,0),72)
  assert.equal(result.physicalCuttingAuthorized,false)
  assert.equal(result.independentlyReceived,false)
  assert.equal(result.factoryCertified,false)
})

test('extra self-hashed, allowed-looking grading files exceed authenticated source inventory budget',()=>{
  const extra=rehash({...files,'grading-rules/9999-forged.csv':bytes('forged,approved'),
    'grading-rules/9998-forged.csv':bytes('also forged')})
  expectBlocked(extra,'PACKAGE_FILE_COUNT_EXCEEDS_AUTHENTICATED_SOURCE_BUDGET')
})

test('rehashed replacement of an authentic grading file cannot bypass exact regeneration',()=>{
  const copy={...files}
  const real=Object.keys(copy).find(name=>name.startsWith('grading-rules/'))
  assert(real)
  copy['grading-rules/9999-replacement.csv']=copy[real]
  delete copy[real]
  expectBlocked(rehash(copy),'FACTORY_ARTIFACT_INVENTORY_DIFFERS_FROM_SIGNED_SOURCE')
})

test('rehashed non-base-size multi-fabric marker mutation is rejected despite a valid signed DXF',()=>{
  const marker=Object.keys(files).find(name=>name.startsWith('markers/')&&name.includes('stress-16-xxl.svg'))
  assert(marker,'must exercise an actual non-base-size fabric marker')
  const copy={...files,[marker]:bytes(new TextDecoder().decode(files[marker]).replace('<svg','<svg data-forged="accepted"'))}
  expectBlocked(rehash(copy),'FACTORY_ARTIFACT_DIFFERS_FROM_SIGNED_SOURCE')
})

test('malicious case-alias remains blocked even in a legitimate large factory inventory',()=>{
  const copy=rehash({...files,'README.TXT':bytes('case alias')})
  expectBlocked(copy,'UNSAFE_OR_DUPLICATE_PACKAGE_PATH')
})
