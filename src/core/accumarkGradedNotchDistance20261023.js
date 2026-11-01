import {cloneProject} from './project.js'
import {station} from './gradedNotchArcStations.js'
export {applyAccuMarkNotchArcStationsToGraded} from './gradedNotchArcStations.js'
import {gradeProject} from './grading.js'

const validId = value => typeof value === 'string' && value.trim().length > 0
const sizesOf = project => project?.grading?.sizes?.length ? project.grading.sizes : [project?.grading?.baseSize ?? 'M']
function locate(project,pieceId,notchId) {
  if(!validId(pieceId)||!validId(notchId)) throw new Error('Valid pieceId and notchId required')
  const piece=project?.pieces?.find(p=>p.id===pieceId)
  if(!piece) throw new Error('Missing piece '+pieceId)
  const notch=piece.notches?.find(n=>n.id===notchId)
  if(!notch) throw new Error('Missing notch '+notchId)
  if(!Number.isInteger(notch.edgeIndex)||notch.edgeIndex<0||notch.edgeIndex>=piece.points.length) throw new Error('Invalid notch edge')
  return {piece,notch}
}
export function applyAccuMarkGradedNotchDistance(project,{pieceId,notchId,distanceCm,from='start'}={}) {
  if(!Number.isFinite(distanceCm)||distanceCm<=0||!['start','end'].includes(from))throw new Error('Invalid positive distanceCm or direction')
  const {piece,notch}=locate(project,pieceId,notchId)
  const rule={distanceCm,from,version:1}
  const base=station(piece,notch,rule)
  const sizes=sizesOf(project)
  if(new Set(sizes).size!==sizes.length)throw new Error('Duplicate grading sizes')
  const validation=[]
  for(const size of sizes) {
    const graded=gradeProject(project,size)
    const located=locate(graded,pieceId,notchId)
    if(located.notch.edgeIndex!==notch.edgeIndex)throw new Error('Stale notch topology at '+size)
    const result=station(located.piece,located.notch,rule)
    validation.push({size,edgeLengthCm:result.length,t:result.t,distanceCm})
  }
  const next=cloneProject(project)
  const edited=locate(next,pieceId,notchId).notch
  edited.gradeArcStation=rule
  edited.t=base.t
  if('x' in edited && 'y' in edited){edited.x=base.point.x;edited.y=base.point.y}
  return {project:next,validation:{sizes:[...sizes],stations:validation,factoryCertified:false}}
}
export function inspectAccuMarkGradedNotchDistance(project,{pieceId,notchId}={}) {
  const {notch}=locate(project,pieceId,notchId)
  if(!notch.gradeArcStation)throw new Error('Notch has no grade arc station')
  const rows=sizesOf(project).map(size=>{
    const graded=gradeProject(project,size)
    const located=locate(graded,pieceId,notchId)
    if(located.notch.edgeIndex!==notch.edgeIndex)throw new Error('Stale notch topology at '+size)
    const result=station(located.piece,located.notch,notch.gradeArcStation)
    return {size,edgeLengthCm:result.length,t:result.t,distanceCm:notch.gradeArcStation.distanceCm,x:result.point.x,y:result.point.y}
  })
  return {pieceId,notchId,gradeArcStation:cloneProject(notch.gradeArcStation),rows}
}
