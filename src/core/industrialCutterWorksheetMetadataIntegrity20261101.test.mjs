import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {inspectIndustrialMarkerCutWorkflow20261028} from './industrialMarkerCutWorkflow20261028.mjs'
import {qualifyIndustrialCutterStudy20261028 as qualify} from './industrialCutterQualification20261028.mjs'

// Disposable six-size EXO-generated marker/CUT data; the machine and receiver
// records are synthetic. This never qualifies a real cutter or authorizes CUT.
const garment=createTeeTemplate()
for(const piece of garment.pieces){
 piece.notches=[];piece.internalLines=[];piece.buttonholes=[]
 piece.marker={nap:'one-way',allowCrossGrain:false};piece.grainAngleDeg=0
}
const workflow=inspectIndustrialMarkerCutWorkflow20261028(garment,{maxCandidates:50000})
assert.equal(workflow.ok,true,JSON.stringify(workflow.issues).slice(0,400))
assert.equal(workflow.rows.length,6)
const row=workflow.rows[0]
const profile={profileId:'metadata-fixture',manufacturer:'Synthetic',model:'NoPhysicalCutter',
 bedWidthMm:2000,bedLengthMm:100000,supportsNotches:true,supportsDrills:true}
const evidence={calibration:{referenceLengthMm:100,measuredLengthMm:100,
 operatorId:'fixture',measuredAt:'2026-11-01'},
 receiverAcceptance:{accepted:true,application:'SyntheticCAD',version:'v1',
 operatorId:'fixture',evidenceFiles:['synthetic-not-independent.txt']}}
const inspect=study=>qualify(study,row.markTransfer,profile,evidence)
const blocked=(study,code)=>{
 const result=inspect(study)
 assert.equal(result.ok,false,JSON.stringify(result))
 assert(result.issues.some(issue=>issue.code===code),JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.machineReady,false)
 assert.equal(result.manufacturingApproved,false)
}

test('real generated CUT worksheet remains inspectable without physical authorization',()=>{
 const result=inspect(row.cutterStudy)
 assert.equal(result.ok,true,JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
})
test('unit drift in CUT worksheet or a contour record refuses inspection',()=>{
 blocked({...row.cutterStudy,units:'cm'},'CUT_WORKSHEET_UNITS_INVALID')
 blocked({...row.cutterStudy,records:row.cutterStudy.records.map((r,i)=>i===0?{...r,units:'cm'}:r)},
  'CUT_RECORD_METADATA_INVALID')
})
test('closed geometry cannot be labeled as an open CUT record',()=>{
 blocked({...row.cutterStudy,records:row.cutterStudy.records.map((r,i)=>i===0?{...r,closed:false}:r)},
  'CUT_RECORD_METADATA_INVALID')
})
test('machine instructions or drivers cannot be smuggled into a machine-neutral CUT inspection',()=>{
 blocked({...row.cutterStudy,commandProtocol:{action:'start-cut'}},'CUT_WORKSHEET_PROTOCOL_PRESENT')
 blocked({...row.cutterStudy,hardwareDriver:'synthetic-driver'},'CUT_WORKSHEET_PROTOCOL_PRESENT')
})
test('caller-claimed cutting readiness and verified physical operations are not accepted as local inspection evidence',()=>{
 blocked({...row.cutterStudy,cuttingAuthorized:true},'CUT_WORKSHEET_AUTHORIZATION_CLAIM')
 blocked({...row.cutterStudy,records:row.cutterStudy.records.map((r,i)=>i===0?{...r,notchCuttingVerified:true}:r)},
  'CUT_RECORD_AUTHORIZATION_CLAIM')
 blocked({...row.cutterStudy,records:row.cutterStudy.records.map((r,i)=>i===0?{...r,drillVerified:true}:r)},
  'CUT_RECORD_AUTHORIZATION_CLAIM')
 blocked({...row.cutterStudy,records:row.cutterStudy.records.map((r,i)=>i===0?{...r,materialVerificationRequired:false}:r)},
  'CUT_RECORD_AUTHORIZATION_CLAIM')
})
