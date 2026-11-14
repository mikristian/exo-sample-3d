const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n))
/** The saved box rectangle and its Illustrator transform are two parts of the same displayed geometry. */
export function effectiveEmbeddedTableGeometry(box={},transform={}){
  const scaleX=clamp(finite(transform.scaleX,1),.25,3)
  const scaleY=clamp(finite(transform.scaleY,1),.25,3)
  return {
    x:finite(box.x,0)+finite(transform.x,0),
    y:finite(box.y,0)+finite(transform.y,0),
    width:Math.max(1,finite(box.width,240))*scaleX,
    height:Math.max(1,finite(box.height,180))*scaleY
  }
}
/** Tables are printable artboard objects; never move/resize entirely outside the page. */
export function boundedEmbeddedTableTransform(box,transform,{width=612,height=792}={}){
  const baseX=finite(box.x,0),baseY=finite(box.y,0)
  const baseWidth=Math.max(1,finite(box.width,240)),baseHeight=Math.max(1,finite(box.height,180))
  const scaleX=clamp(finite(transform.scaleX,1),.25,Math.max(.25,width/baseWidth))
  const scaleY=clamp(finite(transform.scaleY,1),.25,Math.max(.25,height/baseHeight))
  const x=clamp(baseX+finite(transform.x,0),0,Math.max(0,width-baseWidth*scaleX))
  const y=clamp(baseY+finite(transform.y,0),0,Math.max(0,height-baseHeight*scaleY))
  return {...transform,x:x-baseX,y:y-baseY,scaleX,scaleY}
}
/** Inspector editing materializes the composed rectangle and clears accumulated offsets. */
export function materializeEmbeddedTableGeometry(box,transform,field,value,page){
  const current=effectiveEmbeddedTableGeometry(box,transform)
  const width=finite(page?.width,612),height=finite(page?.height,792)
  const proposed={...current,[field]:finite(value,current[field])}
  proposed.width=clamp(proposed.width,48,width)
  proposed.height=clamp(proposed.height,34,height)
  proposed.x=clamp(proposed.x,0,width-proposed.width)
  proposed.y=clamp(proposed.y,0,height-proposed.height)
  return {box:{...box,x:Math.round(proposed.x),y:Math.round(proposed.y),
    width:Math.round(proposed.width),height:Math.round(proposed.height)},
    transform:{...transform,x:0,y:0,scaleX:1,scaleY:1}}
}
