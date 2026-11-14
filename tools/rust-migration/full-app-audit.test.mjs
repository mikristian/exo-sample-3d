import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

test('whole-app audit is read-only, parses production JS, and does not certify Rust ownership', () => {
  const cwd = resolve(import.meta.dirname, '../..')
  const run = spawnSync(process.execPath, ['tools/rust-migration/full-app-audit.mjs'],
    {cwd, encoding:'utf8', timeout:20000, maxBuffer: 1024*1024})
  assert.equal(run.status, 0, run.stderr)
  const result = JSON.parse(run.stdout)
  assert.ok(result.production.files > 300)
  assert.ok(result.production.languages.javascript.files > 100)
  assert.ok(result.production.languages.cpp.files > 20)
  assert.ok(result.production.languages.swift.files > 0)
  assert.equal(result.parseErrorFiles.length, 0)
  assert.equal(result.rustOwnership.verifiedFunctionalRustPercentage, null)
  assert.ok(result.workstreamCoverage.topUnmapped.some(x => x.file === 'src/App.jsx'))
  assert.ok(result.referenceOnly.languages.rust.files >= 1)
})
