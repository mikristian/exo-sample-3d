// Techpack spreadsheet view/print pipeline. Escape authored values and never
// copy native provenance/approval state into HTML as trusted markup.
import {asPrintableRows,validatedTableMerges} from './exporterXlsx.js'
import {normalizeTableStyle,TABLE_THEMES} from './tableAdapter.js'
const esc=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
const validHex=value=>/^#[0-9a-f]{6}$/i.test(String(value||''))?value:null
const cellStyling=(style={})=>{
  const rules=[]
  const allowedFonts=['Arial','Helvetica','Georgia','Times New Roman','Courier New','Verdana','Trebuchet MS','Impact']
  if(allowedFonts.includes(style.fontFamily))rules.push(`font-family:'${style.fontFamily}',Arial,sans-serif`)
  if(Number.isFinite(style.fontSize)&&style.fontSize>=6&&style.fontSize<=72)rules.push(`font-size:${style.fontSize}px`)
  if(Number.isFinite(style.letterSpacing)&&style.letterSpacing>=-3&&style.letterSpacing<=10)rules.push(`letter-spacing:${style.letterSpacing}px`)
  if(Number.isFinite(style.lineHeight)&&style.lineHeight>=.8&&style.lineHeight<=2.5)rules.push(`line-height:${style.lineHeight}`)
  if(style.bold)rules.push('font-weight:800')
  if(style.italic)rules.push('font-style:italic')
  if(style.underline)rules.push('text-decoration:underline')
  if(['left','center','right'].includes(style.align))rules.push(`text-align:${style.align}`)
  const color=validHex(style.color),background=validHex(style.background)
  if(color)rules.push(`color:${color}`)
  if(background)rules.push(`background:${background}`)
  return rules.join(';')
}
export function renderTechPackSpreadsheetTable(table,{title=table?.title||table?.name||'',rowCap=10000,showTitle=true}={}){
  const {columns,rows}=asPrintableRows(table||{})
  if(columns.length>256||rows.length>10001)throw Error('Spreadsheet print exceeds supported size')
  const data=rows.slice(1,Math.max(1,rowCap)+1)
  const head=rows[0]||[]
  const merges=validatedTableMerges(table||{},rows.length-1,columns.length)
  const covered=new Set(),anchors=new Map()
  for(const merge of merges){
    if(merge.r+merge.rowSpan>data.length)continue // Never render a merge partly clipped by the print cap.
    anchors.set(`${merge.r}:${merge.c}`,merge)
    for(let r=merge.r;r<merge.r+merge.rowSpan;r++)for(let c=merge.c;c<merge.c+merge.colSpan;c++)if(r!==merge.r||c!==merge.c)covered.add(`${r}:${c}`)
  }
  const theme=normalizeTableStyle(table?.tableStyle)
  const palette=TABLE_THEMES[theme.theme==='custom'?'light':theme.theme]||TABLE_THEMES.light
  const header=validHex(theme.header)||palette.header
  const stripe=validHex(theme.stripe)||palette.stripe
  const text=validHex(theme.text)||palette.text
  const body=validHex(theme.body)||palette.body||'#ffffff'
  const bodyText=validHex(theme.bodyText)||palette.bodyText||'#273244'
  const border=validHex(theme.border)||palette.border||'#84929e'
  const align=['left','center','right'].includes(theme.headerAlign)?theme.headerAlign:'left'
  const letterCase=theme.headerCase==='uppercase'?'uppercase':'none'
  const css=`--exo-table-header:${header};--exo-table-stripe:${stripe};--exo-table-head-text:${text};--exo-table-body:${body};--exo-table-body-text:${bodyText};--exo-table-border:${border};--exo-table-head-align:${align};--exo-table-head-case:${letterCase}`
  const widths=columns.map(column=>Math.max(table?.kind==='framed-header'?24:76,Math.min(700,Number(column.width)||110)))
  const sum=widths.reduce((total,width)=>total+width,0)||1
  const cols=widths.map(width=>`<col style="width:${(100*width/sum).toFixed(3)}%"/>`).join('')
  const isFramedHeader=table?.kind==='framed-header'
  const html=`<table class="exo-spreadsheet-print${isFramedHeader?' exo-reference-header-grid':''}" data-techpack-table="${esc(table?.id||'')}" style="${css}"><colgroup>${cols}</colgroup>${isFramedHeader?'':`<thead><tr>${head.map(name=>`<th scope="col">${esc(name)}</th>`).join('')}</tr></thead>`}<tbody>${data.map((row,r)=>`<tr${Number.isFinite(table?.rows?.[r]?.height)&&table.rows[r].height>=20&&table.rows[r].height<=200?` style="height:${table.rows[r].height}px"`:''}>${head.map((_,i)=>{
    if(covered.has(`${r}:${i}`))return ''
    const merge=anchors.get(`${r}:${i}`)
    // Editor styles are keyed by stable row id; older documents may use
    // positional styles. Keep both readable during printing.
    const key=`${table?.rows?.[r]?.id??r}:${i}`
    const style=cellStyling(table?.cellStyles?.[key]??table?.cellStyles?.[`${r}:${i}`])
    return `<td${merge?.colSpan>1?` colspan="${merge.colSpan}"`:''}${merge?.rowSpan>1?` rowspan="${merge.rowSpan}"`:''}${style?` style="${style}"`:''}>${esc(row[i])}</td>`
  }).join('')}</tr>`).join('')}</tbody></table>`
  return `<section class="exo-spreadsheet-print-region">${showTitle&&title?`<h2>${esc(title)}</h2>`:''}${html}${rows.length-1>data.length?`<p class="exo-spreadsheet-print-warning">${rows.length-1-data.length} additional rows omitted; increase the print row cap before factory release.</p>`:''}</section>`
}
export function techPackSpreadsheetStyles(){return `.exo-spreadsheet-print-region{max-width:100%;min-width:0;break-inside:auto}.exo-spreadsheet-print-region h2{font:800 10px/1.3 Arial,sans-serif;letter-spacing:.06em;padding-bottom:5px}.exo-spreadsheet-print{border-collapse:collapse;width:100%;font:9px/1.35 Arial,sans-serif;table-layout:fixed;print-color-adjust:exact;-webkit-print-color-adjust:exact}.exo-spreadsheet-print th,.exo-spreadsheet-print td{border:1px solid var(--exo-table-border,#84929e);padding:5px;overflow-wrap:anywhere;text-align:left}.exo-spreadsheet-print td{background:var(--exo-table-body,#fff);color:var(--exo-table-body-text,#273244)}.exo-spreadsheet-print tbody tr:nth-child(even) td:not([style*="background"]){background:var(--exo-table-stripe,#f6f7f8)}.exo-spreadsheet-print thead{display:table-header-group}.exo-spreadsheet-print th{background:var(--exo-table-header,#e9eef2);color:var(--exo-table-head-text,#263245);text-align:var(--exo-table-head-align,left);text-transform:var(--exo-table-head-case,none);font-weight:800;print-color-adjust:exact;-webkit-print-color-adjust:exact}.exo-spreadsheet-print tr{break-inside:avoid}.exo-spreadsheet-print-warning{font-weight:800;color:#9b3e3f}`}
export function listSpreadsheetTablesFromWorkspace(workspace={},sourceTables={}){
 const byId=new Map()
 for(const table of Object.values(sourceTables||{}))if(table?.id)byId.set(table.id,table)
 const registeredIds=new Set()
 for(const table of Object.values(workspace.spreadsheetTables||{}))if(table?.id){byId.set(table.id,table);registeredIds.add(table.id)}
 for(const [pageId,boxes] of Object.entries(workspace.pageBoxes||{}))for(const box of Array.isArray(boxes)?boxes:[]){
   const t=box?.slot?.spreadsheetTable
   if(t&&Array.isArray(t.rows)){
     // The registry is a fallback for sheets without a positioned block.
     // Avoid exporting a stale registry copy alongside its saved board edit.
     if(registeredIds.has(t.id))byId.delete(t.id)
     // A source table and two independently edited, positioned sheet blocks
     // can share their source ID. Keep the boxes separately in XLSX export;
     // each block may hold a different, saved override or formatting choice.
     byId.set(`box:${pageId}:${box.id}`,t)
   }
 }
 return [...byId.values()]
}
