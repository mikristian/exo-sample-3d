import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'

// Execute the real debounced graphics callback, not a rewritten model.
const workspace=readFileSync(new URL('./ClothCraftWorkspace.jsx',import.meta.url),'utf8')
const source=workspace.slice(workspace.indexOf('const updateNativeGraphics=next=>{'),workspace.indexOf('const selectGraphicOnBoard=id=>{'))
assert.ok(source.startsWith('const updateNativeGraphics=next=>{'))

function harness({nativeReject=false}={}){
 const calls=[],notices=[],errors=[],visible=[],cached=[],timers=new Map()
 let nextTimer=1
 const state={current:{revision:7,template:{id:'garment-a',panels:[{id:'front'}]},projectId:'project-a'}}
 const graphicsDocumentRef={current:'exo-v2-print-layout:garment-a'}
 const graphicsEditVersion={current:0},graphicsPending={current:null},graphicsSaveTimer={current:null}
 const graphicsProjectEpoch={current:0}
 const context={state,graphicsDocumentRef,graphicsEditVersion,graphicsPending,graphicsSaveTimer,graphicsProjectEpoch,
  lock:{current:false},running:{current:false},preparePrintGraphic:graphic=>graphic,
  setNativeGraphics:value=>visible.push(value),saveNativeGraphics:async(key,value)=>{cached.push({key,value})},
  setError:message=>errors.push(message),setNotice:message=>notices.push(message),
  setTimeout:(callback)=>{const id=nextTimer++;timers.set(id,callback);return id},
  clearTimeout:id=>timers.delete(id),
  request:async payload=>{calls.push(payload);return nativeReject?null:{printGraphics:payload.printGraphics}},
 }
 const update=runInNewContext(`${source}\nupdateNativeGraphics`,context)
 const flush=async()=>{
  const scheduled=[...timers.values()];timers.clear()
  for(const callback of scheduled)callback()
  await new Promise(resolve=>setImmediate(resolve))
 }
 return {update,flush,calls,notices,errors,visible,cached,state,graphicsDocumentRef,graphicsProjectEpoch,graphicsPending}
}

const artwork=[{id:'print-a',panel:'front',widthMm:40,heightMm:20,positionMm:[10,10],format:'png'}]

test('debounced artwork must not be written into a different open project',async()=>{
 const h=harness()
 h.update(artwork)
 assert.equal(h.cached.length,0,'uncommitted preview must not masquerade as saved artwork cache')
 h.graphicsDocumentRef.current='exo-v2-print-layout:garment-b'
 h.state.current={revision:0,template:{id:'garment-b',panels:[{id:'front'}]},projectId:'project-b'}
 await h.flush()
 assert.equal(h.calls.length,0,'old garment artwork must never reach the newly opened Rust document')
 assert.equal(h.cached.length,0)
 assert.match(h.notices.join(' '),/not saved|changed|retry|review/i)
})

test('a changed native revision with the same artwork key blocks stale delayed writes',async()=>{
 const h=harness()
 h.update(artwork)
 h.state.current={...h.state.current,revision:8}
 await h.flush()
 assert.equal(h.calls.length,0)
 assert.equal(h.cached.length,0)
 assert.match(h.notices.join(' '),/not saved|changed|retry|review/i)
})

test('same template identity and revision still cannot cross a native project open',async()=>{
 const h=harness()
 h.update(artwork)
 h.graphicsProjectEpoch.current+=1
 await h.flush()
 assert.equal(h.calls.length,0)
 assert.equal(h.cached.length,0)
 assert.match(h.notices.join(' '),/not saved|changed|retry|review/i)
})

test('unchanged source saves artwork exactly once through native graphics-set',async()=>{
 const h=harness()
 h.update(artwork)
 await h.flush()
 assert.equal(h.calls.length,1)
 assert.equal(h.calls[0].op,'graphics-set')
 assert.equal(h.calls[0].printGraphics[0].id,'print-a')
 assert.equal(Object.hasOwn(h.calls[0].printGraphics[0],'format'),false)
 assert.equal(h.cached.length,1)
 assert.equal(h.cached[0].key,'exo-v2-print-layout:garment-a')
 assert.match(h.notices.join(' '),/Rust saved the artwork/i)
})

test('a rejected native graphics-set never becomes a durable migration cache',async()=>{
 const h=harness({nativeReject:true})
 h.update(artwork)
 await h.flush()
 assert.equal(h.calls.length,1)
 assert.equal(h.cached.length,0)
 assert.doesNotMatch(h.notices.join(' '),/Rust saved the artwork/i)
})

// Exercise the real native request handler as well: an open with identical
// source IDs/revision must still invalidate any old pending graphics timer.
const requestSource=workspace.slice(workspace.indexOf('const request=useCallback(async(data)=>'),workspace.indexOf('// On project reopen, a valid grade catalog'))
assert.ok(requestSource.startsWith('const request=useCallback(async(data)=>'))
async function runOpenRequest({accepted}){
 const state={current:{revision:7,template:{id:'garment-a',panels:[{id:'front'}]}}}
 const graphicsProjectEpoch={current:0},lock={current:false},nativeGradeLastError={current:''}
 const snapshots=[]
 const context={state,graphicsProjectEpoch,lock,nativeGradeLastError,
  useCallback:callback=>callback,BASE:'http://localhost',setBusy:()=>{},setError:()=>{},
  running:{current:false},setPlaying:()=>{},setS:value=>snapshots.push(value),
  fetch:async()=>({ok:accepted,json:async()=>accepted
   ?{ok:true,data:{revision:7,template:{id:'garment-a',panels:[{id:'front'}]}}}
   :{ok:false,error:'open rejected'}}),
 }
 const request=runInNewContext(`${requestSource}\nrequest`,context)
 const result=await request({op:'open',preset:'tshirt'})
 return {result,state,graphicsProjectEpoch,snapshots}
}

test('successful native open increments document epoch even with identical IDs and revision',async()=>{
 const h=await runOpenRequest({accepted:true})
 assert.equal(h.graphicsProjectEpoch.current,1)
 assert.equal(h.snapshots.length,1)
 assert.equal(h.result.revision,7)
})

test('rejected native open cannot invalidate a pending edit as though the document changed',async()=>{
 const h=await runOpenRequest({accepted:false})
 assert.equal(h.graphicsProjectEpoch.current,0)
 assert.equal(h.snapshots.length,0)
 assert.equal(h.result,null)
})
