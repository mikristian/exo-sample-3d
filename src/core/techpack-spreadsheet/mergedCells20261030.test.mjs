import test from 'node:test'
import assert from 'node:assert/strict'
import {mergeLookup,normalizedMergedCells} from './mergedCells20261030.js'
import {gridcraftTableCommand} from './gridcraftTableCommands20261030.js'
const grid=()=>({headers:['A','B','C','D'],rows:[
  {id:'r1',cells:['STYLE DETAILS','','','']},{id:'r2',cells:['POM','DIM','TOL','NOTES']},
  {id:'r3',cells:['','','','']}],tableStyle:{theme:'technical'}})
test('rectangular heading merge retains top-left text and source-free cells',()=>{
 const source=grid(),next=gridcraftTableCommand(source,{type:'mergeCells',range:{r:0,c:0,r2:0,c2:3}})
 assert.deepEqual(next.mergedCells,[{r:0,c:0,rowSpan:1,colSpan:4}])
 assert.equal(next.rows[0].cells[0],'STYLE DETAILS')
 assert.equal(next.rows[0].cells[3],'')
 assert.equal(mergeLookup(next).covered.get('0:2').c,0)
 assert.deepEqual(source.mergedCells,undefined)
})
test('rejects data loss, overlap and malformed spans',()=>{
 const input=grid()
 assert.throws(()=>gridcraftTableCommand(input,{type:'mergeCells',range:{r:1,c:0,r2:1,c2:2}}),/EMPTY/)
 assert.throws(()=>normalizedMergedCells({...input,mergedCells:[{r:0,c:3,rowSpan:1,colSpan:2}]}),/BOUNDS/)
 const next=gridcraftTableCommand(input,{type:'mergeCells',range:{r:0,c:0,r2:0,c2:3}})
 assert.throws(()=>gridcraftTableCommand(next,{type:'mergeCells',range:{r:0,c:1,r2:2,c2:1}}),/UNMERGE/)
 assert.deepEqual(gridcraftTableCommand(next,{type:'unmergeCells',row:0,column:2}).mergedCells,[])
})
test('insert rows and columns shifts merge spans; destructive reordering fails closed',()=>{
 let source=gridcraftTableCommand(grid(),{type:'mergeCells',range:{r:0,c:0,r2:0,c2:2}})
 source=gridcraftTableCommand(source,{type:'insertRow',at:0})
 assert.deepEqual(source.mergedCells,[{r:1,c:0,rowSpan:1,colSpan:3}])
 source=gridcraftTableCommand(source,{type:'insertColumn',at:1})
 assert.deepEqual(source.mergedCells,[{r:1,c:0,rowSpan:1,colSpan:4}])
 assert.throws(()=>gridcraftTableCommand(source,{type:'moveColumn',column:0,to:1}),/UNMERGE/)
 assert.throws(()=>gridcraftTableCommand(source,{type:'deleteRow',row:1}),/UNMERGE/)
})
test('one-click merged section heading inserts a real editable row above existing content',()=>{
 const before=grid()
 const next=gridcraftTableCommand(before,{type:'addMergedHeading',label:'SIZE SPECIFICATIONS'})
 assert.equal(next.rows[0].cells[0],'SIZE SPECIFICATIONS')
 assert.deepEqual(next.mergedCells,[{r:0,c:0,rowSpan:1,colSpan:4}])
 assert.equal(next.rows[1].cells[0],'STYLE DETAILS')
 assert.deepEqual(next.cellStyles[next.rows[0].id+':0'],{bold:true,align:'center'})
 assert.deepEqual(before.rows[0].cells,['STYLE DETAILS','','',''])
})
test('source linked cells must not be merged, even if their visible value is blank',()=>{
 const input={columns:[{id:'a',label:'A'},{id:'b',label:'B'}],
  rows:[{id:'native',sourceRef:'pom:test',cells:{
    a:{input:'POM',origin:'native',sourceRef:'pom:test'},
    b:{input:'',origin:'authored'}}}]}
 assert.throws(()=>gridcraftTableCommand(input,{type:'mergeCells',range:{r:0,c:0,r2:0,c2:1}}),/SOURCE_LINKED/)
})
test('expandGrid creates real additional editable cells without moving existing merge or data',()=>{
 const source=gridcraftTableCommand(grid(),{type:'mergeCells',range:{r:0,c:0,r2:0,c2:3}})
 const expanded=gridcraftTableCommand(source,{type:'expandGrid',rows:12,columns:8})
 assert.equal(expanded.rows.length,12)
 assert.equal(expanded.headers.length,8)
 assert.deepEqual(expanded.mergedCells,source.mergedCells)
 assert.equal(expanded.rows[0].cells[0],'STYLE DETAILS')
 assert.equal(expanded.rows[11].cells.length,8)
 assert.throws(()=>gridcraftTableCommand(source,{type:'expandGrid',rows:101,columns:8}),/INVALID/)
})
