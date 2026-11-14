import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {atomicMetadataSidecar20261030 as write} from './atomicMetadataSidecar20261030.mjs'

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-atomic-property-'))
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
  return {root,file:path.join(root,'workspace','garment.properties.json')}
}
test('sidecar is atomically replaceable, mode 0600 and durable with CAS',t=>{
  const f=fixture(t)
  const initial=write(f.file,{version:1,panels:{a:{itemNo:'1'}}})
  assert.match(initial.sha256,/^[a-f0-9]{64}$/)
  assert.equal(fs.statSync(f.file).mode&0o777,0o600)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.file)),{version:1,panels:{a:{itemNo:'1'}}})
  const next=write(f.file,{version:1,panels:{a:{itemNo:'2'}}},{expectedSha256:initial.sha256})
  assert.equal(next.previousSha256,initial.sha256)
  assert.notEqual(next.sha256,initial.sha256)
  assert.throws(()=>write(f.file,{overwrite:true},{expectedSha256:initial.sha256}),/CONCURRENT_CHANGE/)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.file)).panels.a,{itemNo:'2'})
})
test('preexisting fixed temp symlink cannot redirect new metadata write',t=>{
  const f=fixture(t)
  fs.mkdirSync(path.dirname(f.file),{recursive:true})
  const important=path.join(f.root,'unrelated-user.txt')
  fs.writeFileSync(important,'DO-NOT-TOUCH')
  fs.symlinkSync(important,f.file+'.tmp')
  write(f.file,{version:1,panels:{}})
  assert.equal(fs.readFileSync(important,'utf8'),'DO-NOT-TOUCH')
  assert.equal(fs.readlinkSync(f.file+'.tmp'),important)
})
test('preexisting sidecar symlink is rejected without reading or replacing its target',t=>{
  const f=fixture(t)
  fs.mkdirSync(path.dirname(f.file),{recursive:true})
  const important=path.join(f.root,'personal-garment.txt')
  fs.writeFileSync(important,'USER-DATA')
  fs.symlinkSync(important,f.file)
  assert.throws(()=>write(f.file,{version:1}),/UNTRUSTED_DESTINATION/)
  assert.equal(fs.readFileSync(important,'utf8'),'USER-DATA')
  assert.equal(fs.readlinkSync(f.file),important)
})
test('second cooperative writer fails closed on an active metadata sidecar lock',t=>{
  const f=fixture(t)
  fs.mkdirSync(path.dirname(f.file),{recursive:true})
  const lock=f.file+'.writer-v1.lock'
  fs.writeFileSync(lock,'already-owned')
  assert.throws(()=>write(f.file,{value:'second'}),/METADATA_SIDECAR_BUSY/)
  assert.equal(fs.readFileSync(lock,'utf8'),'already-owned')
  assert.equal(fs.existsSync(f.file),false)
})
test('new lock records process identity and is removed after a successful durable write',t=>{
  const f=fixture(t)
  const originalFsync=fs.fsyncSync
  let observed
  fs.fsyncSync=function(fd){
    const lock=f.file+'.writer-v1.lock'
    if(fs.existsSync(lock)){
      const raw=fs.readFileSync(lock,'utf8')
      if(raw.startsWith('{'))observed=JSON.parse(raw)
    }
    return originalFsync.call(fs,fd)
  }
  try {write(f.file,{version:1})}finally{fs.fsyncSync=originalFsync}
  assert.equal(observed.format,'exo-sidecar-writer-v1')
  assert.equal(observed.pid,process.pid)
  assert.match(observed.identity,/^[0-9a-f-]{36}$/i)
  assert.ok(Number.isFinite(Date.parse(observed.startedAt)))
  assert.equal(fs.existsSync(f.file+'.writer-v1.lock'),false)
})
test('orphaned structured lock remains untouched and blocks automatic takeover',t=>{
  const f=fixture(t)
  fs.mkdirSync(path.dirname(f.file),{recursive:true})
  const lock=f.file+'.writer-v1.lock'
  const orphan=JSON.stringify({format:'exo-sidecar-writer-v1',pid:2147483647,
    identity:'dead-owner',startedAt:'2020-01-01T00:00:00.000Z'})
  fs.writeFileSync(lock,orphan)
  assert.throws(()=>write(f.file,{version:1}),/METADATA_SIDECAR_BUSY/)
  assert.equal(fs.readFileSync(lock,'utf8'),orphan)
  assert.equal(fs.existsSync(f.file),false)
})
test('invalid JSON data and excessive metadata cannot alter previous sidecar',t=>{
  const f=fixture(t)
  write(f.file,{name:'first'})
  assert.throws(()=>write(f.file,{bad:1n}),/serialize a BigInt/)
  assert.throws(()=>write(f.file,{text:'x'.repeat(8*1024*1024)}),/TOO_LARGE/)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.file)),{name:'first'})
  assert.equal(fs.readdirSync(path.dirname(f.file)).length,1)
})
