import test from 'node:test'
import assert from 'node:assert/strict'
import {nativePatternPanelToTechPackPath} from './techPackPatternVectorBridge20261031.js'
import {moveTechPackPathAnchor,moveTechPackPathHandle} from './techPackVectorAnchorEditing20261031.js'

const fixture=()=>nativePatternPanelToTechPackPath({id:'piece',polygon:{points:[[0,0],[.1,0],[.1,.1],[0,.1]],edges:['a','b','c','d'],curves:{}}})
test('moving anchor translates controls, preserves metadata and serializes closed path',()=>{
  const item=fixture(),source=item.sourceLink
  const p=item.anchors[1].p
  const patch=moveTechPackPathAnchor(item,1,[p[0]+12,p[1]+8])
  assert.deepEqual(patch.anchors[1].p,[p[0]+12,p[1]+8])
  assert.deepEqual(item.anchors[1].p,p)
  assert.match(patch.d,/^M .* Z$/)
  assert.equal(patch.sourceLink,undefined)
  assert.equal(item.sourceLink,source)
})
test('smooth handles mirror; corner handles remain independent',()=>{
  const item=fixture()
  item.anchors[1]={...item.anchors[1],kind:'smooth',hIn:[90,10],hOut:[110,-10],p:[100,0]}
  const smooth=moveTechPackPathHandle(item,1,'out',[120,0]);assert.deepEqual(smooth.anchors[1].hIn,[100-Math.hypot(10,10),0])
  assert.match(smooth.d,/ C /)
  const corner={...item,anchors:item.anchors.map((a,i)=>i===1?{...a,kind:'corner'}:a)}
  const edit=moveTechPackPathHandle(corner,1,'in',[75,50])
  assert.deepEqual(edit.anchors[1].hOut,[110,-10])
})
test('rejects malformed input and invalid handles',()=>{
  const item=fixture()
  assert.throws(()=>moveTechPackPathAnchor(item,-1,[1,1]),TypeError)
  assert.throws(()=>moveTechPackPathHandle(item,0,'side',[1,1]),TypeError)
  assert.throws(()=>moveTechPackPathHandle(item,0,'out',[Infinity,1]),TypeError)
  assert.throws(()=>moveTechPackPathAnchor({...item,anchors:[{p:[0,0]}]},0,[1,1]),TypeError)
})
