import test from 'node:test'
import assert from 'node:assert/strict'
import {createTechPackVector,alignTechPackVectors,buildTechPackRectShape,renderTechPackVectorSvg} from './techPackVectorStudio.js'
const rect=(id,x,y,w,h)=>({...createTechPackVector('rect',{x,y,width:w,height:h},id)})
test('vector shape creation preserves editable typography and appearance',()=>{
 const text=createTechPackVector('text',{x:12,y:15,width:220,height:55},'text-1')
 assert.equal(text.fontSize,24)
 assert.equal(text.kind,'text')
 assert.equal(text.fill,'#1f242b')
})
test('aligning selected layers does not shift locked or unselected shapes',()=>{
 const one=rect('one',30,40,80,50),two=rect('two',200,100,100,80),locked={...rect('lock',9,9,20,20),locked:true}
 const result=alignTechPackVectors([one,two,locked],['one','two','lock'],'selection','left')
 assert.deepEqual(result.map(x=>x.x),[30,30,9])
 const centered=alignTechPackVectors(result,['one'],'page','center',{width:612,height:792})
 assert.equal(centered[0].x,266)
})
test('shape builder joins overlapping rectangles and subtracts exactly without source mutation',()=>{
 const a=rect('a',10,20,100,70),b=rect('b',60,35,80,90)
 const joined=buildTechPackRectShape([a,b],'unite','merged')
 assert.equal(joined.kind,'path')
 assert.equal(joined.x,10)
 assert.equal(joined.width,130)
 assert.match(joined.d,/M /)
 const cut=buildTechPackRectShape([a,b],'subtract','cut')
 assert.equal(cut.kind,'path')
 assert.notEqual(cut.d,joined.d)
 assert.equal(a.kind,'rect')
 assert.throws(()=>buildTechPackRectShape([a,createTechPackVector('ellipse',{},'e')]),/rectangles/)
 assert.throws(()=>buildTechPackRectShape([a,{...a,id:'other',x:10,y:20}], 'subtract'),/empty/)
})
test('print SVG preserves vector artwork, escapes text and rejects malicious paths',()=>{
 const dangerous={...createTechPackVector('text',{},'t'),text:'<script>alert(1)</script>'}
 const svg=renderTechPackVectorSvg([rect('r',1,2,30,40),dangerous,{...rect('hidden',0,0,4,4),hidden:true}])
 assert.match(svg,/Authored Tech Pack vector artwork/)
 assert.match(svg,/&lt;script&gt;/)
 assert.doesNotMatch(svg,/<script>/)
 const bad={...buildTechPackRectShape([rect('a',0,0,20,20),rect('b',10,10,20,20)],'unite','c'),d:'<svg onload=alert(1)>'}
 assert.doesNotMatch(renderTechPackVectorSvg([bad]),/<path/)
})
test('imported Illustrator path retains nonzero fill rule and open curves in print SVG',()=>{
 const svg=renderTechPackVectorSvg([{id:'source',kind:'path',x:16,y:25,width:100,height:70,
  d:'M 0 0 C 10 0 10 30 20 30',closed:false,fill:'#cdcdcd',stroke:'#222222',
  strokeWidth:2,fillRule:'nonzero'}])
 assert.match(svg,/fill-rule="nonzero"/)
 assert.match(svg,/M 0 0 C 10 0 10 30 20 30/)
 assert.doesNotMatch(svg,/M 0 0 C 10 0 10 30 20 30 Z/)
})
