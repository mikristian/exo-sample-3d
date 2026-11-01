/** Place the floating table editor on the canvas, near the table without hiding the entire page. */
export function techPackTablePopoverPosition({anchor,canvas,viewport,width=690,height=470}={}){
  const vw=Math.max(320,Number(viewport?.width)||1280),vh=Math.max(320,Number(viewport?.height)||800)
  const w=Math.min(width,vw-16),h=Math.min(height,vh-16)
  const bounds=canvas&&Number.isFinite(canvas.left)?canvas:{left:0,right:vw,top:0,bottom:vh}
  const item=anchor&&Number.isFinite(anchor.left)?anchor:bounds
  const preferredRight=item.right+12
  const preferredLeft=item.left-w-12
  let left=preferredRight+w<Math.min(vw-8,bounds.right)?preferredRight:
    preferredLeft>=Math.max(8,bounds.left)?preferredLeft:
    item.left+(item.right-item.left-w)/2
  const minLeft=Math.max(8,Math.min(vw-w-8,bounds.left+4))
  const maxLeft=Math.max(minLeft,Math.min(vw-w-8,bounds.right-w-4))
  left=Math.max(minLeft,Math.min(maxLeft,left))
  const nearTop=item.top+Math.min(20,Math.max(0,(item.bottom-item.top)/6))
  const minTop=Math.max(8,Math.min(vh-h-8,bounds.top+4))
  const maxTop=Math.max(minTop,Math.min(vh-h-8,bounds.bottom-h-4))
  return {left:Math.round(Math.max(minLeft,Math.min(maxLeft,left))),
    top:Math.round(Math.max(minTop,Math.min(maxTop,nearTop)))}
}
