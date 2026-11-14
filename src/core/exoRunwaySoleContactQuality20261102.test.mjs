import test from 'node:test';import assert from 'node:assert/strict'
import {inspectExoRunwaySoleContact20261102} from './exoRunwaySoleContactQuality20261102.js'
const skin={measurements:{L:{max_penetration_mm:4.2,max_hover_mm:8},R:{max_penetration_mm:3,max_hover_mm:7}}}
const bone={reimported_bones:163,frames:193,legs:{L:{max_stance_mm_per_frame:1.2,mean_stance_mm_per_frame:.6},R:{max_stance_mm_per_frame:.9,mean_stance_mm_per_frame:.4}}}
test('genuine sole contact does not imply runway quality when the gait is slow',()=>{
 const c=inspectExoRunwaySoleContact20261102(skin,bone,.24)
 assert.equal(c.contactPassed,true)
 assert.equal(c.speedPassed,false)
 assert.equal(c.professionalWalkApproved,false)
})
test('failed sole geometry cannot be hidden by perfect bone-tip foot locking',()=>{
 const bad={measurements:{...skin.measurements,L:{...skin.measurements.L,max_penetration_mm:17}}}
 const c=inspectExoRunwaySoleContact20261102(bad,bone,1.0,{visualApproved:true})
 assert.equal(c.contactPassed,false)
 assert.equal(c.professionalWalkApproved,false)
})
test('only independent geometry, speed and visual review together qualify',()=>{
 assert.equal(inspectExoRunwaySoleContact20261102(skin,bone,1.0).professionalWalkApproved,false)
 assert.equal(inspectExoRunwaySoleContact20261102(skin,bone,1.0,{visualApproved:true}).professionalWalkApproved,true)
 assert.equal(inspectExoRunwaySoleContact20261102({},bone,1.0,{visualApproved:true}).professionalWalkApproved,false)
})
