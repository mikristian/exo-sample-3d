import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveModaris2DHistoryPriority20261029 as route} from './modaris2DHistoryPriority20261029.js'

test('mixed Rust and grading draft Undo must not silently pick a nonchronological operation',()=>{
 const decision=route({direction:'undo',draftUndoCount:2,draftRedoCount:0,
   draftEligible:true,nativeUndoAvailable:true,nativeRedoAvailable:false})
 assert.equal(decision.route,'blocked')
 assert.match(decision.reason,/chronolog|separate|ambiguous/i)
})

test('mixed Rust and grading draft Redo must not replay an invalidated branch',()=>{
 const decision=route({direction:'redo',draftUndoCount:0,draftRedoCount:1,
   draftEligible:true,nativeUndoAvailable:true,nativeRedoAvailable:false})
 assert.equal(decision.route,'blocked')
})

test('a grading Redo branch blocks native Undo until its ordering is explicitly resolved',()=>{
 const decision=route({direction:'undo',draftUndoCount:0,draftRedoCount:1,
   draftEligible:true,nativeUndoAvailable:true,nativeRedoAvailable:false})
 assert.equal(decision.route,'blocked')
})

test('unmixed histories retain their appropriate domain and malformed flags fail closed',()=>{
 assert.equal(route({direction:'undo',draftUndoCount:1,draftEligible:true,
   nativeUndoAvailable:false,nativeRedoAvailable:false}).route,'draft')
 assert.equal(route({direction:'undo',draftUndoCount:0,draftRedoCount:0,
   nativeUndoAvailable:true,nativeRedoAvailable:false}).route,'native')
 assert.equal(route({direction:'undo',draftUndoCount:1,draftEligible:true,
   nativeUndoAvailable:'yes',nativeRedoAvailable:false}).route,'blocked')
})
