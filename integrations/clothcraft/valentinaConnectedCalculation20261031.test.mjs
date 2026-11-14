import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {projectValentinaConstructionEdits20261031 as project,evaluateValentinaConnected2DRequest20261031 as calculate} from './valentinaConnectedCalculation20261031.mjs'

const shirt=new URL('../../research/oss/pattern-cad/ValentinaDevelop20261031/src/app/share/collection/MaleShirt/',import.meta.url)
const trousers=new URL('../../research/oss/pattern-cad/ValentinaDevelop20261031/src/app/share/collection/Trousers/',import.meta.url)
const load=(directory,p,m)=>({patternXml:readFileSync(new URL(p,directory),'utf8'),measurementsXml:readFileSync(new URL(m,directory),'utf8')})
const male=load(shirt,'MaleShirt.val','MaleShirt.vit')
const pant=load(trousers,'Trousers.val','trousers.vit')

test('source-preserving original paired formula edit retains independent graph identity',()=>{
  const res=project(male.patternXml,[{kind:'increment',name:'#Hemline',formula:'height/2-5'}])
  assert.equal(res.identity,'MaleShirt')
  assert.match(res.originalPatternXml,/<increment[^>]*name="#Hemline"[^>]*formula="height\/2-5"/)
  assert.match(res.pairedPatternXml,/<increment[^>]*formula="height\/2-5"[^>]*name="#Hemline"/)
  assert.equal(res.originalPatternXml.replace('formula="height/2-5"','formula="height/2-10"'),male.patternXml)
  assert.notEqual(res.baselineSha256,res.editedValentinaSha256)
  const tool=project(male.patternXml,[{kind:'tool-length',block:0,id:2,formula:'#Hemline+4'}])
  assert.match(tool.originalPatternXml,/id="2"[^>]*length="#Hemline\+4"/)
})

test('connected original engine recalculates complete physical source after editing a construction increment',()=>{
  const input={...male,format:'svg'}
  const original=calculate({...input,constructionEdits:[{kind:'increment',name:'#Hemline',formula:'height/2-10'}]})
  const changed=calculate({...input,constructionEdits:[{kind:'increment',name:'#Hemline',formula:'height/2-5'}]})
  assert.equal(original.ok,true,original.reason)
  assert.equal(changed.ok,true,changed.reason)
  assert.equal(changed.bridge,'verified-connected-maleshirt')
  assert.equal(changed.manufacturingApproved,false)
  assert.equal(changed.artifacts.length,1)
  assert.match(changed.artifacts[0].content,/<svg\b/)
  assert.notEqual(original.artifacts[0].sha256,changed.artifacts[0].sha256)
  assert.notEqual(original.inputSha256,changed.inputSha256)
})

test('authentic trousers formula maps correctly; rejects wrong original, mismatched mapping and bad edits',()=>{
  const r=project(pant.patternXml,[{kind:'increment',name:'#FrontPanelWidth',formula:'#HipCircumference/4+2'}])
  assert.equal(r.identity,'Trousers')
  const errors=[
    ()=>project(pant.patternXml+'\n',[{kind:'increment',name:'#FrontPanelWidth',formula:'#HipCircumference/4+2'}]),
    ()=>project(male.patternXml,[{kind:'increment',name:'#ArmLenght',formula:'55'}]),
    ()=>project(male.patternXml,[{kind:'increment',name:'#Hemline',formula:'javascript:evil'}]),
    ()=>project(male.patternXml,[{kind:'increment',name:'#Hemline',formula:'height/2-5'},{kind:'increment',name:'#Hemline',formula:'1'}]),
    ()=>project(male.patternXml,[{kind:'tool-length',block:99,id:2,formula:'5'}]),
  ]
  for(const invoke of errors) assert.throws(invoke)
  const error=calculate({...male,format:'svg',constructionEdits:[{kind:'increment',name:'#NoSuchVariable',formula:'2'}]})
  assert.equal(error.ok,false)
  assert.equal(error.manufacturingApproved,false)
})
