// Persistent upstream authoring + physics; one worker, no process per frame.
import fs from 'node:fs'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {paths,nativeExport} from './bridge.mjs'
export function createWorkspace(outputRoot) {
 let child=null,pending=null,busy=false,loaded=false,lastError='',stepsSinceSave=0,running=false,pump=null,current=null,runError=null,lastPoll=Date.now()
 const saveFile=path.join(outputRoot,'workspace','fitting-project.json')
 const start=()=>{
  if(child)return
  const config=paths(), bin=process.env.EXO_CLOTHCRAFT_SESSION_BIN||path.join(config.upstream,'target/debug/exo-session')
  if(!fs.existsSync(bin))throw new Error('ClothCraft workspace executable not built')
  child=spawn(bin,[path.join(config.upstream,'assets/makehuman/mannequin.obj'),saveFile+'.native',...(process.env.EXO_CLOTHCRAFT_GPU==='1'?['--gpu']:[])],{cwd:config.upstream,stdio:['pipe','pipe','pipe']})
  const proc=child
  const fail=e=>{if(child!==proc)return;child=null;loaded=false;if(pending){clearTimeout(pending.timer);pending.reject(e);pending=null}}
  child.on('error',fail);child.on('exit',()=>fail(new Error('ClothCraft worker stopped. Reopen the saved workspace.')))
  child.stderr.on('data',c=>{lastError=(lastError+c).slice(-2000)})
  createInterface({input:child.stdout}).on('line',line=>{
   if(!pending)return
   const p=pending;pending=null;clearTimeout(p.timer)
   try{p.resolve(JSON.parse(line))}catch{p.reject(new Error('Invalid native workspace response'))}
  })
 }
 const rpc=data=>new Promise((resolve,reject)=>{
  if(pending)return reject(new Error('Native request already pending'))
  pending={resolve,reject,timer:setTimeout(()=>{const p=pending;pending=null;child?.kill();child=null;loaded=false;p?.reject(new Error('ClothCraft operation timed out; last saved project is preserved'))},120000)}
  try{child.stdin.write(JSON.stringify(data)+'\n',error=>{if(error&&pending){const p=pending;pending=null;clearTimeout(p.timer);p.reject(error)}})}
  catch(error){const p=pending;pending=null;clearTimeout(p.timer);p.reject(error)}
 })
 const save=async()=>{
  const result=await rpc({op:'save'})
  if(result.ok){fs.mkdirSync(path.dirname(saveFile),{recursive:true});fs.writeFileSync(saveFile+'.tmp',JSON.stringify(result.data.project));fs.renameSync(saveFile+'.tmp',saveFile);stepsSinceSave=0}
  return result
 }
 const remember=result=>{if(result.data?.template)current={...result.data,avatar:result.data.avatar||current?.avatar};return result}
 const advance=async()=>{
  try{while(running){if(Date.now()-lastPoll>5000){running=false;break}const result=remember(await rpc({op:'step',steps:2,revision:current.revision}));if(!result.ok){runError=result.error;break}stepsSinceSave+=2;if(stepsSinceSave>=60)await save();await new Promise(r=>setImmediate(r))}}
  catch(error){runError=error.message}
  finally{running=false;if(child&&loaded){try{await save()}catch{}}}
 }
 return {async request(data={}){
  if(data.op==='snapshot'&&running){lastPoll=Date.now();return{ok:true,data:{...current,avatar:data.avatar?current.avatar:null,running:true}}}
  if(data.op==='pause'){
   if(busy)throw new Error('Workspace busy; wait for the current operation')
   running=false;if(pump)await pump;pump=null
   if(loaded)await save()
   return{ok:!runError,error:runError,data:{...current,avatar:null,running:false}}
  }
  if(data.op==='play'){
   if(!loaded||busy)throw new Error('Workspace is not ready')
   if(pump&&!running){await pump;pump=null}
   if(!running){lastPoll=Date.now();running=true;runError=null;pump=advance()}
   return{ok:true,data:{...current,avatar:null,running:true}}
  }
  if(running)throw new Error('Pause simulation before editing or saving')
  if(pump){await pump;pump=null}

  if(busy)throw new Error('Workspace busy; wait for the current operation')
  if(!loaded&&!['open','snapshot'].includes(data.op))throw new Error('Open a garment before sending workspace commands')
  busy=true
  try{
   start()
   if(!loaded||data.op==='open'){
    // Load the *actual current collider* on every new garment/session. The
    // same mesh drives both the Three.js avatar and its 2D SVG silhouette.
    // Never keep a previous model's outline after an Open/avatar change.
    let initial={op:'open',preset:data.preset||'tshirt',avatar:true}
    if(data.document)initial.template=nativeExport(data.document,paths().cli).template
    else if(data.project)initial.project=data.project
    else if(data.op!=='open'&&fs.existsSync(saveFile))initial.project=JSON.parse(fs.readFileSync(saveFile,'utf8'))
    const result=remember(await rpc(initial))
    if(result.ok){loaded=true;await save()}
    return result
   }
   if(data.op==='save')return await save()
   const result=remember(await rpc(data))
   if(result.ok){stepsSinceSave+=data.op==='step'?Number(data.steps||1):0
    if(['edit','undo','redo','reset','pull-panel','pose-panel'].includes(data.op)||stepsSinceSave>=30)await save()
   }
   if(runError&&data.op==='snapshot')return{ok:false,error:runError,data:{...current,avatar:data.avatar?current.avatar:null,running:false}}
   return result
  }finally{busy=false}},close(){running=false;loaded=false;if(pending){const p=pending;pending=null;clearTimeout(p.timer);p.reject(new Error('Workspace closed'))}child?.kill();child=null},status(){return{loaded,busy,lastError}}}
}
