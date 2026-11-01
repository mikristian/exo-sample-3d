import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateValentinaMaleShirtViaSeamly20261031 as evaluate } from './valentinaSeamlyExecutableBridge20261031.mjs'
import { SEAMLY2D_RUNTIME_20261023 } from './seamly2dNativeEngine20261023.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const reference = path.join(root, 'research/oss/pattern-cad/ValentinaDevelop20261031/src/app/share/collection/MaleShirt')
const patternPath = path.join(reference, 'MaleShirt.val')
const measurementsPath = path.join(reference, 'MaleShirt.vit')
const native = fs.existsSync(SEAMLY2D_RUNTIME_20261023)
const trousers = path.join(root, 'research/oss/pattern-cad/ValentinaDevelop20261031/src/app/share/collection/Trousers')

test('explicitly refuses unmapped patterns and invalid measurement XML', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exo-valentina-negative-'))
  try {
    const other = path.join(dir, 'other.val')
    fs.writeFileSync(other, fs.readFileSync(patternPath, 'utf8').replace('MaleShirt.vit', 'other.vit'))
    assert.equal(evaluate({ patternPath: other, measurementsPath }).code, 'UNSUPPORTED_PATTERN')
    const bad = path.join(dir, 'bad.vit')
    fs.writeFileSync(bad, fs.readFileSync(measurementsPath, 'utf8').replace('value="102"', 'value="x"'))
    assert.equal(evaluate({ patternPath, measurementsPath: bad }).code, 'INVALID_MEASUREMENTS')
    fs.writeFileSync(bad, fs.readFileSync(measurementsPath, 'utf8').replace('<vit>', '<vit><!DOCTYPE foo>'))
    assert.equal(evaluate({ patternPath, measurementsPath: bad }).code, 'INVALID_MEASUREMENTS')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('real Valentina measurement changes recalculate SVG geometry and original AAMA DXF', { skip: !native }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exo-valentina-execution-'))
  try {
    const changedPath = path.join(dir, 'changed.vit')
    const original = fs.readFileSync(measurementsPath)
    const revised = original.toString('utf8').replace('name="bust_circ" value="102"', 'name="bust_circ" value="110"')
    assert.notEqual(revised, original.toString('utf8'))
    fs.writeFileSync(changedPath, revised)
    const a = evaluate({ patternPath, measurementsPath, outputRoot: dir, format: 'svg' })
    const b = evaluate({ patternPath, measurementsPath: changedPath, outputRoot: dir, format: 'svg' })
    assert.equal(a.ok, true, a.reason)
    assert.equal(b.ok, true, b.reason)
    assert.notEqual(a.artifacts[0].sha256, b.artifacts[0].sha256)
    assert.match(fs.readFileSync(a.artifacts[0].filename, 'utf8'), /<svg\b/)
    const dxf = evaluate({ patternPath, measurementsPath, outputRoot: dir, format: 'aama-r10' })
    assert.equal(dxf.ok, true, dxf.reason)
    assert.match(fs.readFileSync(dxf.artifacts[0].filename, 'utf8'), /SECTION\s*\n\s*2\s*\nENTITIES/)
    assert.deepEqual(fs.readFileSync(measurementsPath), original)
    assert.equal(dxf.manufacturingApproved, false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('authenticated Valentina trousers produce real native contours that respond to hip measurements', { skip: !native || !fs.existsSync(path.join(trousers, 'Trousers.val')) }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exo-trousers-native-'))
  const config = { patternPath: path.join(trousers, 'Trousers.val'), measurementsPath: path.join(trousers, 'trousers.vit'), outputRoot: dir }
  try {
    const before = fs.readFileSync(config.measurementsPath)
    const baseline = evaluate(config)
    assert.equal(baseline.ok, true, baseline.reason)
    assert.equal(baseline.constructionTools, 150)
    assert.equal(baseline.bridge, 'verified-trousers-reference')
    assert.match(fs.readFileSync(baseline.artifacts[0].filename, 'utf8'), /<svg\b/)
    const changedPath = path.join(dir, 'changed.vit')
    fs.writeFileSync(changedPath, before.toString('utf8').replace('name="hip_circ" value="100"', 'name="hip_circ" value="110"'))
    const changed = evaluate({ ...config, measurementsPath: changedPath })
    assert.equal(changed.ok, true, changed.reason)
    assert.notEqual(changed.artifacts[0].sha256, baseline.artifacts[0].sha256)
    const dxf = evaluate({ ...config, format: 'aama-r10' })
    assert.equal(dxf.ok, true, dxf.reason)
    assert.match(fs.readFileSync(dxf.artifacts[0].filename, 'utf8'), /SECTION\s*\n\s*2\s*\nENTITIES/)
    assert.deepEqual(fs.readFileSync(config.measurementsPath), before)
    assert.equal(dxf.manufacturingApproved, false)
    const wrongPath = path.join(dir, 'altered.val')
    fs.writeFileSync(wrongPath, fs.readFileSync(config.patternPath).subarray(0, 100))
    assert.equal(evaluate({ ...config, patternPath: wrongPath }).code, 'UNSUPPORTED_PATTERN')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
