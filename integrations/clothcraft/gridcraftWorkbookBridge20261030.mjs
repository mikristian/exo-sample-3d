// EXO's worksheet stays the authoritative, revisioned source. This bridge
// starts an isolated GridCraft Rust workbook for one explicitly requested
// calculation; calculated results never write back to the garment source.
import os from 'node:os'
import path from 'node:path'
import {execFile} from 'node:child_process'
import {promises as fsp} from 'node:fs'
import {gridcraftExecutable} from './gridcraftBridge.mjs'

export const GRIDCRAFT_WORKBOOK_MAX_ROWS=100
export const GRIDCRAFT_WORKBOOK_MAX_COLUMNS=50
export const GRIDCRAFT_WORKBOOK_MAX_BYTES=512*1024
export const GRIDCRAFT_WORKBOOK_TIMEOUT_MS=15000
export const GRIDCRAFT_WORKBOOK_MAX_CONCURRENT=1
let activeWorkbookEvaluations=0
const FUNCTIONS=new Set(['SUM','AVERAGE','MIN','MAX','ABS','ROUND','ROUNDUP','ROUNDDOWN','COUNT','PRODUCT','SQRT','POWER','MOD','INT','IF','TRUE','FALSE'])
const columnsToLetters=index=>{let n=index+1,result='';do{result=String.fromCharCode(65+(n-1)%26)+result;n=Math.floor((n-1)/26)}while(n);return result}
const ref=(r,c)=>columnsToLetters(c)+String(r+1)

export function validateGridcraftWorkbook(input){
  const cells=input?.cells
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>key!=='cells')||
     !Array.isArray(cells)||cells.length<1||cells.length>GRIDCRAFT_WORKBOOK_MAX_ROWS)
    throw new RangeError('INVALID_WORKBOOK_SHAPE')
  const columnCount=cells[0]?.length
  if(!Number.isInteger(columnCount)||columnCount<1||columnCount>GRIDCRAFT_WORKBOOK_MAX_COLUMNS||
     cells.some(row=>!Array.isArray(row)||row.length!==columnCount))
    throw new RangeError('INVALID_WORKBOOK_COLUMNS')
  let bytes=0
  for(const row of cells)for(const cell of row){
    if(typeof cell!=='string'||cell.length>2048)throw new RangeError('INVALID_WORKBOOK_CELL')
    bytes+=Buffer.byteLength(cell,'utf8')
    if(bytes>GRIDCRAFT_WORKBOOK_MAX_BYTES)throw new RangeError('WORKBOOK_TOO_LARGE')
    if(!cell.startsWith('='))continue
    if(cell.length>256||!/^=[A-Za-z0-9_.$,+*/^%()\s:<>=-]+$/.test(cell))
      throw new RangeError('UNSAFE_WORKBOOK_FORMULA')
    const raw=cell.slice(1)
    for(const match of raw.matchAll(/[A-Za-z_][A-Za-z_0-9]*/g)){
      const word=match[0].toUpperCase()
      if(FUNCTIONS.has(word))continue
      if(!/^([A-Z]{1,3})\$?[1-9]\d{0,2}$/.test(word))throw new RangeError('UNSAFE_WORKBOOK_FUNCTION')
    }
  }
  return {cells,rows:cells.length,columns:columnCount,bytes}
}

export function parseGridcraftWorkbookCsv(text,rows,columns){
  if(typeof text!=='string'||text.length>2*1024*1024)throw new Error('INVALID_GRIDCRAFT_RESPONSE')
  const parsed=[];let row=[],field='',quoted=false,closedQuote=false
  for(let i=0;i<text.length;i++){
    const ch=text[i]
    if(ch==='"'){
      if(quoted&&text[i+1]==='"'){field+='"';i++}
      else if(!quoted&&field===''&&!closedQuote)quoted=true
      else if(quoted){quoted=false;closedQuote=true}
      else throw new Error('INVALID_GRIDCRAFT_RESPONSE')
    }else if(!quoted&&(ch===','||ch==='\n'||ch==='\r')){
      row.push(field);field='';closedQuote=false
      if(ch!==','){
        parsed.push(row);row=[]
        if(ch==='\r'&&text[i+1]==='\n')i++
      }
    }else{
      if(closedQuote)throw new Error('INVALID_GRIDCRAFT_RESPONSE')
      field+=ch
    }
  }
  if(quoted)throw new Error('INVALID_GRIDCRAFT_RESPONSE')
  if(field!==''||row.length){row.push(field);parsed.push(row)}
  // Native GridCraft emits exactly the requested rectangle, including blank
  // trailing cells and rows. Do not pad truncated or damaged output and then
  // claim independent Rust verification succeeded.
  if(parsed.length!==rows||parsed.some(row=>row.length!==columns))
    throw new Error('INVALID_GRIDCRAFT_DIMENSIONS')
  return Array.from({length:rows},(_,r)=>Array.from({length:columns},(_,c)=>{
    const value=parsed[r]?.[c]??''
    if(value==='')return ''
    if(value==='TRUE')return true
    if(value==='FALSE')return false
    const n=Number(value)
    return Number.isFinite(n)&&/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(value)?n:value
  }))
}

export const gridcraftWorkbookStatus=(env=process.env)=>({
  ok:true,available:Boolean(gridcraftExecutable(env)),engine:'gridcraft-rust-workbook',
  transport:'isolated-gridcraft-cli',maxRows:GRIDCRAFT_WORKBOOK_MAX_ROWS,
  maxColumns:GRIDCRAFT_WORKBOOK_MAX_COLUMNS,timeoutMs:GRIDCRAFT_WORKBOOK_TIMEOUT_MS,
  busy:activeWorkbookEvaluations>=GRIDCRAFT_WORKBOOK_MAX_CONCURRENT,
})

export async function evaluateGridcraftWorkbook(input,{env=process.env,exec=execFile}={}){
  const model=validateGridcraftWorkbook(input)
  const binary=gridcraftExecutable(env)
  if(!binary)return {ok:false,code:'GRIDCRAFT_WORKBOOK_UNAVAILABLE'}
  if(activeWorkbookEvaluations>=GRIDCRAFT_WORKBOOK_MAX_CONCURRENT)
    return {ok:false,code:'GRIDCRAFT_WORKBOOK_BUSY'}
  activeWorkbookEvaluations++
  // MKDTEMP creates 0700 and the script is 0600. Store no garment names,
  // sourceRefs, provenance or authorization tokens in temporary files.
  let dir
  try{
    dir=await fsp.mkdtemp(path.join(os.tmpdir(),'exo-gridcraft-workbook-'))
    const script=path.join(dir,'cells.jsonl')
    const lines=[]
    for(let r=0;r<model.rows;r++)for(let c=0;c<model.columns;c++){
      const input=model.cells[r][c]
      if(input!=='')lines.push(JSON.stringify({command:'cell.set',params:{cell:ref(r,c),input}}))
    }
    await fsp.writeFile(script,lines.join('\n')+'\n',{mode:0o600,flag:'wx'})
    const range=`A1:${ref(model.rows-1,model.columns-1)}`
    const stdout=await new Promise((resolve,reject)=>{
      exec(binary,['run','--script',script,'--print',range,'--csv','--quiet'],{
        shell:false,timeout:GRIDCRAFT_WORKBOOK_TIMEOUT_MS,maxBuffer:2*1024*1024,
        encoding:'utf8',env:{PATH:'/usr/bin:/bin',HOME:dir},windowsHide:true,
      },(error,output)=>{
        if(error)return reject(new Error(error.killed?'GRIDCRAFT_WORKBOOK_TIMEOUT':'GRIDCRAFT_WORKBOOK_FAILED'))
        resolve(output)
      })
    })
    return {ok:true,engine:'gridcraft-rust-workbook',transport:'isolated-gridcraft-cli',
      values:parseGridcraftWorkbookCsv(stdout,model.rows,model.columns),
      rows:model.rows,columns:model.columns,source:'ephemeral-readonly'}
  }catch(error){
    return {ok:false,code:['INVALID_GRIDCRAFT_RESPONSE','INVALID_GRIDCRAFT_DIMENSIONS','GRIDCRAFT_WORKBOOK_TIMEOUT'].includes(error.message)?
      error.message:'GRIDCRAFT_WORKBOOK_FAILED'}
  }finally{
    try{if(dir)await fsp.rm(dir,{recursive:true,force:true})}
    finally{activeWorkbookEvaluations--}
  }
}
