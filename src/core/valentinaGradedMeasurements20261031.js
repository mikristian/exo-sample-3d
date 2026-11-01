// Original Valentina .vst dimensional increments (not invented cut-piece grade).
// Measurements are evaluated at a selected count of original source size/height steps.
import {parseValentinaMeasurements} from './valentinaMeasurements20261031.js'

const UNIT_TO_CM={mm:0.1,cm:1,inch:2.54,in:2.54}
const STEPS_LIMIT=20
const value=(x,label)=>{
  if(!Number.isFinite(x)||Math.abs(x)>1e6)throw Error(`Invalid Valentina ${label}`)
  return x
}
function step(v,key){
  if(!Number.isInteger(v)||Math.abs(v)>STEPS_LIMIT)
    throw Error(`Valentina ${key} must be an integer number of size/height increments between -20 and 20`)
  return v
}
/**
 * One physical set of measures in the original pattern unit.
 *
 * Valentina VST does not guarantee a numerical axis step attribute, so the
 * caller requests explicit integer size/height *steps*, never guessed target
 * size or actual height. Formula-valued VST measurements fail rather than
 * silently substituting zero.
 */
export function evaluateValentinaGradedMeasurements20261031(source,{
  sizeSteps=0,heightSteps=0,patternUnit,
}={}){
  const document=typeof source==='string'?parseValentinaMeasurements(source):source
  if(document?.format!=='exo-valentina-measurements.v1'||!['vst','vit'].includes(document.kind))
    throw Error('Valentina individual/multisize measurements required')
  sizeSteps=step(sizeSteps,'sizeSteps')
  heightSteps=step(heightSteps,'heightSteps')
  if(document.kind==='vit'&&(sizeSteps!==0||heightSteps!==0))
    throw Error('Individual Valentina measurements do not define a size/height grade')
  const unit=patternUnit||document.sourceUnit
  if(!Object.hasOwn(UNIT_TO_CM,unit))throw Error('Unsupported original pattern unit')
  const sourceUnits=UNIT_TO_CM[document.sourceUnit]
  const resultUnits=UNIT_TO_CM[unit]
  if(!Number.isFinite(sourceUnits))throw Error('Unsupported source measurement unit')
  const measured={}
  const cm={}
  const rows=[]
  const sourceMeasurements=document.measurements
  if(!sourceMeasurements||typeof sourceMeasurements!=='object')throw Error('Invalid Valentina measurement table')
  for(const [name,item] of Object.entries(sourceMeasurements)){
    if(item.isFormula||item.valueCm===null||!Number.isFinite(item.valueCm))
      throw Error(`Valentina measurement ${name} needs original expression evaluation`)
    const base=item.valueCm
    const sizeDelta=document.kind==='vst'?item.sizeIncreaseCm:0
    const heightDelta=document.kind==='vst'?item.heightIncreaseCm:0
    if(!Number.isFinite(sizeDelta)||!Number.isFinite(heightDelta))
      throw Error(`Missing original Valentina grade increments for ${name}`)
    const resultCm=value(base+sizeSteps*sizeDelta+heightSteps*heightDelta,`graded ${name}`)
    // The genuine GOST source includes zero-valued optional measurements such
    // as waist_arc_b. Zero is a valid source datum; reject only negative
    // physical lengths from an out-of-range size/height combination.
    if(resultCm<0)throw Error(`Valentina graded measurement ${name} cannot be negative`)
    const result=value(resultCm/resultUnits,`scaled ${name}`)
    measured[name]=result
    cm[name]=resultCm
    rows.push({name,baseCm:base,sizeIncrementCm:sizeDelta,heightIncrementCm:heightDelta,
      resultCm,resultPatternUnit:result})
  }
  return {format:'exo-valentina-graded-measurements.v1',
    sourceFormat:document.kind,sourceUnit:document.sourceUnit,patternUnit:unit,
    sizeSteps,heightSteps,
    sizeBase:document.size?.base??null,heightBase:document.height?.base??null,
    sizeAxisStepKnown:document.size?.step!==null&&document.size?.step!==undefined,
    heightAxisStepKnown:document.height?.step!==null&&document.height?.step!==undefined,
    measurements:measured,measurementsCm:cm,rows,
    manufacturingApproved:false,qualifier:'Original source measurement increments evaluated; sewn/CUT graded piece geometry not independently qualified.'}
}

export function evaluateValentinaSizeRun20261031(source,{
  sizeSteps=[-2,-1,0,1,2],heightSteps=[0],patternUnit,maxCases=40,
}={}){
  if(!Array.isArray(sizeSteps)||!Array.isArray(heightSteps)||!sizeSteps.length||!heightSteps.length||
    sizeSteps.length*heightSteps.length>maxCases||maxCases>100)
    throw Error('Bounded Valentina size-run requires 1–100 explicit original increment combinations')
  const cases=[]
  const pairs=new Set()
  for(const sizeStep of sizeSteps)for(const heightStep of heightSteps){
    const key=`${step(sizeStep,'sizeSteps')}:${step(heightStep,'heightSteps')}`
    if(pairs.has(key))throw Error('Duplicate Valentina graded size/height combination')
    pairs.add(key)
    cases.push(evaluateValentinaGradedMeasurements20261031(source,{
      sizeSteps:sizeStep,heightSteps:heightStep,patternUnit}))
  }
  return {format:'exo-valentina-graded-measurement-size-run.v1',cases,
    manufacturingApproved:false}
}
