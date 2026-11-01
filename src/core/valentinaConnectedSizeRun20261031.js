import {parseValentinaConstructionReference} from './valentinaConstructionReference20261031.js'
import {evaluateValentinaExtendedGeometry20261031} from './valentinaExtendedGeometry20261031.js'
import {evaluateValentinaSizeRun20261031} from './valentinaGradedMeasurements20261031.js'

/** Recalculate the actual connected Valentina source-point graph for every
 * requested source measurement size/height step. Not an industrial CUT grade.
 */
export function evaluateValentinaConnectedSizeRun20261031(source,measurements,{
  sizeSteps=[-2,-1,0,1,2],heightSteps=[0],maxCases=15,maxPoints=2000,
}={}){
  const reference=typeof source==='string'?parseValentinaConstructionReference(source):source
  if(reference?.format!=='exo-valentina-construction-reference.v1')
    throw Error('Original Valentina source construction required')
  if(!Number.isInteger(maxPoints)||maxPoints<1||maxPoints>6000)
    throw Error('Valentina connected source point budget out of range')
  const graded=evaluateValentinaSizeRun20261031(measurements,{
    sizeSteps,heightSteps,patternUnit:reference.unit,maxCases})
  const cases=[]
  for(const caseMeasurements of graded.cases){
    const resolved=evaluateValentinaExtendedGeometry20261031(reference,{
      measurements:caseMeasurements.measurements,maxPoints})
    if(!resolved.pointCount)throw Error('No evaluable Valentina source construction points for graded case')
    const keyed={}
    for(const [blockIndex,block] of resolved.blocks.entries())for(const p of block.points){
      const key=`${blockIndex}:${p.id}`
      if(Object.hasOwn(keyed,key))throw Error('Duplicate source construction point identity in size run')
      keyed[key]={id:p.id,blockIndex,name:p.name,x:p.x,y:p.y}
    }
    cases.push({sizeSteps:caseMeasurements.sizeSteps,heightSteps:caseMeasurements.heightSteps,
      measurements:caseMeasurements.measurements,points:keyed,
      pointCount:resolved.pointCount,diagnostics:resolved.diagnostics})
  }
  const baseline=cases.find(x=>x.sizeSteps===0&&x.heightSteps===0)||cases[0]
  const comparisons=[]
  for(const candidate of cases){
    let commonCount=0,movedCount=0,maxPointShift=0
    const changed=[]
    for(const [id,b] of Object.entries(baseline.points)){
      const p=candidate.points[id]
      if(!p)continue
      commonCount++
      const distance=Math.hypot(b.x-p.x,b.y-p.y)
      if(distance>1e-7){
        movedCount++
        if(distance>maxPointShift)maxPointShift=distance
        changed.push({point:id,from:{x:b.x,y:b.y},to:{x:p.x,y:p.y},distance})
      }
    }
    comparisons.push({sizeSteps:candidate.sizeSteps,heightSteps:candidate.heightSteps,
      commonCount,movedCount,maxPointShift,changed})
  }
  return {format:'exo-valentina-connected-size-run.v1',sourceUnit:reference.unit,
    cases,comparisons,pointCount:baseline.pointCount,
    manufacturingApproved:false,qualification:'Source point geometry across real measurement grades; source CUT outlines, seam paths and factory plot acceptance not independently verified.'}
}
