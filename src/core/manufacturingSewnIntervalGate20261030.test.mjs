import test from 'node:test'
import assert from 'node:assert/strict'
import {strFromU8} from 'fflate'
import {inspectGradedNotchPairs} from './industrialNotchQA.js'
import {inspectGradedNotchSeamIntervals} from './gradedNotchIntervalAudit.js'
import {inspectManufacturingReleaseReadiness} from './manufacturingReleaseReadiness.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createTemplateProject} from '../data/templates.js'

// Disposable XS/M shell/lining geometry, not a production order or factory record.
function disposable({startA=.3,endA=.8,startB=.1,endB=.6,tA=.5,tB=.5,reverseB=false,curved=false}={}){
  const piece=(id,t)=>({id,points:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],
    ...(curved?{curves:{0:{cx:5,cy:-6}}}:{}),
    notches:[{id:`${id}-n`,edgeIndex:0,t,matchGroupId:'join',matchedSeamId:'join-seam'}]})
  return {pieces:[piece('shell',tA),piece('lining',tB)],
    seams:[{id:'join-seam',a:{pieceId:'shell',edgeIndex:0,startT:startA,endT:endA},
      b:{pieceId:'lining',edgeIndex:0,startT:startB,endT:endB},reverseB}],
    grading:{sizes:['XS','M'],baseSize:'XS',widthPerSizeCm:0,lengthPerSizeCm:0}}
}

const clean={blockers:0}
const injected={production:clean,industrial:clean,cutlines:clean,
  gradedTopology:{issues:[]},notches:clean,junctions:{status:'not_configured'},
  sample:{blockerCount:0,blockers:[],status:'evidence_complete_requires_human_factory_release',
    readyForHumanApproval:true,factoryCertified:false}}

test('factory readiness independently rejects two-centimeter partial sewn station drift despite whole-edge notch pass and injected checks',()=>{
  const project=disposable(),before=structuredClone(project)
  assert.equal(inspectGradedNotchPairs(project).status,'pass')
  const physical=inspectGradedNotchSeamIntervals(project)
  assert.equal(physical.blockers,2)
  assert(physical.checks.every(row=>Math.abs(row.offsetCm-2)<1e-8))
  const readiness=inspectManufacturingReleaseReadiness(project,{checks:injected})
  assert.equal(readiness.digitalCounts.sewnIntervalNotchBlockers,2)
  assert.equal(readiness.engineeringGeometryPass,false)
  assert(readiness.blockers.some(row=>row.code==='GRADED_SEWN_INTERVAL_NOTCH_QA'&&row.blockerCount===2))
  assert.deepEqual(readiness.sewnIntervalNotchAudit.issues,physical.issues)
  assert.deepEqual(readiness.sewnIntervalNotchAudit.checkedSizes,['XS','M'])
  assert.equal(readiness.factoryCuttingAuthorized,false)
  assert.deepEqual(project,before)
})

test('paired notches outside both sewn intervals block factory readiness despite equal full-edge fractions',()=>{
  const project=disposable({startA:.25,endA:.75,startB:.25,endB:.75,tA:.1,tB:.1})
  assert.equal(inspectGradedNotchPairs(project).status,'pass')
  const readiness=inspectManufacturingReleaseReadiness(project,{checks:injected})
  assert.equal(readiness.digitalCounts.sewnIntervalNotchBlockers,2)
  assert(readiness.blockers.some(row=>row.code==='GRADED_SEWN_INTERVAL_NOTCH_QA'))
  assert.equal(readiness.factoryCuttingAuthorized,false)
})

test('malformed partial sewn interval blocks readiness even if precomputed factory checks claim zero blockers',()=>{
  const project=disposable({startA:.9,endA:.1,startB:.25,endB:.75})
  const readiness=inspectManufacturingReleaseReadiness(project,{checks:injected})
  assert.equal(readiness.digitalCounts.sewnIntervalNotchBlockers,2)
  assert(readiness.sewnIntervalNotchAudit.issues.every(row=>row.code==='INVALID_NOTCH_SEWN_INTERVAL'))
  assert.equal(readiness.engineeringGeometryPass,false)
  assert.equal(readiness.factoryCuttingAuthorized,false)
})

test('invalid grading size inventory fails the live interval gate even with injected green summaries',()=>{
  const project=disposable()
  project.grading.sizes=[]
  const readiness=inspectManufacturingReleaseReadiness(project,{checks:injected})
  assert(readiness.blockers.some(row=>row.code==='GRADED_SEWN_INTERVAL_NOTCH_QA_FAILED'))
  assert.equal(readiness.engineeringGeometryPass,false)
  assert.equal(readiness.factoryCuttingAuthorized,false)
})

test('disposable zero-paired-notch inventory remains not configured, never an approval',()=>{
  const project=disposable()
  for(const piece of project.pieces)piece.notches=[]
  const readiness=inspectManufacturingReleaseReadiness(project,{checks:injected})
  assert.equal(readiness.sewnIntervalNotchAudit.status,'not_configured')
  assert.equal(readiness.digitalCounts.sewnIntervalNotchBlockers,0)
  assert(!readiness.blockers.some(row=>row.code.startsWith('GRADED_SEWN_INTERVAL_NOTCH_QA')))
  assert.equal(readiness.factoryCuttingAuthorized,false)
})

test('correct partial curved sewn stations and reversed orientation remain valid diagnostic checks',()=>{
  const project=disposable({curved:true,startA:.2,endA:.8,startB:.2,endB:.8,tA:.3,tB:.7,reverseB:true})
  const physical=inspectGradedNotchSeamIntervals(project)
  assert.equal(physical.status,'pass',JSON.stringify(physical.issues))
  const readiness=inspectManufacturingReleaseReadiness(project,{checks:injected})
  assert.equal(readiness.digitalCounts.sewnIntervalNotchBlockers,0)
  assert(!readiness.blockers.some(row=>row.code.startsWith('GRADED_SEWN_INTERVAL_NOTCH_QA')))
  assert.equal(readiness.factoryCuttingAuthorized,false)
})

test('real six-size tee factory handoff carries live sewn-interval blockers and never authorizes cutting',()=>{
  const project=createTemplateProject('tee')
  const seam=project.seams.find(row=>row.id==='seam-sleeve-l-front-lower')
  assert(seam)
  seam.a.startT=.1
  seam.b.startT=.2
  assert.equal(inspectGradedNotchPairs(project).status,'pass')
  const physical=inspectGradedNotchSeamIntervals(project)
  assert(physical.blockers>0)
  const readiness=inspectManufacturingReleaseReadiness(project)
  assert.equal(readiness.digitalCounts.sewnIntervalNotchBlockers,physical.blockers)
  assert.equal(readiness.engineeringGeometryPass,false)
  const files=buildFactoryPackageFiles(project)
  const handoff=JSON.parse(strFromU8(files['manufacturing-release-readiness.json']))
  const intervalHandoff=JSON.parse(strFromU8(files['graded-sewn-interval-notch-qa.json']))
  const issueCsv=strFromU8(files['graded-sewn-interval-notch-issues.csv'])
  const walkCsv=strFromU8(files['graded-sewn-interval-notch-walk.csv'])
  const readme=strFromU8(files['README.txt'])
  const manifest=JSON.parse(strFromU8(files['manifest.json']))
  assert.deepEqual(handoff,readiness)
  assert.deepEqual(handoff.sewnIntervalNotchAudit.checkedSizes,project.grading.sizes)
  assert(handoff.sewnIntervalNotchAudit.issues.some(row=>row.code==='NOTCH_INTERVAL_MISALIGNMENT'&&row.scope.includes('XS')))
  assert.deepEqual(intervalHandoff,handoff.sewnIntervalNotchAudit)
  assert.equal(intervalHandoff.blockers,6)
  assert(issueCsv.includes('NOTCH_INTERVAL_MISALIGNMENT')&&issueCsv.includes('XS')&&issueCsv.includes('XXL'))
  assert(walkCsv.includes('sewn_a_station_cm')&&walkCsv.includes('BLOCKED'))
  assert(readme.includes('WHOLE-EDGE')&&readme.includes('graded-sewn-interval-notch-qa.json'))
  for(const path of ['graded-sewn-interval-notch-qa.json','graded-sewn-interval-notch-walk.csv','graded-sewn-interval-notch-issues.csv']){
    assert(manifest.files.includes(path))
    assert.equal(typeof manifest.sha256[path],'string')
    assert.equal(manifest.sha256[path].length,64)
  }
  assert.equal(handoff.factoryCuttingAuthorized,false)
})

test('unchanged real six-size tee remains interval-pass but still requires independent human release',()=>{
  const project=createTemplateProject('tee')
  const readiness=inspectManufacturingReleaseReadiness(project)
  assert.equal(readiness.digitalCounts.sewnIntervalNotchBlockers,0)
  assert.equal(readiness.sewnIntervalNotchAudit.status,'pass')
  assert(!readiness.blockers.some(row=>row.code.startsWith('GRADED_SEWN_INTERVAL_NOTCH_QA')))
  assert.equal(readiness.factoryCuttingAuthorized,false)
  assert.equal(readiness.factoryCertified,false)
})
