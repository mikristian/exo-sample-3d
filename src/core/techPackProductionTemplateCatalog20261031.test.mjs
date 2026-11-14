import test from 'node:test'
import assert from 'node:assert/strict'
import {TECHPACK_PRODUCTION_PAGES,TECHPACK_PRODUCTION_PACKS,getTechPackProductionPage,createTechPackProductionPackRecipe} from './techPackProductionTemplateCatalog20261031.js'
import {TECHPACK_COMPOSABLE_PAGE_TEMPLATES} from './techPackComposablePageTemplates20261031.js'
import {TECHPACK_MIDDLE_TEMPLATES,createTechPackMiddleTemplate} from './techPackMiddleTemplates20261031.js'

test('every production recipe resolves ordered distinct pages with usable compositions',()=>{
  const pageIds=new Set(TECHPACK_PRODUCTION_PAGES.map(page=>page.id))
  assert.equal(pageIds.size,TECHPACK_PRODUCTION_PAGES.length)
  assert.ok(TECHPACK_PRODUCTION_PAGES.length>=25)
  const compositionIds=new Set(TECHPACK_COMPOSABLE_PAGE_TEMPLATES.map(item=>item.id))
  assert.ok(TECHPACK_PRODUCTION_PAGES.every(item=>compositionIds.has(item.compositionId)))
  for(const pack of TECHPACK_PRODUCTION_PACKS){
    assert.ok(pack.pageRecipeIds.length>=7)
    assert.equal(new Set(pack.pageRecipeIds).size,pack.pageRecipeIds.length)
    assert.ok(pack.pageRecipeIds.every(id=>pageIds.has(id)))
    assert.deepEqual(pack.pages.map(item=>item.id),pack.pageRecipeIds)
    assert.ok(pack.pages.every(item=>item.compositionId&&item.description))
    const copy=createTechPackProductionPackRecipe(pack.id)
    copy.pages.pop()
    assert.equal(pack.pages.length,pack.pageRecipeIds.length)
  }
  assert.ok(getTechPackProductionPage('pattern-grading').description.includes('grade'))
  assert.throws(()=>getTechPackProductionPage('missing'),RangeError)
  assert.throws(()=>createTechPackProductionPackRecipe('missing'),RangeError)
})

test('new production middle compositions are distinct, editable, and fit compact Letter and A4 layouts',()=>{
  const fingerprints=new Set()
  for(const template of TECHPACK_MIDDLE_TEMPLATES){
    const primary=createTechPackMiddleTemplate(template.id,{pageId:'production-spec',bottomTop:528})
    assert.ok(primary.pageBoxes.length>0,template.id)
    assert.ok(primary.pageBoxes.every(box=>box.y>=110&&box.y+box.height<=518&&box.x>=39&&box.x+box.width<=573),template.id)
    assert.ok(primary.pageBoxes.every(box=>box.slot.category==='boxes'&&['photo','swatch'].includes(box.slot.contentType)),template.id)
    for(const orientation of ['portrait','landscape']){
      const a4=createTechPackMiddleTemplate(template.id,{pageId:'production-spec',paperSize:'A4',orientation,bottomTop:orientation==='landscape'?455:528})
      assert.ok(a4.pageBoxes.every(box=>box.x>=39&&box.x+box.width<=a4.pageSize.width-39&&box.y+box.height<=Math.min(orientation==='landscape'?455:528,a4.pageSize.height-157)-10),`${template.id} ${orientation}`)
    }
    fingerprints.add(primary.pageBoxes.map(box=>[box.semanticRole,Math.round(box.x),Math.round(box.y),Math.round(box.width),Math.round(box.height)].join(':')).join('|'))
  }
  assert.equal(fingerprints.size,TECHPACK_MIDDLE_TEMPLATES.length)
})
