// Independent GLB reimport checks must measure the skinned shoe/sole vertex
// positions, not simply the ankle or foot bone pivot. A bone tip may be
// 10-30mm above the actual shoe sole while the physical foot is grounded.
export const EXO_RUNWAY_SOLE_LIMITS_20261102=Object.freeze({
  maxPenetrationMm:5,maxHoverMm:10,maxStanceSlipMmPerFrame:5,
  minRunwaySpeedMps:.65,maxRunwaySpeedMps:1.8,
})

export function inspectExoRunwaySoleContact20261102(skinReport,boneReport,speedMps,{visualApproved=false}={}){
  const failures=[],limits=EXO_RUNWAY_SOLE_LIMITS_20261102
  const surface=skinReport?.measurements
  const bones=boneReport?.legs
  if(boneReport?.reimported_bones!==163||boneReport?.frames<48)
    failures.push('A complete independently reimported 163-bone GLB is required')
  const contactFailures=[]
  for(const side of ['L','R']){
    const sole=surface?.[side],leg=bones?.[side]
    if(!sole||!leg||![sole.max_penetration_mm,sole.max_hover_mm,
      leg.max_stance_mm_per_frame,leg.mean_stance_mm_per_frame].every(Number.isFinite)){
      contactFailures.push(`${side}: actual skinned sole measurements are missing`)
      continue
    }
    if(sole.max_penetration_mm>limits.maxPenetrationMm)
      contactFailures.push(`${side}: skinned sole penetrates ${sole.max_penetration_mm.toFixed(2)} mm`)
    if(sole.max_hover_mm>limits.maxHoverMm)
      contactFailures.push(`${side}: skinned sole floats ${sole.max_hover_mm.toFixed(2)} mm`)
    if(leg.max_stance_mm_per_frame>limits.maxStanceSlipMmPerFrame)
      contactFailures.push(`${side}: foot-bone-tip horizontal drift exceeds 5 mm/frame`)
  }
  failures.push(...contactFailures)
  const contactPassed=contactFailures.length===0&&boneReport?.reimported_bones===163
  const speedPassed=Number.isFinite(speedMps)&&speedMps>=limits.minRunwaySpeedMps&&
    speedMps<=limits.maxRunwaySpeedMps
  if(!speedPassed)failures.push(`Runway root travel speed is not proven within ${limits.minRunwaySpeedMps}–${limits.maxRunwaySpeedMps} m/s`)
  if(!visualApproved)failures.push('Animator has not approved natural runway posture, heel roll, hip rotation and arm swing')
  return {contactPassed,speedPassed,visualApproved,professionalWalkApproved:failures.length===0,
    failures,limits,notes:'Foot-bone tip slip is a proxy, not proof of contact-patch stability. Rust moving cloth remains a separate gate.'}
}
