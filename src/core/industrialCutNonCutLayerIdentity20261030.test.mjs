import test from 'node:test'
import assert from 'node:assert/strict'
import {preflightPhysicalCutOverlap20261023_2000 as physical} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {strictCutDxfEnvelope20261023_2053 as strict} from './strictCutDxfEnvelope20261023_2053.mjs'

// Disposable XS/M shell-and-lining garment; metadata-only source inspection.
// No physical cutting authorization or licensed receiving-CAD sign-off.
const names = ['CUT_XS_SHELL', 'CUT_XS_LINING', 'CUT_M_SHELL', 'CUT_M_LINING']
const layer = (name, flags = '0') => ['0', 'LAYER', '2', name, '70', flags, '62', '7', '290', '1']
const rect = (name, x) => ['0', 'LWPOLYLINE', '8', name, '90', '4', '70', '1',
  '10', String(x), '20', '0', '10', String(x + 10), '20', '0',
  '10', String(x + 10), '20', '10', '10', String(x), '20', '10']
const source = extraLayers => [
  '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER',
  ...names.flatMap(name => layer(name)), ...extraLayers.flat(),
  '0', 'ENDTAB', '0', 'ENDSEC',
  '0', 'SECTION', '2', 'ENTITIES', ...names.flatMap((name, i) => rect(name, i * 25)),
  '0', 'ENDSEC', '0', 'EOF', '',
].join('\n')

function inspect(extraLayers, expected, label) {
  for (const [name, fn] of [['physical', physical], ['strict', strict]]) {
    const result = fn(source(extraLayers))
    assert.equal(result.ok, expected, `${label}/${name}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved, false)
    if (expected) {
      assert.equal(result.contourCount, 4)
      assert.deepEqual(result.overlaps, [])
    } else {
      assert.equal(result.diagnostics?.[0]?.code, 'INVALID_CUT_DXF')
      assert.match(result.diagnostics[0].detail, /duplicate.*LAYER/i)
    }
  }
}

test('distinct non-CUT production metadata layers remain inspectable', () => {
  inspect([layer('NOTCH'), layer('ALLOWANCE'), layer('ANNOTATION')], true, 'distinct layers')
  inspect([layer('NOTCH', '4'), layer('ALLOWANCE')], true, 'locked non-CUT layer')
})

test('duplicate non-CUT layer names cannot create receiver-dependent metadata identities', () => {
  for (const [label, layers] of [
    ['identical NOTCH', [layer('NOTCH'), layer('NOTCH')]],
    ['case-folded NOTCH', [layer('NOTCH'), layer('notch')]],
    ['conflicting NOTCH flags', [layer('NOTCH', '0'), layer('Notch', '1')]],
    ['duplicate unreferenced ANNOTATION', [layer('ANNOTATION'), layer('annotation')]],
    ['duplicate default layer 0', [layer('0'), layer('0')]],
  ]) inspect(layers, false, label)
})
