import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createWorkspaceAuth} from './workspace-auth.mjs'

test('workspace bearer credential rejects omitted, forged-Origin equivalent, malformed and wrong tokens', () => {
  const auth = createWorkspaceAuth('a'.repeat(64))
  assert.equal(auth.authorize(undefined), false)
  assert.equal(auth.authorize('a'.repeat(64)), false)
  assert.equal(auth.authorize('Bearer ' + 'b'.repeat(64)), false)
  assert.equal(auth.authorize('Bearer ' + 'a'.repeat(63)), false)
  assert.equal(auth.authorize('Bearer ' + 'a'.repeat(64)), true)
  assert.equal(auth.identity,createHash('sha256').update('a'.repeat(64)).digest('hex'))
})

test('independent launches generate distinct credentials', () => {
  const a = createWorkspaceAuth('')
  const b = createWorkspaceAuth('')
  assert.notEqual(a.token, b.token)
  assert.equal(a.authorize('Bearer ' + b.token), false)
})

test('short startup secrets fail closed', () => {
  assert.throws(() => createWorkspaceAuth('unsafe'), /at least 32/)
})
