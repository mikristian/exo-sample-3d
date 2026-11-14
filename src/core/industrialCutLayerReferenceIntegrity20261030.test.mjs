import test from 'node:test'
import assert from 'node:assert/strict'
import {preflightPhysicalCutOverlap20261023_2000 as physical} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {strictCutDxfEnvelope20261023_2053 as strict} from './strictCutDxfEnvelope20261023_2053.mjs'

// Disposable two-size shell/lining garments, never a factory cutting approval.
const names = ['CUT_XS_SHELL','CUT_XS_LINING','CUT_M_SHELL','CUT_M_LINING']
const contour = (name, x) => ['0','LWPOLYLINE','8',name,'90','4','70','1',
  '10',String(x),'20','0','10',String(x+10),'20','0',
  '10',String(x+10),'20','10','10',String(x),'20','10']
const entityRecords = names.flatMap((name, i) => contour(name, i*25))
const layer = name => ['0','LAYER','2',name,'70','0','62','7','290','1']
const oldPolyline = (name,x,vertexLayer=name) => ['0','POLYLINE','8',name,'66','1','70','1',
  ...[[x,0],[x+10,0],[x+10,10],[x,10]].flatMap(([px,py])=>[
    '0','VERTEX','8',vertexLayer,'10',String(px),'20',String(py),'30','0','70','0',
  ]),'0','SEQEND','8',name]
const dxf = (tableNames, records = entityRecords) => [
  ...(tableNames === null ? [] : ['0','SECTION','2','TABLES','0','TABLE','2','LAYER',
    ...tableNames.flatMap(layer),'0','ENDTAB','0','ENDSEC']),
  '0','SECTION','2','ENTITIES',...records,'0','ENDSEC','0','EOF','',
].join('\n')

function check(source, accepted, label) {
  for (const [inspector, fn] of [['physical',physical],['strict',strict]]) {
    const result = fn(source)
    assert.equal(result.ok,accepted,`${label}/${inspector}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved,false)
    if (accepted) assert.equal(result.contourCount,4)
    else assert.equal(result.diagnostics?.[0]?.code,'INVALID_CUT_DXF')
  }
}

test('complete declared CUT inventory, case-folded names and legacy no-LAYER-table remain inspectable',()=>{
  check(dxf(names),true,'complete CUT LAYER inventory')
  check(dxf(names.map(name=>name.toLowerCase())),true,'case-folded CUT LAYER inventory')
  check(dxf(null),true,'legacy no LAYER table')
})

test('a present LAYER table cannot omit referenced physical CUT layers',()=>{
  for (const [label, declared] of [
    ['empty LAYER table',[]],
    ['annotation-only LAYER table',['ANNOTATION']],
    ['one missing CUT layer',names.slice(0,3)],
    ['only first CUT layer',[names[0]]],
    ['misspelled CUT layer',[...names.slice(0,3),'CUT_M_LINNG']],
    ['similar prefix',[...names.slice(0,3),'CUT_M_LINING_EXTRA']],
  ]) check(dxf(declared),false,label)
})

test('old-style POLYLINE CUT layer references obey the same explicit inventory',()=>{
  const oldStyle=[...names.slice(0,3).flatMap((name,i)=>contour(name,i*25)),oldPolyline(names[3],75)].flat()
  const mixedCase=[...names.slice(0,3).flatMap((name,i)=>contour(name,i*25)),
    oldPolyline(names[3].toLowerCase(),75,names[3])].flat()
  check(dxf(names,oldStyle),true,'old-style declared CUT layer')
  check(dxf(names.slice(0,3),oldStyle),false,'old-style dangling CUT layer')
  check(dxf(null,oldStyle),true,'legacy old-style without LAYER table')
  check(dxf(names,mixedCase),true,'mixed-case POLYLINE/VERTEX identity')
  check(dxf(names.slice(0,3),mixedCase),false,'mixed-case dangling POLYLINE layer')
})
