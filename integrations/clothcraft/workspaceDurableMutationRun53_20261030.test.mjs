import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {fileURLToPath} from 'node:url'

// Execute the actual generic native request branch, not a reimplementation.
// Rust may accept an edit in memory but reject its subsequent disk save.
const source=fs.readFileSync(fileURLToPath(new URL('./workspace.mjs',import.meta.url)),'utf8')
const start=source.indexOf('   const result=remember(await rpc(data))\n')
const end=source.indexOf('   if(runError&&data.op===',start)
assert.ok(start>=0&&end>start,'native mutation branch must be extractable')
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor
const execute=new AsyncFunction('data','remember','rpc','save','stepsSinceSave','runError',
  source.slice(start,end)+'\nreturn result')

function run(op,{saveOk=true,nativeOk=true}={}){
  let saves=0
  return {
    get saves(){return saves},
    promise:execute({op,revision:4},x=>x,async()=>({ok:nativeOk,data:{revision:5}}),
      async()=>{saves++;return saveOk?{ok:true}:{ok:false,error:'Disk full'}},0,null),
  }
}

test('all generic durable native mutations reject a failed disk save instead of reporting success',async()=>{
  for(const op of ['edit','edit-batch','undo','redo','graphics-set','grade-pattern','hardware-set','set-property']){
    const action=run(op,{saveOk:false})
    await assert.rejects(action.promise,/Disk full|not saved|durable/i,op)
    assert.equal(action.saves,1,`${op} must attempt native save`)
  }
})

test('successful durable mutation still acknowledges the native result',async()=>{
  const action=run('edit')
  assert.deepEqual(await action.promise,{ok:true,data:{revision:5}})
  assert.equal(action.saves,1)
})

test('rejected native edit never invokes disk save or reports success',async()=>{
  const action=run('edit',{nativeOk:false})
  assert.deepEqual(await action.promise,{ok:false,data:{revision:5}})
  assert.equal(action.saves,0)
})

test('read-only native inspection never requests a durable mutation save',async()=>{
  const action=run('snapshot',{saveOk:false})
  assert.deepEqual(await action.promise,{ok:true,data:{revision:5}})
  assert.equal(action.saves,0)
})
