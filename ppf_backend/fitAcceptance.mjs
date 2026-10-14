// Pure acceptance gate shared by the PPF service and offline regression QA.
// In particular, a collision-free snapshot is *not* enough to certify a
// trajectory on the real Thomas mesh: IPC swept CCD must pass as well.
export function evaluatePpfFitAcceptance({ contact, sewing, requiresIpcCcd = false, ipcCcd = null,
  requiresShoulderFit = false, clearance = null }) {
  const collisionPass = contact?.allFramesAvatarIntersectionFree === true &&
    contact?.allFramesSelfIntersectionFree === true
  const strainPass = contact?.allFramesWithinStrainLimit === true
  const seamPass = Number.isFinite(sewing?.finalMeanGapCm) &&
    Number.isFinite(sewing?.finalMaxGapCm) &&
    sewing.finalMeanGapCm <= 0.2 && sewing.finalMaxGapCm <= 1.0
  const ipcCcdPass = !requiresIpcCcd || (
    ipcCcd?.allTestedStepsCollisionFree === true &&
    Number(contact?.frames) >= 2 &&
    ipcCcd.framesAudited === contact.frames &&
    ipcCcd.steps?.length === contact.frames - 1
  )
  // Initial engineering thresholds, not a certified CLO comparison. A shirt
  // can be intersection-free yet hover away from shoulders or torso.
  const shoulderFitPass = !requiresShoulderFit || (
    Number.isFinite(clearance?.final?.shoulder?.meanCm) &&
    Number.isFinite(clearance?.final?.shoulder?.p90Cm) &&
    Number.isFinite(clearance?.final?.torso?.meanCm) &&
    clearance.final.shoulder.meanCm <= 1.5 &&
    clearance.final.shoulder.p90Cm <= 3 &&
    clearance.final.torso.meanCm <= 2 &&
    Number(clearance?.framesMeasured) === Number(contact?.frames)
  )
  return {
    accepted: collisionPass && strainPass && seamPass && ipcCcdPass && shoulderFitPass,
    collisionPass, strainPass, seamPass, ipcCcdPass, shoulderFitPass,
    seamMeanGapLimitCm: 0.2, seamMaxGapLimitCm: 1.0,
    shoulderMeanClearanceLimitCm: 1.5,
    shoulderP90ClearanceLimitCm: 3.0,
    torsoMeanClearanceLimitCm: 2.0,
  }
}
