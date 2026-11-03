import test from 'node:test'
import assert from 'node:assert/strict'
import {buildExperimentalSizeRun20261102} from './exoGeneratedPatternGradeFit20261102.js'

const original=()=>({
  id:'reviewed-source',name:'Base shirt',units:'cm',
  grading:{baseSize:'M',sizes:['M'],widthPerSizeCm:0,lengthPerSizeCm:0},
  pieces:['front','back'].map(id=>({id,name:id,points:[
    {id:'a',x:0,y:0},{id:'b',x:20,y:0},{id:'c',x:20,y:30},{id:'d',x:0,y:30}],curves:{}})),
  seams:[{id:'top-seam',a:{pieceId:'front',edgeIndex:0},b:{pieceId:'back',edgeIndex:0}}],
  patternGeneration:{method:'verified_archive_garmentcode_decode_v1',sourceVerified:true},
})

test('builds independent three-size geometry and seam QA evidence without certifying grading',()=>{
  const project=original(),snapshot=structuredClone(project)
  const result=buildExperimentalSizeRun20261102(project)
  assert.equal(result.ok,true,result.reason)
  assert.deepEqual(project,snapshot)
  assert.deepEqual(result.sizes,['S','M','L'])
  assert.equal(result.independentDigitalQaPassed,true)
  assert.equal(result.gradedProductionApproved,false)
  assert.equal(result.physicalFitVerified,false)
  assert.equal(result.manufacturingCertified,false)
  assert.equal(result.bySize.M.pieces[0].points[1].x,20)
  assert.equal(result.bySize.L.pieces[0].points[1].x,20.4)
  assert.ok(result.bySize.S.pieces[0].points[1].x<20)
  assert.ok(result.sizeReports.every(item=>item.qaStatus==='pass'&&item.maxSeamMismatchCm<1e-7))
  assert.ok(result.fitReports.every(item=>item.status==='unknown'))
  assert.ok(result.approvalBlockers.some(item=>item.includes('wearer/finished-garment')))
  assert.ok(result.approvalBlockers.every(item=>item.length>2),'one useful blocker per list item')
})

test('only user-supplied garment and wearer measurements can establish calculated input ease',()=>{
  const run=buildExperimentalSizeRun20261102(original(),{bodyFitInputs:{
    S:{bodyChestCm:90,finishedChestCm:100,minEaseCm:5,maxEaseCm:15},
    M:{bodyChestCm:94,finishedChestCm:104,minEaseCm:5,maxEaseCm:15},
    L:{bodyChestCm:98,finishedChestCm:100,minEaseCm:5,maxEaseCm:15},
  }})
  assert.equal(run.ok,true,run.reason)
  assert.equal(run.fitReports[0].easeCm,10)
  assert.equal(run.fitReports[0].status,'input_ease_in_range')
  assert.equal(run.fitReports[2].status,'input_ease_out_of_range')
  assert.equal(run.physicalFitVerified,false)
  assert.equal(run.manufacturingCertified,false)
  assert.ok(run.warnings.some(item=>item.includes('L:')))
})

test('rejects invalid sizes, unreviewed industrial attachments and broken sewing without mutation',()=>{
  const project=original(),snapshot=structuredClone(project)
  assert.match(buildExperimentalSizeRun20261102(project,{sizes:['M','M']}).reason,/unique size/)
  assert.match(buildExperimentalSizeRun20261102(project,{widthStepPercent:20}).reason,/0–7%/)
  assert.match(buildExperimentalSizeRun20261102(project,{bodyFitInputs:{M:{finishedChestCm:100}}}).reason,/Invalid independent/)
  const attached=structuredClone(project)
  attached.fasteners=[{id:'z'}]
  assert.match(buildExperimentalSizeRun20261102(attached).reason,/attachments, fasteners/)
  const broken=structuredClone(project)
  broken.seams[0].b.edgeIndex=1
  assert.match(buildExperimentalSizeRun20261102(broken).reason,/Original pattern fails/)
  assert.deepEqual(project,snapshot)
})
