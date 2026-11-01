import test from 'node:test'
import assert from 'node:assert/strict'
import {preflightPhysicalCutOverlap20261023_2000 as physical} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {strictCutDxfEnvelope20261023_2053 as strict} from './strictCutDxfEnvelope20261023_2053.mjs'

// Disposable XS/M shell-and-lining garment. This tests source-only CUT inspection,
// never physical cutting authorization or licensed receiving-CAD acceptance.
const names = ['CUT_XS_SHELL', 'CUT_XS_LINING', 'CUT_M_SHELL', 'CUT_M_LINING']
const layer = (name, i) => ['0','LAYER','5',`A${i + 1}`,'330','A0',
  '2',name,'70','0','62','7','290','1']
const contour = (name, i) => {
  const x = i * 25
  return ['0','LWPOLYLINE','5',`C${i + 1}`,'330','0','8',name,'90','4','70','1',
    '10',String(x),'20','0','10',String(x+10),'20','0',
    '10',String(x+10),'20','10','10',String(x),'20','10']
}
const records = () => ({
  table: ['0','TABLE','5','A0','2','LAYER',...names.flatMap(layer),'0','ENDTAB'],
  objects: ['0','DICTIONARY','5','B0','330','0','3','NOTCH_METADATA','350','B1',
    '0','XRECORD','5','B1','330','B0','1','source-only'],
  contours: names.flatMap(contour),
})
const dxf = ({table,objects,contours}) => [
  '0','SECTION','2','TABLES',...table,'0','ENDSEC',
  '0','SECTION','2','OBJECTS',...objects,'0','ENDSEC',
  '0','SECTION','2','ENTITIES',...contours,'0','ENDSEC','0','EOF','',
].join('\n')
function check(source, expected, label) {
  for (const [name, inspect] of [['physical',physical],['strict',strict]]) {
    const result = inspect(source)
    assert.equal(result.ok,expected,`${label}/${name}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved,false)
    if (expected) {
      assert.equal(result.contourCount,4)
      assert.deepEqual(result.overlaps,[])
    } else {
      assert.equal(result.diagnostics?.[0]?.code,'INVALID_CUT_DXF')
      assert.match(result.diagnostics[0].detail,/handle|owner|reference|dictionary/i)
    }
  }
}
const replace = (source, from, to) => {
  assert.ok(source.includes(from),`fixture has ${from}`)
  return source.replace(from,to)
}

test('self-contained TABLES/OBJECTS owner graph and null-root owners remain inspectable',()=>{
  check(dxf(records()),true,'valid local handle graph')
  const withDimstyle = records()
  withDimstyle.table.push('0','TABLE','2','DIMSTYLE',
    '0','DIMSTYLE','105','D0','330','0','2','STANDARD',
    '5','_CLOSED','6','','7','','70','0','0','ENDTAB')
  check(dxf(withDimstyle),true,'DIMSTYLE 105 handle and arrow-name groups 5/6/7')
})

test('dangling owners and dictionary/hard-owner targets cannot pass CUT inspection',()=>{
  const base=dxf(records())
  for (const [label,from,to] of [
    ['LAYER owner','5\nA1\n330\nA0','5\nA1\n330\nDEAD'],
    ['XRECORD owner','5\nB1\n330\nB0','5\nB1\n330\nDEAD'],
    ['dictionary target','3\nNOTCH_METADATA\n350\nB1','3\nNOTCH_METADATA\n350\nDEAD'],
    ['null dictionary target','3\nNOTCH_METADATA\n350\nB1','3\nNOTCH_METADATA\n350\n0'],
    ['hard owner','5\nB1\n330\nB0','5\nB1\n330\nB0\n360\nDEAD'],
    ['null hard owner','5\nB1\n330\nB0','5\nB1\n330\nB0\n360\n0'],
    ['handleless dictionary','5\nB0\n330\n0','330\n0'],
    ['handleless XRECORD','5\nB1\n330\nB0','330\nB0'],
  ]) check(replace(base,from,to),false,label)
})

test('duplicate, malformed, self-referential and cyclic handles fail closed',()=>{
  const base=dxf(records())
  for (const [label,from,to] of [
    ['duplicate object handle','5\nB1\n330\nB0','5\nA1\n330\nB0'],
    ['case-insensitive duplicate','5\nB1\n330\nB0','5\na1\n330\nB0'],
    ['zero-padded duplicate','5\nB1\n330\nB0','5\n00A1\n330\nB0'],
    ['duplicate handle on record','5\nB1\n330\nB0','5\nB1\n5\nB2\n330\nB0'],
    ['malformed object handle','5\nB1\n330\nB0','5\nZZZ\n330\nB0'],
    ['null object handle','5\nB1\n330\nB0','5\n0\n330\nB0'],
    ['self owner','5\nB1\n330\nB0','5\nB1\n330\nB1'],
    ['self dictionary reference','350\nB1','350\nB0'],
    ['ownership cycle','5\nB0\n330\n0','5\nB0\n330\nB1'],
  ]) check(replace(base,from,to),false,label)
})
