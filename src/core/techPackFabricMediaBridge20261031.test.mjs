import test from 'node:test'
import assert from 'node:assert/strict'
import {getLinkedFabricMedia,normalizeTechPackFillHex,patchTechPackMediaSlot,selectTechPackMediaAssets} from './techPackFabricMediaBridge20261031.js'
test('hex entry accepts short or full hex but never persists invalid input',()=>{
 assert.equal(normalizeTechPackFillHex('#abc'),'#AABBCC')
 assert.equal(normalizeTechPackFillHex('0a0a0a'),'#0A0A0A')
 assert.equal(normalizeTechPackFillHex('transparent'),null)
 assert.deepEqual(patchTechPackMediaSlot({swatchHex:'#000000',linkedFabricId:'f1'},{swatchHex:'oops'}),{swatchHex:'#000000',linkedFabricId:'f1'})
})
test('fabric metadata links the source without generating physical claims',()=>{
 const fabric={id:'f1',name:'French Terry',gsm:420,texture:{albedo:'a.png'}}
 const linked=getLinkedFabricMedia('f1',[fabric])
 assert.equal(linked.metadata.gsm,420)
 assert.equal(linked.verification,'unverified')
 assert.deepEqual(linked.texture,fabric.texture)
 assert.equal(linked.metadata.thickness,undefined)
 assert.equal(getLinkedFabricMedia('missing',[fabric]),null)
})
test('asset picker requires explicit role or tags and preserves source IDs',()=>{
 const assets=[{id:'tee-front',category:'technical flat',tags:['front','tshirt']},{id:'tee-back',category:'technical flat',tags:['back','tshirt']},{id:'untagged',category:'reference',name:'front mockup'}]
 assert.deepEqual(selectTechPackMediaAssets(assets,{kind:'technical-flat',role:'front',tags:['tshirt']}).map(a=>a.id),['tee-front'])
 assert.deepEqual(selectTechPackMediaAssets(assets,{kind:'mockup',role:'front'}).map(a=>a.id),['tee-front'])
 assert.deepEqual(patchTechPackMediaSlot({linkedFabricId:'old'}, {linkedFabricId:'new'}),{linkedFabricId:'new'})
})
test('swatch color and stroke persist separately without adding legacy frame geometry',()=>{
 const original={contentType:'swatch',swatchHex:'#121212',swatchStrokeMode:'none'}
 const result=patchTechPackMediaSlot(original,{swatchHex:'#abcdef',swatchStrokeMode:'color',
   swatchStrokeHex:'#112233',swatchStrokeWidth:2.5})
 assert.equal(result.swatchHex,'#ABCDEF')
 assert.equal(result.swatchStrokeHex,'#112233'.toUpperCase())
 assert.equal(result.swatchStrokeWidth,2.5)
 assert.equal(result.swatchStrokeMode,'color')
 assert.deepEqual(original,{contentType:'swatch',swatchHex:'#121212',swatchStrokeMode:'none'})
 assert.equal(patchTechPackMediaSlot(result,{swatchStrokeWidth:999}).swatchStrokeWidth,2.5)
 assert.equal(patchTechPackMediaSlot(result,{swatchStrokeMode:'none'}).swatchStrokeMode,'none')
})
