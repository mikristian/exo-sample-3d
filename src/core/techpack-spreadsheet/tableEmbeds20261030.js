import {normalizeTableStyle} from './tableAdapter.js'
import {normalizedMergedCells} from './mergedCells20261030.js'

const MAX_ROWS=100, MAX_COLUMNS=50, MAX_TEXT=10000
const string=(value,max=MAX_TEXT)=>String(value??'').slice(0,max)
const sourceMarked=value=>Boolean(value&&(value.sourceRef!=null||value.sourceRefs!=null||value.sourceLinked===true||value.linked===true||value.override===true||value.origin==='native'||value.origin==='source'||value.provenance?.linked===true||['source','override','native'].includes(value.provenance?.kind)))
const authoredCell=(cell,row,column,table)=>{
  if(sourceMarked(cell)||sourceMarked(row)||sourceMarked(column)||sourceMarked(table))return ''
  if(cell&&typeof cell==='object')return string(cell.input??cell.value)
  return string(cell)
}
const safeCellStyles=(styles,rows,columns)=>{
  const result={}
  if(!styles||typeof styles!=='object'||Array.isArray(styles))return result
  for(const [key,style] of Object.entries(styles)){
    const match=/^(.*):(\d+)$/.exec(key)
    if(!match||Number(match[2])>=columns||!style||typeof style!=='object')continue
    const row=rows.findIndex((item,i)=>String(i)===match[1]||String(item.id)===match[1])
    if(row<0)continue
    const safe={}
    for(const field of ['background','color','fontWeight','textAlign','verticalAlign','borderColor','align']){
      if(typeof style[field]==='string'&&style[field].length<=80)safe[field]=style[field]
    }
    for(const field of ['bold','italic','underline'])if(typeof style[field]==='boolean')safe[field]=style[field]
    if(Object.keys(safe).length)result[`row-${row}:${match[2]}`]=safe
  }
  return result
}
const validate=table=>{
  if(!table||!Array.isArray(table.columns)||!Array.isArray(table.rows))throw new TypeError('Canonical spreadsheet table required')
  if(table.columns.length<1||table.columns.length>MAX_COLUMNS||table.rows.length>MAX_ROWS)throw new RangeError('Table exceeds template limits (50 columns, 100 rows)')
  if(table.rows.some(row=>!row||!row.cells||typeof row.cells!=='object'))throw new TypeError('Invalid table row')
}

/** Remap a verified gallery-owned heading snapshot through new row identities.
 * This keeps a header restylable after Save → Place, without copying untrusted
 * row metadata or silently erasing user-edited heading cells. */
const safeHeadingMetadata=(before,rows,styles,merges)=>{
  const id=String(before.headerPreset||'')
  if(!/^(title-band|section-band|dark-banner|light-banner|accent-band|minimal|compact|double-heading)$/.test(id))return {}
  const result={headerPreset:id}
  const snapshot=before.headerPresetSnapshot
  if(!snapshot||!Array.isArray(snapshot.rowIds)||!Array.isArray(snapshot.rows))return result
  const count=snapshot.rowIds.length
  if(count>2||count>rows.length||count>before.rows.length)return result
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
  for(let i=0;i<count;i++){
    const oldRow=before.rows[i]
    if(String(oldRow?.id)!==String(snapshot.rowIds[i])||!same(oldRow,snapshot.rows[i])||
       !same(before.cellStyles?.[oldRow.id+':0'],snapshot.styles?.[oldRow.id]))return result
  }
  const originalMerges=(before.mergedCells||[]).filter(merge=>merge.r<count)
  if(!same(originalMerges,snapshot.merges||[]))return result
  const nextHeadRows=rows.slice(0,count)
  result.headerPresetSnapshot={
    rowIds:nextHeadRows.map(row=>row.id),
    rows:JSON.parse(JSON.stringify(nextHeadRows)),
    styles:Object.fromEntries(nextHeadRows.map(row=>[row.id,styles?.[row.id+':0']])),
    merges:merges.filter(merge=>merge.r<count).map(merge=>({...merge}))
  }
  return result
}

/** Explicit snapshot of presentation and genuinely authored values. No source identity survives. */
export function saveAuthoredTableTemplate(table,{id,name}={}){
  validate(table)
  const columns=table.columns.map((column,i)=>({id:`col-${i}`,label:string(column.label,80),type:['text','number','integer','boolean','date','formula'].includes(column.type)?column.type:'text',width:Number.isFinite(column.width)?Math.max(40,Math.min(800,column.width)):160}))
  const rows=table.rows.map((row,r)=>({id:`row-${r}`,cells:Object.fromEntries(table.columns.map((column,c)=>[columns[c].id,{input:authoredCell(row.cells[column.id],row,column,table),value:authoredCell(row.cells[column.id],row,column,table),origin:'authored',provenance:{kind:'authored'}}])),provenance:{kind:'authored'}}))
  const mergedCells=normalizedMergedCells(table)
  for(const m of mergedCells)for(let r=m.r;r<m.r+m.rowSpan;r++)for(let c=m.c;c<m.c+m.colSpan;c++){
    if(r===m.r&&c===m.c)continue
    if(rows[r].cells[columns[c].id].input!=='')
      throw new RangeError('Library copy contains nonempty covered merged cells')
  }
  const cellStyles=safeCellStyles(table.cellStyles,table.rows,columns.length)
  return {version:3,id:string(id||'table-template',120),name:string(name??table.name??table.title??'Custom table',80),title:string(name??table.name??table.title??'Custom table',80),origin:'authored',sourceLinked:false,columns,rows,mergedCells,tableStyle:normalizeTableStyle(table.tableStyle),cellStyles,
    ...safeHeadingMetadata(table,rows,cellStyles,mergedCells)}
}

/** New document instance: row, column and table identities are distinct from the library snapshot. */
export function instantiateAuthoredTableTemplate(template,{pageId,boxId}={}){
  validate(template)
  if(!pageId||!boxId)throw new TypeError('pageId and boxId required')
  const sanitized=saveAuthoredTableTemplate(template,{id:template.id,name:template.name??template.title})
  const suffix=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`
  const columns=sanitized.columns.map((column,i)=>({...column,id:`column-${suffix}-${i}`,provenance:{kind:'authored'}}))
  const rows=sanitized.rows.map((row,r)=>({id:`row-${suffix}-${r}`,provenance:{kind:'authored'},cells:Object.fromEntries(columns.map((column,c)=>[column.id,{...row.cells[sanitized.columns[c].id],provenance:{kind:'authored'}}]))}))
  const cellStyles=Object.fromEntries(Object.entries(sanitized.cellStyles).map(([key,value])=>[key.replace(/^row-(\d+):/,(_,n)=>`row-${suffix}-${n}:`),value]))
  return {version:3,id:`table-${suffix}`,title:sanitized.name,name:sanitized.name,pageId:String(pageId),boxId:String(boxId),origin:'authored',sourceLinked:false,sourceKind:'manual',columns,rows,mergedCells:sanitized.mergedCells.map(m=>({...m})),tableStyle:sanitized.tableStyle,cellStyles,
    ...safeHeadingMetadata(sanitized,rows,cellStyles,sanitized.mergedCells)}
}

/** Artboard boxes and vectors have independent lock flags; support both. */
export function isTechPackTableLocked(workspace,pageId,boxId){
  const id=String(boxId??'').replace(/^box-/,'')
  const box=(workspace?.pageBoxes?.[pageId]||[]).find(item=>String(item.id)===id)
  return Boolean(box?.locked||box?.slot?.locked||workspace?.boardObjects?.[pageId]?.[`box-${id}`]?.locked)
}
