import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {auditFactoryPackageManifest20261024_0000 as nodeAudit} from './factoryPackageManifestAudit20261024_0000.mjs'
import {auditFactoryPackageManifestBrowser20261024_0053 as browserAudit} from './factoryPackageManifestBrowser20261024_0053.mjs'

// Disposable XS–XXL exporter fixture. No real production or receiver approval.
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
const original=buildFactoryPackageFiles(project)
const encoder=new TextEncoder()
const decode=bytes=>JSON.parse(new TextDecoder().decode(bytes))
const audits=[['node',nodeAudit],['browser',browserAudit]]
const assertBlocked=(files,code,expected=project)=>{
  for(const [name,audit] of audits){
    const result=audit(files,expected)
    assert.equal(result.ok,false,`${name}: unexpectedly accepted`)
    assert(result.diagnostics.some(d=>d.code===code),`${name}: ${JSON.stringify(result.diagnostics)}`)
    assert.equal(result.manufacturingApproved,false)
  }
}
function rehash(files){
  const manifest=decode(files['manifest.json'])
  const paths=Object.keys(files).filter(path=>path!=='manifest.json').sort()
  manifest.files=[...paths,'manifest.json'].sort()
  manifest.sha256=Object.fromEntries(paths.map(path=>[path,createHash('sha256').update(files[path]).digest('hex')]))
  files['manifest.json']=encoder.encode(JSON.stringify(manifest))
  return files
}

test('real exporter 18-fabric, six-size, 503-file package passes both manifest audits without CUT approval',()=>{
  assert.equal(project.grading.sizes.length,6)
  assert.equal(new Set(project.pieces.map(piece=>piece.fabricId)).size,18)
  assert.equal(Object.keys(original).length,503)
  assert(Object.values(original).reduce((sum,bytes)=>sum+bytes.byteLength,0)<40*1024*1024)
  for(const [name,audit] of audits){
    const result=audit(original,project)
    assert.equal(result.ok,true,`${name}: ${JSON.stringify(result.diagnostics)}`)
    assert.equal(result.manufacturingApproved,false)
  }
})

test('1,025 entries remain refused even with a self-consistent rehashed manifest',()=>{
  const files={...original}
  const additions=1025-Object.keys(files).length
  for(let i=0;i<additions;i++)files[`disposable-extra/${String(i).padStart(4,'0')}.txt`]=encoder.encode('x')
  assert.equal(Object.keys(files).length,1025)
  assertBlocked(rehash(files),'FILE_COUNT')
})

test('exactly 1,024 entries remain inside count bound but a tampered hash still blocks',()=>{
  const files={...original}
  const additions=1024-Object.keys(files).length
  for(let i=0;i<additions;i++)files[`disposable-extra/${String(i).padStart(4,'0')}.txt`]=encoder.encode('x')
  rehash(files)
  assert.equal(Object.keys(files).length,1024)
  const marker=Object.keys(files).find(p=>p.startsWith('markers/')&&p.includes('stress-16-xxl.svg'))
  assert(marker)
  files[marker]=encoder.encode('tampered after hashing')
  for(const [name,audit] of audits){
    const result=audit(files,project)
    assert.equal(result.ok,false,name)
    assert(result.diagnostics.some(d=>d.code==='HASH_MISMATCH'),name)
    assert(!result.diagnostics.some(d=>d.code==='FILE_COUNT'),name)
  }
})

test('a 503-file package with a modified XXL marker is rejected by both SHA-256 audits',()=>{
  const path=Object.keys(original).find(p=>p.startsWith('markers/')&&p.includes('stress-16-xxl.svg'))
  assert(path,'expected non-base-size marker')
  const files={...original,[path]:encoder.encode(new TextDecoder().decode(original[path]).replace('<svg','<svg data-tampered="1"'))}
  assertBlocked(files,'HASH_MISMATCH')
})

test('case-aliased factory path is refused even below 1,024 entries',()=>{
  const files={...original,'README.TXT':encoder.encode('alias')}
  assertBlocked(files,'DUPLICATE_PATH')
})

test('a 503-file inventory still refuses oversized file payloads',()=>{
  const files={...original,'garment-source.json':new Uint8Array(8*1024*1024+1)}
  assertBlocked(files,'FILE_BYTES')
})

test('a 503-file rehashed readiness claiming cutting approval remains blocked',()=>{
  const files=rehash({...original,'manufacturing-release-readiness.json':
    encoder.encode(JSON.stringify({factoryCuttingAuthorized:true,manufacturingApproved:true}))})
  assertBlocked(files,'APPROVAL_FLAG')
})

test('self-rehashed source-geometry changes still require trusted expected project',()=>{
  const changed=structuredClone(project)
  changed.pieces[0].points[0].x+=1
  const files=rehash({...original,'garment-source.json':encoder.encode(JSON.stringify(changed))})
  assertBlocked(files,'EXPECTED_PROJECT')
})
