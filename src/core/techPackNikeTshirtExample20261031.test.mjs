import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createNikeTshirtExampleTechPack,svgPatternAsset,NIKE_TEE_DEMO_WATERMARK} from './techPackNikeTshirtExample20261031.js'

const project=JSON.parse(fs.readFileSync(new URL('../../public/saved-garments/EXO_Previous_Tshirt_preserved_20261025.garment.json',import.meta.url)))
test('generates a complete editable Nike T-shirt example from saved project without touching original project',()=>{
 const pristine=JSON.stringify(project)
 const previous={orientation:'portrait',paperSize:'Letter',somePrivateState:{keep:42},assets:[]}
 const result=createNikeTshirtExampleTechPack(previous,project,{render:'data:image/webp;base64,AA==',logo:'data:image/svg+xml,%3Csvg%3E%3C/svg%3E'})
 assert.equal(result.pageCount,16)
 assert.equal(result.workspace.pageOrder.length,16)
 assert.equal(result.workspace.factoryPagesHidden,true)
 assert.equal(result.workspace.somePrivateState.keep,42)
 assert.equal(result.workspace.demoTechPack.licensed,false)
 assert.equal(result.draftPatch.status,'draft')
 assert.match(result.workspace.pages['custom-nike-tee-cover'].notes,/NOT FOR MANUFACTURING/)
 const pattern=result.workspace.pageBoxes['custom-nike-tee-pattern']
 assert.equal(pattern.filter(b=>b.slot?.contentType==='photo').length,2)
 assert.ok(pattern.some(b=>b.slot?.spreadsheetTable?.sampleOnly))
 assert.deepEqual(pattern.filter(b=>b.slot?.contentType==='photo').map(b=>b.assetId),['nike-tee-demo-front','nike-tee-demo-back'])
 const artwork=result.workspace.pageBoxes['custom-nike-tee-artwork'].find(b=>b.slot?.spreadsheetTable?.sampleOnly).slot.spreadsheetTable
 assert.ok(artwork.rows.some(row=>Object.values(row.cells).some(c=>String(c.input||'').includes('125.2'))))
 assert.equal(JSON.stringify(project),pristine)
 for(const id of result.workspace.pageOrder){
  const boxes=result.workspace.pageBoxes[id]
  assert.equal(boxes.filter(b=>b.slot?.templateRole==='shared-header').length,1)
  assert.ok(boxes.every(b=>b.x>=25&&b.x+b.width<=587))
  assert.ok(result.workspace.pages[id].notes.includes(NIKE_TEE_DEMO_WATERMARK))
  const bottom=boxes.find(b=>b.slot?.templateRole==='bottom-table')
  if(bottom)assert.ok(boxes.filter(b=>b.slot?.middleTemplateId).every(b=>b.y+b.height<=bottom.y-10))
 }
})
test('rejects unproven alternatives and generates visual SVG only from valid source contour',()=>{
 assert.throws(()=>createNikeTshirtExampleTechPack({},{}),/preserved Nike-logo/)
 assert.equal(svgPatternAsset({polygon:{points:[]}}),null)
 assert.match(svgPatternAsset(project.template.panels[0]),/^data:image\/svg\+xml,%3Csvg/)
})
