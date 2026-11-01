import test from 'node:test'
import assert from 'node:assert/strict'
import {makeSnapshot,profileSnapshot} from './nativeSnapshotSerialization.mjs'

test('bounded representative native mesh packets retain geometry and report real measurements',()=>{
  const snapshot=makeSnapshot({pieces:3,verticesPerPiece:90})
  assert.equal(snapshot.data.positions.length,270)
  assert.equal(snapshot.data.panels.length,3)
  const result=profileSnapshot(snapshot,{iterations:3})
  assert.equal(result.vertices,270)
  assert.equal(result.validRoundtrip,true)
  assert.ok(result.bytes>1000)
  assert.ok(result.medianMs.roundtrip>=0)
  assert.equal(result.iterations,3)
})

test('probe rejects unbounded fixture sizes and iterations',()=>{
  assert.throws(()=>makeSnapshot({pieces:25}),/bounded/)
  assert.throws(()=>makeSnapshot({verticesPerPiece:3001}),/bounded/)
  assert.throws(()=>profileSnapshot(makeSnapshot(),{iterations:101}),/bound/)
})
