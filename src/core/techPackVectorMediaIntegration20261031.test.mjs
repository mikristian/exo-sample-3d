import test from 'node:test'
import assert from 'node:assert/strict'
import {patchTechPackMediaSlot} from './techPackFabricMediaBridge20261031.js'
import {resolveTechPackArtworkSource20261031} from './techPackArtworkPresentation20261031.js'

test('vector appearance changes persist on placed instance without overwriting original',()=>{
  const original={contentType:'photo',category:'boxes',mediaFit:'contain'}
  const changed=patchTechPackMediaSlot(original,{
    vectorFillMode:'none',vectorStrokeMode:'color',vectorStroke:'#28609c',
    vectorStrokeWidth:1.5,vectorRemoveWhite:true})
  assert.equal(changed.vectorFillMode,'none')
  assert.equal(changed.vectorStrokeMode,'color')
  assert.equal(changed.vectorStroke,'#28609C')
  assert.equal(changed.vectorStrokeWidth,1.5)
  assert.equal(changed.vectorRemoveWhite,true)
  assert.equal(original.vectorStroke,undefined)
  const restored=patchTechPackMediaSlot(changed,{
    vectorFillMode:'original',vectorStrokeMode:'original',vectorStrokeWidth:null,vectorRemoveWhite:false})
  assert.equal(restored.vectorStrokeWidth,undefined)
  assert.equal(restored.vectorRemoveWhite,false)
  assert.equal(patchTechPackMediaSlot(original,{vectorStrokeWidth:Infinity,vectorFillMode:'javascript:invalid'}).vectorStrokeWidth,undefined)
})

test('raster sources remain original when arbitrary SVG overrides are requested',()=>{
  const raster='data:image/webp;base64,AA=='
  assert.equal(resolveTechPackArtworkSource20261031(raster,{vectorStrokeMode:'color',vectorStroke:'#888888'}),raster)
})
