// CLO-style segmented 2D construction guides. Each interval is isolated:
// curving the left chest span never moves its shared midpoint or right span.
export function sampleGuideHalfCurve(start,end,offset=[0,0],angle=0,steps=28){
  if(![start,end,offset].every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))||
    !Number.isFinite(angle))return null
  const c=Math.cos(angle),s=Math.sin(angle)
  const middle=[(start[0]+end[0])/2,(start[1]+end[1])/2]
  const control=[middle[0]+c*offset[0]-s*offset[1],
    middle[1]+s*offset[0]+c*offset[1]]
  return {control,middle,points:Array.from({length:steps+1},(_,i)=>{
    const t=i/steps,u=1-t
    return [0,1].map(axis=>u*u*start[axis]+2*u*t*control[axis]+t*t*end[axis])
  })}
}
