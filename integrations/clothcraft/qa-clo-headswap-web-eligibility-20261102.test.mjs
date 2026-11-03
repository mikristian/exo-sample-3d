import test from 'node:test'
import assert from 'node:assert/strict'
import {auditCloHeadSwapWebEligibility} from './qa-clo-headswap-web-eligibility-20261102.mjs'

test('existing CLO Thomas GLB cannot become an animated homepage model merely by changing the head',()=>{
 const report=auditCloHeadSwapWebEligibility('public/avatars/clo-thomas.glb')
 assert.equal(report.eligible,false)
 assert.equal(report.animationCount,0)
 assert.ok(report.completeRigBones<50)
 assert.ok(report.problems.some(s=>s.includes('animation')))
 assert.ok(report.problems.some(s=>s.includes('attribution')||s.includes('clearance')))
})

test('an existing CC0 experimental avatar must never be falsely called an exported CLO body',()=>{
 const report=auditCloHeadSwapWebEligibility('website/clothcraft/assets/fashion-avatars/garment-v1/EXO_masculine_clothed_motionfixed.glb')
 assert.equal(report.eligible,false)
 assert.ok(report.problems.some(s=>s.includes('CLO body')||s.includes('replacement head')))
})

test('CLO body availability is still blocked under Academic license even when attribution is present',()=>{
 const result=auditCloHeadSwapWebEligibility('public/avatars/clo-thomas.glb',{
  licenseApproval:true,downloadableDerivativeClearance:true,licenseClass:'academic'
 })
 assert.equal(result.eligible,false)
 assert.ok(result.problems.some(msg=>/Academic/i.test(msg)))
})
