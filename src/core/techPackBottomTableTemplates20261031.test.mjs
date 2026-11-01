import test from 'node:test'
import assert from 'node:assert/strict'
import {BOTTOM_TABLE_PRESETS,createFramedBottomTableBox} from './techPackBottomTableTemplates20261031.js'
import {boxTableRowCapacity} from './techpack-spreadsheet/pagination.js'

test('compact picker provides sizing, POM, grading, trims, fabrics, BOM and a blank table',()=>{
 for(const id of ['blank','size-chart','measurement-matrix','pom-spec','grading','bom','fabric-spec','trim-labels'])
  assert.ok(BOTTOM_TABLE_PRESETS.includes(id),id)
 assert.equal(new Set(BOTTOM_TABLE_PRESETS).size,BOTTOM_TABLE_PRESETS.length)
})
test('each preset embeds only the authored grid inside page frame without invented measurement values',()=>{
 for(const id of BOTTOM_TABLE_PRESETS){
  const box=createFramedBottomTableBox(id,'custom-clean-start','bottom-'+id)
  const table=box.slot.spreadsheetTable
  assert.equal(box.slot.templateRole,'bottom-table')
  assert.equal(box.slot.sourceLinked,false)
  assert.equal(table.origin,'authored')
  assert.equal(table.rows.length>0,true)
  assert.equal(box.x,26)
  assert.equal(box.width,560)
  assert.ok(box.y>=500&&box.y+box.height===740)
  assert.ok(boxTableRowCapacity(box.height,{tableOnly:true})>=table.rows.length, id)
  for(const row of table.rows)for(const cell of Object.values(row.cells)){
    assert.equal(cell.provenance?.kind,'authored')
    assert.equal(cell.value==null||typeof cell.value==='string',true)
  }
 }
})
test('unknown template cannot be inserted',()=>{
 assert.throws(()=>createFramedBottomTableBox('untrusted','custom-page','box'),/recognized/)
 assert.throws(()=>createFramedBottomTableBox('blank','','box'),/identity/)
})
