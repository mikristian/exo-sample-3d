import test from 'node:test'
import assert from 'node:assert/strict'
import {renderTechPackWorkspacePrintHTML} from './techPackWorkspacePrint.js'

test('linked color and fabric swatches print as filled shapes without a visible caption or frame',()=>{
  const source={name:'T-shirt',panels:[],seams:[],fabrics:[{id:'heavy',name:'Heavy Terry',color:'#112233'}]}
  const workspace={pageBoxes:{flats:[{id:'s1',x:12,y:20,width:90,height:90,slot:{contentType:'swatch',linkedFabricId:'heavy'}}]}}
  const output=renderTechPackWorkspacePrintHTML(source,{},workspace)
  assert.match(output,/class="exo-composed-swatch" style="background:#112233;border:0;"/)
  assert.match(output,/class="exo-composed-visual"/)
  assert.doesNotMatch(output,/exo-composed-swatch"[^>]*>[^<]*<small>/)
  assert.match(output,/\.sheet\.custom-artboard \.custom-artboard-box>\.exo-composed-swatch\{height:100%;max-height:100%\}/)
})
test('selected color square exports authored fill and independent stroke without a box frame',()=>{
  const source={name:'T-shirt',panels:[],seams:[],fabrics:[]}
  const workspace={pageBoxes:{flats:[{id:'color',x:10,y:100,width:92,height:92,
    slot:{contentType:'swatch',swatchHex:'#224466',swatchOverride:true,
      swatchStrokeMode:'color',swatchStrokeHex:'#FF5500',swatchStrokeWidth:3}}]}}
  const html=renderTechPackWorkspacePrintHTML(source,{},workspace)
  assert.match(html,/background:#224466/)
  assert.match(html,/border:3px solid #FF5500/)
  assert.doesNotMatch(html,/border:3px solid #FF5500[^>]*<small/)
})

test('print preserves cropped cover photo and renders plain full-box image',()=>{
  const img='data:image/png;base64,AAAA'
  const output=renderTechPackWorkspacePrintHTML({name:'T-shirt',panels:[],seams:[],fabrics:[]},{},{pageBoxes:{flats:[{id:'photo1',width:240,height:120,assetId:'photo',slot:{contentType:'photo',mediaFit:'cover'}}]}},[{id:'photo',dataUrl:img}])
  assert.match(output,/class="exo-composed-photo" style="object-fit:cover"/)
  assert.match(output,/class="exo-composed-visual"/)
  assert.match(output,/src="data:image\/png;base64,AAAA"/)
})
