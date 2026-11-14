import test from 'node:test'
import assert from 'node:assert/strict'
import {inspectScopedNativeGradeHistory20261112 as inspect,
  verifyScopedNativeGradeResult20261112 as verify} from './scopedNativeGradeHistory20261112.js'

const template={panels:[{id:'front',points:[[0,0],[1,0],[1,1]]}]}
const snapshot={revision:7,template,canUndo:true,canRedo:false,gradeRunPersisted:true,
  projectId:'p',documentId:'d',activeGradedSize:null}
const catalogStatus={ok:true,persisted:true,sourceRevision:7,sourceTemplate:template,
  templateFingerprint:'fixture-fingerprint'}
const input={direction:'undo',snapshot,catalogStatus,draftRuleSet:{templateFingerprint:'fixture-fingerprint'}}
test('a verified native catalog commit can be scoped to its own Rust journal',()=>{
  const decision=inspect(input)
  assert(decision.ok)
  assert.deepEqual({op:decision.op,revision:decision.revision},{op:'undo',revision:7})
  const result=verify({decision,direction:'undo',response:{revision:8,template,
    gradeRunPersisted:false,projectId:'p',documentId:'d'}})
  assert(result.ok)
  const redo=inspect({direction:'redo',snapshot:{...snapshot,revision:8,
    canUndo:false,canRedo:true,gradeRunPersisted:false},redoWitness:result})
  assert.equal(redo.ok,true)
  assert.equal(verify({decision:redo,direction:'redo',response:{revision:9,template,
    gradeRunPersisted:true,projectId:'p',documentId:'d'}}).ok,true)
})
test('mixed draft existence does not change the ownership of explicit Rust catalog history',()=>{
  assert.equal(inspect({...input,draftRuleSet:{templateFingerprint:'fixture-fingerprint',
    history:['draftA','draftB']}}).ok,true)
})
test('canonical native source comparison ignores key ordering but detects point changes',()=>{
  const swapped={panels:[{points:[[0,0],[1,0],[1,1]],id:'front'}]}
  assert.equal(inspect({...input,catalogStatus:{...catalogStatus,sourceTemplate:swapped}}).ok,true)
  const changed={panels:[{points:[[0,0],[9,0],[1,1]],id:'front'}]}
  assert.equal(inspect({...input,catalogStatus:{...catalogStatus,sourceTemplate:changed}}).ok,false)
})
test('blocks stale revision, changed garment, active fitting size and absent history',()=>{
  for(const s of [
    {...snapshot,revision:8},{...snapshot,template:{panels:[]}},{...snapshot,canUndo:false},
    {...snapshot,gradeRunPersisted:false},{...snapshot,activeGradedSize:'L'},
  ])assert.equal(inspect({...input,snapshot:s}).ok,false)
})
test('blocks untrusted local rule fingerprint and blocked native session',()=>{
  assert.equal(inspect({...input,draftRuleSet:{templateFingerprint:'other'}}).ok,false)
  assert.equal(inspect({...input,busy:true}).ok,false)
  assert.equal(inspect({...input,playing:true}).ok,false)
  assert.equal(inspect({...input,nativeBusy:true}).ok,false)
})
test('no unsolicited Rust Redo without a verified Undo witness',()=>{
  const s={...snapshot,revision:8,canRedo:true,gradeRunPersisted:false}
  assert.equal(inspect({direction:'redo',snapshot:s}).ok,false)
  assert.equal(inspect({direction:'redo',snapshot:s,redoWitness:{revision:8,
    templateKey:JSON.stringify(template),projectId:'different',documentId:'d'}}).ok,false)
})
test('rejects incorrect Rust result/garment identity even after request',()=>{
  const decision=inspect(input)
  for(const res of [
    {revision:7,template,gradeRunPersisted:false},
    {revision:8,template:{panels:[]},gradeRunPersisted:false},
    {revision:8,template,gradeRunPersisted:true},
    {revision:8,template,gradeRunPersisted:false,documentId:'other'},
  ])assert.equal(verify({decision,response:res,direction:'undo'}).ok,false)
})
