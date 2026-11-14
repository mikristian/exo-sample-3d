import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {inspectIndustrialMarkerCutWorkflow20261028} from './industrialMarkerCutWorkflow20261028.mjs'
import {qualifyIndustrialCutterStudy20261028 as qualify} from './industrialCutterQualification20261028.mjs'

// Six-size EXO tee marker and CUT workflow; adversarial U-shaped contour and
// physical notch are disposable geometry only, never real cutter evidence.
const garment=createTeeTemplate()
for(const piece of garment.pieces){
 piece.notches=[];piece.internalLines=[];piece.buttonholes=[]
 piece.marker={nap:'one-way',allowCrossGrain:false};piece.grainAngleDeg=0
}
const workflow=inspectIndustrialMarkerCutWorkflow20261028(garment,{maxCandidates:50000})
assert.equal(workflow.ok,true,JSON.stringify(workflow.issues).slice(0,400))
assert.equal(workflow.rows.length,6)
const row=workflow.rows[0]
const target=row.markTransfer.placements[0]
const targetRecord=row.cutterStudy.records.find(r=>r.pieceId===target.pieceId&&r.instance===target.instance)
assert(targetRecord)
const contour=[
 [100,100],[180,100],[180,180],[150,180],[150,130],
 [130,130],[130,180],[100,180],[100,100],
].map(([xMm,yMm])=>({xMm,yMm}))
const study={...row.cutterStudy,records:row.cutterStudy.records.map(r=>r===targetRecord?
 {...r,physicalCutPathMm:contour}:r)}
const profile={profileId:'notch-transit',manufacturer:'Synthetic',model:'NoCutter',
 bedWidthMm:2000,bedLengthMm:100000,supportsNotches:true,supportsDrills:true}
const evidence={calibration:{referenceLengthMm:100,measuredLengthMm:100,
 operatorId:'fixture',measuredAt:'2026-11-01'},receiverAcceptance:{accepted:true,
 application:'SyntheticCAD',version:'v1',operatorId:'fixture',
 evidenceFiles:['synthetic-receipt-not-licensed.txt']}}
const notch=(start,end)=>({startCm:{x:start[0]/10,y:start[1]/10},
 endCm:{x:end[0]/10,y:end[1]/10}})
function inspect(mark){
 const placements=row.markTransfer.placements.map(p=>p===target?{...p,notches:[mark],drills:[]}:p)
 return qualify(study,{...row.markTransfer,placements,
  notchCount:placements.reduce((n,p)=>n+p.notches.length,0),
  drillCount:placements.reduce((n,p)=>n+p.drills.length,0)},profile,evidence)
}
test('disposable six-size tee CUT fixture retains engineering-only inspection',()=>{
 const result=inspect(notch([100,160],[110,160]))
 assert.equal(result.ok,true,JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.machineReady,false)
})
test('notch with both endpoints inside its U-shaped piece cannot cross open concavity',()=>{
 const result=inspect(notch([100,160],[170,160]))
 assert.equal(result.ok,false,JSON.stringify(result.issues))
 assert(result.issues.some(issue=>issue.code==='NOTCH_TRANSITS_OUTSIDE_CUT_CONTOUR'),JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
})
test('notch rooted on concave inner wall cannot cross exterior void then reenter',()=>{
 const result=inspect(notch([130,145],[170,145]))
 assert.equal(result.ok,false,JSON.stringify(result.issues))
 assert(result.issues.some(issue=>issue.code==='NOTCH_TRANSITS_OUTSIDE_CUT_CONTOUR'),JSON.stringify(result.issues))
 assert.equal(result.manufacturingApproved,false)
})
test('notch traveling only through U-shaped piece remains inspection, never authorization',()=>{
 const result=inspect(notch([100,115],[170,115]))
 assert.equal(result.ok,true,JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
})
