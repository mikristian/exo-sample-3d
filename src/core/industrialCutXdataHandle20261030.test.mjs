import test from 'node:test'
import assert from 'node:assert/strict'
import {preflightPhysicalCutOverlap20261023_2000 as physical} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {strictCutDxfEnvelope20261023_2053 as strict} from './strictCutDxfEnvelope20261023_2053.mjs'

// Disposable XS/M shell-and-lining CUT contours; inspection is never cutting authorization.
const names = ['CUT_XS_SHELL', 'CUT_XS_LINING', 'CUT_M_SHELL', 'CUT_M_LINING']
const contour = (name, i) => {
  const x = i * 25
  return ['0','LWPOLYLINE','5',`C${i + 1}`,'330','0','8',name,'90','4','70','1',
    '10',String(x),'20','0','10',String(x + 10),'20','0',
    '10',String(x + 10),'20','10','10',String(x),'20','10']
}
const dxf = ({entityXdata = [], layerXdata = [], objectXdata = [], blockXdata = [], appIdTable = true} = {}) => [
  '0','SECTION','2','TABLES',
  '0','TABLE','5','A0','2','LAYER',
  ...names.flatMap((name, i) => ['0','LAYER','5',`A${i + 1}`,'330','A0','2',name,'70','0','62','7',...(i === 0 ? layerXdata : [])]),
  '0','ENDTAB',
  ...(appIdTable ? ['0','TABLE','2','APPID','0','APPID','5','D1','330','0','2','EXO_CUT_QA','70','0','0','ENDTAB'] : []),
  '0','ENDSEC',
  '0','SECTION','2','BLOCKS',
  '0','BLOCK','5','E1','330','0','2','LOCAL_BLOCK',...blockXdata,
  '0','ENDBLK','5','E2','330','0','0','ENDSEC',
  '0','SECTION','2','OBJECTS',
  '0','DICTIONARY','5','B0','330','0','3','LOCAL_METADATA','350','B1',
  '0','XRECORD','5','B1','330','B0','1','source-only',...objectXdata,
  '0','ENDSEC',
  '0','SECTION','2','ENTITIES',
  ...names.flatMap((name, i) => [...contour(name, i),...(i === 0 ? entityXdata : [])]),
  '0','ENDSEC','0','EOF','',
].join('\n')
const xdata = target => ['1001','EXO_CUT_QA','1005',target]
function inspectBoth(source, expected, label) {
  for (const [name, inspect] of [['physical', physical], ['strict', strict]]) {
    const result = inspect(source)
    assert.equal(result.ok, expected, `${label}/${name}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved, false)
    if (expected) {
      assert.equal(result.contourCount, 4)
      assert.deepEqual(result.overlaps, [])
    } else {
      assert.equal(result.diagnostics?.[0]?.code, 'INVALID_CUT_DXF')
      assert.match(result.diagnostics?.[0]?.detail ?? '', /XDATA|APPID|1005|handle|reference/i)
    }
  }
}

test('registered XDATA 1005 references to local CAD records remain inspectable', () => {
  inspectBoth(dxf(), true, 'no XDATA')
  inspectBoth(dxf({entityXdata:xdata('B1')}), true, 'entity references OBJECTS')
  inspectBoth(dxf({entityXdata:xdata('C1')}), true, 'XDATA self pointer is not ownership')
  inspectBoth(dxf({entityXdata:['1001','EXO_CUT_QA','1000','valid annotation','1071','123','1005','B1']}), true, 'valid XDATA payload range')
  inspectBoth(dxf({layerXdata:xdata('000b1')}), true, 'layer references OBJECTS with canonical handle')
  inspectBoth(dxf({objectXdata:xdata('A1'), blockXdata:xdata('C1')}), true, 'OBJECTS and BLOCKS reference local records')
})

test('unresolved XDATA handles fail closed regardless of section or source record', () => {
  for (const section of ['entityXdata','layerXdata','objectXdata','blockXdata']) {
    for (const target of ['DEAD','0','NOT_HEX']) {
      inspectBoth(dxf({[section]:xdata(target)}), false, `${section} -> ${target}`)
    }
  }
})

test('multiple valid XDATA handle links are permitted but a single dangling link fails', () => {
  inspectBoth(dxf({entityXdata:[...xdata('A1'), '1005','B1']}), true, 'two local targets')
  inspectBoth(dxf({entityXdata:[...xdata('A1'), '1005','DEAD']}), false, 'second target dangling')
})

test('XDATA 1005 requires an application marker and nonempty hexadecimal target', () => {
  inspectBoth(dxf({entityXdata:['1005','B1']}), false, '1005 outside XDATA')
  inspectBoth(dxf({entityXdata:['1001','','1005','B1']}), false, 'blank XDATA application name')
  inspectBoth(dxf({entityXdata:['1001','EXO_CUT_QA','1005','']}), false, 'blank XDATA target')
})

test('XDATA application names require APPID registration and trailing XDATA must be contiguous', () => {
  inspectBoth(dxf({entityXdata:['1001','UNREGISTERED','1005','B1']}), false, 'undeclared XDATA application')
  inspectBoth(dxf({entityXdata:xdata('B1'), appIdTable:false}), false, 'XDATA without APPID table')
  inspectBoth(dxf({entityXdata:['1001','EXO_CUT_QA','62','7','1005','B1']}), false, 'interrupted trailing XDATA')
  inspectBoth(dxf({entityXdata:['1000','orphan']}), false, 'orphan XDATA before 1001')
  inspectBoth(dxf({entityXdata:['1001','EXO_CUT_QA','1099','out-of-range']}), false, 'unsupported XDATA group')
})
