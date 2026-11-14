import test from 'node:test'
import assert from 'node:assert/strict'
import {createFramedBottomTableBox} from './techPackBottomTableTemplates20261031.js'
import {fitUntouchedFramedBottomTables} from './techPackBottomTableFitting20261031.js'

test('old saved bottom table automatically touches the frame edges without touching cells',()=>{
 const b=createFramedBottomTableBox('size-chart','custom-a','table-a')
 const old={...b,x:39,width:534,y:728-b.height}
 const document={pages:{'custom-a':{minimalFramedTemplate:true}},pageBoxes:{'custom-a':[old]}}
 const next=fitUntouchedFramedBottomTables(document)
 const actual=next.pageBoxes['custom-a'][0]
 assert.equal(actual.x,26)
 assert.equal(actual.width,560)
 assert.equal(actual.y+actual.height,740)
 assert.deepEqual(actual.slot.spreadsheetTable,old.slot.spreadsheetTable)
 assert.equal(fitUntouchedFramedBottomTables(next),next)
})
test('never move an artist-customized/translated table or nonframed page',()=>{
 const b=createFramedBottomTableBox('blank','custom-a','table-a')
 const old={...b,x:39,width:534,y:728-b.height}
 const d={pages:{'custom-a':{minimalFramedTemplate:true}},pageBoxes:{'custom-a':[old]},
   boardObjects:{'custom-a':{'box-table-a':{x:27}}}}
 assert.equal(fitUntouchedFramedBottomTables(d),d)
 const other={...d,boardObjects:{},pages:{'custom-a':{minimalFramedTemplate:false}}}
 assert.equal(fitUntouchedFramedBottomTables(other),other)
})
test('legacy bottom chart without a templateRole still fits only if geometry matches exactly',()=>{
 const b=createFramedBottomTableBox('blank','custom-a','table-a')
 const old={...b,x:39,width:534,y:728-b.height,
   slot:{...b.slot,templateRole:undefined}}
 const doc={pages:{'custom-a':{minimalFramedTemplate:true}},pageBoxes:{'custom-a':[old]}}
 const fixed=fitUntouchedFramedBottomTables(doc)
 assert.equal(fixed.pageBoxes['custom-a'][0].x,26)
 assert.equal(fixed.pageBoxes['custom-a'][0].width,560)
 assert.equal(fixed.pageBoxes['custom-a'][0].y+fixed.pageBoxes['custom-a'][0].height,740)
 const different={...doc,pageBoxes:{'custom-a':[{...old,x:48}]}}
 assert.equal(fitUntouchedFramedBottomTables(different),different)
 assert.equal(fixed.pageBoxes['custom-a'][0].slot.templateRole,'bottom-table')
})
test('serialized transform strings and malformed coordinates preserve intentional edits',()=>{
 const base=createFramedBottomTableBox('blank','custom-a','table-a')
 const old={...base,x:39,y:728-base.height,width:534}
 const doc=transform=>({pages:{'custom-a':{minimalFramedTemplate:true}},
   pageBoxes:{'custom-a':[old]},boardObjects:{'custom-a':{'box-table-a':transform}}})
 for(const transform of [{x:'14',scaleX:'1'},{scaleX:'1.14'},{y:'-12'},
   {scaleY:'n/a'},{x:null}])assert.equal(fitUntouchedFramedBottomTables(doc(transform)).pageBoxes['custom-a'][0],old)
 const unchanged=fitUntouchedFramedBottomTables(doc({x:'0',y:'0',scaleX:'1',scaleY:'1'}))
 assert.equal(unchanged.pageBoxes['custom-a'][0].width,560)
 assert.equal(unchanged.boardObjects['custom-a']['box-table-a'].scaleX,'1')
})
test('installed legacy variants at bottom 728 and 740 migrate with or without bottom-table role',()=>{
 const template=createFramedBottomTableBox('grading','custom-a','table-a')
 for(const bottom of [728,740])for(const role of [undefined,'bottom-table']){
   const old={...template,x:39,width:534,y:bottom-template.height,
     slot:{...template.slot,templateRole:role}}
   const workspace={pages:{'custom-a':{minimalFramedTemplate:true}},
     pageBoxes:{'custom-a':[old]},boardObjects:{'custom-a':{'box-table-a':{x:0,y:0,scaleX:1,scaleY:1}}}}
   const upgraded=fitUntouchedFramedBottomTables(workspace)
   const actual=upgraded.pageBoxes['custom-a'][0]
   assert.equal(actual.x,26)
   assert.equal(actual.width,560)
   assert.equal(actual.y+actual.height,740)
   assert.equal(actual.slot.templateRole,'bottom-table')
   assert.equal(actual.slot.spreadsheetTable,old.slot.spreadsheetTable)
   assert.equal(fitUntouchedFramedBottomTables(upgraded),upgraded)
   for(const modified of [{...old,width:530},{...old,x:40},{...old,y:old.y-3}]){
     const changed={...workspace,pageBoxes:{'custom-a':[modified]}}
     assert.equal(fitUntouchedFramedBottomTables(changed),changed)
   }
   const moved={...workspace,boardObjects:{'custom-a':{'box-table-a':{scaleX:'1.05'}}}}
   assert.equal(fitUntouchedFramedBottomTables(moved),moved)
 }
})
