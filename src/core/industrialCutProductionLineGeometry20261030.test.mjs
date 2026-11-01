import test from 'node:test'
import assert from 'node:assert/strict'
import {preflightPhysicalCutOverlap20261023_2000 as physical} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {strictCutDxfEnvelope20261023_2053 as strict} from './strictCutDxfEnvelope20261023_2053.mjs'

// Disposable two-size shell/lining patterns; never receiving-CAD or cutter sign-off.
const cutNames = ['CUT_XS_SHELL', 'CUT_XS_LINING', 'CUT_M_SHELL', 'CUT_M_LINING']
const productionNames = ['NOTCH_XS_SHELL', 'SA_XS_SHELL', 'NOTCH_M_LINING', 'SA_M_LINING']
const rect = (name, x) => ['0', 'LWPOLYLINE', '8', name, '90', '4', '70', '1',
  '10', String(x), '20', '0', '10', String(x + 10), '20', '0',
  '10', String(x + 10), '20', '10', '10', String(x), '20', '10']
const line = (name, x, fields = null) => ['0', 'LINE', '8', name,
  ...(fields ?? ['10', String(x), '20', '1', '11', String(x + 1), '21', '1'])]
const normal = (name, index) => line(name, index * 25 + 1)
const source = (replaceIndex = -1, replacement = null, table = true) => [
  ...(table ? ['0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER',
    ...[...cutNames, ...productionNames].flatMap(name =>
      ['0', 'LAYER', '2', name, '70', '0', '62', '7', '290', '1']),
    '0', 'ENDTAB', '0', 'ENDSEC'] : []),
  '0', 'SECTION', '2', 'ENTITIES',
  ...cutNames.flatMap((name, i) => rect(name, i * 25)),
  ...productionNames.flatMap((name, i) => i === replaceIndex ? replacement : normal(name, i)),
  '0', 'ENDSEC', '0', 'EOF', '',
].join('\n')

function inspect(dxf, expected, label) {
  for (const [inspector, fn] of [['physical', physical], ['strict', strict]]) {
    const result = fn(dxf)
    assert.equal(result.ok, expected, `${label}/${inspector}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved, false)
    if (expected) {
      assert.equal(result.contourCount, 4)
      assert.deepEqual(result.overlaps, [])
    } else {
      assert.equal(result.diagnostics?.[0]?.code, 'INVALID_CUT_DXF')
      assert.match(result.diagnostics[0].detail, /production|NOTCH|ALLOWANCE|SA_|LINE/i)
    }
  }
}

test('valid two-size NOTCH and SA LINE marks remain inspectable, with or without LAYER table', () => {
  inspect(source(), true, 'four valid production LINE marks')
  inspect(source(-1, null, false), true, 'legacy no-LAYER-table')
  inspect(source(0, line('notch_xs_shell', 1)), true, 'case-folded production layer')
  inspect(source(0, line('NOTCH_XS_SHELL', 1,
    ['10', '1', '20', '1', '30', '0', '11', '2', '21', '1', '31', '0',
      '210', '0', '220', '0', '230', '1', '67', '0', '410', 'Model'])),
  true, 'explicit planar LINE metadata')
})

test('malformed production LINE coordinates fail closed across both sizes and fabrics', () => {
  const cases = [
    ['missing start x', ['20', '1', '11', '2', '21', '1']],
    ['missing end y', ['10', '1', '20', '1', '11', '2']],
    ['duplicate start x', ['10', '1', '10', '3', '20', '1', '11', '2', '21', '1']],
    ['nonfinite end x', ['10', '1', '20', '1', '11', 'Infinity', '21', '1']],
    ['non-numeric end y', ['10', '1', '20', '1', '11', '2', '21', 'not-a-number']],
    ['coincident endpoints', ['10', '1', '20', '1', '11', '1', '21', '1']],
    ['near-zero endpoints', ['10', '1', '20', '1', '11', '1.00000000001', '21', '1']],
    ['unrepresentable length', ['10', '-1e308', '20', '1', '11', '1e308', '21', '1']],
    ['nonplanar start z', ['10', '1', '20', '1', '30', '1', '11', '2', '21', '1']],
    ['nonplanar end z', ['10', '1', '20', '1', '11', '2', '21', '1', '31', '1']],
    ['nonzero thickness', ['10', '1', '20', '1', '11', '2', '21', '1', '39', '1']],
    ['tilted extrusion', ['10', '1', '20', '1', '11', '2', '21', '1', '210', '1']],
    ['paper-space LINE', ['10', '1', '20', '1', '11', '2', '21', '1', '67', '1']],
    ['layout not Model', ['10', '1', '20', '1', '11', '2', '21', '1', '410', 'Layout1']],
  ]
  for (const [reason, fields] of cases) for (let i = 0; i < productionNames.length; i++) {
    inspect(source(i, line(productionNames[i], i * 25 + 1, fields)), false,
      `${productionNames[i]}/${reason}`)
  }
})

test('unrelated annotation LINE remains outside production geometry contract', () => {
  const dxf = source().replace('0\nENDSEC\n0\nEOF\n',
    '0\nLINE\n8\nANNOTATION\n10\n0\n20\n0\n11\n0\n21\n0\n30\n2\n0\nENDSEC\n0\nEOF\n')
  inspect(dxf, true, 'non-production annotation LINE')
})
