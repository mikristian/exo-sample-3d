import test from 'node:test'
import assert from 'node:assert/strict'
import {preflightPhysicalCutOverlap20261023_2000 as physical} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {strictCutDxfEnvelope20261023_2053 as strict} from './strictCutDxfEnvelope20261023_2053.mjs'

// Disposable two-size / two-fabric garment. Source-only inspection, never
// factory authorization or an external CAD receiving qualification.
const pieces = [['XS','SHELL',0],['XS','LINING',25],['M','SHELL',50],['M','LINING',75]]
const rect = (layer,x,metadata=[]) => [
  '0','LWPOLYLINE','8',layer,...metadata,'90','4','70','1',
  '10',String(x),'20','0','10',String(x+10),'20','0',
  '10',String(x+10),'20','10','10',String(x),'20','10',
]
const oldRect = (layer,x,head=[],vertex=[]) => [
  '0','POLYLINE','8',layer,...head,'66','1','70','1',
  ...[[x,0],[x+10,0],[x+10,10],[x,10]].flatMap(([px,py],index) => [
    '0','VERTEX','8',layer,...(index===0?vertex:[]),'10',String(px),'20',String(py),
  ]),
  '0','SEQEND',
]
const wrap = entities => ['0','SECTION','2','ENTITIES',...entities,'0','ENDSEC','0','EOF',''].join('\n')
const baseline = () => pieces.flatMap(([size,fabric,x])=>rect(`CUT_${size}_${fabric}`,x))

function checkBoth(source, expected, label) {
  for (const [name,inspect] of [['physical',physical],['strict',strict]]) {
    const result = inspect(source)
    assert.equal(result.ok,expected,`${label}/${name}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved,false)
    if (expected) {
      assert.equal(result.contourCount,4)
      assert.deepEqual(result.overlaps,[])
    } else {
      assert.equal(result.diagnostics?.[0]?.code,'INVALID_CUT_DXF')
      assert.match(result.diagnostics?.[0]?.detail ?? '',/space|layout|multiplicity/i)
    }
  }
}

test('model-space CUT remains inspectable with omitted or explicit DXF space metadata',()=>{
  checkBoth(wrap(baseline()),true,'implicit model space')
  checkBoth(wrap([
    ...rect('CUT_XS_SHELL',0,['67','0','410','Model']),...baseline().slice(rect('CUT_XS_SHELL',0).length),
  ]),true,'explicit model space')
  checkBoth(wrap([...oldRect('CUT_XS_SHELL',0,['67','0','410','Model'],['67','0','410','Model']),
    ...pieces.slice(1).flatMap(([size,fabric,x])=>rect(`CUT_${size}_${fabric}`,x))]),true,'old POLYLINE model space')
})

test('paper-space and named layout CUT LWPOLYLINE metadata fail closed',()=>{
  for (const metadata of [
    ['67','1'],['410','Layout1'],['67','1','410','Layout1'],
    ['67','0','67','1'],['410','Model','410','Layout1'],
    ['67','NaN'],['410',''],
  ]) {
    const first = rect('CUT_XS_SHELL',0,metadata)
    const rest = pieces.slice(1).flatMap(([size,fabric,x])=>rect(`CUT_${size}_${fabric}`,x))
    checkBoth(wrap([...first,...rest]),false,JSON.stringify(metadata))
  }
})

test('old-style POLYLINE header and VERTEX cannot hide paper-space CUT placement',()=>{
  for (const [head,vertex] of [
    [['67','1'],[]],[['410','Layout1'],[]],
    [[],['67','1']],[[],['410','Layout1']],
    [[],['67','0','67','1']],
  ]) {
    const source = wrap([
      ...oldRect('CUT_XS_SHELL',0,head,vertex),
      ...pieces.slice(1).flatMap(([size,fabric,x])=>rect(`CUT_${size}_${fabric}`,x)),
    ])
    checkBoth(source,false,JSON.stringify({head,vertex}))
  }
})
