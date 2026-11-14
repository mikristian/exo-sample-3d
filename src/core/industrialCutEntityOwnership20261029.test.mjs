import test from 'node:test'
import assert from 'node:assert/strict'
import {preflightPhysicalCutOverlap20261023_2000 as physical} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {strictCutDxfEnvelope20261023_2053 as strict} from './strictCutDxfEnvelope20261023_2053.mjs'

// Disposable two-size, two-fabric pattern. Synthetic inspection evidence only;
// neither validator grants physical cutting or factory release.
const parts = [
  ['XS','SHELL',0], ['XS','LINING',25], ['M','SHELL',50], ['M','LINING',75],
]
const rect = (layer, x) => [
  '0','LWPOLYLINE','8',layer,'90','4','70','1',
  '10',String(x),'20','0','10',String(x+10),'20','0',
  '10',String(x+10),'20','10','10',String(x),'20','10',
]
const direct = parts.flatMap(([size, fabric, x]) => rect(`CUT_${size}_${fabric}`,x))
const section = (name, records) => ['0','SECTION','2',name,...records,'0','ENDSEC']
const wrap = (sections) => [...sections.flat(),'0','EOF',''].join('\n')
const directSection = section('ENTITIES',direct)
const block = [
  '0','BLOCK','8','0','2','UNREFERENCED','70','0','10','0','20','0','30','0',
  ...rect('CUT_DORMANT',0),'0','ENDBLK','8','0',
]

function expectBoth(source, ok, reason) {
  for (const [name, inspect] of [['physical',physical],['strict',strict]]) {
    const result = inspect(source)
    assert.equal(result.ok,ok,`${reason}/${name}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved,false)
    if (ok) {
      assert.equal(result.contourCount,4)
      assert.deepEqual(result.overlaps,[])
    } else {
      assert.equal(result.diagnostics?.[0]?.code,'INVALID_CUT_DXF',`${reason}/${name}`)
      assert.match(result.diagnostics?.[0]?.detail ?? '',/outside ENTITIES|BLOCK|ENDBLK/i)
    }
  }
}

test('four graded/fabric CUT contours remain inspectable with dormant BLOCK definitions', () => {
  expectBoth(wrap([section('HEADER',['9','$ACADVER','1','AC1009']),section('BLOCKS',block),directSection]),true,'dormant block')
  expectBoth(wrap([directSection]),true,'direct contours')
})

test('CUT LWPOLYLINE in HEADER is not silently ignored', () => {
  expectBoth(wrap([section('HEADER',rect('CUT_HIDDEN',0)),directSection]),false,'HEADER CUT')
})

test('unowned CUT POLYLINE in TABLES is not silently ignored', () => {
  const poly = ['0','POLYLINE','8','CUT_HIDDEN','66','1','70','1',
    '0','VERTEX','8','CUT_HIDDEN','10','0','20','0','0','SEQEND']
  expectBoth(wrap([section('TABLES',poly),directSection]),false,'TABLES CUT')
})

test('unknown CUT-layer entity and layer-zero drawing geometry outside ENTITIES fail closed', () => {
  expectBoth(wrap([section('OBJECTS',['0','VENDOR_SHAPE','8','CUT_HIDDEN','10','0','20','0']),directSection]),false,'unknown CUT')
  expectBoth(wrap([section('HEADER',['0','LINE','8','0','10','0','20','0','11','1','21','1']),directSection]),false,'HEADER LINE')
})

test('BLOCKS geometry must have BLOCK ownership, not merely reside in BLOCKS', () => {
  expectBoth(wrap([section('BLOCKS',rect('CUT_ORPHAN',0)),directSection]),false,'orphan CUT in BLOCKS')
  expectBoth(wrap([section('BLOCKS',[...block.slice(0,-4)]),directSection]),false,'unterminated BLOCK')
  expectBoth(wrap([section('BLOCKS',['0','ENDBLK','8','0']),directSection]),false,'orphan ENDBLK')
  expectBoth(wrap([section('BLOCKS',['0','BLOCK','8','0','2','A','0','BLOCK','8','0','2','B','0','ENDBLK','0','ENDBLK']),directSection]),false,'nested BLOCK')
  expectBoth(wrap([section('OBJECTS',['0','BLOCK','8','0','2','MISPLACED']),directSection]),false,'BLOCK in OBJECTS')
  expectBoth(wrap([section('HEADER',['0','ENDBLK','8','0']),directSection]),false,'ENDBLK in HEADER')
})
