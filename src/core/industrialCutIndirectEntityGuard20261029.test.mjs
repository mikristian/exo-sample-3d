import test from 'node:test'
import assert from 'node:assert/strict'
import {strictCutDxfEnvelope20261023_2053 as strictCut} from './strictCutDxfEnvelope20261023_2053.mjs'
import {preflightPhysicalCutOverlap20261023_2000 as physicalCut} from './physicalCutOverlapPreflight20261023_2000.mjs'

// Disposable four-contour garment: two graded sizes, shell and lining.
// These are inspection-only synthetic DXFs, not licensed receiving-CAD proof.
const pieces=[['48','shell',0],['48','lining',20],['52','shell',40],['52','lining',60]]
const square=x=>[
  '10',String(x),'20','0','10',String(x+10),'20','0',
  '10',String(x+10),'20','10','10',String(x),'20','10',
]
const cut=(layer,x)=>['0','LWPOLYLINE','8',layer,'90','4','70','1',...square(x)]
const cuts=pieces.flatMap(([size,fabric,x])=>cut(`CUT_${size}_${fabric}`,x))
const block=[
  '0','SECTION','2','BLOCKS',
  '0','BLOCK','8','0','2','HIDDEN_PIECE','70','0','10','0','20','0','30','0',
  ...cut('CUT_BLOCK_HIDDEN',0),
  '0','ENDBLK','8','0',
  '0','ENDSEC',
]
const dxf=(extra=[],withBlock=true)=>[
  ...(withBlock?block:[]),'0','SECTION','2','ENTITIES',
  ...cuts,...extra,'0','ENDSEC','0','EOF','',
].join('\n')
const inspectors=[['strict envelope',strictCut],['standalone physical overlap',physicalCut]]
function inspectAll(source,expected,label) {
  for (const [name,inspect] of inspectors) {
    const result=inspect(source)
    assert.equal(result.ok,expected,`${label} / ${name}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved,false)
    if (expected) {
      assert.equal(result.contourCount,4)
      assert.deepEqual(result.overlaps,[])
    } else {
      assert.equal(result.diagnostics?.[0]?.code,'INVALID_CUT_DXF',`${label} / ${name}`)
      assert.match(result.diagnostics?.[0]?.detail??'',/indirect CUT geometry/)
    }
  }
}

test('four direct CUT contours remain inspection-only with an unreferenced BLOCK',()=>{
  inspectAll(dxf(),true,'uninstantiated block definition')
  inspectAll(dxf(['0','LINE','8','ANNOTATION','10','100','20','100','11','110','21','100'],false),
    true,'ordinary non-CUT annotation')
})

test('layer-zero INSERT cannot hide transformed CUT contours inside a BLOCK',()=>{
  inspectAll(dxf(['0','INSERT','8','0','2','HIDDEN_PIECE','10','0','20','0']),
    false,'insert on non-CUT layer')
})

test('CUT-layer INSERT is unsupported even if the direct CUT contours are valid',()=>{
  inspectAll(dxf(['0','INSERT','8','CUT_INSTANCE','2','HIDDEN_PIECE','10','0','20','0']),
    false,'insert on CUT layer')
})

test('array MINSERT placement is not silently ignored by either inspector',()=>{
  inspectAll(dxf(['0','INSERT','8','0','2','HIDDEN_PIECE','70','2','71','2',
    '44','12','45','12','10','0','20','0']),false,'array block placement')
})

test('DIMENSION block references on layer zero cannot bypass physical CUT inspection',()=>{
  inspectAll(dxf(['0','DIMENSION','8','0','2','HIDDEN_PIECE','10','0','20','0']),
    false,'dimension block reference')
})
