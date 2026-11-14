import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeExoCompanionProvider20261102 as provider,
  normalizeExoCompanionProviderProposal20261102 as normalize,
  executeExoCompanionProviderProposal20261102 as execute,
} from './exoCompanionProviderOrchestrator20261102.js'

test('normalizes providers and validates existing action registry arguments', () => {
  assert.equal(provider(' ChatGPT '), 'openai')
  assert.equal(provider('Anthropic'), 'claude')
  assert.equal(provider('on-device'), 'local')
  assert.equal(provider('other'), null)
  assert.deepEqual(normalize({ provider: 'Claude', proposedAction: { id: 'workspace.view', args: { layout: 'split' } } }),
    { ok: true, provider: 'claude', action: 'workspace.view', args: { layout: 'split' }, mutates: false })
})

test('rejects malformed and executable proposals without dispatch', async () => {
  const invalid = [null, 'hello', {}, { provider: 'openai', action: { id: 'window.eval' } },
    { provider: 'openai', action: { id: 'simulation.start', args: { code: 'alert(1)' } } },
    { provider: 'openai', action: { id: 'workspace.view', args: { layout: 'admin' } } },
    { provider: 'openai', action: { id: 'pattern.importSvg' } },
    { provider: 'claude', action: { id: 'fabric.apply', args: { presetId: '../../etc/passwd' } } }]
  let invoked = 0
  for (const response of invalid) {
    assert.equal((await execute(response, { executeAction: () => { invoked++; return { ok: true } } })).ok, false)
  }
  assert.equal(invoked, 0)
})

test('only host confirmation succeeds, preserving a limited receipt', async () => {
  const response = { provider: 'openai', action: { id: 'simulation.start' }, success: true }
  assert.equal((await execute(response)).status, 'unavailable')
  assert.equal((await execute(response, { executeAction: async () => undefined })).status, 'unconfirmed')
  assert.equal((await execute(response, { executeAction: async () => ({ ok: false }) })).status, 'unconfirmed')
  assert.equal((await execute(response, { executeAction: async () => { throw Error('simulator offline') } })).status, 'failed')
  const result = await execute(response, { executeAction: async payload => {
    assert.deepEqual(payload, { provider: 'openai', action: 'simulation.start', args: {} })
    return { ok: true, id: 'sim-123', message: 'Simulation started.', secret: 'excluded' }
  } })
  assert.deepEqual(result, { ok: true, status: 'confirmed', provider: 'openai', action: 'simulation.start', args: {}, receipt: { ok: true, id: 'sim-123', message: 'Simulation started.' } })
})
