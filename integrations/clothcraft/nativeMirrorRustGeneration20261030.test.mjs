import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {beginNativeMirrorSave20261030 as begin,
  commitNativeMirrorSave20261030 as commit,
  recoverNativeMirror20261030 as recover} from './nativeMirrorTransaction20261030.mjs'
import {simulateDeadMirrorWriter} from './nativeMirrorDeadWriterFixture20261030.mjs'

const uuid='00000000-0000-4000-8000-000000000001'
const other='00000000-0000-4000-8000-000000000002'
const identity=(generation=1,project_id=uuid)=>({schema_version:1,project_id,generation})
const project=(name,stamp)=>({version:1,template:{format:'exo-garment',version:1,name,
  panels:[{id:'front',name}],fabrics:[],seams:[]},mesh_signature:null,avatar_path:'',
  ...(stamp===undefined?{}:{native_commit:stamp})})
const journal=(before,after,stamp)=>{
  const fields=['bindings','grade','facing','cross','envelope','variant','hardware','graphics','hardware_steps']
  return {schema_version:1,
    project_digest:JSON.stringify({...after,mesh_signature:null,avatar_path:''}),
    history:{undo:[before.template],redo:[]},
    ...Object.fromEntries(fields.flatMap(name=>[
      [name+'_undo',[name==='hardware_steps'?false:['hardware','graphics'].includes(name)?[]:null]],
      [name+'_redo',[]],
    ])),
    ...(stamp===undefined?{}:{commit:stamp}),
  }
}
function setup(t,{legacy=false}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-native-rust-generation-'))
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
  const mirror=path.join(root,'project.json'),native=mirror+'.native'
  const before=project('old',legacy?undefined:identity()),after=project('new')
  fs.writeFileSync(mirror,JSON.stringify(before))
  fs.writeFileSync(native,JSON.stringify(before))
  fs.writeFileSync(native+'.undo-v1.json',JSON.stringify(journal(before,before,legacy?undefined:identity())))
  return {mirror,native,before,after}
}
const writeNext=(f,stamp)=>{
  f.after=project('new',stamp)
  fs.writeFileSync(f.native,JSON.stringify(f.after))
  fs.writeFileSync(f.native+'.undo-v1.json',JSON.stringify(journal(f.before,f.after,stamp)))
}

test('new Rust UUID and generation advance atomically with a linked native grading mirror',t=>{
  const f=setup(t)
  begin(f.mirror,{requireLinkedHistory:true})
  writeNext(f,identity(2))
  commit(f.mirror,f.after)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),f.after)
  assert.equal(recover(f.mirror).recovered,false)
})
test('two Rust native saves inside one JS transaction may advance two generations',t=>{
  const f=setup(t)
  begin(f.mirror,{requireLinkedHistory:true})
  writeNext(f,identity(3))
  commit(f.mirror,f.after)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),f.after)
})
for(const variant of ['missing','replay','rollback','replaced','invalid','unknown']) {
  test('Rust generation '+variant+' cannot promote an unresolved native transaction',t=>{
    const f=setup(t)
    begin(f.mirror,{requireLinkedHistory:true})
    const commits={
      missing:undefined,replay:identity(),rollback:identity(0),
      replaced:identity(2,other),invalid:{schema_version:1,project_id:'not-a-uuid',generation:2},
      unknown:{...identity(2),arbitrary:true},
    }
    writeNext(f,commits[variant])
    assert.throws(()=>commit(f.mirror,f.after),/UNCOMMITTED_LINKED_HISTORY/)
    assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),f.before)
    assert.equal(fs.existsSync(f.mirror+'.native-mirror-intent-v1.json'),true)
    simulateDeadMirrorWriter(f.mirror)
    assert.throws(()=>recover(f.mirror),/UNCOMMITTED_LINKED_HISTORY/)
  })
}
test('legacy Rust Undo journal can adopt the first valid versioned commit UUID',t=>{
  const f=setup(t,{legacy:true})
  begin(f.mirror,{requireLinkedHistory:true})
  writeNext(f,identity(1))
  commit(f.mirror,f.after)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),f.after)
})
test('native document/journal must agree on existing UUID before Node begins a new save',t=>{
  const f=setup(t)
  fs.writeFileSync(f.native,JSON.stringify(project('old',identity(1,other))))
  assert.throws(()=>begin(f.mirror,{requireLinkedHistory:false}),
    /NATIVE_MIRROR_PREVIOUS_NATIVE_COMMIT_IDENTITY_MISMATCH/)
  assert.equal(fs.existsSync(f.mirror+'.native-mirror-owner-v1.json'),false)
})
test('ordinary Rust save with zero authored Undo steps still requires a matching new generation',t=>{
  const f=setup(t)
  begin(f.mirror,{requireLinkedHistory:false})
  writeNext(f,identity(2))
  const saved=journal(f.before,f.after,identity(2))
  saved.history.undo=[]
  for(const name of ['bindings','grade','facing','cross','envelope','variant','hardware','graphics','hardware_steps'])saved[name+'_undo']=[]
  fs.writeFileSync(f.native+'.undo-v1.json',JSON.stringify(saved))
  commit(f.mirror,f.after)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),f.after)
})
test('ordinary Rust save refuses a newer native project with no matching Undo journal',t=>{
  const f=setup(t)
  begin(f.mirror,{requireLinkedHistory:false})
  writeNext(f,identity(2))
  fs.rmSync(f.native+'.undo-v1.json')
  assert.throws(()=>commit(f.mirror,f.after),/UNCOMMITTED_NATIVE_DOCUMENT/)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),f.before)
})
