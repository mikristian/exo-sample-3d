import test from 'node:test'
import assert from 'node:assert/strict'
import {createFramedHeaderTable} from '../techPackMinimalFrame20261031.js'
import {gridcraftTableCommand} from './gridcraftTableCommands20261030.js'
import {renderTechPackSpreadsheetTable} from './printProjection.js'
test('character properties and taller shorter row heights survive printable table projection',()=>{
 const base=createFramedHeaderTable({draft:{brand:'TEST LABEL'}})
 const font=gridcraftTableCommand(base,{type:'formatCell',row:1,column:1,
  style:{fontFamily:'Georgia',fontSize:18,lineHeight:1.4,letterSpacing:1.2,bold:true}})
 const tall=gridcraftTableCommand(font,{type:'setRowHeight',row:1,height:54})
 const short=gridcraftTableCommand(tall,{type:'setRowHeight',row:0,height:22})
 const html=renderTechPackSpreadsheetTable(short,{showTitle:false})
 assert.match(html,/height:54px/)
 assert.match(html,/height:22px/)
 assert.match(html,/font-family:'Georgia'/)
 assert.match(html,/font-size:18px/)
 assert.match(html,/letter-spacing:1.2px/)
 assert.match(html,/line-height:1.4/)
 assert.match(html,/TEST LABEL/)
 assert.equal(base.rows[1].height,undefined)
})
test('print projection does not interpolate unknown font names as styles',()=>{
 const table=createFramedHeaderTable()
 table.cellStyles[table.rows[0].id+':0'].fontFamily='Bad; font:99px'
 const html=renderTechPackSpreadsheetTable(table,{showTitle:false})
 assert.doesNotMatch(html,/Bad; font:99px/)
})
