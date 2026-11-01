import {createSeamlyAamaExoDraft20261023} from './seamlyAamaToExoDraft20261023.js'
import {parseValentinaConstructionReference} from './valentinaConstructionReference20261031.js'
import {parseValentinaMeasurements} from './valentinaMeasurements20261031.js'

const LIMIT_PATTERN=8*1024*1024
const LIMIT_MEASUREMENTS=2*1024*1024
const LIMIT_ARTIFACT=8*1024*1024
const HEX=/^[a-f0-9]{64}$/
const bytes=value=>new TextEncoder().encode(value)
async function digest(value){
  const result=await crypto.subtle.digest('SHA-256',bytes(value))
  return [...new Uint8Array(result)].map(byte=>byte.toString(16).padStart(2,'0')).join('')
}
function assertContent(value,limit,label){
  if(typeof value!=='string'||!value.trim()||bytes(value).length>limit)
    throw Error('Invalid or oversized '+label)
}

/** Transport a real source-calculated Valentina AAMA CUT draft into EXO,
 * preserving the original .val and .vit in project state for reversible edits.
 * The engine is a separate original Seamly executable, not Rust construction
 * parity. Source-to-EXO export remains unapproved.
 */
export async function transferValentinaSemanticNativeDraft20261031(original,{
  patternXml,measurementsXml,engineResult,editable=false,artifactName,
}={}){
  assertContent(patternXml,LIMIT_PATTERN,'original .val construction')
  assertContent(measurementsXml,LIMIT_MEASUREMENTS,'original .vit measurements')
  const e=engineResult
  if(!e?.ok||e.bridge!=='semantic-source-translation'||
    e.originEngine!=='Valentina'||e.calculationEngine!=='Seamly2D'||e.engine!=='Seamly2D'||
    e.manufacturingApproved!==false||e.factoryExportAllowed!==false||
    e.format!=='aama-r10'||!['mm','cm','inch'].includes(e.sourceUnit))
    throw Error('Original semantic Valentina upstream DXF evaluation required')
  for(const key of ['originalPatternSha256','originalMeasurementsSha256','translatedGraphSha256','inputSha256']){
    if(!HEX.test(e[key]||''))throw Error('Missing verified upstream '+key)
  }
  const [sourceHash,measurementHash]=await Promise.all([digest(patternXml),digest(measurementsXml)])
  if(sourceHash!==e.originalPatternSha256||measurementHash!==e.originalMeasurementsSha256)
    throw Error('Original Valentina source/measurement bytes do not match the executed construction')
  if(e.translatedGraphSha256!==e.inputSha256)
    throw Error('Upstream converted geometry does not match the executed native source')
  const measurementRef=parseValentinaMeasurements(measurementsXml,{filename:'source.vit'})
  if(measurementRef.kind!=='vit'||measurementRef.hasUnevaluatedFormulas)
    throw Error('Source transfer requires numeric individual Valentina body measurements')
  if(!/<pattern(?:\s|>)/.test(patternXml)||!/<draw(?:\s|>)/.test(patternXml)||
     /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(patternXml))
    throw Error('Authentic Valentina construction graph required')
  const graph=bytes(patternXml).length<=4*1024*1024
    ?parseValentinaConstructionReference(patternXml,{filename:'source.val'}):null
  if(graph&&(graph.toolCount!==e.convertedSourceToolCount||
    graph.blocks.length!==e.convertedBlocks))
    throw Error('Translated source tool/block inventory diverges from the original graph')
  if(!Number.isInteger(e.convertedSourcePieceCount)||e.convertedSourcePieceCount<1||
    e.convertedSourcePieceCount>150)
    throw Error('Upstream source piece inventory is not valid')
  if(!Array.isArray(e.artifacts)||e.artifacts.length!==1)
    throw Error('Exactly one calculated AAMA output is required')
  const artifact=e.artifacts[0]
  assertContent(artifact?.content,LIMIT_ARTIFACT,'upstream AAMA DXF')
  if(!String(artifact.name||'').toLowerCase().endsWith('.dxf')||
    !HEX.test(artifact.sha256||'')||await digest(artifact.content)!==artifact.sha256)
    throw Error('Original calculated AAMA bytes fail SHA-256 verification')
  if(artifact.localInspection?.status!=='LOCAL_INSPECTION_ONLY'||
    artifact.localInspection.sourceUnit!==e.sourceUnit||
    !Number.isInteger(artifact.localInspection.sourceCutPieces)||
    artifact.localInspection.sourceCutPieces<1||
    artifact.localInspection.sourceCutPieces>150)
    throw Error('Original-engine AAMA source CUT inspection missing')
  const created=createSeamlyAamaExoDraft20261023(original,{
    file:{name:artifactName||artifact.name,content:artifact.content,sha256:artifact.sha256},
    engine:{engine:'Seamly2D',manufacturingApproved:false,
      inputSha256:e.inputSha256,measurementsSha256:e.measurementsSha256},
    unit:e.sourceUnit,editable,
  })
  if(created.project.pieces.length!==artifact.localInspection.sourceCutPieces)
    throw Error('Calculated CUT pieces diverge from physical source inventory')
  const next=created.project
  next.name='Valentina source · semantic calculated CUT draft'
  next.patternSource={...next.patternSource,
    type:'valentina-semantic-upstream-cut-draft-v1',bridge:e.bridge,
    originEngine:'Valentina',calculationEngine:'Seamly2D',
    originalPatternXml:patternXml,originalMeasurementsXml:measurementsXml,
    originalPatternSha256:sourceHash,originalMeasurementsSha256:measurementHash,
    sourceUnit:e.sourceUnit,
    convertedGraphSha256:e.translatedGraphSha256,
    originalAamaSha256:artifact.sha256,
    sourceToolCount:e.convertedSourceToolCount,
    sourceDetailCount:e.convertedSourcePieceCount,
    sourceBlockCount:e.convertedBlocks,sourceConstruction:graph,
    measurementReference:measurementRef,
    sourceGraphPreserved:true,editableDraft:Boolean(editable),
    nativeRustParametricGraphCommitted:false,
    referenceOnly:true,productionExportAllowed:false,factoryCertified:false,
    independentDimensionVerified:false,
  }
  for(const piece of next.pieces)piece.patternImportProvenance={
    ...piece.patternImportProvenance,
    source:'semantic-valentina-upstream-calculated-aama',
    originalPatternSha256:sourceHash,
    originalMeasurementsSha256:measurementHash,
    convertedGraphSha256:e.translatedGraphSha256,
    originalAamaSha256:artifact.sha256,
    referenceOnly:true,productionExportAllowed:false,
  }
  return {project:next,semantic:created.semantic,
    source:{identity:'original Valentina semantic source',sourceHash,
      measurementHash,geometryHash:artifact.sha256}}
}
