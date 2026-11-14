import {cloneProject,edgeLength,edgeRangeLength} from './project.js'
import {inspectIndustrialPatterns} from './industrialPatternQA.js'
import {transformHoodieFitGeometry} from './exoHoodieFitGeometry20261102.js'

const fail=(reason,extra={})=>({ok:false,reason,...extra})
const finite=n=>typeof n==='number'&&Number.isFinite(n)
const norm=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)
const get=(p,id)=>p.pieces.find(piece=>piece.id===id)

// For a quadratic edge, vary the perpendicular displacement of its control
// from the chord midpoint. The chord length is the geometric lower bound.
function trueCurvedEdge(piece,index,targetCm) {
  const a=piece.points[index],b=piece.points[(index+1)%piece.points.length]
  const chord=norm(a,b)
  if(!finite(targetCm)||!a||!b||!piece.curves?.[index]||chord<1e-5||targetCm<chord-0.02)return false
  const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2}
  const tangent={x:(b.x-a.x)/chord,y:(b.y-a.y)/chord}
  const normal={x:-tangent.y,y:tangent.x}
  const existing=piece.curves[index]
  const sign=Math.sign((existing.cx-mid.x)*normal.x+(existing.cy-mid.y)*normal.y)||1
  const original={...existing}
  const length=offset=>{
    existing.cx=mid.x+normal.x*offset*sign
    existing.cy=mid.y+normal.y*offset*sign
    return edgeLength(piece,index)
  }
  if(targetCm-chord<0.0001){length(0);return true}
  let lo=0,hi=1
  while(length(hi)<targetCm&&hi<36)hi*=2
  if(hi>36){Object.assign(existing,original);return false}
  for(let i=0;i<52;i++){
    const m=(lo+hi)/2
    if(length(m)<targetCm)lo=m
    else hi=m
  }
  length((lo+hi)/2)
  return Math.abs(edgeLength(piece,index)-targetCm)<0.025
}

function trueSleeves(project) {
  const changes=[]
  for(const id of ['sleeve-left','sleeve-right']){
    const sleeve=get(project,id)
    if(!sleeve||sleeve.points.length!==7||![0,1,5,6].every(i=>sleeve.curves?.[i]))return null
    // The stock lower cap chords exceed the authored lower armscyes slightly.
    // Move the two symmetric underarm corners inward, within a 1.5 cm bound.
    const lowerSeam=project.seams.find(s=>s.b?.pieceId===id&&s.b?.edgeIndex===1&&s.id?.startsWith('seam-sleeve-'))
    if(!lowerSeam)return null
    const lowerBody=get(project,lowerSeam.a.pieceId)
    const lowerTarget=edgeRangeLength(lowerBody,lowerSeam.a.edgeIndex,lowerSeam.a.startT??0,lowerSeam.a.endT??1)
    if(norm(sleeve.points[1],sleeve.points[2])>lowerTarget){
      const dy=sleeve.points[2].y-sleeve.points[1].y
      const usable=lowerTarget-0.06
      if(usable<=Math.abs(dy))return null
      const dx=Math.sqrt(usable*usable-dy*dy)
      const leftX=sleeve.points[1].x-dx,rightX=-leftX
      if(Math.abs(sleeve.points[2].x-leftX)>1.5||Math.abs(sleeve.points[5].x-rightX)>1.5)return null
      sleeve.points[2].x=leftX;sleeve.points[5].x=rightX
    }
    for(const index of [0,1,5,6]){
      const seam=project.seams.find(s=>s.b?.pieceId===id&&s.b?.edgeIndex===index&&s.id?.startsWith('seam-sleeve-'))
      if(!seam)return null
      const body=get(project,seam.a.pieceId)
      if(!body)return null
      const target=edgeRangeLength(body,seam.a.edgeIndex,seam.a.startT??0,seam.a.endT??1)
      const before=edgeLength(sleeve,index)
      if(!trueCurvedEdge(sleeve,index,target))return null
      changes.push({pieceId:id,edgeIndex:index,beforeCm:before,afterCm:edgeLength(sleeve,index),targetCm:target})
    }
  }
  return changes
}

function scaleRibX(piece,scale) {
  if(!finite(scale)||scale<0.5||scale>2)return false
  const origin=piece.points.reduce((sum,p)=>sum+p.x,0)/piece.points.length
  const change=p=>{if(finite(p?.x))p.x=origin+(p.x-origin)*scale;if(finite(p?.cx))p.cx=origin+(p.cx-origin)*scale}
  piece.points.forEach(change)
  Object.values(piece.curves||{}).forEach(change)
  for(const line of piece.internalLines||[]){change(line.a);change(line.b)}
  return true
}

function fitSplitFrontZipHoodie(source,widthScale,bodyLengthDeltaCm){
  const project=cloneProject(source)
  const required=['front-left','front-right','back','sleeve-left','sleeve-right','hood-left','hood-right','rib-waistband','rib-cuff-left','rib-cuff-right']
  if(required.some(id=>!get(project,id)))throw Error('Split-front zip hoodie topology missing authored panels')
  const transformPoint=(p,lowerOnly=false)=>{
    if(!p||typeof p!=='object')return
    if(finite(p.x))p.x*=widthScale
    if(finite(p.cx))p.cx*=widthScale
    if(!lowerOnly)return
    const underarm=50
    const scaleY=(underarm+bodyLengthDeltaCm)/underarm
    if(finite(p.y)&&p.y<underarm)p.y=underarm+(p.y-underarm)*scaleY
    if(finite(p.cy)&&p.cy<underarm)p.cy=underarm+(p.cy-underarm)*scaleY
  }
  for(const piece of project.pieces){
    const torso=['front-left','front-right','back'].includes(piece.id)
    piece.points.forEach(p=>transformPoint(p,torso))
    Object.values(piece.curves||{}).forEach(p=>transformPoint(p,torso))
    for(const line of piece.internalLines||[]){transformPoint(line.a,torso);transformPoint(line.b,torso)}
    for(const item of piece.surfaceAttachments||[]){transformPoint(item.targetA,torso);transformPoint(item.targetB,torso)}
  }
  // Hood opening is sewn to four separate source neckline edges on each side.
  // Reposition those four authored straight segments to their real arc lengths.
  for(const id of ['hood-left','hood-right']){
    const hood=get(project,id),startX=hood.points[0].x,originalTotal=hood.points[4].x-startX
    let cursor=startX
    for(let i=0;i<4;i++){
      const seam=project.seams.find(s=>s.id===`${id}-neck-${i}`)
      if(!seam||seam.a?.pieceId!==id||seam.a.edgeIndex!==i)throw Error('Hood neckline construction mismatch')
      const body=get(project,seam.b.pieceId)
      cursor+=edgeRangeLength(body,seam.b.edgeIndex,seam.b.startT??0,seam.b.endT??1)
      hood.points[i+1].x=cursor
    }
    if(!finite(originalTotal)||originalTotal<1)throw Error('Hood neckline has invalid span')
    const factor=(cursor-startX)/originalTotal
    for(let i=5;i<hood.points.length;i++)hood.points[i].x=startX+(hood.points[i].x-startX)*factor
    for(const [i,c] of Object.entries(hood.curves||{}))if(Number(i)>=4)c.cx=startX+(c.cx-startX)*factor
  }
  return project
}

function trueRibs(project) {
  const changes=[]
  for(const side of ['left','right']){
    const id=`rib-cuff-${side}`,cuff=get(project,id),seam=project.seams.find(s=>s.id===`${id}-attach`)
    if(!cuff||!seam||seam.a.pieceId!==id||seam.a.edgeIndex!==2)return null
    const sleeve=get(project,seam.b.pieceId)
    const target=edgeLength(sleeve,seam.b.edgeIndex),before=edgeLength(cuff,2)
    if(!scaleRibX(cuff,target/before))return null
    changes.push({pieceId:id,beforeCm:before,afterCm:edgeLength(cuff,2),targetCm:target})
  }
  const rib=get(project,'rib-waistband')
  if(!rib||![6,7].includes(rib.points.length))return null
  const frontSeams=project.seams.filter(s=>s.id==='rib-waistband-front'||s.id==='rib-waistband-left-front'||s.id==='rib-waistband-right-front')
  const backSeam=project.seams.find(s=>s.id==='rib-waistband-back')
  if(!frontSeams.length||!backSeam)return null
  const frontTargets=frontSeams.map(seam=>edgeRangeLength(get(project,seam.b.pieceId),seam.b.edgeIndex,seam.b.startT??0,seam.b.endT??1))
  const frontTarget=frontTargets.reduce((total,length)=>total+length,0)
  const backTarget=edgeRangeLength(get(project,backSeam.b.pieceId),backSeam.b.edgeIndex,backSeam.b.startT??0,backSeam.b.endT??1)
  if(!finite(frontTarget)||!finite(backTarget)||frontTarget<=0||backTarget<=0)return null
  const edgeTargets=rib.points.length===6?[frontTarget,backTarget]:[...frontTargets,backTarget]
  if(edgeTargets.length!==rib.points.length-4||edgeTargets.some(v=>!finite(v)||v<=0))return null
  const oldEdges=edgeTargets.map((_,i)=>edgeLength(rib,i)),oldTotal=oldEdges.reduce((a,b)=>a+b,0)
  const left=rib.points[0].x
  const oldBoundaries=[left],newBoundaries=[left]
  for(let i=0;i<edgeTargets.length;i++){
    oldBoundaries.push(oldBoundaries.at(-1)+oldEdges[i])
    newBoundaries.push(newBoundaries.at(-1)+edgeTargets[i])
  }
  const oldXs=rib.points.map(p=>p.x)
  const mapX=x=>{
    const index=oldBoundaries.findIndex((bound,i)=>i<oldBoundaries.length-1&&x<=oldBoundaries[i+1]+1e-8)
    const i=index<0?oldBoundaries.length-2:index
    return newBoundaries[i]+(x-oldBoundaries[i])*(edgeTargets[i]/oldEdges[i])
  }
  rib.points.forEach((p,i)=>{p.x=mapX(oldXs[i])})
  for(const line of rib.internalLines||[]){if(line.a&&finite(line.a.x))line.a.x=mapX(line.a.x);if(line.b&&finite(line.b.x))line.b.x=mapX(line.b.x)}
  changes.push({pieceId:rib.id,beforeCm:oldTotal,afterCm:frontTarget+backTarget,targetCm:frontTarget+backTarget})
  return changes
}

/** Rebuilds authored sleeve and rib stitchlines against their actual seam partners.
 * Leaves the original untouched. Validates base size using unmodified industrial QA.
 */
export function trueHoodieTemplateSeams20261102(source,{widthScale=1,bodyLengthDeltaCm=0}={}) {
  if(!['hoodie','zip-hoodie'].includes(source?.templateId))return fail('Requires a built-in hoodie or zip-hoodie template.')
  if(!finite(widthScale)||widthScale<0.8||widthScale>1.5||!finite(bodyLengthDeltaCm)||Math.abs(bodyLengthDeltaCm)>20)
    return fail('Unsupported hoodie styling dimensions.')
  let project
  try {
    if(widthScale!==1||bodyLengthDeltaCm!==0){
      project=source.templateId==='zip-hoodie'
        ?fitSplitFrontZipHoodie(source,widthScale,bodyLengthDeltaCm)
        :transformHoodieFitGeometry(source,{widthScale,bodyLengthDeltaCm}).project
    }else project=cloneProject(source)
  }catch(error){return fail(`Fit transform failed: ${error.message}`)}
  const originalPieceIds=source.pieces.map(p=>p.id),originalSeamIds=source.seams.map(s=>s.id)
  const sleeveChanges=trueSleeves(project)
  if(!sleeveChanges)return fail('Sleeve-cap trueing failed: target shorter than chord or unsupported sleeve topology.')
  const ribChanges=trueRibs(project)
  if(!ribChanges)return fail('Rib trueing failed: unsupported cuff or waistband topology.')
  if(JSON.stringify(originalPieceIds)!==JSON.stringify(project.pieces.map(p=>p.id))||JSON.stringify(originalSeamIds)!==JSON.stringify(project.seams.map(s=>s.id)))
    return fail('Trueing unexpectedly modified sewn topology.')
  const size=project.grading?.baseSize||'M'
  const qa=inspectIndustrialPatterns(project,{sizes:[size]})
  if(qa.status!=='pass'||qa.seamReports.some(s=>!s.pass))return fail('Trued garment failed independent base-size industrial QA.',{qa})
  project.patternGeneration={...(project.patternGeneration||{}),method:'hoodie_template_seam_trueing_v1',reviewRequired:true,physicalFitVerified:false,fitVerified:false,factoryApproved:false,manufacturingApproved:false,gradedProductionApproved:false}
  return {ok:true,project,qa,report:{templateId:source.templateId,baseSize:size,sleeveChanges,ribChanges,verifiedSeamCount:qa.seamReports.length,allBaseSeamsPass:true,physicalFitVerified:false,factoryApproved:false}}
}

export default trueHoodieTemplateSeams20261102
