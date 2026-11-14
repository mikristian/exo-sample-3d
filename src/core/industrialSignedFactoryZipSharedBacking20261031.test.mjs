import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,generateKeyPairSync,sign} from 'node:crypto'
import {runInNewContext} from 'node:vm'
import {zipSync} from 'fflate'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createApprovedGradedNotchGeometryDraft20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {createTrustedFactoryZipReceivingBoundary20261031} from './industrialSignedFactoryZipTrustedBoundary20261031.mjs'

// Disposable factory receiving fixture: no third-party CAD, cutter or sewn
// sample approval is inferred from a locally signed test package.
const project=createTeeTemplate()
for(let i=0;i<17;i++){
  const id=`shared-backing-test-${i}`
  project.fabrics[id]={...structuredClone(project.fabrics.main),id,name:`Disposable ${i}`}
  project.pieces.push({id,name:`Disposable Panel ${i}`,fabricId:id,
    points:[{x:100+i*40,y:100},{x:112+i*40,y:100},
      {x:112+i*40,y:112},{x:100+i*40,y:112}],
    curves:{},notches:[],seamAllowance:1,layout2d:{x:100+i*40,y:100}})
}
const files=buildFactoryPackageFiles(project)
assert.equal(Object.keys(files).length,503)
const archive=zipSync(files,{level:6})
const sourceId='shared-backing-disposable:rev-01'
const sourceRevision='shared-backing-source-revision-01'
const keys=generateKeyPairSync('ed25519')
const draft=createApprovedGradedNotchGeometryDraft20261023(project,sourceRevision)
const approval={manifest:draft.manifest,sha256:draft.sha256,
  signatureBase64:sign(null,Buffer.from(draft.payload),keys.privateKey).toString('base64')}
const trustedKeyConfig={publicKey:keys.publicKey,
  pinnedSpkiSha256:createHash('sha256').update(
    keys.publicKey.export({format:'der',type:'spki'})).digest('hex')}
let sourceReads=0,approvalReads=0
const inspect=createTrustedFactoryZipReceivingBoundary20261031({
  trustedKeyConfig,
  resolveSource:async()=>{sourceReads++;return {project,sourceRevision}},
  resolveApproval:async()=>{approvalReads++;return approval},
})
const noAuthority=result=>{
  for(const key of ['independentlyReceived','licensedReceiverCadAccepted',
    'physicalNotchStationsCertified','physicalCuttingAuthorized',
    'factoryCertified','bulkProductionAuthorized'])
    assert.equal(result[key],false,key)
}

test('trusted ZIP intake rejects same-realm shared Uint8Array before backend lookup',async()=>{
  const shared=new SharedArrayBuffer(archive.length)
  new Uint8Array(shared).set(archive)
  const result=await inspect({archive:new Uint8Array(shared),sourceId})
  assert.equal(result.status,'BLOCKED')
  assert.equal(result.issues[0].code,'ZIP_TRUSTED_SHARED_ARCHIVE')
  assert.equal(sourceReads,0)
  assert.equal(approvalReads,0)
  noAuthority(result)
})

test('trusted ZIP intake rejects shared Buffer and cross-realm shared backing',async()=>{
  const shared=new SharedArrayBuffer(archive.length)
  new Uint8Array(shared).set(archive)
  const buffer=Buffer.from(shared)
  const first=await inspect({archive:buffer,sourceId})
  assert.equal(first.issues[0].code,'ZIP_TRUSTED_SHARED_ARCHIVE')
  const foreign=runInNewContext('new SharedArrayBuffer(size)',{size:archive.length})
  new Uint8Array(foreign).set(archive)
  const second=await inspect({archive:new Uint8Array(foreign),sourceId})
  assert.equal(second.issues[0].code,'ZIP_TRUSTED_SHARED_ARCHIVE')
  assert.equal(sourceReads,0)
  assert.equal(approvalReads,0)
  noAuthority(first)
  noAuthority(second)
})

test('ordinary Buffer retains 503-file six-size local signed inspection without CUT approval',async()=>{
  const result=await inspect({archive:Buffer.from(archive),sourceId})
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',
    JSON.stringify(result.issues))
  assert.equal(result.rows.length,6*project.pieces.length)
  assert.equal(result.rows.reduce((n,row)=>n+row.expectedMarks,0),72)
  assert.equal(sourceReads,1)
  assert.equal(approvalReads,1)
  noAuthority(result)
})
