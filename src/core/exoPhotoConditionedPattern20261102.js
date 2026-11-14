import {draftExoTextSketchPattern20261102} from './exoTextSketchPatternCandidate20261102.js'
import {projectToDxf} from './dxf.js'
export {interpretExoGarmentPhotoRgba20261102,interpretExoGarmentPhotoFile20261102} from './exoGarmentPhotoReference20261102.js'

const fail=(code,reason)=>({ok:false,code,reason,manufacturingApproved:false,measurementCalibrationVerified:false})

/** Store only reviewed image-space evidence; no raw pixels or speculative construction. */
export function seedExoPhotoEvidence20261102(photo){
  if(!photo||photo.kind!=='photo-reference'||photo.ok!==true||photo.source!=='local-photo-rgba-segmentation'||
     photo.measurementCalibrationVerified!==false||photo.manufacturingApproved!==false||
     !Array.isArray(photo.normalizedContour)||photo.normalizedContour.length<3||photo.normalizedContour.length>1024||
     !Number.isFinite(photo.silhouetteAspectRatio)||photo.silhouetteAspectRatio<=0||photo.silhouetteAspectRatio>6||
     !photo.normalizedContour.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1))
    return fail('INVALID_PHOTO_EVIDENCE','A locally segmented, reviewed single-garment photo is required.')
  return {ok:true,kind:'photo-reference',source:photo.source,
    segmentationMethod:'border-color-distance-and-connected-components',
    normalizedContour:photo.normalizedContour.map(p=>({x:p.x,y:p.y})),
    silhouetteAspectRatio:photo.silhouetteAspectRatio,
    evidence:{possibleSleeveExtension:{detected:photo.evidence?.possibleSleeveExtension?.detected===true}},
    manufacturingApproved:false,measurementCalibrationVerified:false}
}

/** Template-safe photo candidate; the photo supplies style proportions only. */
export function draftExoPhotoConditionedPattern20261102({prompt='',photo=null,forcedTemplateId=null}={}){
  const evidence=seedExoPhotoEvidence20261102(photo)
  if(!evidence.ok)return evidence
  const drafted=draftExoTextSketchPattern20261102({prompt,sketch:evidence,forcedTemplateId})
  if(!drafted.ok)return drafted
  const candidate=structuredClone(drafted)
  const generation=candidate.project.patternGeneration
  generation.method='photo_guided_template_conditioned_v1'
  generation.photoUncalibrated=true
  generation.photoContourPoints=evidence.normalizedContour.length
  generation.photoSegmentationMethod=evidence.segmentationMethod
  generation.trainedPhotoDecoderUsed=false
  generation.sketchUncalibrated=false
  generation.sketchContourPoints=0
  generation.sketchSilhouetteAspectRatio=null
  candidate.project.name=candidate.project.name.replace('Sketch + description','Photo + description')
  candidate.report.source=generation.method
  candidate.report.photoCues=candidate.report.sketchCues
  candidate.report.warnings.push('Photo cannot prove garment family, actual body fit, pattern measurements, material or hidden seam construction.')
  candidate.report.photoModelUsed=false
  if(!projectToDxf(candidate.project,candidate.report.baseSize).includes('ENTITIES'))
    return fail('DXF_FAILED','Unable to generate editable DXF from the reviewed photo proposal.')
  return candidate
}
