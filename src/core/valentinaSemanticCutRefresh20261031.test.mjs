import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createTeeTemplate} from '../data/templates.js'
import {evaluateValentinaSemanticRequest20261031 as evaluate} from '../../integrations/clothcraft/valentinaSemanticEngineRoute20261031.mjs'
import {transferValentinaSemanticNativeDraft20261031 as transfer} from './valentinaSemanticNativeTransfer20261031.js'
import {refreshValentinaSemanticCutDraft20261031 as refresh} from './valentinaSemanticCutRefresh20261031.js'

const root=new URL('../../research/oss/pattern-cad/ValentinaDevelop20261031/src/app/share/collection/MaleShirt/',import.meta.url)
const patternXml=readFileSync(new URL('MaleShirt.val',root),'utf8')
const measurementsXml=readFileSync(new URL('MaleShirt.vit',root),'utf8')
const changed=patternXml.replace('formula="height/2-10"','formula="height/2-6"')

test('real MaleShirt source recalculation refreshes polygon, preserving IDs and immutable original',async()=>{
  assert.notEqual(changed,patternXml)
  const first=evaluate({patternXml,measurementsXml,format:'aama-r10',sourceUnit:'cm'})
  assert.equal(first.ok,true,first.reason)
  const initial=(await transfer(createTeeTemplate(),{patternXml,measurementsXml,engineResult:first,editable:true})).project
  const before=JSON.stringify(initial)
  const second=evaluate({patternXml:changed,measurementsXml,format:'aama-r10',sourceUnit:'cm'})
  assert.equal(second.ok,true,second.reason)
  const result=await refresh(initial,{patternXml:changed,measurementsXml,engineResult:second})
  assert.equal(result.changed,true)
  assert.ok(result.changedCount>0)
  assert.equal(JSON.stringify(initial),before)
  assert.deepEqual(result.project.pieces.map(p=>p.id),initial.pieces.map(p=>p.id))
  assert.deepEqual(result.project.pieces.map(p=>p.sourceToken),initial.pieces.map(p=>p.sourceToken))
  assert.notDeepEqual(result.project.pieces.map(p=>p.points),initial.pieces.map(p=>p.points))
  assert.notEqual(result.currentAamaSha256,result.previousAamaSha256)
  assert.equal(result.project.patternSource.originalPatternXml,changed)
  await assert.rejects(refresh(initial,{patternXml,measurementsXml,engineResult:first}),/unchanged/)
  await assert.rejects(refresh({...initial,pieces:initial.pieces.map((p,i)=>i? p:{...p,points:p.points.map((pt,j)=>j?pt:{...pt,x:pt.x+1})})},{patternXml:changed,measurementsXml,engineResult:second}),/manual edit/)
  await assert.rejects(refresh({...initial,pieces:initial.pieces.map((p,i)=>i?p:{...p,fill:'#ff0000'})},{patternXml:changed,measurementsXml,engineResult:second}),/manual resolution|manual edit/)
  await assert.rejects(refresh({...initial,pieces:initial.pieces.map((p,i)=>i?p:{...p,patternImportProvenance:{...p.patternImportProvenance,originalAamaSha256:'0'.repeat(64)}})},{patternXml:changed,measurementsXml,engineResult:second}),/manual edit/)
  await assert.rejects(refresh({...initial,productionSpec:{note:'hand-authored'}},{patternXml:changed,measurementsXml,engineResult:second}),/manual resolution/)
  await assert.rejects(refresh(initial,{patternXml:changed,measurementsXml,engineResult:{...second,artifacts:second.artifacts.map(a=>({...a,content:a.content+' '}) )}}),/SHA-256/)
  await assert.rejects(refresh({...initial,patternSource:{...initial.patternSource,originalPatternXml:changed}},{patternXml:changed,measurementsXml,engineResult:second}),/SHA-256/)
})
