import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {evaluateValentinaSemanticRequest20261031 as evaluate} from './valentinaSemanticEngineRoute20261031.mjs'

const root=new URL('../../research/oss/pattern-cad/ValentinaDevelop20261031/src/app/share/collection/',import.meta.url)
const male={patternXml:readFileSync(new URL('MaleShirt/MaleShirt.val',root),'utf8'),
  measurementsXml:readFileSync(new URL('MaleShirt/MaleShirt.vit',root),'utf8'),format:'svg'}

test('unpaired original Valentina source formula edit executes entire real pattern via semantic conversion',()=>{
  const original=evaluate(male)
  assert.equal(original.ok,true,original.reason)
  assert.equal(original.bridge,'semantic-source-translation')
  assert.equal(original.convertedSourceToolCount,188)
  assert.equal(original.convertedSourcePieceCount,17)
  const edited=male.patternXml.replace('formula="height/2-10"','formula="height/2-6"')
  assert.notEqual(edited,male.patternXml)
  const changed=evaluate({...male,patternXml:edited})
  assert.equal(changed.ok,true,changed.reason)
  assert.notEqual(original.originalPatternSha256,changed.originalPatternSha256)
  assert.notEqual(original.artifacts[0].sha256,changed.artifacts[0].sha256)
  assert.equal(changed.manufacturingApproved,false)
})
test('invalid source, entity and units are rejected without native execution',()=>{
  const cases=[
    {...male,format:'aama-r10'},
    {...male,patternXml:'<!DOCTYPE pattern><pattern/>'},
    {...male,measurementsXml:'<!ENTITY pwned><vit/>'},
    {...male,format:'not-real'},
    {...male,unknownSourcePath:'/etc/passwd'},
  ]
  for(const input of cases) {
    const r=evaluate(input)
    assert.equal(r.ok,false,JSON.stringify(r))
    assert.equal(r.manufacturingApproved,false)
  }
})
