import test from 'node:test'
import assert from 'node:assert/strict'
import {createNativePatternConstraintSidecar20261023 as create} from './nativePatternConstraintBindings20261023.js'
import {reviewNativeBindingMeasurements as review} from './nativeBindingMeasurementReview20261027.js'
import {prepareModarisNativeWorksheetCommit20261030 as prepare} from './modarisNativeWorksheetCommit20261030.js'
import {witnessModarisNativeMultiPanelMeasurementCommit20261030 as witness} from './modarisNativeMultiPanelMeasurementCommit20261030.js'

function fixture(){
  const panel=id=>({
    id,name:id,fabric:'cotton',pins:[],pin_points:[],layout_2d:[0,0],
    pattern:{width:0.4,height:0.25,nx:1,ny:1},
    placement:{translation:[0,0,0],rotation_degrees:[0,0,0]},
    polygon:{points:[[0,0],[0.4,0],[0.4,0.25],[0,0.25]],
      edges:['top','right','bottom','left'],curves:{},free_curve_points:{},
      vertex_ids:{},vertex_mirror_groups:{},holes:[],lines:[],target_lengths:{},
      notches:{},seam_allowances:{},annotations:[],measurements:[],
      subdivisions:0},
  })
  const snapshot={revision:12,gradeRunPersisted:false,
    template:{id:'two-piece',name:'Twin',seams:[],panels:[panel('front'),panel('back')]}}
  const measurements={chest:{valueMm:800},halfWidth:{formula:'chest / 2'},
    depth:{valueMm:250}}
  const bindings=snapshot.template.panels.flatMap(p=>[
    {id:`${p.id}_width`,panelId:p.id,pointIndex:1,mode:'polar',
      a:0,b:0,distanceFormula:'halfWidth',angleDeg:0},
    {id:`${p.id}_corner`,panelId:p.id,pointIndex:2,mode:'polar',
      a:1,b:0,distanceFormula:'depth',angleDeg:90,
      dependsOn:[`${p.id}_width`]},
  ])
  snapshot.nativePointBindings={version:1,active:true,automaticRegeneration:false,
    manufacturingApproved:false,measurements,bindings}
  const created=create(snapshot,{measurements,bindings})
  assert.equal(created.ok,true,created.reason)
  const reviewed=review(snapshot,created.sidecar,{
    chest:840,halfWidth:{formula:'chest / 2'},depth:250})
  assert.equal(reviewed.ok,true,reviewed.reason)
  return {snapshot,sidecar:created.sidecar,reviewed}
}

function simulatedRustCommit(snapshot,proposal){
  const after=structuredClone(snapshot)
  after.revision++
  for(const panel of after.template.panels){
    panel.polygon.points[1][0]=0.42
    panel.polygon.points[2][0]=0.42
    panel.pattern.width=0.42
  }
  after.nativePointBindings.measurements.chest.valueMm=840
  after.nativeMeasurementRecompute={measurement:'chest',
    correctedBindingIds:[...proposal.changedBindingIds],
    affectedPanels:[...proposal.affectedPanels],panelCount:2,
    oneUndoStep:true,nativeAuthoritative:true}
  return after
}

test('one direct named worksheet change selects native multi-panel RPC without JS geometry coordinates',()=>{
  const {snapshot,sidecar,reviewed}=fixture()
  const before=structuredClone(snapshot)
  const prepared=prepare(snapshot,sidecar,reviewed)
  assert.equal(prepared.ok,true,prepared.reason)
  assert.deepEqual(prepared.request,{
    op:'bindings-multipanel-measurement-recompute',revision:12,
    measurement:'chest',expectedValueMm:800,valueMm:840})
  assert.deepEqual(prepared.affectedPanels,['back','front'])
  assert.equal(prepared.changedBindingIds.length,4)
  assert.deepEqual(snapshot,before)
  const result=witness(snapshot,simulatedRustCommit(snapshot,prepared),sidecar,prepared)
  assert.equal(result.ok,true,result.reason)
  assert.equal(result.nativeEvidenceVerified,true)
})

test('multi-panel preflight blocks stale graph, attached grade/sewn panel and forged request',()=>{
  const {snapshot,sidecar,reviewed}=fixture()
  const prepared=prepare(snapshot,sidecar,reviewed)
  assert.equal(prepared.ok,true,prepared.reason)
  const grade=structuredClone(snapshot);grade.gradeRunPersisted=true
  assert.match(prepare(grade,sidecar,reviewed).reason,/ungraded|Worksheet review evidence differs/)
  const sewn=structuredClone(snapshot);sewn.template.seams.push({a:{panel:'front'},b:{panel:'back'}})
  assert.match(prepare(sewn,sidecar,reviewed).reason,/stale|sewn|Worksheet review evidence differs/)
  const stale=structuredClone(snapshot);stale.nativePointBindings.measurements.chest.valueMm=799
  assert.match(prepare(stale,sidecar,reviewed).reason,/differ|Worksheet review evidence differs/)
  const forged=structuredClone(simulatedRustCommit(snapshot,prepared))
  forged.nativeMeasurementRecompute.correctedBindingIds=['front_width']
  assert.match(witness(snapshot,forged,sidecar,prepared).reason,/receipt/)
})

test('native postcommit witness rejects unsatisfied dependent point or change to unrelated panel',()=>{
  const {snapshot,sidecar,reviewed}=fixture()
  const prepared=prepare(snapshot,sidecar,reviewed)
  const changed=simulatedRustCommit(snapshot,prepared)
  changed.template.panels[0].polygon.points[2][0]=0.4
  assert.match(witness(snapshot,changed,sidecar,prepared).reason,/fail saved rules/)
  const extra=simulatedRustCommit(snapshot,prepared)
  extra.template.panels.push(structuredClone(extra.template.panels[0]))
  assert.match(witness(snapshot,extra,sidecar,prepared).reason,/panel count/)
})
