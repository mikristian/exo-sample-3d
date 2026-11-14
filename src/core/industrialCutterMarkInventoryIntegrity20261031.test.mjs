import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {inspectIndustrialMarkerCutWorkflow20261028} from './industrialMarkerCutWorkflow20261028.mjs'
import {qualifyIndustrialCutterStudy20261028 as qualify} from './industrialCutterQualification20261028.mjs'

// Actual six-size polygon nesting and CUT/mark transfer, not a hand-written
// successful inspection result. No physical or third-party acceptance claimed.
const garment=createTeeTemplate()
for(const piece of garment.pieces){
 piece.notches=[];piece.internalLines=[];piece.buttonholes=[]
 piece.marker={nap:'one-way',allowCrossGrain:false};piece.grainAngleDeg=0
}
const workflow=inspectIndustrialMarkerCutWorkflow20261028(garment,{maxCandidates:50000})
assert.equal(workflow.ok,true,JSON.stringify(workflow.issues).slice(0,500))
assert.equal(workflow.rows.length,6)
const row=workflow.rows[0]
const profile={profileId:'fixture-only',manufacturer:'Disposable',model:'NoMachine',bedWidthMm:2000,bedLengthMm:100000,supportsNotches:true,supportsDrills:false}
const evidence={calibration:{referenceLengthMm:100,measuredLengthMm:100,operatorId:'fixture',measuredAt:'2026-10-31'},receiverAcceptance:{accepted:true,application:'FixtureOnly',version:'v1',operatorId:'fixture',evidenceFiles:['synthetic-only.txt']}}
const inspect=placements=>qualify(row.cutterStudy,{...row.markTransfer,placements},profile,evidence)
const original=row.markTransfer.placements
const reject=(placements,code)=>{
 const result=inspect(placements)
 assert.equal(result.ok,false,JSON.stringify(result))
 assert(result.issues.some(issue=>issue.code===code),JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.machineReady,false)
 assert.equal(result.manufacturingApproved,false)
}

test('real six-size fixture has documented engineering review without cutting authority',()=>{
 const result=inspect(original)
 assert.equal(result.ok,true,JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.machineReady,false)
})
test('duplicate transferred instance cannot overwrite a mark inventory entry',()=>{
 reject([...original,{...original[0],notches:[],drills:[]}],'DUPLICATE_MARK_INSTANCE')
})
test('malformed notch and drill arrays are explicit refusals, not exceptions',()=>{
 reject(original.map((p,i)=>i===0?{...p,notches:null}:p),'INVALID_MARKS')
 reject(original.map((p,i)=>i===0?{...p,drills:'not-an-array'}:p),'INVALID_MARKS')
})
test('null mark placement and malformed notch element fail closed',()=>{
 reject(original.map((p,i)=>i===0?null:p),'INVALID_MARK_INSTANCE')
 reject(original.map((p,i)=>i===0?{...p,notches:[null]}:p),'INVALID_NOTCH_GEOMETRY')
})
test('sparse notch and drill inventories cannot pass geometry inspection',()=>{
 reject(original.map((p,i)=>i===0?{...p,notches:new Array(1)}:p),'INVALID_NOTCH_GEOMETRY')
 reject(original.map((p,i)=>i===0?{...p,drills:new Array(1)}:p),'INVALID_DRILL_GEOMETRY')
})
