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
export function editPatternBezierHandle(polygon,edge,index,delta,{breakTangents=false,snapAngle=false,mirrorTangents=false,mirrorAcrossPattern=false}={}) {
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
  // The adjacent edge may still be straight (common at the side seam/hem).
  // Opt-in mirroring creates its control so symmetry works at every vertex.
  if(mirrorTangents&&!breakTangents&&!next.curves?.[peerEdge]){
    const a=next.points[index===0?(k+n-1)%n:(k+1)%n]
    const b=next.points[index===0?k:(k+2)%n]
    if(!validPoint(a)||!validPoint(b))return null
    next.curves??={}
    next.curves[peerEdge]=[lerp(a,b,1/3),lerp(a,b,2/3)]
  }
  const peer=next.curves[peerEdge]?.[peerIndex]
  const hIn=index===0?peer:initial,hOut=index===0?initial:peer
  const state={
    p:anchor,hIn:validPoint(hIn)?hIn:anchor,
    hOut:validPoint(hOut)?hOut:anchor,
    kind:mirrorTangents&&!breakTangents?'smooth':vectorcraftAnchorKind(anchor,validPoint(hIn)?hIn:anchor,validPoint(hOut)?hOut:anchor),
  }
  const updated=setVectorcraftHandle(state,index===0,moved,{independent:breakTangents})
  if(!updated)return null
  next.curves[edge][index]=index===0?updated.hOut:updated.hIn
  if(validPoint(peer))next.curves[peerEdge][peerIndex]=index===0?updated.hIn:updated.hOut
  if(mirrorAcrossPattern){
    // Match boundary endpoints, independent of their control geometry. Existing
    // opposite-side curves may already be asymmetric while the user edits them.
    const axis=(Math.min(...polygon.points.map(p=>p[0]))+Math.max(...polygon.points.map(p=>p[0])))/2
    const reflect=p=>[2*axis-p[0],p[1]]
    const a=reflect(polygon.points[k]),b=reflect(polygon.points[(k+1)%n])
    const tolerance=.002
    const matches=[]
    for(let j=0;j<n;j++){
      const start=polygon.points[j],end=polygon.points[(j+1)%n]
      if(distance(start,b)<=tolerance&&distance(end,a)<=tolerance)
        matches.push({j,error:Math.max(distance(start,b),distance(end,a))})
    }
    matches.sort((a,b)=>a.error-b.error)
    if(matches.length===1||matches.length>1&&matches[0].error+1e-9<matches[1].error){
      const partner=next.edges[matches[0].j]
      next.curves??={}
      if(matches[0].j===k){
        // A symmetric hem is its own partner. Only reflect the handle being
        // dragged into the opposite slot; never overwrite that source slot.
        next.curves[edge][1-index]=reflect(next.curves[edge][index])
      }else{
        next.curves[partner]=[reflect(next.curves[edge][1]),reflect(next.curves[edge][0])]
      }
    }
  }
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

/** Materialize collinear controls only in an editing preview. Selection alone
 * never writes the document. The normal native Shape transaction commits drag.
 */
export function patternEditingControls(polygon,edges) {
  const next=structuredClone(polygon)
  if(!next?.points?.length||!next.edges)return next
  next.curves={...next.curves}
  for(const edge of edges){
    const i=next.edges.indexOf(edge)
    if(i<0||next.curves[edge]||next.free_curve_points?.[edge]?.length)continue
    const a=next.points[i],b=next.points[(i+1)%next.points.length]
    next.curves[edge]=[1/3,2/3].map(t=>a.map((v,j)=>v+(b[j]-v)*t))
  }
  return next
}

/** View-only handle arm extension; never changes material coordinates. */
export function visibleTangent(anchor,control,screenUnit,fixedScale) {
  const length=Math.hypot(control[0]-anchor[0],control[1]-anchor[1])
  const scale=fixedScale||Math.max(1,32*screenUnit/Math.max(length,1e-9))
  return {point:control.map((v,i)=>anchor[i]+(v-anchor[i])*scale),scale}
}
