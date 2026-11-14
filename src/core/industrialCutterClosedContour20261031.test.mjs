import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {inspectIndustrialMarkerCutWorkflow20261028} from './industrialMarkerCutWorkflow20261028.mjs'
import {qualifyIndustrialCutterStudy20261028 as qualify} from './industrialCutterQualification20261028.mjs'

// Disposable six-size garment, not a licensed CAD or physical cutter fixture.
const garment=createTeeTemplate()
for(const piece of garment.pieces){
 piece.notches=[];piece.internalLines=[];piece.buttonholes=[]
 piece.marker={nap:'one-way',allowCrossGrain:false};piece.grainAngleDeg=0
}
const workflow=inspectIndustrialMarkerCutWorkflow20261028(garment,{maxCandidates:50000})
assert.equal(workflow.ok,true,JSON.stringify(workflow.issues).slice(0,500))
assert.equal(workflow.rows.length,6)
const row=workflow.rows[0]
const original=row.cutterStudy.records[0].physicalCutPathMm
assert(original.length>=4)
const profile={profileId:'fixture',manufacturer:'Synthetic',model:'NoMachine',bedWidthMm:2000,bedLengthMm:100000,supportsNotches:true,supportsDrills:true}
const evidence={calibration:{referenceLengthMm:100,measuredLengthMm:100,operatorId:'fixture',measuredAt:'2026-10-31'},receiverAcceptance:{accepted:true,application:'SyntheticFixture',version:'v1',operatorId:'fixture',evidenceFiles:['not-real-cad-evidence.txt']}}
const inspect=path=>qualify({...row.cutterStudy,records:row.cutterStudy.records.map((record,i)=>i===0?{...record,physicalCutPathMm:path}:record)},row.markTransfer,profile,evidence)
const refused=(path,code)=>{
 const result=inspect(path)
 assert.equal(result.ok,false,JSON.stringify(result))
 assert(result.issues.some(issue=>issue.code===code),JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.machineReady,false)
 assert.equal(result.manufacturingApproved,false)
}

test('generated six-size CUT contour passes local inspection without authorization',()=>{
 const result=inspect(original)
 assert.equal(result.ok,true,JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.machineReady,false)
})
test('open physical CUT contour is refused even when all vertices remain finite and inside bed',()=>{
 refused(original.slice(0,-1),'CUT_CONTOUR_NOT_CLOSED')
})
test('nonclosing final vertex is refused despite valid count and bounded coordinates',()=>{
 const path=original.map(p=>({...p}))
 path[path.length-1].xMm+=1
 refused(path,'CUT_CONTOUR_NOT_CLOSED')
})
test('closed but zero-area physical CUT contour is refused',()=>{
 refused([{xMm:20,yMm:20},{xMm:30,yMm:20},{xMm:40,yMm:20},{xMm:20,yMm:20}],
  'CUT_CONTOUR_DEGENERATE')
})
