import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {spawn,spawnSync} from 'node:child_process'
import {createInterface} from 'node:readline'
import {beginNativeMirrorSave20261030, recoverNativeMirror20261030} from './nativeMirrorTransaction20261030.mjs'
import {createWorkspace} from './workspace.mjs'
import {paths} from './bridge.mjs'
import {createAccuMarkNativeRuleSet} from '../../src/core/accumarkNativePointRuleSet20261023.js'
import {prepareNativeGradeCatalog20261025} from '../../src/core/nativeGradeCatalogBridge20261025.js'
import {simulateDeadMirrorWriter} from './nativeMirrorDeadWriterFixture20261030.mjs'

// This file includes two real Rust executable witnesses. A previously
// compiled debug binary cannot safely deserialize newly embedded metadata.
// Do not run a source-only test against stale native ABIs or silently rebuild
// an executable shared with another engineering worker.
function compatibleNativeBin(t){
  const override=process.env.EXO_QA_NATIVE_BIN_OVERRIDE
  if(override)assert.ok(path.resolve(override).startsWith('/tmp/exo-session-native-property-'))
  const bin=override||path.join(paths().upstream,'target/debug/exo-session')
  if(!fs.existsSync(bin)){t.skip('Matching compiled native session unavailable');return null}
  const cap=spawnSync(bin,['--exo-capabilities'],{encoding:'utf8',timeout:3000})
  let detail
  try{detail=cap.status===0?JSON.parse(cap.stdout):null}catch{}
  if(detail?.nativePropertyMetadataV1!==true || detail?.nativeProjectGenerationV1!==true){
    t.skip('Installed source-only native fixture predates the strict property and generation ABI')
    return null
  }
  const previous=process.env.EXO_CLOTHCRAFT_SESSION_BIN
  process.env.EXO_CLOTHCRAFT_SESSION_BIN=bin
  t.after(()=>{if(previous===undefined)delete process.env.EXO_CLOTHCRAFT_SESSION_BIN
    else process.env.EXO_CLOTHCRAFT_SESSION_BIN=previous})
  return bin
}

const garment = name => ({template:{format:'exo-garment',version:1,name:'TEST',fabrics:[],panels:[{id:'front',name}],seams:[]},avatar_path:'/temporary/avatar.obj',
  mesh_signature:'derived',grade_run:name==='graded'?{sizes:['XS','S','M','L','XL','XXL']}:null})
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-native-linked-history-'))
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
  const mirror=path.join(root,'fitting-project.json')
  fs.writeFileSync(mirror,JSON.stringify(garment('base')))
  fs.writeFileSync(mirror+'.native',JSON.stringify(garment('base')))
  return {mirror,native:mirror+'.native',intent:mirror+'.native-mirror-intent-v1.json'}
}
function journal(project) {
  const undo=[garment('base').template]
  const fields=['bindings','grade','facing','cross','envelope','variant','hardware','graphics','hardware_steps']
  return {schema_version:1,project_digest:JSON.stringify({...project,mesh_signature:null,avatar_path:''}),
    history:{undo,redo:[]},...Object.fromEntries(fields.flatMap(name=>[
      [`${name}_undo`,[name==='hardware_steps'?false:name==='hardware'||name==='graphics'?[]:null]],
      [`${name}_redo`,[]]]))}
}
function beginAndChange(f) {
  beginNativeMirrorSave20261030(f.mirror,{requireLinkedHistory:true})
  fs.writeFileSync(f.native,JSON.stringify(garment('graded')))
}
function blocked(f) {
  assert.throws(()=>(simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)),/NATIVE_MIRROR_RECOVERY_UNCOMMITTED_LINKED_HISTORY/)
  assert.equal(JSON.parse(fs.readFileSync(f.mirror,'utf8')).template.panels[0].name,'base')
  assert.equal(JSON.parse(fs.readFileSync(f.native,'utf8')).template.panels[0].name,'graded')
  assert.ok(fs.existsSync(f.intent),'The recovery intent must survive for explicit repair')
}

test('crash after direct grade rename without history blocks cold-open rather than losing Undo',t=>{
  const f=fixture(t);beginAndChange(f);blocked(f)
})
test('stale and corrupt native history cannot authorize recovering newer graded document',t=>{
  const f=fixture(t)
  fs.writeFileSync(f.native+'.undo-v1.json',JSON.stringify(journal(garment('base'))))
  beginAndChange(f);blocked(f)
  fs.writeFileSync(f.native+'.undo-v1.json','{corrupt')
  blocked(f)
})
test('digest-matched but truncated history stacks fail closed',t=>{
  const f=fixture(t);beginAndChange(f)
  const bad=journal(garment('graded'));bad.grade_undo=[]
  fs.writeFileSync(f.native+'.undo-v1.json',JSON.stringify(bad));blocked(f)
})
test('digest-matched malformed or unrelated Rust Undo templates cannot clear recovery intent',t=>{
  const f=fixture(t);beginAndChange(f)
  const bad=journal(garment('graded'));bad.history.undo=[null]
  fs.writeFileSync(f.native+'.undo-v1.json',JSON.stringify(bad));blocked(f)
  bad.history.undo=[{...garment('base').template,evil:true}]
  fs.writeFileSync(f.native+'.undo-v1.json',JSON.stringify(bad));blocked(f)
  bad.history.undo=[garment('unrelated').template]
  fs.writeFileSync(f.native+'.undo-v1.json',JSON.stringify(bad));blocked(f)
  bad.history.undo=[garment('base').template]
  bad.history.evil=true
  fs.writeFileSync(f.native+'.undo-v1.json',JSON.stringify(bad));blocked(f)
})
test('matching committed Rust history permits recovery without changing the native project',t=>{
  const f=fixture(t);beginAndChange(f)
  fs.writeFileSync(f.native+'.undo-v1.json',JSON.stringify(journal(garment('graded'))))
  assert.equal((simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)).recovered,true)
  assert.equal(JSON.parse(fs.readFileSync(f.mirror,'utf8')).template.panels[0].name,'graded')
  assert.ok(!fs.existsSync(f.intent))
})
test('matching staged save-next history permits interrupted native save recovery',t=>{
  const f=fixture(t);beginAndChange(f)
  const staged=f.mirror+'.save-next.tmp.undo-v1.json'
  fs.writeFileSync(staged,JSON.stringify(journal(garment('graded'))))
  assert.equal((simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)).recovered,true)
  assert.equal(fs.existsSync(staged),false,
    'Cold recovery must promote the validated staged journal, not just mirror geometry')
  assert.deepEqual(JSON.parse(fs.readFileSync(f.native+'.undo-v1.json','utf8')),
    journal(garment('graded')))
})
test('rejected direct commit with unchanged native project clears intent without requiring journal',t=>{
  const f=fixture(t)
  beginNativeMirrorSave20261030(f.mirror,{requireLinkedHistory:true})
  assert.equal((simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)).nativeUnchanged,true)
  assert.ok(!fs.existsSync(f.intent))
})
test('legacy mirror intent without linked-history requirement remains backward compatible',t=>{
  const f=fixture(t)
  beginNativeMirrorSave20261030(f.mirror)
  fs.writeFileSync(f.native,JSON.stringify(garment('graded')))
  assert.equal((simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)).recovered,true)
})

test('actual compiled Rust grade commit followed by SIGKILL rejects withheld linked history',async t=>{
  const config=paths()
  const bin=compatibleNativeBin(t)
  if(!bin)return
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-rust-kill-journal-'))
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
  const workspace=createWorkspace(root)
  let source,project
  try {
    const opened=await workspace.request({op:'open',preset:'tshirt'})
    assert.equal(opened.ok,true,opened.error)
    source=opened.data
    const saved=await workspace.request({op:'save'})
    assert.equal(saved.ok,true,saved.error)
    project=saved.data.project
  } finally { workspace.close() }
  const rule=createAccuMarkNativeRuleSet(source,{sizes:['XS','S','M','L','XL','XXL'],baseSize:'M'})
  assert.equal(rule.ok,true,rule.reason)
  const prepared=prepareNativeGradeCatalog20261025(source,project,rule.ruleSet)
  assert.equal(prepared.ok,true,prepared.reason)
  const mirror=path.join(root,'workspace','fitting-project.json'),native=mirror+'.native'
  beginNativeMirrorSave20261030(mirror,{requireLinkedHistory:true})
  const avatar=path.join(config.upstream,'assets/makehuman/mannequin.obj')
  const child=spawn(bin,[avatar,native],{cwd:config.upstream,stdio:['pipe','pipe','pipe']})
  t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL')})
  const lines=createInterface({input:child.stdout})
  const iterator=lines[Symbol.asyncIterator]()
  const send=async request=>{
    child.stdin.write(JSON.stringify(request)+'\n')
    let timer
    const next=await Promise.race([
      iterator.next(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Native response timed out')),12000)}),
    ]).finally(()=>clearTimeout(timer))
    assert.equal(next.done,false,'Native Rust exited without response')
    const reply=JSON.parse(next.value)
    assert.equal(reply.ok,true,reply.error)
    return reply.data
  }
  await send({op:'open',project})
  await send({op:'grade-run-commit',revision:0,gradeRun:prepared.gradeRun})
  child.kill('SIGKILL')
  await new Promise(resolve=>child.once('exit',resolve))
  assert.equal(JSON.parse(fs.readFileSync(native,'utf8')).grade_run.sizes.length,6)
  assert.equal(JSON.parse(fs.readFileSync(mirror,'utf8')).grade_run??null,null)
  // Current Rust commits its journal before acknowledging. Explicitly inject
  // missing journal evidence instead of assuming the older save behavior.
  assert.ok(fs.existsSync(native+'.undo-v1.json'))
  for(const file of [native+'.undo-v1.json',mirror+'.save-next.tmp.undo-v1.json'])
    if(fs.existsSync(file))fs.renameSync(file,file+'.withheld')
  assert.throws(()=>(simulateDeadMirrorWriter(mirror),recoverNativeMirror20261030(mirror)),/NATIVE_MIRROR_RECOVERY_UNCOMMITTED_LINKED_HISTORY/)
  assert.ok(fs.existsSync(mirror+'.native-mirror-intent-v1.json'))
})

test('real compiled Rust cold reopen restores Undo from a matching staged save-next journal',async t=>{
  const bin=compatibleNativeBin(t)
  if(!bin)return
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-rust-staged-history-'))
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
  const mirror=path.join(root,'workspace','fitting-project.json'),native=mirror+'.native'
  let workspace=createWorkspace(root)
  let baseMirror,baseNative,baseJournal,panelId,baseName
  try {
    const opened=await workspace.request({op:'open',preset:'tshirt'})
    assert.equal(opened.ok,true,opened.error)
    panelId=opened.data.template.panels[0].id
    baseName=opened.data.template.panels[0].name
    baseMirror=fs.readFileSync(mirror)
    baseNative=fs.readFileSync(native)
    baseJournal=fs.readFileSync(native+'.undo-v1.json')
    const edited=await workspace.request({op:'set-property',revision:opened.data.revision,
      target:'panel',id:panelId,field:'name',value:'STAGED HISTORY TEST'})
    assert.equal(edited.ok,true,edited.error)
  } finally { workspace.close() }
  const newerJournal=fs.readFileSync(native+'.undo-v1.json')
  fs.writeFileSync(mirror,baseMirror)
  fs.writeFileSync(native+'.undo-v1.json',baseJournal)
  fs.writeFileSync(mirror+'.save-next.tmp.undo-v1.json',newerJournal)
  fs.writeFileSync(mirror+'.native-mirror-intent-v1.json',JSON.stringify({version:1,
    previousNativeSha256:createHash('sha256').update(baseNative).digest('hex'),requireLinkedHistory:true}))
  assert.equal((simulateDeadMirrorWriter(mirror),recoverNativeMirror20261030(mirror)).recovered,true)
  workspace=createWorkspace(root)
  try {
    const reopened=await workspace.request({op:'snapshot'})
    assert.equal(reopened.ok,true,reopened.error)
    assert.equal(reopened.data.template.panels.find(p=>p.id===panelId).name,'STAGED HISTORY TEST')
    const undone=await workspace.request({op:'undo',revision:reopened.data.revision})
    assert.equal(undone.ok,true,undone.error)
    assert.equal(undone.data.template.panels.find(p=>p.id===panelId).name,baseName)
  } finally { workspace.close() }
})
