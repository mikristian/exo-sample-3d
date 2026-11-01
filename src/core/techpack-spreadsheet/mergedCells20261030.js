// Merged regions are presentation spans; only the top-left anchor has data.
// Reject any merge which would discard another authored or native value.
export const MAX_MERGED_CELLS=500
const integer=n=>Number.isInteger(n)&&n>=0
const key=(r,c)=>String(r)+':'+String(c)
export function normalizedMergedCells(table){
  const entries=table?.mergedCells||[]
  if(!Array.isArray(entries)||entries.length>MAX_MERGED_CELLS)
    throw new RangeError('INVALID_MERGED_CELLS')
  const rows=Array.isArray(table?.rows)?table.rows.length:0
  const cols=Array.isArray(table?.headers)?table.headers.length:Array.isArray(table?.columns)?table.columns.length:0
  const spans=entries.map(item=>{
    if(!item||!integer(item.r)||!integer(item.c)||!Number.isInteger(item.rowSpan)||!Number.isInteger(item.colSpan)||
      item.rowSpan<1||item.colSpan<1||item.rowSpan*item.colSpan<2||
      item.r+item.rowSpan>rows||item.c+item.colSpan>cols)
      throw new RangeError('INVALID_MERGED_CELL_BOUNDS')
    return {r:item.r,c:item.c,rowSpan:item.rowSpan,colSpan:item.colSpan}
  })
  const occupied=new Set()
  for(const m of spans)for(let r=m.r;r<m.r+m.rowSpan;r++)for(let c=m.c;c<m.c+m.colSpan;c++){
    const cell=key(r,c)
    if(occupied.has(cell))throw new RangeError('OVERLAPPING_MERGED_CELLS')
    occupied.add(cell)
  }
  return spans
}
export function mergeLookup(table){
  const anchors=new Map(),covered=new Map()
  for(const merge of normalizedMergedCells(table)){
    anchors.set(key(merge.r,merge.c),merge)
    for(let r=merge.r;r<merge.r+merge.rowSpan;r++)for(let c=merge.c;c<merge.c+merge.colSpan;c++){
      if(r!==merge.r||c!==merge.c)covered.set(key(r,c),merge)
    }
  }
  return {anchors,covered}
}
export function mergedCellAt(table,r,c){
  const lookup=mergeLookup(table)
  return lookup.anchors.get(key(r,c))||lookup.covered.get(key(r,c))||null
}
export function mergeCellsRange(grid,{r,c,r2,c2}){
  if(![r,c,r2,c2].every(integer)||r2<r||c2<c||
     r2>=grid.rows.length||c2>=grid.headers.length||
     (r2===r&&c2===c))throw new RangeError('SELECT_MULTIPLE_CELLS_TO_MERGE')
  const existing=normalizedMergedCells(grid)
  for(const m of existing)if(!(m.r+m.rowSpan-1<r||m.r>r2||m.c+m.colSpan-1<c||m.c>c2))
    throw new RangeError('UNMERGE_OVERLAPPING_CELLS_FIRST')
  for(let ri=r;ri<=r2;ri++)for(let ci=c;ci<=c2;ci++){
    if(ri===r&&ci===c)continue
    if(String(grid.rows[ri]?.cells?.[ci]??'')!=='')
      throw new RangeError('MERGE_REQUIRES_EMPTY_CELLS_EXCEPT_TOP_LEFT')
  }
  return [...existing,{r,c,rowSpan:r2-r+1,colSpan:c2-c+1}]
}
export function unmergeCellAt(grid,r,c){
  const current=normalizedMergedCells(grid)
  const merged=current.find(m=>r>=m.r&&r<m.r+m.rowSpan&&c>=m.c&&c<m.c+m.colSpan)
  if(!merged)throw new RangeError('CELL_NOT_MERGED')
  return current.filter(m=>m!==merged)
}
export function shiftMergedForInsert(grid,axis,at){
  return normalizedMergedCells(grid).map(m=>{
    const start=axis==='row'?m.r:m.c
    const len=axis==='row'?m.rowSpan:m.colSpan
    const shift=at<=start?1:0,extend=at>start&&at<start+len?1:0
    return axis==='row'?{...m,r:m.r+shift,rowSpan:m.rowSpan+extend}:
      {...m,c:m.c+shift,colSpan:m.colSpan+extend}
  })
}
