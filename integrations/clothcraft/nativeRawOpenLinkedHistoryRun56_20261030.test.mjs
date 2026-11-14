import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {createWorkspace} from './workspace.mjs'
import {paths} from './bridge.mjs'

async function rawOpen(bin, avatar, upstream, native, project) {
  const child = spawn(bin, [avatar, native], {cwd: upstream, stdio: ['pipe', 'pipe', 'pipe']})
  const lines = createInterface({input: child.stdout})
  const iterator = lines[Symbol.asyncIterator]()
  try {
    child.stdin.write(JSON.stringify({op: 'open', project}) + '\n')
    let timer
    const reply = await Promise.race([
      iterator.next(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Rust open timed out')), 12000) }),
    ]).finally(() => clearTimeout(timer))
    assert.equal(reply.done, false, 'Rust process exited before responding')
    return JSON.parse(reply.value)
  } finally {
    child.stdin.end()
    if (child.exitCode === null) child.kill('SIGKILL')
    lines.close()
  }
}

test('raw Rust open refuses corrupt linked history instead of silently dropping Undo', async t => {
  const config = paths()
  const bin = path.join(config.upstream, 'target/debug/exo-session')
  if (!fs.existsSync(bin)) return t.skip('Native executable absent')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exo-raw-history-run56-'))
  t.after(() => fs.rmSync(root, {recursive: true, force: true}))
  const workspace = createWorkspace(root)
  let project
  try {
    assert.equal((await workspace.request({op: 'open', preset: 'tshirt'})).ok, true)
    const saved = await workspace.request({op: 'save'})
    assert.equal(saved.ok, true, saved.error)
    project = saved.data.project
  } finally { workspace.close() }
  const native = path.join(root, 'workspace', 'fitting-project.json.native')
  const sidecar = `${native}.undo-v1.json`
  assert.equal(fs.existsSync(sidecar), true, 'Fixture requires a real linked Rust journal')
  const avatar = path.join(config.upstream, 'assets/makehuman/mannequin.obj')
  const good = await rawOpen(bin, avatar, config.upstream, native, project)
  assert.equal(good.ok, true, good.error)
  fs.writeFileSync(sidecar, '{truncated-history')
  const corrupt = await rawOpen(bin, avatar, config.upstream, native, project)
  assert.equal(corrupt.ok, false, 'Corrupt linked history must block raw Rust open')
  assert.match(corrupt.error, /history|journal/i)
  assert.equal(fs.readFileSync(sidecar, 'utf8'), '{truncated-history', 'Failure must preserve forensic journal')
})
