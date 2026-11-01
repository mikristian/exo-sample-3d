// Bound original Valentina construction edits to their separately verified
// original-engine physical CUT output, without silently changing Rust grading.
import {createSeamlyAamaExoDraft20261023} from './seamlyAamaToExoDraft20261023.js'
import {editValentinaConstructionFormula20261031} from './valentinaConstructionEdit20261031.js'
import {parseValentinaMeasurements} from './valentinaMeasurements20261031.js'

const PATTERN_HASH='8bdbb6bacc320c12737b88403c6b050f2f26e08324f56fc8641c586a324b3ad5'
const digest=async value=>{
  const bytes=new TextEncoder().encode(value)
  const hash=await crypto.subtle.digest('SHA-256',bytes)
  return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('')
}
/** Only the fully reconstructed, source-verified MaleShirt connected graph
 * currently qualifies for reversible native CUT draft transfer after editing.
 * Unlike static paired original imports, it also carries the edit provenance.
 */
export async function transferValentinaConnectedNativeDraft20261031(project,{
  baselinePatternXml,measurementsXml,engineResult,editable=true,
}={}){
  if(typeof baselinePatternXml!=='string'||baselinePatternXml.length>4*1024*1024||
     typeof measurementsXml!=='string'||measurementsXml.length>2*1024*1024)
    throw Error('Unsupported Valentina source sizes for connected native CUT transfer')
  if(await digest(baselinePatternXml)!==PATTERN_HASH) throw Error('Unknown Valentina baseline source identity')
  if(!engineResult?.ok||engineResult.bridge!=='verified-connected-maleshirt'||
    engineResult.manufacturingApproved!==false||engineResult.factoryExportAllowed!==false||
    engineResult.format!=='aama-r10'||engineResult.originEngine!=='Valentina'||
    engineResult.engine!=='Seamly2D'||engineResult.baselineSha256!==PATTERN_HASH)
    throw Error('Verified original connected Valentina MaleShirt DXF is required')
  const edits=engineResult.constructionEdits
  if(!Array.isArray(edits)||edits.length<1||edits.length>24)throw Error('Connected construction edit inventory missing')
  let rebuilt=baselinePatternXml
  for(const edit of edits){
    if(edit.kind!=='increment'||typeof edit.name!=='string'||typeof edit.formula!=='string')
      throw Error('Connected native CUT transfer supports only original increment edits')
    rebuilt=editValentinaConstructionFormula20261031(rebuilt,{
      incrementName:edit.name,attribute:'formula',formula:edit.formula,
    })
  }
  if(rebuilt!==engineResult.editedOriginalPatternXml||
    await digest(rebuilt)!==engineResult.inputSha256||
    await digest(measurementsXml)!==engineResult.measurementsSha256)
    throw Error('Connected Valentina construction, measurements or engine digest mismatch')
  const parsed=parseValentinaMeasurements(measurementsXml)
  if(parsed.kind!=='vit')throw Error('Individual Valentina .vit measurements required')
  const artifact=engineResult.artifacts
  if(!Array.isArray(artifact)||artifact.length!==1||
    typeof artifact[0]?.content!=='string'||artifact[0].content.length>8*1024*1024||
    !artifact[0].name?.endsWith('.dxf')||
    await digest(artifact[0].content)!==artifact[0].sha256)
    throw Error('Connected Valentina original-engine AAMA artifact mismatch')
  if(artifact[0].localInspection?.status!=='LOCAL_INSPECTION_ONLY'||
    artifact[0].localInspection.sourceCutPieces<1||
    artifact[0].localInspection.sourceUnit!==engineResult.sourceUnit)
    throw Error('Connected Valentina physical CUT inventory not verified')
  const {project:next,semantic}=createSeamlyAamaExoDraft20261023(project,{
    file:artifact[0],unit:engineResult.sourceUnit,
    engine:{engine:'Seamly2D',manufacturingApproved:false,
      inputSha256:engineResult.inputSha256,measurementsSha256:engineResult.measurementsSha256},
    editable,
  })
  if(next.pieces.length!==artifact[0].localInspection.sourceCutPieces)
    throw Error('Connected CUT source-piece count mismatch')
  next.name='Valentina MaleShirt · connected-source calculated CUT'
  next.patternSource={...next.patternSource,type:'valentina-connected-source-cut-draft-v1',
    originEngine:'Valentina',calculationEngine:'Seamly2D',
    baselinePatternXml,editedOriginalPatternXml:rebuilt,measurementsXml,
    baselineSha256:PATTERN_HASH,sourceSha256:engineResult.inputSha256,
    measurementsSha256:engineResult.measurementsSha256,
    originalAamaSha256:artifact[0].sha256,constructionEdits:edits,
    measurementReference:parsed,sourceGraphPreserved:true,sourceFormulasRecalculated:true,
    nativeRustParametricGraphCommitted:false,referenceOnly:true,
    productionExportAllowed:false,factoryCertified:false}
  for(const piece of next.pieces)piece.patternImportProvenance={...piece.patternImportProvenance,
    source:'connected-valentina-upstream-calculated-aama',
    valentinaSourceSha256:engineResult.inputSha256,sourceEdits:edits,
    referenceOnly:true,productionExportAllowed:false}
  return {project:next,semantic}
}
