import {inspectProduction} from './productionPreflight.js'
import {inspectIndustrialPatterns} from './industrialPatternQA.js'
import {inspectGradedCutlines} from './industrialCutlineQA.js'
import {auditGradedSizeRunGeometry} from './gradedSizeRunGeometryAudit.js'
import {inspectGradedNotchPairs} from './industrialNotchQA.js'
import {createFactorySampleWorksheet,inspectFactorySampleEvidence} from './factorySampleApproval.js'
import {inspectGradedSeamJunctions,JEANS501_YOKE_JUNCTIONS} from './gradedSeamJunctionQA.js'
import {inspectStandaloneNotchesAllSizes20261023} from './standaloneNotchPreflight20261023.js'
import {inspectIndustrialDoubleNotches20261023} from './industrialDoubleNotchPreflight20261023.js'
import {inspectGradedNotchSeamIntervals} from './gradedNotchIntervalAudit.js'

function reconcilePartialSeamLegacyNotches(project,legacy,physical){
  const unchanged={effective:legacy?.blockers,superseded:0,scopes:[]}
  const sizes=project?.grading?.sizes
  if(!Number.isSafeInteger(legacy?.blockers)||legacy.blockers<=0||
    !Array.isArray(legacy.issues)||legacy.issues.length!==legacy.blockers||
    physical?.status!=='pass'||physical.blockers!==0||physical.issues?.length!==0||
    physical.factoryCertified!==false||!Number.isSafeInteger(physical.pairedGroups)||physical.pairedGroups<1||
    !Array.isArray(sizes)||!Array.isArray(physical.checkedSizes)||
    physical.checkedSizes.length!==sizes.length||physical.checkedSizes.some((size,i)=>size!==sizes[i])||
    !Number.isFinite(physical.toleranceCm)||physical.toleranceCm<0||
    !Array.isArray(physical.checks)||physical.checks.length!==physical.pairedGroups*sizes.length)return unchanged
  const byScope=new Map()
  for(const row of physical.checks){
    const scope=`${row.group} · ${row.size}`
    if(byScope.has(scope)||!sizes.includes(row.size)||row.pass!==true||
      !Number.isFinite(row.offsetCm)||row.offsetCm<0||row.offsetCm>physical.toleranceCm)return unchanged
    byScope.set(scope,row)
  }
  if(new Set(physical.checks.map(row=>row.group)).size!==physical.pairedGroups)return unchanged
  try {
    // Caller-supplied legacy summaries cannot manufacture an exception.
    const live=inspectGradedNotchPairs(project)
    if(live.blockers!==legacy.blockers||live.pairedGroups!==physical.pairedGroups||
      JSON.stringify(live.issues)!==JSON.stringify(legacy.issues))return unchanged
    const oldByScope=new Map(live.checks.map(row=>[`${row.group} · ${row.size}`,row]))
    const scopes=[]
    for(const issue of live.issues){
      if(issue.code!=='NOTCH_SEAM_MISALIGNMENT')continue
      const current=byScope.get(issue.scope),old=oldByScope.get(issue.scope)
      const seam=project.seams.find(row=>row.id===current?.seamId)
      const partial=seam&&[seam.a,seam.b].some(side=>
        (side?.startT??0)!==0||(side?.endT??1)!==1)
      if(current?.pass===true&&old?.pass===false&&old.seamId===current.seamId&&partial)scopes.push(issue.scope)
    }
    return {effective:legacy.blockers-scopes.length,superseded:scopes.length,scopes}
  } catch {return unchanged}
}

function reconcileIndustrialLegacyNotchIssues(project,industrial,legacyReconciliation){
  const unchanged={effective:industrial?.blockers,superseded:0}
  if(!legacyReconciliation.scopes.length||!Number.isSafeInteger(industrial?.blockers)||
    !Array.isArray(industrial.issues)||industrial.issues.length!==industrial.blockers)return unchanged
  try {
    // The industrial QA includes legacy notch issues alongside contour, seam,
    // POM and grading failures. Never mask anything except the exact same
    // independently proven positional false-blocks from the live project.
    const live=inspectIndustrialPatterns(project)
    if(live.blockers!==industrial.blockers||
      JSON.stringify(live.issues)!==JSON.stringify(industrial.issues))return unchanged
    const allowed=new Set(legacyReconciliation.scopes),used=new Set()
    for(const issue of live.issues){
      if(issue.code==='NOTCH_SEAM_MISALIGNMENT'&&allowed.has(issue.scope)&&!used.has(issue.scope)){
        used.add(issue.scope)
      }
    }
    return {effective:industrial.blockers-used.size,superseded:used.size}
  } catch {return unchanged}
}

/** Machine-checkable engineering disposition for all sizes. Never issues a
 * manufacturing approval or equates successfully parsed DXF with AAMA/ASTM.
 * A blocked project may still be exported as an explicitly UNAPPROVED study.
 */
export function inspectManufacturingReleaseReadiness(project,{checks=null}={}){
  const blocked=[]
  const add=(code,reason,count)=>blocked.push({code,reason,blockerCount:count})
  const report=(name,get)=>{
    try{return checks?.[name]??get()}
    catch(error){add(`${name.toUpperCase()}_FAILED`,String(error.message||error),1);return null}
  }
  const production=report('production',()=>inspectProduction(project))
  const industrial=report('industrial',()=>inspectIndustrialPatterns(project))
  const cutlines=report('cutlines',()=>inspectGradedCutlines(project))
  const gradedTopology=report('gradedTopology',()=>auditGradedSizeRunGeometry(project))
  const notches=report('notches',()=>inspectGradedNotchPairs(project))
  // This physical notch gate must independently inspect the live project even
  // when factoryPackage supplies precomputed (or caller-injected) QA checks.
  let standaloneNotches=null
  try {standaloneNotches=inspectStandaloneNotchesAllSizes20261023(project)}
  catch(error){add('STANDALONE_PHYSICAL_NOTCH_QA_FAILED',String(error?.message||error),1)}
  // Always inspect the actual graded CUT geometry. Injected check summaries
  // must never bypass endpoint clipping or physical double-notch validation.
  let industrialDoubleNotches=null
  try {industrialDoubleNotches=inspectIndustrialDoubleNotches20261023(project)}
  catch(error){add('INDUSTRIAL_DOUBLE_NOTCH_QA_FAILED',String(error?.message||error),1)}
  // Whole-edge notch fractions can match even when the actual sewn intervals
  // begin at different stations, or the notches lie outside the sewn sections.
  // This is a live-project gate: caller-supplied QA summaries cannot bypass it.
  let sewnIntervalNotches=null
  try {sewnIntervalNotches=inspectGradedNotchSeamIntervals(project)}
  catch(error){add('GRADED_SEWN_INTERVAL_NOTCH_QA_FAILED',String(error?.message||error),1)}
  // Keep the raw whole-edge count for receiving diagnostics. Only verified
  // partial-seam positional false-blocks may be excluded from readiness.
  const legacyNotchReconciliation=reconcilePartialSeamLegacyNotches(project,notches,sewnIntervalNotches)
  const industrialNotchReconciliation=reconcileIndustrialLegacyNotchIssues(project,industrial,legacyNotchReconciliation)
  const junctions=report('junctions',()=>inspectGradedSeamJunctions(project,{
    junctions:project?.templateId==='jeans-501'?JEANS501_YOKE_JUNCTIONS:project?.gradingJunctionConstraints||[],
  }))
  const sample=report('sample',()=>inspectFactorySampleEvidence(project,createFactorySampleWorksheet(project)))
  const summaries=[
    ['PRODUCTION_PREFLIGHT',production?.blockers,'Basic geometry, fabrics, markers or sewing references require correction'],
    ['INDUSTRIAL_PATTERN_QA',industrialNotchReconciliation.effective,'Graded sewing lengths, contours or measurements do not pass strict QA'],
    ['PHYSICAL_CUTLINE_QA',cutlines?.blockers,'A physical CUT or STITCH contour is unsafe'],
    ['GRADE_TOPOLOGY_QA',gradedTopology?.issues?.length,'Grading inverted or collapsed at least one drafted panel'],
    ['SEWING_NOTCH_QA',legacyNotchReconciliation.effective,'Explicit sewing notch pairs do not align'],
  ]
  if(junctions?.status!=='not_configured')summaries.push([
    'GRADED_SHARED_JUNCTION_QA',junctions?.blockers,'Authored base-size shared sewn-edge endpoints drift apart during grading',
  ])
  for(const [code,value,message] of summaries){
    if(value==null)add(`${code}_INCOMPLETE`,`No verified result for ${code}`,1)
    else if(!Number.isSafeInteger(value)||value<0)add(`${code}_INVALID`,'Invalid QA blocker count',1)
    else if(value>0)add(code,message,value)
  }
  if(standaloneNotches){
    if(!Array.isArray(standaloneNotches.issues)||!Number.isSafeInteger(standaloneNotches.blockers)||
      standaloneNotches.blockers<0||standaloneNotches.blockers!==standaloneNotches.issues.length||
      !['pass','blocked','not_configured'].includes(standaloneNotches.status)||
      (standaloneNotches.status==='blocked')!==(standaloneNotches.blockers>0)){
      add('STANDALONE_PHYSICAL_NOTCH_QA_INVALID','Invalid all-size physical notch inspection result',1)
    }else if(standaloneNotches.blockers>0){
      for(const issue of standaloneNotches.issues){
        const size=String(issue?.size??'unknown')
        const pieceId=String(issue?.pieceId??'unknown')
        const notchId=String(issue?.notchId??'unknown')
        add('STANDALONE_PHYSICAL_NOTCH_QA',`${issue?.code??'INVALID_NOTCH'}: ${size} / ${pieceId} / ${notchId}: ${issue?.message??'Invalid physical notch'}`,1)
      }
    }
    // A valid zero-notch project is legitimately not_configured; independent
    // inventory/provenance controls must establish whether notches are expected.
  }
  if(industrialDoubleNotches){
    if(!Array.isArray(industrialDoubleNotches.issues)||!Array.isArray(industrialDoubleNotches.checks)||
      !Number.isSafeInteger(industrialDoubleNotches.blockers)||industrialDoubleNotches.blockers<0||
      industrialDoubleNotches.blockers!==industrialDoubleNotches.issues.length||
      !['pass','blocked','not_configured'].includes(industrialDoubleNotches.status)||
      (industrialDoubleNotches.status==='blocked')!==(industrialDoubleNotches.blockers>0)||
      !Array.isArray(industrialDoubleNotches.checkedSizes)||
      (industrialDoubleNotches.issues.length===0 && industrialDoubleNotches.status==='pass' && industrialDoubleNotches.checks.length===0)){
      add('INDUSTRIAL_DOUBLE_NOTCH_QA_INVALID','Invalid graded industrial double-notch inspection result',1)
    }else if(industrialDoubleNotches.blockers>0){
      for(const issue of industrialDoubleNotches.issues){
        const size=String(issue?.size??'unknown'),pieceId=String(issue?.pieceId??'unknown'),notchId=String(issue?.notchId??'unknown')
        add('INDUSTRIAL_DOUBLE_NOTCH_QA',`${issue?.code??'INVALID_NOTCH'}: ${size} / ${pieceId} / ${notchId}: ${issue?.message??'Invalid physical double notch'}`,1)
      }
    }
  }
  if(sewnIntervalNotches){
    const {status,blockers,issues,checks,coverage,pairedGroups,unassignedNotches,checkedSizes,toleranceCm}=sewnIntervalNotches
    const configuredSizes=project?.grading?.sizes
    const coverageValid=Array.isArray(coverage)&&(
      status==='not_configured' ? coverage.length===0 :
      Array.isArray(configuredSizes)&&Number.isSafeInteger(pairedGroups)&&pairedGroups>=0&&
      Number.isSafeInteger(unassignedNotches)&&unassignedNotches>=0&&
      coverage.length===(pairedGroups+unassignedNotches)*configuredSizes.length&&
      new Set(coverage.map(row=>`${row.kind}\u0000${row.group}\u0000${row.size}`)).size===coverage.length&&
      coverage.every(row=>configuredSizes.includes(row.size)&&typeof row.group==='string'&&row.group.length>0&&
        (row.kind==='PAIRED'||row.kind==='UNASSIGNED'&&row.status==='BLOCKED'&&row.reasonCode==='INVALID_NOTCH_PAIR_METADATA')&&
        (row.status==='PASS'&&row.reasonCode===null||
         row.status==='BLOCKED'&&typeof row.reasonCode==='string'&&row.reasonCode.length>0)&&
        (row.status!=='PASS'||row.kind==='PAIRED'&&checks?.some(check=>check.size===row.size&&check.group===row.group&&check.pass===true)))&&
      checks?.every(check=>coverage.some(row=>row.kind==='PAIRED'&&row.size===check.size&&row.group===check.group&&
        row.status===(check.pass===true?'PASS':'BLOCKED')))
    )
    const valid=Array.isArray(issues)&&Array.isArray(checks)&&Number.isSafeInteger(blockers)&&
      blockers>=0&&blockers===issues?.length&&Number.isSafeInteger(pairedGroups)&&pairedGroups>=0&&
      coverageValid&&
      ['pass','blocked','not_configured'].includes(status)&&
      (status==='blocked')===(blockers>0)&&sewnIntervalNotches.factoryCertified===false&&
      (status!=='not_configured'||(pairedGroups===0&&unassignedNotches===0&&blockers===0&&checks.length===0))&&
      (status==='not_configured'||(Array.isArray(checkedSizes)&&Array.isArray(configuredSizes)&&
        checkedSizes.length===configuredSizes.length&&checkedSizes.every((size,i)=>size===configuredSizes[i])))&&
      (status!=='pass'||(pairedGroups>0&&Number.isFinite(toleranceCm)&&toleranceCm>=0&&
        checks.length===pairedGroups*configuredSizes.length&&
        checks.every(row=>row.pass===true&&Number.isFinite(row.offsetCm)&&row.offsetCm>=0&&row.offsetCm<=toleranceCm)&&
        coverage.every(row=>row.status==='PASS')))
    if(!valid)add('GRADED_SEWN_INTERVAL_NOTCH_QA_INVALID','Invalid physical sewn-interval notch inspection result',1)
    else if(blockers>0)add('GRADED_SEWN_INTERVAL_NOTCH_QA',
      'Matched notch stations are outside sewn intervals, misaligned or malformed across graded sizes',blockers)
  }
  if(project?.gradeProvenance?.status==='DEVELOPMENT_ONLY_FACTORY_APPROVAL_REQUIRED'){
    add('UNAPPROVED_GRADE_TABLE','Imported or source-locked trim does not contain externally approved multi-size grading rules',1)
  }
  if(project?.canonicalizationProvenance?.status==='DEVELOPMENT_ONLY_FACTORY_APPROVAL_REQUIRED'){
    add('UNAPPROVED_IMPORTED_CANONICALIZATION','Opt-in source normalization has no industrial receiving-CAD or patternmaker approval',1)
  }
  if(project?.patternSource?.referenceOnly||project?.pieces?.some(piece=>piece?.patternImportProvenance?.referenceOnly)){
    add('REFERENCE_ONLY_PATTERN','A physical CUT import does not reconstruct an authored editable garment',1)
  }
  if(project?.productionSpec?.neckband?.requiresSeparateNeckbandCutPattern===true){
    add('EXPERIMENTAL_NECKBAND','The proposed neckband is omitted from the approved marker/BOM and requires fabric/sampling signoff',1)
  }
  if(sample && (!Number.isSafeInteger(sample.blockerCount)||sample.blockerCount<0||
    !Array.isArray(sample.blockers)||sample.blockers.length!==sample.blockerCount||
    !['blocked','evidence_complete_requires_human_factory_release'].includes(sample.status)||
    sample.readyForHumanApproval!==(sample.blockerCount===0)||sample.factoryCertified!==false||
    (sample.status==='blocked')!==(sample.blockerCount>0))){
    add('EXTERNAL_SAMPLE_EVIDENCE_INVALID','Invalid external sample evidence blocker count',1)
  }else if(sample?.blockerCount>0){
    add('EXTERNAL_SAMPLE_EVIDENCE','CAD receiving, printed scale, cutting, sewn fit and named approval evidence are incomplete',sample.blockerCount)
  }else if(!sample){add('EXTERNAL_SAMPLE_EVIDENCE_MISSING','No authenticated physical factory sample records',1)}
  const geometryIssueCodes=new Set(['PRODUCTION_PREFLIGHT','INDUSTRIAL_PATTERN_QA','PHYSICAL_CUTLINE_QA','GRADE_TOPOLOGY_QA','SEWING_NOTCH_QA','GRADED_SHARED_JUNCTION_QA',
    'PRODUCTION_PREFLIGHT_INCOMPLETE','INDUSTRIAL_PATTERN_QA_INCOMPLETE','PHYSICAL_CUTLINE_QA_INCOMPLETE','GRADE_TOPOLOGY_QA_INCOMPLETE','SEWING_NOTCH_QA_INCOMPLETE','GRADED_SHARED_JUNCTION_QA_INCOMPLETE',
    'PRODUCTION_PREFLIGHT_INVALID','INDUSTRIAL_PATTERN_QA_INVALID','PHYSICAL_CUTLINE_QA_INVALID','GRADE_TOPOLOGY_QA_INVALID','SEWING_NOTCH_QA_INVALID','GRADED_SHARED_JUNCTION_QA_INVALID'])
  const engineeringGeometryPass=!blocked.some(item=>geometryIssueCodes.has(item.code)||item.code.startsWith('STANDALONE_PHYSICAL_NOTCH_QA')||item.code.startsWith('INDUSTRIAL_DOUBLE_NOTCH_QA')||item.code.startsWith('GRADED_SEWN_INTERVAL_NOTCH_QA')||item.code.endsWith('_FAILED'))
  return {
    schema:'exo-manufacturing-release-readiness.v1',
    status:blocked.length?'BLOCKED_NOT_APPROVED':'EVIDENCE_COMPLETE_REQUIRES_INDEPENDENT_HUMAN_RELEASE',
    factoryCertified:false,
    factoryCuttingAuthorized:false,
    bulkProductionAuthorized:false,
    engineeringGeometryPass,
    configuredSizes:Array.isArray(project?.grading?.sizes)?[...project.grading.sizes]:[],
    // Preserved in manufacturing-release-readiness.json inside the factory ZIP:
    // per-size station offsets and issue scopes remain reviewable by a receiver.
    // This is digital diagnostic evidence, never a physical sewing approval.
    sewnIntervalNotchAudit:sewnIntervalNotches,
    legacyNotchReconciliation:{
      schema:'exo-partial-seam-legacy-notch-reconciliation.v1',
      status:legacyNotchReconciliation.superseded?'WHOLE_EDGE_POSITIONAL_ROWS_SUPERSEDED':'NO_SUPERSESSION',
      supersededScopes:[...legacyNotchReconciliation.scopes],
      rawLegacyNotchBlockers:notches?.blockers??null,
      effectiveLegacyNotchBlockers:legacyNotchReconciliation.effective??null,
      industrialLegacyNotchRowsSuperseded:industrialNotchReconciliation.superseded,
      factoryCertified:false,
      factoryCuttingAuthorized:false,
      note:'Only identified whole-edge positional rows are superseded by complete live sewn-interval station checks. All raw QA files remain unchanged; no cutting or receiving-CAD approval.',
    },
    digitalCounts:{productionBlockers:production?.blockers??null,industrialPatternBlockers:industrial?.blockers??null,
      industrialPatternEffectiveBlockers:industrialNotchReconciliation.effective??null,
      industrialPatternLegacyNotchSuperseded:industrialNotchReconciliation.superseded,
      physicalCutlineBlockers:cutlines?.blockers??null,gradedTopologyFindings:gradedTopology?.issues?.length??null,
      pairedNotchBlockers:notches?.blockers??null,
      pairedNotchEffectiveBlockers:legacyNotchReconciliation.effective??null,
      pairedNotchWholeEdgeSuperseded:legacyNotchReconciliation.superseded,
      standalonePhysicalNotchBlockers:standaloneNotches?.blockers??null,
      industrialDoubleNotchBlockers:industrialDoubleNotches?.blockers??null,
      sewnIntervalNotchBlockers:sewnIntervalNotches?.blockers??null,
      sharedJunctionBlockers:junctions?.status==='not_configured'?null:junctions?.blockers??null,
      externalEvidenceBlockers:sample?.blockerCount??null},
    blockers:blocked,
    disclaimer:'Engineering checks and a self-hashed ZIP never authorize cutting, mass production, or prove Gerber/Lectra/ASTM compatibility. Independent operator, receiver CAD and physical sample acceptance are necessary.',
  }
}
