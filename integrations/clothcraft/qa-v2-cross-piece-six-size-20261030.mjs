// Disposable *real Rust binary* acceptance of persisted source-to-target link.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {readFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs'
import path from 'node:path'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const bin=path.join(root,'research/oss/clothcraft/target/debug/exo-session')
const avatar=path.join(root,'research/oss/clothcraft/assets/makehuman/mannequin.obj')
assert(existsSync(bin)&&existsSync(avatar),'Compiled Rust session and avatar required')
const dir=mkdtempSync(path.join(tmpdir(),'exo-linked-board-'))
const saveFile=path.join(dir,'garment.json')
const child=spawn(bin,[avatar,saveFile],{stdio:['pipe','pipe','pipe'],cwd:root})
let outstanding=null,stderr=''
child.stderr.on('data',chunk=>{stderr+=chunk.toString()})
createInterface({input:child.stdout}).on('line',line=>{
  const pending=outstanding
  outstanding=null
  if(pending)pending(JSON.parse(line))
})
const rpc=payload=>new Promise((resolve,reject)=>{
  assert(!outstanding,'One native RPC at a time')
  const timeout=setTimeout(()=>{outstanding=null;reject(Error('Timeout '+payload.op+' '+stderr.slice(-500)))},30000)
  outstanding=result=>{
    clearTimeout(timeout)
    if(result.ok)resolve(result.data)
    else reject(Error(String(result.error)))
  }
  child.stdin.write(JSON.stringify(payload)+'\n')
})
const rect=()=>({points:[[0,0],[0.4,0],[0.4,0.25],[0,0.25]],
  edges:['edge_1','edge_2','edge_3','edge_4'],subdivisions:0,
  curves:{}})
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`)
function assertLinked(snapshot,expectedX,source,target){
  const relation=snapshot.nativeCrossPieceLink
  assert.equal(relation?.active,true)
  assert.equal(relation?.sourcePanelId,source)
  assert.equal(relation?.targetPanelId,target)
  const first=snapshot.template.panels.find(p=>p.id===source)
  const second=snapshot.template.panels.find(p=>p.id===target)
  const board=panel=>{
    const p=panel.polygon.points[1],a=(panel.layout_rotation_degrees??0)*Math.PI/180
    return [(panel.layout_2d?.[0]||0)+p[0]*Math.cos(a)-p[1]*Math.sin(a),
      (panel.layout_2d?.[1]||0)+p[0]*Math.sin(a)+p[1]*Math.cos(a)]
  }
  const s=board(first),t=board(second)
  close(s[0],expectedX)
  close(t[0]-s[0],relation.boardOffsetM[0])
  close(t[1]-s[1],relation.boardOffsetM[1])
}
try{
  const opened=await rpc({op:'open',preset:'tshirt'})
  const template=structuredClone(opened.template)
  template.seams=[]
  template.panels=template.panels.slice(0,2).map((panel,index)=>({
    ...panel,pins:[],pin_points:[],polygon:rect(),
    layout_2d:[index*0.5,0],pattern:{...panel.pattern,width:0.4,height:0.25},
  }))
  let state=await rpc({op:'open',template})
  await rpc({op:'save'})
  const gradedProject=JSON.parse(readFileSync(saveFile,'utf8'))
  const sizes=['XS','S','M','L','XL','XXL'];
  gradedProject.grade_run={schemaVersion:1,sizes,baseSize:'M',baseTemplate:structuredClone(state.template),gradedTemplates:sizes.map((_,i)=>{const t=structuredClone(state.template);for(const p of t.panels)p.polygon.points[1][0]+=(i-2)*.005;return t}),pomSpecs:[]};
  state=await rpc({op:'open',project:gradedProject})
  const checkSizes=async x=>{await rpc({op:'save'});const p=JSON.parse(readFileSync(saveFile,'utf8'));assert(p.native_cross_piece_link);for(const [i,t] of p.grade_run.gradedTemplates.entries())for(const panel of t.panels)close(panel.polygon.points[1][0],x+(i-2)*.005);return p;}
  const [source,target]=state.template.panels.map(p=>p.id)
  state=await rpc({op:'native-cross-piece-install',revision:state.revision,
    sourcePanelId:source,sourcePointIndex:1,targetPanelId:target,targetPointIndex:1})
  assert.equal(state.nativeCrossPieceCommit.oneUndoStep,true)
  assertLinked(state,0.4,source,target)
  const initial=structuredClone(state.template)
  state=await rpc({op:'native-cross-piece-move',revision:state.revision,
    sourcePanelId:source,expectedPosition:[0.4,0],position:[0.44,0]})
  assertLinked(state,0.44,source,target)
  await checkSizes(.44)
  assert.equal(state.nativeCrossPieceCommit.nativeAuthoritative,true)
  await assert.rejects(()=>rpc({op:'native-cross-piece-move',revision:state.revision,
    sourcePanelId:source,expectedPosition:[0.44,0],position:[0.46,0],
    dependentPosition:[0.96,0]}),/Unexpected native cross-piece move request fields/)
  state=await rpc({op:'undo',revision:state.revision})
  assertLinked(state,0.4,source,target)
  assert.deepEqual(state.template,initial)
  await checkSizes(.4)
  state=await rpc({op:'redo',revision:state.revision})
  assertLinked(state,0.44,source,target)
  await checkSizes(.44)
  await rpc({op:'save'})
  const disk=JSON.parse(readFileSync(saveFile,'utf8'))
  state=await rpc({op:'open',project:disk})
  assertLinked(state,0.44,source,target)
  await checkSizes(.44)
  assert.equal(state.canUndo,true,'Durable cross-piece history was not recovered')
  state=await rpc({op:'undo',revision:state.revision})
  assertLinked(state,0.4,source,target)
  state=await rpc({op:'redo',revision:state.revision})
  assertLinked(state,0.44,source,target)
  await checkSizes(.44)
  const current=state.template.panels.find(p=>p.id===source).polygon.points[1]
  state=await rpc({op:'native-cross-piece-move',revision:state.revision,
    sourcePanelId:source,expectedPosition:current,position:[current[0]+0.03,current[1]]})
  assertLinked(state,0.47,source,target)
  const finalProject=await checkSizes(.47)
  const bad=structuredClone(finalProject);bad.grade_run.gradedTemplates[5].panels[1].polygon.points[1][0]+=.01
  await assert.rejects(()=>rpc({op:'open',project:bad}),/conflicts with the cross-piece relationship/)
  state=await rpc({op:'snapshot'})
  assertLinked(state,.47,source,target)
  await checkSizes(.47)
  state=await rpc({op:'native-cross-piece-clear',revision:state.revision})
  assert.equal(state.nativeCrossPieceLink,null)
  console.log(JSON.stringify({pass:true,source,target,relationshipInstalledInDisposableProject:true,movedTwice:true,
    sixSizesSynchronized:true,conflictingGradeRejected:true,undo:true,redo:true,saved:true,reopened:true,
    undoRedoRecoveredAcrossRestart:true,
    forgedTargetRejected:true,cleared:true,manufacturingApproved:false},null,2))
}finally{
  child.stdin.end()
  if(child.exitCode===null)child.kill('SIGTERM')
  rmSync(dir,{recursive:true,force:true})
}
