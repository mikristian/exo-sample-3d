import test from 'node:test'
import assert from 'node:assert/strict'
import {validateSixSizeRegenerationPreview20261027 as validate} from './nativeSixSizePreviewValidator20261028.js'
const sizes=['XS','S','M','L','XL','XXL']
const fixture=()=>({format:'exo-native-reactive-size-run.v1',sourceRevision:42,manufacturerApproved:false,factoryApproved:false,changedPanels:1,changedBindings:1,panelIds:['front'],bindingIds:['width'],measurementOverrides:{width:380},bySize:sizes.map(size=>({size,changes:[{panelId:'front',pointIndex:1,beforeMm:[400,0],afterMm:[380,0]}]})),perSizeMeasurements:sizes.map(size=>({size,measurements:[{panelId:'front',id:'span',label:'Width',beforeMm:280,afterMm:266},{panelId:'back',id:'span',label:'Width',beforeMm:280,afterMm:280}]}))})
test('accepts complete six-size POM evidence, unchanged measurements, and older receipts without invented evidence',()=>{
 const f=fixture();assert.equal(validate(f,42),true)
 delete f.perSizeMeasurements;assert.equal(validate(f,42),true)
 f.perSizeMeasurements=sizes.map(size=>({size,measurements:[]}));assert.equal(validate(f,42),true)
})
test('rejects missing size, duplicate size, missing measurement and identity/label drift',()=>{
 for(const mutate of [
  f=>f.perSizeMeasurements.pop(),
  f=>f.perSizeMeasurements[0].size='M',
  f=>f.perSizeMeasurements[0].measurements.pop(),
  f=>f.perSizeMeasurements[0].measurements.push(f.perSizeMeasurements[0].measurements[0]),
  f=>f.perSizeMeasurements[0].measurements[0].id='renamed',
  f=>f.perSizeMeasurements[0].measurements[0].label='renamed',
  f=>f.perSizeMeasurements[0].measurements[0].panelId='missing',
 ]){const f=fixture();mutate(f);assert.equal(validate(f,42),false)}
})
test('rejects invalid physical values and malformed receipt rows without throwing',()=>{
 for(const value of [NaN,Infinity,-1,0,.01,'280',null])for(const field of ['beforeMm','afterMm']){
  const f=fixture();f.perSizeMeasurements[0].measurements[0][field]=value;assert.equal(validate(f,42),false)
 }
 for(const value of [null,{},[null],[]]){const f=fixture();f.perSizeMeasurements=value;assert.equal(validate(f,42),false)}
 const f=fixture();f.perSizeMeasurements[0].measurements=[null];assert.equal(validate(f,42),false)
})
test('source inventory prevents uniformly omitted or fabricated measurements across all six sizes',()=>{
 const source={panels:['front','back'].map(id=>({id,polygon:{measurements:[{id:'span',label:'Width'}]}}))}
 const f=fixture();assert.equal(validate(f,42,null,source),true)
 for(const row of f.perSizeMeasurements)row.measurements.pop()
 assert.equal(validate(f,42,null,source),false)
 delete f.perSizeMeasurements;assert.equal(validate(f,42,null,source),false)
 assert.equal(validate(fixture(),42,null,{panels:[]}),false)
})
