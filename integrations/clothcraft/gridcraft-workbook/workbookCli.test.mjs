import test from 'node:test'
import assert from 'node:assert/strict'
import {parseCsv,recalculateWorkbook} from './workbookCli.mjs'

test('CSV preserves commas, quoted newlines and embedded quotes',()=>{
  assert.deepEqual(parseCsv('"hi, there","he said ""yes"""\n"line\nbreak",42\n'),[['hi, there','he said "yes"'],['line\nbreak','42']])
})

test('GridCraft CLI recalculates A1 references, ranges, dependent formulas and errors',async t=>{
  const cells=[['2','3','=SUM(A1:B1)'],['=C1*2','=SUM(A1:C1)','=1/0'],['hello, "world"','TRUE','=A2+B2']]
  let response
  try{response=await recalculateWorkbook(cells)}catch(error){if(error.code==='ENOENT'){t.skip('GridCraft CLI unavailable');return}throw error}
  assert.deepEqual(response.values,[[2,3,5],[10,10,'#DIV/0!'],['hello, "world"',true,20]])
})

test('Rejects oversized workbook before CLI',async()=>{
  await assert.rejects(recalculateWorkbook([Array(51).fill('1')]),/INVALID_WORKBOOK/)
  await assert.rejects(recalculateWorkbook([["x".repeat(4097)]]),/INVALID_WORKBOOK/)
})
