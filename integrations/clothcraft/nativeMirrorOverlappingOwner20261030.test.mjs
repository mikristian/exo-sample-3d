import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {beginNativeMirrorSave20261030 as begin,commitNativeMirrorSave20261030 as commit,
  recoverNativeMirror20261030 as recover,
  abortUnchangedNativeMirrorSave20261030 as abort} from './nativeMirrorTransaction20261030.mjs'
import {simulateDeadMirrorWriter} from './nativeMirrorDeadWriterFixture20261030.mjs'

const project=name=>({template:{name,format:'exo-garment',version:1,
  panels:[{id:'front',name}],fabrics:[],seams:[]},mesh_signature:null,avatar_path:''})
function fixture(t) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'exo-native-owner-'))
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}))
  const mirror=path.join(directory,'project.json'),old=project('old'),next=project('next')
  fs.writeFileSync(mirror,JSON.stringify(old))
  fs.writeFileSync(mirror+'.native',JSON.stringify(old))
  return {mirror,old,next,intent:mirror+'.native-mirror-intent-v1.json',
    owner:mirror+'.native-mirror-owner-v1.json'}
}

test('an unresolved linked transaction cannot be replaced by a generic begin',t=>{
  const f=fixture(t)
  const token=begin(f.mirror,{requireLinkedHistory:true})
  const original=fs.readFileSync(f.intent,'utf8')
  assert.match(token,/^[a-f0-9-]{36}$/)
  assert.throws(()=>begin(f.mirror,{requireLinkedHistory:false}),/NATIVE_MIRROR_TRANSACTION_BUSY/)
  assert.equal(fs.readFileSync(f.intent,'utf8'),original)
  assert.equal(JSON.parse(original).requireLinkedHistory,true)
  fs.writeFileSync(f.mirror+'.native',JSON.stringify(f.next))
  assert.throws(()=>commit(f.mirror,f.next),/NATIVE_MIRROR_SAVE_UNCOMMITTED_LINKED_HISTORY/)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),f.old)
  assert.equal(fs.existsSync(f.owner),true)
})

test('a competing generic writer cannot advance the native document without ownership',t=>{
  const f=fixture(t)
  begin(f.mirror)
  assert.throws(()=>begin(f.mirror),/NATIVE_MIRROR_TRANSACTION_BUSY/)
  fs.writeFileSync(f.mirror+'.native',JSON.stringify(f.next))
  commit(f.mirror,f.next)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),f.next)
  assert.equal(fs.existsSync(f.intent),false)
  assert.equal(fs.existsSync(f.owner),false)
  assert.deepEqual(recover(f.mirror),{recovered:false})
})

test('a separate Node process cannot replace a live owner or downgrade linked-history policy',t=>{
  const f=fixture(t)
  begin(f.mirror,{requireLinkedHistory:true})
  const before=fs.readFileSync(f.intent,'utf8')
  const moduleUrl=new URL('./nativeMirrorTransaction20261030.mjs',import.meta.url).href
  const child=spawnSync(process.execPath,['--input-type=module','-e',
    `import {beginNativeMirrorSave20261030 as begin} from ${JSON.stringify(moduleUrl)};
     try{begin(process.argv[1],{requireLinkedHistory:false});process.stdout.write('UNSAFE_ACCEPT')}
     catch(e){process.stdout.write(e.message)}`,f.mirror],{encoding:'utf8',timeout:5000})
  assert.equal(child.status,0)
  assert.equal(child.stdout,'NATIVE_MIRROR_TRANSACTION_BUSY')
  assert.equal(fs.readFileSync(f.intent,'utf8'),before)
})

test('explicit abort permits retry only when native project and journal bytes did not change',t=>{
  const f=fixture(t)
  begin(f.mirror)
  assert.equal(abort(f.mirror).aborted,true)
  assert.equal(fs.existsSync(f.owner),false)
  begin(f.mirror)
  fs.writeFileSync(f.mirror+'.native.undo-v1.json','different-journal')
  assert.equal(abort(f.mirror).nativeOrJournalChanged,true)
  assert.equal(fs.existsSync(f.owner),true)
  assert.throws(()=>begin(f.mirror),/NATIVE_MIRROR_TRANSACTION_BUSY/)
})

test('after a crashed writer, native change and old mirror are recoverable with durable owner evidence',t=>{
  const f=fixture(t)
  begin(f.mirror)
  fs.writeFileSync(f.mirror+'.native',JSON.stringify(f.next))
  assert.throws(()=>recover(f.mirror),/NATIVE_MIRROR_TRANSACTION_BUSY/,
    'in-flight transaction must never be mistaken for an interrupted save')
  assert.equal(simulateDeadMirrorWriter(f.mirror),true)
  assert.equal(recover(f.mirror).recovered,true)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),f.next)
  assert.equal(fs.existsSync(f.owner),false)
  assert.equal(fs.existsSync(f.intent),false)
})

test('after an untouched crashed writer, only the intent and stale owner are removed',t=>{
  const f=fixture(t)
  begin(f.mirror,{requireLinkedHistory:true})
  simulateDeadMirrorWriter(f.mirror)
  assert.equal(recover(f.mirror).nativeUnchanged,true)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),f.old)
  assert.equal(fs.existsSync(f.owner),false)
})

test('reused numeric PID with different OS start identity does not strand a crashed transaction',t=>{
  const f=fixture(t)
  begin(f.mirror)
  const owner=JSON.parse(fs.readFileSync(f.owner,'utf8'))
  assert.equal(owner.pid,process.pid)
  assert.equal(typeof owner.pidStart,'string','OS start identity must be recorded on this runtime')
  // An unrelated process later acquired the dead writer's numeric PID.
  owner.pidStart='Thu Jan  1 00:00:01 1970'
  fs.writeFileSync(f.owner,JSON.stringify(owner))
  fs.writeFileSync(f.mirror+'.native',JSON.stringify(f.next))
  assert.equal(recover(f.mirror).recovered,true)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),f.next)
  assert.equal(fs.existsSync(f.owner),false)
})
