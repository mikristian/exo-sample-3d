import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {preflightPhysicalCutOverlap20261023_2000 as physical} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {strictCutDxfEnvelope20261023_2053 as strict} from './strictCutDxfEnvelope20261023_2053.mjs'

// Disposable XS/M shell-and-lining patterns; no real cutting or receiver sign-off.
const cutNames = ['CUT_XS_SHELL', 'CUT_XS_LINING', 'CUT_M_SHELL', 'CUT_M_LINING']
const layer = (name, attrs = []) => ['0', 'LAYER', '2', name, ...attrs]
const rect = (name, x) => ['0', 'LWPOLYLINE', '8', name, '90', '4', '70', '1',
  '10', String(x), '20', '0', '10', String(x + 10), '20', '0',
  '10', String(x + 10), '20', '10', '10', String(x), '20', '10']
const productionLine = (name, x) => ['0', 'LINE', '8', name, '10', String(x), '20', '0',
  '11', String(x + 1), '21', '1']
const source = (extra = [], withTable = true) => [
  ...(withTable ? ['0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER',
    ...cutNames.flatMap(name => layer(name, ['70', '0', '62', '7', '290', '1'])),
    ...extra.flat(), '0', 'ENDTAB', '0', 'ENDSEC'] : []),
  '0', 'SECTION', '2', 'ENTITIES',
  ...cutNames.flatMap((name, i) => rect(name, i * 25)),
  ...productionLine('NOTCH_XS_SHELL', 5),
  ...productionLine('SA_XS_SHELL', 5),
  '0', 'ENDSEC', '0', 'EOF', '',
].join('\n')

function inspect(dxf, expected, description) {
  for (const [name, fn] of [['physical', physical], ['strict', strict]]) {
    const result = fn(dxf)
    assert.equal(result.ok, expected, `${description}/${name}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved, false)
    if (expected) {
      assert.equal(result.contourCount, 4)
      assert.deepEqual(result.overlaps, [])
    } else {
      assert.equal(result.diagnostics?.[0]?.code, 'INVALID_CUT_DXF')
      assert.match(result.diagnostics[0].detail, /production|NOTCH|ALLOWANCE|SA_/i)
    }
  }
}

test('visible plottable NOTCH/allowance layers are inspectable, locked layers are supported', () => {
  inspect(source([
    layer('NOTCH_XS_SHELL', ['70', '4', '62', '7', '290', '1']),
    layer('SA_XS_SHELL', ['70', '64', '62', '7', '290', '1']),
    layer('ALLOWANCE_M_SHELL', ['70', '0', '62', '7', '290', '1']),
    layer('ANNOTATION', ['70', '1', '62', '-7', '290', '0']),
  ]), true, 'visible production layers with hidden annotation')
  inspect(source([], false), true, 'legacy DXF without LAYER table')
})

test('declared LAYER inventory must include referenced notch and allowance entities', () => {
  inspect(source([
    layer('NOTCH_XS_SHELL', ['70', '0', '62', '7']),
    layer('SA_XS_SHELL', ['70', '0', '62', '7']),
  ]), true, 'all referenced production layers declared')
  inspect(source([layer('NOTCH_XS_SHELL')]), false, 'undeclared SA_XS_SHELL entity')
  inspect(source([layer('SA_XS_SHELL')]), false, 'undeclared NOTCH_XS_SHELL entity')
})

test('production notch and seam-allowance layer visibility fails closed', () => {
  for (const name of ['NOTCH_XS_SHELL', 'notch_xs_shell', 'SA_XS_SHELL',
    'ALLOWANCE_M_SHELL', 'SEAM_ALLOWANCE', 'NOTCH', 'ALLOWANCE']) {
    for (const [reason, attrs] of [
      ['frozen', ['70', '1']],
      ['frozen in viewport', ['70', '2']],
      ['xref dependent', ['70', '16']],
      ['xref resolved', ['70', '32']],
      ['off', ['62', '-7']],
      ['nonplottable', ['290', '0']],
    ]) inspect(source([layer(name, attrs)]), false, `${name}/${reason}`)
  }
})

test('ambiguous production layer flags, color and plot metadata fail closed', () => {
  for (const [reason, attrs] of [
    ['duplicate flags', ['70', '0', '70', '1']],
    ['duplicate color', ['62', '7', '62', '-7']],
    ['duplicate plot flag', ['290', '1', '290', '0']],
    ['fractional flags', ['70', '0.5']],
    ['overflow flags', ['70', '4294967296']],
    ['invalid color', ['62', 'abc']],
    ['invalid plot flag', ['290', '2']],
  ]) inspect(source([layer('NOTCH_XS_SHELL', attrs)]), false, reason)
})

test('genuine Seamly ASTM LAYER table remains compatible with disposable CUT contours', () => {
  // Retain authentic independent-source layer declarations (including exact
  // NOTCH, STITCH, CUT names), while substituting only disposable garment
  // contours. This is parser compatibility, NOT a vendor receiving round-trip.
  const fixture = readFileSync(new URL('../../download/garment-dxf-library-20261023/dxf/github-original-references/Seamly2D/seamlylayout_Skirt_ASTMD6673.dxf', import.meta.url), 'utf8').replace(/\r\n?/g, '\n')
  const table = fixture.match(/0\nSECTION\n2\nTABLES\n[\s\S]*?0\nENDSEC\n/)?.[0]
  assert.ok(table, 'independent Seamly ASTM LAYER table must exist')
  assert.match(table, /0\nLAYER\n2\nNOTCH\n70\n0\n/)
  const added = [...cutNames, 'NOTCH_XS_SHELL', 'SA_XS_SHELL']
    .flatMap(name => layer(name, ['70', '0', '62', '7'])).join('\n')
  const withCut = table.replace('0\nENDTAB\n', `${added}\n0\nENDTAB\n`)
  assert.notEqual(withCut, table)
  const dxf = source([], false).replace('0\nSECTION\n2\nENTITIES\n', `${withCut}0\nSECTION\n2\nENTITIES\n`)
  inspect(dxf, true, 'authentic Seamly layer declarations')
  inspect(dxf.replace('0\nLAYER\n2\nNOTCH\n70\n0\n', '0\nLAYER\n2\nNOTCH\n70\n1\n'),
    false, 'frozen genuine Seamly NOTCH layer mutation')
})
