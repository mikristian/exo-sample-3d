import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateTechPackProductionGovernance, appendTechPackGovernanceRecord, TECH_PACK_PHYSICAL_CHECKS, canPerformTechPackGovernanceAction} from './techPackProductionGovernance20261031.js'
import {techPackFactoryReadiness} from './techPackFactoryReadiness.js'

const record = (extra={}) => ({actor:'Jane',role:'factory quality',at:'2026-10-31T12:00:00Z',
  evidenceId:'evidence-1',evidenceDescription:'signed sample inspection document',sourceRevision:'rev1',...extra})
const complete = () => ({samples:[{id:'cycle1',sampleId:'sample1',sourceRevision:'rev1',at:'2026-10-31T12:00:00Z',
  checks:TECH_PACK_PHYSICAL_CHECKS.map(kind=>record({kind,result:'pass'}))}],
  requirements:[{id:'labelling',jurisdiction:'US',description:'Applicable label verification'}],
  compliance:[record({requirementId:'labelling',result:'pass'})],
  comments:[record({status:'resolved',body:'Trim corrected'})],
  approvals:[record({scope:'design',decision:'approved'}),record({scope:'factory',decision:'approved',factoryId:'factory1',sampleId:'sample1'})],
  handoffs:[record({status:'accepted',factoryId:'factory1',recipient:'Factory QA'})],
  release:record({scope:'production',decision:'approved',factoryId:'factory1',sampleId:'sample1'})})

test('production governance requires explicitly evidenced physical sample and written release',()=>{
  assert.equal(evaluateTechPackProductionGovernance({revision:'rev1'}).releaseReady,false)
  const good=evaluateTechPackProductionGovernance({revision:'rev1'},complete())
  assert.equal(good.releaseReady,true)
  assert.equal(good.physicalApproved,true)
  const stale=evaluateTechPackProductionGovernance({revision:'rev2'},complete())
  assert.equal(stale.releaseReady,false)
  assert.equal(stale.factoryApproval,false)
  assert.equal(stale.physicalApproved,false)
  const unsigned=complete(); unsigned.samples[0].checks[0].evidenceId=''
  assert.equal(evaluateTechPackProductionGovernance({revision:'rev1'},unsigned).physicalApproved,false)
})

test('comments, role evidence, matching sample and handoff are release gates',()=>{
  const open=complete(); open.comments.push(record({status:'open',body:'Factory fit query'}))
  assert(evaluateTechPackProductionGovernance({revision:'rev1'},open).issues.some(x=>x.id==='comments'))
  const mismatch=complete(); mismatch.approvals[1].sampleId='sample-old'
  assert.equal(evaluateTechPackProductionGovernance({revision:'rev1'},mismatch).factoryApproval,false)
  const missingRole=complete(); missingRole.handoffs[0].role=''
  assert.equal(evaluateTechPackProductionGovernance({revision:'rev1'},missingRole).handoff,false)
  assert.equal(appendTechPackGovernanceRecord({},'comments',record()).comments.length,1)
  assert.throws(()=>appendTechPackGovernanceRecord({},'unknown',record()),TypeError)
})

test('readiness uses print paginator capacity for embedded tables and shared header',()=>{
  const table={columns:[{id:'one'}],rows:Array.from({length:4},(_,i)=>({cells:{one:i}}))}
  const source={ready:true,revision:'rev1'}
  for(const [role,height] of [['tables',139],['header',90]]){
    const workspace={pageBoxes:{overview:[{id:'one',height,slot:{category:role,templateRole:role==='header'?'shared-header':undefined,spreadsheetTable:table}}]}}
    assert(!techPackFactoryReadiness(source,{},workspace).review.some(x=>x.id==='table-overflow-overview-one'),role)
  }
  const workspace={pageBoxes:{overview:[{id:'one',height:60,slot:{category:'tables',spreadsheetTable:table}}]}}
  assert(techPackFactoryReadiness(source,{},workspace).review.some(x=>x.id==='table-overflow-overview-one'))
})

test('advisory UI permissions fail closed for missing or unrecognized roles',()=>{
  assert.equal(canPerformTechPackGovernanceAction('designer','release'),false)
  assert.equal(canPerformTechPackGovernanceAction('factory-qa','sample-review'),true)
  assert.equal(canPerformTechPackGovernanceAction('factory-qa','release'),false)
  assert.equal(canPerformTechPackGovernanceAction('production-manager','release'),true)
  assert.equal(canPerformTechPackGovernanceAction('unknown','release'),false)
})
