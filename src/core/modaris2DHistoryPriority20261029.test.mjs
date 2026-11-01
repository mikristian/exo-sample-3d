import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveModaris2DHistoryPriority20261029 as route} from './modaris2DHistoryPriority20261029.js'

test('global Undo and Redo prefer pending grading drafts over unrelated native geometry',()=>{
  assert.equal(route({direction:'undo',draftUndoCount:2,draftEligible:true}).route,'draft')
  assert.equal(route({direction:'redo',draftRedoCount:1,draftEligible:true}).route,'draft')
  assert.equal(route({direction:'undo',draftUndoCount:0,draftRedoCount:1,draftEligible:true}).route,'native')
  assert.equal(route({direction:'redo',draftUndoCount:1,draftRedoCount:0,draftEligible:true}).route,'native')
})

test('stale or unqualified grading history blocks rather than undoing unrelated Rust edits',()=>{
  const blocked=route({direction:'undo',draftUndoCount:1,draftEligible:false})
  assert.equal(blocked.route,'blocked')
  assert.match(blocked.reason,/current native pattern/i)
  assert.equal(route({direction:'redo',draftRedoCount:1,draftEligible:false}).route,'blocked')
  assert.equal(route({direction:'undo',draftUndoCount:-1,draftEligible:true}).route,'blocked')
  assert.equal(route({direction:'not-an-op',draftUndoCount:1,draftEligible:true}).route,'blocked')
})

test('without grading history native Rust remains authoritative',()=>{
  for(const direction of ['undo','redo'])
    assert.equal(route({direction,draftUndoCount:0,draftRedoCount:0,draftEligible:false}).route,'native')
})
