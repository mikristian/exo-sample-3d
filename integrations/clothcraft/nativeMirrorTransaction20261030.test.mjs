import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  beginNativeMirrorSave20261030, commitNativeMirrorSave20261030,
  recoverNativeMirror20261030,
} from './nativeMirrorTransaction20261030.mjs'
import {simulateDeadMirrorWriter} from './nativeMirrorDeadWriterFixture20261030.mjs'

const project = name => ({version:1,template:{name,panels:[{id:'front'}]},state:{positions:[1,2,3]}})
function fixture(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(),'exo-native-mirror-'))
  t.after(()=>fs.rmSync(folder,{recursive:true,force:true}))
  const mirror = path.join(folder,'fitting-project.json')
  const native = `${mirror}.native`
  const intent = `${mirror}.native-mirror-intent-v1.json`
  return {folder,mirror,native,intent}
}

test('native and mirror commit successfully with no pending recovery',t=>{
  const f=fixture(t), initial=project('A'), updated=project('B')
  fs.writeFileSync(f.mirror,JSON.stringify(initial))
  fs.writeFileSync(f.native,JSON.stringify(initial))
  beginNativeMirrorSave20261030(f.mirror)
  fs.writeFileSync(f.native,JSON.stringify(updated))
  commitNativeMirrorSave20261030(f.mirror,updated)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),updated)
  assert.equal(fs.existsSync(f.intent),false)
  assert.deepEqual((simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)),{recovered:false})
})

test('power loss after native save repairs stale mirror and retains original mirror as backup',t=>{
  const f=fixture(t), initial=project('A'), committed=project('B')
  fs.writeFileSync(f.mirror,JSON.stringify(initial))
  fs.writeFileSync(f.native,JSON.stringify(initial))
  beginNativeMirrorSave20261030(f.mirror)
  fs.writeFileSync(f.native,JSON.stringify(committed))
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),initial)
  const recovery=(simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror))
  assert.equal(recovery.recovered,true)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),committed)
  const archive=fs.readdirSync(f.folder).find(name=>name.includes('before-native-mirror-recovery-'))
  assert.ok(archive)
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.folder,archive),'utf8')),initial)
  assert.equal(fs.existsSync(f.intent),false)
})

test('failed native save leaves original mirror when native bytes were unchanged',t=>{
  const f=fixture(t), initial=project('A')
  fs.writeFileSync(f.mirror,JSON.stringify(initial))
  fs.writeFileSync(f.native,JSON.stringify(initial))
  beginNativeMirrorSave20261030(f.mirror)
  const result=(simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror))
  assert.equal(result.nativeUnchanged,true)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),initial)
  assert.equal(fs.existsSync(f.intent),false)
})

test('first native save may complete after an initially missing native file',t=>{
  const f=fixture(t), first=project('First')
  beginNativeMirrorSave20261030(f.mirror)
  fs.writeFileSync(f.native,JSON.stringify(first))
  assert.equal((simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)).recovered,true)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),first)
  assert.equal(fs.existsSync(f.intent),false)
})

test('crash after mirror commit but before intent cleanup does not discard accepted project',t=>{
  const f=fixture(t), initial=project('A'), accepted=project('B')
  fs.writeFileSync(f.mirror,JSON.stringify(initial))
  fs.writeFileSync(f.native,JSON.stringify(initial))
  beginNativeMirrorSave20261030(f.mirror)
  fs.writeFileSync(f.native,JSON.stringify(accepted))
  fs.writeFileSync(f.mirror,JSON.stringify(accepted))
  assert.equal((simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)).recovered,true)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),accepted)
  assert.equal(fs.readdirSync(f.folder).filter(name=>name.includes('before-native-mirror-recovery-')).length,0)
  assert.equal(fs.existsSync(f.intent),false)
})

test('mismatched native response cannot be committed and remains recoverable',t=>{
  const f=fixture(t), initial=project('A'), committed=project('B')
  fs.writeFileSync(f.mirror,JSON.stringify(initial))
  fs.writeFileSync(f.native,JSON.stringify(initial))
  beginNativeMirrorSave20261030(f.mirror)
  fs.writeFileSync(f.native,JSON.stringify(committed))
  assert.throws(()=>commitNativeMirrorSave20261030(f.mirror,project('C')),/NATIVE_RESPONSE_MISMATCH/)
  assert.equal(fs.existsSync(f.intent),true)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),initial)
  assert.equal((simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)).recovered,true)
})

test('invalid native file stops recovery without overwriting the last JS mirror',t=>{
  const f=fixture(t), initial=project('A')
  fs.writeFileSync(f.mirror,JSON.stringify(initial))
  fs.writeFileSync(f.native,JSON.stringify(initial))
  beginNativeMirrorSave20261030(f.mirror)
  fs.writeFileSync(f.native,'not a JSON project')
  assert.throws(()=>(simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)),/INVALID_NATIVE_PROJECT/)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),initial)
  assert.equal(fs.existsSync(f.intent),true)
})
