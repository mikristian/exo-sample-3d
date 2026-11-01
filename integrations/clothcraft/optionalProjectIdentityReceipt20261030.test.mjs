import test from 'node:test'
import assert from 'node:assert/strict'
import {createOptionalProjectIdentityReceipt as create,verifyOptionalProjectIdentityReceipt as verify,advanceOptionalProjectIdentityReceipt as advance} from './optionalProjectIdentityReceipt20261030.mjs'

const project=(point=1)=>({version:1,template:{name:'same',panels:[{id:'front',name:'front',polygon:{points:[[0,0],[point,0],[1,1]]}}],fabrics:[{id:'shell',name:'cotton'}],seams:[]},state:null,mesh_signature:null})
test('same-name and same-panel-ID imported source cannot inherit bound identity',()=>{
 const first=project(),second=project(3),receipt=create(first)
 assert.equal(verify(receipt,first).ok,true)
 assert.deepEqual(verify(receipt,second),{ok:false,reason:'SOURCE_DIGEST_MISMATCH'})
 assert.equal(verify(receipt,first,{expectedProjectId:cryptoFallbackId(receipt)}).reason,'PROJECT_ID_MISMATCH')
})
const cryptoFallbackId=receipt=>receipt.projectId==='00000000-0000-4000-8000-000000000001'?'00000000-0000-4000-8000-000000000002':'00000000-0000-4000-8000-000000000001'
test('generation and source revision receipts require caller expected values',()=>{
 const before=project(),after=project(2),r=create(before,{generation:4,sourceRevision:13})
 assert.equal(verify(r,before,{expectedGeneration:3}).reason,'GENERATION_MISMATCH')
 assert.equal(verify(r,before,{expectedSourceRevision:14}).reason,'SOURCE_REVISION_MISMATCH')
 const next=advance(r,before,after,{sourceRevision:14})
 assert.equal(next.projectId,r.projectId)
 assert.equal(next.generation,5)
 assert.equal(verify(next,after,{expectedGeneration:5,expectedSourceRevision:14}).ok,true)
 assert.throws(()=>advance(r,after,before),/PREVIOUS_SOURCE_MISMATCH/)
})
test('legacy absent, malformed and mutated receipts fail closed without modifying native schema',()=>{
 const source=project(),r=create(source)
 assert.deepEqual(verify(null,source),{ok:false,reason:'MISSING_RECEIPT',legacy:true})
 assert.equal(verify({...r,unrecognized:true},source).reason,'INVALID_RECEIPT')
 assert.equal(verify({...r,sourceDigest:'bad'},source).reason,'INVALID_RECEIPT')
 assert.equal('projectId' in source,false)
})
