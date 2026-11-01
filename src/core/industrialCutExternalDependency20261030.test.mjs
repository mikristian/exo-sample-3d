import test from 'node:test'
import assert from 'node:assert/strict'
import {preflightPhysicalCutOverlap20261023_2000 as physical} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {strictCutDxfEnvelope20261023_2053 as strict} from './strictCutDxfEnvelope20261023_2053.mjs'

// Disposable XS/M shell-and-lining garment: four distinct model-space CUT
// outlines. These tests qualify source inspection only, never factory release.
const pieces = [['XS','SHELL',0],['XS','LINING',25],['M','SHELL',50],['M','LINING',75]]
const rect = (layer,x) => [
  '0','LWPOLYLINE','8',layer,'90','4','70','1',
  '10',String(x),'20','0','10',String(x+10),'20','0',
  '10',String(x+10),'20','10','10',String(x),'20','10',
]
const contours = pieces.flatMap(([size,fabric,x])=>rect(`CUT_${size}_${fabric}`,x))
const section = (name,records) => ['0','SECTION','2',name,...records,'0','ENDSEC']
const dxf = (entities=contours,blocks=[],objects=[]) => [
  ...(blocks.length ? section('BLOCKS',blocks) : []),
  ...(objects.length ? section('OBJECTS',objects) : []),
  ...section('ENTITIES',entities),'0','EOF','',
].join('\n')
const block = (flags='0',path=[],inner=[]) => [
  '0','BLOCK','8','0','2','UNUSED_PIECE','70',flags,...path,
  '10','0','20','0','30','0',...inner,'0','ENDBLK','8','0',
]

function inspect(source, expected, label) {
  for (const [name,fn] of [['physical',physical],['strict',strict]]) {
    const result = fn(source)
    assert.equal(result.ok,expected,`${label}/${name}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved,false)
    if (expected) {
      assert.equal(result.contourCount,4)
      assert.deepEqual(result.overlaps,[])
    } else {
      assert.equal(result.diagnostics?.[0]?.code,'INVALID_CUT_DXF')
      assert.match(result.diagnostics?.[0]?.detail??'',/external|opaque|BLOCK|reference/i)
    }
  }
}

test('self-contained direct CUT remains inspectable with ordinary annotations and dormant local BLOCKs',()=>{
  inspect(dxf(),true,'direct garment')
  inspect(dxf([...contours,'0','LINE','8','ANNOTATION','10','100','20','100','11','110','21','100']),true,'ordinary annotation')
  for (const flags of ['0','1','2','3']) {
    inspect(dxf(contours,block(flags,['1',''],rect('CUT_DORMANT',0))),true,'local BLOCK flags '+flags)
  }
  inspect(dxf(contours,[],['0','DICTIONARY','5','A1','100','AcDbDictionary']),true,'ordinary OBJECTS dictionary')
})

test('external IMAGE, underlay, OLE and opaque proxy on layer zero cannot silently pass CUT handoff inspection',()=>{
  for (const kind of ['IMAGE','PDFUNDERLAY','DWFUNDERLAY','DGNUNDERLAY','WIPEOUT','ACAD_PROXY_ENTITY','OLE2FRAME','OLEFRAME']) {
    inspect(dxf([...contours,'0',kind,'8','0','340','UNRESOLVED_ASSET']),false,kind)
  }
})

test('uninstantiated XREF and overlay BLOCK definitions still violate self-contained CUT handoff',()=>{
  for (const flags of ['4','8','16','32','64','128','5','12','4294967296','4294967297','9007199254740991']) {
    inspect(dxf(contours,block(flags,['1','external-pattern.dxf'])),false,'XREF flags '+flags)
  }
  for (const path of [
    ['1','external-pattern.dxf'],
    ['1','../vendor/pattern.dxf'],
    ['1','file.dxf','1','second.dxf'],
  ]) {
    inspect(dxf(contours,block('0',path)),false,'external path '+JSON.stringify(path))
  }
  inspect(dxf(contours,block('NaN')),false,'invalid BLOCK flags')
  inspect(dxf(contours,block('0',['70','4'])),false,'duplicate BLOCK flags')
})

test('external dependencies hidden inside otherwise dormant local BLOCK definitions fail closed',()=>{
  for (const kind of ['IMAGE','PDFUNDERLAY','WIPEOUT','ACAD_PROXY_ENTITY']) {
    inspect(dxf(contours,block('0',[],['0',kind,'8','0','340','HIDDEN_ASSET'])),false,'dormant BLOCK '+kind)
  }
})

test('external OBJECTS definitions and opaque proxy records cannot evade self-contained CUT checks',()=>{
  for (const kind of ['IMAGEDEF','PDFDEFINITION','DWFDEFINITION','DGNDEFINITION','ACAD_PROXY_OBJECT']) {
    inspect(dxf(contours,[],['0',kind,'1','unresolved-reference.dat']),false,'OBJECTS '+kind)
  }
})
