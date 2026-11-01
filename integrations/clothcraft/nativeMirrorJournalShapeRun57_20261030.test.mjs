import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {beginNativeMirrorSave20261030, recoverNativeMirror20261030} from './nativeMirrorTransaction20261030.mjs'
import {simulateDeadMirrorWriter} from './nativeMirrorDeadWriterFixture20261030.mjs'

const baseTemplate = {format:'exo-garment',version:1,name:'TEST',fabrics:[],panels:[{id:'front',name:'base'}],seams:[]}
const project = name => ({template:{...baseTemplate,panels:[{id:'front',name}]},avatar_path:'/test/avatar.obj',mesh_signature:'derived'})
const linkedFields = ['bindings','grade','facing','cross','envelope','variant','hardware','graphics','hardware_steps']
function journal(native) {
  return {schema_version:1,project_digest:JSON.stringify({...native,avatar_path:'',mesh_signature:null}),
    history:{undo:[baseTemplate],redo:[]},
    ...Object.fromEntries(linkedFields.flatMap(name=>[[`${name}_undo`,[name==='hardware_steps'?false:name==='hardware'||name==='graphics'?[]:null]],[`${name}_redo`,[]]]))}
}
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-journal-shape-run57-'))
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
  const mirror=path.join(root,'fitting-project.json'),native=`${mirror}.native`,intent=`${mirror}.native-mirror-intent-v1.json`
  fs.writeFileSync(mirror,JSON.stringify(project('base')))
  fs.writeFileSync(native,JSON.stringify(project('base')))
  beginNativeMirrorSave20261030(mirror,{requireLinkedHistory:true})
  const next=project('graded')
  fs.writeFileSync(native,JSON.stringify(next))
  return {mirror,native,intent,next}
}
function recoverWith(t, mutate, accepted=false) {
  const f=fixture(t),saved=journal(f.next)
  mutate(saved)
  fs.writeFileSync(`${f.native}.undo-v1.json`,JSON.stringify(saved))
  if (accepted) {
    assert.equal((simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)).recovered,true)
    assert.equal(fs.existsSync(f.intent),false)
  } else {
    assert.throws(()=>(simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)),/NATIVE_MIRROR_RECOVERY_UNCOMMITTED_LINKED_HISTORY/)
    assert.equal(JSON.parse(fs.readFileSync(f.mirror,'utf8')).template.panels[0].name,'base')
    assert.equal(fs.existsSync(f.intent),true)
  }
}

test('valid Rust-shaped linked journal still permits mirror recovery',t=>recoverWith(t,()=>{},true))
test('unknown top-level journal metadata must not authorize recovery',t=>recoverWith(t,j=>{j.unverifiedReceipt=true}))
test('forged grade history element must not authorize recovery',t=>recoverWith(t,j=>{j.grade_undo=[42]}))
test('non-array hardware history must not authorize recovery',t=>recoverWith(t,j=>{j.hardware_undo=[null]}))
test('non-array print artwork history must not authorize recovery',t=>recoverWith(t,j=>{j.graphics_undo=[{id:'forged'}]}))
test('nonboolean linked history step must not authorize recovery',t=>recoverWith(t,j=>{j.hardware_steps_undo=['forged']}))
