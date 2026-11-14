/**
 * Deterministic, read-only pattern suggestions for the EXO drafting UI.
 *
 * ETH GarmentCodeData v2 is the research provenance of the optional catalog.
 * This module does not load the separately trained NPZ geometry/seam checkpoints;
 * scores are explicit geometric similarities, never model probabilities.
 */
const MAX_POINTS = 20000
const MAX_CANDIDATES = 2000
const EPS = 1e-8
const UNIT_TO_MM = Object.freeze({mm:1, cm:10, m:1000, in:25.4, inch:25.4, inches:25.4, ft:304.8})

function units(value) {
  return typeof value === 'string' && Object.hasOwn(UNIT_TO_MM, value.toLowerCase())
    ? value.toLowerCase() : null
}
function point(raw) {
  if (Array.isArray(raw) && raw.length >= 2 && Number.isFinite(raw[0]) && Number.isFinite(raw[1]))
    return {x:raw[0], y:raw[1]}
  if (raw && Number.isFinite(raw.x) && Number.isFinite(raw.y))
    return {x:raw.x, y:raw.y}
  return null
}
function outlineOf(panel) {
  if (Array.isArray(panel)) return panel
  return panel?.outline ?? panel?.points ?? panel?.vertices ?? panel?.polygon ?? null
}
function dist(a,b) {return Math.hypot(b.x-a.x,b.y-a.y)}
function clamp(n) {return Math.max(0,Math.min(1,n))}
function polygonStats(points) {
  let signedArea=0, perimeter=0
  for (let i=0;i<points.length;i++) {
    const a=points[i], b=points[(i+1)%points.length]
    signedArea+=a.x*b.y-b.x*a.y
    perimeter+=dist(a,b)
  }
  return {area:Math.abs(signedArea)/2,perimeter}
}
function metadata(source) {
  const result={}
  if (typeof source?.id==='string' || Number.isSafeInteger(source?.id)) result.id=source.id
  if (typeof source?.name==='string') result.name=source.name.slice(0,160)
  if (typeof source?.sourceSha256==='string' && /^[a-f0-9]{64}$/i.test(source.sourceSha256)) result.sourceSha256=source.sourceSha256
  if (typeof source?.sourcePath==='string') result.sourcePath=source.sourcePath
  return result
}
/**
 * Source coordinates must carry known units, either on the panel or in options.
 * Incomplete/nonfinite/self-degenerate input is rejected with a reason.
 * Polygon vertices must be ordered around the outline (no implicit sorting).
 */
export function describePatternGeometry(panel, options={}) {
  const unit=units(options.units ?? panel?.units ?? panel?.unit)
  if (!unit) return {ok:false,reason:'explicit_supported_units_required'}
  const raw=outlineOf(panel)
  if (!Array.isArray(raw) || raw.length<3 || raw.length>MAX_POINTS)
    return {ok:false,reason:'invalid_outline_point_count'}
  const points=raw.map(point)
  if (points.some(p=>!p)) return {ok:false,reason:'nonfinite_outline_coordinate'}
  if (points.length>3 && dist(points[0],points[points.length-1])<EPS) points.pop()
  if (points.length<3) return {ok:false,reason:'degenerate_outline'}
  const factor=UNIT_TO_MM[unit]
  const mm=points.map(p=>({x:p.x*factor,y:p.y*factor}))
  if(mm.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))
    return {ok:false,reason:'coordinate_overflow'}
  const {area,perimeter}=polygonStats(mm)
  const xs=mm.map(p=>p.x), ys=mm.map(p=>p.y)
  const width=Math.max(...xs)-Math.min(...xs), height=Math.max(...ys)-Math.min(...ys)
  if (!(area>EPS) || !(perimeter>EPS) || !(width>EPS) || !(height>EPS))
    return {ok:false,reason:'degenerate_outline'}
  const bboxArea=width*height
  const compactness=clamp(4*Math.PI*area/(perimeter*perimeter))
  const edges=mm.map((p,i)=>dist(p,mm[(i+1)%mm.length]))
  return {
    ok:true, units:'mm', inputUnits:unit, provenance:metadata(panel),
    pointCount:mm.length, widthMm:width, heightMm:height,
    areaMm2:area, perimeterMm:perimeter, compactness,
    fillRatio:clamp(area/bboxArea), aspectRatio:Math.max(width,height)/Math.min(width,height),
    edgeLengthsMm:edges, method:'outline_geometry_heuristic_v1',
    trainedModelUsed:false
  }
}
function geometryScore(a,b) {
  const ratio=(x,y)=>Math.exp(-Math.abs(Math.log(x/y)))
  const features=[
    ratio(a.areaMm2,b.areaMm2),
    ratio(a.perimeterMm,b.perimeterMm),
    ratio(a.aspectRatio,b.aspectRatio),
    1-Math.abs(a.fillRatio-b.fillRatio),
    1-Math.abs(a.compactness-b.compactness)
  ]
  return clamp(features[0]*0.30+features[1]*0.25+features[2]*0.20+features[3]*0.15+features[4]*0.10)
}
/**
 * Candidates: panel objects with outline, units and optional id/name/source.
 * Returned scores are heuristics in [0,1], NOT calibrated confidence.
 * Suggestions are never automatically written to a garment.
 */
export function recommendSimilarPatternPanels(target,candidates,options={}) {
  const base=describePatternGeometry(target,options)
  if(!base.ok) return {ok:false,reason:base.reason,suggestions:[]}
  if(!Array.isArray(candidates)) return {ok:false,reason:'candidates_array_required',suggestions:[]}
  const maxResults=Math.max(0,Math.min(50,Number.isInteger(options.limit)?options.limit:8))
  const suggestions=[]
  for(const candidate of candidates.slice(0,MAX_CANDIDATES)) {
    const geometry=describePatternGeometry(candidate,{units:options.candidateUnits})
    if(!geometry.ok) continue
    const score=geometryScore(base,geometry)
    suggestions.push({
      candidate:metadata(candidate),score:Number(score.toFixed(5)),scoreType:'geometric_similarity_not_probability',
      method:'outline_geometry_heuristic_v1',trainedModelUsed:false,
      dimensionsMm:{width:geometry.widthMm,height:geometry.heightMm},
      reviewRequired:true,applied:false
    })
  }
  suggestions.sort((a,b)=>b.score-a.score||String(a.candidate.id??'').localeCompare(String(b.candidate.id??'')))
  return {ok:true,method:'outline_geometry_heuristic_v1',trainedModelUsed:false,
    input:base.provenance,examined:Math.min(candidates.length,MAX_CANDIDATES),
    suggestions:suggestions.slice(0,maxResults),truncated:candidates.length>MAX_CANDIDATES}
}
function readEdge(edge, fallbackUnits) {
  const unit=units(edge?.units??edge?.unit??fallbackUnits??(Number.isFinite(edge?.lengthMm)?'mm':null))
  if(!unit)return null
  let length=Number.isFinite(edge?.lengthMm) ? edge.lengthMm : null
  if (length===null && Number.isFinite(edge?.length)) length=edge.length*UNIT_TO_MM[unit]
  if (length===null) {
    const a=point(edge?.a??edge?.start),b=point(edge?.b??edge?.end)
    if(a&&b) length=dist(a,b)*UNIT_TO_MM[unit]
  }
  if(!Number.isFinite(length)||length<=EPS)return null
  return {lengthMm:length,id:edge.id??null,panelId:edge.panelId??null,
    source:metadata(edge),orientation:edge.orientation??null}
}
/**
 * Ranks potential sewing partners by edge-length compatibility, with an
 * explicit absolute tolerance in mm. Equal lengths alone do NOT prove a seam.
 */
export function recommendSeamPartners(targetEdge,candidateEdges,options={}) {
  const target=readEdge(targetEdge,options.units)
  if(!target) return {ok:false,reason:'target_edge_or_units_invalid',suggestions:[]}
  if(!Array.isArray(candidateEdges))return {ok:false,reason:'candidate_edges_array_required',suggestions:[]}
  const toleranceMm=Number.isFinite(options.toleranceMm)&&options.toleranceMm>=0?Math.min(options.toleranceMm,1000):5
  const limit=Math.max(0,Math.min(50,Number.isInteger(options.limit)?options.limit:8))
  const suggestions=[]
  for(const edge of candidateEdges.slice(0,MAX_CANDIDATES)) {
    const parsed=readEdge(edge,options.units)
    if(!parsed || (parsed.id!==null&&target.id!==null&&parsed.id===target.id&&parsed.panelId===target.panelId))continue
    const differenceMm=Math.abs(target.lengthMm-parsed.lengthMm)
    if(differenceMm>toleranceMm)continue
    const score=clamp(1-differenceMm/Math.max(target.lengthMm,parsed.lengthMm))
    suggestions.push({edgeId:parsed.id,panelId:parsed.panelId,source:parsed.source,
      edgeLengthMm:parsed.lengthMm,lengthDifferenceMm:differenceMm,
      score:Number(score.toFixed(5)),scoreType:'length_compatibility_not_probability',
      method:'seam_length_heuristic_v1',trainedModelUsed:false,
      reviewRequired:true,applied:false,
      caveat:'Verify seam topology, curves, orientation, notches, allowance and ease before sewing.'})
  }
  suggestions.sort((a,b)=>a.lengthDifferenceMm-b.lengthDifferenceMm||String(a.edgeId).localeCompare(String(b.edgeId)))
  return {ok:true,method:'seam_length_heuristic_v1',trainedModelUsed:false,
    targetLengthMm:target.lengthMm,toleranceMm,
    suggestions:suggestions.slice(0,limit),examined:Math.min(candidateEdges.length,MAX_CANDIDATES),
    truncated:candidateEdges.length>MAX_CANDIDATES}
}
