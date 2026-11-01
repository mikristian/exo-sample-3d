import test from 'node:test'
import assert from 'node:assert/strict'
import {strictCutDxfEnvelope20261023_2053 as strictCut} from './strictCutDxfEnvelope20261023_2053.mjs'
import {preflightPhysicalCutOverlap20261023_2000 as physicalCut} from './physicalCutOverlapPreflight20261023_2000.mjs'

// Disposable four-contour garment: two graded sizes, shell and lining.
// This is an inspection fixture, never a cutting authorization.
const pieces = [['48','shell',0],['48','lining',20],['52','shell',40],['52','lining',60]]
const corners = x => [[x,0],[x+10,0],[x+10,10],[x,10]]
const xy = (x,y) => ['10',String(x),'20',String(y)]
const validVertices = x => corners(x).flatMap(([vx,vy])=>xy(vx,vy))
const dxf = (firstVertices, extraHeader = []) => [
  '0','SECTION','2','ENTITIES',
  ...pieces.flatMap(([size,fabric,x],index)=>[
    '0','LWPOLYLINE','8',`CUT_${size}_${fabric}`,'90','4','70','1',
    ...(index===0?extraHeader:[]),...(index===0?firstVertices:validVertices(x)),
  ]),
  '0','ENDSEC','0','EOF','',
].join('\n')
const inspectors = [['strict CUT envelope',strictCut],['standalone CUT overlap',physicalCut]]

function expectInspection(source, accepted, label) {
  for (const [name,inspect] of inspectors) {
    const result = inspect(source)
    assert.equal(result.ok,accepted,`${label} / ${name}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved,false)
    if (accepted) {
      assert.equal(result.contourCount,4)
      assert.deepEqual(result.overlaps,[])
    } else {
      assert.equal(result.diagnostics?.[0]?.code,'INVALID_CUT_DXF')
    }
  }
}

test('ordered four-contour two-size two-fabric CUT is inspection-only',()=>{
  expectInspection(dxf(validVertices(0)),true,'normal 10/20 vertex pairs')
  expectInspection(dxf(corners(0).flatMap(([x,y])=>[...xy(x,y),'40','0','41','0']),['43','0']),true,'valid zero widths following complete vertex pairs')
})

test('two X values followed by two Y values must not be silently zipped into vertices',()=>{
  const v=['10','0','10','10','20','0','20','0',...validVertices(0).slice(8)]
  expectInspection(dxf(v),false,'interleaved coordinate order')
})

test('orphan Y before first X and duplicate Y after complete pair fail closed',()=>{
  expectInspection(dxf(['20','0',...validVertices(0).slice(0,-2)]),false,'orphan initial Y')
  expectInspection(dxf(['10','0','20','0','20','0',...validVertices(0).slice(4,-2)]),false,'duplicate Y on first vertex')
})

test('missing Y before next X and trailing unpaired X fail closed',()=>{
  expectInspection(dxf(['10','0',...validVertices(0).slice(4),'20','0']),false,'missing first Y before next X')
  expectInspection(dxf([...validVertices(0).slice(0,-2),'10','0']),false,'trailing unpaired X')
})

test('vertex metadata between X and Y cannot alter point association',()=>{
  const v=['10','0','40','0','20','0',...validVertices(0).slice(4)]
  expectInspection(dxf(v),false,'zero width interrupts coordinate pair')
})
