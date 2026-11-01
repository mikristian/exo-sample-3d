import test from 'node:test'
import assert from 'node:assert/strict'
import {TECHPACK_PRODUCTION_PAGES,TECHPACK_PRODUCTION_PACKS,createTechPackProductionPackRecipe} from './techPackProductionTemplateCatalog20261031.js'
import {TECHPACK_COMPOSABLE_PAGE_TEMPLATES,createComposedTechPackPage} from './techPackComposablePageTemplates20261031.js'
import {TECHPACK_TEMPLATES,TECHPACK_BOX_TEMPLATES} from './techPackTemplatePresets.js'
import {getNewTechPackTemplates,isVisibleNewTechPackTemplate} from './techPackPageTemplates20261031.js'

test('curated page and full pack catalogs preserve existing production IDs and valid compositions',()=>{
  const pages=getNewTechPackTemplates('pages')
  const packs=getNewTechPackTemplates('packs')
  const compositions=new Set(TECHPACK_COMPOSABLE_PAGE_TEMPLATES.map(item=>item.id))
  assert.deepEqual(pages.map(item=>item.id),TECHPACK_PRODUCTION_PAGES.map(item=>item.id))
  assert.deepEqual(packs.map(item=>item.id),TECHPACK_PRODUCTION_PACKS.map(item=>item.id))
  assert.ok(pages.every(item=>compositions.has(item.compositionId)&&isVisibleNewTechPackTemplate(item)))
  assert.ok(packs.every(item=>isVisibleNewTechPackTemplate(item)))
  for(const pack of packs){
    const recipe=createTechPackProductionPackRecipe(pack.id)
    assert.deepEqual(recipe.pageRecipeIds,[...pack.pageRecipeIds])
    assert.ok(recipe.pages.every(page=>compositions.has(page.compositionId)))
  }
})

test('legacy library templates are excluded while saved page content stays readable',()=>{
  assert.ok(TECHPACK_TEMPLATES.every(item=>!isVisibleNewTechPackTemplate(item,item.category)))
  assert.ok(TECHPACK_BOX_TEMPLATES.every(item=>!isVisibleNewTechPackTemplate(item,'boxes')))
  const composed=createComposedTechPackPage('front-back',{pageId:'saved-authoring'})
  assert.ok(composed.pageBoxes.length>0)
  assert.ok(composed.pageBoxes.every(box=>box.id.startsWith('composed-saved-authoring-')))
})

test('curated boxes are frame free and independently editable',()=>{
  const boxes=getNewTechPackTemplates('boxes')
  assert.ok(boxes.length>=4)
  assert.equal(new Set(boxes.map(box=>box.id)).size,boxes.length)
  assert.ok(boxes.every(box=>box.border==='none'&&box.category==='boxes'&&box.width>0&&box.height>0))
  assert.ok(boxes.every(box=>isVisibleNewTechPackTemplate(box)))
  assert.deepEqual(getNewTechPackTemplates('unknown'),[])
})
