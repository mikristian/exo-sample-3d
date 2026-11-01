import test from 'node:test'
import assert from 'node:assert/strict'
import {gridcraftWorkbookInputs,reviewGridcraftWorkbook} from './gridcraftWorkbookReview20261030.js'

const table={columns:[{id:'a',label:'Qty'},{id:'b',label:'Unit cost'},{id:'c',label:'Total'}],
  rows:[{id:'r1',cells:{a:{input:'3',origin:'native',sourceRef:'secret/2026'},
    b:{input:'5',origin:'authored'},c:{input:'=A1*B1',origin:'authored'}}}]}
const packet=(values)=>({ok:true,engine:'gridcraft-rust-workbook',rows:1,columns:3,values:[values]})

test('isolated grid sends raw cell inputs but no native metadata or source identities',()=>{
 const snapshot=gridcraftWorkbookInputs(table)
 assert.deepEqual(snapshot.cells,[['3','5','=A1*B1']])
 assert.equal(snapshot.formulaCount,1)
 assert.ok(!JSON.stringify(snapshot).includes('secret/2026'))
 assert.equal(table.rows[0].cells.a.sourceRef,'secret/2026')
})
test('requires exact dimensions and rejects partial or invalid successful Rust responses',()=>{
 const snapshot=gridcraftWorkbookInputs(table)
 for(const p of [
  {...packet([3,5,15]),rows:2},packet([3,5]),packet([3,5,NaN]),packet([3,5,null]),
  {...packet([3,5,15]),engine:'not-rust'}, {...packet([3,5,15]),ok:false}
 ])assert.throws(()=>reviewGridcraftWorkbook(table,p,snapshot),/INVALID_GRIDCRAFT_WORKBOOK_RESPONSE/)
})
test('detects stale snapshots without accepting old evidence after a user edit',()=>{
 const snapshot=gridcraftWorkbookInputs(table)
 const edited=structuredClone(table)
 edited.rows[0].cells.a.input='7'
 assert.throws(()=>reviewGridcraftWorkbook(edited,packet([3,5,15]),snapshot),/STALE_GRIDCRAFT_WORKBOOK_SNAPSHOT/)
})
test('reports exact mismatched formula cell, and matches numeric floating-point tolerances',()=>{
 const matched=reviewGridcraftWorkbook(table,packet([3,5,15+1e-10]))
 assert.equal(matched.status,'match')
 assert.equal(matched.compared,1)
 const bad=reviewGridcraftWorkbook(table,packet([3,5,18]))
 assert.equal(bad.status,'mismatch')
 assert.deepEqual(bad.mismatches[0],{cell:'C1',row:0,column:2,formula:'=A1*B1',exo:15,gridcraft:18})
})
test('never shows success when no formulas or when both engines only agree on an error',()=>{
 const plain={headers:['Plain'],rows:[{id:'r',cells:['5']}]}
 assert.equal(reviewGridcraftWorkbook(plain,{ok:true,engine:'gridcraft-rust-workbook',values:[[5]],rows:1,columns:1}).status,'no-formulas')
 const broken={headers:['Bad'],rows:[{id:'r',cells:['=1/0']}]}
 const review=reviewGridcraftWorkbook(broken,{ok:true,engine:'gridcraft-rust-workbook',values:[['#DIV/0!']],rows:1,columns:1})
 assert.equal(review.status,'formula-errors')
 assert.equal(review.formulaErrors[0].cell,'A1')
})
