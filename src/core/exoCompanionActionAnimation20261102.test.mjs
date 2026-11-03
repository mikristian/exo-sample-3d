import test from 'node:test'
import assert from 'node:assert/strict'
import {
  describeExoCompanionActionAnimation20261102 as describe,
  createExoCompanionActionAnimation20261102 as create,
  advanceExoCompanionActionAnimation20261102 as advance,
  executeExoCompanionAnimatedAction20261102 as execute,
} from './exoCompanionActionAnimation20261102.js'

test('editor intent targets existing Companion focus locations with requested pieces tracked separately', () => {
  assert.equal(describe({ type: 'navigate', target: 'grading' }).target, 'grading-tool')
  assert.equal(describe({ type: 'simulation', action: 'start' }).target, '3d-canvas')
  assert.equal(describe({ type: 'theme' }).target, 'settings-window')
  assert.deepEqual(describe({ type: 'patternEdit', pieceIds: ['front', 'front', '', 7, 'back'] }).pieceIds, ['front', 'back'])
  assert.deepEqual(create({ type: 'patternEdit', pieceIds: ['front'] }).pieceIds, [])
})

test('cannot display verified without explicit editor success and cannot accept stale lifecycle events', () => {
  const start = create({ type: 'patternEdit', pieceIds: ['front'] }, 'run-2')
  assert.strictEqual(advance(start, 'verified'), start)
  assert.strictEqual(advance(start, 'verified', { result: { ok: 1 } }), start)
  assert.strictEqual(advance(start, 'working', { executionId: 'run-1' }), start)
  const working = advance(start, 'working', { executionId: 'run-2' })
  const verified = advance(working, 'verified', { result: { ok: true, affectedPieceIds: ['front'] } })
  assert.equal(verified.confirmed, true)
  assert.deepEqual(verified.pieceIds, ['front'])
  assert.strictEqual(advance(verified, 'failed'), verified)
})

test('executor emits lifecycle and only highlights pieces returned by verified editor operation', async () => {
  const phases = []
  const { state } = await execute({ type: 'patternEdit', pieceIds: ['front', 'back'] }, async () => ({ ok: true, affectedPieceIds: ['back'] }), { onState: item => phases.push(item.phase) })
  assert.deepEqual(phases, ['thinking', 'planning', 'working', 'verified'])
  assert.deepEqual(state.pieceIds, ['back'])
  assert.equal(state.confirmed, true)
})

test('navigation and failed edits never claim verified success or affected pieces', async () => {
  const phases = []
  const action = { type: 'navigate', target: 'pattern', pieceIds: ['front'] }
  const missing = await execute(action, async () => ({ message: 'Unconfirmed' }), { onState: item => phases.push(item.phase) })
  assert.deepEqual(phases, ['thinking', 'planning', 'navigating', 'working', 'failed'])
  assert.equal(missing.state.confirmed, false)
  assert.deepEqual(missing.state.pieceIds, [])
  const thrown = await execute({ type: 'autoGrade' }, () => { throw new Error('No grading engine') })
  assert.equal(thrown.state.phase, 'failed')
  assert.match(thrown.state.error, /No grading engine/)
  const noCallback = await execute({ type: 'render' }, null)
  assert.equal(noCallback.state.phase, 'failed')
})
