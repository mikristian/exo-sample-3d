import test from 'node:test'
import assert from 'node:assert/strict'
import {unzipSync,strFromU8} from 'fflate'
import {exportTechPackXlsx,importTechPackXlsx} from './exporterXlsx.js'
import {renderTechPackSpreadsheetTable} from './printProjection.js'

const table=()=>({id:'linked',columns:[{id:'a',label:'ITEM'},{id:'b',label:'M'},{id:'c',label:'L'}],rows:[
 {id:'heading',cells:{a:{input:'GARMENT MEASUREMENTS',origin:'authored'},b:'',c:''}},
 {id:'chest',sourceRef:'pom:chest',cells:{a:{input:'Chest',origin:'native',sourceRef:'pom:chest'},b:{input:54,origin:'native'},c:{input:57,origin:'native'}}},
 {id:'waist',cells:{a:{input:'Waist',origin:'authored'},b:'',c:''}}
],mergedCells:[{r:0,c:0,rowSpan:1,colSpan:3},{r:2,c:1,rowSpan:1,colSpan:2}],cellStyles:{'heading:0':{bold:true,align:'center',background:'#ddddee'},'chest:1':{bold:true}}})

test('merged headings print as one styled cell, with covered cells suppressed',()=>{
 const html=renderTechPackSpreadsheetTable(table())
 assert.match(html,/<td colspan="3" style="font-weight:800;text-align:center;background:#ddddee">GARMENT MEASUREMENTS<\/td>/)
 assert.match(html,/<td colspan="2"><\/td>/)
 assert.equal((html.match(/GARMENT MEASUREMENTS/g)||[]).length,1)
 assert.match(html,/>Chest<\/td>/)
})

test('Excel merges and styles survive roundtrip, with source-linked values preserved',()=>{
 const input=table(),bytes=exportTechPackXlsx([input])
 const files=unzipSync(bytes),xml=strFromU8(files['xl/worksheets/sheet1.xml'])
 assert.match(xml,/<mergeCells count="2"><mergeCell ref="A2:C2"\/><mergeCell ref="B4:C4"\/><\/mergeCells>/)
 assert.match(xml,/<c r="A2" s="[1-9]\d*" t="inlineStr">/)
 const loaded=importTechPackXlsx(bytes)[0]
 assert.deepEqual(loaded.mergedCells,input.mergedCells)
 assert.equal(loaded.rows[1].cells[0],'Chest')
 assert.equal(loaded.rows[1].cells[1],54)
 assert.equal(loaded.cellStyles['0:0'].background,'#ddddee')
 assert.deepEqual(importTechPackXlsx(exportTechPackXlsx([loaded]))[0].mergedCells,input.mergedCells)
 assert.equal(input.rows[1].cells.a.sourceRef,'pom:chest')
})

test('reject overlapping, out-of-bounds or populated covered merge ranges',()=>{
 const populated=table();populated.mergedCells=[{r:1,c:0,rowSpan:1,colSpan:2}]
 assert.throws(()=>exportTechPackXlsx([populated]),/Covered spreadsheet merged cell/)
 assert.throws(()=>renderTechPackSpreadsheetTable(populated),/Covered spreadsheet merged cell/)
 const overlapping=table();overlapping.mergedCells.push({r:0,c:1,rowSpan:2,colSpan:1})
 assert.throws(()=>exportTechPackXlsx([overlapping]),/Overlapping/)
 const outside=table();outside.mergedCells=[{r:3,c:0,rowSpan:1,colSpan:2}]
 assert.throws(()=>exportTechPackXlsx([outside]),/Invalid spreadsheet merged/)
})
