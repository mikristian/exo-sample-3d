import test from 'node:test'
import assert from 'node:assert/strict'
import {effectiveEmbeddedTableGeometry,boundedEmbeddedTableTransform,materializeEmbeddedTableGeometry} from './embeddedTableGeometry20261030.js'
const box={x:40,y:60,width:300,height:220}
test('effective inspector rectangle matches visible Illustrator transform',()=>{
 assert.deepEqual(effectiveEmbeddedTableGeometry(box,{x:50,y:30,scaleX:1.5,scaleY:.75}),{
  x:90,y:90,width:450,height:165
 })
})
test('table transform can move and resize but stays inside printable artboard',()=>{
 const t=boundedEmbeddedTableTransform(box,{x:999,y:-500,scaleX:2,scaleY:2},{width:612,height:792})
 const actual=effectiveEmbeddedTableGeometry(box,t)
 assert.ok(actual.x>=0&&actual.y>=0&&actual.x+actual.width<=612&&actual.y+actual.height<=792)
})
test('editing width materializes true position and resets stale transform offsets',()=>{
 const result=materializeEmbeddedTableGeometry(box,{x:45,y:25,scaleX:1.3,scaleY:1.2},'width',420,{width:612,height:792})
 assert.equal(result.box.x,85)
 assert.equal(result.box.y,85)
 assert.equal(result.box.width,420)
 assert.deepEqual([result.transform.x,result.transform.y,result.transform.scaleX,result.transform.scaleY],[0,0,1,1])
})
