import test from 'node:test'
import assert from 'node:assert/strict'
import {
  techPackEditablePathD,techPackPathDFromEditableAnchors,insertTechPackPathAnchor,
  deleteTechPackPathAnchor,appendTechPackPenAnchor,closeTechPackPenPath,
  createTechPackPencilPath,reduceTechPackPencilSamples,
  moveTechPackEditableAnchor,moveTechPackEditableHandle,normalizeTechPackEditedPathBounds,
  resizeTechPackEditablePath
} from './techPackVectorPathTools20261031.js'

const a=(p,hIn=p,hOut=p)=>({p,hIn,hOut})
const cubic=(p0,p1,p2,p3,t)=>{
  const u=1-t
  return [0,1].map(i=>u*u*u*p0[i]+3*u*u*t*p1[i]+3*u*t*t*p2[i]+t*t*t*p3[i])
}
const pointDiff=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1])

test('open native path stays open across segment split, direct edits and deletion',()=>{
  const item={kind:'path',closed:false,anchors:[a([0,0]),a([10,0]),a([20,0])],sourceLink:{private:true}}
  const split=insertTechPackPathAnchor(item,0,.3)
  assert.equal(split.closed,false)
  assert.equal(split.anchors.length,4)
  assert.ok(!split.d.endsWith(' Z'))
  assert.match(split.d,/L 3 0/)
  assert.equal(item.anchors.length,3)
  assert.equal(moveTechPackEditableAnchor({...item,...split},1,[3,2]).closed,false)
  assert.equal(moveTechPackEditableHandle({...item,...split},1,'out',[4,4]).closed,false)
  const removed=deleteTechPackPathAnchor({...item,...split},1)
  assert.equal(removed.anchors.length,3)
  assert.equal(removed.closed,false)
  assert.ok(!removed.d.endsWith(' Z'))
  assert.equal(item.sourceLink.private,true)
})

test('De Casteljau exact cubic subdivision preserves shape and endpoint controls',()=>{
  const p0=[0,0],p1=[5,18],p2=[17,-9],p3=[25,2]
  const item={kind:'path',closed:false,anchors:[a(p0,p0,p1),a(p3,p2,p3)]}
  const inserted=insertTechPackPathAnchor(item,0,.37)
  assert.equal(inserted.index,1)
  const [left,mid,right]=inserted.anchors
  for(let k=0;k<=100;k++){
    const t=k/100
    const original=cubic(p0,p1,p2,p3,t)
    const split=t<=.37?cubic(left.p,left.hOut,mid.hIn,mid.p,t/.37):
      cubic(mid.p,mid.hOut,right.hIn,right.p,(t-.37)/.63)
    assert.ok(pointDiff(original,split)<1e-9,`curve mismatched at ${t}`)
  }
  assert.ok(!inserted.d.endsWith(' Z'))
  assert.deepEqual(item.anchors[0].hOut,p1)
})

test('closed segment split preserves closing cubic geometry',()=>{
  const item={kind:'path',closed:true,anchors:[
    a([0,0],[0,-5],[5,0]),a([10,0],[5,0],[10,5]),a([10,10],[10,5],[0,15])
  ]}
  const result=insertTechPackPathAnchor(item,2,.5)
  assert.equal(result.anchors.length,4)
  assert.equal(result.closed,true)
  assert.match(result.d,/ Z$/)
  const from=item.anchors[2],to=item.anchors[0]
  for(let k=0;k<=40;k++){
    const t=k/40
    const expected=cubic(from.p,from.hOut,to.hIn,to.p,t)
    const x=result.anchors[2],m=result.anchors[3],z=result.anchors[0]
    const actual=t<=.5?cubic(x.p,x.hOut,m.hIn,m.p,t*2):
      cubic(m.p,m.hOut,z.hIn,z.p,(t-.5)*2)
    assert.ok(pointDiff(expected,actual)<1e-9)
  }
})

test('Pen click + drag appends to open draft and closes explicitly',()=>{
  const first=appendTechPackPenAnchor(null,[5,5])
  assert.equal(first.anchors.length,1)
  assert.equal(first.d,'M 5 5')
  const second=appendTechPackPenAnchor({kind:'path',...first},[15,15],{handle:[20,15]})
  assert.deepEqual(second.anchors[1].hOut,[20,15])
  assert.deepEqual(second.anchors[1].hIn,[10,15])
  assert.ok(!second.d.endsWith(' Z'))
  const closed=closeTechPackPenPath({kind:'path',...second})
  assert.equal(closed.closed,true)
  assert.ok(closed.d.endsWith(' Z'))
  assert.throws(()=>appendTechPackPenAnchor({kind:'path',...closed},[30,30]))
})

test('Pencil reduction retains meaningful corners and emits a native path',()=>{
  const samples=[[0,0],[1,0.05],[2,0],[3,0],[3,1],[3,2],[3,3]]
  const reduced=reduceTechPackPencilSamples(samples,.1)
  assert.deepEqual(reduced,[[0,0],[3,0],[3,3]])
  const item=createTechPackPencilPath(samples,{id:'pencil-1',tolerance:.1})
  assert.equal(item.kind,'path')
  assert.equal(item.id,'pencil-1')
  assert.equal(item.closed,false)
  assert.equal(item.anchors.length,3)
  assert.ok(!item.d.endsWith(' Z'))
  const loop=createTechPackPencilPath([[0,0],[10,0],[10,10],[0,10],[0,0]],{closed:true,tolerance:0})
  assert.equal(loop.closed,true)
  assert.ok(loop.d.endsWith(' Z'))
  assert.ok(loop.anchors.length>=3)
})

test('open path SVG serializer and invalid/underspecified inputs',()=>{
  assert.equal(techPackEditablePathD([a([0,0]),a([5,0])]),'M 0 0 L 5 0')
  assert.equal(techPackPathDFromEditableAnchors([a([0,0]),a([5,0])],true),'M 0 0 L 5 0 L 0 0 Z')
  assert.throws(()=>insertTechPackPathAnchor({kind:'path',closed:false,anchors:[a([0,0]),a([1,1])]},1,.5))
  assert.throws(()=>insertTechPackPathAnchor({kind:'path',closed:false,anchors:[a([0,0]),a([1,1])]},0,1))
  assert.throws(()=>insertTechPackPathAnchor({kind:'path',closed:false,anchors:[a([0,0]),a([NaN,1])]},0,.5))
  assert.throws(()=>closeTechPackPenPath({kind:'path',closed:false,anchors:[a([0,0])]}))
  assert.throws(()=>deleteTechPackPathAnchor({kind:'path',closed:false,anchors:[a([0,0]),a([2,2])]},1))
  assert.throws(()=>appendTechPackPenAnchor(null,[Infinity,2]))
  assert.throws(()=>reduceTechPackPencilSamples([[0,0],[1,1]],-1))
})
test('path geometry and inspector bounds follow actual Pen anchor edits without moving visible source',()=>{
 const initial={kind:'path',x:120,y:180,width:1,height:1,closed:false,anchors:[a([0,0])]}
 const applied=appendTechPackPenAnchor(initial,[-20,30])
 const rebased=normalizeTechPackEditedPathBounds(initial,applied)
 assert.equal(rebased.x,100)
 assert.equal(rebased.y,180)
 assert.equal(rebased.width,20)
 assert.equal(rebased.height,30)
 assert.deepEqual(rebased.anchors.map(a=>[a.p[0]+rebased.x,a.p[1]+rebased.y]),[[120,180],[100,210]])
 assert.match(rebased.d,/M 20 0 L 0 30/)
 assert.equal(initial.width,1)
})
test('bounding-box resize scales true SVG anchors and Bézier handles, preserving open path topology',()=>{
 const src={kind:'path',x:70,y:90,width:20,height:10,closed:false,
  anchors:[a([0,0],[0,0],[7,10]),a([20,10],[12,3],[20,10])]}
 const result=resizeTechPackEditablePath(src,{width:40,height:30})
 assert.deepEqual(result.anchors[0].hOut,[14,30])
 assert.deepEqual(result.anchors[1].p,[40,30])
 assert.match(result.d,/M 0 0 C 14 30 24 9 40 30/)
 assert.ok(!result.d.endsWith(' Z'))
 assert.equal(src.anchors[1].p[0],20)
})
