// Loopback UI adapter: authentic Valentina source -> independently ported,
// verified original Seamly2D MaleShirt computation. No browser filesystem paths.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {evaluateValentinaMaleShirtViaSeamly20261031} from './valentinaSeamlyExecutableBridge20261031.mjs'
import {inspectAamaR10Dxf20261023} from './seamlyAamaReceivingRoundtrip20261023.mjs'
import {parseSeamlyAamaManufacturingSemantics} from '../../src/core/seamlyAamaManufacturingSemantics20261023.mjs'

const fail=(code,reason)=>({ok:false,code,reason,manufacturingApproved:false})
const sourceText=(value,max)=>typeof value==='string'&&value.length>0&&
  new TextEncoder().encode(value).byteLength<=max

/** Respond only with original, source-identified and engine-calculated geometry. */
export function evaluateValentina2DRequest20261031(body,{outputRoot=os.tmpdir()}={}){
  if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).some(k=>!['patternXml','measurementsXml','format','sourceUnit'].includes(k)))
    return fail('INVALID_REQUEST','Expected original Valentina .val/.vit XML and an export format')
  if(!sourceText(body.patternXml,8*1024*1024)||!sourceText(body.measurementsXml,2*1024*1024))
    return fail('INVALID_SOURCE','Nonempty Valentina source files within 8 MB / 2 MB limits are required')
  if(!['svg','aama-r10'].includes(body.format))return fail('INVALID_FORMAT','Choose SVG or AAMA R10')
  if(body.format==='aama-r10'&&!['cm','mm','inch'].includes(body.sourceUnit))
    return fail('SOURCE_UNIT_REQUIRED','Explicit drawing units required before DXF inspection')
  let scratch
  try{
    if(typeof outputRoot!=='string'||!path.isAbsolute(outputRoot))return fail('INVALID_OUTPUT_ROOT','Absolute output directory required')
    scratch=fs.mkdtempSync(path.join(outputRoot,'exo-valentina-engine-'))
    const patternPath=path.join(scratch,'original.val')
    const measurementsPath=path.join(scratch,'measurements.vit')
    fs.writeFileSync(patternPath,body.patternXml,{flag:'wx'})
    fs.writeFileSync(measurementsPath,body.measurementsXml,{flag:'wx'})
    const result=evaluateValentinaMaleShirtViaSeamly20261031({
      patternPath,measurementsPath,format:body.format,outputRoot:scratch,
    })
    if(!result.ok)return fail(result.code||'CALCULATION_FAILED',result.reason||'Unsupported original Valentina construction')
    if(!result.artifacts?.length||result.artifacts.length>40)return fail('EMPTY_ENGINE_RESULT','No verified geometry returned')
    let length=0
    const artifacts=[]
    for(const item of result.artifacts){
      const bytes=fs.readFileSync(item.filename)
      length+=bytes.byteLength
      if(length>8*1024*1024||bytes.byteLength!==item.sizeBytes)
        return fail('ARTIFACT_LIMIT','Upstream output exceeds supported size')
      let localInspection=null
      if(body.format==='aama-r10'){
        const mmPerDrawingUnit={mm:1,cm:10,inch:25.4}[body.sourceUnit]
        const inspected=inspectAamaR10Dxf20261023(bytes,{declaredUnit:body.sourceUnit==='inch'?'in':body.sourceUnit,mmPerDrawingUnit})
        const semantics=parseSeamlyAamaManufacturingSemantics(bytes.toString('utf8'),{unit:body.sourceUnit,filename:item.name})
        if(semantics.pieces.length<1||semantics.pieces.length>150||
          semantics.pieces.some(p=>!p.cutOutlineMm||p.cutOutlineMm.points.length<3))
          return fail('CUT_GEOMETRY_UNAVAILABLE','Original engine did not yield safe physical CUT contours')
        localInspection={status:'LOCAL_INSPECTION_ONLY',sourceUnit:body.sourceUnit,
          sourceCutPieces:semantics.pieces.length,closedContourInventory:inspected.contourCount,
          independentScaleVerified:false,externalReceivingCadApproved:false,
          physicalSampleApproved:false}
      }
      artifacts.push({name:'valentina-maleshirt-'+item.name.replace(/^exo-seamly-evaluated-?/,''),
        sizeBytes:item.sizeBytes,sha256:item.sha256,content:bytes.toString('utf8'),localInspection})
    }
    return {ok:true,engine:'Seamly2D',originEngine:'Valentina',
      calculation:'original-seamly-executable-verified-valentina-source',
      bridge:result.bridge,sourceMapping:result.sourceMapping,
      format:body.format,sourceUnit:body.sourceUnit??null,artifacts,
      inputSha256:result.valentinaSourceSha256,measurementsSha256:result.valentinaMeasurementsSha256,
      manufacturingApproved:false,factoryExportAllowed:false,
      qualification:'Only this exact original Valentina MaleShirt source is mapped to an independently ported Seamly2D construction. Other Valentina graphs are unsupported.'}
  }catch(error){return fail('ENGINE_ERROR',String(error?.message||error))}
  finally{if(scratch)try{fs.rmSync(scratch,{recursive:true,force:true})}catch{}}
}
