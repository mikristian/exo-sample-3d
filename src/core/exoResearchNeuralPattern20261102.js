import {decodeVerifiedGarmentProject} from './exoDecodedGarmentProject20261102.js'
import {garmentCodeToProject} from './garmentCode.js'
import {inspectIndustrialPatterns} from './industrialPatternQA.js'

const finite = value => typeof value==='number'&&Number.isFinite(value)
const fail=(reason,extra={})=>({ok:false,reason,...extra})
const clone=value=>structuredClone(value)
const checksum=/^[0-9a-f]{64}$/i

function graphSignature(project){
  const names=new Map(project.pieces.map(piece=>[piece.id,piece.name]))
  return JSON.stringify(project.seams.map(seam=>[
    `${names.get(seam.a?.pieceId)}:${seam.a?.edgeIndex}:${seam.a?.startT??0}:${seam.a?.endT??1}`,
    `${names.get(seam.b?.pieceId)}:${seam.b?.edgeIndex}:${seam.b?.startT??0}:${seam.b?.endT??1}`,
  ].sort().join('~')).sort())
}

function contourSkeleton(doc) {
  if(!doc?.pattern?.panels||!doc.properties)return null
  const result=clone(doc)
  for(const panel of Object.values(result.pattern.panels)){
    if(!Array.isArray(panel.vertices)||!Array.isArray(panel.edges))return null
    panel.vertices=panel.vertices.map(()=>[0,0])
    for(const edge of panel.edges){
      const curve=edge.curvature
      if(curve)curve.params=(curve.params||[]).map(()=>[0,0])
    }
  }
  return JSON.stringify(result)
}

function interpolateContours(original,prediction,factor) {
  const candidate=clone(original)
  let sum=0,count=0,max=0
  for(const [name,panel] of Object.entries(candidate.pattern.panels)){
    const proposed=prediction.pattern.panels[name]
    for(let i=0;i<panel.vertices.length;i++){
      for(let coordinate=0;coordinate<2;coordinate++){
        const before=panel.vertices[i][coordinate],after=proposed.vertices[i][coordinate]
        if(!finite(after)||Math.abs(after)>100000)return null
        const delta=factor*(after-before)
        panel.vertices[i][coordinate]=before+delta
        sum+=delta*delta;count++
      }
      const [bx,by]=original.pattern.panels[name].vertices[i]
      const [x,y]=panel.vertices[i]
      max=Math.max(max,Math.hypot(x-bx,y-by))
    }
    for(const [i,edge] of panel.edges.entries()){
      const curve=edge.curvature
      if(!curve)continue
      for(let k=0;k<curve.params.length;k++)for(let j=0;j<2;j++){
        const start=curve.params[k][j],end=proposed.edges[i].curvature.params[k][j]
        if(!finite(end)||Math.abs(end)>100000)return null
        curve.params[k][j]=start+factor*(end-start)
      }
    }
  }
  return {spec:candidate,vertexCoordinateRmseCm:Math.sqrt(sum/Math.max(count,1)),noveltyMaxVertexDisplacementCm:max}
}

/** Apply model-predicted cutlines with a bounded, audited residual search.
 * The original must be SHA-verified; the prediction is never marked as a
 * verified source. Its sewing graph is copied unchanged, never inferred.
 * Without an independently passing EXO digital audit, nothing can be applied.
 */
export function prepareNeuralContourResearchCandidate20261102(source,proposal,baseProject,{
  fractions=[1,0.75,0.5,0.35,0.25,0.15,0.1],minimumNoveltyCm=0.02,
}={}) {
  if(!proposal||proposal.ok!==true||proposal.model!=='numpy-denoising-autoencoder-contour-v1'||
      proposal.sourceId!==source?.sourceId||proposal.exoQaPassed===true||
      proposal.fitValidated===true||proposal.factoryApproved===true||
      proposal.sourceVerified!==true||proposal.generatedCandidateSourceVerified!==false||
      proposal.sourceSha256!==source?.source?.sha256||
      !Number.isFinite(proposal.metrics?.inputReconstructionAndGenerationRmseCm)||
      !proposal.metrics?.basicGeometryValid)return fail('A bounded unapproved neural contour research prediction is required.')
  const evidence=proposal.researchModelEvidence
  if(evidence?.model!=='numpy-denoising-autoencoder-contour-v1'||!checksum.test(evidence.checkpointSha256||'')||
      proposal.checkpointHash!==evidence.checkpointSha256||
      !Number.isInteger(evidence.trainingGarments)||evidence.trainingGarments<8||
      !Number.isInteger(evidence.heldOutTestGarments)||evidence.heldOutTestGarments<3||
      !finite(evidence.heldOutContourRmseCm)||evidence.heldOutContourRmseCm<0)
    return fail('Independent trained-checkpoint and held-out test evidence is required.')
  const decoded=decodeVerifiedGarmentProject(source,baseProject)
  if(!decoded.ok)return fail(`Original source failed verified EXO import: ${decoded.reason}`)
  const original=source.spec,generated=proposal.generatedSpec
  if(!generated||contourSkeleton(original)===null||
      contourSkeleton(original)!==contourSkeleton(generated))
    return fail('Model output changed panel identity, edge topology, stitch graph, or non-contour metadata.')
  if(!Array.isArray(fractions)||!fractions.length||fractions.length>16||
      fractions.some(value=>!finite(value)||value<=0||value>1)||
      !finite(minimumNoveltyCm)||minimumNoveltyCm<0.01)
    return fail('Specify a bounded residual search and a meaningful minimum geometric novelty.')
  const attempts=[]
  for(const fraction of fractions){
    const result=interpolateContours(original,generated,fraction)
    if(!result)return fail('The neural contour includes non-finite or unbounded coordinates.')
    if(result.noveltyMaxVertexDisplacementCm<minimumNoveltyCm){
      attempts.push({fraction,status:'insufficient_novelty',noveltyMaxCm:result.noveltyMaxVertexDisplacementCm})
      continue
    }
    let candidate
    try {
      // The decoded original contains only the source's vetted materials,
      // avatar staging, and no unrelated attachments from the open project.
      candidate=garmentCodeToProject(result.spec,decoded.project)
    }catch(error){attempts.push({fraction,status:'conversion_rejected',reason:error.message});continue}
    const base=decoded.project
    if(candidate.pieces.length!==base.pieces.length||candidate.seams.length!==base.seams.length||
        candidate.pieces.some((p,i)=>p.name!==base.pieces[i].name||p.points.length!==base.pieces[i].points.length)||
        graphSignature(candidate)!==graphSignature(base))
      return fail('Decoded candidate changed source panel IDs or sewing edge references.')
    candidate.grading=clone(base.grading)
    const size=base.grading.baseSize
    const qa=inspectIndustrialPatterns(candidate,{sizes:[size]})
    attempts.push({fraction,status:qa.status,noveltyMaxCm:result.noveltyMaxVertexDisplacementCm,
      firstIssue:qa.issues[0]?.code||null})
    if(qa.status!=='pass')continue
    candidate.id=`research-neural-${base.id}-${Math.round(fraction*10000)}`
    candidate.name=`Neural contour draft · ${source.sourceId}`
    candidate.patternGeneration={
      method:'trained_contour_research_seam_constrained_v1',trainedDecoderUsed:true,
      sourceId:source.sourceId,sourceSha256:source.source.sha256,
      originalSourceVerified:true,candidateSourceVerified:false,
      modelType:evidence.model,modelCheckpointSha256:evidence.checkpointSha256,
      trainingGarments:evidence.trainingGarments,heldOutTestGarments:evidence.heldOutTestGarments,
      heldOutContourRmseCm:evidence.heldOutContourRmseCm,
      originalModelPredictionRmseCm:proposal.metrics.inputReconstructionAndGenerationRmseCm,
      acceptedResidualFraction:fraction,noveltyMaxDisplacementCm:result.noveltyMaxVertexDisplacementCm,
      sourceGraphPreserved:true,qaStatus:'pass',reviewRequired:true,
      physicalFitVerified:false,fitVerified:false,gradingVerified:false,
      manufacturingApproved:false,gradedProductionApproved:false,
    }
    return {ok:true,project:candidate,qa,status:'review_required',attempts,
      report:{sourceId:source.sourceId,panels:candidate.pieces.length,seams:candidate.seams.length,
        acceptedResidualFraction:fraction,
        modelRawPredictionRmseCm:proposal.metrics.inputReconstructionAndGenerationRmseCm,
        acceptedCoordinateRmseCm:result.vertexCoordinateRmseCm,
        noveltyMaxDisplacementCm:result.noveltyMaxVertexDisplacementCm,
        heldOutModelRmseCm:evidence.heldOutContourRmseCm,
        physicalFitVerified:false,gradedProductionApproved:false,factoryApproved:false,
        caveat:'Trained contour proposal passed a constrained digital seam audit; no new seam topology, physical fit or factory approval.'}}
  }
  return fail('No sufficiently novel neural contour prediction passed EXO seam and geometry QA.',{attempts})
}
