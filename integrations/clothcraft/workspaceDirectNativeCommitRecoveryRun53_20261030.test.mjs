import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {beginNativeMirrorSave20261030,commitNativeMirrorSave20261030,recoverNativeMirror20261030} from './nativeMirrorTransaction20261030.mjs'
import {simulateDeadMirrorWriter} from './nativeMirrorDeadWriterFixture20261030.mjs'

const source=fs.readFileSync(fileURLToPath(new URL('./workspace.mjs',import.meta.url)),'utf8')
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor
function branch(from,to,params){
  const first=source.indexOf(from),last=source.indexOf(to,first)
  assert.ok(first>=0&&last>first,`extract real workspace branch: ${from}`)
  return new AsyncFunction(...params,source.slice(first,last))
}
const gradeCommit=branch("   if(['grade-run-commit','grade-run-clear'].includes(data.op)){",
  '   // These requests return inspection packets',
  ['data','current','save','fs','path','outputRoot','backupEntries','rpc','remember','beginNativeMirrorSave20261030','saveFile'])
const genericStart=source.includes("   if(data.op==='grade-notch-commit')beginNativeMirrorSave20261030(saveFile,{requireLinkedHistory:true})")
  ? "   if(data.op==='grade-notch-commit')beginNativeMirrorSave20261030(saveFile,{requireLinkedHistory:true})"
  : '   const result=remember(await rpc(data))\n'
const generic=branch(genericStart,
  '   if(runError&&data.op===',
  ['data','remember','rpc','save','stepsSinceSave','runError','beginNativeMirrorSave20261030','saveFile'])

const project=name=>({version:1,template:{format:'garment',version:2,name,panels:[{id:'front'}],fabrics:[],seams:[]},state:{positions:[1,2,3]}})
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-direct-native-commit-'))
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
  const dir=path.join(root,'workspace');fs.mkdirSync(dir)
  const mirror=path.join(dir,'fitting-project.json'),native=mirror+'.native'
  fs.writeFileSync(mirror,JSON.stringify(project('before')))
  fs.writeFileSync(native,JSON.stringify(project('before')))
  return {root,mirror,native}
}
function crashAfterNativeRename(f){
  return async()=>{
    fs.writeFileSync(f.native,JSON.stringify(project('after')))
    throw Error('SIMULATED_CRASH_AFTER_RUST_RENAME')
  }
}

test('grade-run-commit Rust rename without linked journal blocks cold-open without overwriting mirror',async t=>{
  const f=fixture(t)
  await assert.rejects(gradeCommit({op:'grade-run-commit',revision:1},{revision:1},
    async()=>({ok:true}),fs,path,f.root,()=>[[f.mirror,'fitting-project.json'],[f.native,'fitting-project.json.native']],
    crashAfterNativeRename(f),x=>x,beginNativeMirrorSave20261030,f.mirror),/SIMULATED_CRASH/)
  assert.throws(()=>(simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)),/NATIVE_MIRROR_RECOVERY_UNCOMMITTED_LINKED_HISTORY/)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),project('before'))
  assert.deepEqual(JSON.parse(fs.readFileSync(f.native,'utf8')),project('after'))
})

test('grade-notch-commit direct Rust rename without linked journal blocks cold-open',async t=>{
  const f=fixture(t)
  await assert.rejects(generic({op:'grade-notch-commit',revision:1},x=>x,
    crashAfterNativeRename(f),async()=>({ok:true}),0,null,
    beginNativeMirrorSave20261030,f.mirror),/SIMULATED_CRASH/)
  assert.throws(()=>(simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)),/NATIVE_MIRROR_RECOVERY_UNCOMMITTED_LINKED_HISTORY/)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),project('before'))
  assert.deepEqual(JSON.parse(fs.readFileSync(f.native,'utf8')),project('after'))
})

test('successful grade-notch-commit publishes native project into JS mirror and clears intent',async t=>{
  const f=fixture(t)
  let saves=0
  const rpc=async()=>{
    fs.writeFileSync(f.native,JSON.stringify(project('after')))
    return {ok:true,data:{revision:2}}
  }
  const save=async()=>{
    saves++
    const names=['bindings','grade','facing','cross','envelope','variant','hardware','graphics','hardware_steps']
    fs.writeFileSync(f.native+'.undo-v1.json',JSON.stringify({schema_version:1,
      project_digest:JSON.stringify({...project('after'),mesh_signature:null,avatar_path:''}),
      history:{undo:[project('before').template],redo:[]},
      ...Object.fromEntries(names.flatMap(n=>[[n+'_undo',[n==='hardware_steps'?false:['hardware','graphics'].includes(n)?[]:null]],[n+'_redo',[]]]))}))
    commitNativeMirrorSave20261030(f.mirror,project('after'))
    return {ok:true}
  }
  await generic({op:'grade-notch-commit',revision:1},x=>x,rpc,save,0,null,
    beginNativeMirrorSave20261030,f.mirror)
  assert.equal(saves,1)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),project('after'))
  assert.equal((simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)).recovered,false)
})

test('rejected grade-notch-commit before native rename preserves previous project on recovery',async t=>{
  const f=fixture(t)
  await assert.rejects(generic({op:'grade-notch-commit',revision:1},x=>x,
    async()=>{throw Error('SIMULATED_RUST_REJECTION')},async()=>({ok:true}),0,null,
    beginNativeMirrorSave20261030,f.mirror),/SIMULATED_RUST_REJECTION/)
  assert.equal((simulateDeadMirrorWriter(f.mirror),recoverNativeMirror20261030(f.mirror)).nativeUnchanged,true)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.mirror,'utf8')),project('before'))
})
