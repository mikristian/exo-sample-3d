import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  beginNativeMirrorSave20261030,
  commitNativeMirrorSave20261030,
  recoverNativeMirror20261030,
} from './nativeMirrorTransaction20261030.mjs'
import {simulateDeadMirrorWriter} from './nativeMirrorDeadWriterFixture20261030.mjs'

const template = name => ({format:'exo-garment',version:1,name,fabrics:[],panels:[{id:'p1',name}],seams:[]})
const fields = ['bindings','grade','facing','cross','envelope','variant','hardware','graphics','hardware_steps']
const field = {
  bindings:'native_point_bindings',grade:'grade_run',facing:'native_facing_dependency',
  cross:'native_cross_piece_link',envelope:'fabric_grade_envelope',variant:'piece_variant',
  hardware:'imported_hardware',graphics:'print_graphics',
}
const source = (name, rich=false) => ({
  template:template(name), avatar_path:'', mesh_signature:null,
  native_point_bindings:rich?{version:1,ident:'binding-before'}:null,
  grade_run:rich?{version:1,ident:'grade-before'}:null,
  native_facing_dependency:rich?{version:1,ident:'facing-before'}:null,
  native_cross_piece_link:rich?{version:1,ident:'cross-before'}:null,
  fabric_grade_envelope:rich?{version:1,ident:'envelope-before'}:null,
  piece_variant:rich?{version:1,ident:'variant-before'}:null,
  imported_hardware:rich?[{id:'hardware-before'}]:[],
  print_graphics:rich?[{id:'graphics-before'}]:[],
})
const deep = x => structuredClone(x)
function fixture(t,{rich=true}={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'exo-architecture-linked-'))
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
  const mirror=path.join(dir,'fitting-project.json'),native=`${mirror}.native`
  const old=source('old',rich),next=source('new',true)
  fs.writeFileSync(mirror,JSON.stringify(old));fs.writeFileSync(native,JSON.stringify(old))
  beginNativeMirrorSave20261030(mirror,{requireLinkedHistory:true})
  fs.writeFileSync(native,JSON.stringify(next))
  return {mirror,native,old,next,intent:`${mirror}.native-mirror-intent-v1.json`}
}
function journal({old,next},change=()=>{}) {
  const j={
    schema_version:1,
    project_digest:JSON.stringify({...next,mesh_signature:null,avatar_path:''}),
    history:{undo:[old.template],redo:[]},
    ...Object.fromEntries(fields.flatMap(n=>[
      [`${n}_undo`,[n==='hardware_steps'?false:deep(old[field[n]])]],
      [`${n}_redo`,[]],
    ])),
  }
  change(j)
  return j
}
const write=(f,j,staged=false)=>fs.writeFileSync(
  staged?`${f.mirror}.save-next.tmp.undo-v1.json`:`${f.native}.undo-v1.json`,JSON.stringify(j))
const unchanged=f=>{
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),f.old)
  assert.equal(fs.existsSync(f.intent),true)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.native,'utf8')),f.next)
}

test('complete nine-field prior graph is accepted by both normal commit and cold recovery',t=>{
  const f=fixture(t)
  write(f,journal(f))
  commitNativeMirrorSave20261030(f.mirror,f.next)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),f.next)
  assert.equal(fs.existsSync(f.intent),false)
})
test('complete prior graph after interrupted commit is recovered with old-mirror backup',t=>{
  const f=fixture(t)
  write(f,journal(f))
  assert.equal((simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)).recovered,true)
  assert.equal(fs.existsSync(f.intent),false)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),f.next)
  assert.equal(fs.readdirSync(path.dirname(f.mirror)).filter(x=>x.includes('before-native-mirror-recovery')).length,1)
})
test('normal commit rejects missing, invalid, stale and staged-only linked journals, preserving intent',t=>{
  for(const variant of ['missing','garbled','stale','staged-only'])awaitRejectVariant(t,variant)
})
function awaitRejectVariant(t,variant){
  const f=fixture(t)
  if(variant==='garbled')fs.writeFileSync(`${f.native}.undo-v1.json`,'{not json')
  if(variant==='stale')write(f,journal(f,j=>{j.project_digest=JSON.stringify(f.old)}))
  if(variant==='staged-only')write(f,journal(f),true)
  assert.throws(()=>commitNativeMirrorSave20261030(f.mirror,f.next),/NATIVE_MIRROR_SAVE_UNCOMMITTED_LINKED_HISTORY/)
  unchanged(f)
}
test('cold recover permits staged save-next but normal commit does not',t=>{
  const f=fixture(t)
  write(f,journal(f),true)
  assert.throws(()=>commitNativeMirrorSave20261030(f.mirror,f.next),/UNCOMMITTED_LINKED_HISTORY/)
  unchanged(f)
  assert.equal((simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)).recovered,true)
})
for(const name of fields) {
  test(`prior ${name} Undo snapshot must exactly match the previous native mirror`,t=>{
    const f=fixture(t)
    write(f,journal(f,j=>{
      j[`${name}_undo`][0]=name==='hardware_steps'?true:
        ['hardware','graphics'].includes(name)?[]:null
    }))
    assert.throws(()=>commitNativeMirrorSave20261030(f.mirror,f.next),/UNCOMMITTED_LINKED_HISTORY/)
    unchanged(f)
    assert.throws(()=>(simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)),/UNCOMMITTED_LINKED_HISTORY/)
    unchanged(f)
  })
}
