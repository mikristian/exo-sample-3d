import assert from 'node:assert/strict'
import test from 'node:test'
import {TECHPACK_OBJECT_TEMPLATES,createTechPackObjectFromPreset,insertTechPackObjectPreset} from './techPackObjectTemplateCatalog20261031.js'

test('catalog contains direct media, swatches and actual editable geometry without legacy cards',()=>{
  assert.equal(TECHPACK_OBJECT_TEMPLATES.length,10)
  assert(TECHPACK_OBJECT_TEMPLATES.every(item=>item.category==='boxes'&&item.kind!=='card'))
  for(const id of ['media-swatch','media-photo','media-artwork']){
    const {collection,object}=createTechPackObjectFromPreset(id,{pageId:'custom-1',id:`obj-${id}`})
    assert.equal(collection,'pageBoxes')
    assert.equal(object.lineColor,'transparent')
    assert.equal(object.title,'')
    assert.equal(object.slot.templateRole,'object-artwork')
  }
  for(const id of ['rectangle','square','ellipse','circle','outline-frame']){
    const {collection,object}=createTechPackObjectFromPreset(id,{pageId:'custom-1',id:`obj-${id}`})
    assert.equal(collection,'vectorObjects')
    assert(['rect','ellipse'].includes(object.kind))
  }
  for(const id of ['text-callout','text-factory-note'])assert.equal(createTechPackObjectFromPreset(id,{pageId:'custom-1',id:`obj-${id}`}).object.kind,'text')
})

test('insertion preserves authored document objects and avoids duplicate ids',()=>{
  const original={pageBoxes:{'custom-1':[{id:'authored',note:'retain'}]},vectorObjects:{'custom-1':[]}}
  const updated=insertTechPackObjectPreset(original,'media-photo',{pageId:'custom-1',id:'new-photo',assetId:'asset-1'})
  assert.deepEqual(original.pageBoxes['custom-1'],[{id:'authored',note:'retain'}])
  assert.equal(updated.pageBoxes['custom-1'][1].assetId,'asset-1')
  assert.throws(()=>insertTechPackObjectPreset(updated,'media-photo',{pageId:'custom-1',id:'new-photo'}),/Duplicate/)
  const vectorUpdated=insertTechPackObjectPreset(updated,'square',{pageId:'custom-1',id:'new-shape'})
  assert.equal(vectorUpdated.vectorObjects['custom-1'][0].width,vectorUpdated.vectorObjects['custom-1'][0].height)
})

test('rejects malformed requests before modifying workspace',()=>{
  for(const options of [{id:'x',pageId:'../outside'},{id:'x',pageId:'custom-1',x:Infinity},{id:'x',pageId:'custom-1',assetId:'../wrong'}]){
    assert.throws(()=>createTechPackObjectFromPreset('media-photo',options))
  }
  assert.throws(()=>createTechPackObjectFromPreset('missing',{id:'x',pageId:'custom-1'}),RangeError)
})
