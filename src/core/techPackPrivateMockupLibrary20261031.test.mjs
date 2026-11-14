import test from 'node:test'
import assert from 'node:assert/strict'
import {PRIVATE_SEAGGS_TSHIRT_REFERENCE,TECHPACK_MOCKUP_FOLDER,createPrivateSeaggsMockupAsset,createPrivateSeaggsVectorAsset,createOriginalTshirtMockupAsset,addMockupAssets} from './techPackPrivateMockupLibrary20261031.js'

test('private source is referenced only by metadata; never embedded into bundle',()=>{
  assert.equal(TECHPACK_MOCKUP_FOLDER.id,'mockups')
  assert.equal(PRIVATE_SEAGGS_TSHIRT_REFERENCE.access,'explicit-local-import')
  assert(!JSON.stringify(PRIVATE_SEAGGS_TSHIRT_REFERENCE).includes('data:image/'))
  assert.throws(()=>createPrivateSeaggsMockupAsset({id:'private'}),/Explicit local/)
  const imported=createPrivateSeaggsMockupAsset({id:'private',dataUrl:'data:image/png;base64,AAAA'})
  assert.equal(imported.privateSource,true)
  assert.equal(imported.category,'mockup')
})

test('original tee front and back are separate source-free SVG line-art assets',()=>{
  const front=createOriginalTshirtMockupAsset({view:'front'})
  const back=createOriginalTshirtMockupAsset({id:'exo-tee-back',view:'back'})
  assert.equal(front.category,'mockup')
  assert(front.dataUrl.startsWith('data:image/svg+xml,'))
  assert.notEqual(front.dataUrl,back.dataUrl)
  assert(!decodeURIComponent(front.dataUrl).includes('SEAGGS'))
  assert.throws(()=>createOriginalTshirtMockupAsset({view:'side'}),TypeError)
})

test('adding assets preserves authored originals and rejects duplicates',()=>{
  const prior={assets:[{id:'user-photo',name:'User asset'}],pageBoxes:{foo:[{id:'b'}]}}
  const next=addMockupAssets(prior,[createOriginalTshirtMockupAsset()])
  assert.equal(prior.assets.length,1)
  assert.deepEqual(next.pageBoxes,prior.pageBoxes)
  assert.throws(()=>addMockupAssets(next,[createOriginalTshirtMockupAsset()]),/duplicate/)
})
test('private Illustrator/PDF vector is distinct from raster and never bundled as source',()=>{
 const datum='data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M0%200L3%203%22%2F%3E%3C%2Fsvg%3E'
 const asset=createPrivateSeaggsVectorAsset({id:'user-seaggs-vector',dataUrl:datum})
 assert.equal(asset.sourceRepresentation,'private-pdf-vector')
 assert(asset.tags.includes('vector'))
 assert.throws(()=>createPrivateSeaggsVectorAsset({id:'x',dataUrl:'data:image/png;base64,AAAA'}),/Validated/)
})
