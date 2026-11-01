// Read-only, revision-bound bridge between garment geometry and Tech Pack engineering.
// A geometric source observation never grants factory approval.
import {techPackSourceIdentity20261031} from './techPackSourceIdentity20261031.js'
const finite = value => typeof value === 'number' && Number.isFinite(value)
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const rows = value => Array.isArray(value) ? value : []
const copy = value => value == null ? value : structuredClone(value)
const identity = value => typeof value === 'string' && value.length > 0 ? value : null
const reference = (kind, id, revision, path) => ({kind, id, revision, path})
const measure = (value, unit, provenance) => ({value:finite(value)?value:null,unit:finite(value)?unit:null,status:finite(value)?'source':'unknown',provenance:finite(value)?provenance:null})
const unavailable = () => ({value:null,unit:null,status:'unknown',provenance:null})
const allowable = (value, unit, provenance) => finite(value) && value >= 0 ? measure(value,unit,provenance) : unavailable()
const signature = value => JSON.stringify(value)
const validRevision = value => (typeof value === 'string' && value.length>0) || (Number.isSafeInteger(value) && value>=0)

function nativeContours(panel, revision) {
  const poly=panel?.polygon
  if(!Array.isArray(poly?.points)||poly.points.length<3||poly.points.length>10000||
    !poly.points.every(point=>Array.isArray(point)&&point.length===2&&point.every(finite)))return null
  const edges=Array.isArray(poly.edges)&&poly.edges.length===poly.points.length&&
    poly.edges.every(identity)&&new Set(poly.edges).size===poly.edges.length ? [...poly.edges] : null
  const provenance=reference('panel',panel.id,revision,`template.panels.${panel.id}.polygon`)
  const validEdge=name=>Boolean(edges?.includes(name))
  const notches=[]
  if(edges&&object(poly.notches))for(const [edge,marks] of Object.entries(poly.notches)){
    if(!validEdge(edge)||!Array.isArray(marks))continue
    for(const [index,mark] of marks.entries())if(finite(mark?.t)&&mark.t>=0&&mark.t<=1){
      notches.push({id:`${edge}:${index}`,edge,t:mark.t,depth:allowable(mark.depth_m,'m',provenance),sourceRef:provenance})
    }
  }
  const seamAllowances=[]
  if(edges&&object(poly.seam_allowances))for(const edge of edges){
    const value=poly.seam_allowances[edge]
    seamAllowances.push({edge,width:allowable(value,'m',provenance)})
  }
  const holes=rows(poly.holes).map((hole,index)=>({id:identity(hole?.id)||`hole:${index}`,
    data:copy(hole),kind:'native-hole-unclassified',sourceRef:provenance}))
  return {points:copy(poly.points),pointUnit:'m',edges,curves:copy(poly.curves??{}),
    seamAllowances,notches,holes,grainline:copy(panel.grainline??panel.grain??null),
    grainlineStatus:panel.grainline!=null||panel.grain!=null?'source':'unknown',
    cutCount:Number.isSafeInteger(panel.cutCount??panel.quantity??panel.count)&&
      (panel.cutCount??panel.quantity??panel.count)>0?panel.cutCount??panel.quantity??panel.count:null,
    cutCountStatus:Number.isSafeInteger(panel.cutCount??panel.quantity??panel.count)&&
      (panel.cutCount??panel.quantity??panel.count)>0?'source':'unknown',sourceRef:provenance}
}

function projectContours(piece,revision){
  if(!Array.isArray(piece?.points)||piece.points.length<3||piece.points.length>10000||
    !piece.points.every(p=>object(p)&&finite(p.x)&&finite(p.y)))return null
  const provenance=reference('piece',piece.id,revision,`pieces.${piece.id}`)
  return {points:piece.points.map(p=>[p.x,p.y]),pointUnit:'cm',edges:null,
    curves:copy(piece.curves??{}),seamAllowances:[{edge:'default',width:allowable(piece.seamAllowance,'cm',provenance)}],
    notches:rows(piece.notches).filter(n=>Number.isInteger(n?.edgeIndex)&&n.edgeIndex>=0&&n.edgeIndex<piece.points.length&&finite(n.t)&&n.t>=0&&n.t<=1)
      .map((n,i)=>({id:identity(n.id)||`notch:${i}`,edgeIndex:n.edgeIndex,t:n.t,depth:allowable(n.depthCm,'cm',provenance),sourceRef:provenance})),
    holes:rows(piece.holes).map((hole,index)=>({id:identity(hole?.id)||`hole:${index}`,data:copy(hole),kind:'project-hole-unclassified',sourceRef:provenance})),
    grainline:copy(piece.grainline??null),grainlineStatus:piece.grainline!=null?'source':'unknown',
    cutCount:null,cutCountStatus:'unknown',sourceRef:provenance}
}

function sourcePOM(source,revision){
  const result=[]
  if(!object(source?.pom))return result
  for(const size of Object.keys(source.pom).sort())for(const row of rows(source.pom[size])){
    if(!identity(row?.id))continue
    result.push({size,id:row.id,label:row.label||row.id,
      actual:measure(row.cm,'cm',reference('pom',row.id,revision,`pom.${size}.${row.id}`)),
      tolerance:allowable(row.toleranceCm,'cm',reference('pom',row.id,revision,`pom.${size}.${row.id}`)),
      status:'source-observation',manufacturingApproved:false})
  }
  return result
}

/** snapshot is a native snapshot; project is a legacy project. Native data takes precedence
 * only when explicit nativeMode is true; no cross-source geometry mixing. */
export function deriveTechPackLiveEngineering20261031({snapshot=null,project=null,source=null,nativeMode=true,gradeRun=null}={}){
  const native=nativeMode===true
  const origin=native?snapshot:project
  const sourceIdentity=techPackSourceIdentity20261031({source:source||{},snapshot,project,nativeMode:native})
  const revision=origin?.revision??source?.revision??sourceIdentity.key??null
  const valid=validRevision(revision)
  const pieces=native?rows(snapshot?.template?.panels):rows(project?.pieces)
  const patterns=pieces.filter(p=>identity(p?.id)).map(p=>{
    const contour=native?nativeContours(p,revision):projectContours(p,revision)
    return contour?{id:p.id,name:p.name||p.id,fabricId:p.fabric??p.fabricId??null,
      ...contour,sourceRevision:revision,sourceCurrent:valid}:null
  }).filter(Boolean)
  const known=new Set(patterns.map(p=>p.id))
  const seams=rows(native?snapshot?.template?.seams:project?.seams).filter(s=>identity(s?.id)).map(s=>{
    const first=native?s.a?.panel??s.a?.piece:s.a?.pieceId??s.a?.piece??s.a?.panel
    const second=native?s.b?.panel??s.b?.piece:s.b?.pieceId??s.b?.piece??s.b?.panel
    return {id:s.id,name:s.name||s.id,first:first??null,second:second??null,
      from:s.a?.edge??s.a?.edgeIndex??null,to:s.b?.edge??s.b?.edgeIndex??null,
      sourceRef:reference('seam',s.id,revision,native?'template.seams':'seams'),
      refsResolved:known.has(first)&&known.has(second),stitchClass:null,spi:null,threadId:null,
      specificationStatus:'unknown'}
  })
  const sizes=rows(gradeRun?.sizes??(native?snapshot?.template?.grading?.sizes:project?.grading?.sizes))
  const gradeTemplates=rows(gradeRun?.gradedTemplates??snapshot?.grade_run?.gradedTemplates??snapshot?.gradeRun?.gradedTemplates)
  const gradeRows=native&&sizes.length&&gradeTemplates.length===sizes.length&&
    (gradeRun?.sourceRevision??gradeRun?.revision??revision)===revision&&
    (snapshot?.grade_run?.sourceRevision??snapshot?.grade_run?.revision??revision)===revision?
    sizes.map((size,index)=>({size,sourceRevision:revision,patterns:rows(gradeTemplates[index]?.panels)
      .filter(p=>known.has(p?.id)).map(p=>({id:p.id,contour:nativeContours(p,revision)}))})):[]
  const effectiveSource=source??{}
  return {kind:'exo-techpack-live-engineering.v1',sourceKind:native?'native':'project',sourceRevision:revision,sourceIdentity,
    sourceCurrent:valid,manufacturingApproved:false,patterns,seams,
    grading:{sizes:copy(sizes),baseSize:gradeRun?.baseSize??(native?snapshot?.template?.grading?.baseSize:project?.grading?.baseSize)??null,
      sizeContours:gradeRows,coverage:sizes.length>0&&gradeRows.length===sizes.length&&gradeRows.every(row=>
        row.patterns.length===patterns.length&&row.patterns.every(entry=>entry.contour))?'source':'incomplete',
      manufacturingApproved:false},pom:sourcePOM(effectiveSource,revision),
    issues:[...(!valid?['SOURCE_REVISION_MISSING']:[]),
      ...pieces.filter(p=>identity(p?.id)&&!patterns.some(x=>x.id===p.id)).map(p=>`INVALID_CONTOUR:${p.id}`)]}
}

/** Merge by stable identity, retaining user-entered fields and marking old source values stale.
 * Missing sources are retained for review; absence never silently deletes authored work. */
export function reconcileTechPackLiveEngineering20261031(previous={},fresh={}){
  const oldRevision=previous.sourceRevision??null,newRevision=fresh.sourceRevision??null
  const changed=!validRevision(oldRevision)||!validRevision(newRevision)||String(oldRevision)!==String(newRevision)||previous.sourceKind!==fresh.sourceKind
  const merge=(oldItems,newItems,kind)=>{
    const originals=new Map(rows(oldItems).filter(x=>identity(x?.id)).map(x=>[x.id,x]))
    const current=rows(newItems).map(item=>{
      const old=originals.get(item.id);originals.delete(item.id)
      const authored=old?.authored&&object(old.authored)?copy(old.authored):{}
      return {...copy(item),authored,stale:changed&&Boolean(old),sourceChanged:Boolean(old)&&signature(old.sourceRef??old.points??old)!==signature(item.sourceRef??item.points??item)}
    })
    return [...current,...[...originals.values()].map(old=>({...copy(old),stale:true,sourceMissing:true,
      manufacturingApproved:false,authored:copy(old.authored??{})}))]
  }
  return {...copy(fresh),patterns:merge(previous.patterns,fresh.patterns,'pattern'),
    seams:merge(previous.seams,fresh.seams,'seam'),
    issues:[...rows(fresh.issues),...(changed?['SOURCE_REVISION_CHANGED_REVIEW_REQUIRED']:[])],
    manufacturingApproved:false}
}
