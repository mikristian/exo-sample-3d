#!/usr/bin/env node
// Test the STAGED WEB bundle against an isolated native session, without
// launching Chrome, touching installed ports, or modifying any user project.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn,spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {setTimeout as sleep} from 'node:timers/promises'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const WEB_PORT=5486, BRIDGE_PORT=5485
const expectedWeb=path.join(root,'integrations/clothcraft/output/release-candidates/web-v2-staging-20261030')
const web=path.resolve(process.argv[2]||expectedWeb)
if(web!==expectedWeb || !fs.existsSync(path.join(web,'index.html')))
  throw Error('ISOLATED_STAGED_WEB_REQUIRED: use newly built, untouched staging web directory')
for(const port of [WEB_PORT,BRIDGE_PORT]){
  const probe=spawnSync('/usr/sbin/lsof',['-nP',`-tiTCP:${port}`,'-sTCP:LISTEN'],{
    encoding:'utf8',timeout:3000,
  })
  assert.equal(probe.status,1,`REFUSE_OCCUPIED_STAGING_PORT:${port}`)
}
const stat=fs.statfsSync(root)
if(stat.bavail*stat.bsize<2*1024**3)throw Error('REFUSE_LOW_DISK_FOR_ISOLATED_SMOKE')

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'exo-v2-staging-wire-'))
const token=crypto.randomBytes(32).toString('hex')
const children=[]
let stage='spawn'
const start=(binary,args,extra)=>{
  const child=spawn(binary,args,{cwd:root,stdio:'ignore',detached:true,
    env:{...process.env,...extra}})
  children.push(child)
  return child
}
const fetchReady=async (url,timeoutMs=10000)=>{
  const startTime=Date.now()
  while(Date.now()-startTime<timeoutMs){
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(1000)})
      if(response.ok)return response
    }catch{}
    if(children.some(child=>child.exitCode!==null||child.signalCode!==null))
      throw Error('ISOLATED_CHILD_EXITED')
    await sleep(150)
  }
  throw Error('ISOLATED_SERVICE_STARTUP_TIMEOUT:'+url)
}
const command=async (data,auth=token)=>{
  const response=await fetch(`http://127.0.0.1:${BRIDGE_PORT}/workspace`,{
    method:'POST',signal:AbortSignal.timeout(25000),
    headers:{'content-type':'application/json',...(auth?{authorization:`Bearer ${auth}`}:{})},
    body:JSON.stringify(data),
  })
  return {status:response.status,body:await response.json()}
}
try{
  stage='start-isolated-services'
  start(path.join(root,'integrations/clothcraft/rust-static-host/target/debug/exo-rust-static-host'),
    ['--web-root',web],{EXO_WEB_PORT:String(WEB_PORT)})
  start(process.execPath,['integrations/clothcraft/server.mjs'],{
    EXO_CLOTHCRAFT_PORT:String(BRIDGE_PORT),
    EXO_CLOTHCRAFT_OUTPUT_DIR:temp,
    EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
    EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
    EXO_CLOTHCRAFT_GPU:'0',
    EXO_WORKSPACE_TOKEN:token,
  })
  stage='health'
  const page=await fetchReady(`http://127.0.0.1:${WEB_PORT}/`)
  assert.equal(page.status,200)
  const health=await (await fetchReady(`http://127.0.0.1:${BRIDGE_PORT}/health`)).json()
  assert.equal(health.ok,true)
  assert.equal(health.nativeReady,true)
  assert.equal(health.workspaceAuthIdentity,crypto.createHash('sha256').update(token).digest('hex'))
  stage='authorization'
  assert.equal((await command({op:'snapshot'},null)).status,401)
  assert.equal((await command({op:'snapshot'},'x'.repeat(64))).status,401)
  stage='native-open'
  const opened=await command({op:'open',preset:'tshirt'})
  assert.equal(opened.status,200,JSON.stringify(opened.body).slice(0,1000))
  assert.equal(opened.body.ok,true)
  const native=opened.body.data
  assert.ok(native.template?.panels?.length>=2,'Rust garment should expose editable 2D panels')
  assert.ok(native.triangles?.length>0,'Rust garment should expose compiled 3D garment triangles')
  stage='native-revision-and-save'
  const snapshot=await command({op:'snapshot'})
  assert.equal(snapshot.status,200)
  assert.equal(snapshot.body.data.revision,native.revision)
  const saved=await command({op:'save',revision:native.revision})
  assert.equal(saved.status,200)
  assert.ok(saved.body.data?.project?.template?.panels?.length>=2)
  stage='staged-web-assets'
  const wasm=await fetch(`http://127.0.0.1:${WEB_PORT}/wasm/exo_ui_kernel.wasm`)
  assert.equal(wasm.status,200)
  assert.ok((await wasm.arrayBuffer()).byteLength>100)
  const index=await (await fetch(`http://127.0.0.1:${WEB_PORT}/`)).text()
  assert.match(index,/assets\/index-[A-Za-z0-9_-]+\.js/)
  console.log(JSON.stringify({pass:true,stage:'completed',isolated:true,
    webPort:WEB_PORT,bridgePort:BRIDGE_PORT,nativePanels:native.template.panels.length,
    nativeTriangles:native.triangles.length,revision:native.revision,
    unauthorizedRequestsRejected:true,stagedWasmServed:true,
    originalAppTouched:false,factoryApproved:false},null,2))
}catch(error){
  console.error(JSON.stringify({pass:false,stage,error:String(error.message||error),
    originalAppTouched:false},null,2))
  process.exitCode=1
}finally{
  for(const child of children)try{if(child.pid)process.kill(-child.pid,'SIGTERM')}catch{}
  await sleep(250)
  fs.rmSync(temp,{recursive:true,force:true})
}
