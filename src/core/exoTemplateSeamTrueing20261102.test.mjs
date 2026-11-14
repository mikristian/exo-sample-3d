import test from 'node:test'
import assert from 'node:assert/strict'
import {createTemplateProject} from '../data/templates.js'
import {inspectIndustrialPatterns} from './industrialPatternQA.js'
import {edgeLength} from './project.js'
import {trueHoodieTemplateSeams20261102 as trueSeams} from './exoTemplateSeamTrueing20261102.js'

for(const id of ['hoodie','zip-hoodie'])test(`${id} trues all authored seams while preserving original topology and notches`,()=>{
  const source=createTemplateProject(id)
  const snapshot=structuredClone(source)
  const before=inspectIndustrialPatterns(source,{sizes:[source.grading.baseSize]})
  assert.equal(before.status,'blocked')
  assert.equal(before.issues.some(issue=>issue.code!=='SEAM_LENGTH_MISMATCH'),false)
  const result=trueSeams(source)
  assert.equal(result.ok,true,result.reason)
  assert.deepEqual(source,snapshot,'source must remain intact')
  assert.equal(result.qa.status,'pass')
  assert.equal(result.qa.seamReports.every(row=>row.pass),true)
  assert.ok(result.report.verifiedSeamCount>=30)
  assert.deepEqual(result.project.pieces.map(p=>p.id),source.pieces.map(p=>p.id))
  assert.deepEqual(result.project.seams,source.seams)
  assert.deepEqual(result.project.pieces.map(p=>p.notches),source.pieces.map(p=>p.notches))
  assert.equal(result.project.patternGeneration.physicalFitVerified,false)
  assert.equal(result.project.patternGeneration.factoryApproved,false)
  for(const sleeveId of ['sleeve-left','sleeve-right']){
    const sleeve=result.project.pieces.find(p=>p.id===sleeveId)
    assert.ok(Object.keys(sleeve.curves).includes('0'))
    assert.ok(Math.abs(sleeve.points[2].x)<19)
    assert.ok(Math.abs(sleeve.points[5].x)<19)
  }
  for(const cuffId of ['rib-cuff-left','rib-cuff-right']){
    const cuff=result.project.pieces.find(p=>p.id===cuffId)
    assert.ok(Math.abs(edgeLength(cuff,2)-26)<0.01)
  }
  assert.ok(result.report.ribChanges.some(row=>row.pieceId==='rib-waistband'))
})

for(const templateId of ['hoodie','zip-hoodie'])test(`${templateId} oversized and cropped style preserves base seams`,()=>{
  const source=createTemplateProject(templateId)
  const frozen=structuredClone(source)
  const result=trueSeams(source,{widthScale:1.08,bodyLengthDeltaCm:-3})
  assert.equal(result.ok,true,result.reason)
  assert.equal(result.qa.seamReports.every(s=>s.pass),true)
  assert.equal(result.project.patternGeneration.fitVerified,false)
  assert.deepEqual(source,frozen)
})

test('fail closed for unsupported garment topology and out-of-range dimensions',()=>{
  assert.equal(trueSeams(createTemplateProject('tee')).ok,false)
  assert.equal(trueSeams(createTemplateProject('hoodie'),{widthScale:4}).ok,false)
  assert.equal(trueSeams(createTemplateProject('hoodie'),{bodyLengthDeltaCm:25}).ok,false)
})
