import {test} from 'node:test'
import assert from 'node:assert/strict'
import {gridcraftTableCommand} from './gridcraftTableCommands20261030.js'

const source=()=>({
  sourceRevision:7,
  columns:[{id:'pom',label:'POM',width:150,sourceRef:'spec:pom'}],
  rows:[{id:'chest',sourceRef:'spec:chest',cells:{pom:{input:'48',value:'48',origin:'native',sourceRef:'spec:chest',provenance:{kind:'source',revision:7}}}}],
  cellStyles:{'chest:0':{bold:true}},
  mergedCells:[]
})

test('character typography persists on canonical source cells without modifying provenance or values',()=>{
  const original=source()
  const style={fontFamily:'Times New Roman',fontSize:18,letterSpacing:-1.25,lineHeight:1.4}
  const next=gridcraftTableCommand(original,{type:'formatCell',row:0,column:0,style})
  assert.deepEqual(next.cellStyles['chest:0'],{bold:true,...style})
  assert.deepEqual(next.rows[0].cells.pom,original.rows[0].cells.pom)
  assert.equal(next.rows[0].sourceRef,'spec:chest')
  assert.equal(next.sourceRevision,7)
  assert.deepEqual(original.cellStyles,{'chest:0':{bold:true}})
})

test('accepts exact font allowlist and numeric boundaries',()=>{
  for(const fontFamily of ['Arial','Helvetica','Georgia','Times New Roman','Courier New','Verdana','Trebuchet MS','Impact']){
    assert.equal(gridcraftTableCommand(source(),{type:'formatCell',row:0,column:0,style:{fontFamily}}).cellStyles['chest:0'].fontFamily,fontFamily)
  }
  for(const [field,values] of Object.entries({fontSize:[6,72],letterSpacing:[-3,10],lineHeight:[0.8,2.5]})){
    for(const value of values)assert.equal(gridcraftTableCommand(source(),{type:'formatCell',row:0,column:0,style:{[field]:value}}).cellStyles['chest:0'][field],value)
  }
})

test('rejects unapproved fonts, nonnumeric values and out-of-range typography atomically',()=>{
  const original=source()
  for(const bad of [
    {fontFamily:'Comic Sans MS'}, {fontFamily:'arial'}, {fontFamily:'Arial; color:red'}, {fontFamily:''},
    {fontSize:5.99},{fontSize:72.01},{fontSize:'12'},{fontSize:NaN},{fontSize:Infinity},
    {letterSpacing:-3.01},{letterSpacing:10.01},{letterSpacing:'0'},
    {lineHeight:0.79},{lineHeight:2.51},{lineHeight:null}
  ])assert.throws(()=>gridcraftTableCommand(original,{type:'formatCell',row:0,column:0,style:{bold:false,...bad}}),RangeError)
  assert.deepEqual(original.cellStyles,{'chest:0':{bold:true}})
  assert.equal(original.rows[0].cells.pom.origin,'native')
})
