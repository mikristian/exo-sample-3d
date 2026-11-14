import test from 'node:test'
import assert from 'node:assert/strict'
import {getTechPackAssetTags,setTechPackAssetTags,normalizeTechPackAssetTags,inferTechPackAssetTags,removeTechPackAssetTags} from './techPackAssetTags20261031.js'
test('tags normalize, de-duplicate and save without altering source assets',()=>{
 const prev={assetTags:{other:['fabric']},assets:[{id:'image_1',dataUrl:'asset'}]}
 const next=setTechPackAssetTags(prev,'image_1','Fit, FRONT,fit, fabric sample, &bad')
 assert.deepEqual(getTechPackAssetTags(next,'image_1'),['fit','front','fabric-sample','bad'])
 assert.deepEqual(getTechPackAssetTags(prev,'image_1'),[])
 assert.deepEqual(next.assets,prev.assets)
 assert.deepEqual(removeTechPackAssetTags(next,'image_1').assetTags,{other:['fabric']})
})
test('filename inference is conservative and deterministic',()=>{
 assert.deepEqual(inferTechPackAssetTags('tee-back-mockup-2.jpg','reference'),['back','mockup','reference'])
 assert.deepEqual(normalizeTechPackAssetTags(',,,,'),[])
 assert.throws(()=>setTechPackAssetTags({},'../unsafe','hi'),/Invalid asset/)
})
