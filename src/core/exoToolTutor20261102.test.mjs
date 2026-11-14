import test from 'node:test'
import assert from 'node:assert/strict'
import { EXO_TOOL_TUTOR_CATALOG_20261102, searchExoTools20261102, getExoToolCapability20261102, answerExoToolQuestion20261102 } from './exoToolTutor20261102.js'

test('discovers real registered toolbar, command and guide targets', () => {
  for (const source of ['right-palette', 'workspace-command', 'accumark-registry', 'assistant-guide']) {
    assert.ok(EXO_TOOL_TUTOR_CATALOG_20261102.some(tool => tool.source === source), source)
  }
  for (const domain of ['grading', 'simulation', 'print', 'techpack', 'fabric', 'sewing', 'avatar', 'import', 'export']) {
    assert.ok(searchExoTools20261102('', { domain }).length, domain)
  }
})

test('registry declaration and reference commands do not claim execution', () => {
  const command = EXO_TOOL_TUTOR_CATALOG_20261102.find(t => t.id === 'accu.draft.curve')
  assert.equal(command.route.kind, 'tool')
  assert.equal(getExoToolCapability20261102(command).canExecute, false)
  const reference = EXO_TOOL_TUTOR_CATALOG_20261102.find(t => t.source === 'accumark-registry' && t.route.kind === 'reference')
  assert.ok(reference)
  assert.equal(getExoToolCapability20261102(reference, { registryRoutes: { [reference.id]: true } }).canExecute, false)
})

test('host evidence is mandatory and scoped to the correct action', () => {
  const tool = EXO_TOOL_TUTOR_CATALOG_20261102.find(t => t.id === 'workspace.view.split')
  assert.equal(getExoToolCapability20261102(tool, { workspaceActions: { 'workspace.view.3d': true } }).canExecute, false)
  assert.equal(getExoToolCapability20261102(tool, { workspaceActions: { 'workspace.view.split': true } }).canExecute, true)
})

test('how-to questions give steps but do-it requests do not claim unverified work', () => {
  const guide = answerExoToolQuestion20261102('How do I grade garment sizes?')
  assert.equal(guide.domain, 'grading')
  assert.equal(guide.kind, 'how-to')
  assert.ok(guide.steps.some(step => /notches/.test(step)))
  const print = answerExoToolQuestion20261102('Tile my pattern into 8.5x11 paper pages for me')
  assert.equal(print.domain, 'print')
  assert.equal(print.kind, 'action-availability')
  assert.equal(print.canExecute, false)
  assert.match(print.message, /cannot confirm/)
  assert.match(print.steps.join(' '), /100%/)
})

test('search remains bounded and tolerates untrusted questions', () => {
  assert.deepEqual(searchExoTools20261102('nonsense-unmatched-zozz'), [])
  assert.equal(searchExoTools20261102('', { limit: 99999 }).length, 50)
  assert.equal(answerExoToolQuestion20261102(null).kind, 'clarify')
})
