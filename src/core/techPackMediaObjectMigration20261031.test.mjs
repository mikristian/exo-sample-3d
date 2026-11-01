import test from 'node:test'
import assert from 'node:assert/strict'
import {removeUnpositionedDuplicateMediaAsset} from './techPackMediaObjectMigration20261031.js'

test('slot assignment drops only an accidentally loose duplicate of the same asset',()=>{
 const input={pageAssets:{page:['front','unrelated']},pageBoxes:{page:[{
   id:'reference',assetId:'front',slot:{contentType:'photo'}}]},boardObjects:{page:{}}}
 const output=removeUnpositionedDuplicateMediaAsset(input,'page','front')
 assert.deepEqual(output.pageAssets.page,['unrelated'])
 assert.deepEqual(input.pageAssets.page,['front','unrelated'])
 const authored={...input,boardObjects:{page:{'asset-front':{x:31,scaleX:1.4}}}}
 assert.equal(removeUnpositionedDuplicateMediaAsset(authored,'page','front'),authored)
 assert.equal(removeUnpositionedDuplicateMediaAsset(input,'page','missing'),input)
})
test('newly attached unpositioned artwork stays visible when no page slot contains it',()=>{
 const imageOnly={pageAssets:{page:['seaggs-flat']},pageBoxes:{page:[]},boardObjects:{page:{}}}
 assert.equal(removeUnpositionedDuplicateMediaAsset(imageOnly,'page','seaggs-flat'),imageOnly)
 const unassigned={...imageOnly,pageBoxes:{page:[{id:'photo',assetId:'another',slot:{contentType:'photo'}}]}}
 assert.equal(removeUnpositionedDuplicateMediaAsset(unassigned,'page','seaggs-flat'),unassigned)
})
import {applyTechPackMediaAssetToBox,shrinkMediaBoxToArtwork} from './techPackMediaObjectMigration20261031.js'

test('a placeholder becomes an image-sized object without losing identity, text or transforms',()=>{
  const original={id:'a',x:10,y:20,width:300,height:200,title:'Front',caption:'View A',zIndex:7,
    rotation:22,opacity:.7,boardTransform:{x:2,scaleX:1.5},slot:{contentType:'placeholder',templateRole:'reference',caption:'Authored'}}
  const before=structuredClone(original)
  const converted=applyTechPackMediaAssetToBox(original,{id:'photo1'}, {width:100,height:200})
  assert.equal(converted.assetId,'photo1')
  assert.equal(converted.assetSrc,null)
  assert.equal(converted.slot.contentType,'photo')
  assert.deepEqual([converted.x,converted.y,converted.width,converted.height],[110,20,100,200])
  for(const key of ['id','title','caption','zIndex','rotation','opacity'])assert.equal(converted[key],original[key])
  assert.equal(converted.boardTransform,original.boardTransform)
  assert.equal(converted.slot.caption,'Authored')
  assert.deepEqual(original,before)
})

test('manual geometry stays fixed unless an explicit refit is requested',()=>{
  const original={id:'manual',x:10,y:20,width:300,height:200,slot:{contentType:'placeholder',mediaGeometryManual:true}}
  const selected={id:'new-photo',width:100,height:200}
  const applied=applyTechPackMediaAssetToBox(original,selected)
  assert.deepEqual([applied.x,applied.y,applied.width,applied.height],[10,20,300,200])
  assert.deepEqual([shrinkMediaBoxToArtwork(applied,{width:100,height:200}).width,shrinkMediaBoxToArtwork(applied,{width:100,height:200}).x],[300,10])
  const refit=applyTechPackMediaAssetToBox(original,selected,null,{force:true})
  assert.deepEqual([refit.x,refit.width],[110,100])
})

test('cover crop and missing intrinsic dimensions preserve visible frame and metadata',()=>{
  const source={id:'cover',x:0,y:10,width:200,height:120,slot:{contentType:'placeholder',mediaFit:'cover'},assetId:'old'}
  const cover=applyTechPackMediaAssetToBox(source,{id:'new'}, {width:300,height:600})
  assert.deepEqual([cover.x,cover.y,cover.width,cover.height],[0,10,200,120])
  assert.equal(cover.slot.mediaFit,'cover')
  const unavailable=applyTechPackMediaAssetToBox(source,{id:'new'}, {width:0,height:100})
  assert.equal(unavailable.width,200)
  assert.equal(shrinkMediaBoxToArtwork(null,{width:100,height:100}),null)
  assert.equal(applyTechPackMediaAssetToBox(source,null,{width:50,height:50}),source)
})

test('shrinking an already-fitted object is stable, and image assignment retains other slot fields',()=>{
  const box={x:10,y:20,width:300,height:200,slot:{contentType:'photo',templateRole:'reference',swatchLabel:'Front'}}
  const shrunk=shrinkMediaBoxToArtwork(box,{width:100,height:200})
  assert.equal(shrinkMediaBoxToArtwork(shrunk,{width:100,height:200}),shrunk)
  const replaced=applyTechPackMediaAssetToBox(shrunk,{id:'replacement'},{width:100,height:200})
  assert.equal(replaced.slot.templateRole,'reference')
  assert.equal(replaced.slot.swatchLabel,'Front')
  assert.equal(replaced.width,100)
})
