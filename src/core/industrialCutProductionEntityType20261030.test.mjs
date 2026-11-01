import test from 'node:test'
import assert from 'node:assert/strict'
import {preflightPhysicalCutOverlap20261023_2000 as physical} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {strictCutDxfEnvelope20261023_2053 as strict} from './strictCutDxfEnvelope20261023_2053.mjs'

// Disposable XS/M shell-and-lining contours. The layer names are production
// intents, not evidence of actual cutting, vendor import, or sewn acceptance.
const cuts=['CUT_XS_SHELL','CUT_XS_LINING','CUT_M_SHELL','CUT_M_LINING']
const production=['NOTCH_XS_SHELL','SA_XS_SHELL','NOTCH_M_LINING','SA_M_LINING']
const rect=(layer,x)=>['0','LWPOLYLINE','8',layer,'90','4','70','1',
  '10',String(x),'20','0','10',String(x+10),'20','0',
  '10',String(x+10),'20','10','10',String(x),'20','10']
const mark=(layer,x)=>['0','LINE','8',layer,'10',String(x),'20','1',
  '11',String(x+1),'21','1']
const dxf=(entity,layer,table=true)=>[
  ...(table?['0','SECTION','2','TABLES','0','TABLE','2','LAYER',
    ...[...cuts,...production].flatMap(name=>['0','LAYER','2',name,'70','0','62','7','290','1']),
    '0','ENDTAB','0','ENDSEC']:[]),
  '0','SECTION','2','ENTITIES',
  ...cuts.flatMap((name,i)=>rect(name,i*25)),
  ...production.flatMap((name,i)=>name===layer?entity:mark(name,i*25+1)),
  '0','ENDSEC','0','EOF','',
].join('\n')
const nonLine=(type,layer)=>{
  const base=['0',type,'8',layer]
  if(type==='LWPOLYLINE')return [...base,'90','2','70','0','10','1','20','1','10','2','20','1']
  if(type==='ARC')return [...base,'10','1','20','1','40','1','50','0','51','90']
  if(type==='POINT')return [...base,'10','1','20','1']
  if(type==='CIRCLE')return [...base,'10','1','20','1','40','1']
  if(type==='SPLINE')return [...base,'70','0','71','2','72','0','73','0','74','0']
  if(type==='TEXT')return [...base,'10','1','20','1','40','1','1','CUT HERE']
  throw Error('unsupported disposable test entity')
}
function inspect(source,ok,label){
  for(const [name,fn] of [['physical',physical],['strict',strict]]){
    const result=fn(source)
    assert.equal(result.ok,ok,`${label}/${name}: ${JSON.stringify(result)}`)
    assert.equal(result.manufacturingApproved,false)
    if(ok)assert.equal(result.contourCount,4)
    else {
      assert.equal(result.diagnostics?.[0]?.code,'INVALID_CUT_DXF')
      assert.match(result.diagnostics[0].detail,/production|NOTCH|ALLOWANCE|unsupported/i)
    }
  }
}
test('valid direct production LINE marks remain inspectable across both sizes and fabrics',()=>{
  inspect(dxf(null,'not-a-production-layer'),true,'baseline')
  inspect(dxf(null,'not-a-production-layer',false),true,'legacy no layer table')
  inspect(dxf(mark('NOTCH_XS_SHELL',1),'NOTCH_XS_SHELL'),true,'explicit notch LINE')
  inspect(dxf(mark('SA_M_LINING',76),'SA_M_LINING'),true,'explicit allowance LINE')
})
test('unsupported production entity types cannot masquerade as complete notches or allowance geometry',()=>{
  for(const type of ['LWPOLYLINE','ARC','POINT','CIRCLE','SPLINE','TEXT']){
    for(const layer of production){
      for(const table of [true,false]){
        inspect(dxf(nonLine(type,layer),layer,table),false,`${type}/${layer}/table=${table}`)
      }
    }
  }
})
test('nonproduction annotation polyline is not misrepresented as production geometry',()=>{
  const baseline=dxf(null,'not-a-production-layer')
  const withAnnotation=baseline.replace('0\nENDSEC\n0\nEOF\n',
    `${nonLine('LWPOLYLINE','ANNOTATION').join('\n')}\n0\nENDSEC\n0\nEOF\n`)
  inspect(withAnnotation,true,'unrelated annotation')
})
