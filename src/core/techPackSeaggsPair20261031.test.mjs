import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {pairSeaggsTshirtSvg,placeSeaggsPairInstance} from './techPackSeaggsPair20261031.js'
const root='research/techpack-library/seaggs-v2-private/'
test('genuine SEAGGS front/back paths become one reusable two-view SVG',()=>{
  const paired=pairSeaggsTshirtSvg(fs.readFileSync(root+'tshirt-front.svg','utf8'),fs.readFileSync(root+'tshirt-back.svg','utf8'))
  assert.equal((paired.match(/<path\b/g)||[]).length,19)
  assert.match(paired,/data-mockup-view="front"/)
  assert.match(paired,/data-mockup-view="back"/)
  assert.doesNotMatch(paired,/<image\b|<rect\b/)
})
test('repeated placement retains existing placed art and makes independent layer IDs',()=>{
  const source={id:'master',dataUrl:'data:image/svg+xml,%3Csvg%3E%3Cpath%20d%3D%22M0%200%22%2F%3E%3C%2Fsvg%3E',tags:['mockup']}
  const first=placeSeaggsPairInstance({assets:[source],pageAssets:{p:[]}},source,{pageId:'p',id:'a',x:5,y:9})
  const second=placeSeaggsPairInstance(first,source,{pageId:'p',id:'b',x:43,y:22})
  assert.deepEqual(second.pageAssets.p,['a','b'])
  assert.equal(second.boardObjects.p['asset-a'].x,5)
  assert.equal(second.boardObjects.p['asset-b'].x,43)
  assert.equal(second.assets.length,3)
  assert.equal(first.assets.length,2)
  assert.throws(()=>placeSeaggsPairInstance(first,source,{pageId:'p',id:'a'}),/Duplicate/)
})
