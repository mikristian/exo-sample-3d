import test from 'node:test'
import assert from 'node:assert/strict'
import {createCustomTechPackTable,createCustomTechPackTableFromPreset,applyCustomTechPackTableTheme,CUSTOM_TABLE_PRESETS} from './customTableDesign20261030.js'
import {toGridTable,fromGridTable} from './tableAdapter.js'
import {validateTableV3} from './validation.js'

test('four design presets produce independent editable canonical authored tables',()=>{
  for(const preset of Object.keys(CUSTOM_TABLE_PRESETS)){
    const a=createCustomTechPackTableFromPreset(preset)
    const b=createCustomTechPackTableFromPreset(preset)
    assert.equal(validateTableV3(a).valid,true,preset)
    assert.equal(a.columns.length,CUSTOM_TABLE_PRESETS[preset].headings.length)
    assert.equal(a.rows.length,CUSTOM_TABLE_PRESETS[preset].rows)
    assert(a.rows.every(row=>!('sourceRef' in row)&&Object.values(row.cells).every(cell=>cell.value===''&&cell.origin==='authored'&&cell.provenance.kind==='authored'&&!('sourceRef' in cell))))
    a.rows[0].cells[a.columns[0].id].input='Edited'
    assert.equal(b.rows[0].cells[b.columns[0].id].input,'')
  }
})

test('50 columns and 100 rows roundtrip through table adapter',()=>{
  const table=createCustomTechPackTable({name:'Production sheet',columns:50,rows:100,headings:['Factory heading'],theme:{theme:'custom',header:'#172b4d',stripe:'#eaeaea',text:'#ffffff'}})
  assert.equal(table.columns[0].label,'Factory heading')
  assert.equal(table.columns[49].label,'Column 50')
  assert.equal(table.tableStyle.header,'#172b4d')
  const grid=toGridTable(table)
  grid.rows[99].cells[49]='Factory note'
  assert.equal(fromGridTable(table,grid).rows[99].cells['column-49'].value,'Factory note')
  assert.equal(validateTableV3(fromGridTable(table,grid)).valid,true)
})

test('invalid limits and theme values rejected',()=>{
  for(const options of [{rows:0},{rows:101},{columns:0},{columns:51},{columns:2.5},{headings:Array(51).fill('X')}])assert.throws(()=>createCustomTechPackTable(options),RangeError)
  assert.throws(()=>createCustomTechPackTable({theme:{theme:'custom',header:'red'}}),TypeError)
  assert.throws(()=>createCustomTechPackTable({preset:'nonexistent'}),/Unknown table preset/)
})

test('external templates copy headings but discard source values and references',()=>{
  const template={headings:['Size','Qty'],rows:2,sourceRefs:['pattern:1'],cells:[{value:'sensitive'}]}
  const result=createCustomTechPackTable({template})
  template.headings[0]='Changed'
  assert.equal(result.columns[0].label,'Size')
  assert.equal(result.rows[0].cells['column-0'].value,'')
  assert.equal(JSON.stringify(result).includes('pattern:1'),false)
  assert.equal(JSON.stringify(result).includes('sensitive'),false)
  const styled=applyCustomTechPackTableTheme(result,'dark')
  assert.equal(styled.tableStyle.theme,'dark')
  assert.notEqual(styled,result)
})
