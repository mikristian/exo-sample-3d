import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {inspectIndustrialMarkerCutWorkflow20261028 as inspect} from './industrialMarkerCutWorkflow20261028.mjs'

// Disposable six-size garment, with no external CAD or factory evidence.
const garment=()=>{
 const p=createTeeTemplate()
 for(const piece of p.pieces){
  piece.notches=[];piece.internalLines=[];piece.buttonholes=[]
  piece.marker={nap:'one-way',allowCrossGrain:false};piece.grainAngleDeg=0
 }
 return p
}
const profile={profileId:'disposable-machine',manufacturer:'FixtureOnly',model:'NoCutter',bedWidthMm:2000,bedLengthMm:100000,supportsNotches:true,supportsDrills:false}
const evidence={calibration:{referenceLengthMm:100,measuredLengthMm:100,operatorId:'fixture',measuredAt:'2026-10-31'},receiverAcceptance:{accepted:true,application:'FixtureOnly',version:'v1',operatorId:'fixture',evidenceFiles:['disposable-test-only.txt']}}

function assertBlocked(result,code){
 assert.equal(result.ok,false)
 assert.equal(result.status,'BLOCKED')
 assert(result.issues.some(issue=>issue.code===code),JSON.stringify(result.issues).slice(0,900))
 assert(!result.issues.some(issue=>issue.code==='MARKER_CUT_WORKFLOW_REFUSED'),JSON.stringify(result.issues).slice(0,900))
 assert.equal(result.rows.length,6)
 assert(result.rows.every(row=>row.ok===false&&row.cutterStudy?.ok===true))
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.manufacturingApproved,false)
 assert.equal(result.machineReady,false)
}

test('invalid machine profile preserves exact cutter rejection and fails every size row',()=>{
 const p=garment(),before=JSON.stringify(p)
 const result=inspect(p,{cutterProfile:{...profile,bedWidthMm:0},qualificationEvidence:evidence,maxCandidates:50000})
 assertBlocked(result,'INVALID_MACHINE_PROFILE')
 assert.equal(JSON.stringify(p),before)
})

test('explicit falsy machine profile cannot bypass the cutter qualification gate',()=>{
 const result=inspect(garment(),{cutterProfile:false,qualificationEvidence:evidence,maxCandidates:50000})
 assertBlocked(result,'INVALID_MACHINE_PROFILE')
 assert(result.rows.every(row=>row.cutterQualification?.code==='INVALID_MACHINE_PROFILE'))
})

test('bed too narrow blocks each size row without mislabeling CUT inspection as cutting authority',()=>{
 const result=inspect(garment(),{cutterProfile:{...profile,bedWidthMm:100},qualificationEvidence:evidence,maxCandidates:50000})
 assertBlocked(result,'BED_WIDTH_EXCEEDED')
 assert(result.rows.every(row=>row.cutterQualification?.issues?.some(issue=>issue.code==='BED_WIDTH_EXCEEDED')))
})

test('short cutter bed refuses all six size placements',()=>{
 const result=inspect(garment(),{cutterProfile:{...profile,bedLengthMm:1},qualificationEvidence:evidence,maxCandidates:50000})
 assertBlocked(result,'BED_LENGTH_EXCEEDED')
})

test('missing calibration and receiving evidence remain explicit row blockers',()=>{
 const result=inspect(garment(),{cutterProfile:profile,qualificationEvidence:{},maxCandidates:50000})
 assertBlocked(result,'CALIBRATION_NOT_VERIFIED')
 assert(result.issues.some(issue=>issue.code==='RECEIVER_ACCEPTANCE_NOT_DOCUMENTED'))
 assert(result.rows.every(row=>row.cutterQualification?.issues?.some(issue=>issue.code==='CALIBRATION_NOT_VERIFIED')))
})

test('fixture-only documented review never becomes machine readiness or cutting authorization',()=>{
 const result=inspect(garment(),{cutterProfile:profile,qualificationEvidence:evidence,maxCandidates:50000})
 assert.equal(result.ok,true,JSON.stringify(result.issues).slice(0,900))
 assert.equal(result.rows.length,6)
 assert(result.rows.every(row=>row.ok&&row.cutterQualification?.ok))
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.machineReady,false)
 assert.equal(result.manufacturingApproved,false)
})
