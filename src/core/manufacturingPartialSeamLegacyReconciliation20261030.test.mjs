import test from 'node:test'
import assert from 'node:assert/strict'
import {inspectGradedNotchPairs} from './industrialNotchQA.js'
import {inspectGradedNotchSeamIntervals} from './gradedNotchIntervalAudit.js'
import {inspectManufacturingReleaseReadiness} from './manufacturingReleaseReadiness.js'
import {inspectIndustrialPatterns} from './industrialPatternQA.js'
import {buildFactoryPackageFiles} from './factoryPackage.js'
import {strFromU8} from 'fflate'

// Disposable XS/M shell/lining patterns. Not physical cutting or sewn-sample evidence.
const clean={blockers:0}
const injected={production:clean,industrial:clean,cutlines:clean,gradedTopology:{issues:[]},
  junctions:{status:'not_configured'},sample:{blockerCount:0,blockers:[],
    status:'evidence_complete_requires_human_factory_release',readyForHumanApproval:true,factoryCertified:false}}

function project({tA=.5,tB=.7,startA=.3,endA=.8,startB=.5,endB=1,reverseB=false,curved=false}={}){
  const piece=(id,t)=>({id,name:id,seamAllowance:1.2,points:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],
    ...(curved?{curves:{0:{cx:5,cy:-5}}}:{}),
    notches:[{id:`${id}-notch`,edgeIndex:0,t,depthCm:.3,type:'single',matchGroupId:'pair',matchedSeamId:'join'}]})
  return {pieces:[piece('shell',tA),piece('lining',tB)],
    seams:[{id:'join',a:{pieceId:'shell',edgeIndex:0,startT:startA,endT:endA},
      b:{pieceId:'lining',edgeIndex:0,startT:startB,endT:endB},reverseB}],
    grading:{sizes:['XS','M'],baseSize:'XS',widthPerSizeCm:0,lengthPerSizeCm:0}}
}

test('physically aligned partial seam is not factory-blocked solely by legacy whole-edge fractions',()=>{
  const p=project(),before=structuredClone(p)
  const legacy=inspectGradedNotchPairs(p),interval=inspectGradedNotchSeamIntervals(p)
  assert.equal(legacy.blockers,2)
  assert(legacy.issues.every(issue=>issue.code==='NOTCH_SEAM_MISALIGNMENT'))
  assert.equal(interval.status,'pass')
  const readiness=inspectManufacturingReleaseReadiness(p,{checks:{...injected,notches:legacy}})
  assert.equal(readiness.digitalCounts.pairedNotchBlockers,2)
  assert.equal(readiness.digitalCounts.pairedNotchEffectiveBlockers,0)
  assert.equal(readiness.digitalCounts.pairedNotchWholeEdgeSuperseded,2)
  assert.equal(readiness.digitalCounts.sewnIntervalNotchBlockers,0)
  assert(!readiness.blockers.some(item=>item.code==='SEWING_NOTCH_QA'))
  assert.equal(readiness.factoryCuttingAuthorized,false)
  assert.deepEqual(p,before)
})

test('industrial pattern QA legacy positional rows do not independently re-block a verified partial seam',()=>{
  const p=project()
  const rawIndustrial=inspectIndustrialPatterns(p)
  assert.equal(rawIndustrial.blockers,2)
  assert(rawIndustrial.issues.every(issue=>issue.code==='NOTCH_SEAM_MISALIGNMENT'))
  const readiness=inspectManufacturingReleaseReadiness(p,{checks:{...injected,
    industrial:rawIndustrial,notches:inspectGradedNotchPairs(p)}})
  assert.equal(readiness.digitalCounts.industrialPatternBlockers,2)
  assert.equal(readiness.digitalCounts.industrialPatternEffectiveBlockers,0)
  assert(!readiness.blockers.some(item=>item.code==='INDUSTRIAL_PATTERN_QA'))
  assert.equal(readiness.engineeringGeometryPass,true)
  assert.equal(readiness.factoryCuttingAuthorized,false)
})

test('disposable XS/M factory handoff manifest preserves raw blockers and publishes scoped reconciliation',()=>{
  const p=project()
  p.name='Disposable partial-seam receiving study'
  const files=buildFactoryPackageFiles(p)
  const json=name=>JSON.parse(strFromU8(files[name]))
  const legacy=json('industrial-notch-qa.json')
  const industrial=json('industrial-pattern-qa.json')
  const physical=json('graded-sewn-interval-notch-qa.json')
  const readiness=json('manufacturing-release-readiness.json')
  const reconciliation=json('graded-partial-seam-notch-reconciliation.json')
  const manifest=json('manifest.json')
  assert.equal(legacy.blockers,2)
  assert.equal(industrial.blockers,2)
  assert.equal(physical.status,'pass')
  assert.equal(readiness.digitalCounts.pairedNotchEffectiveBlockers,0)
  assert.equal(readiness.digitalCounts.industrialPatternEffectiveBlockers,0)
  assert.deepEqual(reconciliation,readiness.legacyNotchReconciliation)
  assert.deepEqual(reconciliation.supersededScopes,['pair · XS','pair · M'])
  assert.equal(reconciliation.factoryCuttingAuthorized,false)
  assert(manifest.files.includes('graded-partial-seam-notch-reconciliation.json'))
  assert.match(manifest.sha256['graded-partial-seam-notch-reconciliation.json'],/^[a-f0-9]{64}$/)
  assert(strFromU8(files['README.txt']).includes('graded-partial-seam-notch-reconciliation.json'))
})

test('physically misaligned disposable handoff cannot supersede raw notch blockers',()=>{
  const p=project({startB:.4})
  p.name='Disposable rejected partial-seam receiving study'
  const files=buildFactoryPackageFiles(p)
  const json=name=>JSON.parse(strFromU8(files[name]))
  const readiness=json('manufacturing-release-readiness.json')
  const reconciliation=json('graded-partial-seam-notch-reconciliation.json')
  assert.equal(reconciliation.status,'NO_SUPERSESSION')
  assert.deepEqual(reconciliation.supersededScopes,[])
  assert(readiness.blockers.some(row=>row.code==='GRADED_SEWN_INTERVAL_NOTCH_QA'))
  assert.equal(readiness.engineeringGeometryPass,false)
  assert.equal(readiness.factoryCuttingAuthorized,false)
})

test('legacy structural notch failures remain blockers even when physical stations happen to align',()=>{
  const p=project()
  p.pieces[0].notches[0].id=''
  const readiness=inspectManufacturingReleaseReadiness(p,{checks:{...injected,notches:inspectGradedNotchPairs(p)}})
  assert(readiness.blockers.some(item=>item.code==='SEWING_NOTCH_QA'))
  assert.equal(readiness.engineeringGeometryPass,false)
  assert.equal(readiness.factoryCuttingAuthorized,false)
})

test('mixed legacy identity and partial-station failures retain the identity blocker',()=>{
  const p=project()
  p.pieces[0].notches.push({id:'shell-notch',edgeIndex:1,t:.2})
  const legacy=inspectGradedNotchPairs(p)
  assert(legacy.issues.some(issue=>issue.code==='AMBIGUOUS_NOTCH_ID'))
  assert(legacy.issues.some(issue=>issue.code==='NOTCH_SEAM_MISALIGNMENT'))
  assert.equal(inspectGradedNotchSeamIntervals(p).status,'pass')
  const readiness=inspectManufacturingReleaseReadiness(p,{checks:{...injected,notches:legacy}})
  assert.equal(readiness.digitalCounts.pairedNotchWholeEdgeSuperseded,2)
  assert.equal(readiness.digitalCounts.pairedNotchEffectiveBlockers,1)
  assert(readiness.blockers.some(item=>item.code==='SEWING_NOTCH_QA'&&item.blockerCount===1))
  assert.equal(readiness.factoryCuttingAuthorized,false)
})

test('reversed partial seam may have different whole-edge stations yet valid sewn-start stations',()=>{
  const p=project({tA:.5,tB:.6,startA:.3,endA:.8,startB:.4,endB:.8,reverseB:true})
  assert.equal(inspectGradedNotchPairs(p).blockers,2)
  assert.equal(inspectGradedNotchSeamIntervals(p).status,'pass')
  const readiness=inspectManufacturingReleaseReadiness(p,{checks:{...injected,notches:inspectGradedNotchPairs(p)}})
  assert.equal(readiness.digitalCounts.pairedNotchWholeEdgeSuperseded,2)
  assert(!readiness.blockers.some(item=>item.code==='SEWING_NOTCH_QA'))
  assert.equal(readiness.factoryCuttingAuthorized,false)
})

test('physically mismatched partial seam is never excused by legacy reconciliation',()=>{
  const p=project({startB:.4})
  const readiness=inspectManufacturingReleaseReadiness(p,{checks:{...injected,notches:inspectGradedNotchPairs(p)}})
  assert(readiness.blockers.some(item=>item.code==='GRADED_SEWN_INTERVAL_NOTCH_QA'))
  assert.equal(readiness.engineeringGeometryPass,false)
  assert.equal(readiness.factoryCuttingAuthorized,false)
})

test('caller-injected incomplete legacy issue details cannot suppress a claimed notch failure',()=>{
  const p=project()
  const readiness=inspectManufacturingReleaseReadiness(p,{checks:{...injected,notches:{blockers:2}}})
  assert(readiness.blockers.some(item=>item.code==='SEWING_NOTCH_QA'))
  assert.equal(readiness.factoryCuttingAuthorized,false)
})

test('caller-forged industrial issue inventory cannot claim a verified positional supersession',()=>{
  const p=project()
  const forged={blockers:2,issues:[{code:'NOTCH_SEAM_MISALIGNMENT',scope:'pair · XS'},
    {code:'NOTCH_SEAM_MISALIGNMENT',scope:'pair · M'}]}
  const readiness=inspectManufacturingReleaseReadiness(p,{checks:{...injected,
    notches:inspectGradedNotchPairs(p),industrial:forged}})
  assert.equal(readiness.digitalCounts.industrialPatternEffectiveBlockers,2)
  assert.equal(readiness.digitalCounts.industrialPatternLegacyNotchSuperseded,0)
  assert(readiness.blockers.some(row=>row.code==='INDUSTRIAL_PATTERN_QA'))
  assert.equal(readiness.factoryCuttingAuthorized,false)
})

test('whole-edge mismatch on a full-length seam is not excused',()=>{
  const p=project({startA:0,endA:1,startB:0,endB:1})
  const readiness=inspectManufacturingReleaseReadiness(p,{checks:{...injected,notches:inspectGradedNotchPairs(p)}})
  assert(readiness.blockers.some(item=>item.code==='SEWING_NOTCH_QA'))
  assert.equal(readiness.factoryCuttingAuthorized,false)
})
