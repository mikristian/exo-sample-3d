import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {inspectIndustrialMarkerCutWorkflow20261028} from './industrialMarkerCutWorkflow20261028.mjs'
import {qualifyIndustrialCutterStudy20261028 as qualify} from './industrialCutterQualification20261028.mjs'

// EXO-generated six-size, polygon-nested tee and CUT worksheet. Marks injected
// below are adversarial synthetic inputs, not a physical cutter or CAD receipt.
const garment=createTeeTemplate()
for(const piece of garment.pieces){
 piece.notches=[];piece.internalLines=[];piece.buttonholes=[]
 piece.marker={nap:'one-way',allowCrossGrain:false};piece.grainAngleDeg=0
}
const workflow=inspectIndustrialMarkerCutWorkflow20261028(garment,{maxCandidates:50000})
assert.equal(workflow.ok,true,JSON.stringify(workflow.issues).slice(0,400))
assert.equal(workflow.rows.length,6)
const row=workflow.rows[0]
const profile={profileId:'contour-fixture',manufacturer:'Synthetic',model:'NoCutter',
 bedWidthMm:2000,bedLengthMm:100000,supportsNotches:true,supportsDrills:true}
const evidence={calibration:{referenceLengthMm:100,measuredLengthMm:100,
 operatorId:'fixture',measuredAt:'2026-11-01'},receiverAcceptance:{accepted:true,
 application:'SyntheticCAD',version:'v1',operatorId:'fixture',
 evidenceFiles:['fixture-only-not-a-receiver.txt']}}
const target=row.markTransfer.placements[0]
const path=row.cutterStudy.records.find(r=>r.pieceId===target.pieceId&&r.instance===target.instance).physicalCutPathMm
// The tee outline is concave; its vertex centroid need not be inside. Take
// the first edge midpoint and step 1 mm along the winding's inward normal.
const signedArea=path.slice(0,-1).reduce((s,p,i)=>s+p.xMm*path[i+1].yMm-path[i+1].xMm*p.yMm,0)
const dx=path[1].xMm-path[0].xMm,dy=path[1].yMm-path[0].yMm
const length=Math.hypot(dx,dy),winding=Math.sign(signedArea)
assert(length>1&&winding!==0)
const start={xMm:(path[0].xMm+path[1].xMm)/2,yMm:(path[0].yMm+path[1].yMm)/2}
const interior={xMm:start.xMm-winding*dy/length,
 yMm:start.yMm+winding*dx/length}
const cm=p=>({x:p.xMm/10,y:p.yMm/10})
const notch=(a,b)=>({startCm:cm(a),endCm:cm(b)})
const drill=p=>({xCm:p.xMm/10,yCm:p.yMm/10})
const inspect=(notches=[],drills=[])=>{
 const placements=row.markTransfer.placements.map((p,i)=>i===0?{...p,notches,drills}:p)
 return qualify(row.cutterStudy,{...row.markTransfer,placements,
  notchCount:placements.reduce((n,p)=>n+p.notches.length,0),
  drillCount:placements.reduce((n,p)=>n+p.drills.length,0)},profile,evidence)
}
const blocked=(result,code)=>{
 assert.equal(result.ok,false,JSON.stringify(result.issues))
 assert(result.issues.some(issue=>issue.code===code),JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.machineReady,false)
 assert.equal(result.manufacturingApproved,false)
}

test('real nested CUT contour is inspectable, never authorized',()=>{
 const result=inspect()
 assert.equal(result.ok,true,JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
})
test('notch rooted on own CUT contour and ending inward is locally inspectable',()=>{
 const result=inspect([notch(start,interior)])
 assert.equal(result.ok,true,JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
})
test('in-bed notch detached from its CUT contour is refused',()=>{
 blocked(inspect([notch({xMm:1500,yMm:1500},{xMm:1510,yMm:1510})]),
  'NOTCH_CONTOUR_ANCHOR_MISMATCH')
})
test('notch anchored on its CUT boundary but directed outside the piece is refused',()=>{
 blocked(inspect([notch(start,{xMm:1500,yMm:1500})]),'NOTCH_OUTSIDE_CUT_CONTOUR')
})
test('in-bed drill outside its own CUT contour is refused',()=>{
 blocked(inspect([],[drill({xMm:1500,yMm:1500})]),'DRILL_OUTSIDE_CUT_CONTOUR')
})
test('synthetic in-contour drill remains only an engineering inspection',()=>{
 const result=inspect([],[drill(interior)])
 assert.equal(result.ok,true,JSON.stringify(result.issues))
 assert.equal(result.cuttingAuthorized,false)
})
