import test from 'node:test'
import assert from 'node:assert/strict'
import {TECHPACK_COMPOSABLE_PAGE_TEMPLATES,createComposedTechPackPage,restyleComposedTechPackPage} from './techPackComposablePageTemplates20261031.js'

test('catalog includes all requested page purposes with safe printable rectangles',()=>{
  assert.equal(TECHPACK_COMPOSABLE_PAGE_TEMPLATES.length,11)
  assert.equal(new Set(TECHPACK_COMPOSABLE_PAGE_TEMPLATES.map(t=>t.id)).size,11)
  for(const template of TECHPACK_COMPOSABLE_PAGE_TEMPLATES){
    assert.ok(template.regions.length<=24)
    for(const {rect,role} of template.regions){
      assert.ok(role)
      assert.ok(rect.x>=0&&rect.y>=0&&rect.width>0&&rect.height>0)
      assert.ok(rect.x+rect.width<=612&&rect.y+rect.height<=792,`${template.id} ${role}`)
    }
    const result=createComposedTechPackPage(template.id,{pageId:'custom-one'})
    assert.equal(result.pageBoxes.length,template.regions.length)
    assert.equal(new Set(result.pageBoxes.map(b=>b.id)).size,result.pageBoxes.length)
    assert.deepEqual(JSON.parse(JSON.stringify(result)),result)
    assert.ok(result.pageBoxes.every(b=>b.positionMode==='absolute'))
  }
})

test('new pages are blank and only explicitly reference supplied assets',()=>{
  const page=createComposedTechPackPage('front-back',{pageId:'custom-front',sourceAssets:{'front-view':'asset-17','back-view:0':'asset-18'},brandStyle:{lineColor:'#123456',border:'dashed'}})
  assert.equal(page.pageBoxes.find(b=>b.semanticRole==='front-view').assetId,'asset-17')
  assert.equal(page.pageBoxes.find(b=>b.semanticRole==='back-view').assetId,'asset-18')
  assert.ok(page.pageBoxes.every(b=>b.note===''&&b.title===''))
  assert.ok(page.pageBoxes.every(b=>b.lineColor==='#123456'))
  assert.deepEqual(page.pageBoxes.find(b=>b.semanticRole==='bottom-table').slot.headers,[])
  assert.throws(()=>createComposedTechPackPage('missing'),RangeError)
  assert.throws(()=>createComposedTechPackPage('spec-sheet',{pageId:'invalid id'}),TypeError)
})

test('restyling retains linked cells, notes, assets, IDs, unknown roles and snapshots',()=>{
  const page=createComposedTechPackPage('fit-measurements',{pageId:'custom-fit'})
  const table=page.pageBoxes.find(b=>b.semanticRole==='table')
  table.assetId='source-asset'
  table.note='Measured on prototype'
  table.slot.spreadsheetTable={columns:[{id:'chest',label:'Chest'}],rows:[{id:'source-row',sourceRef:'real-row',cells:{chest:{input:42,value:42,origin:'native',sourceRef:'measurement-42'}}}]}
  table.customReview={approved:false}
  page.pageBoxes.push({id:'legacy-unknown',semanticRole:'revision-stamp',positionMode:'absolute',x:18,y:712,width:45,height:25,slot:{category:'custom',data:'Preserve'},note:'REV B'})
  const before=structuredClone(table)
  const restyled=restyleComposedTechPackPage(page,'spec-sheet',{brandStyle:{lineColor:'#ffffff'}})
  const preserved=restyled.pageBoxes.find(b=>b.id===table.id)
  assert.deepEqual(preserved.slot.spreadsheetTable,before.slot.spreadsheetTable)
  assert.equal(preserved.note,'Measured on prototype')
  assert.equal(preserved.assetId,'source-asset')
  assert.deepEqual(preserved.customReview,{approved:false})
  assert.equal(preserved.width,548)
  assert.equal(preserved.height,565)
  assert.deepEqual(restyled.pageBoxes.find(b=>b.id==='legacy-unknown'),page.pageBoxes.at(-1))
  assert.deepEqual(page.pageBoxes.find(b=>b.id===table.id),before)
  assert.deepEqual(JSON.parse(JSON.stringify(restyled)),restyled)
})

test('multiple swatches follow stable ordinal roles across layouts without content loss',()=>{
  const original=createComposedTechPackPage('color-swatches',{pageId:'custom-gallery'})
  const swatches=original.pageBoxes.filter(b=>b.semanticRole==='swatch')
  swatches.forEach((box,i)=>{box.assetId=`asset-${i}`;box.note=`shade-${i}`})
  const resized=restyleComposedTechPackPage(original,'fabric-swatches')
  assert.deepEqual(resized.pageBoxes.filter(b=>b.semanticRole==='swatch').map(b=>b.note),['shade-0','shade-1','shade-2','shade-3','shade-4','shade-5'])
  assert.equal(resized.pageBoxes.find(b=>b.id===swatches[0].id).width,260)
  assert.deepEqual(resized.pageBoxes.filter(b=>b.semanticRole==='swatch').map(b=>b.assetId),swatches.map(b=>b.assetId))
  const asArray=restyleComposedTechPackPage(original.pageBoxes,'references',{pageId:'custom-gallery'})
  assert.ok(Array.isArray(asArray))
  assert.equal(asArray.filter(b=>b.semanticRole==='swatch').length,6)
})

test('freeform untagged objects and unsupported source content remain intact',()=>{
  const existing=[{id:'old-freeform',positionMode:'absolute',x:4,y:7,width:44,height:53,assetId:'linked-photo',note:'original',slot:{spreadsheetTable:{rows:[{cells:{x:{sourceRef:'keep'}}}]}}}]
  const out=restyleComposedTechPackPage(existing,'construction',{pageId:'custom-page'})
  assert.deepEqual(out.at(-1),existing[0])
  assert.equal(out.length,TECHPACK_COMPOSABLE_PAGE_TEMPLATES.find(t=>t.id==='construction').regions.length+1)
})
