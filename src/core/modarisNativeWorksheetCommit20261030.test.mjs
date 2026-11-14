import test from 'node:test'
import assert from 'node:assert/strict'
import {createNativePatternConstraintSidecar20261023 as create} from './nativePatternConstraintBindings20261023.js'
import {reviewNativeBindingMeasurements as review} from './nativeBindingMeasurementReview20261027.js'
import {prepareModarisNativeWorksheetCommit20261030 as prepare} from './modarisNativeWorksheetCommit20261030.js'
import {witnessModarisNativeMeasurementCommit20261027 as witness} from './modarisNativeMeasurementCommit20261027.js'

function fixture() {
  const snapshot={revision:4,template:{id:'worksheet',seams:[],panels:[{
    id:'front',name:'Front',fabric:'cotton',pins:[],pin_points:[],layout_2d:[0,0],
    pattern:{width:.4,height:.4,nx:1,ny:1},
    placement:{translation:[0,0,0],rotation_degrees:[0,0,0]},
    polygon:{points:[[0,0],[.4,0],[.4,.4],[0,.4]],edges:['a','b','c','d'],
      subdivisions:0,curves:{},free_curve_points:{},vertex_ids:{},vertex_mirror_groups:{},
      holes:[],lines:[],target_lengths:{},notches:[],seam_allowances:{},annotations:[],measurements:{}}
  }]}}
  const measurements={hemWidth:{valueMm:400},allowance:{valueMm:0},computed:{formula:'hemWidth + allowance'}}
  const bindings=[{id:'hem',panelId:'front',pointIndex:3,mode:'polar',a:2,b:1,angleDeg:180,distanceFormula:'computed'}]
  snapshot.nativePointBindings={version:1,active:true,automaticRegeneration:false,manufacturingApproved:false,measurements,bindings}
  const stored=create(snapshot,{measurements,bindings})
  assert.equal(stored.ok,true,stored.reason)
  return {snapshot,sidecar:stored.sidecar}
}

test('qualified worksheet change uses Rust-owned one-measurement RPC and zero caller point positions',()=>{
  const {snapshot,sidecar}=fixture(),before=structuredClone(snapshot)
  const reviewed=review(snapshot,sidecar,{hemWidth:420,allowance:0,computed:{formula:'hemWidth + allowance'}})
  assert.equal(reviewed.ok,true,reviewed.reason)
  const result=prepare(snapshot,sidecar,reviewed)
  assert.equal(result.ok,true,result.reason)
  assert.deepEqual(result.request,{op:'bindings-measurement-recompute',revision:4,measurement:'hemWidth',expectedValueMm:400,valueMm:420})
  assert.equal(result.changedBindingIds[0],'hem')
  assert.equal(result.manufacturingApproved,false)
  assert.deepEqual(snapshot,before)
  const committed=structuredClone(snapshot)
  committed.revision++
  committed.template.panels[0].polygon.points=[[.02,0],[.42,0],[.42,.4],[0,.4]]
  committed.template.panels[0].pattern.width=.42
  committed.template.panels[0].layout_2d=[-.02,0]
  committed.template.panels[0].placement.translation=[-.02,0,0]
  committed.nativePointBindings.measurements.hemWidth.valueMm=420
  committed.nativeMeasurementRecompute={nativeAuthoritative:true,oneUndoStep:true,
    measurement:'hemWidth',correctedBindingIds:['hem']}
  const validated=witness(snapshot,committed,sidecar,result)
  assert.equal(validated.ok,true,validated.reason)
  assert.equal(validated.committedRevision,5)
})

test('worksheet cannot advertise atomic Rust commit when multiple values or formulas changed',()=>{
  const {snapshot,sidecar}=fixture()
  for(const measurements of [
    {hemWidth:420,allowance:2,computed:{formula:'hemWidth + allowance'}},
    {hemWidth:420,allowance:0,computed:{formula:'hemWidth + allowance + 1'}},
  ]){
    const reviewed=review(snapshot,sidecar,measurements)
    assert.equal(reviewed.ok,true,reviewed.reason)
    assert.equal(prepare(snapshot,sidecar,reviewed).ok,false)
  }
})

test('worksheet refuses one-step operation for stale native graph or unchanged review',()=>{
  const {snapshot,sidecar}=fixture()
  const unchanged=review(snapshot,sidecar,sidecar.measurements)
  assert.equal(prepare(snapshot,sidecar,unchanged).ok,false)
  const changed=review(snapshot,sidecar,{hemWidth:420,allowance:0,computed:{formula:'hemWidth + allowance'}})
  const drift=structuredClone(snapshot)
  drift.nativePointBindings.measurements.hemWidth.valueMm=410
  assert.match(prepare(drift,sidecar,changed).reason,/differ/i)
  const unrelated=structuredClone(snapshot)
  unrelated.nativePointBindings.active=false
  assert.equal(prepare(unrelated,sidecar,changed).ok,false)
})

test('one-step native commit refuses forged or stale worksheet review evidence',()=>{
  const {snapshot,sidecar}=fixture()
  const reviewed=review(snapshot,sidecar,{hemWidth:420,allowance:0,computed:{formula:'hemWidth + allowance'}})
  assert.equal(reviewed.ok,true,reviewed.reason)
  assert.equal(prepare(snapshot,sidecar,reviewed).ok,true)
  const cases=[
    ['source fingerprint',draft=>{draft.sidecar.sourceFingerprint=`sha256:${'0'.repeat(64)}`}],
    ['source revision',draft=>{draft.sidecar.sourceRevision++}],
    ['binding angle',draft=>{draft.sidecar.bindings[0].angleDeg=90}],
    ['reviewed value changed after review',draft=>{draft.sidecar.measurements.hemWidth=421}],
    ['reviewed geometry claim',draft=>{draft.changes[0].afterMm[0]+=10}],
    ['manufacturing approval spoof',draft=>{draft.manufacturingApproved=true}],
  ]
  for(const [label,mutate] of cases){
    const forged=structuredClone(reviewed)
    mutate(forged)
    const result=prepare(snapshot,sidecar,forged)
    assert.equal(result.ok,false,`${label} must not produce a native commit request`)
    assert.equal(result.request,undefined,label)
    assert.equal(result.manufacturingApproved,false,label)
  }
})
