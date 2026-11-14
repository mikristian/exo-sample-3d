import {test} from 'node:test'
import assert from 'node:assert/strict'
import {techPackPageLayout} from './techPackPageLayout.js'
import {reflowTechPackPageLayout,techPackArtboardSize} from './techPackResponsivePage20261031.js'

const page='custom-mikristian'
const workspace={orientation:'portrait',paperSize:'Letter',pages:{[page]:{minimalFramedTemplate:true}},
  pageBoxes:{[page]:[
    {id:'header',positionMode:'absolute',x:26,y:34,width:560,height:72,slot:{templateRole:'shared-header'}},
    {id:'black1',positionMode:'absolute',x:46,y:134,width:132,height:160,slot:{middleTemplateId:'middle-colors'}},
    {id:'photo',positionMode:'absolute',x:190,y:130,width:370,height:400,assetId:'owned',slot:{middleTemplateId:'middle-colors'}},
    {id:'bottom',positionMode:'absolute',x:26,y:528,width:560,height:212,slot:{templateRole:'bottom-table'}}]},
  annotations:{[page]:[{id:'arrow',points:[[75,218],[200,330]],label:'keep'}]}}

test('clean framed pages obey global orientation and paper size',()=>{
  assert.equal(techPackPageLayout(workspace,page).orientation,'portrait')
  const wide=reflowTechPackPageLayout(workspace,{orientation:'landscape'})
  assert.equal(techPackPageLayout(wide,page).orientation,'landscape')
  assert.deepEqual(techPackArtboardSize(techPackPageLayout(wide,page)),{width:792,height:612})
  const boxes=wide.pageBoxes[page]
  assert.equal(boxes[0].width,740)
  assert.equal(boxes[3].x,26)
  assert.equal(boxes[3].y+boxes[3].height,560)
  assert.equal(boxes[2].assetId,'owned')
  assert.ok(boxes.slice(1,3).every(box=>box.x>=26&&box.x+box.width<=766.0001&&box.y>=110&&box.y+box.height<boxes[3].y))
  assert.equal(wide.annotations[page][0].label,'keep')
  assert.notDeepEqual(wide.annotations[page][0].points,workspace.annotations[page][0].points)
  const restored=reflowTechPackPageLayout(wide,{orientation:'portrait'})
  assert.equal(restored.pageBoxes[page][0].width,560)
  assert.ok(Math.abs(restored.pageBoxes[page][1].width-132)<.001)
  assert.deepEqual(restored.pageBoxes[page][2].assetId,workspace.pageBoxes[page][2].assetId)
})

test('A4 sheets reflow artboard content without editing source measurements',()=>{
 const original={...workspace,sourceMeasurements:{bust:94}}
 const next=reflowTechPackPageLayout(original,{orientation:'landscape',paperSize:'A4'})
 assert.deepEqual(techPackArtboardSize(techPackPageLayout(next,page)),{width:842,height:595})
 assert.equal(next.pageBoxes[page][0].width,790)
 assert.deepEqual(next.sourceMeasurements,original.sourceMeasurements)
})
