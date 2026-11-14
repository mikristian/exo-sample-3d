import test from 'node:test'
import assert from 'node:assert/strict'
import {preflightPhysicalCutOverlap20261023_2000 as inspect} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {strictCutDxfEnvelope20261023_2053 as strictInspect} from './strictCutDxfEnvelope20261023_2053.mjs'

// Disposable, disjoint two-size/two-fabric CUT inspection fixture. These are
// synthetic contours, not independently accepted factory CAD or cut approval.
const pieces = [
  ['XS', 'COTTON', 0], ['XS', 'LINING', 30],
  ['M', 'COTTON', 60], ['M', 'LINING', 90],
]
const rect = (layer, x) => [
  '0', 'LWPOLYLINE', '8', layer, '90', '4', '70', '1',
  '10', String(x), '20', '0', '10', String(x + 10), '20', '0',
  '10', String(x + 10), '20', '12', '10', String(x), '20', '12',
]
const cutEntities = pieces.flatMap(([size, fabric, x]) => rect(`CUT_${size}_${fabric}`, x))
const wrap = (entities = cutEntities, suffix = ['0', 'ENDSEC', '0', 'EOF'], prefix = ['0', 'SECTION', '2', 'ENTITIES']) =>
  [...prefix, ...entities, ...suffix, ''].join('\n')
const checkInvalid = (dxf, reason) => {
  for (const [label, check] of [['standalone', inspect], ['strict', strictInspect]]) {
    const result = check(dxf)
    assert.equal(result.ok, false, `${reason}/${label}: ${JSON.stringify(result)}`)
    assert.equal(result.diagnostics[0]?.code, 'INVALID_CUT_DXF', `${reason}/${label}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved, false)
  }
}

test('disposable all-size/all-fabric direct CUT contours remain inspectable but never authorized', () => {
  for (const check of [inspect, strictInspect]) {
    const result = check(wrap())
    assert.equal(result.ok, true, JSON.stringify(result))
    assert.equal(result.contourCount, 4)
    assert.equal(result.manufacturingApproved, false)
  }
})

test('canonical zero-elevation and default-extrusion metadata remain compatible', () => {
  const first = rect('CUT_XS_COTTON', 0)
  const planar = wrap([...first, '38', '0', '39', '0', '210', '0', '220', '0', '230', '1', ...cutEntities.slice(first.length)],
    ['0', 'ENDSEC', '999', 'safe exporter comment', '0', 'EOF'])
  for (const check of [inspect, strictInspect]) {
    const result = check(planar)
    assert.equal(result.ok, true, JSON.stringify(result))
    assert.equal(result.contourCount, 4)
    assert.equal(result.manufacturingApproved, false)
  }
})

test('standalone inspector rejects malformed DXF section and EOF structure', () => {
  for (const [name, dxf] of [
    ['missing ENDSEC', wrap(cutEntities, ['0', 'EOF'])],
    ['unmatched ENDSEC', wrap(cutEntities, ['0', 'ENDSEC', '0', 'ENDSEC', '0', 'EOF'])],
    ['nested SECTION', wrap(['0', 'SECTION', '2', 'HEADER', ...cutEntities])],
    ['duplicate ENTITIES', wrap(cutEntities, ['0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', '0', 'ENDSEC', '0', 'EOF'])],
    ['missing EOF', wrap(cutEntities, ['0', 'ENDSEC'])],
    ['trailing data after EOF', wrap(cutEntities, ['0', 'ENDSEC', '0', 'EOF', '999', 'trailer'])],
    ['content outside SECTION', wrap(cutEntities, ['0', 'ENDSEC', '8', 'CUT_X', '0', 'EOF'])],
  ]) checkInvalid(dxf, name)
})

test('standalone inspector rejects CUT elevation, extrusion, thickness and duplicate metadata', () => {
  const first = rect('CUT_XS_COTTON', 0)
  const rest = cutEntities.slice(first.length)
  for (const [name, attrs] of [
    ['nonzero elevation', ['38', '1']],
    ['nonzero thickness', ['39', '0.5']],
    ['nonplanar extrusion y', ['210', '0', '220', '1', '230', '0']],
    ['reversed extrusion z', ['210', '0', '220', '0', '230', '-1']],
    ['unsupported LWPOLYLINE z', ['30', '0']],
    ['duplicate elevation', ['38', '0', '38', '0']],
    ['invalid extrusion', ['210', 'Infinity']],
  ]) checkInvalid(wrap([...first, ...attrs, ...rest]), name)
})

test('old-style closed 2D CUT POLYLINE preserves planar acceptance and rejects displaced planes', () => {
  const head = ['0', 'POLYLINE', '8', 'CUT_XS_COTTON', '66', '1', '70', '1']
  const vertices = [[0, 0], [10, 0], [10, 12], [0, 12]]
    .flatMap(([x, y]) => ['0', 'VERTEX', '8', 'CUT_XS_COTTON', '10', String(x), '20', String(y)])
  const old = [...head, ...vertices, '0', 'SEQEND']
  const result = inspect(wrap(old))
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(result.manufacturingApproved, false)
  for (const [name, attrs] of [
    ['nonzero old-style z', ['30', '2']],
    ['nonzero old-style elevation', ['38', '2']],
    ['nonplanar old-style extrusion', ['210', '1']],
  ]) checkInvalid(wrap([...head, ...attrs, ...vertices, '0', 'SEQEND']), name)
})
