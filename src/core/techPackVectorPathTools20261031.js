// Native Tech Pack SVG paths use local (page-object) coordinates.
// Each vertex stores its own absolute incoming/outgoing cubic controls.
import {penTangent} from './vectorcraftPenGesture20261023.js'
import {setVectorcraftHandle,vectorcraftAnchorKind} from './vectorcraftAnchorPort.js'

const finite=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)
const anchorValid=a=>finite(a?.p)&&finite(a?.hIn)&&finite(a?.hOut)&&
  (a.kind===undefined||a.kind==='smooth'||a.kind==='corner')
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1]
const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]
const fmt=n=>Number(n.toFixed(10)).toString()
const xy=p=>`${fmt(p[0])} ${fmt(p[1])}`
const clone=a=>({...a,p:a.p.slice(),hIn:a.hIn.slice(),hOut:a.hOut.slice()})
const local=p=>({p:p.slice(),hIn:p.slice(),hOut:p.slice(),kind:'corner'})
const closedOf=item=>item.closed!==false

function checked(item,{min=1}={}){
  if(item?.kind!=='path'||!Array.isArray(item.anchors)||item.anchors.length<min||
    item.anchors.length>1000||item.anchors.some(a=>!anchorValid(a))||
    (item.closed!==undefined&&typeof item.closed!=='boolean'))
    throw new TypeError('Invalid editable native path')
  return item.anchors
}

/** A closed path uses its final vertex's outgoing and first vertex's incoming handles. */
export function techPackEditablePathD(anchors,{closed=false}={}){
  if(!Array.isArray(anchors)||anchors.length<1||anchors.length>1000||
    anchors.some(a=>!anchorValid(a))||typeof closed!=='boolean')
    throw new TypeError('Invalid editable path anchors')
  if(closed&&anchors.length<2)throw new TypeError('Closed path needs at least two anchors')
  let d=`M ${xy(anchors[0].p)}`
  const segments=closed?anchors.length:anchors.length-1
  for(let i=0;i<segments;i++){
    const a=anchors[i],b=anchors[(i+1)%anchors.length]
    d+=same(a.hOut,a.p)&&same(b.hIn,b.p)?` L ${xy(b.p)}`:
      ` C ${xy(a.hOut)} ${xy(b.hIn)} ${xy(b.p)}`
  }
  return closed?d+' Z':d
}

export function techPackPathDFromEditableAnchors(anchors,closed=false){
  return techPackEditablePathD(anchors,{closed})
}

const patch=(anchors,closed)=>({anchors,closed,d:techPackEditablePathD(anchors,{closed})})

/** Insert an anchor ON a segment, preserving cubic geometry by De Casteljau subdivision.
 * afterIndex selects the segment starting at that vertex, including the closing segment.
 */
export function insertTechPackPathAnchor(item,afterIndex,t=.5){
  const src=checked(item,{min:2}),closed=closedOf(item)
  if(!Number.isInteger(afterIndex)||afterIndex<0||
    afterIndex>=(closed?src.length:src.length-1)||!Number.isFinite(t)||t<=0||t>=1||
    src.length>=1000)throw new RangeError('Invalid segment or split parameter')
  const j=(afterIndex+1)%src.length,a=src[afterIndex],b=src[j]
  const linear=same(a.hOut,a.p)&&same(b.hIn,b.p)
  const q0=lerp(a.p,a.hOut,t),q1=lerp(a.hOut,b.hIn,t),q2=lerp(b.hIn,b.p,t)
  const r0=lerp(q0,q1,t),r1=lerp(q1,q2,t),p=lerp(r0,r1,t)
  const anchors=src.map(clone)
  if(!linear){
    anchors[afterIndex].hOut=q0
    anchors[j].hIn=q2
  }
  const inserted=linear?local(lerp(a.p,b.p,t)):{p,hIn:r0,hOut:r1,kind:'smooth'}
  anchors.splice(afterIndex+1,0,inserted)
  // Splitting the closing edge appends the new vertex after the former last one.
  return {...patch(anchors,closed),index:afterIndex+1}
}

/** Delete an anchor and connect its neighbors with a cubic or line.
 * The deleted shape cannot generally be represented exactly by one cubic.
 * Keep neighboring control handles, updating endpoints to avoid stray tails.
 */
export function deleteTechPackPathAnchor(item,index){
  const src=checked(item),closed=closedOf(item)
  const minimum=closed?3:2
  if(!Number.isInteger(index)||index<0||index>=src.length||src.length<=minimum)
    throw new RangeError('Cannot delete anchor from path')
  const anchors=src.map(clone)
  anchors.splice(index,1)
  if(!closed){
    if(index===0)anchors[0].hIn=anchors[0].p.slice()
    if(index===src.length-1)anchors[anchors.length-1].hOut=anchors[anchors.length-1].p.slice()
  }
  return {...patch(anchors,closed),index:Math.min(index,anchors.length-1)}
}

export function moveTechPackEditableAnchor(item,index,position){
  const src=checked(item),closed=closedOf(item)
  if(!Number.isInteger(index)||index<0||index>=src.length||!finite(position))
    throw new TypeError('Invalid moved anchor')
  const origin=src[index].p,dx=position[0]-origin[0],dy=position[1]-origin[1]
  const anchors=src.map(clone),a=anchors[index]
  a.p=position.slice()
  a.hIn=[a.hIn[0]+dx,a.hIn[1]+dy]
  a.hOut=[a.hOut[0]+dx,a.hOut[1]+dy]
  return patch(anchors,closed)
}

export function moveTechPackEditableHandle(item,index,which,position,{independent=false}={}){
  const src=checked(item),closed=closedOf(item)
  if(!Number.isInteger(index)||index<0||index>=src.length||
    !['in','out','hIn','hOut'].includes(which)||!finite(position))
    throw new TypeError('Invalid moved handle')
  const anchors=src.map(clone),a=anchors[index]
  const moved=setVectorcraftHandle({...a,kind:a.kind||vectorcraftAnchorKind(a.p,a.hIn,a.hOut)},
    which==='out'||which==='hOut',position,{independent})
  if(!moved||![moved.p,moved.hIn,moved.hOut].every(finite))throw new TypeError('Invalid moved handle')
  anchors[index]={...a,...moved}
  return patch(anchors,closed)
}

/** Add a clicked or click-dragged Pen vertex to an open draft. dragPos is
 * the outgoing handle, mirrored to provide an incoming smooth tangent.
 */
export function appendTechPackPenAnchor(item,position,dragPos=null,{shift=false,alt=false}={}){
  if(dragPos&&!Array.isArray(dragPos)&&typeof dragPos==='object'){
    const opts=dragPos
    dragPos=opts.handle||opts.dragPosition||null
    shift=opts.shift??shift
    alt=opts.alt??alt
  }
  if(!finite(position)||dragPos!==null&&!finite(dragPos))throw new TypeError('Invalid Pen point')
  const src=item==null?[]:checked(item,{min:1})
  if(item&&closedOf(item))throw new TypeError('Pen draft must be open')
  if(src.length>=1000)throw new RangeError('Too many anchors')
  const anchor=local(position)
  if(dragPos){
    const tangent=penTangent(position,dragPos,{shift,alt,threshold:0})
    anchor.hOut=[position[0]+tangent[0],position[1]+tangent[1]]
    anchor.hIn=[position[0]-tangent[0],position[1]-tangent[1]]
    anchor.kind=tangent[0]===0&&tangent[1]===0?'corner':'smooth'
  }
  return patch([...src.map(clone),anchor],false)
}

export function closeTechPackPenPath(item){
  const src=checked(item,{min:2})
  if(closedOf(item))throw new TypeError('Path is already closed')
  return patch(src.map(clone),true)
}

/** Reduce sampled Pencil points by perpendicular distance to the polyline.
 * tolerance is in local SVG units; unlike a tracing claim, this is an
 * explicit user-controlled approximation of the sampled gesture.
 */
export function reduceTechPackPencilSamples(samples,tolerance=1.5,{closed=false,maxPoints=1000}={}){
  if(!Array.isArray(samples)||samples.length<2||samples.length>200000||
    samples.some(p=>!finite(p))||!Number.isFinite(tolerance)||tolerance<0||
    !Number.isInteger(maxPoints)||maxPoints<2||maxPoints>1000||typeof closed!=='boolean')
    throw new TypeError('Invalid pencil samples')
  const input=samples.filter((p,i)=>i===0||!same(p,samples[i-1]))
  if(closed&&input.length>2&&same(input[0],input[input.length-1]))input.pop()
  if(input.length<(closed?3:2))throw new TypeError('Insufficient distinct pencil points')
  const points=closed?[...input,input[0]]:input
  const keep=new Set([0,points.length-1])
  const pending=[[0,points.length-1]]
  while(pending.length){
    const [a,b]=pending.pop(),start=points[a],end=points[b]
    const dx=end[0]-start[0],dy=end[1]-start[1],len2=dx*dx+dy*dy
    let worst=-1,at=-1
    for(let k=a+1;k<b;k++){
      const p=points[k],u=len2?Math.max(0,Math.min(1,((p[0]-start[0])*dx+(p[1]-start[1])*dy)/len2)):0
      const distance=Math.hypot(p[0]-start[0]-u*dx,p[1]-start[1]-u*dy)
      if(distance>worst){worst=distance;at=k}
    }
    if(at>=0&&worst>tolerance){keep.add(at);pending.push([a,at],[at,b])}
  }
  let reduced=[...keep].sort((a,b)=>a-b).map(i=>points[i])
  if(closed)reduced=reduced.slice(0,-1)
  if(reduced.length<(closed?3:2)){
    // Degenerate closed loops still need three editable vertices.
    reduced=input.filter((_,i)=>i===0||i===Math.floor(input.length/2)||i===input.length-1)
  }
  if(reduced.length>maxPoints){
    const previous=reduced
    reduced=Array.from({length:maxPoints},(_,i)=>previous[Math.floor(i*(previous.length-1)/(maxPoints-1))])
  }
  return reduced.map(p=>p.slice())
}

/** Create a polyline Pencil path from reduced samples; smoothing is opt-in
 * because curves fitted from freehand samples need not pass every sample.
 */
export function createTechPackPencilPath(samples,{tolerance=1.5,closed=false,smooth=false,maxPoints=1000,id}={}){
  const points=reduceTechPackPencilSamples(samples,tolerance,{closed,maxPoints})
  const anchors=points.map(local)
  if(smooth&&points.length>2){
    for(let i=0;i<points.length;i++){
      if(!closed&&(i===0||i===points.length-1))continue
      const before=points[(i-1+points.length)%points.length],after=points[(i+1)%points.length],p=points[i]
      const factor=1/6
      anchors[i].hIn=[p[0]-(after[0]-before[0])*factor,p[1]-(after[1]-before[1])*factor]
      anchors[i].hOut=[p[0]+(after[0]-before[0])*factor,p[1]+(after[1]-before[1])*factor]
      anchors[i].kind='smooth'
    }
  }
  return {...(id?{id}:{}),kind:'path',...patch(anchors,closed)}
}

/** Rebase edited local anchors after a Pen/Direct Selection gesture.
 * Keeps the visible path fixed on the page while making the object's real
 * Illustrator-style bounds and Inspector W/H follow the geometry.
 */
export function normalizeTechPackEditedPathBounds(item,changes){
  const anchors=changes?.anchors
  if(item?.kind!=='path'||!Array.isArray(anchors)||anchors.length<1||
    anchors.some(a=>!anchorValid(a))||!Number.isFinite(Number(item.x))||
    !Number.isFinite(Number(item.y)))throw new TypeError('Invalid edited native path')
  const all=anchors.flatMap(a=>[a.p,a.hIn,a.hOut])
  const minX=Math.min(...all.map(p=>p[0])),minY=Math.min(...all.map(p=>p[1]))
  const maxX=Math.max(...all.map(p=>p[0])),maxY=Math.max(...all.map(p=>p[1]))
  const rebased=anchors.map(a=>({...a,
    p:[a.p[0]-minX,a.p[1]-minY],
    hIn:[a.hIn[0]-minX,a.hIn[1]-minY],
    hOut:[a.hOut[0]-minX,a.hOut[1]-minY]}))
  const closed=changes.closed??item.closed??true
  return {...changes,anchors:rebased,closed,
    d:techPackEditablePathD(rebased,{closed}),x:Number(item.x)+minX,y:Number(item.y)+minY,
    width:Math.max(1,maxX-minX),height:Math.max(1,maxY-minY)}
}

/** Illustrator-style path transform: bounding-box resizing scales every
 * actual anchor and Bézier handle instead of resizing an empty UI rectangle.
 */
export function resizeTechPackEditablePath(item,changes){
  const anchors=checked(item)
  const oldW=Number(item.width),oldH=Number(item.height)
  const newW=Number(changes?.width??oldW),newH=Number(changes?.height??oldH)
  if(!Number.isFinite(oldW)||!Number.isFinite(oldH)||oldW<=0||oldH<=0||
    !Number.isFinite(newW)||!Number.isFinite(newH)||newW<=0||newH<=0||
    newW>10000||newH>10000)throw new TypeError('Invalid vector path bounds')
  const sx=newW/oldW,sy=newH/oldH
  const resized=anchors.map(a=>({...a,...Object.fromEntries(['p','hIn','hOut'].map(k=>
    [k,[a[k][0]*sx,a[k][1]*sy]]))}))
  return {...changes,anchors:resized,closed:item.closed??true,
    d:techPackEditablePathD(resized,{closed:item.closed??true}),width:newW,height:newH}
}
