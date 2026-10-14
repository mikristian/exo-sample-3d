import assert from 'node:assert/strict'
import { evaluatePpfFitAcceptance } from '../ppf_backend/fitAcceptance.mjs'

const contact = {
  frames: 10, allFramesAvatarIntersectionFree: true,
  allFramesSelfIntersectionFree: true, allFramesWithinStrainLimit: true,
}
const sewing = { finalMeanGapCm: 0.10, finalMaxGapCm: 0.35 }
const ipcCcd = { framesAudited: 10, allTestedStepsCollisionFree: true, steps: Array.from({ length: 9 }, () => ({ collisionFree: true })) }

assert.equal(evaluatePpfFitAcceptance({ contact, sewing, requiresIpcCcd: true, ipcCcd }).accepted, true)
const clearance = {framesMeasured: 10, final: {shoulder: {meanCm: 1.2, p90Cm: 2.5}, torso:{meanCm: 1.8}}}
assert.equal(evaluatePpfFitAcceptance({contact, sewing, requiresIpcCcd: true, ipcCcd, requiresShoulderFit: true}).accepted, false, 'Thomas shoulder clearance is required')
assert.equal(evaluatePpfFitAcceptance({contact, sewing, requiresIpcCcd: true, ipcCcd, requiresShoulderFit: true, clearance}).accepted, true)
assert.equal(evaluatePpfFitAcceptance({contact, sewing, requiresIpcCcd: true, ipcCcd, requiresShoulderFit: true, clearance: {...clearance, final: {...clearance.final, shoulder:{meanCm:3,p90Cm:6}}}}).accepted, false, 'Floating shoulders must reject a supposedly stable drape')
assert.equal(evaluatePpfFitAcceptance({ contact, sewing, requiresIpcCcd: true }).accepted, false, 'Thomas cannot pass without IPC')
assert.equal(evaluatePpfFitAcceptance({ contact, sewing, requiresIpcCcd: true, ipcCcd: { ...ipcCcd, allTestedStepsCollisionFree: false } }).accepted, false)
assert.equal(evaluatePpfFitAcceptance({ contact, sewing, requiresIpcCcd: true, ipcCcd: { ...ipcCcd, framesAudited: 4 } }).accepted, false)
assert.equal(evaluatePpfFitAcceptance({ contact: { ...contact, allFramesSelfIntersectionFree: false }, sewing, requiresIpcCcd: true, ipcCcd }).accepted, false)
assert.equal(evaluatePpfFitAcceptance({ contact: { ...contact, allFramesWithinStrainLimit: false }, sewing, requiresIpcCcd: true, ipcCcd }).accepted, false)
assert.equal(evaluatePpfFitAcceptance({ contact, sewing: { ...sewing, finalMeanGapCm: .4 }, requiresIpcCcd: true, ipcCcd }).accepted, false)
console.log(JSON.stringify({ pass: true, validated: 'all-frame IPC body CCD + static contact + strain + seam convergence' }))
