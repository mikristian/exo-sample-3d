import {inspectIndustrialPatterns} from './industrialPatternQA.js'
import {measureProject} from './measurements.js'

// This is a reversible, *development-only* grading experiment. Production
// grade rules have to come from a patternmaker and approved size specification.
const finite = value => typeof value === 'number' && Number.isFinite(value)
const copied = value => structuredClone(value)
const failure = reason => ({ok:false,reason,manufacturingCertified:false,physicalFitVerified:false})
const scalePoint = (point,x,y) => ({...point,x:point.x*x,y:point.y*y})

/** Generate auditable single-size drafts, never a certified nested grade run.
 * Scaling the entire authored stitchline graph with a shared affine transform
 * preserves edge identity and is checked independently at every size.
 * Target ease is user-supplied finished garment data, not guessed from a flat panel.
 */
export function buildExperimentalSizeRun20261102(project,{
  sizes=['S','M','L'],baseSize='M',widthStepPercent=2,lengthStepPercent=1,
  approvedPomTargets=null,bodyFitInputs=null,
}={}) {
  if(project?.units!=='cm'||!Array.isArray(project.pieces)||!project.pieces.length||
      !Array.isArray(project.seams)||!project.seams.length)
    return failure('A centimeter-based editable pattern with authored seams is required.')
  if(project.modarisSizeLinkedGrade!==undefined || project.pieces.some(piece=>
    piece?.points?.some(point=>point.industrialGradeRule||point.gradeRule?.enabled)||
    piece?.internalLines?.length||piece?.graphics?.length)||
    project.print_graphics?.length||project.imported_hardware?.length||
    project.fasteners?.length||project.customMeasurements?.length)
    return failure('Industrial grade rules, attachments, fasteners or POM anchors require a separate verified grading method.')
  if(!Array.isArray(sizes)||sizes.length<2||sizes.length>7||
      sizes.some(s=>typeof s!=='string'||!s.trim())||new Set(sizes).size!==sizes.length||
      !sizes.includes(baseSize))return failure('Specify 2–7 unique size labels including the base size.')
  if(![widthStepPercent,lengthStepPercent].every(finite)||
      widthStepPercent<0||widthStepPercent>7||lengthStepPercent<0||lengthStepPercent>5)
    return failure('Research width break must be 0–7%, length break 0–5%; enter approved size rules for production.')
  if(approvedPomTargets!==null&&(!approvedPomTargets||typeof approvedPomTargets!=='object'||Array.isArray(approvedPomTargets)||
      sizes.some(size=>!Array.isArray(approvedPomTargets[size]))))
    return failure('Approved point-of-measure targets must be supplied separately for every requested size.')
  if(bodyFitInputs!==null&&(!bodyFitInputs||typeof bodyFitInputs!=='object'||Array.isArray(bodyFitInputs)))
    return failure('Fit inputs must map each size to independently specified garment/body circumferences.')

  const baseline=inspectIndustrialPatterns(project,{sizes:[project.grading?.baseSize||baseSize]})
  if(baseline.status!=='pass')return failure(`Original pattern fails seam/geometry QA: ${baseline.issues[0]?.message||'Unknown issue'}`)
  const baseIndex=sizes.indexOf(baseSize)
  const bySize={},sizeReports=[],fitReports=[],warnings=[]
  for(const [index,size] of sizes.entries()) {
    const offset=index-baseIndex
    const sx=1+offset*widthStepPercent/100,sy=1+offset*lengthStepPercent/100
    if(sx<=0.5||sy<=0.5||sx>1.5||sy>1.5)return failure(`Unsafe development size multiplier for ${size}.`)
    const draft=copied(project)
    draft.pieces=project.pieces.map(piece=>({
      ...copied(piece),
      points:piece.points.map(point=>scalePoint(point,sx,sy)),
      curves:piece.curves?Object.fromEntries(Object.entries(piece.curves).map(([key,c])=>[key,{...c,cx:c.cx*sx,cy:c.cy*sy}])):undefined,
      notches:piece.notches?copied(piece.notches):undefined,
      internalLines:[],
    }))
    draft.id=`${project.id||'candidate'}-research-grade-${size}`
    draft.name=`${project.name||'Pattern'} / ${size} · experimental graded draft`
    draft.grading={baseSize:size,sizes:[size],widthPerSizeCm:0,lengthPerSizeCm:0}
    draft.patternGeneration={...copied(project.patternGeneration||{}),
      gradeMethod:'shared_affine_development_trial_v1',sourceBaseSize:baseSize,
      experimentalGrade:true,gradeRuleApproved:false,fitVerified:false,
      physicalFitVerified:false,manufacturingApproved:false,sx,sy}
    const targets=approvedPomTargets?{[size]:approvedPomTargets[size]}:null
    const qa=inspectIndustrialPatterns(draft,{sizes:[size],pomTargets:targets})
    if(qa.status!=='pass')return {
      ...failure(`Research grade ${size} failed geometry, seam or POM QA: ${qa.issues[0]?.message||'Unknown issue'}`),
      failedSize:size,qa,
    }
    let measured=[]
    try{measured=measureProject(draft)}catch(error){return failure(`Unable to measure experimental size ${size}: ${error.message}`)}
    bySize[size]=draft
    sizeReports.push({size,scaleX:sx,scaleY:sy,panels:draft.pieces.length,
      seams:draft.seams.length,qaStatus:qa.status,
      maxSeamMismatchCm:Math.max(0,...qa.seamReports.map(row=>row.differenceCm)),
      measurements:measured.map(({id,label,cm,toleranceCm})=>({id,label,cm,toleranceCm})),
      pomTargetsApproved:targets!==null})
    const input=bodyFitInputs?.[size]
    if(input===undefined){fitReports.push({size,status:'unknown',reason:'No independently measured wearer and finished-garment circumferences supplied.'});continue}
    if(!input||![input.bodyChestCm,input.finishedChestCm,input.minEaseCm,input.maxEaseCm].every(finite)||
      input.bodyChestCm<=0||input.finishedChestCm<=0||input.minEaseCm>input.maxEaseCm||
      Math.abs(input.minEaseCm)>100||Math.abs(input.maxEaseCm)>100)
      return failure(`Invalid independent chest and ease measurements for ${size}.`)
    const easeCm=input.finishedChestCm-input.bodyChestCm
    const meetsSpecifiedRange=easeCm>=input.minEaseCm&&easeCm<=input.maxEaseCm
    fitReports.push({size,status:meetsSpecifiedRange?'input_ease_in_range':'input_ease_out_of_range',
      easeCm,meetsSpecifiedRange,source:'user_supplied_body_and_finished_measurements',
      physicalFitVerified:false})
    if(!meetsSpecifiedRange)warnings.push(`${size}: input chest ease is outside the supplied design range.`)
  }
  const blockedForApproval=[
    'Factory-approved grading rules and size specifications are missing.',
    ...(approvedPomTargets?[]:['Approved point-of-measure targets are missing.']),
    ...(sizes.some(size=>fitReports.find(row=>row.size===size)?.status==='unknown')?
      ['Measured wearer/finished-garment fit evidence is missing.']:[]),
    'Physical 3D fit, fabric calibration, prototype wear test and factory sign-off are not verified.',
  ]
  return {ok:true,status:'development_only',sizes:[...sizes],baseSize,bySize,sizeReports,fitReports,
    independentDigitalQaPassed:true,gradedProductionApproved:false,physicalFitVerified:false,
    manufacturingCertified:false,approvalBlockers:blockedForApproval,warnings,
    method:'shared_affine_development_trial_v1'}
}
