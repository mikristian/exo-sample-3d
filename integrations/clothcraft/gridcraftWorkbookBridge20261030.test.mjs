import test from 'node:test'
import assert from 'node:assert/strict'
import {readdir} from 'node:fs/promises'
import os from 'node:os'
import {
  GRIDCRAFT_WORKBOOK_MAX_ROWS,validateGridcraftWorkbook,
  parseGridcraftWorkbookCsv,evaluateGridcraftWorkbook,gridcraftWorkbookStatus
} from './gridcraftWorkbookBridge20261030.mjs'

test('accepts a bounded typed source-free grid, rejecting executable or unbounded formulas',()=>{
  assert.equal(validateGridcraftWorkbook({cells:[['12','=A1*2','=SUM(A1:B1)']]}).columns,3)
  for(const cells of [
    [['=WEBSERVICE(A1)']], [['=HYPERLINK(A1)']], [['=1;rm -rf /']],
    [['=SUM(https://example.com)']], [['=SUM("file")']],
    [['=foo(A1)']], [['=A1'],['A','B']], [['=SUM(A1:A5000)']],
  ])assert.throws(()=>validateGridcraftWorkbook({cells}),/INVALID|UNSAFE/)
  assert.throws(()=>validateGridcraftWorkbook({cells:Array.from({length:GRIDCRAFT_WORKBOOK_MAX_ROWS+1},()=>['1'])}),/INVALID/)
  assert.throws(()=>validateGridcraftWorkbook({cells:[['x'.repeat(2049)]]}),/INVALID/)
  assert.throws(()=>validateGridcraftWorkbook({cells:[['a']],sourceRef:'secret'}),/INVALID/)
})

test('GridCraft csv decoding retains quoted strings, embedded newlines, blank fields, error tokens and numbers',()=>{
  assert.deepEqual(parseGridcraftWorkbookCsv('1,"hello,world",#DIV/0!\n2,"hello\nworld",\n',2,3),
    [[1,'hello,world','#DIV/0!'],[2,'hello\nworld','']])
  assert.throws(()=>parseGridcraftWorkbookCsv('1,2,3\n4,5,6\n',1,3),/DIMENSIONS/)
  assert.throws(()=>parseGridcraftWorkbookCsv('1,2\n',2,2),/DIMENSIONS/)
  assert.throws(()=>parseGridcraftWorkbookCsv('1\n',1,2),/DIMENSIONS/)
  assert.throws(()=>parseGridcraftWorkbookCsv('"ok"malformed\n',1,1),/RESPONSE/)
  assert.throws(()=>parseGridcraftWorkbookCsv('"unterminated',1,1),/RESPONSE/)
})

test('live Rust workbook calculation handles dependent cells, ranges and cleans 0700 scratch',async t=>{
  if(!gridcraftWorkbookStatus().available)return t.skip('Installed Rust GridCraft CLI not present')
  const before=new Set((await readdir(os.tmpdir())).filter(name=>name.startsWith('exo-gridcraft-workbook-')))
  const result=await evaluateGridcraftWorkbook({cells:[
    ['10','20','=A1+B1'],
    ['2','3','=SUM(A1:C1)'],
  ]})
  assert.equal(result.ok,true,JSON.stringify(result))
  assert.equal(result.engine,'gridcraft-rust-workbook')
  assert.deepEqual(result.values,[[10,20,30],[2,3,60]])
  const after=new Set((await readdir(os.tmpdir())).filter(name=>name.startsWith('exo-gridcraft-workbook-')))
  assert.deepEqual([...after].filter(name=>!before.has(name)),[])
})

test('missing GridCraft binary reports explicit unavailable without source grid disclosure',async()=>{
  const result=await evaluateGridcraftWorkbook({cells:[['1','=A1+1']]},{env:{EXO_GRIDCRAFT_CLI:'/nonexistent/gridcraft-cli'}})
  assert.deepEqual(result,{ok:false,code:'GRIDCRAFT_WORKBOOK_UNAVAILABLE'})
})

test('per-process GridCraft capacity guards overlapping CLI work and releases after completion',async t=>{
  if(!gridcraftWorkbookStatus().available)return t.skip('Installed CLI unavailable')
  let onExec,started
  const invoked=new Promise(resolve=>{started=resolve})
  const first=evaluateGridcraftWorkbook({cells:[['=1']]},{exec:(binary,args,options,callback)=>{
    onExec=callback;started()
  }})
  await invoked
  assert.equal(gridcraftWorkbookStatus().busy,true)
  assert.deepEqual(await evaluateGridcraftWorkbook({cells:[['=2']]}),{ok:false,code:'GRIDCRAFT_WORKBOOK_BUSY'})
  onExec(null,'1\n','')
  assert.equal((await first).values[0][0],1)
  assert.equal(gridcraftWorkbookStatus().busy,false)
})
