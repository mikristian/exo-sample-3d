/**
 * Machine-checkable *necessary*, not sufficient, acceptance criteria for
 * grounded model-walk motion. These are evaluated on an independently
 * re-imported exported GLB; source Blender IK-only measurements do not count.
 * Passing does not prove beautiful motion, motion-capture fidelity, garment
 * draping, sole contact or CLO3D equivalence.
 */
export const EXO_RUNWAY_CONTACT_LIMITS_20261102=Object.freeze({
  minBones:150,minFrames:48,maxStanceSlipMmPerFrame:5,
  maxMeanStanceSlipMmPerFrame:2,maxFloorPenetrationMm:5,maxFootHoverMm:10,
  minSwingHeightM:.035,minKneeFlexDeg:5,
  // A virtually stationary shuffle can be made numerically stable without
  // ever becoming a believable model walk. Reject implausibly slow clips.
  minTravelSpeedMps:.65,maxTravelSpeedMps:1.8,
})

export function inspectExoRunwayContactQuality20261102(audit){
  const limits=EXO_RUNWAY_CONTACT_LIMITS_20261102
  const failed=[]
  if(!Number.isInteger(audit?.reimported_bones)||audit.reimported_bones<limits.minBones)
    failed.push('incomplete 163-bone exported rig')
  if(!Number.isInteger(audit?.frames)||audit.frames<limits.minFrames)
    failed.push('short or missing independent GLB sample')
  if(!Number.isFinite(audit?.measured_root_speed_m_s)||
    audit.measured_root_speed_m_s<limits.minTravelSpeedMps||
    audit.measured_root_speed_m_s>limits.maxTravelSpeedMps)
    failed.push('missing or unrealistic measured root travel speed for model runway walking')
  for(const side of ['L','R']){
    const leg=audit?.legs?.[side]
    const all=[leg?.max_stance_mm_per_frame,leg?.mean_stance_mm_per_frame,
      leg?.ground_tip_z_min_m,leg?.ground_tip_z_max_m,
      leg?.swing_tip_z_max_m,leg?.knee_max_deg]
    if(!all.every(Number.isFinite)||!(leg?.stance_samples>=15)){
      failed.push(`${side}: missing reliable exported foot-contact samples`)
      continue
    }
    if(leg.max_stance_mm_per_frame>limits.maxStanceSlipMmPerFrame)
      failed.push(`${side}: visible stance foot sliding (${leg.max_stance_mm_per_frame} mm/frame)`)
    if(leg.mean_stance_mm_per_frame>limits.maxMeanStanceSlipMmPerFrame)
      failed.push(`${side}: excessive average stance foot drift`)
    if(leg.ground_tip_z_min_m< -limits.maxFloorPenetrationMm/1000)
      failed.push(`${side}: foot passes below floor (${(leg.ground_tip_z_min_m*1000).toFixed(1)} mm)`)
    if(leg.ground_tip_z_max_m>limits.maxFootHoverMm/1000)
      failed.push(`${side}: foot floats above nominal floor in support frames (${(leg.ground_tip_z_max_m*1000).toFixed(1)} mm)`)
    if(leg.swing_tip_z_max_m<limits.minSwingHeightM)
      failed.push(`${side}: missing toe clearance during swing`)
    if(leg.knee_max_deg<limits.minKneeFlexDeg)
      failed.push(`${side}: insufficient knee flex during stride`)
  }
  return {passed:failed.length===0,failed,
    limitations:'Necessary numeric export checks only; visual animator review and moving-cloth collision are unverified',
    limits}
}
