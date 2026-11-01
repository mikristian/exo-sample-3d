import {isCanonicalSpreadsheet,toGridTable,fromGridTable,normalizeTableStyle,moveGridColumn,TABLE_THEMES} from './tableAdapter.js'
import {mergeCellsRange,unmergeCellAt,normalizedMergedCells,shiftMergedForInsert} from './mergedCells20261030.js'

const check=(condition,message)=>{if(!condition)throw new RangeError(message)}
const index=(value,length,label,allowEnd=false)=>{
  check(Number.isInteger(value)&&value>=0&&value<length+(allowEnd?1:0),`Invalid ${label} index`)
  return value
}
const sourceRow=row=>Boolean(row?.sourceRef||row?.origin==='native'||row?.provenance?.linked||row?.provenance?.kind==='source'||Object.values(row?.cells||{}).some(c=>c&&typeof c==='object'&&(c.sourceRef||c.origin==='native'||c.provenance?.kind==='source')))
const sourceColumn=(table,i)=>{const col=table.columns?.[i];return Boolean(col&&(col.sourceRef||col.origin==='native'||col.provenance?.kind==='source'||table.rows?.some(row=>{const c=row.cells?.[col.id];return c&&(c.sourceRef||c.origin==='native'||c.provenance?.kind==='source')})))}
const uniqueId=(used,prefix)=>{let n=1;while(used.has(`${prefix}-${n}`))n++;return `${prefix}-${n}`}
const remap=(styles,transform)=>Object.fromEntries(Object.entries(styles||{}).flatMap(([key,value])=>{
  const match=/^(.*):(\d+)$/.exec(key)
  if(!match)return [[key,value]]
  const next=transform(Number(match[2]),match[1])
  return next==null?[]:[[`${match[1]}:${next}`,value]]
}))
const stripRowStyles=(styles,id)=>Object.fromEntries(Object.entries(styles||{}).filter(([key])=>!key.startsWith(`${id}:`)))
const newCells=count=>Array.from({length:count},()=> '')
const cloneGrid=model=>({...model,headers:[...model.headers],columnIds:[...(model.columnIds||model.headers.map((_,i)=>`column-${i}`))],columnWidths:[...model.headers.map((_,i)=>model.columnWidths?.[i]??160)],rows:model.rows.map(row=>({...row,cells:[...row.cells]})),cellStyles:{...model.cellStyles},mergedCells:(model.mergedCells||[]).map(m=>({...m}))})

/** Pure GridCraft-compatible table command reducer. Canonical EXO metadata survives roundtrips. */
export function gridcraftTableCommand(model,command,selection={}){
  check(model&&typeof model==='object'&&typeof command?.type==='string','Invalid table command')
  const canonical=isCanonicalSpreadsheet(model)
  if(command.type==='setRowHeight'){
    const at=index(command.row??selection.row??0,model.rows?.length??0,'row')
    const height=Number(command.height)
    check(Number.isFinite(height)&&height>=20&&height<=200,'Row height must be between 20 and 200 px')
    return {...model,rows:model.rows.map((row,i)=>i===at?{...row,height:Math.round(height)}:row)}
  }
  const g=cloneGrid(toGridTable(model))
  const merges=normalizedMergedCells(g)
  const r=command.row??selection.row??0
  const c=command.column??selection.column??0
  const linkedRow=i=>canonical?sourceRow(model.rows[i]):sourceRow(g.rows[i])
  const linkedColumn=i=>canonical?sourceColumn(model,i):Boolean(g.columnSourceRefs?.[i])
  const rowAt=()=>index(r,g.rows.length,'row')
  const colAt=()=>index(c,g.headers.length,'column')
  // Until merge-region remapping is verified for arbitrary reordering and
  // destructive deletes, fail closed rather than corrupt an authored header.
  if(merges.length&&['duplicateRow','moveRow','deleteRow','duplicateColumn','moveColumn','deleteColumn'].includes(command.type))
    throw new RangeError('UNMERGE_CELLS_BEFORE_REORDERING_OR_DELETING')
  switch(command.type){
    case 'insertRow':{
      const at=index(command.at??r,g.rows.length,'row',true)
      check(g.rows.length<100,'Maximum 100 table rows')
      const adjusted=shiftMergedForInsert(g,'row',at)
      const id=command.id??uniqueId(new Set(g.rows.map(row=>String(row.id))),'authored-row')
      check(!g.rows.some(row=>String(row.id)===String(id)),'Duplicate row ID')
      g.rows.splice(at,0,{id,cells:newCells(g.headers.length),origin:'authored',provenance:{kind:'authored'}})
      g.mergedCells=adjusted
      break
    }
    case 'duplicateRow':{
      const at=rowAt(),original=g.rows[at]
      const id=command.id??uniqueId(new Set(g.rows.map(row=>String(row.id))),'authored-row')
      check(!g.rows.some(row=>String(row.id)===String(id)),'Duplicate row ID')
      const cells=linkedRow(at)?newCells(g.headers.length):[...original.cells]
      g.rows.splice(at+1,0,{id,cells,origin:'authored',provenance:{kind:'authored'}})
      for(let j=0;j<g.headers.length;j++){const style=g.cellStyles[`${original.id}:${j}`];if(style)g.cellStyles[`${id}:${j}`]={...style}}
      break
    }
    case 'moveRow':{
      const from=rowAt(),to=index(command.to,g.rows.length,'row')
      check(!linkedRow(from)&&!linkedRow(to),'Cannot reorder source-bound rows')
      if(from!==to)g.rows.splice(to,0,g.rows.splice(from,1)[0])
      break
    }
    case 'deleteRow':{
      const at=rowAt()
      check(!linkedRow(at),'Cannot delete source-bound row')
      check(g.rows.length>1,'Cannot delete final row')
      g.cellStyles=stripRowStyles(g.cellStyles,g.rows[at].id)
      g.rows.splice(at,1)
      break
    }
    case 'insertColumn':{
      const at=index(command.at??c,g.headers.length,'column',true)
      check(g.headers.length<50,'Maximum 50 table columns')
      const adjusted=shiftMergedForInsert(g,'column',at)
      const id=command.id??uniqueId(new Set(g.columnIds.map(String)),'authored-column')
      check(!g.columnIds.includes(id),'Duplicate column ID')
      g.headers.splice(at,0,String(command.label??'New column'))
      g.columnIds.splice(at,0,id)
      g.columnWidths.splice(at,0,command.width??160)
      g.rows.forEach(row=>row.cells.splice(at,0,''))
      g.cellStyles=remap(g.cellStyles,i=>i>=at?i+1:i)
      g.mergedCells=adjusted
      break
    }
    case 'deleteColumn':{
      const at=colAt()
      check(!linkedColumn(at),'Cannot delete source-bound column')
      check(g.headers.length>1,'Cannot delete final column')
      g.headers.splice(at,1);g.columnIds.splice(at,1);g.columnWidths.splice(at,1)
      g.rows.forEach(row=>row.cells.splice(at,1))
      g.cellStyles=remap(g.cellStyles,i=>i===at?null:i>at?i-1:i)
      break
    }
    case 'duplicateColumn':{
      const at=colAt()
      check(!linkedColumn(at),'Cannot duplicate source-bound column')
      const id=command.id??uniqueId(new Set(g.columnIds.map(String)),'authored-column')
      check(!g.columnIds.includes(id),'Duplicate column ID')
      const sourceId=g.columnIds[at],originalStyles=g.cellStyles
      g.headers.splice(at+1,0,g.headers[at]+' COPY')
      g.columnIds.splice(at+1,0,id)
      g.columnWidths.splice(at+1,0,g.columnWidths[at])
      g.rows.forEach(row=>row.cells.splice(at+1,0,row.cells[at]))
      g.cellStyles=remap(originalStyles,i=>i>at?i+1:i)
      for(const row of g.rows){
        const original=originalStyles[`${row.id}:${at}`]
        if(original)g.cellStyles[`${row.id}:${at+1}`]={...original}
      }
      break
    }
    case 'moveColumn':{
      const from=colAt(),to=index(command.to,g.headers.length,'column')
      check(!linkedColumn(from)&&!linkedColumn(to),'Cannot reorder source-bound columns')
      const moved=moveGridColumn(g,from,to)
      return canonical?fromGridTable(model,moved):moved
    }
    case 'renameHeading':{
      const at=colAt()
      check(!linkedColumn(at),'Cannot rename source-bound heading')
      g.headers[at]=String(command.label??'')
      break
    }
    case 'setColumnWidth':{
      const at=colAt(),width=Number(command.width)
      check(Number.isFinite(width)&&width>=40&&width<=500,'Column width must be between 40 and 500 px')
      g.columnWidths[at]=Math.round(width)
      break
    }
    case 'mergeCells':{
      const rectangle=command.range||{
        r:command.row,c:command.column,r2:command.row2,c2:command.column2
      }
      check(rectangle&&typeof rectangle==='object','Missing merged cell range')
      const validated=mergeCellsRange(g,rectangle)
      if(canonical)for(let ri=rectangle.r;ri<=rectangle.r2;ri++)for(let ci=rectangle.c;ci<=rectangle.c2;ci++){
        const source=model.rows?.[ri],column=model.columns?.[ci],cell=source?.cells?.[column?.id]
        const linked=Boolean(source?.sourceRef||column?.sourceRef||
          cell?.origin==='native'||cell?.sourceRef||cell?.override||
          cell?.provenance?.kind==='source'||cell?.provenance?.kind==='override')
        check(!linked,'CANNOT_MERGE_SOURCE_LINKED_CELLS')
      }
      g.mergedCells=validated
      break
    }
    case 'unmergeCells':{
      g.mergedCells=unmergeCellAt(g,rowAt(),colAt())
      break
    }
    case 'addMergedHeading':{
      check(g.rows.length<100&&g.headers.length>=2,'HEADING_REQUIRES_AT_LEAST_TWO_COLUMNS_AND_ROOM')
      const id=uniqueId(new Set(g.rows.map(row=>String(row.id))),'heading-row')
      g.mergedCells=shiftMergedForInsert(g,'row',0)
      g.rows.unshift({id,cells:[String(command.label??'SECTION HEADING'),...newCells(g.headers.length-1)],
        origin:'authored',provenance:{kind:'authored'}})
      g.mergedCells.unshift({r:0,c:0,rowSpan:1,colSpan:g.headers.length})
      g.cellStyles[id+':0']={bold:true,align:'center'}
      break
    }
    case 'expandGrid':{
      const targetRows=Number(command.rows),targetCols=Number(command.columns)
      check(Number.isInteger(targetRows)&&targetRows>=g.rows.length&&targetRows<=100,
        'INVALID_EXPANDED_ROW_COUNT')
      check(Number.isInteger(targetCols)&&targetCols>=g.headers.length&&targetCols<=50,
        'INVALID_EXPANDED_COLUMN_COUNT')
      const previousCols=g.headers.length
      const rowIds=new Set(g.rows.map(row=>String(row.id)))
      const colIds=new Set(g.columnIds.map(String))
      for(let c=previousCols;c<targetCols;c++){
        const id=uniqueId(colIds,'authored-column')
        colIds.add(id);g.columnIds.push(id)
        g.headers.push('Column '+String(c+1));g.columnWidths.push(105)
        for(const row of g.rows)row.cells.push('')
      }
      for(let r=g.rows.length;r<targetRows;r++){
        const id=uniqueId(rowIds,'authored-row')
        rowIds.add(id)
        g.rows.push({id,cells:newCells(targetCols),origin:'authored',provenance:{kind:'authored'}})
      }
      break
    }
    case 'setTheme':{
      // A theme swatch is a complete replacement. Keeping old custom color
      // overrides makes the gallery look broken when switching themes.
      check(Object.hasOwn(TABLE_THEMES,command.theme),'Unknown table theme')
      g.tableStyle=normalizeTableStyle({theme:command.theme})
      break
    }
    case 'setTableStyle':{
      g.tableStyle=normalizeTableStyle({...g.tableStyle,...(command.style||{}),...(command.theme?{theme:command.theme}:{})})
      break
    }
    case 'formatCell':{
      const ri=rowAt(),ci=colAt(),key=`${g.rows[ri].id}:${ci}`
      const valid=new Set(['bold','italic','underline','align','color','background','fontFamily','fontSize','letterSpacing','lineHeight'])
      const allowedFonts=new Set(['Arial','Helvetica','Georgia','Times New Roman','Courier New','Verdana','Trebuchet MS','Impact'])
      const next={...(g.cellStyles[key]||{})}
      for(const [k,v] of Object.entries(command.style||{})){
        check(valid.has(k),`Unsupported cell style: ${k}`)
        if(['bold','italic','underline'].includes(k))check(typeof v==='boolean','Expected boolean style')
        if(k==='align')check(['left','center','right'].includes(v),'Invalid alignment')
        if(['color','background'].includes(k))check(/^#[0-9a-f]{6}$/i.test(v),'Invalid color')
        if(k==='fontFamily')check(typeof v==='string'&&allowedFonts.has(v),'Invalid font family')
        if(k==='fontSize')check(typeof v==='number'&&Number.isFinite(v)&&v>=6&&v<=72,'Font size must be between 6 and 72')
        if(k==='letterSpacing')check(typeof v==='number'&&Number.isFinite(v)&&v>=-3&&v<=10,'Letter spacing must be between -3 and 10')
        if(k==='lineHeight')check(typeof v==='number'&&Number.isFinite(v)&&v>=0.8&&v<=2.5,'Line height must be between 0.8 and 2.5')
        next[k]=v
      }
      g.cellStyles[key]=next
      break
    }
    default:throw new RangeError(`Unknown table command: ${command.type}`)
  }
  return canonical?fromGridTable(model,g):g
}
export const applyGridcraftTableCommand=gridcraftTableCommand
export const applyGridcraftTableCommands=(model,commands,selection)=>commands.reduce((table,command)=>gridcraftTableCommand(table,command,selection),model)
export const insertTableRow=(model,at)=>gridcraftTableCommand(model,{type:'insertRow',at})
export const deleteTableRow=(model,row)=>gridcraftTableCommand(model,{type:'deleteRow',row})
export const duplicateTableRow=(model,row)=>gridcraftTableCommand(model,{type:'duplicateRow',row})
export const insertTableColumn=(model,at,label)=>gridcraftTableCommand(model,{type:'insertColumn',at,label})
export const deleteTableColumn=(model,column)=>gridcraftTableCommand(model,{type:'deleteColumn',column})
export const renameTableHeading=(model,column,label)=>gridcraftTableCommand(model,{type:'renameHeading',column,label})
export const styleTable=(model,style)=>gridcraftTableCommand(model,{type:'setTableStyle',style})
export const formatTableCell=(model,row,column,style)=>gridcraftTableCommand(model,{type:'formatCell',row,column,style})
