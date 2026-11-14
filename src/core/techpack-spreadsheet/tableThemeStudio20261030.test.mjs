import test from 'node:test'
import assert from 'node:assert/strict'
import {strFromU8,unzipSync} from 'fflate'
import {TABLE_THEMES,normalizeTableStyle} from './tableAdapter.js'
import {gridcraftTableCommand} from './gridcraftTableCommands20261030.js'
import {renderTechPackSpreadsheetTable} from './printProjection.js'
import {exportTechPackXlsx} from './exporterXlsx.js'
import {createCustomTechPackTable} from './customTableDesign20261030.js'

test('eight visual table themes appear in design gallery and preserve authored cells',()=>{
 const source=createCustomTechPackTable({name:'Garment build',preset:'bom',theme:'light'})
 assert.equal(Object.keys(TABLE_THEMES).length,8)
 for(const theme of Object.keys(TABLE_THEMES)){
   const next=gridcraftTableCommand(source,{type:'setTheme',theme})
   assert.equal(next.tableStyle.theme,theme)
   assert.deepEqual(next.rows,source.rows)
   const html=renderTechPackSpreadsheetTable(next)
   assert.match(html,new RegExp('--exo-table-header:'+TABLE_THEMES[theme].header,'i'))
   assert.match(html,new RegExp('--exo-table-border:'+TABLE_THEMES[theme].border,'i'))
   assert.match(html,new RegExp('--exo-table-body:'+TABLE_THEMES[theme].body,'i'))
 }
})

test('switching theme clears prior custom colors rather than disguising preset selection',()=>{
 const source=createCustomTechPackTable()
 const custom=gridcraftTableCommand(source,{type:'setTableStyle',style:{
   theme:'custom',header:'#010203',stripe:'#040506',body:'#070809',bodyText:'#111213',
   border:'#141516',text:'#ffffff',headerAlign:'center',headerCase:'uppercase'}})
 const print=renderTechPackSpreadsheetTable(custom)
 assert.match(print,/--exo-table-body:#070809/)
 assert.match(print,/--exo-table-head-align:center/)
 assert.match(print,/--exo-table-head-case:uppercase/)
 const changed=gridcraftTableCommand(custom,{type:'setTheme',theme:'sage'})
 assert.equal(changed.tableStyle.header,undefined)
 assert.equal(changed.tableStyle.body,undefined)
 assert.equal(changed.tableStyle.headerAlign,undefined)
 assert.match(renderTechPackSpreadsheetTable(changed),/--exo-table-header:#42675b/)
 assert.deepEqual(source.rows,custom.rows)
})

test('XLSX styles include chosen theme header, stripe and main-body fill',()=>{
 const table=createCustomTechPackTable({rows:2,columns:2,theme:'amber'})
 const zip=unzipSync(exportTechPackXlsx([table]))
 const xml=strFromU8(zip['xl/styles.xml'])
 assert.match(xml,/FFBD6C30/i)
 assert.match(xml,/FFFFF0E3/i)
 assert.match(xml,/FFFFFAF5/i)
 assert.equal(normalizeTableStyle({theme:'other'}).theme,'light')
})
