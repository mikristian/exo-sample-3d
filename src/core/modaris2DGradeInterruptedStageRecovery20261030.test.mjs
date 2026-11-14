import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
import {
  encodeModaris2DGradeDraftJournal20261029 as encode,
  persistModaris2DGradeDraftJournal20261029 as persist,
  inspectInterruptedModaris2DGradeDraftStage20261030 as inspect,
  recoverInterruptedModaris2DGradeDraftStage20261030 as recover,
} from './modaris2DGradeDraftJournal20261029.js'

const key='exo-native-grade-sidecar:crash-fixture'
const historyKey=`${key}:history-v1`
const rule=value=>({templateFingerprint:'crash-fixture',sizes:['XS','S','M','L','XL','XXL'],value})
const validate=x=>Array.isArray(x.sizes)&&x.sizes.length===6&&Number.isSafeInteger(x.value)
const storage=()=>{const data=new Map();return {data,getItem:k=>data.has(k)?data.get(k):null,
  setItem(k,v){data.set(k,v)},removeItem(k){data.delete(k)}}}
const stage=(s,current,undo,redo)=>s.setItem(historyKey,encode({key,current,undo,redo,validate}))

test('crash after journal stage: explicit recovery preserves old six-size current and permits fresh edits',()=>{
  const s=storage()
  s.setItem(key,JSON.stringify(rule(1)))
  stage(s,rule(2),[null,rule(1)],[])
  const witness=inspect(s,{key,validate})
  assert.equal(witness.ok,true,witness.reason)
  assert.equal(recover(s,{key,validate,witness}),true)
  assert.equal(s.getItem(historyKey),null)
  assert.deepEqual(JSON.parse(s.getItem(key)),rule(1))
  assert.equal(persist(s,{key,current:rule(3),undo:[rule(1)],redo:[],validate,
    expected:{current:rule(1),undo:[],redo:[]}}),true)
})

test('interrupted Undo stage can be explicitly abandoned without altering current grading',()=>{
  const s=storage()
  s.setItem(key,JSON.stringify(rule(2)))
  stage(s,rule(1),[],[rule(2)])
  const witness=inspect(s,{key,validate})
  assert.equal(witness.ok,true,witness.reason)
  assert.equal(recover(s,{key,validate,witness}),true)
  assert.deepEqual(JSON.parse(s.getItem(key)),rule(2))
})

test('corrupt or unrelated mismatched journal never qualifies for discard',()=>{
  const s=storage()
  s.setItem(key,JSON.stringify(rule(1)))
  s.setItem(historyKey,'{"broken":true}')
  assert.equal(inspect(s,{key,validate}).ok,false)
  stage(s,rule(3),[rule(2)],[])
  assert.equal(inspect(s,{key,validate}).ok,false)
  assert.notEqual(s.getItem(historyKey),null)
})

test('oversized interrupted storage is refused before parsing or mutating saved grading',()=>{
  const s=storage()
  s.setItem(key,JSON.stringify(rule(1)))
  s.setItem(historyKey,'x'.repeat(1501000))
  assert.match(inspect(s,{key,validate}).reason,/oversized|invalid/i)
  assert.equal(s.getItem(historyKey).length,1501000)
})

test('a valid matching journal is not an interrupted stage and must never be discarded',()=>{
  const s=storage()
  s.setItem(key,JSON.stringify(rule(2)))
  stage(s,rule(2),[rule(1)],[])
  assert.equal(inspect(s,{key,validate}).ok,false)
  assert.notEqual(s.getItem(historyKey),null)
})

test('stale recovery witness cannot delete a newer second-workspace journal or sidecar',()=>{
  const s=storage()
  s.setItem(key,JSON.stringify(rule(1)))
  stage(s,rule(2),[rule(1)],[])
  const witness=inspect(s,{key,validate})
  assert.equal(witness.ok,true,witness.reason)
  stage(s,rule(3),[rule(1)],[])
  const newer=s.getItem(historyKey)
  assert.throws(()=>recover(s,{key,validate,witness}),/changed|reopen|stale/i)
  assert.equal(s.getItem(historyKey),newer)
  s.setItem(historyKey,witness.journalText)
  s.setItem(key,JSON.stringify(rule(4)))
  assert.throws(()=>recover(s,{key,validate,witness}),/changed|reopen|stale/i)
  assert.equal(s.getItem(historyKey),witness.journalText)
})

test('readback mismatch during recovery refuses success rather than claiming repaired history',()=>{
  const s=storage()
  s.setItem(key,JSON.stringify(rule(1)))
  stage(s,rule(2),[rule(1)],[])
  const witness=inspect(s,{key,validate})
  assert.equal(witness.ok,true,witness.reason)
  const original=s.removeItem
  s.removeItem=function(k){original.call(this,k);if(k===historyKey)stage(this,rule(4),[rule(1)],[])}
  assert.throws(()=>recover(s,{key,validate,witness}),/verify|concurrent|reopen/i)
  assert.notEqual(s.getItem(historyKey),null)
})

test('actual 2D workspace exposes explicit operator recovery without automatic journal deletion',()=>{
  const jsx=readFileSync(new URL('../components/ClothCraftWorkspace.jsx',import.meta.url),'utf8')
  assert.doesNotThrow(()=>transformSync(jsx,{loader:'jsx',format:'esm'}))
  const load=jsx.slice(jsx.indexOf('// Autosaved separate rule sidecars'),jsx.indexOf('const commitNativeGradeRuleSet=next=>'))
  assert.match(load,/inspectInterruptedModaris2DGradeDraftStage20261030\(localStorage/)
  assert.match(load,/setNativeGradeInterruptedStageWitness\(interrupted\)/)
  const handler=jsx.slice(jsx.indexOf('const recoverInterruptedNativeGradeDraft=()=>'),jsx.indexOf('const commitNativeGradeRuleSet=next=>'))
  assert.match(handler,/recoverInterruptedModaris2DGradeDraftStage20261030\(localStorage/)
  assert.match(handler,/busy\|\|playing\|\|s\?\.activeGradedSize/)
  assert.match(jsx,/onClick=\{recoverInterruptedNativeGradeDraft\}>Recover Interrupted Draft/)
  assert(!load.includes('storage.removeItem('),'A workspace reload must never silently discard interrupted local history')
})
