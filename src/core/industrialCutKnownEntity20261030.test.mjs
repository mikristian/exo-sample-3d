import test from 'node:test'
import assert from 'node:assert/strict'
import {preflightPhysicalCutOverlap20261023_2000 as physical} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {strictCutDxfEnvelope20261023_2053 as strict} from './strictCutDxfEnvelope20261023_2053.mjs'

// Disposable XS/M shell-and-lining pieces. This is CUT source inspection,
// not cutting authorization or receiving-CAD acceptance.
const rect = (layer,x) => ['0','LWPOLYLINE','8',layer,'90','4','70','1',
  '10',String(x),'20','0','10',String(x+10),'20','0',
  '10',String(x+10),'20','10','10',String(x),'20','10']
const contours = [['XS','SHELL',0],['XS','LINING',25],['M','SHELL',50],['M','LINING',75]]
  .flatMap(([size,fabric,x])=>rect(`CUT_${size}_${fabric}`,x))
const section = (name,records) => ['0','SECTION','2',name,...records,'0','ENDSEC']
const dxf = (entities=contours,blocks=[],objects=[]) => [
  ...(blocks.length ? section('BLOCKS',blocks) : []),
  ...(objects.length ? section('OBJECTS',objects) : []),
  ...section('ENTITIES',entities),'0','EOF','',
].join('\n')
const block = inner => ['0','BLOCK','8','0','2','DORMANT','70','0','10','0','20','0','30','0',
  ...inner,'0','ENDBLK','8','0']

function verify(source,expected,description) {
  for (const [name,inspect] of [['physical',physical],['strict',strict]]) {
    const result=inspect(source)
    assert.equal(result.ok,expected,`${description}/${name}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved,false)
    if(expected) { assert.equal(result.contourCount,4); assert.deepEqual(result.overlaps,[]) }
    else { assert.equal(result.diagnostics?.[0]?.code,'INVALID_CUT_DXF') }
  }
}

test('direct CUT and known, non-CUT annotation types remain inspectable',()=>{
  verify(dxf(),true,'four disposable CUT pieces')
  for (const kind of ['LINE','ARC','CIRCLE','POINT','TEXT','MTEXT','HATCH','LWPOLYLINE']) {
    verify(dxf([...contours,'0',kind,'8','ANNOTATION','10','120','20','120']),true,kind)
  }
  verify(dxf(contours,block(['0','LINE','8','ANNOTATION','10','120','20','120']),
    ['0','DICTIONARY','5','A1','100','AcDbDictionary']),true,'dormant local BLOCK and OBJECTS dictionary')
  for (const kind of ['DICTIONARYWDFLT','XRECORD','ACDBPLACEHOLDER']) {
    verify(dxf(contours,[],['0',kind,'5','A1']),true,kind+'/OBJECTS metadata')
  }
})

test('unknown and vendor-defined ENTITIES on non-CUT layers fail closed',()=>{
  for (const kind of ['AECC_PIPE','AECB_WALL','VENDOR_NEST_BOUNDARY','EXO_EXTENSION_ENTITY','CUSTOM_PATTERN','ACAD_TABLE']) {
    for (const layer of ['0','ANNOTATION']) {
      verify(dxf([...contours,'0',kind,'8',layer,'10','5','20','5']),false,kind+'/'+layer)
    }
    verify(dxf([...contours,'0',kind,'10','5','20','5']),false,kind+'/missing layer')
  }
})

test('unknown vendor entity hidden in dormant BLOCK fails closed',()=>{
  for (const kind of ['AECC_PIPE','VENDOR_NEST_BOUNDARY','CUSTOM_PATTERN']) {
    verify(dxf(contours,block(['0',kind,'8','0','10','0','20','0'])),false,kind)
  }
  verify(dxf(contours,['0','VENDOR_NEST_BOUNDARY','8','0']),false,'orphan vendor record in BLOCKS')
})

test('unknown drawing records outside ENTITIES cannot hide in HEADER or OBJECTS',()=>{
  for (const kind of ['VENDOR_NEST_BOUNDARY','CUSTOM_PATTERN']) {
    const header=section('HEADER',['0',kind,'8','0','10','5','20','5'])
    verify([...header,...section('ENTITIES',contours),'0','EOF',''].join('\n'),false,kind+'/HEADER')
    verify(dxf(contours,[],['0',kind,'8','0','10','5','20','5']),false,kind+'/OBJECTS')
  }
  verify(dxf(contours,[],['0','LINE','8','ANNOTATION','10','5','20','5']),false,'known geometry in OBJECTS')
  verify(dxf(contours,[],['0','DICTIONARY','8','CUT_HIDDEN']),false,'metadata on CUT layer')
  verify(dxf([...contours,'0','LINE','8','CUT_UNKNOWN','10','5','20','5']),false,'known unsupported CUT primitive')
})

test('TABLES and CLASSES accept only documented structural record types',()=>{
  for (const [name,records] of [
    ['TABLES',['0','TABLE','2','LAYER','70','0','0','LAYER','2','ANNOTATION','70','0',
      ...['CUT_XS_SHELL','CUT_XS_LINING','CUT_M_SHELL','CUT_M_LINING'].flatMap(name=>['0','LAYER','2',name,'70','0']),
      '0','ENDTAB']],
    ['CLASSES',['0','CLASS','1','AcDbDictionary','2','AcDbDictionary','3','ObjectDBX Classes']],
  ]) {
    verify([...section(name,records),...section('ENTITIES',contours),'0','EOF',''].join('\n'),true,name+'/known')
    verify([...section(name,['0','VENDOR_NEST_BOUNDARY','8','ANNOTATION']),
      ...section('ENTITIES',contours),'0','EOF',''].join('\n'),false,name+'/unknown')
  }
})
