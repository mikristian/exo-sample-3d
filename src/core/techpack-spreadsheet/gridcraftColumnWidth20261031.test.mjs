import test from 'node:test'
import assert from 'node:assert/strict'
import {gridcraftTableCommand} from './gridcraftTableCommands20261030.js'

const sample=()=>({
  id:'table-a',columns:[
    {id:'a',label:'Name',width:130,sourceRef:'garment-a',provenance:{kind:'source'}},
    {id:'b',label:'Size',width:110},
    {id:'c',label:'Notes',width:180},
  ],
  rows:[{id:'r1',sourceRef:'garment-a',cells:{
    a:{input:'Sleeve',value:'Sleeve',sourceRef:'garment-a',provenance:{kind:'source'}},
    b:{input:'M',value:'M'},c:{input:'Sample',value:'Sample'},
  }}],mergedCells:[{r:0,c:1,rowSpan:1,colSpan:2}],
})

test('resizing a source-linked column changes width only, retaining merge and provenance',()=>{
  const before=sample()
  const after=gridcraftTableCommand(before,{type:'setColumnWidth',column:0,width:420})
  assert.equal(after.columns[0].width,420)
  assert.equal(after.columns[1].width,110)
  assert.deepEqual(after.rows,before.rows)
  assert.deepEqual(after.mergedCells,before.mergedCells)
  assert.deepEqual(after.columns[0].provenance,before.columns[0].provenance)
  assert.equal(before.columns[0].width,130)
})

test('column width command accepts bounds and rejects invalid widths and indices',()=>{
  assert.equal(gridcraftTableCommand(sample(),{type:'setColumnWidth',column:1,width:40}).columns[1].width,40)
  assert.equal(gridcraftTableCommand(sample(),{type:'setColumnWidth',column:1,width:500}).columns[1].width,500)
  for(const width of [39,501,NaN,Infinity,'abc']){
    assert.throws(()=>gridcraftTableCommand(sample(),{type:'setColumnWidth',column:1,width}),RangeError)
  }
  assert.throws(()=>gridcraftTableCommand(sample(),{type:'setColumnWidth',column:9,width:100}),RangeError)
})
