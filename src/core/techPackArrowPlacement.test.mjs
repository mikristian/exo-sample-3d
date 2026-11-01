import test from 'node:test'
import assert from 'node:assert/strict'
import {arrowPlacement} from './techPackArrowPlacement.js'

test('drag preserves author-defined endpoints and saved points shape',()=>{
  assert.deepEqual(arrowPlacement([100,80],[240,190]),[[100,80],[240,190]])
})
test('single click creates a visible inward-pointing leader at canvas edges',()=>{
  for(const start of [[0,0],[980,0],[0,510],[980,510],[490,255]]){
    const [a,b]=arrowPlacement(start,start)
    assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])>20)
    assert.ok(b[0]>=0&&b[0]<=980&&b[1]>=0&&b[1]<=510)
  }
})
test('tiny accidental drag uses default arrow; coordinates remain bounded',()=>{
  assert.deepEqual(arrowPlacement([980,510],[979,509]),[[980,510],[908,462]])
  assert.deepEqual(arrowPlacement([-5,600],[1000,-20]),[[0,510],[980,0]])
})
