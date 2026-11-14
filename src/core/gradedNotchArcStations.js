// Pure station geometry; no dependency on the grading orchestrator.
import {cloneProject,edgeLength,edgePointAt} from './project.js'
export function station(piece,notch,rule) {
  const length=edgeLength(piece,notch.edgeIndex)
  if(!Number.isFinite(length)||!(rule.distanceCm>0)||!(rule.distanceCm<length-1e-9)) throw new Error('Notch station outside edge length')
  const t=rule.from==='end'?1-rule.distanceCm/length:rule.distanceCm/length
  const point=edgePointAt(piece,notch.edgeIndex,t,64)?.point
  if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)) throw new Error('Invalid notch station point')
  return {t,length,point}
}
export function applyAccuMarkNotchArcStationsToGraded(gradedProject,sourceProject,size) {
  if(!(sourceProject?.pieces??[]).some(piece=>(piece.notches??[]).some(notch=>notch.gradeArcStation))) return gradedProject
  const next=cloneProject(gradedProject)
  for(const sourcePiece of sourceProject?.pieces??[]) {
    const rules=(sourcePiece.notches??[]).filter(n=>n.gradeArcStation)
    if(!rules.length)continue
    const target=next.pieces?.find(p=>p.id===sourcePiece.id)
    if(!target)throw new Error('Missing graded piece '+sourcePiece.id+' at '+size)
    for(const sourceNotch of rules) {
      const rule=sourceNotch.gradeArcStation
      if(rule.version!==1||!Number.isFinite(rule.distanceCm)||!['start','end'].includes(rule.from))throw new Error('Invalid grade arc station')
      const notch=target.notches?.find(n=>n.id===sourceNotch.id)
      if(!notch||notch.edgeIndex!==sourceNotch.edgeIndex)throw new Error('Stale notch topology at '+size)
      const {t,point}=station(target,notch,rule)
      notch.t=t
      if('x' in notch && 'y' in notch){notch.x=point.x;notch.y=point.y}
    }
  }
  return next
}
