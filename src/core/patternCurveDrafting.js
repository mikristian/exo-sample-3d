// View-only CLO-style curve stations and dimensional labels. All material
// geometry is evaluated from the same native cubic/free-knot representation
// used by Rust Shape; no point is fabricated off the physical cutline.
import {evaluateFreeCurve} from './nativeFreeCurvePoints.js'

const valid=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])
const midpoint=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2]

export function sideCurveStation(polygon,edge,targetY){
  if(!Number.isFinite(targetY)||!polygon?.edges?.includes(edge))return null
  const sampleCount=128, samples=Array.from({length:sampleCount+1},(_,i)=>{
    const t=i/sampleCount
    return {t,position:evaluateFreeCurve(polygon,edge,t)}
  })
  const crossings=[]
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i]
    if(!valid(a.position)||!valid(b.position))continue
    const dy=b.position[1]-a.position[1]
    if(Math.abs(dy)<1e-10||Math.min(a.position[1],b.position[1])-1e-7>targetY||
      Math.max(a.position[1],b.position[1])+1e-7<targetY)continue
    let lo=a.t,hi=b.t
    // The native spline may curve backward in X or Y. The selected bracket
    // is guaranteed monotone only locally; bisect its measured crossing.
    const positive=dy>0
    for(let j=0;j<25;j++){
      const mid=(lo+hi)/2,p=evaluateFreeCurve(polygon,edge,mid)
      if(!valid(p))return null
      if((p[1]<targetY)===positive)lo=mid
      else hi=mid
    }
    const t=(lo+hi)/2,position=evaluateFreeCurve(polygon,edge,t)
    if(valid(position)&&t>.008&&t<.992)
      crossings.push({edge,t,position,error:Math.abs(position[1]-targetY)})
  }
  return crossings.sort((a,b)=>a.error-b.error||Math.abs(a.t-.5)-Math.abs(b.t-.5))[0]||null
}

export function torsoSideCurveStations(polygon,chestY,bellyY){
  if(!Number.isFinite(chestY)||!Number.isFinite(bellyY)||Math.abs(bellyY-chestY)<.015)
    return []
  return ['side-left','side-right'].flatMap(edge=>[
    {level:'between',y:midpoint([0,chestY],[0,bellyY])[1]},
    {level:'belly',y:bellyY},
  ].map(item=>{
    const station=sideCurveStation(polygon,edge,item.y)
    if(!station)return null
    const saved=polygon?.free_curve_points?.[edge]||[]
    if(saved.some(mark=>Number.isFinite(mark.t)&&Math.abs(mark.t-station.t)<.012||
      valid(mark.position)&&distance(mark.position,station.position)<.003))return null
    return {...station,level:item.level}
  }).filter(Boolean))
}

export function curveDraftDimensions(polygon,{samples=64}={}){
  const names=polygon?.edges||[],items=[]
  if(!names.length||polygon.points?.length!==names.length)return []
  for(const edge of names){
    const points=Array.from({length:samples+1},(_,i)=>evaluateFreeCurve(polygon,edge,i/samples))
    if(points.some(p=>!valid(p)))continue
    const arcs=points.slice(1).map((p,i)=>distance(p,points[i]))
    const length=arcs.reduce((sum,n)=>sum+n,0)
    let remaining=length/2,index=0
    for(;index<arcs.length-1&&remaining>arcs[index];index++)remaining-=arcs[index]
    const middle=arcs[index]>1e-10?
      [0,1].map(axis=>points[index][axis]+
        (points[index+1][axis]-points[index][axis])*remaining/arcs[index]):
      midpoint(points[index],points[index+1])
    if(length>.001)items.push({edge,length,midpoint:middle,
      bounds:{minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),
        minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))},
      from:points[0],to:points.at(-1)})
  }
  return items
}
