// Actual compiled Rust RPC smoke for the two-piece formula-driven worksheet.
// Disposable test-only native garment; does not touch the installed EXO app.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {readFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const bin=path.join(root,'research/oss/clothcraft/target/debug/exo-session')
const avatar=path.join(root,'research/oss/clothcraft/assets/makehuman/mannequin.obj')
assert(existsSync(bin)&&existsSync(avatar),'Build the native Rust exo-session binary first')
const dir=mkdtempSync(path.join(tmpdir(),'exo-native-2d-multipanel-'))
const saveFile=path.join(dir,'disposable-project.json')
const child=spawn(bin,[avatar,saveFile],{cwd:root,stdio:['pipe','pipe','pipe']})
let waiting=null,stderr=''
child.stderr.on('data',bytes=>{stderr+=bytes.toString()})
createInterface({input:child.stdout}).on('line',line=>{
  const done=waiting
  waiting=null
  if(done)done(JSON.parse(line))
})
async function rpc(request){
  assert.equal(waiting,null,'Concurrent native RPC not supported in this smoke')
  return await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{waiting=null;reject(Error('Native timeout '+request.op+' '+stderr.slice(-400)))},30000)
    waiting=response=>{
      clearTimeout(timer)
      if(response.ok!==true)reject(Error(String(response.error)))
      else resolve(response.data)
    }
    child.stdin.write(JSON.stringify(request)+'\n')
  })
}
function rectangle(){
  return {points:[[0,0],[0.4,0],[0.4,0.25],[0,0.25]],
    edges:['edge_1','edge_2','edge_3','edge_4'],subdivisions:0}
}
function check(snapshot,expected){
  assert.equal(snapshot.nativePointBindings.active,true)
  assert.equal(snapshot.nativePointBindings.measurements.chest.valueMm,expected)
  assert.equal(snapshot.template.panels.length,2)
  for(const panel of snapshot.template.panels){
    const points=panel.polygon.points
    assert(Math.abs(points[1][0]-points[0][0]-expected/2000)<1e-8)
    assert(Math.abs(points[2][0]-points[1][0])<1e-8)
    assert(Math.abs(points[2][1]-points[1][1]-0.25)<1e-8)
  }
}
try{
  const opened=await rpc({op:'open',preset:'tshirt'})
  const template=structuredClone(opened.template)
  template.seams=[]
  template.panels=template.panels.slice(0,2).map(panel=>({
    ...panel,pins:[],pin_points:[],polygon:rectangle(),
    pattern:{...panel.pattern,width:0.4,height:0.25},
  }))
  let state=await rpc({op:'open',template})
  assert.equal(state.revision,0)
  const bindings=state.template.panels.flatMap(panel=>[
    {id:panel.id+'_width',panelId:panel.id,pointIndex:1,mode:'polar',
      a:0,b:0,distanceFormula:'halfWidth',angleDeg:0},
    {id:panel.id+'_corner',panelId:panel.id,pointIndex:2,mode:'polar',
      a:1,b:0,distanceFormula:'height',angleDeg:90,
      dependsOn:[panel.id+'_width']},
  ])
  state=await rpc({op:'bindings-store',revision:state.revision,
    nativeBindings:{measurements:{
      chest:{valueMm:800},halfWidth:{formula:'chest / 2'},height:{valueMm:250},
    },bindings}})
  check(state,800)
  state=await rpc({op:'bindings-multipanel-measurement-recompute',
    revision:state.revision,measurement:'chest',expectedValueMm:800,valueMm:840})
  assert.equal(state.nativeMeasurementRecompute.nativeAuthoritative,true)
  assert.equal(state.nativeMeasurementRecompute.oneUndoStep,true)
  assert.equal(state.nativeMeasurementRecompute.affectedPanels.length,2)
  assert.equal(state.nativeMeasurementRecompute.correctedBindingIds.length,4)
  check(state,840)
  await assert.rejects(()=>rpc({op:'bindings-multipanel-measurement-recompute',
    revision:state.revision,measurement:'chest',expectedValueMm:840,valueMm:860,
    dependentPoint:[0.44,0.25]}),/Unsupported multi-panel native request/)
  state=await rpc({op:'undo',revision:state.revision})
  check(state,800)
  state=await rpc({op:'redo',revision:state.revision})
  check(state,840)
  await rpc({op:'save'})
  assert(existsSync(saveFile),'Real native save did not create project')
  const disk=JSON.parse(readFileSync(saveFile,'utf8'))
  state=await rpc({op:'open',project:disk})
  check(state,840)
  console.log(JSON.stringify({
    ok:true,operation:'bindings-multipanel-measurement-recompute',
    panels:2,boundPoints:4,sourceMm:[800,840],undo:true,redo:true,
    savedToDisposableFile:true,reopened:true,
    forgedDependentCoordinatesRefused:true,factoryApproved:false},null,2))
}finally{
  child.stdin.end()
  if(child.exitCode===null)child.kill('SIGTERM')
  rmSync(dir,{recursive:true,force:true})
}
