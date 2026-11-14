import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {preflightPhysicalCutOverlap20261023_2000 as physical} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {strictCutDxfEnvelope20261023_2053 as strict} from './strictCutDxfEnvelope20261023_2053.mjs'

// Disposable XS/M shell + lining. This is CUT source inspection, never cutting authorization.
const rect = (layer, x) => ['0','LWPOLYLINE','8',layer,'90','4','70','1',
  '10',String(x),'20','0','10',String(x+10),'20','0',
  '10',String(x+10),'20','10','10',String(x),'20','10']
const contours = [rect('CUT_XS_SHELL',0),rect('CUT_XS_LINING',25),
  rect('CUT_M_SHELL',50),rect('CUT_M_LINING',75)].flat()
const table = (name, records = [], attrs = []) =>
  ['0','TABLE','2',name,...attrs,...records,'0','ENDTAB']
const layer = name => ['0','LAYER','2',name,'70','0','62','7','290','1']
const source = records => [
  '0','SECTION','2','TABLES',...records,'0','ENDSEC',
  '0','SECTION','2','ENTITIES',...contours,'0','ENDSEC','0','EOF','',
].join('\n')
function inspect(dxf, expected, label) {
  for (const [name, fn] of [['physical',physical],['strict',strict]]) {
    const result=fn(dxf)
    assert.equal(result.ok,expected,`${label}/${name}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved,false)
    if (expected) {
      assert.equal(result.contourCount,4)
      assert.deepEqual(result.overlaps,[])
    } else assert.equal(result.diagnostics?.[0]?.code,'INVALID_CUT_DXF')
  }
}

test('standard LAYER and LTYPE TABLE ownership remains inspectable',()=>{
  inspect(source([
    ...table('LTYPE',['0','LTYPE','2','CONTINUOUS','70','0']),
    ...table('LAYER',['CUT_XS_SHELL','CUT_XS_LINING','CUT_M_SHELL','CUT_M_LINING'].flatMap(layer)),
  ]),true,'valid standard tables')
  inspect(source([]),true,'legacy DXF with no optional tables')
  inspect(source(table('LAYER',[
    ...layer('ANNOTATION'),
    ...['CUT_XS_SHELL','CUT_XS_LINING','CUT_M_SHELL','CUT_M_LINING'].flatMap(layer),
  ])),true,'annotation plus declared CUT layers')
})

test('original Seamly AAMA TABLES envelope remains parseable with disposable CUT contours',()=>{
  const original=readFileSync(new URL('../../research/oss/pattern-cad/runtime/verified-exports/male-shirt-engine-aama_pieces.dxf',import.meta.url),'utf8')
  const lines=original.replace(/\r\n?/g,'\n').trimEnd().split('\n').map(v=>v.trim())
  const start=lines.findIndex((v,i)=>v==='0' && lines[i+1]==='SECTION' &&
    lines[i+2]==='2' && lines[i+3]==='TABLES')
  assert.ok(start>=0,'original source has TABLES section')
  let end=start+4
  while (end<lines.length && !(lines[end]==='0' && lines[end+1]==='ENDSEC')) end+=2
  assert.ok(end<lines.length,'original TABLES section closes')
  // Only its upstream TABLES metadata is reused: the synthetic CUT shapes are
  // separate and do not represent Seamly factory geometry or receiver sign-off.
  const upstreamTables=lines.slice(start,end+2)
  const layerStart=upstreamTables.findIndex((v,i)=>v==='0' && upstreamTables[i+1]==='TABLE' &&
    upstreamTables[i+2]==='2' && upstreamTables[i+3]==='LAYER')
  if (layerStart>=0) {
    let layerEnd=layerStart+4
    while (layerEnd<upstreamTables.length && !(upstreamTables[layerEnd]==='0' && upstreamTables[layerEnd+1]==='ENDTAB')) layerEnd+=2
    assert.ok(layerEnd<upstreamTables.length,'upstream LAYER table closes')
    upstreamTables.splice(layerEnd,0,...['CUT_XS_SHELL','CUT_XS_LINING','CUT_M_SHELL','CUT_M_LINING'].flatMap(layer))
  } else {
    upstreamTables.splice(upstreamTables.length-2,0,...table('LAYER',
      ['CUT_XS_SHELL','CUT_XS_LINING','CUT_M_SHELL','CUT_M_LINING'].flatMap(layer)))
  }
  const combined=[...upstreamTables,'0','SECTION','2','ENTITIES',
    ...contours,'0','ENDSEC','0','EOF',''].join('\n')
  inspect(combined,true,'Seamly source TABLES plus disposable garment')
})

test('TABLES ownership and closure cannot hide ambiguous CUT layer definitions',()=>{
  const validLayer=table('LAYER',layer('CUT_XS_SHELL'))
  for (const [name, records] of [
    ['orphan LAYER record',layer('CUT_XS_SHELL')],
    ['LAYER inside LTYPE',table('LTYPE',layer('CUT_XS_SHELL'))],
    ['LTYPE inside LAYER',table('LAYER',['0','LTYPE','2','CONTINUOUS'])],
    ['orphan ENDTAB',['0','ENDTAB']],
    ['duplicate ENDTAB',[...validLayer,'0','ENDTAB']],
    ['missing ENDTAB',validLayer.slice(0,-2)],
    ['nested TABLE',['0','TABLE','2','LAYER',...validLayer,'0','ENDTAB']],
    ['TABLE without name',['0','TABLE',...layer('CUT_XS_SHELL'),'0','ENDTAB']],
    ['duplicate TABLE name',['0','TABLE','2','LAYER','2','LTYPE',...layer('CUT_XS_SHELL'),'0','ENDTAB']],
    ['unsupported TABLE name',table('VENDORCUT',layer('CUT_XS_SHELL'))],
    ['duplicate LAYER table',[...validLayer,...validLayer]],
    ['LAYER missing mandatory name',table('LAYER',['0','LAYER','70','0','62','7'])],
    ['LAYER with blank name',table('LAYER',['0','LAYER','2','  ','70','0'])],
    ['LAYER with duplicate name',table('LAYER',['0','LAYER','2','CUT_XS_SHELL','2','ANNOTATION'])],
  ]) inspect(source(records),false,name)
})
