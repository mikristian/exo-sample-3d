import test from 'node:test'
import assert from 'node:assert/strict'
import {preflightPhysicalCutOverlap20261023_2000 as physical} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {strictCutDxfEnvelope20261023_2053 as strict} from './strictCutDxfEnvelope20261023_2053.mjs'

// Disposable XS/M, shell/lining garment. These are source-inspection checks,
// never physical cutting authorization or receiving-CAD sign-off.
const rectangle = (layer, x) => ['0','LWPOLYLINE','8',layer,'90','4','70','1',
  '10',String(x),'20','0','10',String(x+10),'20','0',
  '10',String(x+10),'20','10','10',String(x),'20','10']
const contours = [
  rectangle('CUT_XS_SHELL',0),rectangle('CUT_XS_LINING',25),
  rectangle('CUT_M_SHELL',50),rectangle('CUT_M_LINING',75),
].flat()
const layer = (name, attrs = []) => ['0','LAYER','2',name,...attrs]
const source = records => [
  '0','SECTION','2','TABLES','0','TABLE','2','LAYER','70','4',
  ...records,'0','ENDTAB','0','ENDSEC',
  '0','SECTION','2','ENTITIES',...contours,'0','ENDSEC','0','EOF','',
].join('\n')

function expectInspection(dxf, ok, name) {
  for (const [inspector, fn] of [['physical',physical],['strict',strict]]) {
    const result = fn(dxf)
    assert.equal(result.ok,ok,`${name}/${inspector}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved,false)
    if (ok) {
      assert.equal(result.contourCount,4)
      assert.deepEqual(result.overlaps,[])
    } else {
      assert.equal(result.diagnostics?.[0]?.code,'INVALID_CUT_DXF')
    }
  }
}

test('visible plottable CUT layer table records remain inspectable',()=>{
  expectInspection(source([
    layer('CUT_XS_SHELL',['70','0','62','7','290','1']),
    layer('CUT_XS_LINING',['70','4','62','7','290','1']), // locked is not hidden
    layer('CUT_M_SHELL',['70','64','62','7']),
    layer('CUT_M_LINING',['70','0','62','7']),
  ].flat()),true,'visible CUT layers')
  expectInspection(source([
    ...layer('ANNOTATION',['70','1','62','-7','290','0']),
    ...['CUT_XS_SHELL','CUT_XS_LINING','CUT_M_SHELL','CUT_M_LINING'].flatMap(name=>layer(name,['70','0','62','7'])),
  ]),true,
    'non-CUT annotation visibility does not change physical CUT contours')
})

test('frozen, off and non-plot CUT layers fail closed',()=>{
  for (const [description, attrs] of [
    ['frozen',['70','1']],['frozen in new viewport',['70','2']],
    ['externally dependent',['70','16']],['xref resolved',['70','32']],
    ['frozen and locked',['70','5']],
    ['off',['62','-7']],['non-plot',['290','0']],
  ]) expectInspection(source(layer('CUT_XS_SHELL',attrs)),false,description)
  expectInspection(source(layer('cut_xs_shell',['70','1','62','7','290','1'])),false,
    'case-folded frozen CUT layer')
})

test('ambiguous CUT layer metadata cannot be interpreted differently by receiver',()=>{
  for (const [description, attrs] of [
    ['duplicate flags',['70','0','70','1']],
    ['duplicate color',['62','7','62','-7']],
    ['duplicate plot',['290','1','290','0']],
    ['fractional flags',['70','0.5']],
    ['overflow flags',['70','4294967296']],
    ['invalid color',['62','abc']],
    ['invalid plot',['290','2']],
  ]) expectInspection(source(layer('CUT_XS_SHELL',attrs)),false,description)
  expectInspection(source([
    ...layer('CUT_XS_SHELL',['70','0']),...layer('CUT_XS_SHELL',['70','1']),
  ]),false,'duplicate CUT layer declarations')
  expectInspection(source([
    ...layer('CUT_XS_SHELL',['70','0']),...layer('cut_xs_shell',['70','0']),
  ]),false,'case-folded duplicate CUT layer declarations')
})

test('mixed-case CUT geometry is checked and duplicate names fold case',()=>{
  const replacing = (before, after) => source(
    ['CUT_XS_SHELL','CUT_XS_LINING','CUT_M_SHELL','CUT_M_LINING'].flatMap(name=>layer(name,['70','0','62','7']))
  ).replace(before,after)
  expectInspection(replacing('CUT_XS_SHELL','cut_xs_shell'),true,'lowercase CUT outline remains inspectable')
  const entities = [
    ...rectangle('cut_xs_shell',0), ...rectangle('CUT_XS_SHELL',110),
    ...rectangle('CUT_XS_LINING',25),...rectangle('CUT_M_SHELL',50),...rectangle('CUT_M_LINING',75),
  ]
  const duplicate = ['0','SECTION','2','ENTITIES',...entities,'0','ENDSEC','0','EOF',''].join('\n')
  for (const fn of [physical,strict]) {
    const result=fn(duplicate)
    assert.equal(result.ok,false,JSON.stringify(result))
    assert.match(result.diagnostics?.[0]?.detail||'',/duplicate physical CUT layer/i)
  }
  const unsupported = ['0','SECTION','2','ENTITIES',...contours,
    '0','CIRCLE','8','cUt_XS_extra','10','0','20','0','40','1',
    '0','ENDSEC','0','EOF',''].join('\n')
  for (const fn of [physical,strict]) assert.equal(fn(unsupported).ok,false,'mixed-case unsupported CUT geometry')
})
