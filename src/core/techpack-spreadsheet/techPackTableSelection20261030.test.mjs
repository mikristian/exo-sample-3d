import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveTechPackTableSelection,validateTechPackSelectedCell} from './techPackTableSelection20261030.mjs'

const table=(id)=>({id,columns:[{id:'a'},{id:'b'}],rows:[{id:'row'}],origin:'source'})
const boxes=[{id:'a',slot:{category:'tables',spreadsheetTable:table('table-a')}},
  {id:'decor',slot:{category:'headers'}},
  {id:'b',slot:{category:'tables',spreadsheetTable:table('table-b')}}]
const resolve=(props={})=>resolveTechPackTableSelection({page:'measurements',pageBoxes:{measurements:boxes},...props})

test('explicit table choice addresses the intended box and preserves source data',()=>{
  const before=structuredClone(boxes)
  const choice=resolve({activeTableId:'b',selectedCell:{r:0,c:1}})
  assert.equal(choice.boxId,'b')
  assert.equal(choice.tableId,'table-b')
  assert.equal(choice.reason,'explicit-table')
  assert.deepEqual(choice.selectedCell,{r:0,c:1})
  assert.deepEqual(boxes,before)
})

test('selected table on current page wins even over a stale explicit table ID',()=>{
  const choice=resolve({activeTableId:'a',selectedBoardObject:{pageId:'measurements',id:'box-b'}})
  assert.equal(choice.boxId,'b')
  assert.equal(choice.reason,'selected-table')
})

test('non-table board selection suppresses first-table and stale explicit-table fallback',()=>{
  for(const id of ['box-decor','asset-image','render-front','box-missing']){
    const choice=resolve({activeTableId:'a',selectedBoardObject:{pageId:'measurements',id}})
    assert.equal(choice.activeTableBox,null,id)
    assert.equal(choice.reason,'non-table-selection',id)
  }
})

test('first table appears only for no selection and no explicit choice',()=>{
  assert.equal(resolve().boxId,'a')
  assert.equal(resolve().reason,'first-table')
  assert.equal(resolve({activeTableId:'absent'}).activeTableBox,null)
  assert.equal(resolve({selectedBoardObject:{pageId:'other',id:'box-decor'}}).boxId,'a')
})

test('cell coordinates are bounded and empty tables have no editable selected cell',()=>{
  assert.deepEqual(validateTechPackSelectedCell(table('x'),{r:99,c:-1}),{r:0,c:0})
  assert.deepEqual(validateTechPackSelectedCell(table('x'),{r:0.5,c:1}),{r:0,c:1})
  assert.equal(validateTechPackSelectedCell({headers:['A'],rows:[]},{r:0,c:0}),null)
  assert.equal(resolve({activeTableId:'table-b',selectedCell:{r:1,c:0}}).selectedCell.r,0)
})
test('legacy custom sheets use the same context without a persistent table migration',()=>{
  const old={id:'handmade',headers:['Operation','Notes'],rows:[{id:'r1',cells:['Stitch','Chain']}],title:'Sewing details'}
  const selection=resolve({legacyTables:{measurements:[old]},selectedBoardObject:{pageId:'measurements',id:'table-handmade'}})
  assert.equal(selection.activeTableBox.legacyTableId,'handmade')
  assert.equal(selection.activeTable,old)
  assert.equal(selection.reason,'selected-table')
  assert.deepEqual(selection.selectedCell,{r:0,c:0})
  assert.equal(old.rows[0].cells[1],'Chain')
})
test('range selection retains bounded end coordinates for Inspector formatting',()=>{
 const selected=resolve({activeTableId:'b',selectedCell:{r:0,c:0,r2:100,c2:100}})
 assert.deepEqual(selected.selectedCell,{r:0,c:0,r2:0,c2:1})
})
