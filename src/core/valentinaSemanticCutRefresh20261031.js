import {transferValentinaSemanticNativeDraft20261031} from './valentinaSemanticNativeTransfer20261031.js'
import {createSeamlyAamaExoDraft20261023} from './seamlyAamaToExoDraft20261023.js'

const hex=/^[a-f0-9]{64}$/
async function sha(text){
  const buffer=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))
  return [...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,'0')).join('')
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const geometryKeys=['points','curves','notches','internalLines','buttonholes','seamAllowance','sourceLayer','sourceToken','seamlySourceGuides','locked','active3d','frozen3d']
const geometry=piece=>Object.fromEntries(geometryKeys.map(key=>[key,piece[key]]))
const expectedProvenance=(piece,source)=>({
  ...piece.patternImportProvenance,
  source:'semantic-valentina-upstream-calculated-aama',
  originalPatternSha256:source.originalPatternSha256,
  originalMeasurementsSha256:source.originalMeasurementsSha256,
  convertedGraphSha256:source.convertedGraphSha256,
  originalAamaSha256:source.originalAamaSha256,
  referenceOnly:true,productionExportAllowed:false,
})

/** Refresh an untouched original-engine CUT draft, leaving caller state and source bytes intact.
 * A previously authored CUT is rejected because there is no trustworthy merge of edits.
 */
export async function refreshValentinaSemanticCutDraft20261031(original,{patternXml,measurementsXml,engineResult}={}){
  const source=original?.patternSource
  if(source?.type!=='valentina-semantic-upstream-cut-draft-v1'||
    source.bridge!=='semantic-source-translation'||source.originEngine!=='Valentina'||
    source.calculationEngine!=='Seamly2D'||source.sourceGraphPreserved!==true||
    source.referenceOnly!==true||source.productionExportAllowed!==false||
    typeof source.originalPatternXml!=='string'||typeof source.originalMeasurementsXml!=='string'||
    typeof source.originalDxfText!=='string'||!Array.isArray(original.pieces)||
    !original.pieces.length||!hex.test(source.originalPatternSha256||'')||
    !hex.test(source.originalMeasurementsSha256||'')||!hex.test(source.originalAamaSha256||''))
    throw Error('Verified semantic Valentina baseline required before refresh')

  const hashes=await Promise.all([
    sha(source.originalPatternXml),sha(source.originalMeasurementsXml),sha(source.originalDxfText),
  ])
  if(!same(hashes,[source.originalPatternSha256,source.originalMeasurementsSha256,source.originalAamaSha256])||
    source.originalDxfSha256!==source.originalAamaSha256)
    throw Error('Stored semantic source baseline SHA-256 mismatch')
  if(!Number.isInteger(source.sourceDetailCount)||!Number.isInteger(source.sourceToolCount)||
    !Number.isInteger(source.sourceBlockCount)||source.sourceDetailCount<1||
    !hex.test(source.convertedGraphSha256||''))
    throw Error('Stored semantic source inventory baseline missing')
  const expected=createSeamlyAamaExoDraft20261023(original,{
    file:{name:source.fileName||'original.dxf',content:source.originalDxfText,sha256:source.originalAamaSha256},
    engine:{engine:'Seamly2D',manufacturingApproved:false,
      inputSha256:source.inputSha256,measurementsSha256:source.measurementsSha256},
    unit:engineResult?.sourceUnit||String(source.sourceScale||'').match(/^explicit (mm|cm|inch)\/unit$/)?.[1],
    editable:source.editableDraft,
  }).project
  const layoutKeys=new Set(['x','y','rotation','scale','zIndex','zOrder'])
  if(original.pieces.some((piece,i)=>Object.keys(piece).some(key=>
      !Object.hasOwn(expected.pieces[i]||{},key)&&!layoutKeys.has(key)))||
    original.productionSpec!=null||
    !same(original.grading,expected.grading))
    throw Error('Authored piece metadata or production settings require manual resolution')
  if(expected.pieces.length!==original.pieces.length||
    source.sourceDetailCount!==original.pieces.length||
    original.pieces.some((piece,i)=>
      !piece?.id||!same(
        Object.fromEntries(Object.entries(piece).filter(([key])=>key!=='id'&&!layoutKeys.has(key)&&key!=='patternImportProvenance')),
        Object.fromEntries(Object.entries(expected.pieces[i]).filter(([key])=>key!=='id'&&!layoutKeys.has(key)&&key!=='patternImportProvenance')))||
      !same(piece.patternImportProvenance,expectedProvenance(expected.pieces[i],source))))
    throw Error('Existing semantic CUT changed or source inventory differs; manual edit refresh refused')
  if(original.seams?.length||original.topstitches?.length||original.fasteners?.length||
    original.trims?.length||original.customMeasurements?.length)
    throw Error('Authored annotations require manual resolution before CUT refresh')
  if(typeof patternXml!=='string'||typeof measurementsXml!=='string')
    throw Error('New original source and measurements required')
  if(patternXml===source.originalPatternXml&&measurementsXml===source.originalMeasurementsXml)
    throw Error('Source inputs are unchanged')

  const transferred=await transferValentinaSemanticNativeDraft20261031(original,{
    patternXml,measurementsXml,engineResult,editable:source.editableDraft,
  })
  const next=transferred.project
  if(next.pieces.length!==original.pieces.length)
    throw Error('Recalculated physical CUT piece count changed')
  const tokenMap=new Map(next.pieces.map(piece=>[piece.sourceToken,piece]))
  const originalTokens=original.pieces.map(piece=>piece.sourceToken)
  if(tokenMap.size!==next.pieces.length||new Set(originalTokens).size!==originalTokens.length||
    originalTokens.some(token=>typeof token!=='string'||!tokenMap.has(token)))
    throw Error('Recalculated source piece tokens differ from baseline')
  // The native AAMA exporter may permute INSERT block order between runs.
  // Exact unique source block tokens provide a verifiable mapping.
  next.pieces=originalTokens.map(token=>tokenMap.get(token))
  if(engineResult.convertedSourcePieceCount!==source.sourceDetailCount||
    engineResult.convertedSourceToolCount!==source.sourceToolCount||
    engineResult.convertedBlocks!==source.sourceBlockCount)
    throw Error('Recalculated source construction inventory changed')
  if(next.patternSource.originalAamaSha256===source.originalAamaSha256||
    same(next.pieces.map(geometry),original.pieces.map(geometry)))
    throw Error('Recalculation produced unchanged physical CUT geometry')
  next.id=original.id
  next.name=original.name
  next.pieces=next.pieces.map((piece,i)=>({
    ...piece,id:original.pieces[i].id,
    // Position and stacking are UI layout state, preserved across numeric recalculation.
    ...Object.fromEntries(['x','y','rotation','scale','zIndex','zOrder'].filter(key=>
      Object.hasOwn(original.pieces[i],key)).map(key=>[key,original.pieces[i][key]])),
  }))
  const changedCount=next.pieces.filter((p,i)=>!same(p.points,original.pieces[i].points)).length
  return {project:next,changed:true,changedCount,previousAamaSha256:source.originalAamaSha256,
    currentAamaSha256:next.patternSource.originalAamaSha256,
    source:transferred.source}
}
