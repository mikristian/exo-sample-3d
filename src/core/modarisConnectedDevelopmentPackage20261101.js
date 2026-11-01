import {strToU8,zipSync} from 'fflate'
import {buildSizeRun} from './grading.js'
import {connectedSourceToManufacturingDxf} from './dxf.js'
import {assertFreshModarisSizeLinkedGradeProject20261027} from './modarisSizeLinkedGradePersistence20261027.js'
import {preflightPhysicalCutOverlap20261023_2000} from './physicalCutOverlapPreflight20261023_2000.mjs'
import {sha256Bytes} from './sha256Bytes.js'
import {buildMarker} from './marker.js'
import {markerToSvg,markerToPdf} from './markerArtifacts.js'
import {auditMarkerDxfGeometryParity20261024} from './accumarkMarkerDxfGeometryParity20261024.mjs'
import {auditMarkerPlotParity20261024} from './accumarkMarkerPlotParity20261024.mjs'
import {auditMarkerRulerInkClearance20261024} from './accumarkMarkerRulerInkClearance20261024.mjs'
import {makeMarkerCalibrationSheet20261024} from './accumarkMarkerCalibrationSheet20261024.mjs'
import {inspectIndustrialPatterns} from './industrialPatternQA.js'
import {inspectGradedCutlines} from './industrialCutlineQA.js'
import {inspectGradedNotchPairs} from './industrialNotchQA.js'
import {auditGradedSizeRunGeometry} from './gradedSizeRunGeometryAudit.js'

/** A review-only development archive, deliberately separate from the signed
 * factory package. Never labels geometry approved for manufacturing. */
export function buildModarisConnectedDevelopmentFiles20261101(project){
  if(project?.modarisSizeLinkedGrade===undefined)throw Error('Connected development package requires authored linked source')
  assertFreshModarisSizeLinkedGradeProject20261027(project)
  if(project.patternSource?.referenceOnly||project.pieces?.some(p=>p.patternImportProvenance?.referenceOnly))
    throw Error('Connected development package refused: reference-only pattern')
  const sizes=project.grading?.sizes
  if(!Array.isArray(sizes)||!sizes.length||sizes.length>120||sizes.some(s=>typeof s!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(s))||new Set(sizes).size!==sizes.length)
    throw Error('Connected development package refused: unsafe size names')
  const run=buildSizeRun(project)
  const files=Object.create(null)
  const add=(name,value)=>{if(Object.hasOwn(files,name))throw Error('Duplicate development archive path');files[name]=typeof value==='string'?strToU8(value):value}
  const checks=[]
  const dxfBySize=Object.create(null),gradedBySize=Object.create(null),markersBySize=Object.create(null)
  const defaultWidth=project.markerSettings?.fabricWidthCm??150
  const gap=project.markerSettings?.gapCm??1.5
  for(const size of sizes){
    const graded=run[size]
    if(!graded||graded.previewSize!==size||graded.pieces?.length!==project.pieces.length)
      throw Error(`Connected development package refused: incomplete linked size ${size}`)
    const dxf=connectedSourceToManufacturingDxf(project,size)
    const audit=preflightPhysicalCutOverlap20261023_2000(dxf)
    if(!audit.ok||audit.contourCount!==graded.pieces.length)
      throw Error(`Connected development package refused: unsafe physical CUT for ${size}`)
    add(`patterns/${size}.dxf`,dxf)
    dxfBySize[size]=dxf
    gradedBySize[size]=graded
    const strict={...graded,pieces:graded.pieces.map(p=>p.cutQuantity==null?{...p,cutQuantity:1}:p)}
    const fabricIds=[...new Set(graded.pieces.map(p=>p.fabricId||'main'))]
    markersBySize[size]=Object.fromEntries(fabricIds.map(fabricId=>{
      const width=graded.markerSettings?.fabricWidthsCm?.[fabricId]??defaultWidth
      return [fabricId,buildMarker(strict,width,gap,{fabricId,strictProductionDemand:true})]
    }))
    checks.push({size,cutContourCount:audit.contourCount,internalGeometryCheck:'passed',factoryCertified:false})
  }
  const markerParity=auditMarkerDxfGeometryParity20261024(project,{dxfBySize,gradedBySize,markersBySize,defaultFabricWidth:defaultWidth,gap})
  if(!markerParity.ok||markerParity.sizes.length!==sizes.length)
    throw Error('Connected development package refused: marker/DXF geometry parity failed: '+markerParity.issues.slice(0,4).map(i=>i.code).join(','))
  add('qa/marker-dxf-parity.json',JSON.stringify(markerParity,null,2))
  const plotRows=[]
  for(const size of sizes)for(const [fabricId,marker] of Object.entries(markersBySize[size])){
    const graded=gradedBySize[size]
    const fabricName=project.fabrics?.[fabricId]?.name||fabricId
    const ruler=auditMarkerRulerInkClearance20261024(marker,{size,pageLengthCm:400})
    if(ruler.issues?.some(i=>i.code==='INVALID_RULER_SOURCE'))throw Error('Invalid marker ruler source')
    const separate=marker.width<11||Math.max(1,marker.length)<3||!ruler.ok
    const calibration=separate?makeMarkerCalibrationSheet20261024({size,fabricId:marker.fabricId||'Fabric'}):null
    const svg=markerToSvg(marker,{size,fabricName,project:graded,calibration:true,separateCalibrationSheet:separate})
    const pdf=marker.placements.length&&marker.length>0?markerToPdf(marker,{size,project:graded,calibration:true,requirePrintedRegistration:true,separateCalibrationSheet:separate}):null
    const plot=auditMarkerPlotParity20261024(marker,{svg,pdf,size,fabricName,project:graded,calibrationSheet:calibration,requirePrintedRegistration:true,separateCalibrationSheet:separate,requireRulerInkClearance:true})
    if(!plot.ok)throw Error(`Connected development package refused: marker plot parity ${size}/${fabricId}: ${plot.issues.map(i=>i.code).join(',')}`)
    add(`markers/${size}/${fabricId}.svg`,svg)
    if(pdf)add(`markers/${size}/${fabricId}.pdf`,pdf)
    if(calibration){add(`print-calibration/${size}/${fabricId}.svg`,calibration.svg);add(`print-calibration/${size}/${fabricId}.pdf`,calibration.pdf)}
    plotRows.push({size,fabricId,ok:true,factoryApproved:false})
  }
  add('qa/marker-plot-parity.json',JSON.stringify({ok:true,factoryApproved:false,rows:plotRows},null,2))
  const industrial=inspectIndustrialPatterns(project),cutlines=inspectGradedCutlines(project),notches=inspectGradedNotchPairs(project),geometry=auditGradedSizeRunGeometry(project)
  for(const [name,report] of Object.entries({industrial,cutlines,notches,geometry}))
    add(`qa/${name}.json`,JSON.stringify({...report,factoryCertified:false},null,2))
  add('source/garment-source.json',JSON.stringify(project,null,2))
  add('source/linked-size-run.json',JSON.stringify(run,null,2))
  add('review-status.json',JSON.stringify({format:'exo.connected-development-review.v1',
    releaseStatus:'NOT_APPROVED_FOR_CUTTING_OR_BULK_PRODUCTION',factoryCertified:false,
    requiredExternalChecks:['Independent licensed CAD import','Calibrated print-scale measurement','Physical cut and sewn sample','Factory approval'],checks},null,2))
  const hashes=Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,sha256Bytes(bytes)]))
  add('manifest.json',JSON.stringify({format:'exo.connected-development-manifest.v1',factoryCertified:false,
    files:[...Object.keys(files),'manifest.json'].sort(),sha256:hashes},null,2))
  return files
}

export function buildModarisConnectedDevelopmentZip20261101(project){
  return zipSync(buildModarisConnectedDevelopmentFiles20261101(project),{level:6})
}
