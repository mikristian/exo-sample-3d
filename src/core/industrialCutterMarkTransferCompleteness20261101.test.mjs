import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {inspectIndustrialMarkerCutWorkflow20261028} from './industrialMarkerCutWorkflow20261028.mjs'
import {qualifyIndustrialCutterStudy20261028 as qualify} from './industrialCutterQualification20261028.mjs'

// Disposable six-size graded tee, nested and exported by EXO. Machine and
// receiver evidence are synthetic, never an independent physical approval.
const garment=createTeeTemplate()
for(const piece of garment.pieces){
 piece.notches=[];piece.internalLines=[];piece.buttonholes=[]
 piece.marker={nap:'one-way',allowCrossGrain:false};piece.grainAngleDeg=0
}
const workflow=inspectIndustrialMarkerCutWorkflow20261028(garment,{maxCandidates:50000})
assert.equal(workflow.ok,true,JSON.stringify(workflow.issues).slice(0,500))
assert.equal(workflow.rows.length,6)
const row=workflow.rows[0]
const profile={profileId:'disposable-transfer',manufacturer:'Fixture',model:'NoPhysicalMachine',bedWidthMm:2000,bedLengthMm:100000,supportsNotches:true,supportsDrills:true}
const evidence={calibration:{referenceLengthMm:100,measuredLengthMm:100,operatorId:'fixture',measuredAt:'2026-11-01'},receiverAcceptance:{accepted:true,application:'SyntheticFixture',version:'v1',operatorId:'fixture',evidenceFiles:['not-independent-cad.txt']}}
const inspect=transfer=>qualify(row.cutterStudy,transfer,profile,evidence)
const fail=(transfer,code)=>{
 const result=inspect(transfer)
 assert.equal(result.ok,false,JSON.stringify(result))
 assert(result.issues.some(issue=>issue.code===code),JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.machineReady,false)
 assert.equal(result.manufacturingApproved,false)
}

test('generated six-size marker transfer is locally inspectable, never cutting-authorized',()=>{
 const result=inspect(row.markTransfer)
 assert.equal(result.ok,true,JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
})
test('declared transfer notch count must match actual per-instance inventory',()=>{
 fail({...row.markTransfer,notchCount:1},'MARK_TRANSFER_NOTCH_COUNT_MISMATCH')
 fail({...row.markTransfer,notchCount:-1},'MARK_TRANSFER_NOTCH_COUNT_MISMATCH')
 fail({...row.markTransfer,notchCount:0.5},'MARK_TRANSFER_NOTCH_COUNT_MISMATCH')
})
test('declared transfer drill count must match actual per-instance inventory',()=>{
 fail({...row.markTransfer,drillCount:1},'MARK_TRANSFER_DRILL_COUNT_MISMATCH')
 fail({...row.markTransfer,drillCount:NaN},'MARK_TRANSFER_DRILL_COUNT_MISMATCH')
})
test('a dropped or extra nested notch cannot pass with an unchanged signed-style count',()=>{
 const placements=row.markTransfer.placements.map((p,i)=>i===0?{
  ...p,notches:[{startCm:{x:2,y:2},endCm:{x:3,y:3}}],physicalNotchesPreserved:true}:p)
 fail({...row.markTransfer,placements},'MARK_TRANSFER_NOTCH_COUNT_MISMATCH')
})
test('explicitly unpreserved physical notch transfer refuses engineering inspection',()=>{
 const placements=row.markTransfer.placements.map((p,i)=>i===0?{...p,physicalNotchesPreserved:false}:p)
 fail({...row.markTransfer,placements},'PHYSICAL_NOTCH_TRANSFER_INCOMPLETE')
})
