// Disposable compiled-Rust contract acceptance for the UI's cross-piece
// response witness. Never opens an installed app or an existing user garment.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {mkdtempSync,rmSync,existsSync} from 'node:fs'
import path from 'node:path'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {verifyNativeCrossPieceCommit20261030 as witness} from '../../src/core/nativeCrossPieceCommitWitness20261030.js'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const bin=path.join(root,'research/oss/clothcraft/target/debug/exo-session')
const avatar=path.join(root,'research/oss/clothcraft/assets/makehuman/mannequin.obj')
assert(existsSync(bin)&&existsSync(avatar),'Precompiled Rust session and mannequin are required; no build attempted')
const dir=mkdtempSync(path.join(tmpdir(),'exo-cross-piece-witness-'))
const child=spawn(bin,[avatar,path.join(dir,'disposable.json')],{stdio:['pipe','pipe','pipe'],cwd:root})
let pending=null,stderr=''
child.stderr.on('data',chunk=>{stderr+=chunk.toString()})
createInterface({input:child.stdout}).on('line',line=>{
  const receive=pending;pending=null
  if(receive)receive(JSON.parse(line))
})
const rpc=payload=>new Promise((resolve,reject)=>{
  assert(!pending,'Only one native request may be in flight')
  const timeout=setTimeout(()=>{pending=null;reject(Error('Native request timed out: '+payload.op+' '+stderr.slice(-400)))},15000)
  pending=reply=>{clearTimeout(timeout);reply.ok?resolve(reply.data):reject(Error(String(reply.error)))}
  child.stdin.write(JSON.stringify(payload)+'\n')
})
const rect=()=>({points:[[0,0],[.4,0],[.4,.25],[0,.25]],
  edges:['edge_1','edge_2','edge_3','edge_4'],subdivisions:0,
  curves:{edge_1:[[.12,-.03],[.28,-.03]]}})
try{
  const preset=await rpc({op:'open',preset:'tshirt'})
  const template=structuredClone(preset.template)
  template.seams=[]
  template.panels=template.panels.slice(0,2).map((p,i)=>({...p,
    pins:[],pin_points:[],polygon:rect(),layout_2d:[i*.5,0],
    pattern:{...p.pattern,width:.4,height:.25}}))
  let before=await rpc({op:'open',template})
  const [source,target]=before.template.panels.map(p=>p.id)
  const install={op:'native-cross-piece-install',revision:before.revision,
    sourcePanelId:source,sourcePointIndex:1,targetPanelId:target,targetPointIndex:1}
  let after=await rpc(install)
  assert.deepEqual(witness(before,install,after),{ok:true,operation:'install',manufacturingApproved:false})
  before=after
  const move={op:'native-cross-piece-move',revision:before.revision,
    sourcePanelId:source,expectedPosition:[.4,0],position:[.42,0]}
  after=await rpc(move)
  assert.deepEqual(witness(before,move,after),{ok:true,operation:'move',manufacturingApproved:false})
  assert(Math.abs(after.template.panels[0].polygon.points[1][1]-.03)<1e-8,
    'The curved source normalizes local Y; the witness must compare board-space motion')
  const forged=structuredClone(after)
  forged.template.panels[1].polygon.points[1][0]+=.01
  assert.equal(witness(before,move,forged).ok,false)
  before=after
  const clear={op:'native-cross-piece-clear',revision:before.revision}
  after=await rpc(clear)
  assert.deepEqual(witness(before,clear,after),{ok:true,operation:'clear',manufacturingApproved:false})
  console.log(JSON.stringify({pass:true,compiledRust:true,source,target,
    installWitness:true,moveWitness:true,clearWitness:true,forgedTargetRejected:true,
    manufacturingApproved:false}))
}finally{
  child.stdin.end()
  if(child.exitCode===null)child.kill('SIGTERM')
  rmSync(dir,{recursive:true,force:true})
}
