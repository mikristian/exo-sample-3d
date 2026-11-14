import test from 'node:test'
import assert from 'node:assert/strict'
import {reviewLocalPhotoVision20261102,analyzeLocalGarmentPhotoWithVision20261102} from './exoLocalPhotoVisionClient20261102.js'

const reply=(overrides={})=>({
  ok:true,kind:'photo-vision-semantic',provider:'local-ollama',model:'qwen3-vl-instruct:2b',
  manufacturingApproved:false,measurementCalibrationVerified:false,
  semantic:{family:'hoodie',silhouette:'oversized',approximateColor:'blue',visibleClosure:'none-visible',
    confidence:'uncalibrated',uncertainties:[]},...overrides,
})

test('recognized photo vision traits become review-only garment language, never a pattern',()=>{
  const result=reviewLocalPhotoVision20261102(reply())
  assert.equal(result.ok,true,JSON.stringify(result))
  assert.match(result.suggestedPrompt,/oversized hoodie/i)
  assert.equal(result.reviewCandidates[0].color,'blue')
  assert.equal(result.readyToDraft,false)
  assert.equal(result.requiresHumanConfirmation,true)
  assert.equal(result.manufacturingApproved,false)
  assert.equal(result.photoVisibleTraits.family,'hoodie')
  assert.equal(result.project,undefined)
})

test('model-worn, unknown, multiple-garment and forged manufacturing evidence do not authorize pattern creation',()=>{
  const pose=reviewLocalPhotoVision20261102(reply({semantic:{...reply().semantic,uncertainties:['pose','occlusion']}}))
  assert.equal(pose.ok,false)
  assert.equal(pose.readyToDraft,false)
  const multiple=reviewLocalPhotoVision20261102(reply({semantic:{...reply().semantic,uncertainties:['multiple-garments']}}))
  assert.equal(multiple.ok,false)
  assert.match(multiple.decisionBlockers.join(' '),/Multiple garments/)
  const unknown=reviewLocalPhotoVision20261102(reply({semantic:{...reply().semantic,family:'unknown'}}))
  assert.equal(unknown.ok,false)
  const forged=reviewLocalPhotoVision20261102(reply({manufacturingApproved:true}))
  assert.equal(forged.ok,false)
})

test('available photo vision is explicitly optional, and invalid bytes fail before any network',async()=>{
  const fail=await analyzeLocalGarmentPhotoWithVision20261102({type:'image/svg+xml',size:200},{origin:'http://127.0.0.1:5385',fetchImpl:()=>{throw Error('unexpected')}})
  assert.equal(fail.ok,false)
  assert.equal(fail.code,'INVALID_PHOTO')
})

test('zip hoodie visible closure maps to supported authored family but still requires review',()=>{
  const result=reviewLocalPhotoVision20261102(reply({semantic:{...reply().semantic,family:'zip-hoodie',visibleClosure:'zipper'}}))
  assert.equal(result.reviewCandidates?.[0]?.templateId,'zip-hoodie')
  assert.equal(result.readyToDraft,false)
  assert.equal(result.manufacturingApproved,false)
})
