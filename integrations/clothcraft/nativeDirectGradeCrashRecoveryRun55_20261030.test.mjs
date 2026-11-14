import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {beginNativeMirrorSave20261030, recoverNativeMirror20261030} from './nativeMirrorTransaction20261030.mjs'
import {createWorkspace} from './workspace.mjs'
import {paths} from './bridge.mjs'
import {createAccuMarkNativeRuleSet} from '../../src/core/accumarkNativePointRuleSet20261023.js'
import {prepareNativeGradeCatalog20261025} from '../../src/core/nativeGradeCatalogBridge20261025.js'
import {simulateDeadMirrorWriter} from './nativeMirrorDeadWriterFixture20261030.mjs'

// This intentionally kills the real compiled Rust process after its direct
// grade commit response, before Node can issue the ordinary save RPC. It is
// not a mocked history journal or a physical manufacturing acceptance test.
test('direct native six-size grade commit survives SIGKILL with linked cold-open Undo/Redo', async t => {
  const config=paths()
  const bin=path.join(config.upstream,'target/debug/exo-session')
  if (!fs.existsSync(bin)) return t.skip('Native Rust executable absent')
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exo-direct-grade-recover-run55-'))
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
  let workspace=createWorkspace(root)
  let opened,project
  try {
    opened=await workspace.request({op:'open',preset:'tshirt'})
    assert.equal(opened.ok,true,opened.error)
    const saved=await workspace.request({op:'save'})
    assert.equal(saved.ok,true,saved.error)
    project=saved.data.project
  } finally { workspace.close() }
  const rule=createAccuMarkNativeRuleSet(opened.data,{sizes:['XS','S','M','L','XL','XXL'],baseSize:'M'})
  assert.equal(rule.ok,true,rule.reason)
  const prepared=prepareNativeGradeCatalog20261025(opened.data,project,rule.ruleSet)
  assert.equal(prepared.ok,true,prepared.reason)
  const mirror=path.join(root,'workspace','fitting-project.json')
  const native=`${mirror}.native`
  beginNativeMirrorSave20261030(mirror,{requireLinkedHistory:true})
  const avatar=path.join(config.upstream,'assets/makehuman/mannequin.obj')
  const child=spawn(bin,[avatar,native],{cwd:config.upstream,stdio:['pipe','pipe','pipe']})
  t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL')})
  const lines=createInterface({input:child.stdout})
  const iterator=lines[Symbol.asyncIterator]()
  const send=async request=>{
    child.stdin.write(JSON.stringify(request)+'\n')
    let timer
    const response=await Promise.race([
      iterator.next(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Native RPC timed out')),12000)}),
    ]).finally(()=>clearTimeout(timer))
    assert.equal(response.done,false,'Native Rust exited without response')
    const reply=JSON.parse(response.value)
    assert.equal(reply.ok,true,reply.error)
    return reply.data
  }
  await send({op:'open',project})
  await send({op:'grade-run-commit',revision:0,gradeRun:prepared.gradeRun})
  child.kill('SIGKILL')
  await new Promise(resolve=>child.once('exit',resolve))
  assert.equal(JSON.parse(fs.readFileSync(native,'utf8')).grade_run.sizes.length,6)
  assert.equal(JSON.parse(fs.readFileSync(mirror,'utf8')).grade_run??null,null)
  const recovered=(simulateDeadMirrorWriter(mirror),recoverNativeMirror20261030(mirror))
  assert.equal(recovered.recovered,true,'Cold mirror recovery must require linked committed/staged Rust history')
  assert.ok(!fs.existsSync(`${mirror}.native-mirror-intent-v1.json`))

  workspace=createWorkspace(root)
  try {
    const snapshot=await workspace.request({op:'snapshot'})
    assert.equal(snapshot.ok,true,snapshot.error)
    const status=await workspace.request({op:'grade-run-status',revision:snapshot.data.revision})
    assert.equal(status.ok,true,status.error)
    assert.equal(status.data.catalog?.sizes?.length,6,'Reopened project must preserve six graded sizes')
    assert.equal(snapshot.data.canUndo,true,'Direct grade commit must have durable Undo')
    const undone=await workspace.request({op:'undo',revision:snapshot.data.revision})
    assert.equal(undone.ok,true,undone.error)
    const afterUndo=await workspace.request({op:'grade-run-status',revision:undone.data.revision})
    assert.equal(afterUndo.ok,true,afterUndo.error)
    assert.equal(afterUndo.data.catalog??null,null,'Undo must remove only the new catalog')
    const redone=await workspace.request({op:'redo',revision:undone.data.revision})
    assert.equal(redone.ok,true,redone.error)
    const afterRedo=await workspace.request({op:'grade-run-status',revision:redone.data.revision})
    assert.equal(afterRedo.ok,true,afterRedo.error)
    assert.equal(afterRedo.data.catalog?.sizes?.length,6,'Redo must restore all six sizes')
    const saved=await workspace.request({op:'save'})
    assert.equal(saved.ok,true,saved.error)
  } finally { workspace.close() }
  workspace=createWorkspace(root)
  try {
    const final=await workspace.request({op:'snapshot'})
    assert.equal(final.ok,true,final.error)
    const finalStatus=await workspace.request({op:'grade-run-status',revision:final.data.revision})
    assert.equal(finalStatus.ok,true,finalStatus.error)
    assert.equal(finalStatus.data.catalog?.sizes?.length,6,'Second cold reopen must preserve grade')
  } finally { workspace.close() }
})
