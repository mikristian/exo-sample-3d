// Ported VectorCraft anchor editing, adapted to EXO's material-space metres.
// A pattern edge stores [outgoingControl, incomingControl] in panel-local space.
// Unlike a drawing-only vector handle, changes are persisted in native Rust Shape.
import {vectorcraftAnchorKind,setVectorcraftHandle} from './vectorcraftAnchorPort.js'
const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]]
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]]
const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]

/** 45° handle snapping with exact physical radius retention. */
export function snapControlAngle(anchor,point,step=Math.PI/4) {
  if(!validPoint(anchor)||!validPoint(point)||!(step>0))return point
  const dx=point[0]-anchor[0],dy=point[1]-anchor[1],radius=Math.hypot(dx,dy)
  if(radius<1e-12)return point
  const angle=Math.round(Math.atan2(dy,dx)/step)*step
  return [anchor[0]+Math.cos(angle)*radius,anchor[1]+Math.sin(angle)*radius]
}

/** Move one native control with optional Illustrator-style smooth continuity.
 *  Alt breaks the opposite tangent. Shift constrains the edited tangent to 45°.
 *  Adjacent handle length is preserved, so the neighboring edge remains stable.
 */
export function editPatternBezierHandle(polygon,edge,index,delta,{breakTangents=false,snapAngle=false}={}) {
  if(!polygon||!Array.isArray(polygon.edges)||!Array.isArray(polygon.points))return null
  const n=polygon.points.length,k=polygon.edges.indexOf(edge)
  if(n<3||k<0||!validPoint(delta)||![0,1].includes(index)||!polygon.curves?.[edge]?.[index])return null
  const next=structuredClone(polygon)
  const vertex=index===0?k:(k+1)%n
  const anchor=next.points[vertex]
  const initial=next.curves[edge][index],requested=add(initial,delta)
  const moved=snapAngle?snapControlAngle(anchor,requested):requested
  if(!validPoint(moved))return null
  const peerIndex=index===0?1:0
  const peerEdge=next.edges[index===0?(k+n-1)%n:(k+1)%n]
  const peer=next.curves[peerEdge]?.[peerIndex]
  const hIn=index===0?peer:initial,hOut=index===0?initial:peer
  const state={
    p:anchor,hIn:validPoint(hIn)?hIn:anchor,
    hOut:validPoint(hOut)?hOut:anchor,
    kind:vectorcraftAnchorKind(anchor,validPoint(hIn)?hIn:anchor,validPoint(hOut)?hOut:anchor),
  }
  const updated=setVectorcraftHandle(state,index===0,moved,{independent:breakTangents})
  if(!updated)return null
  next.curves[edge][index]=index===0?updated.hOut:updated.hIn
  if(validPoint(peer))next.curves[peerEdge][peerIndex]=index===0?updated.hIn:updated.hOut
  return next
}

export function cubicAt(a,c1,c2,b,t) {
  const q=1-t
  return [0,1].map(i=>q*q*q*a[i]+3*q*q*t*c1[i]+3*q*t*t*c2[i]+t*t*t*b[i])
}

/** Split existing cubic at pointer fraction without changing the contour.
 *  This can later drive a topology-aware SplitBoundary native operation.
 */
export function splitCubic(a,c1,c2,b,t) {
  if(![a,c1,c2,b].every(validPoint)||!(t>0&&t<1))return null
  const ab=lerp(a,c1,t),bc=lerp(c1,c2,t),cd=lerp(c2,b,t)
  const abc=lerp(ab,bc,t),bcd=lerp(bc,cd,t),middle=lerp(abc,bcd,t)
  return {middle,left:[a,ab,abc,middle],right:[middle,bcd,cd,b]}
}

/** Arc length in metres. Used for real pattern dimensions, not pixels. */
export function cubicLength(a,c1,c2,b,steps=96) {
  if(![a,c1,c2,b].every(validPoint))return NaN
  let length=0,last=a
  for(let i=1;i<=steps;i++){
    const point=cubicAt(a,c1,c2,b,i/steps)
    length+=distance(last,point);last=point
  }
  return length
}

// Preview only; Rust's remap_anchors is authoritative when the gesture ends.
// Preserve the corner or smooth shape as an anchor moves: carry its incoming
// and outgoing controls by the exact same local-metre delta.
export function previewPatternAnchorMove(polygon,index,delta) {
  if(!polygon||!Array.isArray(polygon.points)||!Array.isArray(polygon.edges)
    ||!Number.isInteger(index)||index<0||index>=polygon.points.length
    ||!validPoint(delta))return null
  const next=structuredClone(polygon)
  next.points[index]=add(next.points[index],delta)
  const n=next.points.length
  const outgoing=next.curves?.[next.edges[index]]
  const incoming=next.curves?.[next.edges[(index+n-1)%n]]
  if(outgoing?.[0])outgoing[0]=add(outgoing[0],delta)
  if(incoming?.[1])incoming[1]=add(incoming[1],delta)
  return next
}
