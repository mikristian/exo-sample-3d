import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {initializeRustVectorcraftPenKernel,rustVectorcraftPenKernelReady,rustVectorcraftPenKernelStatus} from './rustVectorcraftPenKernel20261115.js'
import {penTangent,penCubicAt,penSegmentAt,insertPenAnchor,reshapePenDraftSegment} from './vectorcraftPenGesture20261023.js'
import {vectorcraftAnchorKind,setVectorcraftHandle} from './vectorcraftAnchorPort.js'
const wasm=new URL('../../public/wasm/exo_vectorcraft_pen_kernel.wasm',import.meta.url)
const close=(a,b,epsilon=1e-11)=>assert.ok(Math.abs(a-b)<=epsilon,String(a)+' !== '+String(b))
const closePoint=(a,b)=>a.forEach((n,i)=>close(n,b[i]))
test('real source-built EXO VectorCraft Rust/WASM ABI loads',async()=>{
  assert.equal(await initializeRustVectorcraftPenKernel({bytes:readFileSync(wasm)}),true)
  assert.equal(rustVectorcraftPenKernelReady(),true)
  assert.equal(rustVectorcraftPenKernelStatus().backend,'rust-wasm')
})
test('Rust pen tangent matches existing EXO click, drag, shift, alt',()=>{
  for(const [start,cursor,options] of [
    [[0,0],[.001,0],{}],[[0,0],[1,2],{}],
    [[0,0],[1,2],{alt:true}],[[0,0],[2,1],{shift:true}],
    [[1,.5],[.8,.2],{shift:true}],[[0,0],[-2,-1],{shift:true}],
    [[.01,.01],[.01,.01],{}],
  ]){
    const dx=cursor[0]-start[0],dy=cursor[1]-start[1]
    const len=Math.hypot(dx,dy)
    const expected=options.alt||len<=.002?[0,0]:options.shift
      ?[len*Math.cos(Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4),
        len*Math.sin(Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4)]:[dx,dy]
    closePoint(penTangent(start,cursor,options),expected)
  }
})
test('Rust cubic geometry powers pen anchor insertion and hit testing',()=>{
  const a=[0,0],b=[.32,.06],ta=[.06,.09],tb=[.04,-.06]
  for(const t of [0,.1,.25,.5,.75,.95,1]){
    const c1=[a[0]+ta[0],a[1]+ta[1]],c2=[b[0]-tb[0],b[1]-tb[1]]
    const mix=(a,b,t)=>a.map((value,i)=>value+(b[i]-value)*t)
    const x=mix(a,c1,t),y=mix(c1,c2,t),z=mix(c2,b,t)
    const left=mix(x,y,t),right=mix(y,z,t),p=mix(left,right,t)
    const actual=penCubicAt(a,b,ta,tb,t)
    closePoint(actual.p,p);closePoint(actual.left,left);closePoint(actual.right,right)
  }
  const pts=[a,b], tangents=[ta,tb]
  const inserted=insertPenAnchor(pts,tangents,0,.5)
  closePoint(inserted.points[1],penCubicAt(a,b,ta,tb,.5).p)
  const hit=penSegmentAt(pts,tangents,inserted.points[1],.002)
  assert.equal(hit?.index,0);assert.ok(hit?.distance<.002)
  const reshaped=reshapePenDraftSegment(pts,tangents,0,.5,[.002,.004])
  assert.equal(reshaped?.tangents.length,2)
})
test('Rust smooth/corner and opposing handle preserve millimetre precision',()=>{
  assert.equal(vectorcraftAnchorKind([0,0],[-.04,0],[.08,0]),'smooth')
  assert.equal(vectorcraftAnchorKind([0,0],[-.001,0],[.001,.001]),'corner')
  assert.equal(vectorcraftAnchorKind([0,0],[-.001,0],[.001,1e-10]),'smooth')
  const original={p:[0,0],hIn:[-.04,0],hOut:[.08,0],kind:'smooth'}
  const moved=setVectorcraftHandle(original,true,[0,.12])
  assert.equal(moved.kind,'smooth');closePoint(moved.hIn,[0,-.04])
  assert.deepEqual(original.hOut,[.08,0])
  const independent=setVectorcraftHandle(original,true,[0,.12],{independent:true})
  assert.equal(independent.kind,'corner');assert.deepEqual(independent.hIn,[-.04,0])
  const count=rustVectorcraftPenKernelStatus().operations
  assert.ok(count.tangent>0&&count.cubic>0&&count.closest>0&&count.anchor>0&&count.handle>0,
    'All four pen preview calculations must execute the compiled Rust WASM')
})
