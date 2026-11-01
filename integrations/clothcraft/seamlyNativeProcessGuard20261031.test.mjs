import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { withSeamlyNativeProcessGuard20261031 as guard } from './seamlyNativeProcessGuard20261031.mjs'

const modulePath = fileURLToPath(new URL('./seamlyNativeProcessGuard20261031.mjs', import.meta.url))
const fixture = fn => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'exo-seamly-guard-test-'))
  try { return fn(folder) } finally { fs.rmSync(folder, { recursive: true, force: true }) }
}

test('releases on success and thrown error, preserves return value', () => fixture(folder => {
  const lockPath = path.join(folder, 'guard.lock')
  assert.equal(guard(() => 42, { lockPath }), 42)
  assert.equal(fs.existsSync(lockPath), false)
  assert.throws(() => guard(() => { throw new Error('native failed') }, { lockPath }), /native failed/)
  assert.equal(fs.existsSync(lockPath), false)
}))

test('live owner cannot be displaced and acquisition has a deadline', () => fixture(folder => {
  const lockPath = path.join(folder, 'guard.lock')
  guard(() => {
    assert.throws(() => guard(() => 1, { lockPath, acquireTimeoutMs: 40, pollMs: 5, staleGraceMs: 0 }),
      { code: 'SEAMLY_NATIVE_LOCK_TIMEOUT' })
  }, { lockPath })
}))

test('dead owner is recovered and unrelated contents are never removed', () => fixture(folder => {
  const lockPath = path.join(folder, 'guard.lock')
  fs.mkdirSync(lockPath)
  const owner = JSON.stringify({ pid: 2147483647, token: 'abandoned' })
  fs.writeFileSync(path.join(lockPath, 'owner.json'), owner)
  const old = new Date(Date.now() - 10000)
  fs.utimesSync(lockPath, old, old)
  assert.equal(guard(() => 'recovered', { lockPath, staleGraceMs: 100 }), 'recovered')
  assert.equal(fs.existsSync(lockPath), false)
  fs.mkdirSync(lockPath)
  fs.writeFileSync(path.join(lockPath, 'unexpected.txt'), 'keep')
  fs.utimesSync(lockPath, old, old)
  assert.throws(() => guard(() => 0, { lockPath, staleGraceMs: 0, acquireTimeoutMs: 30, pollMs: 5 }),
    { code: 'SEAMLY_NATIVE_LOCK_TIMEOUT' })
  assert.equal(fs.readFileSync(path.join(lockPath, 'unexpected.txt'), 'utf8'), 'keep')
}))

test('two independent processes serialize protected operations', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'exo-seamly-guard-parallel-'))
  try {
    const lockPath = path.join(folder, 'native.lock')
    const logPath = path.join(folder, 'timeline.log')
    const code = `import fs from 'node:fs'; import {withSeamlyNativeProcessGuard20261031 as guard} from ${JSON.stringify(modulePath)}; const [lock, log] = process.argv.slice(1); guard(() => { fs.appendFileSync(log, 'enter\\n'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150); fs.appendFileSync(log,'exit\\n') }, {lockPath:lock, pollMs:10});`
    const children = [0, 1].map(() => spawn(process.execPath, ['--input-type=module', '-e', code, lockPath, logPath], { stdio: ['ignore', 'pipe', 'pipe'] }))
    const exits = await Promise.all(children.map(child => new Promise((resolve, reject) => {
      let stderr = ''
      child.stderr.on('data', bytes => { stderr += bytes })
      child.on('error', reject)
      child.on('close', status => resolve({ status, stderr }))
    })))
    assert.deepEqual(exits, [{ status: 0, stderr: '' }, { status: 0, stderr: '' }])
    assert.deepEqual(fs.readFileSync(logPath, 'utf8').trim().split('\n'), ['enter', 'exit', 'enter', 'exit'])
  } finally { fs.rmSync(folder, { recursive: true, force: true }) }
})
