import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createTeeTemplate} from '../data/templates.js'
import {evaluateValentinaConnected2DRequest20261031 as calculate} from '../../integrations/clothcraft/valentinaConnectedCalculation20261031.mjs'
import {transferValentinaConnectedNativeDraft20261031 as transfer} from './valentinaConnectedNativeTransfer20261031.js'

const base=new URL('../../research/oss/pattern-cad/ValentinaDevelop20261031/src/app/share/collection/MaleShirt/',import.meta.url)
const patternXml=readFileSync(new URL('MaleShirt.val',base),'utf8')
const measurementsXml=readFileSync(new URL('MaleShirt.vit',base),'utf8')
const input={patternXml,measurementsXml,format:'aama-r10',sourceUnit:'mm',
  constructionEdits:[{kind:'increment',name:'#Hemline',formula:'height/2-5'}]}

test('actual edited upstream Valentina formula yields AAMA and reversible native source provenance',async()=>{
  const result=calculate(input)
  assert.equal(result.ok,true,result.reason)
  assert.equal(result.artifacts.length,1)
  const original=createTeeTemplate(),snapshot=JSON.stringify(original)
  const {project}=await transfer(original,{baselinePatternXml:patternXml,measurementsXml,engineResult:result})
  assert.equal(project.patternSource.sourceSha256,result.inputSha256)
  assert.equal(project.patternSource.baselinePatternXml,patternXml)
  assert.equal(project.patternSource.editedOriginalPatternXml,result.editedOriginalPatternXml)
  assert.equal(project.patternSource.constructionEdits[0].formula,'height/2-5')
  assert.ok(project.pieces.length>0)
  assert.equal(project.patternSource.productionExportAllowed,false)
  assert.equal(project.patternSource.nativeRustParametricGraphCommitted,false)
  assert.equal(JSON.stringify(original),snapshot)
  await assert.rejects(transfer(original,{baselinePatternXml:patternXml+' ',measurementsXml,engineResult:result}),/baseline/)
  await assert.rejects(transfer(original,{baselinePatternXml:patternXml,measurementsXml,engineResult:{
    ...result,artifacts:[{...result.artifacts[0],content:result.artifacts[0].content+'\n'}],
  }}),/artifact mismatch/)
})
