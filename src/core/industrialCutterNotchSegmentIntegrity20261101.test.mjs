import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {inspectIndustrialMarkerCutWorkflow20261028} from './industrialMarkerCutWorkflow20261028.mjs'
import {qualifyIndustrialCutterStudy20261028 as qualify} from './industrialCutterQualification20261028.mjs'

// Disposable six-size garment uses EXO's actual nesting and CUT transfer.
// Machine calibration and receiver metadata below are synthetic only.
const garment=createTeeTemplate()
for(const piece of garment.pieces){
 piece.notches=[];piece.internalLines=[];piece.buttonholes=[]
 piece.marker={nap:'one-way',allowCrossGrain:false};piece.grainAngleDeg=0
}
const workflow=inspectIndustrialMarkerCutWorkflow20261028(garment,{maxCandidates:50000})
assert.equal(workflow.ok,true,JSON.stringify(workflow.issues).slice(0,500))
assert.equal(workflow.rows.length,6)
const row=workflow.rows[0]
const profile={profileId:'notch-fixture',manufacturer:'Synthetic',model:'NoCutter',bedWidthMm:2000,bedLengthMm:100000,supportsNotches:true,supportsDrills:true}
const evidence={calibration:{referenceLengthMm:100,measuredLengthMm:100,operatorId:'fixture',measuredAt:'2026-11-01'},receiverAcceptance:{accepted:true,application:'SyntheticCAD',version:'v1',operatorId:'fixture',evidenceFiles:['synthetic-only.txt']}}
const target=row.markTransfer.placements[0]
const path=row.cutterStudy.records.find(r=>r.pieceId===target.pieceId&&r.instance===target.instance).physicalCutPathMm
const area=path.slice(0,-1).reduce((s,p,i)=>s+p.xMm*path[i+1].yMm-path[i+1].xMm*p.yMm,0)
const dx=path[1].xMm-path[0].xMm,dy=path[1].yMm-path[0].yMm
const length=Math.hypot(dx,dy),winding=Math.sign(area)
assert(length>1&&winding!==0)
const first={xMm:(path[0].xMm+path[1].xMm)/2,yMm:(path[0].yMm+path[1].yMm)/2}
const origin={x:first.xMm/10,y:first.yMm/10}
const notch=(dxCm,dyCm)=>({startCm:{...origin},endCm:{x:origin.x+dxCm,y:origin.y+dyCm}})
const inspect=marks=>{
 const placements=row.markTransfer.placements.map((placement,i)=>i===0?{...placement,notches:marks}:placement)
 return qualify(row.cutterStudy,{...row.markTransfer,placements,notchCount:placements.reduce((n,p)=>n+p.notches.length,0)},profile,evidence)
}
const blocked=result=>{
 assert.equal(result.ok,false,JSON.stringify(result))
 assert(result.issues.some(issue=>issue.code==='NOTCH_SEGMENT_DEGENERATE'),JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.machineReady,false)
 assert.equal(result.manufacturingApproved,false)
}

test('generated six-size CUT worksheet is inspectable but never cutting-authorized',()=>{
 const result=inspect([])
 assert.equal(result.ok,true,JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
})
test('zero-length physical notch refuses machine-neutral inspection',()=>{
 blocked(inspect([notch(0,0)]))
})
test('sub-resolution physical notch refuses rather than silently disappearing at CUT precision',()=>{
 blocked(inspect([notch(0.000001,0)])) // 0.00001 mm, below 0.0001 mm CUT precision
})
test('finite nonzero physical notch above CUT resolution remains inspectable, not authorized',()=>{
 const result=inspect([notch(-winding*dy/length/10,winding*dx/length/10)])
 assert.equal(result.ok,true,JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.machineReady,false)
})
