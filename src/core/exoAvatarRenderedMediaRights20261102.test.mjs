import test from 'node:test'
import assert from 'node:assert/strict'
import {assessExoRenderedEarthMedia20261102} from './exoAvatarRenderedMediaRights20261102.js'
import {EXO_CLO_AVATAR_ATTRIBUTION_20261102} from './exoCloAvatarWebsiteUsage20261102.js'

const proof={sourceKind:'original-cc0',license:'CC0',sourceIsCommerciallyAuthorized:true,
  renderedOnly:true,framesPerDirection:8,directions:[0,90],atlasFiles:['masculine.webp','feminine.webp']}

test('only original, commercially usable CC0 rendered proof images pass by default',()=>{
 const result=assessExoRenderedEarthMedia20261102(proof)
 assert.equal(result.allowed,true)
})

test('source GLB never qualifies as frames-only delivery',()=>{
 assert.equal(assessExoRenderedEarthMedia20261102({...proof,atlasFiles:['model.glb']}).allowed,false)
 assert.equal(assessExoRenderedEarthMedia20261102({...proof,renderedOnly:false}).allowed,false)
})

test('Academic CLO still fails even with attribution and image-only format',()=>{
 const result=assessExoRenderedEarthMedia20261102({...proof,sourceKind:'clo-derived',license:'academic',
  attribution:EXO_CLO_AVATAR_ATTRIBUTION_20261102})
 assert.equal(result.allowed,false)
 assert.ok(result.issues.some(i=>/Academic/.test(i)))
})

test('commercial CLO may meet terms-based rendered-only checks with attribution and verified provenance',()=>{
 const result=assessExoRenderedEarthMedia20261102({...proof,
  sourceKind:'clo-derived',license:'individual-commercial',
  attribution:EXO_CLO_AVATAR_ATTRIBUTION_20261102})
 assert.equal(result.allowed,true)
 assert.equal(result.cloTerms.sendsUnderlyingMeshToVisitor,false)
})

test('commercial CLO rendered images without exact attribution fail',()=>{
 const result=assessExoRenderedEarthMedia20261102({...proof,
  sourceKind:'clo-default',license:'business-commercial',attribution:'© CLO'})
 assert.equal(result.allowed,false)
})
