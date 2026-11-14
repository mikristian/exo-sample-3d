import test from 'node:test'
import assert from 'node:assert/strict'
import {
  encodeModaris2DGradeDraftJournal20261029 as encode,
  decodeModaris2DGradeDraftJournal20261029 as decode,
  persistModaris2DGradeDraftJournal20261029 as persist,
  clearModaris2DGradeDraftJournal20261029 as clear,
} from './modaris2DGradeDraftJournal20261029.js'
import {createAccuMarkNativeRuleSet,editAccuMarkNativePointRule,compileAccuMarkNativeRuleSizeRun} from './accumarkNativePointRuleSet20261023.js'

const key='exo-native-grade-sidecar:abc123'
const rule=value=>({templateFingerprint:'abc123',sizes:['XS','S','M','L','XL','XXL'],value})
const validate=value=>Array.isArray(value.sizes)&&value.sizes.length===6&&Number.isSafeInteger(value.value)
const make=(current=rule(3),undo=[null,rule(1),rule(2)],redo=[rule(4)])=>
  encode({key,current,undo,redo,validate})

test('reopen recovers independent undo and redo branches without altering the saved current rule set',()=>{
  const current=rule(3),text=make(current)
  const restored=decode(text,{key,current,validate})
  assert.deepEqual(restored.undo,[null,rule(1),rule(2)])
  assert.deepEqual(restored.redo,[rule(4)])
  restored.undo[2].value=999
  assert.equal(decode(text,{key,current,validate}).undo[2].value,2)
})

test('undo to an empty draft still preserves the redo branch across reopen',()=>{
  const text=make(null,[],[rule(3)])
  assert.deepEqual(decode(text,{key,current:null,validate}),{undo:[],redo:[rule(3)]})
})

test('partial sidecar write, changed source and checksum tampering fail closed',()=>{
  const text=make()
  assert.throws(()=>decode(text,{key,current:rule(5),validate}),/disagrees/i)
  assert.throws(()=>decode(text,{key:key+'-changed',current:rule(3),validate}),/stale|source/i)
  const forged=JSON.parse(text)
  forged.payload.undo[1].value=500
  assert.throws(()=>decode(JSON.stringify(forged),{key,current:rule(3),validate}),/checksum/i)
  assert.throws(()=>decode(text.slice(0,-1),{key,current:rule(3),validate}),/json|unexpected/i)
})

test('rejects wrong-fingerprint entries, oversized history and invalid saved grades',()=>{
  assert.throws(()=>make(rule(3),[rule(2),{...rule(1),templateFingerprint:'another'}],[]),/source/i)
  assert.throws(()=>make(rule(3),Array(41).fill(null),[]),/bounds/i)
  assert.throws(()=>make(rule(3),[rule(NaN)],[]),/source/i)
  assert.throws(()=>decode(make(),{key,current:rule(3),validate:()=>false}),/source/i)
})

test('real six-size curved native grading rule sets survive journal reload with their exact point-rule edits',()=>{
  const snapshot={template:{panels:[
    {id:'front',polygon:{points:[[0,0],[.2,0],[.2,.3],[0,.3]],edges:['a','b','c','d'],
      curves:{a:[[.04,-.05],[.16,-.05]]}}},
    {id:'back',polygon:{points:[[0,0],[.2,0],[.2,.3],[0,.3]],edges:['a','b','c','d']}},
  ]}}
  const created=createAccuMarkNativeRuleSet(snapshot)
  assert.equal(created.ok,true,created.reason)
  const changed=editAccuMarkNativePointRule(snapshot,created.ruleSet,{
    panelId:'front',pointIndex:1,size:'L',dxMm:8,dyMm:3,
  })
  assert.equal(changed.ok,true,changed.reason)
  const realKey=`exo-native-grade-sidecar:${created.ruleSet.templateFingerprint}`
  const validateRule=value=>compileAccuMarkNativeRuleSizeRun(snapshot,value,{selectedSize:value.baseSize}).ok===true
  const text=encode({key:realKey,current:changed.ruleSet,undo:[created.ruleSet],redo:[],validate:validateRule})
  const recovered=decode(text,{key:realKey,current:structuredClone(changed.ruleSet),validate:validateRule})
  // JSON persistence intentionally normalizes null-prototype CAD maps.
  assert.deepEqual(recovered.undo,[JSON.parse(JSON.stringify(created.ruleSet))])
  assert.equal(compileAccuMarkNativeRuleSizeRun(snapshot,recovered.undo[0]).ok,true)
  assert.equal(compileAccuMarkNativeRuleSizeRun(snapshot,changed.ruleSet,{selectedSize:'L'}).ok,true)
})

const memoryStorage=()=>{
  const data=new Map()
  return {data,getItem:k=>data.has(k)?data.get(k):null,
    setItem(k,v){data.set(k,v)},removeItem(k){data.delete(k)}}
}

const expected=(current=null,undo=[],redo=[])=>({current,undo,redo})

test('staged storage writes both keys and preserves Undo/Redo on a simulated browser reload',()=>{
  const storage=memoryStorage(),current=rule(2),historyKey=`${key}:history-v1`
  assert.equal(persist(storage,{key,current,undo:[rule(1)],redo:[],validate,expected:expected()}),true)
  assert.deepEqual(JSON.parse(storage.getItem(key)),current)
  assert.deepEqual(decode(storage.getItem(historyKey),{key,current,validate}).undo,[rule(1)])
  assert.equal(persist(storage,{key,current:null,undo:[],redo:[current],validate,
    expected:expected(current,[rule(1)],[])}),true)
  assert.equal(storage.getItem(key),null)
  assert.deepEqual(decode(storage.getItem(historyKey),{key,current:null,validate}).redo,[current])
  assert.equal(clear(storage,key,{expected:expected(null,[],[current]),validate}),true)
  assert.equal(storage.getItem(key),null)
  assert.equal(storage.getItem(historyKey),null)
})

test('failed current-sidecar write refuses success, rolls back staged history, and preserves saved current',()=>{
  const storage=memoryStorage(),historyKey=`${key}:history-v1`
  persist(storage,{key,current:rule(1),undo:[null],redo:[],validate,expected:expected()})
  const oldCurrent=storage.getItem(key),oldJournal=storage.getItem(historyKey)
  const original=storage.setItem
  storage.setItem=function(k,v){if(k===key)throw Error('quota full');return original.call(this,k,v)}
  assert.throws(()=>persist(storage,{key,current:rule(2),undo:[rule(1)],redo:[],validate,
    expected:expected(rule(1),[null],[])}),/quota full/i)
  assert.equal(storage.getItem(key),oldCurrent)
  assert.equal(storage.getItem(historyKey),oldJournal)
  assert.deepEqual(decode(storage.getItem(historyKey),{key,current:rule(1),validate}).undo,[null])
})

test('failed local clear preserves visible storage state and cannot falsely report success',()=>{
  const storage=memoryStorage(),historyKey=`${key}:history-v1`
  persist(storage,{key,current:rule(2),undo:[rule(1)],redo:[],validate,expected:expected()})
  const oldJournal=storage.getItem(historyKey)
  const original=storage.removeItem
  storage.removeItem=function(k){if(k===key)throw Error('denied');return original.call(this,k)}
  assert.throws(()=>clear(storage,key,{expected:expected(rule(2),[rule(1)],[]),validate}),/denied/i)
  assert.deepEqual(JSON.parse(storage.getItem(key)),rule(2))
  assert.equal(storage.getItem(historyKey),oldJournal)
})

test('stale second workspace cannot overwrite a newer grading edit from the first workspace',()=>{
  const storage=memoryStorage(),historyKey=`${key}:history-v1`
  const initial=expected()
  persist(storage,{key,current:rule(1),undo:[null],redo:[],validate,expected:initial})
  const first=expected(rule(1),[null],[])
  persist(storage,{key,current:rule(2),undo:[null,rule(1)],redo:[],validate,expected:first})
  const afterCurrent=storage.getItem(key),afterJournal=storage.getItem(historyKey)
  assert.throws(()=>persist(storage,{key,current:rule(3),undo:[null,rule(1)],redo:[],validate,expected:first}),/changed|stale|reload/i)
  assert.equal(storage.getItem(key),afterCurrent)
  assert.equal(storage.getItem(historyKey),afterJournal)
  assert.deepEqual(decode(afterJournal,{key,current:rule(2),validate}).undo,[null,rule(1)])
})

test('same current draft but externally changed Undo/Redo branch blocks stale history and destructive clear',()=>{
  const storage=memoryStorage(),historyKey=`${key}:history-v1`
  persist(storage,{key,current:rule(2),undo:[rule(1)],redo:[],validate,expected:expected()})
  const old=expected(rule(2),[rule(1)],[])
  // Another window rebuilt the history branch without changing the visible
  // grade rule, so checking only the current rule would miss the conflict.
  persist(storage,{key,current:rule(2),undo:[],redo:[rule(3)],validate,expected:old})
  const afterCurrent=storage.getItem(key),afterJournal=storage.getItem(historyKey)
  assert.throws(()=>persist(storage,{key,current:rule(4),undo:[rule(2)],redo:[],validate,expected:old}),/changed|stale|reload/i)
  assert.throws(()=>clear(storage,key,{expected:old,validate}),/changed|stale|reload/i)
  assert.equal(storage.getItem(key),afterCurrent)
  assert.equal(storage.getItem(historyKey),afterJournal)
})

test('guarded clear succeeds only with the current matching history snapshot',()=>{
  const storage=memoryStorage()
  persist(storage,{key,current:rule(2),undo:[rule(1)],redo:[],validate,expected:expected()})
  assert.equal(clear(storage,key,{expected:expected(rule(2),[rule(1)],[]),validate}),true)
  assert.equal(storage.getItem(key),null)
  assert.equal(storage.getItem(`${key}:history-v1`),null)
})

test('missing precondition or corrupted stored history cannot be used to overwrite or clear a grading draft',()=>{
  const storage=memoryStorage(),historyKey=`${key}:history-v1`
  assert.throws(()=>persist(storage,{key,current:rule(1),undo:[],redo:[],validate}),/expected|reload/i)
  assert.equal(storage.getItem(key),null)
  persist(storage,{key,current:rule(1),undo:[null],redo:[],validate,expected:expected()})
  storage.setItem(historyKey,'{"corrupted":true}')
  const oldCurrent=storage.getItem(key),oldJournal=storage.getItem(historyKey)
  assert.throws(()=>persist(storage,{key,current:rule(2),undo:[rule(1)],redo:[],validate,
    expected:expected(rule(1),[null],[])}),/stale|invalid|reload/i)
  assert.throws(()=>clear(storage,key,{expected:expected(rule(1),[null],[]),validate}),/stale|invalid|reload/i)
  assert.equal(storage.getItem(key),oldCurrent)
  assert.equal(storage.getItem(historyKey),oldJournal)
})

test('interleaved second workspace write after preflight cannot falsely report successful grading persistence',()=>{
  const storage=memoryStorage(),historyKey=`${key}:history-v1`
  persist(storage,{key,current:rule(1),undo:[null],redo:[],validate,expected:expected()})
  const original=storage.setItem
  let injected=false
  storage.setItem=function(k,v){
    original.call(this,k,v)
    // Another tab writes a different valid history between our journal
    // stage and current-sidecar commit. The first tab must not claim that
    // both of its keys were durably committed.
    if(k===key&&!injected){
      injected=true
      original.call(this,historyKey,make(rule(1),[null,rule(4)],[]))
    }
  }
  assert.throws(()=>persist(storage,{key,current:rule(2),undo:[null,rule(1)],redo:[],validate,
    expected:expected(rule(1),[null],[])}),/concurrent|verify|reopen/i)
  assert.equal(injected,true)
  assert.notEqual(storage.getItem(historyKey),make(rule(2),[null,rule(1)],[]))
})

test('interleaved history rewrite during clear cannot falsely report cleared grading draft',()=>{
  const storage=memoryStorage(),historyKey=`${key}:history-v1`
  persist(storage,{key,current:rule(1),undo:[null],redo:[],validate,expected:expected()})
  const original=storage.removeItem
  let injected=false
  storage.removeItem=function(k){
    original.call(this,k)
    if(k===key&&!injected){
      injected=true
      storage.data.set(historyKey,make(null,[],[rule(3)]))
    }
  }
  assert.throws(()=>clear(storage,key,{expected:expected(rule(1),[null],[]),validate}),/concurrent|verify|reopen/i)
  assert.equal(injected,true)
  assert.notEqual(storage.getItem(historyKey),null)
})

test('failed current write must not roll back a newer concurrent grading journal',()=>{
  const storage=memoryStorage(),historyKey=`${key}:history-v1`
  persist(storage,{key,current:rule(1),undo:[null],redo:[],validate,expected:expected()})
  const newerCurrent=JSON.stringify(rule(3))
  const newerJournal=make(rule(3),[null,rule(1),rule(2)],[])
  const original=storage.setItem
  let interleaved=false
  storage.setItem=function(k,v){
    if(k===key&&!interleaved){
      interleaved=true
      // A second workspace completed a newer pair while the first was
      // attempting to commit its current rule; then the first write failed.
      storage.data.set(key,newerCurrent)
      storage.data.set(historyKey,newerJournal)
      throw Error('quota full during first workspace commit')
    }
    return original.call(this,k,v)
  }
  assert.throws(()=>persist(storage,{key,current:rule(2),undo:[null,rule(1)],redo:[],validate,
    expected:expected(rule(1),[null],[])}),/concurrent|reopen|reconcile/i)
  assert.equal(interleaved,true)
  assert.equal(storage.getItem(key),newerCurrent)
  assert.equal(storage.getItem(historyKey),newerJournal,
    'The failed older writer must not replace another workspace\'s committed history')
  assert.deepEqual(decode(newerJournal,{key,current:rule(3),validate}).undo,[null,rule(1),rule(2)])
})

test('failed clear must not restore old history over a concurrent grading save',()=>{
  const storage=memoryStorage(),historyKey=`${key}:history-v1`
  persist(storage,{key,current:rule(1),undo:[null],redo:[],validate,expected:expected()})
  const newerCurrent=JSON.stringify(rule(3))
  const newerJournal=make(rule(3),[null,rule(1),rule(2)],[])
  const original=storage.removeItem
  let interleaved=false
  storage.removeItem=function(k){
    if(k===key&&!interleaved){
      interleaved=true
      storage.data.set(key,newerCurrent)
      storage.data.set(historyKey,newerJournal)
      throw Error('clear denied during first workspace operation')
    }
    return original.call(this,k)
  }
  assert.throws(()=>clear(storage,key,{expected:expected(rule(1),[null],[]),validate}),
    /concurrent|reopen|reconcile/i)
  assert.equal(interleaved,true)
  assert.equal(storage.getItem(key),newerCurrent)
  assert.equal(storage.getItem(historyKey),newerJournal,
    'The failed clear must not overwrite another workspace\'s saved history')
  assert.deepEqual(decode(newerJournal,{key,current:rule(3),validate}).undo,[null,rule(1),rule(2)])
})
