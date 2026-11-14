import {test} from 'node:test'
import assert from 'node:assert/strict'
import {gridcraftTableCommand as run,applyGridcraftTableCommands} from './gridcraftTableCommands20261030.js'

const authored=()=>({columns:[{id:'a',label:'A',width:120},{id:'b',label:'B',width:180}],rows:[{id:'r1',cells:{a:{input:'one',value:'one'},b:{input:'two',value:'two'}}}],cellStyles:{'r1:1':{bold:true}}})
const bound=()=>({sourceRevision:9,columns:[{id:'pom',label:'POM',width:150},{id:'extra',label:'Extra',width:160,provenance:{kind:'authored'}}],rows:[{id:'chest',sourceRef:'pom:chest',cells:{pom:{input:'48',value:'48',origin:'native',sourceRef:'pom:chest'},extra:{input:'note',value:'note',origin:'authored'}}}],cellStyles:{'chest:1':{italic:true}}})

test('insert, duplicate and delete authored rows preserve identities and styles',()=>{
  const original=authored()
  let next=run(original,{type:'duplicateRow',row:0})
  assert.deepEqual(next.rows.map(r=>r.id),['r1','authored-row-1'])
  assert.equal(next.rows[1].cells.b.input,'two')
  assert.deepEqual(next.cellStyles['authored-row-1:1'],{bold:true})
  next=run(next,{type:'insertRow',at:1})
  assert.equal(next.rows[1].cells.a.input,'')
  next=run(next,{type:'deleteRow',row:0})
  assert.equal(next.cellStyles['r1:1'],undefined)
  assert.equal(original.rows.length,1)
})

test('column shifts preserve IDs, source objects and positional styles',()=>{
  let next=run(authored(),{type:'insertColumn',at:1,label:'New'})
  assert.deepEqual(next.columns.map(c=>c.id),['a','authored-column-1','b'])
  assert.deepEqual(next.cellStyles,{'r1:2':{bold:true}})
  next=run(next,{type:'renameHeading',column:1,label:'Width'})
  next=run(next,{type:'deleteColumn',column:0})
  assert.deepEqual(next.columns.map(c=>c.label),['Width','B'])
  assert.deepEqual(next.cellStyles,{'r1:1':{bold:true}})
  assert.equal(next.rows[0].cells.b.input,'two')
})

test('source row and column destructive edits reject, while source duplicate is authored blank',()=>{
  const original=bound()
  for(const command of [{type:'deleteRow',row:0},{type:'deleteColumn',column:0},{type:'renameHeading',column:0,label:'Oops'}]){
    assert.throws(()=>run(original,command),/source-bound/)
  }
  const copy=run(original,{type:'duplicateRow',row:0})
  assert.equal(copy.rows[1].sourceRef,undefined)
  assert.equal(copy.rows[1].cells.pom.input,'')
  assert.equal(copy.rows[0].cells.pom.sourceRef,'pom:chest')
  const inserted=run(original,{type:'insertColumn',at:1,label:'Notes'})
  assert.equal(inserted.rows[0].cells.pom.origin,'native')
  assert.equal(inserted.rows[0].cells.pom.value,'48')
  assert.equal(inserted.rows[0].cells[inserted.columns[1].id].input,'')
  assert.equal(inserted.cellStyles['chest:2'].italic,true)
})

test('styling modifies only formatting, validates values, and supports command batch',()=>{
  const original=bound()
  const next=applyGridcraftTableCommands(original,[
    {type:'formatCell',row:0,column:0,style:{bold:true,align:'center',background:'#aabbcc'}},
    {type:'setTheme',theme:'dark'}
  ])
  assert.equal(next.rows[0].cells.pom.override,undefined)
  assert.equal(next.rows[0].cells.pom.sourceRef,'pom:chest')
  assert.equal(next.cellStyles['chest:0'].background,'#aabbcc')
  assert.equal(next.tableStyle.theme,'dark')
  assert.deepEqual(original.cellStyles,{'chest:1':{italic:true}})
  assert.throws(()=>run(original,{type:'formatCell',row:0,column:0,style:{background:'javascript:bad'}}),/Invalid color/)
})

test('legacy positional grid also keeps styles and values through structural changes',()=>{
  const grid={headers:['One','Two'],columnIds:['x','y'],rows:[{id:'r',cells:['a','b']}],cellStyles:{'r:1':{underline:true}}}
  const next=run(run(grid,{type:'insertColumn',at:0,label:'Zero'}),{type:'deleteColumn',column:1})
  assert.deepEqual(next.headers,['Zero','Two'])
  assert.deepEqual(next.rows[0].cells,['','b'])
  assert.deepEqual(next.cellStyles,{'r:1':{underline:true}})
})
test('authored row and column reordering, column duplication retain IDs, data and styles',()=>{
 const source=authored()
 source.rows.push({id:'r2',cells:{a:{input:'three',value:'three'},b:{input:'four',value:'four'}}})
 const moved=run(source,{type:'moveRow',row:0,to:1})
 assert.deepEqual(moved.rows.map(row=>row.id),['r2','r1'])
 const copied=run(moved,{type:'duplicateColumn',column:1})
 assert.deepEqual(copied.columns.map(col=>col.label),['A','B','B COPY'])
 assert.equal(copied.rows[1].cells[copied.columns[2].id].input,'two')
 assert.equal(copied.cellStyles['r1:2'].bold,true)
 const arranged=run(copied,{type:'moveColumn',column:2,to:0})
 assert.equal(arranged.columns[0].label,'B COPY')
 assert.equal(arranged.rows[1].cells[arranged.columns[0].id].input,'two')
 assert.equal(arranged.cellStyles['r1:0'].bold,true)
 assert.equal(source.columns.length,2)
})
test('source-bound structure rejects row moves, source column copies and column moves',()=>{
 const source=bound()
 source.rows.push({id:'manual',cells:{pom:{input:'',value:'',origin:'authored'},extra:{input:'x',value:'x',origin:'authored'}}})
 for(const command of [
   {type:'moveRow',row:0,to:1},
   {type:'moveRow',row:1,to:0},
   {type:'duplicateColumn',column:0},
   {type:'moveColumn',column:0,to:1},
   {type:'moveColumn',column:1,to:0}
 ])assert.throws(()=>run(source,command),/source-bound/)
 assert.equal(source.rows[0].cells.pom.sourceRef,'pom:chest')
})
