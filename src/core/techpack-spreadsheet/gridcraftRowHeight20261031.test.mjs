import {test} from 'node:test'
import assert from 'node:assert/strict'
import {gridcraftTableCommand} from './gridcraftTableCommands20261030.js'

test('resizing source-bound row changes canonical height only, preserving cells and provenance',()=>{
  const original={columns:[{id:'pom',label:'POM',width:150}],rows:[{id:'chest',sourceRef:'measure:chest',height:30,
    cells:{pom:{input:'48',value:'48',origin:'native',sourceRef:'measure:chest',provenance:{kind:'source'}}}}]}
  const next=gridcraftTableCommand(original,{type:'setRowHeight',row:0,height:89.7})
  assert.equal(next.rows[0].height,90)
  assert.equal(original.rows[0].height,30)
  assert.deepEqual(next.rows[0].cells,original.rows[0].cells)
  assert.equal(next.rows[0].sourceRef,'measure:chest')
  assert.deepEqual(next.columns,original.columns)
  for(const height of [19,201,NaN,Infinity])assert.throws(()=>gridcraftTableCommand(original,{type:'setRowHeight',row:0,height}),/Row height/)
})

test('row heights persist across grid commands and legacy positional models',()=>{
  const original={headers:['A'],rows:[{id:'r1',cells:['x'],height:72},{id:'r2',cells:['y']}],columnWidths:[180]}
  const resized=gridcraftTableCommand(original,{type:'setRowHeight',row:1,height:44})
  const inserted=gridcraftTableCommand(resized,{type:'insertRow',at:1})
  assert.deepEqual(inserted.rows.map(row=>row.height),[72,undefined,44])
  assert.equal(inserted.columnWidths[0],180)
  assert.equal(original.rows[1].height,undefined)
})
