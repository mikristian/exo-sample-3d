import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {explodeTechPackSvgIntoPaths} from './techPackSvgToNativePaths20261031.js'
import {pairSeaggsTshirtSvg} from './techPackSeaggsPair20261031.js'

const dir=new URL('../../research/techpack-library/seaggs-v2-private/',import.meta.url)
const front=fs.readFileSync(new URL('tshirt-front.svg',dir),'utf8')
const back=fs.readFileSync(new URL('tshirt-back.svg',dir),'utf8')
const place=(svg,options={})=>explodeTechPackSvgIntoPaths(svg,{pageId:'page1',x:20,y:30,idFactory:(i,v)=>`${v||'solo'}-${i}`,sourceAssetId:'private-seaggs',...options})

test('source genuine front/back paths individually editable and preserve original provenance',()=>{
  const a=place(front),b=place(back)
  assert.equal(a.length,11);assert.equal(b.length,8)
  for(const item of [...a,...b]){
    assert.equal(item.kind,'path');assert.ok(item.anchors.length>=2)
    assert.ok(item.anchors.every(a=>['p','hIn','hOut'].every(k=>a[k].every(Number.isFinite))))
    assert.equal(item.stroke,'#000000');assert.equal(item.strokeWidth,2)
    assert.ok(item.d.startsWith('M '));assert.equal(item.sourceRef.originalSvg,item.sourceRef.viewBox[0]===2280?front:back)
  }
  assert.ok(a[0].closed);assert.ok(!a[1].closed);assert.ok(!a[3].closed)
  assert.equal(a[0].fill,'#cdcdcd');assert.equal(a[1].fill,'none')
  assert.ok(a[0].x>=20&&a[0].y>=30)
})

test('paired two-view SVG retains separated 19 paths with translated geometry and sizing',()=>{
  const svg=pairSeaggsTshirtSvg(front,back)
  const paths=place(svg,{groupId:'shirt'})
  assert.equal(paths.length,19)
  assert.deepEqual(paths.map(p=>p.sourceRef.view).reduce((a,b)=>(a[b]=(a[b]||0)+1,a),{}),{front:11,back:8})
  assert.ok(Math.min(...paths.slice(11).map(p=>p.x))>Math.max(...paths.slice(0,11).map(p=>p.x)))
  assert.equal(paths[0].groupId,'shirt')
  assert.ok(paths.every(p=>p.sourceRef.originalSvg===svg))
})

test('preserves cubic handles, open path, Z closure and group paint transforms',()=>{
  const svg='<svg viewBox="10 20 100 100"><g transform="translate(5 7)" stroke="#abc" stroke-width="3" fill="none"><path d="M 10 20 C 15 20 15 30 20 30"/><path d="M 10 20 L 20 20 L 20 30 Z"/></g></svg>'
  const paths=place(svg,{width:200,height:200})
  assert.equal(paths[0].x,30);assert.equal(paths[0].y,44)
  assert.equal(paths[0].strokeWidth,6)
  assert.equal(paths[0].closed,false);assert.equal(paths[1].closed,true)
  assert.match(paths[0].d,/ C /);assert.ok(paths[0].anchors[0].hOut[0]>paths[0].anchors[0].p[0])
})

test('rejects scripts, event handlers, unsupported commands, invalid markup and ID collisions',()=>{
  for(const svg of [
    '<svg viewBox="0 0 10 10"><script>alert(1)</script><path d="M0 0 L1 1"/></svg>',
    '<svg viewBox="0 0 10 10"><path onload="boom()" d="M0 0 L1 1"/></svg>',
    '<svg viewBox="0 0 10 10"><path d="M0 0 Q1 1 2 2"/></svg>',
    '<svg viewBox="0 0 10 10"><path d="M0 0 L1 1"/></g></svg>',
  ])assert.throws(()=>place(svg),TypeError)
  assert.throws(()=>place(front,{idFactory:()=>''}),TypeError)
  assert.throws(()=>place(front,{width:200,height:100}),TypeError)
})
