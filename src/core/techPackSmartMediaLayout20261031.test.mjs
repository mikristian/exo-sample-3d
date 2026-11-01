import test from 'node:test'
import assert from 'node:assert/strict'
import {smartMediaBounds,computeSmartPhotoPositions,reconcileSmartPhotoLayout,assignSmartMediaAssets} from './techPackSmartMediaLayout20261031.js'

const separated=(a,b)=>a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y

test('1..24 images remain inside every supported paper and reserved table area',()=>{
  for(const paperSize of ['Letter','A4'])for(const orientation of ['portrait','landscape']){
    const bounds=smartMediaBounds({paperSize,orientation,bottomTop:528})
    for(let n=1;n<=24;n++){
      const boxes=computeSmartPhotoPositions(n,{paperSize,orientation,bottomTop:528})
      assert.equal(boxes.length,n)
      boxes.forEach((box,i)=>{
        assert.ok(box.x>=bounds.x&&box.y>=bounds.y)
        assert.ok(box.x+box.width<=bounds.x+bounds.width+1e-7)
        assert.ok(box.y+box.height<=bounds.bottom+1e-7)
        for(const other of boxes.slice(i+1))assert.ok(separated(box,other))
      })
      assert.deepEqual(boxes,computeSmartPhotoPositions(n,{paperSize,orientation,bottomTop:528}))
    }
  }
})

test('count changes preserve existing asset metadata and manual transforms; overflow remains accessible',()=>{
  const first=reconcileSmartPhotoLayout({pageId:'custom-a',count:5})
  const authored=first.pageBoxes.map((box,i)=>({...box,assetId:`asset-${i}`,note:`caption ${i}`}))
  authored[1]={...authored[1],x:100,y:130,slot:{...authored[1].slot,manualPlacement:true},transform:{rotation:18}}
  const reduced=reconcileSmartPhotoLayout({pageId:'custom-a',count:3,existingBoxes:authored})
  assert.deepEqual(reduced.pageBoxes[1],authored[1])
  assert.deepEqual(reduced.pageBoxes.map(b=>b.assetId),['asset-0','asset-1','asset-2'])
  assert.deepEqual(reduced.displacedBoxes.map(b=>b.assetId),['asset-3','asset-4'])
  const expanded=reconcileSmartPhotoLayout({pageId:'custom-a',count:6,existingBoxes:reduced.pageBoxes})
  assert.deepEqual(expanded.pageBoxes.slice(0,3).map(b=>b.assetId),['asset-0','asset-1','asset-2'])
  assert.deepEqual(expanded.pageBoxes.slice(3).map(b=>b.id),[4,5,6].map(i=>`middle-custom-a-smart-photo-${i}`))
  assert.equal(expanded.pageBoxes[1].transform.rotation,18)
})

test('auto placement uses explicit category/tags and respects bound media',()=>{
  const page=reconcileSmartPhotoLayout({pageId:'custom-fabric',count:3})
  const assets=[{id:'img-a',category:'reference',caption:'Needle detail'},
    {id:'img-b',category:'reference',caption:'Seam detail'},
    {id:'img-c',category:'fabric',caption:'Black cotton'}]
  const input={pages:[{pageId:page.pageId,pageBoxes:[{...page.pageBoxes[0],assetId:'manual-photo'},...page.pageBoxes.slice(1)]}],
    assets,assetTags:{'img-a':['stitching'],'img-b':['seams']},
    rules:[{id:'seam',pageId:'custom-fabric',category:'reference',tagsAny:['seams','stitching']}]}
  const before=structuredClone(input)
  const result=assignSmartMediaAssets(input)
  assert.equal(result.pages[0].pageBoxes[0].assetId,'manual-photo')
  assert.deepEqual(result.pages[0].pageBoxes.slice(1).map(b=>b.assetId),['img-a','img-b'])
  assert.equal(result.pages[0].pageBoxes[1].note,'Needle detail')
  assert.deepEqual(result.unassignedAssetIds,['img-c'])
  assert.deepEqual(input,before)
  assert.equal(assignSmartMediaAssets({...input,rules:[{pageId:'custom-fabric'}]}).assignments.length,0)
})

test('invalid counts, incompatible geometry and blocked placements are rejected',()=>{
  assert.throws(()=>computeSmartPhotoPositions(0),RangeError)
  assert.throws(()=>computeSmartPhotoPositions(25),RangeError)
  assert.throws(()=>smartMediaBounds({paperSize:'Tabloid'}),RangeError)
  assert.throws(()=>reconcileSmartPhotoLayout({pageId:'../bad',count:2}),TypeError)
  assert.throws(()=>computeSmartPhotoPositions(3,{obstacles:[{x:39,y:110,width:534,height:470}]}),RangeError)
})

test('tag rules apply to existing named middle template photo slots across pages',()=>{
  const pages=[{pageId:'custom-one',pageBoxes:[
    {id:'photo-one',slot:{contentType:'photo',semanticRole:'reference-photo',referenceNumber:1}},
    {id:'table-one',slot:{category:'tables',contentType:'photo'}},
  ]},{pageId:'custom-two',pageBoxes:[
    {id:'photo-two',assetId:'already-set',slot:{contentType:'photo'}},
    {id:'photo-three',slot:{contentType:'photo'}},
  ]}]
  const assets=[{id:'cut-1',category:'reference'},{id:'cut-2',category:'reference'},
    {id:'no-tags',category:'reference'}]
  const result=assignSmartMediaAssets({pages,assets,assetTags:{'cut-1':['fold'],'cut-2':['fold']},
    rules:[{pageId:'custom-one',tagsAny:['fold']},{pageId:'custom-two',tagsAll:['fold']}]})
  assert.equal(result.pages[0].pageBoxes[0].assetId,'cut-1')
  assert.equal(result.pages[0].pageBoxes[1].assetId,undefined)
  assert.equal(result.pages[1].pageBoxes[0].assetId,'already-set')
  assert.equal(result.pages[1].pageBoxes[1].assetId,'cut-2')
  assert.equal(result.assignments.length,2)
})

test('fabric and color swatches support explicit tagged asset assignment, while solid colors and existing photos stay intact',()=>{
  const pages=[{pageId:'custom-materials',pageBoxes:[
    {id:'fabric-empty',slot:{contentType:'swatch',semanticRole:'fabric-swatch',swatchLabel:'FABRIC 01'}},
    {id:'color-empty',slot:{contentType:'swatch',semanticRole:'color-swatch',swatchHex:'#000000',swatchOverride:true}},
    {id:'color-solid',slot:{contentType:'swatch',semanticRole:'color-swatch',swatchHex:'#ff00ff',swatchOverride:true}},
    {id:'fabric-filled',assetId:'authored-fabric',slot:{contentType:'swatch',semanticRole:'fabric-swatch',swatchHex:'#eeeeee'}},
    {id:'photo-filled',assetId:'authored-photo',slot:{contentType:'photo'}},
  ]}]
  const assets=[{id:'fabric-pic',category:'fabric',caption:'Woven cotton'},
    {id:'color-pic',category:'color',tags:['colorway'],caption:'Indigo reference'},
    {id:'other-pic',category:'reference'}]
  const request={pages,assets,assetTags:{'fabric-pic':['cotton']},rules:[
    {pageId:'custom-materials',category:'fabric',tagsAll:['cotton']},
    {pageId:'custom-materials',category:'color',tagsAny:['colorway']},
  ]}
  const before=structuredClone(request)
  const result=assignSmartMediaAssets(request)
  const [fabric,color,solid,filled,photo]=result.pages[0].pageBoxes
  assert.equal(fabric.assetId,'fabric-pic')
  assert.equal(color.assetId,'color-pic')
  assert.equal(color.slot.swatchHex,'#000000')
  assert.equal(color.slot.swatchOverride,true)
  assert.equal(solid.slot.swatchHex,'#ff00ff')
  assert.equal(solid.assetId,undefined)
  assert.equal(filled.assetId,'authored-fabric')
  assert.equal(photo.assetId,'authored-photo')
  assert.deepEqual(result.assignments.map(a=>a.boxId),['fabric-empty','color-empty'])
  assert.deepEqual(request,before)
  const forced=assignSmartMediaAssets({...request,replaceAssigned:true})
  assert.equal(forced.pages[0].pageBoxes[3].assetId,'authored-fabric')
  assert.equal(forced.pages[0].pageBoxes[4].assetId,'authored-photo')
})
