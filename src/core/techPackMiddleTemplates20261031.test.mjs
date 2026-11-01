import test from 'node:test'
import assert from 'node:assert/strict'
import {createTechPackMiddleTemplate,TECHPACK_MIDDLE_TEMPLATES} from './techPackMiddleTemplates20261031.js'

test('each middle composition stays clear of header, frame, and reserved lower table',()=>{
  for(const template of TECHPACK_MIDDLE_TEMPLATES){
    const page=createTechPackMiddleTemplate(template.id,{pageId:'custom-page'})
    assert.ok(page.pageBoxes.length>0)
    assert.equal(new Set(page.pageBoxes.map(b=>b.id)).size,page.pageBoxes.length)
    for(const box of page.pageBoxes){
      assert.ok(box.x>=39&&box.y>=110&&box.x+box.width<=573&&box.y+box.height<=580)
      assert.equal(box.positionMode,'absolute')
      assert.equal(box.slot.placeholder,true)
      assert.equal(box.slot.category,'boxes')
      assert.equal(box.slot.contentType,['color-swatch','fabric-swatch'].includes(box.semanticRole)?'swatch':'photo')
    }
    for(let i=0;i<page.pageBoxes.length;i++)for(let j=i+1;j<page.pageBoxes.length;j++){
      const a=page.pageBoxes[i],b=page.pageBoxes[j]
      assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y)
    }
  }
})
test('technical callouts have editable numbered arrows pointing into central drawing',()=>{
  const result=createTechPackMiddleTemplate('middle-callouts')
  assert.deepEqual(result.annotations.map(a=>a.label),['1','2','3','4'])
  assert.ok(result.annotations.every(a=>a.type==='arrow'&&a.points.length===2&&a.instruction===''))
  assert.ok(result.annotations.every(a=>a.points[1][0]>=141&&a.points[1][0]<=471))
})
test('asset bindings are opt-in and preserve source IDs without modifying input',()=>{
  const sourceAssets={'fabric-swatch:0':'asset-5'}
  const before=structuredClone(sourceAssets)
  const result=createTechPackMiddleTemplate('middle-fabrics',{pageId:'fabric-page',sourceAssets})
  assert.equal(result.pageBoxes[0].assetId,'asset-5')
  assert.equal(result.pageBoxes[1].assetId,undefined)
  assert.deepEqual(sourceAssets,before)
  assert.throws(()=>createTechPackMiddleTemplate('invalid'))
  assert.throws(()=>createTechPackMiddleTemplate('middle-colors',{pageId:'../../invalid'}))
})
test('higher bottom table rescales all middle boxes and arrow Y coordinates without overlap',()=>{
  for(const template of TECHPACK_MIDDLE_TEMPLATES){
    const original=createTechPackMiddleTemplate(template.id)
    const scaled=createTechPackMiddleTemplate(template.id,{bottomTop:528})
    for(let i=0;i<scaled.pageBoxes.length;i++){
      const b=scaled.pageBoxes[i],before=original.pageBoxes[i]
      assert.ok(b.y>=110&&b.y+b.height<518)
      assert.equal(b.x,before.x)
      assert.equal(b.width,before.width)
      assert.ok(b.height<before.height)
      assert.equal(b.slot.contentType,before.slot.contentType)
    }
    for(let i=0;i<scaled.annotations.length;i++){
      const arrow=scaled.annotations[i],before=original.annotations[i]
      assert.deepEqual(arrow.points.map(p=>p[0]),before.points.map(p=>p[0]))
      assert.ok(arrow.points.every(p=>p[1]>=110&&p[1]<518))
      assert.notDeepEqual(arrow.points,before.points)
    }
  }
})

test('color details uses precisely two black editable swatches and one large mockup',()=>{
  const result=createTechPackMiddleTemplate('middle-color-details')
  assert.deepEqual(result.pageBoxes.map(box=>box.semanticRole),['color-swatch','color-swatch','reference-photo'])
  assert.deepEqual(result.pageBoxes.slice(0,2).map(box=>box.slot.swatchHex),['#080808','#080808'])
  assert.deepEqual(result.pageBoxes.slice(0,2).map(box=>box.slot.swatchOverride),[true,true])
  assert.ok(result.pageBoxes[2].height>380)
  assert.ok(result.pageBoxes[2].width>200)
  assert.ok(result.pageBoxes[0].x+result.pageBoxes[0].width<result.pageBoxes[1].x)
  assert.ok(result.pageBoxes[1].x+result.pageBoxes[1].width<result.pageBoxes[2].x)
})

test('numbered photo gallery variations produce editable slots with ordered references',()=>{
  for(const count of [1,2,3,4,6]){
    const page=createTechPackMiddleTemplate(`middle-photos-${count}`)
    assert.equal(page.pageBoxes.length,count)
    assert.deepEqual(page.pageBoxes.map(b=>b.referenceNumber),Array.from({length:count},(_,i)=>i+1))
    assert.ok(page.pageBoxes.every(b=>b.slot.category==='boxes'&&b.slot.contentType==='photo'))
  }
})

test('landscape pages and compact tables preserve usable margins without overlaps',()=>{
  for(const template of TECHPACK_MIDDLE_TEMPLATES){
    const page=createTechPackMiddleTemplate(template.id,{orientation:'landscape',bottomTop:528})
    assert.deepEqual(page.pageSize,{width:792,height:612})
    for(const box of page.pageBoxes){
      assert.ok(box.x>=39&&box.x+box.width<=753.01)
      assert.ok(box.y>=110&&box.y+box.height<445)
    }
    for(let i=0;i<page.pageBoxes.length;i++)for(let j=i+1;j<page.pageBoxes.length;j++){
      const a=page.pageBoxes[i],b=page.pageBoxes[j]
      assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y)
    }
  }
  assert.throws(()=>createTechPackMiddleTemplate('middle-photos',{orientation:'diagonal'}))
})

test('A4 paper sizes honor orientation, margins, and bottom table clearance',()=>{
  for(const [orientation,width,height] of [['portrait',595,842],['landscape',842,595]]){
    for(const template of TECHPACK_MIDDLE_TEMPLATES){
      const page=createTechPackMiddleTemplate(template.id,{paperSize:'A4',orientation,bottomTop:528})
      assert.deepEqual(page.pageSize,{width,height})
      const bound=Math.min(528,height-157)
      for(const box of page.pageBoxes){
        assert.ok(box.x>=39&&box.x+box.width<=width-39+0.001)
        assert.ok(box.y>=110&&box.y+box.height<bound-10)
      }
      for(const arrow of page.annotations)for(const [x,y] of arrow.points){
        assert.ok(x>=39&&x<=width-39)
        assert.ok(y>=110&&y<bound-10)
      }
    }
  }
  assert.throws(()=>createTechPackMiddleTemplate('middle-colors',{paperSize:'Tabloid'}))
})
