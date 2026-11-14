import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyNativeCrossPieceCommit20261030 as witness} from './nativeCrossPieceCommitWitness20261030.js'

const panel=(id,x)=>({id,layout_2d:[x,0],layout_rotation_degrees:0,
  polygon:{points:[[0,0],[.4,0],[.4,.3],[0,.3]],edges:['a','b','c','d']}})
const template=()=>({panels:[panel('front',0),panel('back',.5),panel('sleeve',1)]})
const link=()=>({version:1,active:true,sourcePanelId:'front',sourcePointIndex:1,
  targetPanelId:'back',targetPointIndex:1,boardOffsetM:[.5,0],manufacturerApproved:false})
const commit=operation=>({operation,nativeAuthoritative:true,oneUndoStep:true,manufacturingApproved:false})
const source=()=>({revision:7,template:template(),nativeCrossPieceLink:null,
  gradeRunPersisted:false,manufacturingApproved:false})
const installReq={op:'native-cross-piece-install',revision:7,sourcePanelId:'front',sourcePointIndex:1,
  targetPanelId:'back',targetPointIndex:1}
const installed=()=>({...source(),revision:8,nativeCrossPieceLink:link(),nativeCrossPieceCommit:commit('install')})
const moveReq={op:'native-cross-piece-move',revision:8,sourcePanelId:'front',
  expectedPosition:[.4,0],position:[.42,0]}
const moved=()=>{
  const after=structuredClone(installed())
  after.revision=9
  after.nativeCrossPieceCommit=commit('move')
  after.template.panels[0].polygon.points[1]=[.42,0]
  after.template.panels[1].polygon.points[1]=[.42,0]
  return after
}
test('native installation, linked movement and removal each pass strict source/geometry witness',()=>{
  assert.equal(witness(source(),installReq,installed()).ok,true)
  assert.equal(witness(installed(),moveReq,moved()).ok,true)
  const cleared={...moved(),revision:10,nativeCrossPieceLink:null}
  assert.equal(witness(moved(),{op:'native-cross-piece-clear',revision:9},cleared).ok,true)
  assert.equal(witness(installed(),moveReq,moved()).manufacturingApproved,false)
})
test('compatible six-size source flag is retained without claiming external grade validation',()=>{
  const before=installed(),after=moved()
  before.gradeRunPersisted=true;after.gradeRunPersisted=true
  assert.equal(witness(before,moveReq,after).ok,true)
  after.gradeRunPersisted=false
  assert.match(witness(before,moveReq,after).reason,/grade identity/i)
})
test('curved AnchorGroup normalization may change material Y while preserving exact board-space move',()=>{
  const after=moved()
  for(const p of after.template.panels.slice(0,2)){
    p.polygon.points[1][1]=.03
    p.layout_2d[1]=-.03
  }
  assert.equal(witness(installed(),moveReq,after).ok,true)
  after.template.panels[0].layout_2d[1]=-.02
  assert.equal(witness(installed(),moveReq,after).ok,false)
})
test('rejects forged commit flags, revision and changed install geometry',()=>{
  for(const mutation of [
    a=>{a.revision=11},a=>{a.nativeCrossPieceCommit.oneUndoStep=false},
    a=>{a.nativeCrossPieceCommit.manufacturingApproved=true},
    a=>{a.nativeCrossPieceLink.targetPointIndex=2},
    a=>{a.template.panels[0].polygon.points[2][0]+=.02},
  ]){
    const a=structuredClone(installed());mutation(a)
    assert.equal(witness(source(),installReq,a).ok,false)
  }
})
test('rejects forged linked target, source, relation identity, stale source and unrelated panel mutation',()=>{
  for(const mutation of [
    a=>{a.template.panels[1].polygon.points[1][0]=.4},
    a=>{a.template.panels[0].polygon.points[1][0]=.43},
    a=>{a.nativeCrossPieceLink.boardOffsetM=[.52,0]},
    a=>{a.nativeCrossPieceLink.sourcePointIndex=2},
    a=>{a.template.panels[2].polygon.points[1][0]=.45},
    a=>{a.nativeCrossPieceCommit.nativeAuthoritative=false},
  ]){
    const a=moved();mutation(a)
    assert.equal(witness(installed(),moveReq,a).ok,false)
  }
  const old=installed();old.template.panels[0].polygon.points[1][0]=.41
  assert.equal(witness(old,moveReq,moved()).ok,false)
})
test('rejects false link clear and hidden garment mutation',()=>{
  const before=moved()
  const request={op:'native-cross-piece-clear',revision:9}
  const a={...before,revision:10,nativeCrossPieceLink:null}
  assert.equal(witness(before,request,a).ok,true)
  const b=structuredClone(a);b.nativeCrossPieceLink=link()
  assert.equal(witness(before,request,b).ok,false)
  const c=structuredClone(a);c.template.panels[1].polygon.points[0][0]+=.01
  assert.equal(witness(before,request,c).ok,false)
})
