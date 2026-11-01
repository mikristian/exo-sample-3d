import {setVectorcraftHandle,vectorcraftAnchorKind} from './vectorcraftAnchorPort.js'

const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)
const fmt=n=>Number(n.toFixed(8)).toString()
const xy=p=>`${fmt(p[0])} ${fmt(p[1])}`
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1]

function checked(item,index,position){
  const anchors=item?.anchors
  if(item?.kind!=='path'||!Array.isArray(anchors)||anchors.length<2||anchors.length>1000||
    !Number.isInteger(index)||index<0||index>=anchors.length||!validPoint(position)||
    anchors.some(a=>!validPoint(a?.p)||!validPoint(a?.hIn)||!validPoint(a?.hOut)||
      (a.kind!==undefined&&!['corner','smooth'].includes(a.kind))))
    throw new TypeError('Expected a valid editable Tech Pack path anchor and local position')
  return anchors
}

/** Generate closed editable SVG from local anchor coordinates. */
export function techPackPathDFromAnchors(anchors){
  if(!Array.isArray(anchors)||anchors.length<2||anchors.length>1000||
    anchors.some(a=>!validPoint(a?.p)||!validPoint(a?.hIn)||!validPoint(a?.hOut)))
    throw new TypeError('Invalid path anchors')
  let d=`M ${xy(anchors[0].p)}`
  for(let i=0;i<anchors.length;i++){
    const from=anchors[i],to=anchors[(i+1)%anchors.length]
    d+=same(from.hOut,from.p)&&same(to.hIn,to.p)?` L ${xy(to.p)}`:
      ` C ${xy(from.hOut)} ${xy(to.hIn)} ${xy(to.p)}`
  }
  return d+' Z'
}

/** Moves the vertex and its handles together; metadata and native source are untouched. */
export function moveTechPackPathAnchor(item,index,position){
  const prior=checked(item,index,position)
  const origin=prior[index].p,delta=[position[0]-origin[0],position[1]-origin[1]]
  const anchors=prior.map((a,i)=>i===index?{...a,p:position.slice(),
    hIn:a.hIn.map((n,axis)=>n+delta[axis]),hOut:a.hOut.map((n,axis)=>n+delta[axis])}:a)
  return {anchors,d:techPackPathDFromAnchors(anchors)}
}

/** which accepts 'in' or 'out'; smooth handles mirror by VectorCraft rules. */
export function moveTechPackPathHandle(item,index,which,position){
  const prior=checked(item,index,position)
  if(!['in','out','hIn','hOut'].includes(which))throw new TypeError('Handle must be in or out')
  const out=which==='out'||which==='hOut',a=prior[index]
  const edited=setVectorcraftHandle({...a,kind:a.kind||vectorcraftAnchorKind(a.p,a.hIn,a.hOut)},out,position)
  if(!edited||![edited.p,edited.hIn,edited.hOut].every(validPoint))throw new TypeError('Invalid moved handle')
  const anchors=prior.map((anchor,i)=>i===index?{...anchor,...edited}:anchor)
  return {anchors,d:techPackPathDFromAnchors(anchors)}
}
