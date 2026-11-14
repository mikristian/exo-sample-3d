import {test} from 'node:test'
import assert from 'node:assert/strict'
import {TECHPACK_PRODUCTION_PACKS,TECHPACK_PRODUCTION_PAGES} from './techPackProductionTemplateCatalog20261031.js'
import {insertProductionTechPackPage,buildProductionTechPack} from './techPackProductionPackBuilder20261031.js'

test('all registered production page types have genuine editable middle areas and appropriate tables',()=>{
 for(const page of TECHPACK_PRODUCTION_PAGES){
  const next=insertProductionTechPackPage({orientation:'portrait',paperSize:'Letter'},page.id,{id:'custom-test-'+page.id})
  const boxes=next.pageBoxes['custom-test-'+page.id]
  assert.equal(boxes.filter(box=>box.slot?.templateRole==='shared-header').length,1,page.id)
  assert.ok(boxes.some(box=>box.slot?.middleTemplateId),page.id)
  const bottom=boxes.find(box=>box.slot?.templateRole==='bottom-table')
  if(bottom)assert.ok(boxes.filter(box=>box.slot?.middleTemplateId).every(box=>box.y+box.height<bottom.y-8),page.id)
  assert.ok(boxes.every(box=>box.x>=26&&box.x+box.width<=586.001),page.id)
  assert.match(next.pages['custom-test-'+page.id].notes,/UNAPPROVED/)
 }
})

test('all replacement packs have complete ordered pages without wiping garment-related state',()=>{
 for(const pack of TECHPACK_PRODUCTION_PACKS){
  const previous={orientation:'portrait',paperSize:'Letter',sourceMeasurements:{bust:42},assets:[{id:'personal',name:'My artwork'}],
    customPages:[{id:'custom-old-layout',name:'Old'}],pageOrder:['custom-old-layout'],pages:{'custom-old-layout':{title:'User custom'}}}
  const before=JSON.stringify(previous)
  const {workspace,firstPage,pageCount}=buildProductionTechPack(previous,pack.id)
  assert.equal(pageCount,pack.pageRecipeIds.length,pack.id)
  assert.equal(workspace.pageOrder.length,pageCount,pack.id)
  assert.equal(workspace.pageOrder[0],firstPage)
  assert.equal(workspace.factoryPagesHidden,true)
  assert.deepEqual(workspace.sourceMeasurements,previous.sourceMeasurements)
  assert.deepEqual(workspace.assets,previous.assets)
  assert.ok(workspace.previousTechPackLayout)
  assert.equal(JSON.stringify(previous),before)
 }
})
