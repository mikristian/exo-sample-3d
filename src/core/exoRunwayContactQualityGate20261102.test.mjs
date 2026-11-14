import test from 'node:test';import assert from 'node:assert/strict'
import {inspectExoRunwayContactQuality20261102} from './exoRunwayContactQualityGate20261102.js'
const good={reimported_bones:163,frames:193,measured_root_speed_m_s:1.0,legs:{}}
for(const s of ['L','R'])good.legs[s]={stance_samples:122,max_stance_mm_per_frame:3.2,
 mean_stance_mm_per_frame:1.4,ground_tip_z_min_m:-.002,ground_tip_z_max_m:.004,
 swing_tip_z_max_m:.08,knee_max_deg:22}
test('both legs must pass independently, after exported GLB reimport',()=>{
 assert.equal(inspectExoRunwayContactQuality20261102(good).passed,true)
 assert.equal(inspectExoRunwayContactQuality20261102({...good,legs:{...good.legs,L:{...good.legs.L,max_stance_mm_per_frame:25}}}).passed,false)
 assert.equal(inspectExoRunwayContactQuality20261102({...good,legs:{...good.legs,R:{...good.legs.R,ground_tip_z_min_m:-.03}}}).passed,false)
 assert.equal(inspectExoRunwayContactQuality20261102({...good,legs:{...good.legs,R:{...good.legs.R,ground_tip_z_max_m:.05}}}).passed,false)
})
test('missing metrics and under-rigged models are blocked',()=>{
 assert.equal(inspectExoRunwayContactQuality20261102(null).passed,false)
 assert.equal(inspectExoRunwayContactQuality20261102({...good,reimported_bones:52}).passed,false)
 assert.equal(inspectExoRunwayContactQuality20261102({...good,legs:{...good.legs,L:{...good.legs.L,stance_samples:0}}}).passed,false)
 assert.equal(inspectExoRunwayContactQuality20261102({...good,measured_root_speed_m_s:.24}).passed,false)
})
