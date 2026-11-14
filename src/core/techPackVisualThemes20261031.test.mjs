import test from 'node:test'
import assert from 'node:assert/strict'
import {createFramedHeaderBox} from './techPackMinimalFrame20261031.js'
import {FRAMED_HEADER_PRESETS,restyleFramedHeader,applyFramedHeaderPreset,applyTechPackColorTheme,applyTechPackPaletteOverrides,TECHPACK_STUDIO_PALETTES,TECHPACK_PRINT_PALETTES,resolveTechPackPalette} from './techPackVisualThemes20261031.js'
test('print palettes provide paper, header, table and panel surfaces for light and dark artboards',()=>{
 assert.ok(TECHPACK_PRINT_PALETTES.some(p=>p.category==='Dark'))
 assert.ok(TECHPACK_PRINT_PALETTES.some(p=>p.category==='Light'))
 for(const palette of TECHPACK_PRINT_PALETTES){
  assert.equal(resolveTechPackPalette(palette.id),palette)
  for(const field of ['background','header','table','body','line','accent'])assert.match(palette[field],/^#[0-9a-f]{6}$/i)
 }
 const box=createFramedHeaderBox('a')
 const original={pages:{a:{}},pageBoxes:{a:[box]}}
 const dark=TECHPACK_PRINT_PALETTES.find(p=>p.id==='paper-navy')
 const colors=Object.fromEntries(['background','header','table','body','line','accent'].map(k=>[k,dark[k]]))
 const changed=applyTechPackPaletteOverrides(original,colors,{pageId:'a',paletteId:dark.id})
 assert.equal(changed.pages.a.templateColors.background,dark.background)
 assert.equal(changed.pages.a.templateTheme,dark.id)
 const again=applyTechPackPaletteOverrides(changed,{table:'#efefef',header:'#fafafa',body:'#dadada'},{pageId:'a'})
 const table=again.pageBoxes.a[0].slot.spreadsheetTable
 assert.equal(table.cellStyles[`${table.rows[0].id}:1`].background,'#efefef')
 assert.equal(table.cellStyles[`${table.rows[2].id}:1`].background,'#fafafa')
})
test('EXO Studio palettes can be resolved into printable tech pack palette fields',()=>{
 assert.ok(TECHPACK_STUDIO_PALETTES.length>80)
 const palette=resolveTechPackPalette('studio:graphite')
 assert.match(palette.background,/^#[0-9a-f]{6}$/i)
 assert.equal(palette.id,'studio:graphite')
 assert.equal(palette.background,'#ffffff')
 assert.equal(resolveTechPackPalette('studio:pure-white-light').background,'#ffffff')
 assert.equal(resolveTechPackPalette('studio:cream-light').background,'#fffef7')
 assert.throws(()=>resolveTechPackPalette('studio:does-not-exist'),/Unknown/)
})
test('independent page colors preserve manually edited cells and unrelated page content',()=>{
 const a=createFramedHeaderBox('a')
 const b=createFramedHeaderBox('b')
 const original=a.slot.spreadsheetTable
 const row=original.rows[0].id
 const custom={...original,cellStyles:{...original.cellStyles,[`${row}:0`]:{background:'#123456',fontSize:17}}}
 const source={pages:{a:{},b:{}},pageBoxes:{a:[{...a,slot:{...a.slot,spreadsheetTable:custom}}],b:[b]},templateColors:{background:'#ffffff'}}
 const changed=applyTechPackPaletteOverrides(source,{background:'#eeeedd',header:'#222222',table:'#dadada',line:'#454545'},{pageId:'a'})
 assert.equal(changed.pages.a.templateColors.background,'#eeeedd')
 assert.equal(changed.pageBoxes.a[0].slot.spreadsheetTable.cellStyles[`${row}:0`].background,'#123456')
 assert.equal(changed.pageBoxes.a[0].slot.spreadsheetTable.cellStyles[`${row}:0`].fontSize,17)
 const headerTable=changed.pageBoxes.a[0].slot.spreadsheetTable
 const bandRow=headerTable.rows[2].id
 assert.equal(headerTable.cellStyles[`${bandRow}:0`].background,'#222222')
 assert.equal(headerTable.cellStyles[`${row}:1`].background,'#dadada')
 assert.equal(changed.pageBoxes.b[0],b)
 assert.deepEqual(changed.pageBoxes.a[0].slot.spreadsheetTable.rows,original.rows)
 assert.equal(source.pages.a.templateColors,undefined)
 const round=applyTechPackPaletteOverrides(changed,{header:'#444444'},{pageId:'a'})
 assert.equal(round.pages.a.templateColors.table,'#dadada')
 assert.equal(round.pageBoxes.a[0].slot.spreadsheetTable.cellStyles[`${row}:0`].background,'#123456')
 assert.throws(()=>applyTechPackPaletteOverrides(source,{body:'red'},{pageId:'a'}),/Invalid/)
})
test('sixteen structurally varied editable headers keep canonical values and safe merge geometry',()=>{
 const table=createFramedHeaderBox('custom-a',{draft:{brand:'Mikristian'}}).slot.spreadsheetTable
 assert.equal(FRAMED_HEADER_PRESETS.length,16)
 const geometry=new Set()
 for(const theme of FRAMED_HEADER_PRESETS){
  const styled=restyleFramedHeader(table,theme.id)
  assert.deepEqual(styled.rows.map(r=>r.cells),table.rows.map(r=>r.cells))
  geometry.add(JSON.stringify({merges:styled.mergedCells,heights:styled.rows.map(r=>r.height)}))
  assert.ok(styled.mergedCells.every(m=>m.r===2||m.r===1&&m.c===3))
  assert.equal(styled.tableStyle.header,theme.header)
  assert.equal(styled.columns.length,10)
 }
 assert.ok(geometry.size>=12)
 assert.throws(()=>restyleFramedHeader(table,'other'),/Unknown/)
})
test('page color theme restyles rendered tables without changing entered values or linked metadata',()=>{
 const box=createFramedHeaderBox('custom-a',{draft:{brand:'Label'}})
 const workspace={pageBoxes:{'custom-a':[box]}}
 const changed=applyTechPackColorTheme(workspace,'blueprint',{pageId:'custom-a',scope:'page'})
 const next=changed.pageBoxes['custom-a'][0].slot.spreadsheetTable
 assert.equal(next.rows[1].cells[next.columns[1].id].input,'Label')
 assert.equal(next.tableStyle.header,'#17476b')
 assert.equal(changed.pages['custom-a'].templateColors.line,'#356883')
 assert.equal(workspace.pageBoxes['custom-a'][0],box)
 assert.equal(changed.pageBoxes['custom-a'][0].background,'#e9f2f6')
 assert.equal(next.cellStyles[`${next.rows[0].id}:0`].background,'#e9f2f6')
 assert.equal(changed.pages['custom-a'].templateTheme,'blueprint')
 assert.equal(changed.templateColors,undefined)
 const styled=applyFramedHeaderPreset(changed,'custom-a','graphite-reverse')
 assert.equal(styled.pageBoxes['custom-a'][0].slot.spreadsheetTable.tableStyle.header,'#252a2e')
})
test('global theme recolors all pages and tables but preserves provenance and values',()=>{
 const a=createFramedHeaderBox('a',{draft:{brand:'Studio A'}})
 const b=createFramedHeaderBox('b',{draft:{brand:'Studio B'}})
 const workspace={pages:{a:{},b:{}},pageBoxes:{a:[a],b:[b]},templateTheme:'mono'}
 const output=applyTechPackColorTheme(workspace,'clay')
 assert.equal(output.templateTheme,'clay')
 assert.equal(output.pages.b.templateColors.wash,'#faf0e8')
 assert.equal(output.pageBoxes.b[0].slot.spreadsheetTable.rows[1].cells[b.slot.spreadsheetTable.columns[1].id].input,'Studio B')
 assert.equal(output.pageBoxes.a[0].slot.spreadsheetTable.pageId,'a')
 assert.equal(output.pageBoxes.a[0].slot.spreadsheetTable.tableStyle.body,'#faf0e8')
 assert.equal(workspace.pageBoxes.b[0],b)
})
test('header box grows within safe page boundary and respects manual height edits',()=>{
 const original=createFramedHeaderBox('a')
 const workspace={pageBoxes:{a:[original]}}
 const tall=applyFramedHeaderPreset(workspace,'a','runway-ledger').pageBoxes.a[0]
 assert.equal(tall.height,93)
 assert.equal(tall.y+tall.height,127)
 assert.equal(tall.autoFramedHeaderHeight,93)
 const compact=applyFramedHeaderPreset({pageBoxes:{a:[tall]}},'a','factory-dense').pageBoxes.a[0]
 assert.equal(compact.height,72)
 const resized={...tall,height:88}
 const preserved=applyFramedHeaderPreset({pageBoxes:{a:[resized]}},'a','clay-notebook').pageBoxes.a[0]
 assert.equal(preserved.height,88)
 assert.equal(preserved.autoFramedHeaderHeight,93)
 const moved={...original,y:55}
 assert.equal(applyFramedHeaderPreset({pageBoxes:{a:[moved]}},'a','runway-ledger').pageBoxes.a[0].height,72)
 assert.equal(original.height,72)
})
