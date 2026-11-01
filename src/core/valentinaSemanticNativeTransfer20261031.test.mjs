import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createTeeTemplate} from '../data/templates.js'
import {evaluateValentinaSemanticRequest20261031 as evaluate} from '../../integrations/clothcraft/valentinaSemanticEngineRoute20261031.mjs'
import {transferValentinaSemanticNativeDraft20261031 as transfer} from './valentinaSemanticNativeTransfer20261031.js'

const path=new URL('../../research/oss/pattern-cad/ValentinaDevelop20261031/src/app/share/collection/',import.meta.url)
const patternXml=readFileSync(new URL('MaleShirt/MaleShirt.val',path),'utf8')
const measurementsXml=readFileSync(new URL('MaleShirt/MaleShirt.vit',path),'utf8')
const edited=patternXml.replace('formula="height/2-10"','formula="height/2-6"')

test('semantic original-source edited native AAMA can open reversible EXO CUT draft with full verified provenance',async()=>{
  assert.notEqual(edited,patternXml)
  const engineResult=evaluate({patternXml:edited,measurementsXml,format:'aama-r10',sourceUnit:'cm'})
  assert.equal(engineResult.ok,true,engineResult.reason)
  const original=createTeeTemplate(),snapshot=JSON.stringify(original)
  const {project}=await transfer(original,{patternXml:edited,measurementsXml,engineResult,editable:true})
  assert.equal(project.patternSource.bridge,'semantic-source-translation')
  assert.equal(project.patternSource.originalPatternXml,edited)
  assert.equal(project.patternSource.nativeRustParametricGraphCommitted,false)
  assert.equal(project.patternSource.productionExportAllowed,false)
  assert.ok(project.pieces.length>0)
  assert.ok(project.pieces.every(piece=>piece.locked===false&&piece.active3d===false&&
    piece.patternImportProvenance.productionExportAllowed===false))
  assert.equal(JSON.stringify(original),snapshot)
  await assert.rejects(transfer(original,{patternXml,measurementsXml,engineResult}),/source\/measurement bytes/)
  await assert.rejects(transfer(original,{patternXml:edited,measurementsXml,engineResult:{
    ...engineResult,artifacts:[{...engineResult.artifacts[0],
      content:engineResult.artifacts[0].content+'\n'}],
  }}),/SHA-256/)
})
