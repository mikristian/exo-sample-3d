import {createSeamlyAamaExoDraft20261023} from './seamlyAamaToExoDraft20261023.js'
import {parseValentinaConstructionReference} from './valentinaConstructionReference20261031.js'
import {parseValentinaMeasurements} from './valentinaMeasurements20261031.js'

const MAX_PATTERN_BYTES=8*1024*1024
const MAX_MEASUREMENT_BYTES=2*1024*1024
const MAX_DXF_BYTES=8*1024*1024
const hex=/^[a-f0-9]{64}$/i
const AUTHENTIC_PATTERNS=Object.freeze({
  MaleShirt:'8bdbb6bacc320c12737b88403c6b050f2f26e08324f56fc8641c586a324b3ad5',
  Trousers:'f4616c6ba796cbd6cb186c35971bd5b554ce2b0db9eea57e34fce5bc3f22cd5c',
})
const encode=s=>new TextEncoder().encode(s)
const bytes=s=>encode(s).byteLength
async function sha256(value){
  const digest=await crypto.subtle.digest('SHA-256',encode(value))
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')
}

/** Promote a separately verified engine AAMA result to an EXO CUT reference draft.
 * All source material stays attached for reconstructing the original project.
 * This adapter does not evaluate formulas or assert manufacturing certification.
 */
export async function transferValentinaNativeReference20261031(original,{
  patternXml,measurementsXml,engineResult,editable=false,artifactName,
}={}){
  if(typeof patternXml!=='string'||!patternXml.trim()||bytes(patternXml)>MAX_PATTERN_BYTES)
    throw Error('Valentina pattern source is missing or exceeds 8 MB')
  if(typeof measurementsXml!=='string'||!measurementsXml.trim()||bytes(measurementsXml)>MAX_MEASUREMENT_BYTES)
    throw Error('Valentina measurement source is missing or exceeds 2 MB')
  if(!/<pattern(?:\s|>)/.test(patternXml)||!/<draw(?:\s|>)/.test(patternXml)||
     /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(patternXml))
    throw Error('Invalid or unsupported Valentina pattern XML')
  if(!engineResult?.ok||engineResult.engine!=='Seamly2D'||engineResult.originEngine!=='Valentina'||
     engineResult.format!=='aama-r10'||engineResult.manufacturingApproved!==false||
     engineResult.factoryExportAllowed!==false||
     !['verified-maleshirt-reference','verified-trousers-reference'].includes(engineResult.bridge))
    throw Error('Verified Valentina-to-Seamly AAMA computation required')
  if(!['mm','cm','inch'].includes(engineResult.sourceUnit))throw Error('Explicit original drawing unit required')
  const [patternHash,measurementsHash]=await Promise.all([sha256(patternXml),sha256(measurementsXml)])
  if(!hex.test(engineResult.inputSha256||'')||!hex.test(engineResult.measurementsSha256||'')||
     patternHash!==engineResult.inputSha256.toLowerCase()||
     measurementsHash!==engineResult.measurementsSha256.toLowerCase())
    throw Error('Valentina source or measurements do not match calculated engine inputs')
  const expectedName=engineResult.bridge==='verified-maleshirt-reference'?'MaleShirt':'Trousers'
  if(patternHash!==AUTHENTIC_PATTERNS[expectedName])
    throw Error('Unrecognized Valentina construction; original source identity mismatch')
  if(!new RegExp(expectedName,'i').test(engineResult.sourceMapping||''))
    throw Error('Valentina source mapping and engine identity disagree')
  const measurements=parseValentinaMeasurements(measurementsXml,{filename:'source.vit'})
  if(measurements.kind!=='vit')throw Error('Only calculated individual Valentina measurements are supported')
  let construction=null
  if(bytes(patternXml)<=4*1024*1024)
    construction=parseValentinaConstructionReference(patternXml,{filename:expectedName+'.val'})
  const artifacts=engineResult.artifacts
  if(!Array.isArray(artifacts)||artifacts.length!==1)throw Error('Expected exactly one verified AAMA artifact')
  const artifact=artifacts[0]
  if(typeof artifact?.content!=='string'||bytes(artifact.content)>MAX_DXF_BYTES||
     !/\.dxf$/i.test(artifact.name||'')||!hex.test(artifact.sha256||''))
    throw Error('Invalid AAMA artifact metadata')
  const artifactHash=await sha256(artifact.content)
  if(artifactHash!==artifact.sha256.toLowerCase())throw Error('AAMA artifact content digest mismatch')
  if(artifact.localInspection?.status!=='LOCAL_INSPECTION_ONLY'||
     artifact.localInspection.sourceUnit!==engineResult.sourceUnit||
     !(artifact.localInspection.sourceCutPieces>0))
    throw Error('Verified upstream CUT inventory required')
  const {project,semantic}=createSeamlyAamaExoDraft20261023(original,{
    file:{name:artifactName||artifact.name,content:artifact.content,sha256:artifactHash},
    engine:{engine:'Seamly2D',manufacturingApproved:false,inputSha256:patternHash,measurementsSha256:measurementsHash},
    unit:engineResult.sourceUnit,editable,
  })
  if(project.pieces.length!==artifact.localInspection.sourceCutPieces)
    throw Error('AAMA source CUT count differs from engine inspection')
  project.name=`Valentina ${expectedName} · calculated CUT reference`
  project.patternSource={
    ...project.patternSource,type:'valentina-native-reference-transfer-v1',
    originEngine:'Valentina',calculationEngine:'Seamly2D',bridge:engineResult.bridge,
    sourceMapping:engineResult.sourceMapping,originalPatternFilename:`${expectedName}.val`,
    originalMeasurementsFilename:`${expectedName}.vit`,
    originalPatternXml:patternXml,originalMeasurementsXml:measurementsXml,
    originalPatternSha256:patternHash,originalMeasurementsSha256:measurementsHash,
    constructionReference:construction,
    constructionSourcePreserved:true,
    constructionGraphParsed:construction!==null,
    constructionParseNote:construction===null?'Full original XML retained; graph exceeds 4 MB structured parser limit':null,
    measurementReference:measurements,
    sourceIdentity:expectedName,
    originalAamaSha256:artifactHash,referenceOnly:true,factoryCertified:false,
    productionExportAllowed:false,independentSewlineVerified:false,
  }
  for(const piece of project.pieces){
    piece.patternImportProvenance={
      ...piece.patternImportProvenance,source:'valentina-upstream-calculated-aama',
      valentinaSourceSha256:patternHash,valentinaMeasurementsSha256:measurementsHash,
      upstreamEngine:'Seamly2D',referenceOnly:true,productionExportAllowed:false,
    }
  }
  return {project,semantic,source:{patternSha256:patternHash,measurementsSha256:measurementsHash,
    aamaSha256:artifactHash,construction,measurements,identity:expectedName}}
}
