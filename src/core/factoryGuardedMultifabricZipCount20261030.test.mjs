import test from 'node:test'
import assert from 'node:assert/strict'
import {zipSync, unzipSync} from 'fflate'
import {createTeeTemplate} from '../data/templates.js'
import {buildAccuMarkGuardedFactoryPackage20261023} from './accumarkGuardedFactoryPackage20261023.js'
import {buildGuardedFactoryManifestZip20261024_0053} from './guardedFactoryManifestZip20261024_0053.mjs'
import {auditFactoryZipResourceThenCrc20261024_0600} from './factoryZipResourceBudget20261024_0600.mjs'
import {requireAccuMarkGuardedFactoryPostZipParity20261024} from './accumarkGuardedFactoryPostZipGate20261024.mjs'

// Disposable garment; this test never produces receiving CAD acceptance or
// grants cutter, sewn-sample, or factory-release authorization.
const project = createTeeTemplate()
for (let i = 0; i < 17; i++) {
  const id = `stress-${i}`
  project.fabrics[id] = {...structuredClone(project.fabrics.main), id, name: `Disposable Fabric ${i}`}
  project.pieces.push({
    id, name: `Disposable Panel ${i}`, fabricId: id,
    points: [{x: 100 + i * 40, y: 100}, {x: 112 + i * 40, y: 100},
      {x: 112 + i * 40, y: 112}, {x: 100 + i * 40, y: 112}],
    curves: {}, notches: [], seamAllowance: 1, layout2d: {x: 100 + i * 40, y: 100},
  })
}

test('actual six-size 18-fabric 503-file guarded ZIP passes both producer paths without CUT authorization', () => {
  const source = buildAccuMarkGuardedFactoryPackage20261023(project, {zip: false})
  assert.equal(source.ok, true, source.reason)
  assert.equal(Object.keys(source.files).length, 503)
  const direct = buildAccuMarkGuardedFactoryPackage20261023(project, {zip: true})
  assert.equal(direct.ok, true, direct.reason)
  assert.equal(Object.keys(unzipSync(direct.zip)).length, 503)
  assert.equal(direct.manufacturingApproved, false)
  const guarded = buildGuardedFactoryManifestZip20261024_0053(project)
  assert.equal(guarded.ok, true, guarded.reason)
  assert.equal(guarded.fileCount, 503)
  assert.equal(guarded.manufacturingApproved, false)
  assert.equal(guarded.factoryCertified, false)
  assert.equal(auditFactoryZipResourceThenCrc20261024_0600(guarded.bytes).ok, true)
  assert.deepEqual(Object.keys(unzipSync(guarded.bytes)).sort(), Object.keys(source.files).sort())
})

test('valid 503-file ZIP with one unmanifested injected factory record is rejected after resource preflight', () => {
  const source = buildAccuMarkGuardedFactoryPackage20261023(project, {zip: false})
  assert.equal(source.ok, true, source.reason)
  const forged = zipSync({...source.files, 'grading-rules/forged-approval.csv': new TextEncoder().encode('cutting approved')}, {level: 0})
  assert.equal(auditFactoryZipResourceThenCrc20261024_0600(forged).ok, true)
  assert.throws(() => requireAccuMarkGuardedFactoryPostZipParity20261024(forged, source.files, project),
    /extracted path inventory differs from source/)
})

test('503-file ZIP with a corrupted physical payload is refused before any production handoff', () => {
  const source = buildAccuMarkGuardedFactoryPackage20261023(project, {zip: false})
  assert.equal(source.ok, true, source.reason)
  const bytes = zipSync(source.files, {level: 0})
  const damaged = bytes.slice()
  const at = damaged.indexOf(0x50) // The first ZIP local header; mutate its first file payload, not metadata.
  assert.equal(at, 0)
  const view = new DataView(damaged.buffer, damaged.byteOffset, damaged.byteLength)
  const nameLength = view.getUint16(26, true)
  const extraLength = view.getUint16(28, true)
  damaged[30 + nameLength + extraLength] ^= 0x01
  const check = auditFactoryZipResourceThenCrc20261024_0600(damaged)
  assert.equal(check.ok, false)
  assert(check.diagnostics.some(issue => issue.code === 'CRC_MISMATCH'))
  assert.throws(() => requireAccuMarkGuardedFactoryPostZipParity20261024(damaged, source.files, project),
    /resource\/CRC preflight refused/)
})
