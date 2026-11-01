import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {strFromU8} from 'fflate'
import {inspectGradedNotchSeamIntervals} from './gradedNotchIntervalAudit.js'
import {inspectManufacturingReleaseReadiness} from './manufacturingReleaseReadiness.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {createTemplateProject} from '../data/templates.js'

// Disposable XS/M sewing pieces. Never factory production or sample evidence.
function disposable({badInterval=false,outside=false,invalidGroup=false,reverseB=false}={}) {
  const piece=(id,t)=>({id,points:[{x:0,y:0},{x:10,y:0},{x:10,y:8},{x:0,y:8}],
    notches:[{id:`${id}-notch`,edgeIndex:0,t,matchGroupId:'join',matchedSeamId:'seam-join'}]})
  const a=piece('shell',outside?.1:.5),b=piece('lining',reverseB?.5:(outside?.1:.5))
  if(invalidGroup)b.notches=[]
  return {pieces:[a,b],seams:[{id:'seam-join',a:{pieceId:'shell',edgeIndex:0,startT:badInterval?.9:.25,endT:badInterval?.1:.75},
    b:{pieceId:'lining',edgeIndex:0,startT:.25,endT:.75},reverseB}],
    grading:{baseSize:'XS',sizes:['XS','M'],widthPerSizeCm:0,lengthPerSizeCm:0}}
}

test('blocked physical stations retain an explicit XS/M group coverage row even when no station walk exists',()=>{
  const project=disposable({outside:true}),before=structuredClone(project)
  const qa=inspectGradedNotchSeamIntervals(project)
  assert.equal(qa.status,'blocked')
  assert.equal(qa.checks.length,0)
  assert.deepEqual(qa.coverage.map(row=>[row.size,row.group,row.status,row.reasonCode]),[
    ['XS','join','BLOCKED','NOTCH_OUTSIDE_SEWN_INTERVAL'],
    ['M','join','BLOCKED','NOTCH_OUTSIDE_SEWN_INTERVAL'],
  ])
  assert.deepEqual(project,before)
})

test('malformed partial seam and incomplete pair produce per-size blocked coverage, not silently absent rows',()=>{
  for(const [settings,code] of [[{badInterval:true},'INVALID_NOTCH_SEWN_INTERVAL'],[{invalidGroup:true},'INVALID_NOTCH_GROUP']]){
    const qa=inspectGradedNotchSeamIntervals(disposable(settings))
    assert.equal(qa.status,'blocked')
    assert.equal(qa.coverage.length,2)
    assert.deepEqual(qa.coverage.map(row=>row.size),['XS','M'])
    assert(qa.coverage.every(row=>row.status==='BLOCKED'&&row.reasonCode===code))
  }
})

test('grading failure explicitly accounts for both configured sizes instead of claiming a completed station walk',()=>{
  const project=disposable()
  project.grading.baseSize='UNSUPPORTED'
  const qa=inspectGradedNotchSeamIntervals(project)
  assert.equal(qa.status,'blocked')
  assert.equal(qa.checks.length,0)
  assert.deepEqual(qa.coverage.map(row=>[row.size,row.status,row.reasonCode]),[
    ['XS','BLOCKED','NOTCH_GRADING_FAILED'],
    ['M','BLOCKED','NOTCH_GRADING_FAILED'],
  ])
})

test('dangling seam references retain their original reason in every graded coverage row',()=>{
  const project=disposable()
  project.seams[0].id='different-seam'
  const qa=inspectGradedNotchSeamIntervals(project)
  assert.equal(qa.blockers,1)
  assert.equal(qa.issues[0].code,'NOTCH_SEAM_REFERENCE')
  assert.equal(qa.coverage.length,2)
  assert(qa.coverage.every(row=>row.status==='BLOCKED'&&row.reasonCode==='NOTCH_SEAM_REFERENCE'))
  assert(!qa.issues.some(issue=>issue.code==='MISSING_NOTCH_INTERVAL_COVERAGE'))
})

test('malformed paired-intent notch remains visible as UNASSIGNED in XS/M rather than disappearing from receiving coverage',()=>{
  const project=disposable()
  project.pieces[1].notches[0].matchGroupId=''
  const qa=inspectGradedNotchSeamIntervals(project)
  assert.equal(qa.status,'blocked')
  assert.equal(qa.pairedGroups,1)
  assert.equal(qa.unassignedNotches,1)
  assert.equal(qa.coverage.length,4)
  const unassigned=qa.coverage.filter(row=>row.kind==='UNASSIGNED')
  assert.deepEqual(unassigned.map(row=>row.size),['XS','M'])
  assert(unassigned.every(row=>row.status==='BLOCKED'&&row.reasonCode==='INVALID_NOTCH_PAIR_METADATA'&&row.pieceId==='lining'))
  const readiness=inspectManufacturingReleaseReadiness(project)
  assert(!readiness.blockers.some(row=>row.code==='GRADED_SEWN_INTERVAL_NOTCH_QA_INVALID'))
  assert.equal(readiness.engineeringGeometryPass,false)
  assert.equal(readiness.factoryCuttingAuthorized,false)
})

test('explicit empty or numeric paired metadata cannot disguise a required pair as standalone',()=>{
  for(const invalid of ['',0]){
    const project=disposable()
    for(const piece of project.pieces){
      piece.notches[0].matchGroupId=invalid
      piece.notches[0].matchedSeamId=invalid
    }
    const qa=inspectGradedNotchSeamIntervals(project)
    assert.equal(qa.status,'blocked')
    assert.equal(qa.unassignedNotches,2)
    assert.equal(qa.coverage.length,4)
    assert(qa.coverage.every(row=>row.kind==='UNASSIGNED'&&row.reasonCode==='INVALID_NOTCH_PAIR_METADATA'))
    const readiness=inspectManufacturingReleaseReadiness(project)
    assert.equal(readiness.engineeringGeometryPass,false)
    assert.equal(readiness.factoryCuttingAuthorized,false)
  }
})

test('valid partial seam preserves one passing physical station and coverage row per configured size',()=>{
  const qa=inspectGradedNotchSeamIntervals(disposable())
  assert.equal(qa.status,'pass')
  assert.equal(qa.coverage.length,2)
  assert(qa.coverage.every(row=>row.status==='PASS'&&row.reasonCode===null))
  assert.equal(qa.checks.length,2)
  assert.equal(qa.factoryCertified,false)
})

test('no paired notch remains not configured, with no invented manufacturing approval or station coverage',()=>{
  const project=disposable()
  project.pieces.forEach(piece=>piece.notches=[])
  const qa=inspectGradedNotchSeamIntervals(project)
  assert.equal(qa.status,'not_configured')
  assert.deepEqual(qa.coverage,[])
  const readiness=inspectManufacturingReleaseReadiness(project)
  assert.equal(readiness.factoryCuttingAuthorized,false)
})

test('six-size blocked Foundation Tee package includes manifest-hashed all-size coverage even when walk has missing stations',()=>{
  const project=createTemplateProject('tee')
  const seam=project.seams.find(row=>row.id==='seam-sleeve-l-front-lower')
  assert(seam)
  // Valid authored interval, but its paired notch is physically outside it.
  // A malformed start>end interval would correctly be rejected before packaging.
  seam.a.startT=.9
  seam.a.endT=.95
  // A separate valid physical notch has explicitly malformed pairing intent;
  // receiving CSV must retain its unassigned identity alongside blocked pairs.
  const piece=project.pieces.find(row=>row.notches?.some(notch=>notch.matchedSeamId!==seam.id))
  const orphan=piece?.notches?.find(notch=>notch.matchedSeamId!==seam.id)
  assert(orphan)
  orphan.matchGroupId=''
  orphan.matchedSeamId=''
  const qa=inspectGradedNotchSeamIntervals(project)
  assert.equal(qa.status,'blocked')
  assert(qa.coverage.length>=6)
  assert.equal(qa.unassignedNotches,1)
  assert(qa.coverage.some(row=>row.kind==='UNASSIGNED'&&row.notchId===orphan.id))
  assert(qa.coverage.some(row=>row.size==='XS'&&row.status==='BLOCKED'))
  assert(qa.coverage.some(row=>row.size==='XXL'&&row.status==='BLOCKED'))
  const files=buildFactoryPackageFiles(project)
  const manifest=JSON.parse(strFromU8(files['manifest.json']))
  const handoff=JSON.parse(strFromU8(files['graded-sewn-interval-notch-qa.json']))
  const readiness=JSON.parse(strFromU8(files['manufacturing-release-readiness.json']))
  const coverageCsv=strFromU8(files['graded-sewn-interval-notch-coverage.csv'])
  assert.deepEqual(handoff.coverage,qa.coverage)
  assert(coverageCsv.includes('reason_code')&&coverageCsv.includes('NOTCH_OUTSIDE_SEWN_INTERVAL'))
  assert(coverageCsv.includes('UNASSIGNED')&&coverageCsv.includes(orphan.id))
  assert(coverageCsv.includes('XS')&&coverageCsv.includes('XXL'))
  // Factory CSV writer quotes every cell; these fixture IDs contain no commas.
  const actualRows=coverageCsv.trim().split(/\r?\n/).slice(1)
    .map(line=>line.split(',').map(cell=>cell.slice(1,-1).replace(/""/g,'"')))
  const expectedRows=handoff.coverage.map(row=>[row.size,row.kind,row.group,row.pieceId??'',row.notchId??'',row.seamId??'',row.status,row.reasonCode??''])
  assert.deepEqual(actualRows,expectedRows)
  assert(manifest.files.includes('graded-sewn-interval-notch-coverage.csv'))
  assert.match(manifest.sha256['graded-sewn-interval-notch-coverage.csv'],/^[0-9a-f]{64}$/)
  assert.equal(manifest.sha256['graded-sewn-interval-notch-coverage.csv'],
    createHash('sha256').update(files['graded-sewn-interval-notch-coverage.csv']).digest('hex'))
  assert.equal(readiness.factoryCuttingAuthorized,false)
  assert.equal(readiness.engineeringGeometryPass,false)
})
