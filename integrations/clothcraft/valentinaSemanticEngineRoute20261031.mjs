import {createHash} from 'node:crypto'
import {convertValentinaSourceToSeamly20261031} from './valentinaUniversalSeamlyBridge20261031.mjs'
import {evaluateSeamly2DRequest20261023} from './seamly2dEngineRoute20261023.mjs'
import {parseValentinaMeasurements} from '../../src/core/valentinaMeasurements20261031.js'

const sha256=text=>createHash('sha256').update(text).digest('hex')
const deny=(code,reason,diagnostics=[])=>({ok:false,code,reason,diagnostics,manufacturingApproved:false})
/** Original source-format adapter: source formulas remain in the generated
 * Seamly graph, and the actual upstream executable resolves CUT/SVG geometry.
 * Unsupported original Valentina constructs cannot be approximated.
 */
export function evaluateValentinaSemanticRequest20261031(body){
  if(!body||typeof body!=='object'||Array.isArray(body)||
     Object.keys(body).some(key=>!['patternXml','measurementsXml','format','sourceUnit'].includes(key)))
    return deny('INVALID_REQUEST','Expected Valentina original .val/.vit XML and requested export')
  if(typeof body.patternXml!=='string'||Buffer.byteLength(body.patternXml)>8*1024*1024||
     typeof body.measurementsXml!=='string'||Buffer.byteLength(body.measurementsXml)>2*1024*1024)
    return deny('INVALID_SOURCE','Source files exceed original Valentina import limits')
  if(!['svg','aama-r10'].includes(body.format))
    return deny('INVALID_FORMAT','SVG or AAMA R10 required')
  if(body.format==='aama-r10'&&!['mm','cm','inch'].includes(body.sourceUnit))
    return deny('SOURCE_UNIT_REQUIRED','Source units must be explicit for DXF inspection')
  try{
    const measurements=parseValentinaMeasurements(body.measurementsXml,{filename:'source.vit'})
    if(measurements.kind!=='vit')
      return deny('UNSUPPORTED_MEASUREMENTS','Multisize VST source grading is separate from individual source calculation')
    if(measurements.hasUnevaluatedFormulas)
      return deny('UNSUPPORTED_MEASUREMENTS','Original Valentina formula-valued body measurements require their native evaluator')
    const converted=convertValentinaSourceToSeamly20261031(body.patternXml)
    if(!converted.ok)return deny(converted.code||'UNSUPPORTED_SOURCE',converted.reason,converted.diagnostics||[])
    if(Buffer.byteLength(converted.xml)>4*1024*1024)
      return deny('CONVERTED_SOURCE_TOO_LARGE','Original Seamly2D runtime source graph budget exceeded')
    // Valentina/Seamly share the individual measurement values in these
    // source versions. The root/version translation does not rewrite units.
    const source=body.measurementsXml
    if(!/^\s*<\?xml[^>]*\?>\s*<vit>/.test(source)||!/<\/vit>\s*$/.test(source))
      return deny('UNSUPPORTED_MEASUREMENTS','Expected original individual .vit root')
    const seamlyMeasurements=source.replace('<vit>','<smis>')
      .replace(/<\/vit>\s*$/,'</smis>')
      .replace('<version>0.3.3</version>','<version>0.3.4</version>')
    const result=evaluateSeamly2DRequest20261023({
      patternXml:converted.xml,measurementsXml:seamlyMeasurements,format:body.format,
      ...(body.format==='aama-r10'?{sourceUnit:body.sourceUnit}:{}),
    })
    if(!result.ok)return deny(result.code||'UPSTREAM_CALCULATION_FAILED',result.reason||'Original upstream engine refused converted graph')
    return {...result,originEngine:'Valentina',calculationEngine:'Seamly2D',
      bridge:'semantic-source-translation',originalPatternSha256:sha256(body.patternXml),
      originalMeasurementsSha256:sha256(body.measurementsXml),
      translatedGraphSha256:converted.outputSha256,convertedSourceToolCount:converted.constructionTools,
      convertedSourcePieceCount:converted.pieces,convertedBlocks:converted.blocks,
      manufacturingApproved:false,factoryExportAllowed:false,
      qualification:'Semantic source conversion to genuine upstream Seamly2D runtime, not Valentina C++ execution. File/tool compatibility is conditional; independent dimension and factory acceptance remain required.'}
  }catch(error){return deny('SOURCE_CONVERSION_FAILED',String(error?.message||error))}
}
