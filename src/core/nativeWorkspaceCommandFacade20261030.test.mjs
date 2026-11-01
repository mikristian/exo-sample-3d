import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {nativeAnchorCoordinateRequest20261030 as anchor,nativeBoardResetBatchRequest20261030 as reset,nativeFacadeWireRequest20261030 as wire} from './nativeWorkspaceCommandFacade20261030.mjs'
const source=()=>({revision:3,template:{panels:[{id:'a',polygon:{points:[[0,0]]},pattern:{width:0.2}},{id:'b',polygon:{points:[[0,0]]},pattern:{width:0.1}}]}})
test('anchor DTO converts mm to native metres with frozen CAS revision',()=>{
 const snap=source(),cmd=anchor(snap,{panel:'a',anchor:0,positionMm:[125,75]})
 assert.deepEqual(cmd.command.position,[0.125,0.075]);assert.equal(cmd.revision,3)
 assert.equal(cmd.nativeUnit,'m');assert.equal(cmd.sourceUnit,'mm')
 assert.ok(Object.isFrozen(cmd.command.position));assert.throws(()=>cmd.command.position.push(1),TypeError)
 assert.throws(()=>anchor({...snap,revision:NaN},{panel:'a',anchor:0,positionMm:[1,2]}))
 assert.throws(()=>anchor(snap,{panel:'missing',anchor:0,positionMm:[1,2]}))
})
test('board reset selects immutable metres and refuses stale CAS',async()=>{
 const snap=source(),dto=reset(snap);assert.deepEqual(dto.commands.map(c=>c.origin),[[0,0],[0.35,0]])
 assert.ok(Object.isFrozen(dto.commands[1].origin))
 const calls=[];await wire(req=>{calls.push(req)},snap,dto)
 assert.deepEqual(calls[0].commands,dto.commands)
 assert.throws(()=>wire(()=>{}, {...snap,revision:4},dto),/Stale/)
 assert.throws(()=>reset({...snap,template:{panels:[{id:'bad',pattern:{width:Infinity}}]}}))
})
test('architecture gate: two real component operations route through facade',()=>{
 const c=readFileSync(new URL('../components/ClothCraftWorkspace.jsx',import.meta.url),'utf8')
 assert.match(c,/nativeAnchorCoordinateRequest20261030\(/)
 assert.match(c,/nativeBoardResetBatchRequest20261030\(/)
 assert.match(c,/nativeFacadeWireRequest20261030\(/)
 assert.doesNotMatch(c,/position\[i\]=Number\(e.target.value\)\/1000;edit\(\{kind:'Anchor'/)
})

test('extreme input and oversized board batches cannot reach native editor',()=>{
 const s={revision:3,template:{panels:[{id:'front',polygon:{points:[[0,0]]},pattern:{width:1}}]}}
 assert.throws(()=>anchor(s,{panel:'front',anchor:0,positionMm:[50001,0]}),/millimetres/)
 assert.throws(()=>anchor(s,{panel:'front',anchor:0,positionMm:[1e308,0]}),/millimetres/)
 assert.throws(()=>reset({...s,template:{panels:Array.from({length:257},(_,i)=>({id:'p'+i,pattern:{width:0.1}}))}}),/256/)
 assert.throws(()=>reset({...s,template:{panels:[{id:'front',pattern:{width:51}}]}}),/metres/)
})

test('actual frontend point and board writes use queued pause-safe facade with fresh CAS recheck',()=>{
 const source=readFileSync(new URL('../components/ClothCraftWorkspace.jsx',import.meta.url),'utf8')
 assert.match(source,/const runNativeFacadeSafely=async command=>/)
 assert.match(source,/while\(lock\.current\)await new Promise/)
 assert.match(source,/if\(running\.current\)\{[\s\S]{0,110}const paused=await request\(\{op:'pause'\}\)/)
 assert.match(source,/nativeFacadeWireRequest20261030\(request,state\.current,command\)/)
 assert.match(source,/void runNativeFacadeSafely\(command\)\.catch/)
 assert.match(source,/const result=await runNativeFacadeSafely\(command\)/)
})
