// SVG board coordinates; preserves the existing two-point annotation format.
export function arrowPlacement(start,end,width=980,height=510){
  const clamp=(v,max)=>Math.max(0,Math.min(max,v))
  const first=[clamp(start[0],width),clamp(start[1],height)]
  const last=[clamp(end[0],width),clamp(end[1],height)]
  if(Math.hypot(last[0]-first[0],last[1]-first[1])<3){
    // Point inward from the nearest edges, so clicks near a corner still
    // create a visible leader on the canvas.
    const dx=first[0]>width-100?-72:72
    const dy=first[1]>height-85?-48:48
    last[0]=clamp(first[0]+dx,width)
    last[1]=clamp(first[1]+dy,height)
  }
  return [first,last].map(point=>point.map(n=>Math.round(n*10)/10))
}
