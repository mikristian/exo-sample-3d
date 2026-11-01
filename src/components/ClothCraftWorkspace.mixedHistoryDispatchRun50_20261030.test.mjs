import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {resolveModaris2DHistoryPriority20261029} from '../core/modaris2DHistoryPriority20261029.js'

// Execute the real component callback with controlled state, not a copy of its logic.
const workspace=readFileSync(new URL('./ClothCraftWorkspace.jsx',import.meta.url),'utf8')
const source=workspace.slice(workspace.indexOf('const requestHistory=async op=>'),workspace.indexOf('const canUndo2D='))
assert.ok(source.startsWith('const requestHistory=async op=>{'))

function harness({draftUndo=0,draftRedo=0,nativeUndo=false,nativeRedo=false,eligible=true,
  authoritativeNativeUndo=nativeUndo,snapshotFails=false,
  snapshotChangesRevision=false,snapshotChangesTemplate=false,
  snapshotChangesDraftHistory=false,snapshotMutatesTemplateInPlace=false}={}){
 const calls=[],notices=[],restores=[]
 const state={current:{revision:4,template:{panels:[{id:'front'}]},canUndo:nativeUndo,canRedo:nativeRedo}}
 const nativeGradeDraftHistory={current:{undo:Array(draftUndo).fill({}),redo:Array(draftRedo).fill({})}}
 const context={state,nativeGradeDraftHistory,running:{current:false},lock:{current:false},
   nativeRuleDraftKey:eligible?'source-key':null,s:state.current,busy:false,playing:false,
   resolveModaris2DHistoryPriority20261029,
   setNotice:notice=>notices.push(notice),
   restoreNativeGradeDraft:direction=>{restores.push(direction);return true},
   request:async payload=>{
    calls.push(payload)
    if(payload.op==='snapshot'){
     if(snapshotFails)return null
     if(snapshotChangesDraftHistory)nativeGradeDraftHistory.current={undo:[{}],redo:[]}
     if(snapshotMutatesTemplateInPlace)state.current.template.panels[0].id='mutated-in-place'
     state.current={...state.current,canUndo:authoritativeNativeUndo,
       revision:state.current.revision+(snapshotChangesRevision?1:0),
       template:snapshotChangesTemplate?{panels:[{id:'different-garment'}]}:state.current.template}
    }
    return {...state.current}
   },
   setTimeout,
 }
 const callback=runInNewContext(`${source}\nrequestHistory`,context)
 return {run:direction=>callback(direction),calls,notices,restores,state,context}
}

test('real global Undo handler refuses mixed Rust and draft history without mutation',async()=>{
 const h=harness({draftUndo:2,nativeUndo:true})
 assert.equal(await h.run('undo'),null)
 assert.equal(h.calls.length,1)
 assert.equal(h.calls[0].op,'snapshot')
 assert.equal(h.restores.length,0)
 assert.match(h.notices[0],/ambiguous chronology/)
 assert.equal(h.state.current.revision,4)
})

test('real global Redo handler refuses mixed branches without replaying either',async()=>{
 const h=harness({draftRedo:1,nativeUndo:true})
 assert.equal(await h.run('redo'),null)
 assert.equal(h.calls.length,1)
 assert.equal(h.calls[0].op,'snapshot')
 assert.deepEqual(h.restores,[])
})

test('real global Undo still restores an eligible draft when native history is empty',async()=>{
 const h=harness({draftUndo:1})
 assert.equal((await h.run('undo')).gradeDraftHistoryApplied,true)
 assert.deepEqual(h.restores,['undo'])
 assert.equal(h.calls.length,1)
 assert.equal(h.calls[0].op,'snapshot')
})

test('real global Undo still dispatches Rust operation when local history is empty',async()=>{
 const h=harness({nativeUndo:true})
 assert.equal((await h.run('undo')).revision,4)
 assert.equal(h.calls.length,1)
 assert.equal(h.calls[0].op,'undo')
 assert.equal(h.restores.length,0)
})

test('stale browser flags cannot hide native history from a grading Undo',async()=>{
 const h=harness({draftUndo:1,nativeUndo:false,authoritativeNativeUndo:true})
 assert.equal(await h.run('undo'),null)
 assert.equal(h.calls.length,1)
 assert.equal(h.calls[0].op,'snapshot')
 assert.equal(h.restores.length,0)
 assert.match(h.notices[0],/ambiguous chronology/)
})

test('failed authoritative snapshot cannot authorize grading draft Undo',async()=>{
 const h=harness({draftUndo:1,snapshotFails:true})
 assert.equal(await h.run('undo'),null)
 assert.equal(h.calls.length,1)
 assert.equal(h.restores.length,0)
 assert.match(h.notices[0],/could not be verified/)
})

test('external native revision change during snapshot must not restore an old grading draft',async()=>{
 const h=harness({draftUndo:1,snapshotChangesRevision:true})
 assert.equal(await h.run('undo'),null)
 assert.deepEqual(h.restores,[])
 assert.match(h.notices[0],/changed|recheck|source/i)
})

test('same-revision project/template replacement during snapshot must not restore old grading rules',async()=>{
 const h=harness({draftUndo:1,snapshotChangesTemplate:true})
 assert.equal(await h.run('undo'),null)
 assert.deepEqual(h.restores,[])
 assert.match(h.notices[0],/changed|recheck|source/i)
})

test('concurrent local draft history replacement during snapshot must not replay a stale branch',async()=>{
 const h=harness({draftUndo:1,snapshotChangesDraftHistory:true})
 assert.equal(await h.run('undo'),null)
 assert.deepEqual(h.restores,[])
 assert.match(h.notices[0],/changed|recheck|source/i)
})

test('stable native snapshot still permits explicit single-domain global draft Redo',async()=>{
 const h=harness({draftRedo:1})
 assert.equal((await h.run('redo')).gradeDraftHistoryApplied,true)
 assert.deepEqual(h.restores,['redo'])
 assert.equal(h.calls[0].op,'snapshot')
})

test('native source change during snapshot blocks grading Redo as well as Undo',async()=>{
 const h=harness({draftRedo:1,snapshotChangesRevision:true})
 assert.equal(await h.run('redo'),null)
 assert.deepEqual(h.restores,[])
 assert.match(h.notices[0],/changed|recheck|source/i)
})

test('in-place source geometry mutation during asynchronous verification fails closed',async()=>{
 const h=harness({draftUndo:1,snapshotMutatesTemplateInPlace:true})
 assert.equal(await h.run('undo'),null)
 assert.deepEqual(h.restores,[])
 assert.match(h.notices[0],/changed|recheck|source/i)
})
