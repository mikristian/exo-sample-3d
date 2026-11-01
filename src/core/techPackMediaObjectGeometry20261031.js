/** Pixel-space rectangle occupied by visible media, independent of editor chrome.
 * A contained image preserves every source pixel; cover deliberately crops the source.
 * Invalid/missing intrinsic dimensions keep the authored frame until the image loads. */
export function fittedTechPackMediaBounds(frame, intrinsic, fit='contain') {
  const x=Number(frame?.x)||0, y=Number(frame?.y)||0
  const width=Number(frame?.width), height=Number(frame?.height)
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null
  const sourceWidth=Number(intrinsic?.width), sourceHeight=Number(intrinsic?.height)
  if(fit==='cover'||!Number.isFinite(sourceWidth)||!Number.isFinite(sourceHeight)||sourceWidth<=0||sourceHeight<=0)
    return {x,y,width,height,fit:fit==='cover'?'cover':'contain'}
  const ratio=Math.min(width/sourceWidth,height/sourceHeight)
  const fittedWidth=sourceWidth*ratio, fittedHeight=sourceHeight*ratio
  return {x:x+(width-fittedWidth)/2,y:y+(height-fittedHeight)/2,width:fittedWidth,height:fittedHeight,fit:'contain'}
}

/** Convert a provisional placeholder to an image-sized object when its dimensions are known.
 * The returned coordinates can be persisted by the workspace; the input is untouched. */
export function fittedTechPackMediaObject(box,intrinsic,fit=box?.slot?.mediaFit){
  const bounds=fittedTechPackMediaBounds(box,intrinsic,fit)
  return bounds?{...box,x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height}:box
}
