import {techPackPageLayout,applyTechPackPageLayout} from './techPackPageLayout.js'

// The tech-pack editor uses physical paper pixels. Resize only page objects;
// NEVER rescale garment grading, cutting patterns or factory measurements.
export function techPackArtboardSize(layout={}){
  const a4=layout.paperSize==='A4'
  return layout.orientation==='landscape'?
    {width:a4?842:792,height:a4?595:612}:
    {width:a4?595:612,height:a4?842:792}
}

const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback
const positive=(value,fallback)=>Math.max(1,number(value,fallback))
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n))

function reflowFramedBoxes(boxes,from,to){
  const old=techPackArtboardSize(from),next=techPackArtboardSize(to)
  const frameX=26,frameTop=34,contentTop=110,frameInset=52
  const oldFrameBottom=old.height-52,newFrameBottom=next.height-52
  const xScale=(next.width-frameInset)/(old.width-frameInset)
  const existingBottom=boxes.filter(item=>item.slot?.templateRole==='bottom-table')
  const oldContentBottom=existingBottom.length?Math.min(...existingBottom.map(b=>number(b.y,oldFrameBottom)-12)):oldFrameBottom-14
  const newContentBottom=existingBottom.length?Math.min(...existingBottom.map(b=>newFrameBottom-positive(b.height,145)-12)):newFrameBottom-14
  const yScale=Math.max(.2,(newContentBottom-contentTop)/Math.max(1,oldContentBottom-contentTop))
  const mapX=x=>frameX+(x-frameX)*xScale
  const mapY=y=>contentTop+(y-contentTop)*yScale
  const result=boxes.map(box=>{
    if(box.positionMode!=='absolute')return box
    const role=box.slot?.templateRole
    if(role==='shared-header')return {...box,x:frameX,y:frameTop,width:next.width-frameInset}
    if(role==='bottom-table')return {...box,x:frameX,y:newFrameBottom-positive(box.height,145),width:next.width-frameInset}
    const width=clamp(positive(box.width,150)*xScale,18,next.width-frameInset)
    const height=clamp(positive(box.height,80)*yScale,18,Math.max(18,newContentBottom-contentTop))
    return {...box,x:clamp(mapX(number(box.x,39)),frameX,next.width-26-width),
      y:clamp(mapY(number(box.y,120)),contentTop,Math.max(contentTop,newContentBottom-height)),width,height}
  })
  return {boxes:result,mapPoint:([x,y])=>[mapX(number(x)),mapY(number(y))]}
}

function reflowUnframedBoxes(boxes,from,to){
  const old=techPackArtboardSize(from),next=techPackArtboardSize(to)
  const sx=next.width/old.width,sy=next.height/old.height
  return {boxes:boxes.map(box=>{
    if(box.positionMode!=='absolute')return box
    const width=clamp(positive(box.width,150)*sx,18,next.width)
    const height=clamp(positive(box.height,80)*sy,18,next.height)
    return {...box,x:clamp(number(box.x)*sx,0,next.width-width),
      y:clamp(number(box.y)*sy,0,next.height-height),width,height}
  }),mapPoint:([x,y])=>[number(x)*sx,number(y)*sy]}
}

export function reflowTechPackPageLayout(workspace={},patch={}){
  const updated=applyTechPackPageLayout(workspace,patch)
  const pageBoxes={...workspace.pageBoxes},annotations={...workspace.annotations}
  let changed=false
  for(const [pageId,boxes] of Object.entries(workspace.pageBoxes||{})){
    if(!Array.isArray(boxes)||!boxes.length)continue
    const before=techPackPageLayout(workspace,pageId)
    const after=techPackPageLayout(updated,pageId)
    if(before.orientation===after.orientation&&before.paperSize===after.paperSize)continue
    const framed=Boolean(workspace.pages?.[pageId]?.minimalFramedTemplate)
    const result=framed?reflowFramedBoxes(boxes,before,after):reflowUnframedBoxes(boxes,before,after)
    pageBoxes[pageId]=result.boxes
    annotations[pageId]=(workspace.annotations?.[pageId]||[]).map(item=>
      Array.isArray(item.points)?{...item,points:item.points.map(point=>Array.isArray(point)&&point.length===2?result.mapPoint(point):point)}:item)
    changed=true
  }
  return changed?{...updated,pageBoxes,annotations}:updated
}
