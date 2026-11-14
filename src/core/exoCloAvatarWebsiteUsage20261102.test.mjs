import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assessExoCloAvatarWebsiteUse20261102,
  EXO_CLO_AVATAR_ATTRIBUTION_20261102,
} from './exoCloAvatarWebsiteUsage20261102.js'

test('commercial CLO license with exact attribution can qualify for rendered website display in principle',()=>{
 const a=assessExoCloAvatarWebsiteUse20261102({
  licenseClass:'individual-commercial',delivery:'rendered-video',
  attribution:EXO_CLO_AVATAR_ATTRIBUTION_20261102,
 })
 assert.equal(a.canProceedUnderCheckedAssumptions,true)
 assert.equal(a.sendsUnderlyingMeshToVisitor,false)
})

test('academic license blocks a commercial rendered video as well as a raw GLB',()=>{
 for(const delivery of ['rendered-video','rendered-images','browser-glb']){
  const a=assessExoCloAvatarWebsiteUse20261102({delivery,licenseClass:'academic',rawModelPermission:true})
  assert.equal(a.canProceedUnderCheckedAssumptions,false)
  assert.ok(a.issues.some(issue=>issue.includes('Academic')))
 }
})

test('attribution alone does not prove downloadable geometry is cleared',()=>{
 const a=assessExoCloAvatarWebsiteUse20261102({licenseClass:'individual-commercial',delivery:'browser-glb'})
 assert.equal(a.canProceedUnderCheckedAssumptions,false)
 assert.equal(a.sendsUnderlyingMeshToVisitor,true)
 assert.ok(a.issues.some(issue=>issue.includes('extractable')))
})

test('specific public GLB rights and correct commercial license are both required to allow browser meshes',()=>{
 const a=assessExoCloAvatarWebsiteUse20261102({licenseClass:'business-commercial',delivery:'browser-glb',rawModelPermission:true})
 assert.equal(a.canProceedUnderCheckedAssumptions,true)
 assert.equal(a.sendsUnderlyingMeshToVisitor,true)
})
