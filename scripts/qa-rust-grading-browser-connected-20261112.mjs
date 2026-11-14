/** Existing Chrome CDP -> real React grading click -> disposable Node/Rust.
 * Never starts Chrome or attaches to the installed production bridge.
 * Requires an already-open automation-enabled Chrome endpoint.
 */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,readFileSync,rmSync,existsSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer} from 'node:net'
import {setTimeout as sleep} from 'node:timers/promises'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const cdp=process.env.EXO_REUSE_CHROME_CDP||'http://127.0.0.1:9222'
const binary=path.join(root,'research/oss/clothcraft/target/debug/exo-session')
const results={pass:false,uiEventVerified:false,bridgeVerified:false,nativeSessionVerified:false,
 undoRedoVerified:false,savedVerified:false,existingBrowserReused:false}
const children=[]
let browser,context,output,stage='existing browser preflight'
const same=(a,b,message)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),message)
const port=async()=>{
 const server=createServer()
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
 const n=server.address().port
 await new Promise(resolve=>server.close(resolve))
 return n
}
const launch=(command,args,environment)=>{
 const child=spawn(command,args,{cwd:root,stdio:'ignore',detached:true,env:{...process.env,...environment}})
 children.push(child)
 return child
}
const ready=async(url,child)=>{
 for(let i=0;i<70;i++){
  if(child.exitCode!==null||child.signalCode!==null)throw Error('Disposable service exited')
  try{if((await fetch(url,{signal:AbortSignal.timeout(800)})).ok)return}catch{}
  await sleep(200)
 }
 throw Error('Disposable service failed: '+url)
}
try{
 const version=await fetch(new URL('/json/version',cdp),{signal:AbortSignal.timeout(1400)}).then(r=>{
  if(!r.ok)throw Error('Chrome CDP endpoint HTTP '+r.status)
  return r.json()
 }).catch(error=>{throw Error('REUSABLE_BROWSER_CDP_UNAVAILABLE: '+error.message)})
 assert(typeof version.webSocketDebuggerUrl==='string','Existing Chrome CDP endpoint lacks debugger WebSocket')
 browser=await chromium.connectOverCDP(cdp,{timeout:5000})
 results.existingBrowserReused=true
 assert(existsSync(binary),'Compiled exo-session missing')
 const nativePort=await port()
 let uiPort=await port()
 while(uiPort===nativePort)uiPort=await port()
 const native='http://127.0.0.1:'+nativePort,ui='http://127.0.0.1:'+uiPort
 output=mkdtempSync(path.join(os.tmpdir(),'exo-rust-grading-browser-connected-'))
 const nativeChild=launch(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:String(nativePort),EXO_CLOTHCRAFT_OUTPUT_DIR:output,
  EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:binary,EXO_CLOTHCRAFT_GPU:'0',
 })
 const viteChild=launch(path.join(root,'node_modules/.bin/vite'),
  ['--host','127.0.0.1','--port',String(uiPort),'--strictPort'],
  {VITE_CLOTHCRAFT_BRIDGE_URL:native})
 await Promise.all([ready(native+'/health',nativeChild),ready(ui,viteChild)])
 results.nativeSessionVerified=true
 let revision
 const operationLog=[]
 const send=async payload=>{
  const response=await fetch(native+'/workspace',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify(payload)})
  const json=await response.json()
  assert.equal(json.ok,true,(`Native ${payload.op}: `)+(json.error||'unknown rejection'))
  if(json.data?.revision!==undefined)revision=json.data.revision
  return json.data
 }
 const initial=await send({op:'open',preset:'tshirt'})
 const baseline=(await send({op:'save'})).project
 stage='isolated browser context and native request capture'
 context=await browser.newContext({viewport:{width:1540,height:980}})
 const page=await context.newPage()
 const pageErrors=[]
 page.on('pageerror',error=>pageErrors.push(error.message))
 await context.route('**/workspace',async route=>{
  const body=route.request().postDataJSON()
  const headers={...route.request().headers()}
  delete headers.origin
  const response=await route.fetch({url:native+'/workspace',headers})
  const data=await response.json()
  operationLog.push({op:body?.op,ok:data.ok,revision:data.data?.revision,error:data.error})
  await route.fulfill({status:response.status(),contentType:'application/json',
   headers:{'access-control-allow-origin':ui},body:JSON.stringify(data)})
 })
 await page.goto(ui+'/?desktop=1&engine=clothcraft&testSession=rust-grading-connected-20261112',
  {waitUntil:'domcontentloaded'})
 await page.locator('.cc-board svg[data-native-tool]').waitFor({state:'visible',timeout:30000})
 stage='real React grading click'
 await page.getByRole('button',{name:'Edit Grading'}).click()
 const dialog=page.getByRole('dialog',{name:'Pattern Grading'})
 await dialog.waitFor({state:'visible'})
 await dialog.getByRole('button',{name:'Start zero-offset grading'}).click()
 await dialog.getByRole('table',{name:'Independent editable grade movements by size'}).waitFor()
 await dialog.getByRole('tab',{name:'Export'}).click()
 const saveButton=dialog.getByRole('button',{name:'Save six-size catalog to Rust'})
 await saveButton.click()
 await page.waitForFunction(()=>document.querySelector('[aria-label="Native six-size grading catalog"] header span')?.textContent==='SAVED IN PROJECT',
  null,{timeout:45000})
 results.uiEventVerified=true
 const uiCommit=operationLog.find(item=>item.op==='grade-run-commit'&&item.ok)
 assert(uiCommit,'Actual React save click did not reach Node grade-run-commit')
 results.bridgeVerified=true
 const persisted=(await send({op:'save'})).project
 assert(persisted.grade_run?.gradedTemplates?.length===6,'Rust did not persist six-size catalog')
 same(persisted.template,baseline.template,'React grade save changed source geometry')
 const onDisk=JSON.parse(readFileSync(path.join(output,'workspace/fitting-project.json'),'utf8'))
 same(onDisk.grade_run,persisted.grade_run,'Node mirror differs from Rust grade save')
 results.savedVerified=true
 stage='actual React native Undo and Redo controls'
 const history=async op=>{
  const before=operationLog.filter(item=>item.op===op).length
  // Same documented, live EXO command event used by the repository's
  // existing browser native-history regression; dispatch to React itself.
  await page.evaluate(command=>window.dispatchEvent(
   new CustomEvent('exo-clothcraft-command',{detail:command})),op)
  for(let tries=0;tries<50;tries++){
   const matching=operationLog.filter(item=>item.op===op)
   if(matching.length>before)return matching.at(-1)
   await sleep(100)
  }
  throw Error('UI_HISTORY_NOT_SENT: '+op)
 }
 const undo=await history('undo')
 assert(undo.ok,'React Undo did not succeed in Rust')
 const undone=(await send({op:'save'})).project
 assert.equal(undone.grade_run??null,null,'Undo retained graded catalog')
 const redo=await history('redo')
 assert(redo.ok,'React Redo did not succeed in Rust')
 const redone=(await send({op:'save'})).project
 same(redone.grade_run,persisted.grade_run,'Redo did not restore graded catalog')
 results.undoRedoVerified=true
 assert.deepEqual(pageErrors,[],'Browser JS errors')
 results.pass=true
 console.log(JSON.stringify({...results,ops:operationLog.map(item=>item.op),
  sizes:6,manufacturingApproved:false,originalPreserved:true}))
}catch(error){
 results.blocker=String(error?.message||error)
 results.stage=stage
 console.error(JSON.stringify(results))
 process.exitCode=2
}finally{
 await context?.close().catch(()=>{})
 // A CDP-connected Chrome belongs to the user: close only our context.
 // Disconnecting Playwright must not terminate the existing Chrome.
 await browser?.close().catch(()=>{})
 for(const child of children)try{process.kill(-child.pid,'SIGTERM')}catch{}
 if(output)rmSync(output,{recursive:true,force:true})
}
