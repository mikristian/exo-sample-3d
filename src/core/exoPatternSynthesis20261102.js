import {inspectIndustrialPatterns} from './industrialPatternQA.js'

const finite = n => typeof n === 'number' && Number.isFinite(n)
const clone = value => structuredClone(value)
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y)
const refuse = reason => ({ok:false,reason})
const centroid = points => ({x:points.reduce((s,p)=>s+p.x,0)/points.length,y:points.reduce((s,p)=>s+p.y,0)/points.length})
const extent = points => Math.hypot(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)))
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b)

function supported(project) {
  if (project?.units!=='cm'||!Array.isArray(project.pieces)||!project.pieces.length||!Array.isArray(project.seams)||!project.seams.length) return 'Source must have centimeter pieces and authored seams.'
  if (project.modarisSizeLinkedGrade || project.customMeasurements?.length || project.print_graphics?.length || project.imported_hardware?.length) return 'Attached grading, measurements, graphics or hardware require separate adaptation.'
  if (project.pieces.some(p=>!p?.id||!Array.isArray(p.points)||p.points.length<3||p.points.some(q=>!finite(q.x)||!finite(q.y)))) return 'Source contains malformed piece geometry.'
  for (const p of project.pieces) {
    if (extent(p.points)<1e-5) return 'Source contains collapsed geometry.'
    if (p.curves && (Array.isArray(p.curves)||typeof p.curves!=='object')) return 'Unsupported curve representation.'
    for(const [key,c] of Object.entries(p.curves||{})) if (!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=p.points.length||!c||!finite(c.cx)||!finite(c.cy)||Object.keys(c).some(k=>!['cx','cy'].includes(k))) return 'Unsupported curve controls; expected indexed quadratic controls.'
    if (p.points.some(q=>Object.keys(q).some(k=>['cp1','cp2','handleIn','handleOut','control1','control2'].includes(k)))) return 'Unsupported point curve handles.'
    if (p.points.some((q,i)=>dist(q,p.points[(i+1)%p.points.length])<1e-6)) return 'Source has a collapsed edge.'
  }
  return null
}

const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'')
function topology(a,b) {
  if (a.pieces.length!==b.pieces.length||a.seams.length!==b.seams.length) return null
  const byName=new Map(b.pieces.map(p=>[norm(p.name||p.id),p]))
  if(byName.size!==b.pieces.length) return null
  const aNames=new Map(a.pieces.map(p=>[p.id,norm(p.name||p.id)]))
  const bNames=new Map(b.pieces.map(p=>[p.id,norm(p.name||p.id)]))
  if(aNames.size!==a.pieces.length||bNames.size!==b.pieces.length) return null
  const keys=(project,names)=>project.seams.flatMap(s=>{
    const a=names.get(s.a?.pieceId),b=names.get(s.b?.pieceId)
    if(!a||!b)return []
    return [[`${a}:${s.a.edgeIndex}`,`${b}:${s.b.edgeIndex}`].sort().join('~')]
  }).sort()
  const expected=keys(a,aNames)
  const candidates=[]
  for(const p of a.pieces){
    const q=byName.get(norm(p.name||p.id))
    if(!q||p.points.length!==q.points.length)return null
    const n=p.points.length,options=[]
    for(const reversed of [false,true])for(let offset=0;offset<n;offset++){
      const v=i=>(offset+(reversed?-i:i)+n*2)%n
      const e=i=>(reversed?v(i+1):v(i))
      if(p.points.some((_,i)=>Boolean(p.curves?.[i])!==Boolean(q.curves?.[e(i)])))continue
      if(p.edgeNames?.length&&q.edgeNames?.length&&p.edgeNames.some((name,i)=>norm(name)!==norm(q.edgeNames[e(i)])))continue
      if(p.notches?.length||q.notches?.length){if(!same((p.notches||[]).map(x=>[e(x.edgeIndex),x.t]).sort(),(q.notches||[]).map(x=>[x.edgeIndex,x.t]).sort()))continue}
      options.push({piece:q,vertex:v,edge:e,reversed})
    }
    if(!options.length)return null
    candidates.push(options)
  }
  const chosen=[]
  const solve=(index)=>{
    if(index===a.pieces.length){
      const actual=b.seams.map(s=>{
        const side=t=>{
          const ai=a.pieces.findIndex(p=>norm(p.name||p.id)===bNames.get(t.pieceId))
          if(ai<0)return null
          const mapping=chosen[ai],mappedEdge=a.pieces[ai].points.findIndex((_,i)=>mapping.edge(i)===t.edgeIndex)
          return `${aNames.get(a.pieces[ai].id)}:${mappedEdge}`
        }
        return [side(s.a),side(s.b)].sort().join('~')
      }).sort()
      return same(expected,actual)
    }
    for(const option of candidates[index]){chosen[index]=option;if(solve(index+1))return true}
    return false
  }
  if(!solve(0))return null
  return chosen
}

/** Interpolates verified sources with matching authored seam/edge topology.
 * This is source-derived synthesis conditioned on ranked retrieval evidence; it does
 * not invoke a trained generative decoder or claim model-predicted stitch topology.
 */
export function synthesizeExoPatternCandidate20261102(sources,{weight=0.5,learnedNeighborEvidence=null,minimumNoveltyCm=0.02}={}) {
  if (!Array.isArray(sources)||sources.length!==2) return refuse('Exactly two independently verified archive sources are required.')
  const [left,right]=sources
  if (!left?.sourceId||!right?.sourceId||left.sourceId===right.sourceId||left.project===right.project) return refuse('Independent archive source identifiers are required.')
  if (sources.some(s=>s.sourceVerified!==true||s.verification?.status!=='pass')) return refuse('Both sources require explicit source verification evidence.')
  if (!finite(weight)||weight<0.2||weight>0.8||!finite(minimumNoveltyCm)||minimumNoveltyCm<=0) return refuse('Blend weight must be 0.2–0.8 and novelty threshold positive.')
  if (learnedNeighborEvidence!=null && (!Array.isArray(learnedNeighborEvidence)||learnedNeighborEvidence.some(n=>!n?.sourceId||!finite(n.score)))) return refuse('Learned neighbor evidence must contain source IDs and finite similarity scores.')
  const a=left.project,b=right.project
  const error=supported(a)||supported(b)
  if(error) return refuse(error)
  const mapping=topology(a,b)
  if(!mapping) return refuse('Source pieces, indexed curves, notches and seam topology do not match.')
  if(a.grading && !same(a.grading,b.grading)) return refuse('Source grading definitions do not match.')
  const sourceQA=[inspectIndustrialPatterns(a),inspectIndustrialPatterns(b)]
  if(sourceQA.some(q=>q.status!=='pass')) return refuse('An archive source fails independent industrial seam QA.')
  const candidate=clone(a)
  const novelty=[]
  for(let i=0;i<candidate.pieces.length;i++) {
    const p=candidate.pieces[i],pa=a.pieces[i],alignment=mapping[i],sourceB=alignment.piece
    const pb={...sourceB,points:pa.points.map((_,j)=>sourceB.points[alignment.vertex(j)]),curves:Object.fromEntries(Object.keys(pa.curves||{}).map(key=>[key,sourceB.curves[alignment.edge(Number(key))]]))}
    const ca=centroid(pa.points),cb=centroid(pb.points),sizeA=extent(pa.points),sizeB=extent(pb.points)
    if(sizeA<=1e-5||sizeB<=1e-5||sizeB/sizeA>1.5||sizeB/sizeA<2/3) return refuse('Source piece scale mismatch exceeds 50%.')
    const blend=(x,y)=>({x:ca.x+(1-weight)*(x.x-ca.x)+weight*(y.x-cb.x),y:ca.y+(1-weight)*(x.y-ca.y)+weight*(y.y-cb.y)})
    p.points=pa.points.map((v,j)=>({...v,...blend(v,pb.points[j])}))
    p.curves=Object.fromEntries(Object.entries(pa.curves||{}).map(([key,v])=>{
      const q=pb.curves[key],t=blend({x:v.cx,y:v.cy},{x:q.cx,y:q.cy})
      return [key,{cx:t.x,cy:t.y}]
    }))
    novelty.push(...p.points.map((v,j)=>({fromA:dist(v,pa.points[j]),fromB:dist(v,{x:ca.x+(pb.points[j].x-cb.x),y:ca.y+(pb.points[j].y-cb.y)})})))
  }
  const minA=Math.max(...novelty.map(n=>n.fromA)),minB=Math.max(...novelty.map(n=>n.fromB))
  if(minA<minimumNoveltyCm||minB<minimumNoveltyCm) return refuse('Candidate geometry is indistinguishable from one source; identity output forbidden.')
  const qa=inspectIndustrialPatterns(candidate)
  if(qa.status!=='pass') return {ok:false,reason:'Synthesized candidate failed independent industrial seam QA.',qa}
  candidate.id=`synthesis-${left.sourceId}-${right.sourceId}-${Math.round(weight*1000)}`
  candidate.name=`${a.name||'Pattern'} · reviewed synthesis draft`
  candidate.patternGeneration={method:Array.isArray(learnedNeighborEvidence)&&learnedNeighborEvidence.length?'learned_neighbor_conditioned_interpolation_v1':'verified_source_normalized_shape_interpolation_v1',trainedDecoderUsed:false,learnedNeighborConditioned:Array.isArray(learnedNeighborEvidence)&&learnedNeighborEvidence.length>0,sourceIds:[left.sourceId,right.sourceId],sourceVerification:sources.map(s=>({sourceId:s.sourceId,verification:clone(s.verification)})),learnedNeighborEvidence:clone(learnedNeighborEvidence),weight,noveltyMaxDisplacementCmFromA:minA,noveltyMaxDisplacementCmFromB:minB,reviewRequired:true,manufacturingApproved:false,fitVerified:false,gradingVerified:false,candidateSourceVerified:false,qaStatus:qa.status}
  return {ok:true,project:candidate,qa,report:{pieceCount:candidate.pieces.length,seamCount:candidate.seams.length,noveltyMaxDisplacementCmFromA:minA,noveltyMaxDisplacementCmFromB:minB,method:candidate.patternGeneration.method,trainedDecoderUsed:false}}
}
