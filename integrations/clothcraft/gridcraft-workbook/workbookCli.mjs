import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {execFile} from 'node:child_process'

const DEFAULT_BIN=path.join(os.homedir(),'Library','Application Support','EXO ClothCraft Studio','bin','gridcraft-cli')

function a1(row,col){
  let n=col+1, s=''
  while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}
  return s+(row+1)
}

export function parseCsv(text){
  const rows=[];let row=[],field='',quoted=false
  for(let i=0;i<text.length;i++){
    const c=text[i]
    if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}
    else if(c==='"')quoted=true
    else if(c===','){row.push(field);field=''}
    else if(c==='\n'){row.push(field);rows.push(row);row=[];field=''}
    else if(c!=='\r')field+=c
  }
  if(quoted)throw new Error('INVALID_GRIDCRAFT_CSV')
  if(field||row.length){row.push(field);rows.push(row)}
  return rows
}

function parseValue(s){
  if(s==='')return null
  if(s==='TRUE')return true
  if(s==='FALSE')return false
  if(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(s)){
    const n=Number(s);if(Number.isFinite(n))return n
  }
  return s
}

export async function recalculateWorkbook(cells,{binary=DEFAULT_BIN,timeout=10000}={}){
  if(!Array.isArray(cells)||cells.length>100||cells.some(row=>!Array.isArray(row)||row.length>50||row.some(v=>typeof v!=='string'||v.length>4096))){throw new Error('INVALID_WORKBOOK')}
  const length=cells.flat().reduce((n,s)=>n+s.length,0)
  if(length>256000)throw new Error('WORKBOOK_TOO_LARGE')
  const cols=Math.max(0,...cells.map(row=>row.length))
  if(!cells.length||!cols)return {values:cells.map(()=>[])}
  const commands=[]
  for(let r=0;r<cells.length;r++)for(let c=0;c<cells[r].length;c++){
    const input=cells[r][c]
    if(input!=='')commands.push(JSON.stringify({command:'cell.set',params:{cell:a1(r,c),input}}))
  }
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'exo-gridcraft-'))
  const script=path.join(dir,'workbook.jsonl')
  try{
    await fs.writeFile(script,commands.join('\n')+'\n',{mode:0o600,flag:'wx'})
    const stdout=await new Promise((resolve,reject)=>execFile(binary,['run','--script',script,'--print',`A1:${a1(cells.length-1,cols-1)}`,'--quiet','--csv'],{shell:false,timeout,maxBuffer:512000,encoding:'utf8'},(err,out,stderr)=>err?reject(Object.assign(new Error('GRIDCRAFT_FAILED'),{cause:String(stderr).slice(0,1000)})):resolve(out)))
    const output=parseCsv(stdout)
    if(output.length!==cells.length||output.some(row=>row.length!==cols))throw new Error('GRIDCRAFT_OUTPUT_SHAPE')
    return {values:output.map((row,r)=>row.slice(0,cells[r].length).map(parseValue))}
  }finally{await fs.rm(dir,{recursive:true,force:true})}
}
