import test from 'node:test'
import assert from 'node:assert/strict'
import {createTeeTemplate} from '../data/templates.js'
import {inspectIndustrialMarkerCutWorkflow20261028} from './industrialMarkerCutWorkflow20261028.mjs'
import {qualifyIndustrialCutterStudy20261028 as qualify} from './industrialCutterQualification20261028.mjs'

// Real six-size garment-derived marker/CUT data. Machine and receiver records
// are disposable fixture metadata, never actual CAD/cutter approval.
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
// Coordinate-type cases intentionally replace marks; recompute the generated
// summary so a separate transfer-inventory mismatch does not mask this test.
const inspect=mark=>{
 const placements=row.markTransfer.placements.map((p,i)=>i===0?{...p,...mark}:p)
 return qualify(row.cutterStudy,{...row.markTransfer,placements,
  notchCount:placements.reduce((n,p)=>n+p.notches.length,0),
  drillCount:placements.reduce((n,p)=>n+p.drills.length,0)},profile,evidence)
}
const notch=value=>({notches:[{startCm:{x:value,y:2},endCm:{x:3,y:4}}],drills:[]})
const drill=value=>({notches:[],drills:[{xCm:value,yCm:2}]})
const target=row.markTransfer.placements[0]
const path=row.cutterStudy.records.find(r=>r.pieceId===target.pieceId&&r.instance===target.instance).physicalCutPathMm
const area=path.slice(0,-1).reduce((s,p,i)=>s+p.xMm*path[i+1].yMm-path[i+1].xMm*p.yMm,0)
const dx=path[1].xMm-path[0].xMm,dy=path[1].yMm-path[0].yMm
const length=Math.hypot(dx,dy),winding=Math.sign(area)
assert(length>1&&winding!==0)
const first={xMm:(path[0].xMm+path[1].xMm)/2,yMm:(path[0].yMm+path[1].yMm)/2}
const inward={x:(first.xMm-winding*dy/length)/10,
 y:(first.yMm+winding*dx/length)/10}
const reject=(result,code)=>{
 assert.equal(result.ok,false,JSON.stringify(result))
 assert(result.issues.some(issue=>issue.code===code),JSON.stringify(result.issues))
 assert.equal(result.machineReady,false)
 assert.equal(result.cuttingAuthorized,false)
 assert.equal(result.manufacturingApproved,false)
}

test('genuine six-size CUT-derived fixture supports finite numeric mark coordinates only for engineering inspection',()=>{
 for(const mark of [
  {notches:[{startCm:{x:first.xMm/10,y:first.yMm/10},endCm:inward}],drills:[]},
  {notches:[],drills:[{xCm:inward.x,yCm:inward.y}]},
 ]){
  const result=inspect(mark)
  assert.equal(result.ok,true,JSON.stringify(result.issues))
  assert.equal(result.cuttingAuthorized,false)
 }
})
test('coercible nonnumeric notch coordinates fail closed rather than becoming valid bed positions',()=>{
 for(const value of [null,'2',true,false,new Number(2)])reject(inspect(notch(value)),'INVALID_NOTCH_GEOMETRY')
})
test('coercible nonnumeric drill coordinates fail closed rather than becoming valid bed positions',()=>{
 for(const value of [null,'2',true,false,new Number(2)])reject(inspect(drill(value)),'INVALID_DRILL_GEOMETRY')
})
test('BigInt mark coordinates refuse without throwing a runtime exception',()=>{
 reject(inspect(notch(2n)),'INVALID_NOTCH_GEOMETRY')
 reject(inspect(drill(2n)),'INVALID_DRILL_GEOMETRY')
})
