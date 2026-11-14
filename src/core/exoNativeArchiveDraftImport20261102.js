import {prepareNativePatternExport} from './nativePatternExportPreparation.js'
import {inspectIndustrialPatterns} from './industrialPatternQA.js'

/** Preflight everything local before any native project can be opened. */
export function prepareVerifiedNativeArchiveDraft(candidate) {
  const generation=candidate?.patternGeneration
  const archived=generation?.method==='verified_archive_garmentcode_decode_v1'&&
    generation.sourceVerified===true&&typeof generation.sourceSha256==='string'&&/^[a-f0-9]{64}$/i.test(generation.sourceSha256)
  const synthesized=['verified_source_normalized_shape_interpolation_v1','learned_neighbor_conditioned_interpolation_v1'].includes(generation?.method)&&
    generation.candidateSourceVerified===false&&generation.trainedDecoderUsed===false&&generation.manufacturingApproved===false&&
    generation.fitVerified===false&&generation.gradingVerified===false&&generation.qaStatus==='pass'&&
    generation.reviewRequired===true&&Array.isArray(generation.sourceIds)&&generation.sourceIds.length===2&&
    generation.sourceIds[0]!==generation.sourceIds[1]&&
    Array.isArray(generation.sourceVerification)&&generation.sourceVerification.length===2&&
    generation.sourceVerification.every((source,index)=>source.sourceId===generation.sourceIds[index]&&source.verification?.status==='pass'&&
      typeof source.verification?.sha256==='string'&&/^[a-f0-9]{64}$/i.test(source.verification.sha256))
  const researchNeural=generation?.method==='trained_contour_research_seam_constrained_v1'&&
    generation.trainedDecoderUsed===true&&generation.originalSourceVerified===true&&
    generation.candidateSourceVerified===false&&generation.sourceGraphPreserved===true&&
    typeof generation.sourceId==='string'&&/^[a-f0-9]{64}$/i.test(generation.sourceSha256||'')&&
    /^[a-f0-9]{64}$/i.test(generation.modelCheckpointSha256||'')&&
    Number.isInteger(generation.trainingGarments)&&generation.trainingGarments>=8&&
    Number.isInteger(generation.heldOutTestGarments)&&generation.heldOutTestGarments>=3&&
    Number.isFinite(generation.heldOutContourRmseCm)&&generation.heldOutContourRmseCm>=0&&
    Number.isFinite(generation.acceptedResidualFraction)&&generation.acceptedResidualFraction>0&&
    generation.acceptedResidualFraction<=1&&Number.isFinite(generation.noveltyMaxDisplacementCm)&&
    generation.noveltyMaxDisplacementCm>=0.02&&generation.reviewRequired===true&&
    generation.qaStatus==='pass'&&generation.fitVerified===false&&
    generation.physicalFitVerified===false&&generation.gradingVerified===false&&
    generation.manufacturingApproved===false&&generation.gradedProductionApproved===false
  const textSketchTemplate=['text_prompt_template_conditioned_v1','sketch_guided_template_conditioned_v1','photo_guided_template_conditioned_v1'].includes(generation?.method)&&
    ['tee','hoodie','zip-hoodie','skirt','jeans-501-fit','jeans-501'].includes(generation?.sourceTemplateId)&&
    generation.sourceType==='exo_authored_template'&&generation.sourceTopologyRetained===true&&
    generation.generationAlgorithm==='deterministic_semantic_template_with_seam_qa'&&
    typeof generation.sourcePrompt==='string'&&generation.sourcePrompt.length>0&&generation.sourcePrompt.length<=4000&&
    generation.trainedTextDecoderUsed===false&&generation.trainedSketchDecoderUsed===false&&
    (generation.method==='photo_guided_template_conditioned_v1'?
      generation.photoUncalibrated===true&&
      Number.isInteger(generation.photoContourPoints)&&generation.photoContourPoints>=3&&generation.photoContourPoints<=1024&&
      generation.photoSegmentationMethod==='border-color-distance-and-connected-components'&&
      generation.trainedPhotoDecoderUsed===false&&generation.sketchContourPoints===0:
      generation.photoUncalibrated!==true)&&
    (generation.method==='sketch_guided_template_conditioned_v1'?
      generation.sketchUncalibrated===true&&Number.isInteger(generation.sketchContourPoints)&&generation.sketchContourPoints>=3:
      generation.sketchUncalibrated===false)&&
    generation.reviewRequired===true&&generation.qaStatus==='pass'&&
    generation.candidateSourceVerified===false&&generation.manufacturingApproved===false&&
    generation.physicalFitVerified===false&&generation.fitVerified===false&&
    generation.gradingVerified===false&&generation.gradedProductionApproved===false
  if(!archived&&!synthesized&&!researchNeural&&!textSketchTemplate)
    throw Error('A verified archive, independently QA-passing synthesis, constrained neural research draft, or reviewed authored-template text/sketch/photo draft is required for native import.')
  const size=candidate.grading?.baseSize
  if(!size||candidate.grading?.sizes?.length!==1||candidate.grading.sizes[0]!==size)
    throw Error('Native archive import requires the verified base-size draft.')
  const audit=inspectIndustrialPatterns(candidate,{sizes:[size]})
  if(audit.status!=='pass')throw Error(`Pattern QA blocked import: ${audit.issues[0]?.message||'Invalid source geometry'}`)
  const prepared=prepareNativePatternExport(candidate)
  if(prepared.report.removed.length||prepared.report.removedSeams)
    throw Error('Native conversion would remove source edges or seams. Import blocked to preserve sewing relationships.')
  // Native C++ panel placement expects a string `wrap`; the GarmentCode import
  // deliberately stores null where no anatomical placement was authored.
  for(const piece of prepared.document.pieces||[]){
    if(piece.arrangement3d?.wrap===null)piece.arrangement3d.wrap=''
  }
  return prepared
}

/** Capture the currently open native project before replacing it; open is a new history root. */
export async function openVerifiedNativeArchiveDraft(candidate,{bridgeFetch,bridgeOrigin,requestProject,persistBackup}) {
  const prepared=prepareVerifiedNativeArchiveDraft(candidate)
  if(!bridgeOrigin)throw Error('Native bridge is unavailable.')
  const response=await bridgeFetch(`${bridgeOrigin}/export`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document:prepared.document}),
  })
  const conversion=await response.json()
  if(!response.ok||!conversion.ok||!Array.isArray(conversion.template?.panels)||!conversion.template.panels.length||
      !Array.isArray(conversion.template.seams)||conversion.template.seams.length!==candidate.seams.length)
    throw Error(conversion.error||'Native conversion did not preserve every sewing relationship.')
  const saved=await requestProject('capture')
  if(!saved?.project)throw Error('Unable to capture the current native garment; import cancelled.')
  if(typeof persistBackup!=='function')throw Error('A durable native project backup is required before replacement.')
  const backupRecord=await persistBackup(saved.project)
  if(!backupRecord?.id)throw Error('Native garment backup could not be confirmed; import cancelled.')
  await requestProject('open',{
    ...saved.project,template:conversion.template,state:null,mesh_signature:null,
    print_graphics:[],imported_hardware:[],
  })
  return {ok:true,panels:conversion.template.panels.length,seams:conversion.template.seams.length,backupId:backupRecord.id}
}
