import test from 'node:test'
import assert from 'node:assert/strict'
import {zipSync, unzipSync, strToU8} from 'fflate'
import {createTeeTemplate} from '../data/templates.js'
import {buildFactoryPackageFiles, buildFactoryPackageZip} from './factoryPackage.js'
import {recoverFactorySourceFromZip} from './factorySourceRecovery.js'

// Disposable six-size, eighteen-fabric garment matching the real exporter
// inventory stress fixture. No actual factory or third-party approval data.
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

test('real exporter: 503-file six-size eighteen-fabric ZIP recovers source without factory authorization',()=>{
  const original=structuredClone(project)
  const files=buildFactoryPackageFiles(project)
  assert.equal(project.grading.sizes.length,6)
  assert.equal(new Set(project.pieces.map(p=>p.fabricId)).size,18)
  assert.equal(Object.keys(files).length,503)
  const zip=buildFactoryPackageZip(project)
  const recovered=recoverFactorySourceFromZip(zip)
  assert.equal(recovered.verifiedFiles,503)
  assert.deepEqual(recovered.verifiedSizes,project.grading.sizes)
  assert.deepEqual(recovered.project,JSON.parse(JSON.stringify(project)))
  assert.equal(recovered.factoryCertified,false)
  assert.deepEqual(project,original,'export and recovery must not mutate authored project')
})

test('503-file archive with one changed graded DXF fails content integrity',()=>{
  const files=unzipSync(buildFactoryPackageZip(project))
  const path=Object.keys(files).find(p=>p.startsWith('patterns/')&&p.endsWith('-xxl.dxf'))
  assert(path)
  files[path]=strToU8('0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n')
  assert.throws(()=>recoverFactorySourceFromZip(zipSync(files,{level:6})),/content digest mismatch for patterns\//)
})

test('recovery still refuses 1025 tiny ZIP entries before extraction',()=>{
  const files=Object.create(null)
  for(let i=0;i<1025;i++)files[`disposable/${String(i).padStart(4,'0')}.txt`]=strToU8('x')
  const zip=zipSync(files,{level:6})
  assert(zip.length<20*1024*1024)
  assert.throws(()=>recoverFactorySourceFromZip(zip),/too many archive entries/)
})
