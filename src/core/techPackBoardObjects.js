// Layout-only transforms. Never alter source pattern vertices, POMs or BOM.
export const clampBoard=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min))
export function boardObjectTransform(input={},maxTranslation=400){
  const limit=maxTranslation===1200?1200:400
  return {x:clampBoard(input.x??0,-limit,limit),y:clampBoard(input.y??0,-limit,limit),
    scaleX:clampBoard(input.scaleX??1,.25,3),scaleY:clampBoard(input.scaleY??1,.25,3)}
}
export function boardObjectMove(value={},delta=[0,0],maxTranslation=400){
  const limit=maxTranslation===1200?1200:400
  const old=boardObjectTransform(value,limit)
  return {...old,x:clampBoard(old.x+delta[0],-limit,limit),y:clampBoard(old.y+delta[1],-limit,limit)}
}
export function boardObjectResize(value={},delta=[0,0],size=[1,1],handle='se',preserveAspect=false,maxTranslation=400){
  const limit=maxTranslation===1200?1200:400
  const old=boardObjectTransform(value,limit)
  const width=Math.max(1,size[0]),height=Math.max(1,size[1])
  const west=handle.includes('w'),east=handle.includes('e')
  const north=handle.includes('n'),south=handle.includes('s')
  const dx=west?-delta[0]:east?delta[0]:0
  const dy=north?-delta[1]:south?delta[1]:0
  let scaleX=clampBoard(old.scaleX+dx/width,.25,3)
  let scaleY=clampBoard(old.scaleY+dy/height,.25,3)
  if(preserveAspect&&(west||east)&&(north||south)){
    // Preserve the current aspect ratio, including intentionally cropped sizes.
    const fx=scaleX/old.scaleX,fy=scaleY/old.scaleY
    const requested=Math.abs(fx-1)>=Math.abs(fy-1)?fx:fy
    const factor=clampBoard(requested,Math.max(.25/old.scaleX,.25/old.scaleY),Math.min(3/old.scaleX,3/old.scaleY))
    scaleX=old.scaleX*factor;scaleY=old.scaleY*factor
  }
  // North/west handles move the origin; the opposite edge stays anchored.
  return {...old,x:clampBoard(old.x+(west?(old.scaleX-scaleX)*width:0),-limit,limit),
    y:clampBoard(old.y+(north?(old.scaleY-scaleY)*height:0),-limit,limit),scaleX,scaleY}
}
