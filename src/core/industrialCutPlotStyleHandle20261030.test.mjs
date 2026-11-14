import test from 'node:test'
import assert from 'node:assert/strict'
import {preflightPhysicalCutOverlap20261023_2000 as physical} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {strictCutDxfEnvelope20261023_2053 as strict} from './strictCutDxfEnvelope20261023_2053.mjs'

// Disposable XS/M shell/lining garment. Inspection is not cutter authorization.
const names = ['CUT_XS_SHELL', 'CUT_XS_LINING', 'CUT_M_SHELL', 'CUT_M_LINING']
const contour = (name, i) => {
  const x = i * 25
  return ['0','LWPOLYLINE','5',`C${i + 1}`,'330','0','8',name,'90','4','70','1',
    '10',String(x),'20','0','10',String(x + 10),'20','0',
    '10',String(x + 10),'20','10','10',String(x),'20','10']
}
const dxf = ({layerPlot = [], entityPlot = [], objectPlot = [], blockPlot = [],
  extraObjects = [], extraLayers = []} = {}) => [
  '0','SECTION','2','TABLES','0','TABLE','5','A0','2','LAYER',
  ...names.flatMap((name,i) => ['0','LAYER','5',`A${i + 1}`,'330','A0','2',name,'70','0','62','7',
    ...(i === 0 ? layerPlot : [])]),
  ...extraLayers,'0','ENDTAB','0','ENDSEC',
  '0','SECTION','2','BLOCKS','0','BLOCK','5','E1','330','0','2','LOCAL_BLOCK',...blockPlot,
  '0','ENDBLK','5','E2','330','0','0','ENDSEC',
  '0','SECTION','2','OBJECTS','0','DICTIONARY','5','B0','330','0',...objectPlot,
  ...extraObjects,'0','ENDSEC',
  '0','SECTION','2','ENTITIES',
  ...names.flatMap((name,i) => [...contour(name,i),...(i === 0 ? entityPlot : [])]),
  '0','ENDSEC','0','EOF','',
].join('\n')
function check(source, expected, label) {
  for (const [name, inspect] of [['physical', physical], ['strict', strict]]) {
    const result = inspect(source)
    assert.equal(result.ok, expected, `${label}/${name}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved, false)
    if (expected) {
      assert.equal(result.contourCount, 4)
      assert.deepEqual(result.overlaps, [])
    } else {
      assert.equal(result.diagnostics?.[0]?.code, 'INVALID_CUT_DXF')
      assert.match(result.diagnostics?.[0]?.detail ?? '', /390|plot.style|handle|reference/i)
    }
  }
}
test('default undeclared LAYER plot-style F remains inspectable', () => {
  check(dxf(), true, 'no plot style metadata')
  check(dxf({layerPlot:['390','F']}), true, 'built-in default plot style F')
  check(dxf({layerPlot:['390','000f']}), true, 'case-insensitive zero-padded default F')
})
test('unresolved plot-style handles fail closed across record sections', () => {
  for (const field of ['layerPlot','entityPlot','objectPlot','blockPlot']) {
    for (const target of ['DEAD','0','ZZZ','']) {
      check(dxf({[field]:['390',target]}), false, `${field} 390 ${target}`)
    }
  }
})
test('duplicate plot-style pointers on one record are rejected', () => {
  for (const field of ['layerPlot','entityPlot','objectPlot','blockPlot']) {
    check(dxf({[field]:['390','F','390','B0']}), false, `${field} duplicate 390`)
  }
})
test('plot-style references cannot be accepted merely because another unrelated record exists', () => {
  check(dxf({layerPlot:['390','DEAD'], extraObjects:['0','XRECORD','5','B1','330','B0']}), false, 'unrelated local XRECORD')
  check(dxf({layerPlot:['390','000B1'], extraObjects:['0','XRECORD','5','B1','330','B0']}), false, 'XRECORD is not a verified plot-style object')
  check(dxf({layerPlot:['390','B0']}), false, 'DICTIONARY is not a plot-style object')
  check(dxf({layerPlot:['390','C1']}), false, 'LWPOLYLINE is not a plot-style object')
  check(dxf({layerPlot:['390','A1']}), false, 'LAYER is not a plot-style object')
  check(dxf({layerPlot:['390','F'], extraObjects:['0','XRECORD','5','F','330','B0']}), false, 'local F shadows built-in')
  check(dxf({entityPlot:['390','F']}), false, 'unverified entity default plot style')
  check(dxf({objectPlot:['390','F']}), false, 'unverified OBJECTS default plot style')
})
test('orphan HEADER and TABLES group 390 pointers cannot disappear from the inventory', () => {
  const base = dxf()
  check(base.replace('0\nSECTION\n2\nTABLES',
    '0\nSECTION\n2\nHEADER\n9\n$CPSNID\n390\nDEAD\n0\nENDSEC\n0\nSECTION\n2\nTABLES'),
  false, 'HEADER plot-style pointer outside supported record')
  check(base.replace('2\nTABLES\n0\nTABLE', '2\nTABLES\n390\nDEAD\n0\nTABLE'),
    false, 'orphan TABLES pointer')
})
