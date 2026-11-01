import {evaluateTableFormulas} from './formulas.js'
import {toGridTable} from './tableAdapter.js'

const display=value=>value===null||value===undefined?'':String(value)
const cellName=(r,c)=>{
  let column='',n=c+1
  while(n){column=String.fromCharCode(65+(n-1)%26)+column;n=Math.floor((n-1)/26)}
  return column+(r+1)
}
const same=(left,right)=>typeof left==='number'&&typeof right==='number'
  ?Number.isFinite(left)&&Number.isFinite(right)&&Math.abs(left-right)<=1e-8*Math.max(1,Math.abs(left),Math.abs(right))
  :typeof left===typeof right&&left===right

/** Source-free, immutable snapshot. Only displayed inputs cross into GridCraft. */
export function gridcraftWorkbookInputs(table){
  const grid=toGridTable(table)
  const headers=grid.headers||[],rows=grid.rows||[]
  if(!headers.length||headers.length>50||!rows.length||rows.length>100)
    throw new RangeError('WORKBOOK_DIMENSIONS_UNSUPPORTED')
  const cells=rows.map(row=>headers.map((_,index)=>display(row.cells?.[index])))
  const formulaCount=cells.reduce((n,row)=>n+row.filter(value=>value.startsWith('=')).length,0)
  return {cells,formulaCount,rows:cells.length,columns:headers.length}
}

/** Fully checks shape and every formula before any UI can claim Rust parity. */
export function reviewGridcraftWorkbook(table,packet,snapshot=gridcraftWorkbookInputs(table)){
  if(packet?.ok!==true||packet.engine!=='gridcraft-rust-workbook'||
    !Array.isArray(packet.values)||packet.values.length!==snapshot.rows||
    packet.rows!==snapshot.rows||packet.columns!==snapshot.columns||
    packet.values.some(row=>!Array.isArray(row)||row.length!==snapshot.columns||
      row.some(value=>!(typeof value==='string'||typeof value==='boolean'||
        (typeof value==='number'&&Number.isFinite(value)))))){
    throw new Error('INVALID_GRIDCRAFT_WORKBOOK_RESPONSE')
  }
  const current=gridcraftWorkbookInputs(table)
  if(JSON.stringify(snapshot.cells)!==JSON.stringify(current.cells))
    throw new Error('STALE_GRIDCRAFT_WORKBOOK_SNAPSHOT')
  const local=evaluateTableFormulas(table)
  const mismatches=[],formulaErrors=[]
  let compared=0
  for(let r=0;r<snapshot.rows;r++)for(let c=0;c<snapshot.columns;c++){
    const input=snapshot.cells[r][c]
    if(!input.startsWith('='))continue
    compared++
    const localCell=local.getCell(r,c)
    const localValue=localCell?.error||localCell?.value
    const rustValue=packet.values[r][c]
    const item={cell:cellName(r,c),row:r,column:c,formula:input,exo:localValue,gridcraft:rustValue}
    if(typeof localValue==='string'&&localValue.startsWith('#')||
       typeof rustValue==='string'&&rustValue.startsWith('#'))formulaErrors.push(item)
    if(!same(localValue,rustValue))mismatches.push(item)
  }
  const status=!compared?'no-formulas':mismatches.length?'mismatch':
    formulaErrors.length?'formula-errors':'match'
  return {status,compared,mismatches,formulaErrors,
    values:packet.values.map(row=>[...row]),
    message:status==='no-formulas'?'No formulas to verify in this table':
      status==='mismatch'?`${mismatches.length} of ${compared} formula results differ · review before factory use`:
      status==='formula-errors'?`${formulaErrors.length} formula errors require review`:
      `${compared} formula${compared===1?'':'s'} independently matched GridCraft Rust`}
}
