const str=value=>value==null?'':String(value)
export const isCanonicalSpreadsheet=table=>Array.isArray(table?.columns)
export const makeColumnId=()=>`column-${Date.now()}-${Math.random().toString(36).slice(2,9)}`
// Presentation-only themes: EXO always owns cell inputs, source provenance and
// approval flags. Each palette uses the same explicit print/editor tokens.
export const TABLE_THEMES={
  light:{header:'#e8eef7',stripe:'#f5f8fc',text:'#263245',body:'#ffffff',bodyText:'#273244',border:'#cbd5e1'},
  medium:{header:'#4472c4',stripe:'#e8f0fb',text:'#ffffff',body:'#ffffff',bodyText:'#25374b',border:'#b8c8df'},
  dark:{header:'#243449',stripe:'#334258',text:'#ffffff',body:'#28384c',bodyText:'#f3f6fc',border:'#526076'},
  technical:{header:'#1b2938',stripe:'#edf3f7',text:'#ffffff',body:'#ffffff',bodyText:'#243748',border:'#a8b6c2'},
  blueprint:{header:'#214d83',stripe:'#e7f0fa',text:'#ffffff',body:'#f7fbff',bodyText:'#23456a',border:'#a9c1d9'},
  graphite:{header:'#32383f',stripe:'#e9ecef',text:'#ffffff',body:'#fafafa',bodyText:'#272b31',border:'#9da5ae'},
  sage:{header:'#42675b',stripe:'#e5eee8',text:'#ffffff',body:'#fbfdfb',bodyText:'#25483f',border:'#abc2b5'},
  amber:{header:'#bd6c30',stripe:'#fff0e3',text:'#ffffff',body:'#fffaf5',bodyText:'#603d25',border:'#d9bda7'},
}
const validHex=value=>/^#[0-9a-f]{6}$/i.test(value||'')
export const normalizeTableStyle=style=>{
  const theme=Object.hasOwn(TABLE_THEMES,style?.theme)||style?.theme==='custom'?style.theme:'light'
  const basic={theme,
    header:validHex(style?.header)?style.header:undefined,
    stripe:validHex(style?.stripe)?style.stripe:undefined,
    text:validHex(style?.text)?style.text:undefined}
  // Optional later tokens are absent from legacy documents, preserving their
  // exact serialized footprint until a user customizes these properties.
  for(const key of ['body','bodyText','border'])
    if(validHex(style?.[key]))basic[key]=style[key]
  if(['left','center','right'].includes(style?.headerAlign))basic.headerAlign=style.headerAlign
  if(['normal','uppercase'].includes(style?.headerCase))basic.headerCase=style.headerCase
  return basic
}
export function moveGridColumn(grid,from,to){
  if(from===to||from<0||to<0||from>=grid.headers.length||to>=grid.headers.length)return grid
  const move=list=>{const values=[...list];values.splice(to,0,values.splice(from,1)[0]);return values}
  const cellStyles={}
  for(const [key,value] of Object.entries(grid.cellStyles||{})){
    const match=/^(.*):(\d+)$/.exec(key)
    if(!match){cellStyles[key]=value;continue}
    const old=Number(match[2]);const next=old===from?to:from<to&&old>from&&old<=to?old-1:to<from&&old>=to&&old<from?old+1:old
    cellStyles[`${match[1]}:${next}`]=value
  }
  return {...grid,headers:move(grid.headers),columnIds:move(grid.columnIds||grid.headers.map((_,i)=>`column-${i}`)),columnWidths:move(grid.headers.map((_,i)=>grid.columnWidths?.[i]||160)),rows:grid.rows.map(row=>({...row,cells:move(grid.headers.map((_,i)=>row.cells?.[i]??''))})),cellStyles}
}
/** UI uses positional headers and cells, while preserving canonical data in the source table. */
export function toGridTable(table={}){
  if(!isCanonicalSpreadsheet(table))return { ...table,headers:Array.isArray(table.headers)?table.headers.map(str):[],rows:Array.isArray(table.rows)?table.rows.map(row=>({...row,cells:Array.isArray(row.cells)?row.cells.map(str):[]})):[]}
  const columns=table.columns
  return {...table,headers:columns.map(column=>str(column.label)),columnIds:columns.map(column=>column.id),columnWidths:columns.map(column=>column.width||160),
    rows:(table.rows||[]).map(row=>({...row,cells:columns.map(column=>str(row.cells?.[column.id]?.input??row.cells?.[column.id]?.value))}))}
}
/** Rehydrate source objects, preserving origins, IDs, value metadata and additional fields. */
export function fromGridTable(original={},grid){
  if(!isCanonicalSpreadsheet(original))return grid
  const previousColumns=original.columns||[]
  const previousById=new Map(previousColumns.map(column=>[column.id,column]))
  const columns=grid.headers.map((label,c)=>{const id=grid.columnIds?.[c]||previousColumns[c]?.id||makeColumnId();const previous=previousById.get(id)||{};return {...previous,id,label,width:grid.columnWidths?.[c]||previous.width||160,type:previous.type||'text'}})
  const rowLookup=new Map((original.rows||[]).map(row=>[String(row.id),row]))
  const rows=grid.rows.map(row=>{
    const before=rowLookup.get(String(row.id))||{}
    const cells=Object.fromEntries(columns.map((column,c)=>{
      const previous=before.cells?.[column.id]||{}
      const input=str(row.cells?.[c])
      const changed=input!==str(previous.input??previous.value)
      if(!changed)return [column.id,Object.keys(previous).length?{...previous}:{input,value:input,origin:'authored'}]
      const linked=previous.origin==='native'||previous.override===true||
        previous.sourceRef!=null||before.sourceRef!=null||
        previous.provenance?.kind==='source'||previous.provenance?.kind==='override'
      const sourceValue=previous.underlyingSourceValue??previous.provenance?.originalValue??previous.value??previous.input??null
      const sourceRevision=previous.underlyingSourceRevision??previous.sourceRevision??original.sourceRevision??null
      const provenance=linked?{
        ...previous.provenance,kind:'override',
        sourceRef:previous.provenance?.sourceRef??previous.sourceRef??before.sourceRef??null,
        originalValue:sourceValue
      }:previous.provenance
      return [column.id,{...previous,input,value:input,origin:'authored',
        ...(provenance?{provenance}:{}),
        ...(linked?{override:true,reviewState:'needs-review',
          underlyingSourceValue:sourceValue,underlyingSourceRevision:sourceRevision}:{})}]
    }))
    // Keep row identity and source metadata tied to the original row even
    // when the editor reorders rows or duplicates their visible values.
    const {cells:ignoredCells,...gridRowMetadata}=row
    const sourceMetadata=before.sourceRef?{sourceRef:before.sourceRef}:{}
    return {...before,...gridRowMetadata,...sourceMetadata,cells}
  })
  const {headers,columnWidths,columnIds,...extras}=grid
  return {...original,...extras,tableStyle:normalizeTableStyle(grid.tableStyle||original.tableStyle),columns,rows}
}
