import test from 'node:test'
import assert from 'node:assert/strict'
import {techPackTablePopoverPosition} from './tablePopoverPosition20261030.js'

test('floating table editor stays visible without taking over the entire artboard',()=>{
  const canvas={left:260,right:1160,top:80,bottom:790}
  const anchor={left:370,right:840,top:280,bottom:540}
  const position=techPackTablePopoverPosition({canvas,anchor,viewport:{width:1440,height:900},width:690,height:470})
  assert.ok(position.left>=0&&position.left+690<=1440)
  assert.ok(position.top>=0&&position.top+470<=900)
  assert.ok(position.left>=canvas.left-1)
})

test('small windows and offscreen anchored objects clamp pop-up safely',()=>{
  const position=techPackTablePopoverPosition({
    anchor:{left:-200,right:-40,top:-130,bottom:70},
    canvas:{left:0,right:350,top:0,bottom:260},
    viewport:{width:360,height:330},width:690,height:470
  })
  assert.ok(position.left>=8&&position.left<=16,JSON.stringify(position))
  assert.ok(position.top>=8&&position.top<=16,JSON.stringify(position))
})

test('invalid or missing anchor falls back to the canvas, never NaN',()=>{
  const position=techPackTablePopoverPosition({
    canvas:{left:300,right:960,top:50,bottom:730},
    viewport:{width:1200,height:810},
    width:600,height:440
  })
  assert.equal(Number.isFinite(position.left)&&Number.isFinite(position.top),true)
})
