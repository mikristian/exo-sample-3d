import {createTemplateProject} from '../data/templates.js'
import {planExoTextPattern20261102} from './exoTextPatternPlanner20261102.js'
import {applyExoFashionTeeEdit} from './exoFashionPatternEdits20261102.js'
import {inspectIndustrialPatterns} from './industrialPatternQA.js'
import {trueHoodieTemplateSeams20261102} from './exoTemplateSeamTrueing20261102.js'

const fail=(reason,detail=null)=>({ok:false,reason,detail,manufacturingApproved:false,physicalFitVerified:false})
const finite=value=>typeof value==='number'&&Number.isFinite(value)
const copy=value=>structuredClone(value)
const kinds=new Set(['tee','hoodie','zip-hoodie','skirt','jeans-501-fit','jeans-501'])
const bannedFeatures={
  tee:['zipper','buttons','drawstring','pockets','kangaroo_pocket','lining','padding','princess_seams','flat_felled_seams','darts','pleats'],
  hoodie:['drawstring','buttons','padding','lining','princess_seams','darts','pleats','flat_felled_seams'],
  'zip-hoodie':['drawstring','buttons','padding','lining','princess_seams','darts','pleats','flat_felled_seams'],
  skirt:['zipper','buttons','drawstring','pockets','lining','padding','princess_seams','darts','pleats','flat_felled_seams'],
  'jeans-501-fit':['pockets','buttons','zipper','lining','padding','princess_seams','darts','pleats'],
  'jeans-501':['lining','padding','princess_seams','darts','pleats'],
}

const meters=(project,ids)=>{
  const pieces=project.pieces.filter(piece=>!ids||ids.includes(piece.id))
  return {widthCm:Math.max(...pieces.map(piece=>Math.max(...piece.points.map(p=>p.x))-Math.min(...piece.points.map(p=>p.x)))),
    heightCm:Math.max(...pieces.map(piece=>Math.max(...piece.points.map(p=>p.y))-Math.min(...piece.points.map(p=>p.y))))}
}

// This transform moves all cut and curve coordinates by the SAME conservative
// proportions, so no piece is independently resized across a sewn relationship.
// It is deliberately not a fit/body-measurement solver.
function globallyScale(project,scaleX,scaleY) {
  if(![scaleX,scaleY].every(finite)||scaleX<.85||scaleX>1.2||scaleY<.82||scaleY>1.2)throw Error('Requested visual proportions exceed the bounded development range.')
  const result=copy(project)
  const point=p=>({...p,x:p.x*scaleX,y:p.y*scaleY})
  for(const piece of result.pieces){
    if(piece.locked)throw Error(`Cannot change locked pattern piece ${piece.id}`)
    if(piece.surfaceAttachments?.length||piece.graphics?.length||piece.zippers?.length||piece.buttons?.length||piece.buttonholes?.length)
      throw Error('Pattern has physical attachments or hardware that require synchronized drafting.')
    piece.points=piece.points.map(point)
    if(piece.curves)piece.curves=Object.fromEntries(Object.entries(piece.curves).map(([index,c])=>[index,{...c,cx:c.cx*scaleX,cy:c.cy*scaleY}]))
    for(const line of piece.internalLines||[]){if(line.a)line.a=point(line.a);if(line.b)line.b=point(line.b)}
  }
  return result
}

/** Select a deliberately finite construction family. Unsupported designs get
 * an interpretable concept plan, NOT an invented sewing topology.
 */
function templateFor(plan,phrase){
  const family=plan.intent.family
  if(family==='shirt')return 'tee'
  if(family==='hoodie')return plan.intent.features.includes('zipper')?'zip-hoodie':'hoodie'
  if(family==='skirt')return 'skirt'
  if(family==='pants'){
    if(/\b(?:shorts|leggings|joggers|cargo(?:\s+pants)?|sweatpants)\b/i.test(phrase))return null
    return /\b(?:jeans|denim)\b/i.test(phrase)?'jeans-501':'jeans-501-fit'
  }
  return null
}

function unresolvedConstruction(plan,template,phrase){
  const missing=[]
  for(const feature of plan.intent.features){if(bannedFeatures[template]?.includes(feature))missing.push(feature)}
  const neckline=plan.intent.neckline
  if(template==='tee'&&neckline&&!['crew'].includes(neckline))missing.push(`neckline:${neckline}`)
  if(template==='tee'&&plan.intent.sleeves&&!['short'].includes(plan.intent.sleeves))missing.push(`sleeves:${plan.intent.sleeves}`)
  if(['hoodie','zip-hoodie'].includes(template)&&plan.intent.sleeves&&!['long'].includes(plan.intent.sleeves))missing.push(`sleeves:${plan.intent.sleeves}`)
  if(template==='hoodie'&&plan.intent.features.includes('zipper'))missing.push('unrepresented_zipper')
  if(template==='skirt'&&(/\b(?:pencil|asymmetric|wrap|tiered|mermaid)\b/i.test(phrase)))missing.push('skirt_cut_not_authored')
  if(['jeans-501','jeans-501-fit'].includes(template)&&(/\b(?:flare(?:d)?|bell[ -]?bottom|skinny|tapered|boot[ -]?cut)\b/i.test(phrase)))missing.push('leg_shape_not_authored')
  if(['jeans-501','jeans-501-fit'].includes(template)&&/\b(?:slim|loose|oversized|baggy)\b/i.test(phrase)&&template==='jeans-501')missing.push('jeans_waist_and_hardware_resizing_not_verified')
  if(/\b(?:raglan|drop[ -]shoulder|drop[ -]shouldered)\b/i.test(phrase))missing.push('armhole_redrafting_required')
  if(template==='tee'&&/\b(?:polo|collared|button[ -]?up)\b/i.test(phrase))missing.push('collar_or_placket_not_authored')
  if(plan.intent.seamConstraints.seamAllowanceCm!=null){
    const value=plan.intent.seamConstraints.seamAllowanceCm
    if(value<.5||value>3)missing.push('seam_allowance_out_of_supported_range')
  }
  return [...new Set(missing)]
}

function sketchCues(sketch,template) {
  if(sketch==null)return {ok:true,kind:null,modifiers:{},warnings:[]}
  if(sketch.ok!==true||!Array.isArray(sketch.normalizedContour)||sketch.normalizedContour.length<3||
    sketch.manufacturingApproved!==false||sketch.measurementCalibrationVerified!==false||
    !finite(sketch.silhouetteAspectRatio)||sketch.silhouetteAspectRatio<=0||sketch.silhouetteAspectRatio>6)
    return fail('Sketch must provide a reviewed, uncalibrated closed silhouette, not an inferred production pattern.')
  if(!['tee','hoodie','zip-hoodie','skirt','jeans-501-fit','jeans-501'].includes(template))return fail('No compatible source template for the submitted sketch.')
  const wide=sketch.silhouetteAspectRatio>1.04
  const tall=sketch.silhouetteAspectRatio<.62
  const upper=sketch.evidence?.possibleSleeveExtension?.detected===true
  return {ok:true,kind:'reviewed_sketch_outline',modifiers:{slightlyCropped:wide&&['tee','hoodie','zip-hoodie'].includes(template),slightlyLonger:tall&&['tee','hoodie','zip-hoodie'].includes(template),upperWidthHint:upper},
    warnings:['Sketch is uncalibrated; pixel proportions suggest a style, not measured garment or sewing geometry.',
      'Sketch front/back, exact garment family and piece construction remain unverified.']}
}

/** Turns a natural-language plan or a measured image-space silhouette into
 * a safe, NEW editable project from EXO's owned construction templates.
 * No external ML or false unconditional generation is implied.
 */
export function draftExoTextSketchPattern20261102({prompt='',sketch=null,forcedTemplateId=null}={}){
  if(typeof prompt!=='string'||prompt.length>4000||(!prompt.trim()&&!sketch))return fail('Describe one garment or supply a valid closed sketch.')
  // An unclassified sketch needs a human selected family; refuse guessing a
  // garment topology from one outline alone.
  const sourcePrompt=prompt.trim()||({'tee':'T-shirt','hoodie':'hoodie','zip-hoodie':'zip-up hoodie','skirt':'skirt','jeans-501-fit':'straight trousers','jeans-501':'jeans'}[forcedTemplateId]||'')
  const plan=planExoTextPattern20261102(sourcePrompt)
  if(!plan.ok)return fail(plan.unsupported?.join(' ')||plan.reason||'Unable to understand one garment family.',plan)
  const template=templateFor(plan,sourcePrompt)
  if(!template||!kinds.has(template))return fail(`${plan.intent.family} is understood as a design request but has no verified editable construction template in EXO yet.`,plan)
  if(forcedTemplateId&&forcedTemplateId!==template)return fail('The manually selected garment family conflicts with the written description.',plan)
  const missing=unresolvedConstruction(plan,template,sourcePrompt)
  if(missing.length)return fail(`Requested details require construction not implemented for this template: ${missing.join(', ')}.`,plan)
  const sketchEvidence=sketchCues(sketch,template)
  if(!sketchEvidence.ok)return sketchEvidence
  const requested=plan.intent.measurementsCm
  const base=createTemplateProject(template)
  if(base.units!=='cm'||!Array.isArray(base.pieces)||!base.pieces.length)return fail('Editable centimeter construction template not available.')
  let result=base
  const adjustments=[]
  const fit=plan.intent.fit
  const phrase=sourcePrompt.toLowerCase()
  const cropped=/\b(?:crop(?:ped)?|shorten|shorter)\b/.test(phrase)||sketchEvidence.modifiers.slightlyCropped
  const longer=/\b(?:longer|elongated|lengthened)\b/.test(phrase)||sketchEvidence.modifiers.slightlyLonger
  const oversized=fit==='oversized'||fit==='relaxed'||/\bboxy\b/.test(phrase)
  if(cropped&&longer)return fail('A garment cannot be simultaneously cropped and lengthened without explicit measurements.',plan)
  let baseQa=inspectIndustrialPatterns(base,{sizes:[base.grading?.baseSize||'M']})
  if(baseQa.status!=='pass'&&!['hoodie','zip-hoodie'].includes(template))return fail(`Selected ${template} construction template is not ready for pattern output: ${baseQa.issues.slice(0,2).map(i=>i.code).join(', ')}.`,plan)
  try{
    if(template==='tee'){
      const before=meters(base,['front'])
      let cropCm=0
      if(cropped)cropCm=sketchEvidence.modifiers.slightlyCropped?5:8
      if(finite(requested.garmentLength)){
        cropCm=before.heightCm-requested.garmentLength
        if(cropCm<0)throw Error('Lengthening this T-shirt block requires a separate graded construction; supply a compatible template.')
      }
      const addHalfCm=oversized?fit==='oversized'?5:3:0
      if(cropCm||addHalfCm){
        const edit=applyExoFashionTeeEdit(result,{kind:'tee-style',widthAddHalfCm:addHalfCm,cropCm})
        result=edit.project
        adjustments.push({feature:'tee_hem_and_torso',cropCm,hemSideAddCm:addHalfCm})
      }
    }else if(['skirt','jeans-501-fit','jeans-501'].includes(template)){
      const scaleX=oversized?1.045:fit==='slim'?.965:1
      const scaleY=cropped?.94:longer?1.06:1
      if(scaleX!==1||scaleY!==1){result=globallyScale(result,scaleX,scaleY);adjustments.push({feature:'shared_scale_development',scaleX,scaleY})}
    }else if(template==='hoodie'||template==='zip-hoodie'){
      const before=meters(base,template==='hoodie'?['front']:['back'])
      let bodyLengthDeltaCm=cropped?-8:longer?5:0
      if(sketchEvidence.modifiers.slightlyCropped)bodyLengthDeltaCm=-5
      if(finite(requested.garmentLength))bodyLengthDeltaCm=requested.garmentLength-before.heightCm
      const widthScale=oversized?1.1:fit==='slim'?0.95:1
      const trued=trueHoodieTemplateSeams20261102(base,{widthScale,bodyLengthDeltaCm})
      if(!trued.ok)throw Error(trued.reason)
      result=trued.project
      adjustments.push({feature:'hoodie_seam_trueing',widthScale,bodyLengthDeltaCm,qa:trued.qa.status})
    }
    if(finite(requested.seamAllowance)&&requested.seamAllowance>0){
      for(const piece of result.pieces)piece.seamAllowance=requested.seamAllowance
      adjustments.push({feature:'pattern_seam_allowance_cm',value:requested.seamAllowance})
    }
  }catch(error){return fail(`Description-to-pattern adjustments are not safe: ${error.message}`,plan)}
  const qa=inspectIndustrialPatterns(result,{sizes:[result.grading?.baseSize||'M']})
  if(qa.status!=='pass')return fail(`Generated pattern did not pass base-size seam/geometry checks: ${qa.issues.slice(0,3).map(i=>i.code).join(', ')}.`,plan)
  const source=sketch?'sketch_guided_template_conditioned_v1':'text_prompt_template_conditioned_v1'
  result.id=`text-sketch-draft-${template}-${Date.now()}`
  result.name=`${base.name} · ${sketch?'Sketch + description':'Text description'} working draft`
  result.revision=(Number(base.revision)||0)+1
  result.updatedAt=new Date().toISOString()
  result.grading={...result.grading,baseSize:result.grading?.baseSize||'M',sizes:[result.grading?.baseSize||'M']}
  result.patternGeneration={method:source,sourceTemplateId:template,sourceType:'exo_authored_template',
    sourceTopologyRetained:true,sourcePrompt,sketchUncalibrated:Boolean(sketch),
    sketchContourPoints:sketch?.normalizedContour?.length||0,
    sketchSilhouetteAspectRatio:sketch?.silhouetteAspectRatio||null,
    generationAlgorithm:'deterministic_semantic_template_with_seam_qa',trainedTextDecoderUsed:false,
    trainedSketchDecoderUsed:false,reviewRequired:true,qaStatus:'pass',manufacturingApproved:false,
    candidateSourceVerified:false,fitVerified:false,physicalFitVerified:false,gradingVerified:false,
    gradedProductionApproved:false}
  return {ok:true,status:'review_required',project:result,qa,plan,
    report:{sourceTemplateId:template,source:source,panels:result.pieces.length,seams:result.seams.length,
      baseSize:result.grading.baseSize,adjustments,sketchCues:sketchEvidence.modifiers,
      warnings:[...plan.uncertainties,...sketchEvidence.warnings,
        'Contour is a pattern-template development draft, not a model trained on matching descriptions or sketches.',
        'Physical fit, wearer measurements, independently graded sizes and factory construction remain unverified.'],
      textModelUsed:false,sketchModelUsed:false,gradedProductionApproved:false,physicalFitVerified:false,
      manufacturingApproved:false}}
}
