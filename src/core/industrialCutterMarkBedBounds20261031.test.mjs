import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {inspectIndustrialMarkerCutWorkflow20261028} from './industrialMarkerCutWorkflow20261028.mjs'
import {qualifyIndustrialCutterStudy20261028 as qualify} from './industrialCutterQualification20261028.mjs'

// Six actual graded/nested sizes; machine and receiver metadata are disposable
// synthetic fixtures, not physical calibration or licensed CAD acceptance.
const garment=createTeeTemplate()
for(const piece of garment.pieces){
 piece.notches=[];piece.internalLines=[];piece.buttonholes=[]
 piece.marker={nap:'one-way',allowCrossGrain:false};piece.grainAngleDeg=0
}
const workflow=inspectIndustrialMarkerCutWorkflow20261028(garment,{maxCandidates:50000})
assert.equal(workflow.ok,true,JSON.stringify(workflow.issues).slice(0,500))
assert.equal(workflow.rows.length,6)
const row=workflow.rows[0]
const profile={profileId:'disposable-bed',manufacturer:'Fixture',model:'NoPhysicalMachine',bedWidthMm:2000,bedLengthMm:100000,supportsNotches:true,supportsDrills:true}
const evidence={calibration:{referenceLengthMm:100,measuredLengthMm:100,operatorId:'fixture',measuredAt:'2026-10-31'},receiverAcceptance:{accepted:true,application:'SyntheticFixture',version:'v1',operatorId:'fixture',evidenceFiles:['not-real-cad-evidence.txt']}}
// When intentionally replacing a mark for bed-boundary tests, keep the
// generated transfer summary consistent so only the boundary is under test.
const inspect=mark=>{
 const placements=row.markTransfer.placements.map((p,i)=>i===0?{...p,...mark}:p)
 return qualify(row.cutterStudy,{...row.markTransfer,placements,
  notchCount:placements.reduce((n,p)=>n+p.notches.length,0),
  drillCount:placements.reduce((n,p)=>n+p.drills.length,0)},profile,evidence)
}
const notch=(sx,sy,ex,ey)=>({notches:[{startCm:{x:sx,y:sy},endCm:{x:ex,y:ey}}],drills:[]})
const drill=(x,y)=>({notches:[],drills:[{xCm:x,yCm:y}]})
const refuse=(result,code)=>{
 assert.equal(result.ok,false,JSON.stringify(result))
 assert(result.issues.some(issue=>issue.code===code),JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.machineReady,false)
 assert.equal(result.manufacturingApproved,false)
}

test('real six-size CUT fixture remains only an informational engineering inspection',()=>{
 const result=inspect({notches:[],drills:[]})
 assert.equal(result.ok,true,JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.machineReady,false)
 assert.equal(result.manufacturingApproved,false)
})
test('finite notch start and end coordinates outside either bed axis fail closed',()=>{
 for(const mark of [notch(200.1,2,2,2),notch(2,2,200.1,2),notch(2,10000.1,2,2),notch(2,2,2,10000.1),notch(-.01,2,2,2),notch(2,2,2,-.01)]){
  refuse(inspect(mark),'NOTCH_BED_BOUNDS_EXCEEDED')
 }
})
test('finite drill coordinates outside bed, including negative and length overflow, fail closed',()=>{
 for(const mark of [drill(200.1,2),drill(2,10000.1),drill(-.01,2),drill(2,-.01)]){
  refuse(inspect(mark),'DRILL_BED_BOUNDS_EXCEEDED')
 }
})
test('marks on the bed edge but detached from their own CUT contour are refused',()=>{
 refuse(inspect(notch(0,0,200,10000)),'NOTCH_CONTOUR_ANCHOR_MISMATCH')
 refuse(inspect(drill(200,10000)),'DRILL_OUTSIDE_CUT_CONTOUR')
})
