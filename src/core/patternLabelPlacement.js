// Annotation layout is view-only. All coordinates are material-space SVG units.
export function placePatternLabel(midpoint,normal,text,screenUnit,points,bounds) {
  const width=Math.max(48,String(text).length*6)*screenUnit,height=13*screenUnit
  const [left,top,w,h]=bounds
  const candidates=[]
  for(const distance of [20,36,54,76])for(const sign of [1,-1]){
    const x=Math.max(left+width/2+4*screenUnit,Math.min(left+w-width/2-4*screenUnit,midpoint[0]+normal[0]*distance*screenUnit*sign))
    const y=Math.max(top+height+30*screenUnit,Math.min(top+h-8*screenUnit,midpoint[1]+normal[1]*distance*screenUnit*sign))
    const box={left:x-width/2,right:x+width/2,top:y-height,bottom:y+3*screenUnit}
    const collisions=points.filter(p=>p[0]+7*screenUnit>box.left&&p[0]-7*screenUnit<box.right&&p[1]+7*screenUnit>box.top&&p[1]-7*screenUnit<box.bottom).length
    candidates.push({x,y,box,collisions})
    if(!collisions)return candidates.at(-1)
  }
  return candidates.sort((a,b)=>a.collisions-b.collisions)[0]
}
