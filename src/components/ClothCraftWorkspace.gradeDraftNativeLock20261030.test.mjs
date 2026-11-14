import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'

const workspace = readFileSync(new URL('./ClothCraftWorkspace.jsx', import.meta.url), 'utf8')
const begin = workspace.indexOf('const restoreNativeGradeDraft=direction=>{')
const end = workspace.indexOf('const clearNativeGradeRuleSet=()=>{', begin)
assert.ok(begin >= 0 && end > begin)
const callback = workspace.slice(begin, end)

function harness({locked = false, running = false} = {}) {
  const original = {templateFingerprint:'fixture', baseSize:'M', label:'old'}
  const next = {...original, label:'undo-target'}
  const lock = {current:locked}
  const solver = {current:running}
  const history = {current:{undo:[next], redo:[]}}
  const draft = {current:original}
  const writes = []
  const context = {
    busy:false, playing:false, lock, running:solver,
    s:{template:{panels:[{id:'front'}]}},nativeRuleDraftKey:'exo-native-grade-sidecar:fixture',
    nativeGradeDraftHistory:history, nativeGradeRulesRef:draft,
    compileAccuMarkNativeRuleSizeRun:()=>({ok:true}),
    persistNativeGradeDraftJournal:(...args)=>writes.push(args),
    setNativeGradeRuleMessage:()=>{},setNativeGradeRules:()=>{},
    setGradeDraftHistoryRevision:()=>{},setNativeGradeCatalogStatus:()=>{},
    setNativeGradeCatalogMessage:()=>{},setGradeNestPinned:()=>{},setGradeNestEnabled:()=>{},
  }
  const restore = runInNewContext(`${callback}\nrestoreNativeGradeDraft`, context)
  return {restore, lock, solver, history, draft, writes, original, next}
}

test('grade draft Undo cannot advance during a native RPC before React busy renders', () => {
  const h = harness({locked:true})
  assert.equal(h.restore('undo'), false)
  assert.equal(h.writes.length, 0)
  assert.equal(h.history.current.undo.length, 1)
  assert.equal(h.draft.current, h.original)
  h.lock.current = false
  assert.equal(h.restore('undo'), true)
  assert.equal(h.writes.length, 1)
  assert.equal(h.draft.current, h.next)
})

test('grade draft Redo/Undo cannot persist while a native solver step is running', () => {
  const h = harness({running:true})
  assert.equal(h.restore('undo'), false)
  assert.equal(h.writes.length, 0)
  h.solver.current = false
  assert.equal(h.restore('undo'), true)
  h.solver.current = true
  assert.equal(h.restore('redo'), false)
  assert.equal(h.writes.length, 1)
})
