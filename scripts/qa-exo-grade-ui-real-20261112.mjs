/** One bounded real React click -> isolated Node -> Rust session QA.
 * Launches one disposable headless Chrome, never touches the user's Chrome.
 */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtempSync,readFileSync,rmSync,existsSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer} from 'node:net'
import {randomBytes} from 'node:crypto'
import {setTimeout as sleep} from 'node:timers/promises'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const binary=path.join(root,'research/oss/clothcraft/target/debug/exo-session')
const token=randomBytes(32).toString('hex')
const results={pass:false,uiEventVerified:false,bridgeVerified:false,nativeSessionVerified:false,
 undoRedoVerified:false,savedVerified:false,isolatedHeadlessBrowser:false}
const children=[]
let browser,context,output,stage='isolated browser launch',operationLog=[],exportDom=null
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
 browser=await chromium.launch({executablePath:chrome,headless:true,timeout:15000,
  args:['--disable-gpu','--no-first-run','--disable-background-networking']})
 results.isolatedHeadlessBrowser=true
 assert(existsSync(binary),'Compiled exo-session missing')
 const nativePort=await port()
 let uiPort=await port()
 while(uiPort===nativePort)uiPort=await port()
 const native='http://127.0.0.1:'+nativePort,ui='http://127.0.0.1:'+uiPort
 output=mkdtempSync(path.join(os.tmpdir(),'exo-rust-grading-browser-connected-'))
 const nativeChild=launch(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:String(nativePort),EXO_CLOTHCRAFT_OUTPUT_DIR:output,
  EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:binary,EXO_CLOTHCRAFT_GPU:'0',EXO_WORKSPACE_TOKEN:token,
 })
 const viteChild=launch(path.join(root,'node_modules/.bin/vite'),
  ['--host','127.0.0.1','--port',String(uiPort),'--strictPort'],
  {VITE_CLOTHCRAFT_BRIDGE_URL:native})
 await Promise.all([ready(native+'/health',nativeChild),ready(ui,viteChild)])
 results.nativeSessionVerified=true
 let revision
 const send=async payload=>{
  const response=await fetch(native+'/workspace',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
   body:JSON.stringify(payload)})
  const json=await response.json()
  assert.equal(json.ok,true,(`Native ${payload.op}: `)+(json.error||'unknown rejection'))
  if(json.data?.revision!==undefined)revision=json.data.revision
  return json.data
 }
 stage='native open'
 const initial=await send({op:'open',preset:'tshirt'})
 const baseline=(await send({op:'save'})).project
 stage='isolated browser context and native request capture'
 context=await browser.newContext({viewport:{width:1540,height:980}})
 await context.addInitScript(value=>{window.__EXO_WORKSPACE_TOKEN__=value},token)
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
 const catalog=dialog.getByRole('region',{name:'Native grading catalog'})
 exportDom=await dialog.evaluate(node=>({
  catalogAriaLabel:node.querySelector('.exo-native-graded-catalog')?.getAttribute('aria-label')||null,
  catalog:node.querySelector('.exo-native-graded-catalog')?.innerText.slice(0,1800)||null,
  catalogButtons:[...node.querySelectorAll('.exo-native-graded-catalog button')].map(button=>({text:button.innerText.trim(),disabled:button.disabled,visible:!!button.getClientRects().length})),
  pomReleaseText:node.innerText.match(/Named POM targets within tolerance[\s\S]{0,100}/)?.[0]||null,
  pomRows:node.innerText.match(/Observed POM rows:[^\n]*/)?.[0]||null}))
 console.log('EXPORT_DOM '+JSON.stringify(exportDom))
 assert.equal(exportDom.catalogAriaLabel,'Native grading catalog','Current rendered aria-label differs from source')
 const saveButton=catalog.getByRole('button',{name:'Save grading catalog to Rust'})
 await saveButton.click()
 results.uiEventVerified=true
 await page.waitForFunction(()=>document.querySelector('[aria-label="Native grading catalog"] header span')?.textContent==='SAVED IN PROJECT'||
   !!document.querySelector('[data-native-catalog-message]')?.textContent?.includes('Native catalog saved'),null,{timeout:45000})
 const message=await dialog.locator('[data-native-catalog-message]').allTextContents()
 results.saveMessage=message
 const uiCommit=operationLog.find(item=>item.op==='grade-run-commit'&&item.ok)
 assert(uiCommit,'Actual React save click did not reach accepted Node grade-run-commit: '+JSON.stringify(message))
 results.bridgeVerified=true
 const persisted=(await send({op:'save'})).project
 assert(persisted.grade_run?.gradedTemplates?.length===6,'Rust did not persist six-size catalog')
 same(persisted.template,baseline.template,'React grade save changed source geometry')
 const onDisk=JSON.parse(readFileSync(path.join(output,'workspace/fitting-project.json'),'utf8'))
 same(onDisk.grade_run,persisted.grade_run,'Node mirror differs from Rust grade save')
 results.savedVerified=true
 results.nativeReceipts=operationLog.map(({op,ok,revision,error})=>({op,ok,revision,error}))
 stage='actual React 2D Undo control and safe history arbitration'
 await dialog.getByRole('button',{name:'Close Pattern Grading'}).click({timeout:8000})
 await dialog.waitFor({state:'hidden',timeout:8000})
 const expand=page.getByRole('button',{name:'Open full-screen 2D pattern studio'})
 results.fullScreenControlFound=(await expand.count())>0
 if(results.fullScreenControlFound)await expand.click({timeout:8000})
 const undoControls=page.getByRole('button',{name:'Undo latest 2D pattern or grading edit',exact:true})
 results.historyUi=await page.evaluate(()=>({
  directUndo:[...document.querySelectorAll('button[aria-label="Undo latest 2D pattern or grading edit"]')].map(b=>({disabled:b.disabled,visible:!!b.getClientRects().length,html:b.outerHTML.slice(0,350)})),
  directRedo:[...document.querySelectorAll('button[aria-label="Redo latest 2D pattern or grading edit"]')].map(b=>({disabled:b.disabled,visible:!!b.getClientRects().length})),
  notices:[...document.querySelectorAll('.cc-notice,.cc-error')].map(el=>el.innerText.slice(0,500)),
  focusMode:document.querySelector('.cc-workspace')?.className||null}))
 const beforeUndo=operationLog.length
 const accessible=[]
 for(const control of await undoControls.all())if(await control.isVisible())accessible.push({control,enabled:await control.isEnabled()})
 results.undoButtonCount=accessible.length
 results.undoButtonEnabled=accessible.some(item=>item.enabled)
 if(results.undoButtonEnabled){
  await accessible.find(item=>item.enabled).control.click({timeout:8000})
  results.undoClicked=true
  for(let i=0;i<25;i++){
   if(operationLog.slice(beforeUndo).some(item=>item.op==='undo'))break
   await sleep(120)
  }
 }else results.undoClicked=false
 results.historyAfter=operationLog.slice(beforeUndo)
 results.historyNotice=await page.locator('.cc-notice,.cc-error').allTextContents()
 const nativeUndo=results.historyAfter.find(item=>item.op==='undo'&&item.ok)
 if(nativeUndo){
  const undone=(await send({op:'save'})).project
  results.undoState={gradeCatalogPresent:Boolean(undone.grade_run),revision:nativeUndo.revision}
  assert.equal(undone.grade_run??null,null,'Actual UI Undo left native graded catalog persisted')
  const redoControls=page.getByRole('button',{name:'Redo latest 2D pattern or grading edit',exact:true})
  const redoButtons=await redoControls.all()
  let enabledRedo=null
  for(const button of redoButtons)if(await button.isVisible()&&await button.isEnabled()){enabledRedo=button;break}
  if(enabledRedo){
   const beforeRedo=operationLog.length
   await enabledRedo.click({timeout:8000})
   results.redoClicked=true
   for(let i=0;i<25;i++){
    if(operationLog.slice(beforeRedo).some(item=>item.op==='redo'))break
    await sleep(120)
   }
   results.redoReceipts=operationLog.slice(beforeRedo)
   if(results.redoReceipts.some(item=>item.op==='redo'&&item.ok)){
    const redone=(await send({op:'save'})).project
    same(redone.grade_run,persisted.grade_run,'Real UI Redo did not restore catalog')
    results.undoRedoVerified=true
   }
  }
 }
 if(!results.undoRedoVerified){
  results.historyBlocker=results.undoClicked?'Real Undo clicked; native Undo/Redo completion not established. Review notice and receipts.':'Real Undo control unavailable or disabled; history arbitration may intentionally block mixed draft and Rust journals.'
 }
 assert.deepEqual(pageErrors,[],'Browser JS errors')
 results.pass=results.uiEventVerified&&results.bridgeVerified&&results.savedVerified&&results.undoRedoVerified
 console.log(JSON.stringify({...results,ops:operationLog.map(item=>item.op),
  sizes:6,manufacturingApproved:false,originalPreserved:true}))
}catch(error){
 results.blocker=String(error?.message||error)
 results.stage=stage
 results.exportDom=exportDom
 results.operations=operationLog
 console.error(JSON.stringify(results))
 process.exitCode=2
}finally{
 await context?.close().catch(()=>{})
 // Launch owns only its temporary headless process and profile.
 await browser?.close().catch(()=>{})
 for(const child of children)try{process.kill(-child.pid,'SIGTERM')}catch{}
 if(output)rmSync(output,{recursive:true,force:true})
}
