import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,generateKeyPairSync,sign} from 'node:crypto'
import {zipSync,strToU8} from 'fflate'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createApprovedGradedNotchGeometryDraft20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {inspectSignedFactoryZipHandoff20261030} from './industrialSignedFactoryZipReceiving20261030.mjs'

// Disposable local source/signing keys: NOT a third-party receiver attestation.
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
const archive=zipSync(files,{level:6})
const sourceRevision='disposable-raw-zip-receiving-six-size-18-fabric'
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
const inspect=(bytes,opts=options)=>inspectSignedFactoryZipHandoff20261030(project,bytes,opts)
const expectBlocked=(bytes,code)=>{
  const result=inspect(bytes)
  assert.equal(result.status,'BLOCKED',JSON.stringify(result.issues))
  assert(result.issues.some(issue=>issue.code===code),JSON.stringify(result.issues))
  assert.equal(result.physicalCuttingAuthorized,false)
  assert.equal(result.licensedReceiverCadAccepted,false)
}
const zipDirectory=bytes=>{
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
  let eocd=-1
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-22-65535);i--){
    if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===bytes.length){
      eocd=i;break
    }
  }
  assert(eocd>=0)
  const entries=[]
  let at=v.getUint32(eocd+16,true)
  for(let i=0;i<v.getUint16(eocd+10,true);i++){
    const nameLength=v.getUint16(at+28,true)
    const name=new TextDecoder().decode(bytes.subarray(at+46,at+46+nameLength))
    entries.push({at,name,local:v.getUint32(at+42,true),
      compressed:v.getUint32(at+20,true),expanded:v.getUint32(at+24,true)})
    at+=46+nameLength+v.getUint16(at+30,true)+v.getUint16(at+32,true)
  }
  return entries
}

test('real six-size 18-fabric 503-file ZIP passes bounded raw archive receiving inspection only',()=>{
  assert.equal(project.grading.sizes.length,6)
  assert.equal(Object.keys(files).length,503)
  assert.equal(zipDirectory(archive).length,503)
  const result=inspect(archive)
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  assert.equal(result.rows.length,6*project.pieces.length)
  assert.equal(result.rows.reduce((sum,row)=>sum+row.expectedMarks,0),72)
  assert.equal(result.independentlyReceived,false)
  assert.equal(result.physicalCuttingAuthorized,false)
  assert.equal(result.factoryCertified,false)
})

test('the same 503-file source remains compatible with uncompressed STORE ZIP members',()=>{
  const stored=zipSync(files,{level:0})
  assert.equal(zipDirectory(stored).length,503)
  const result=inspect(stored)
  assert.equal(result.status,'LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH',JSON.stringify(result.issues))
  assert.equal(result.physicalCuttingAuthorized,false)
})

test('duplicate ZIP names cannot collapse into a single post-extraction map key',()=>{
  const copy=zipSync({'aa.dxf':strToU8('a'),'bb.dxf':strToU8('b')},{level:0})
  const matches=[]
  for(let i=0;i<=copy.length-6;i++){
    if(new TextDecoder().decode(copy.subarray(i,i+6))==='bb.dxf')matches.push(i)
  }
  assert.equal(matches.length,2,'local and central ZIP names must both be present')
  for(const at of matches)copy.set(strToU8('aa.dxf'),at)
  expectBlocked(copy,'ZIP_METADATA_PATH_DUPLICATE')
})

test('declared uncompressed member above 32 MB is blocked before inflation',()=>{
  const copy=zipSync({'aa.dxf':strToU8('small compressed garment fixture'),
    'bb.dxf':strToU8('b'),'cc.dxf':strToU8('c'),'dd.dxf':strToU8('d')},{level:6})
  const {at,local}=zipDirectory(copy).find(entry=>entry.name==='aa.dxf')
  const v=new DataView(copy.buffer,copy.byteOffset,copy.byteLength)
  assert.equal(v.getUint16(at+10,true),8,'test must exercise DEFLATE')
  v.setUint32(at+24,32_000_001,true)
  v.setUint32(local+22,32_000_001,true)
  expectBlocked(copy,'ZIP_DECLARED_EXPANSION_BUDGET')
})

test('extreme expansion ratio is blocked before decompressing a ZIP bomb',()=>{
  const bomb=zipSync({'patterns/bomb.dxf':new Uint8Array(2_000_000),
    'bb.dxf':strToU8('b'),'cc.dxf':strToU8('c'),'dd.dxf':strToU8('d')},{level:9})
  const entry=zipDirectory(bomb).find(item=>item.name==='patterns/bomb.dxf')
  assert(entry.expanded>entry.compressed*1000,'fixture must exceed the ratio limit')
  expectBlocked(bomb,'ZIP_EXPANSION_RATIO_BUDGET')
})

test('declared aggregate output above 100 MB is blocked even when every member is individually under 32 MB',()=>{
  const names=['aa.dxf','bb.dxf','cc.dxf','dd.dxf']
  const noise=new Uint8Array(60_000)
  let state=0x12345678
  for(let i=0;i<noise.length;i++){
    state^=state<<13;state^=state>>>17;state^=state<<5
    noise[i]=state&255
  }
  const copy=zipSync(Object.fromEntries(names.map(name=>[name,noise])),{level:6})
  const v=new DataView(copy.buffer,copy.byteOffset,copy.byteLength)
  for(const {at,local} of zipDirectory(copy)){
    assert(v.getUint32(at+20,true)>25_001,'fixture must remain below 1000x expansion')
    v.setUint32(at+24,25_000_001,true)
    v.setUint32(local+22,25_000_001,true)
  }
  expectBlocked(copy,'ZIP_DECLARED_EXPANSION_BUDGET')
})

test('corrupted ZIP CRC cannot pass with an otherwise unchanged signed source',()=>{
  const copy=Uint8Array.from(archive)
  const [{at,local}]=zipDirectory(copy)
  const v=new DataView(copy.buffer,copy.byteOffset,copy.byteLength)
  assert.notEqual(v.getUint32(at+16,true),0)
  v.setUint32(at+16,0,true)
  v.setUint32(local+14,0,true)
  expectBlocked(copy,'ZIP_EXTRACTED_CRC_MISMATCH')
})

test('raw ZIP inspection does not replace independently pinned source-revision trust',()=>{
  const result=inspect(archive,{...options,sourceRevision:'different-disposable-revision'})
  assert.equal(result.status,'BLOCKED')
  assert(result.issues.some(issue=>issue.code.startsWith('SIGNED_BASELINE_')))
  assert.equal(result.factoryCertified,false)
})
