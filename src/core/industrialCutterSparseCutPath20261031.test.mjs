import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {inspectIndustrialMarkerCutWorkflow20261028} from './industrialMarkerCutWorkflow20261028.mjs'
import {qualifyIndustrialCutterStudy20261028 as qualify} from './industrialCutterQualification20261028.mjs'

// Source contours are generated from a disposable six-size garment; the
// machine and receiving metadata below are synthetic, not physical sign-off.
const garment=createTeeTemplate()
for(const piece of garment.pieces){
 piece.notches=[];piece.internalLines=[];piece.buttonholes=[]
 piece.marker={nap:'one-way',allowCrossGrain:false};piece.grainAngleDeg=0
}
const workflow=inspectIndustrialMarkerCutWorkflow20261028(garment,{maxCandidates:50000})
assert.equal(workflow.ok,true,JSON.stringify(workflow.issues).slice(0,500))
assert.equal(workflow.rows.length,6)
const row=workflow.rows[0]
const profile={profileId:'fixture',manufacturer:'Synthetic',model:'NoMachine',bedWidthMm:2000,bedLengthMm:100000,supportsNotches:true,supportsDrills:true}
const evidence={calibration:{referenceLengthMm:100,measuredLengthMm:100,operatorId:'fixture',measuredAt:'2026-10-31'},receiverAcceptance:{accepted:true,application:'SyntheticFixture',version:'v1',operatorId:'fixture',evidenceFiles:['synthetic-not-cad.txt']}}
const inspect=path=>qualify({...row.cutterStudy,records:row.cutterStudy.records.map((record,i)=>i===0?{...record,physicalCutPathMm:path}:record)},row.markTransfer,profile,evidence)
const original=row.cutterStudy.records[0].physicalCutPathMm
assert(original.length>=4)

test('real six-size marker CUT contour is inspectable but never cutting-authorized',()=>{
 const result=inspect(original)
 assert.equal(result.ok,true,JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.machineReady,false)
 assert.equal(result.manufacturingApproved,false)
})

test('a sparse CUT contour cannot skip point validation and pass inspection',()=>{
 const sparse=original.slice()
 delete sparse[1]
 const result=inspect(sparse)
 assert.equal(result.ok,false,JSON.stringify(result))
 assert(result.issues.some(issue=>issue.code==='INVALID_CUT_POINTS'),JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
})

test('a CUT contour with holes at every vertex fails closed',()=>{
 const sparse=new Array(4)
 const result=inspect(sparse)
 assert.equal(result.ok,false,JSON.stringify(result))
 assert(result.issues.some(issue=>issue.code==='INVALID_CUT_POINTS'),JSON.stringify(result.issues))
 assert.equal(result.manufacturingApproved,false)
})
