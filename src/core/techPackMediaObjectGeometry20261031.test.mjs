import test from 'node:test'
import assert from 'node:assert/strict'
import {fittedTechPackMediaBounds,fittedTechPackMediaObject} from './techPackMediaObjectGeometry20261031.js'

test('portrait and landscape images fit inside a large artboard box with exact visible bounds',()=>{
  assert.deepEqual(fittedTechPackMediaBounds({x:10,y:20,width:300,height:200},{width:100,height:200}),
    {x:110,y:20,width:100,height:200,fit:'contain'})
  assert.deepEqual(fittedTechPackMediaBounds({x:10,y:20,width:300,height:200},{width:600,height:200}),
    {x:10,y:70,width:300,height:100,fit:'contain'})
  assert.deepEqual(fittedTechPackMediaBounds({x:10,y:20,width:300,height:200},{width:100,height:200},'cover'),
    {x:10,y:20,width:300,height:200,fit:'cover'})
})

test('missing sizes leave frame, and fitting returns new object without modifying metadata or source',()=>{
  const box={id:'photo-2',x:10,y:20,width:300,height:200,assetId:'existing',slot:{mediaFit:'contain'},note:'preserve'}
  assert.deepEqual(fittedTechPackMediaBounds(box,{width:0,height:800}),{x:10,y:20,width:300,height:200,fit:'contain'})
  const fitted=fittedTechPackMediaObject(box,{width:100,height:200})
  assert.deepEqual([fitted.x,fitted.y,fitted.width,fitted.height],[110,20,100,200])
  assert.equal(fitted.assetId,'existing')
  assert.equal(fitted.slot,box.slot)
  assert.deepEqual([box.x,box.y,box.width,box.height],[10,20,300,200])
  assert.equal(fittedTechPackMediaBounds({width:0,height:200},{width:50,height:50}),null)
})
