import {describePatternGeometry} from './exoPatternIntelligence20261102.js'

const copy = value => structuredClone(value)
const finite = value => typeof value === 'number' && Number.isFinite(value)
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y)

/** Conservative garment-wide parametric draft. Geometry retrieval is advisory; no model inference is claimed. */
export function generateEditablePatternCandidate(project, {scalePercent=0}={}) {
  const scale=1+Number(scalePercent)/100
  if (!finite(scale) || scale<0.95 || scale>1.05) return {ok:false,reason:'Scale must be within -5% and +5%.'}
  if (!project || project.units!=='cm' || !Array.isArray(project.pieces) || !project.pieces.length) return {ok:false,reason:'A garment with centimeter units and editable pieces is required.'}
  if (project.modarisSizeLinkedGrade !== undefined) return {ok:false,reason:'Connected industrial grading must be edited through its source-linked authoring tools.'}
  const identifiers=new Set()
  for (const piece of project.pieces) {
    if (!piece?.id || identifiers.has(piece.id)) return {ok:false,reason:'Pattern piece identifiers must be unique.'}
    identifiers.add(piece.id)
    if (!Array.isArray(piece.points) || piece.points.length<3 || piece.points.some(p=>!finite(p.x)||!finite(p.y))) return {ok:false,reason:`Piece ${piece.name||piece.id} has an invalid outline.`}
    const geometry=describePatternGeometry(piece,{units:'cm'})
    if (!geometry.ok) return {ok:false,reason:`Piece ${piece.name||piece.id}: ${geometry.reason}.`}
    if (piece.points.some((p,i)=>distance(p,piece.points[(i+1)%piece.points.length])<1e-6)) return {ok:false,reason:`Piece ${piece.name||piece.id} contains a zero-length edge.`}
    if (piece.curves && (typeof piece.curves!=='object'||Object.values(piece.curves).some(c=>!finite(c?.cx)||!finite(c?.cy)))) return {ok:false,reason:`Piece ${piece.name||piece.id} has unsupported curve controls.`}
  }
  for (const seam of project.seams||[]) for (const side of ['a','b']) {
    const endpoint=seam?.[side],piece=project.pieces.find(item=>item.id===endpoint?.pieceId)
    if (!piece || !Number.isInteger(endpoint.edgeIndex) || endpoint.edgeIndex<0 || endpoint.edgeIndex>=piece.points.length) return {ok:false,reason:`Seam ${seam?.name||seam?.id||'?'} has an invalid ${side} endpoint.`}
  }
  const candidate=copy(project)
  for (const piece of candidate.pieces) {
    const bounds={minX:Math.min(...piece.points.map(p=>p.x)),maxX:Math.max(...piece.points.map(p=>p.x)),minY:Math.min(...piece.points.map(p=>p.y)),maxY:Math.max(...piece.points.map(p=>p.y))}
    const cx=(bounds.minX+bounds.maxX)/2,cy=(bounds.minY+bounds.maxY)/2
    const transform=(p,x,y)=>({...p,[x]:cx+(p[x]-cx)*scale,[y]:cy+(p[y]-cy)*scale})
    piece.points=piece.points.map(p=>transform(p,'x','y'))
    if (piece.curves) piece.curves=Object.fromEntries(Object.entries(piece.curves).map(([key,value])=>[key,transform(value,'cx','cy')]))
    if (finite(piece.seamAllowance)) piece.seamAllowance*=scale
    for (const notch of piece.notches||[]) if (finite(notch.depthCm)) notch.depthCm*=scale
    for (const stitch of piece.topstitches||[]) {if(finite(stitch.offsetCm)) stitch.offsetCm*=scale;if(finite(stitch.rowGapCm)) stitch.rowGapCm*=scale}
    for (const binding of piece.bindings||[]) if(finite(binding.widthCm)) binding.widthCm*=scale
  }
  if (candidate.grading) {
    for(const key of ['widthPerSizeCm','lengthPerSizeCm']) if(finite(candidate.grading[key])) candidate.grading[key]*=scale
  }
  candidate.id=`${project.id||'garment'}-generated-${Date.now()}`
  candidate.name=`${project.name||'Garment'} · Draft ${scalePercent>=0?'+':''}${Number(scalePercent)}%`
  candidate.revision=(Number(project.revision)||0)+1
  candidate.updatedAt=new Date().toISOString()
  candidate.patternGeneration={method:'whole_garment_parametric_scale_v1',sourceProjectId:project.id,scalePercent:Number(scalePercent),trainedModelUsed:false,reviewRequired:true}
  return {ok:true,project:candidate,report:{pieceCount:candidate.pieces.length,seamCount:(candidate.seams||[]).length,scalePercent:Number(scalePercent),notches:candidate.pieces.reduce((sum,p)=>sum+(p.notches?.length||0),0),method:'Constrained editable parametric draft',caveat:'Inspect seam walking, grading, fabric behavior and fit before production.'}}
}
