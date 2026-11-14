import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {buildLinkedMirror} from './appLinkedMirror20261030.mjs'

test('linked mirror preserves target identity, reflects geometry, indexes and attachments',()=>{
  const source={id:'left',points:[{x:0,y:0},{x:2,y:0},{x:2,y:3},{x:0,y:3}],
    curves:{0:{cx:1,cy:0}},notches:[{id:'n',edgeIndex:0,t:.2}],
    buttons:[{id:'b',x:.25}],zippers:[{id:'zip',edgeIndex:1}],
    foamPads:[{id:'pad',x:.5,rotationDeg:30,points:[{x:.2,y:.3}]}],grainAngleDeg:20}
  const target={id:'right',name:'Right panel',layout2d:{x:8},arrangement3d:{z:2}}
  const original=structuredClone(source),result=buildLinkedMirror(source,target)
  assert.deepEqual(result.points.map(p=>p.x),[2,0,0,2])
  assert.equal(result.id,'right');assert.equal(result.name,'Right panel')
  assert.deepEqual(result.layout2d,{x:8})
  assert.deepEqual(result.arrangement3d,{z:2})
  assert.deepEqual(result.curves[2],{cx:1,cy:0})
  assert.equal(result.notches[0].edgeIndex,2)
  assert.equal(result.notches[0].t,.8)
  assert.equal(result.buttons[0].id,'right-b')
  assert.equal(result.buttons[0].x,1.75)
  assert.equal(result.zippers[0].edgeIndex,1)
  assert.equal(result.foamPads[0].points[0].x,-.2)
  assert.equal(result.foamPads[0].rotationDeg,-30)
  assert.equal(result.grainAngleDeg,-20)
  assert.deepEqual(source,original)
})

test('absent source geometry retains original target',()=>{
  const target={id:'right'}
  assert.equal(buildLinkedMirror(null,target),target)
  assert.equal(buildLinkedMirror({points:[]},target),target)
})

test('architecture gate imports isolated linked mirror rather than owning implementation',()=>{
  const app=readFileSync(new URL('../App.jsx',import.meta.url),'utf8')
  assert.match(app,/import \{buildLinkedMirror\} from '\.\/core\/appLinkedMirror20261030\.mjs'/)
  assert.doesNotMatch(app,/function buildLinkedMirror\(/)
  assert.doesNotMatch(app,/function mirroredEdgeIndex\(/)
  assert.match(app,/source \? buildLinkedMirror\(source, piece\)/)
})
