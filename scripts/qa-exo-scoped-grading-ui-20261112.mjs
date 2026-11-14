/** One disposable headless Chrome, isolated React -> Node auth -> Rust grade history. */
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
const token=randomBytes(32).toString('hex')
const binary=path.join(root,'research/oss/clothcraft/target/debug/exo-session')
const results={schema:'exo-scoped-grading-ui-qa.v1',pass:false,
  realReactSave:false,scopedUndoButtonClicked:false,scopedRedoButtonClicked:false,
  undoHTTPVerified:false,redoHTTPVerified:false,sixTemplatesRestored:false,
  localDraftPreserved:null,isolatedHeadlessBrowser:false,installedAppTouched:false}
const children=[]
let browser,context,output,stage='isolated headless browser launch',page,operations=[],draftBefore=null
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
    if(child.exitCode!==null||child.signalCode!==null)throw Error('Disposable service exited: '+url)
    try{if((await fetch(url,{signal:AbortSignal.timeout(800)})).ok)return}catch{}
    await sleep(200)
  }
  throw Error('Disposable service failed: '+url)
}
try{
  browser=await chromium.launch({executablePath:chrome,headless:true,timeout:15000,
    args:['--disable-gpu','--no-first-run','--disable-background-networking']})
  results.isolatedHeadlessBrowser=true
  assert(existsSync(binary),'Compiled exo-session binary missing')
  const nativePort=await port()
  let uiPort=await port()
  while(nativePort===uiPort)uiPort=await port()
  const native='http://127.0.0.1:'+nativePort,ui='http://127.0.0.1:'+uiPort
  output=mkdtempSync(path.join(os.tmpdir(),'exo-scoped-grading-ui-'))
  const nativeChild=launch(process.execPath,['integrations/clothcraft/server.mjs'],{
    EXO_CLOTHCRAFT_PORT:String(nativePort),EXO_CLOTHCRAFT_OUTPUT_DIR:output,
    EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
    EXO_CLOTHCRAFT_SESSION_BIN:binary,EXO_CLOTHCRAFT_GPU:'0',
    EXO_WORKSPACE_TOKEN:token,
  })
  const viteChild=launch(path.join(root,'node_modules/.bin/vite'),
    ['--host','127.0.0.1','--port',String(uiPort),'--strictPort'],
    {VITE_CLOTHCRAFT_BRIDGE_URL:native})
  await Promise.all([ready(native+'/health',nativeChild),ready(ui,viteChild)])
  const send=async payload=>{
    const r=await fetch(native+'/workspace',{method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(payload)})
    const data=await r.json()
    assert.equal(data.ok,true,`Native ${payload.op}: ${data.error||'unknown rejection'}`)
    return data.data
  }
  await send({op:'open',preset:'tshirt'})
  const baseline=(await send({op:'save'})).project
  stage='isolated React browser and request capture'
  context=await browser.newContext({viewport:{width:1540,height:980}})
  await context.addInitScript(value=>{window.__EXO_WORKSPACE_TOKEN__=value},token)
  page=await context.newPage()
  const pageErrors=[]
  page.on('pageerror',e=>pageErrors.push(e.message))
  await context.route('**/workspace',async route=>{
    const payload=route.request().postDataJSON()
    const headers={...route.request().headers()}
    delete headers.origin
    const response=await route.fetch({url:native+'/workspace',headers})
    const data=await response.json()
    operations.push({op:payload?.op,ok:data.ok,revision:data.data?.revision,
      gradeRunPersisted:data.data?.gradeRunPersisted,error:data.error})
    await route.fulfill({status:response.status(),contentType:'application/json',
      headers:{'access-control-allow-origin':ui},body:JSON.stringify(data)})
  })
  await page.goto(ui+'/?desktop=1&engine=clothcraft&testSession=scoped-grading-ui-20261112',
    {waitUntil:'domcontentloaded'})
  await page.locator('.cc-board svg[data-native-tool]').waitFor({state:'visible',timeout:30000})
  stage='React grading catalog save'
  await page.getByRole('button',{name:'Edit Grading'}).click()
  const dialog=page.getByRole('dialog',{name:'Pattern Grading'})
  await dialog.waitFor({state:'visible'})
  await dialog.getByRole('button',{name:'Start zero-offset grading'}).click()
  await dialog.getByRole('table',{name:'Independent editable grade movements by size'}).waitFor()
  await dialog.getByRole('tab',{name:'Export'}).click()
  const catalog=dialog.getByRole('region',{name:'Native grading catalog'})
  const controls=await catalog.evaluate(node=>({
    buttons:[...node.querySelectorAll('button')].map(b=>({text:b.textContent?.trim(),aria:b.getAttribute('aria-label'),disabled:b.disabled})),
    status:node.querySelector('header span')?.textContent||null,
  }))
  results.exportControls=controls
  const draftControls=async()=>catalog.evaluate(node=>({
    localUndoDisabled:node.querySelector('button[aria-label="Undo local grading draft"]')?.disabled??null,
    localRedoDisabled:node.querySelector('button[aria-label="Redo local grading draft"]')?.disabled??null,
    table:[...document.querySelectorAll('table[aria-label="Independent editable grade movements by size"] input')].map(input=>input.value),
  }))
  draftBefore=await draftControls()
  await catalog.getByRole('button',{name:'Save grading catalog to Rust'}).click()
  await page.waitForFunction(()=>document.querySelector('[aria-label="Native grading catalog"] header span')?.textContent==='SAVED IN PROJECT',
    null,{timeout:45000})
  assert(operations.some(o=>o.op==='grade-run-commit'&&o.ok),'Real React catalog Save has no Rust HTTP receipt')
  const persisted=(await send({op:'save'})).project
  assert.equal(persisted.grade_run?.gradedTemplates?.length,6,'Native project missing six graded templates')
  same(persisted.template,baseline.template,'Native catalog save modified base template')
  results.realReactSave=true
  stage='scoped Rust history controls'
  const details=catalog.locator('details[data-exo-native-grading-history="scoped"]')
  await details.locator('summary').click()
  assert(await details.evaluate(el=>el.open),'Scoped grading history details did not open')
  const undo=catalog.getByRole('button',{name:'Undo verified Rust grading catalog'})
  await undo.waitFor({state:'visible'})
  results.scopedUndoState=await undo.evaluate(b=>({disabled:b.disabled,html:b.outerHTML.slice(0,500)}))
  assert(await undo.isEnabled(),'SCOPED_NATIVE_UNDO_DISABLED: catalog not verified against current native revision')
  await undo.click()
  results.scopedUndoButtonClicked=true
  await page.waitForFunction(()=>document.querySelector('[aria-label="Native grading catalog"] header span')?.textContent==='NOT SAVED',
    null,{timeout:20000})
  const undoReceipt=operations.find(o=>o.op==='undo'&&o.ok)
  assert(undoReceipt,'Explicit Rust Undo button sent no successful HTTP undo')
  results.undoHTTPVerified=true
  const undone=(await send({op:'save'})).project
  assert.equal(undone.grade_run??null,null,'Native Undo left graded templates saved')
  same(undone.template,baseline.template,'Native Undo modified base source template')
  stage='scoped Rust Redo and persistence'
  const redo=catalog.getByRole('button',{name:'Redo verified Rust grading catalog'})
  assert(await redo.isEnabled(),'SCOPED_NATIVE_REDO_DISABLED: no verified Rust undo witness')
  await redo.click()
  results.scopedRedoButtonClicked=true
  await page.waitForFunction(()=>document.querySelector('[aria-label="Native grading catalog"] header span')?.textContent==='SAVED IN PROJECT',
    null,{timeout:20000})
  assert(operations.some(o=>o.op==='redo'&&o.ok),'Explicit Rust Redo button sent no successful HTTP redo')
  results.redoHTTPVerified=true
  const redone=(await send({op:'save'})).project
  assert.equal(redone.grade_run?.gradedTemplates?.length,6,'Redo did not recover six templates')
  same(redone.grade_run,persisted.grade_run,'Redo catalog differs from original saved Rust catalog')
  same(redone.template,baseline.template,'Redo altered original garment geometry')
  const onDisk=JSON.parse(readFileSync(path.join(output,'workspace/fitting-project.json'),'utf8'))
  same(onDisk.grade_run,redone.grade_run,'Persisted on-disk graded catalog does not match Rust Save')
  results.sixTemplatesRestored=true
  const draftAfter=await draftControls()
  results.draftBefore=draftBefore
  results.draftAfter=draftAfter
  same(draftAfter,draftBefore,'Visible local grading draft values or journal affordances changed')
  results.localDraftPreserved=true
  assert.deepEqual(pageErrors,[],'Browser JavaScript errors')
  results.pass=true
  console.log(JSON.stringify({...results,ops:operations.map(o=>o.op)}))
}catch(error){
  results.blocker=String(error?.message||error)
  results.stage=stage
  results.operations=operations
  results.draftBefore=draftBefore
  if(page&&!page.isClosed()){
    try{results.dom=await page.locator('[aria-label="Native grading catalog"]').evaluate(el=>({
      status:el.querySelector('header span')?.textContent,
      message:el.querySelector('[data-native-catalog-message]')?.textContent,
      buttons:[...el.querySelectorAll('button')].map(b=>({text:b.innerText,aria:b.getAttribute('aria-label'),disabled:b.disabled})),
      historyOpen:el.querySelector('details[data-exo-native-grading-history="scoped"]')?.open,
    }))}catch(e){results.domError=String(e.message)}
  }
  console.error(JSON.stringify(results))
  process.exitCode=2
}finally{
  await context?.close().catch(()=>{})
  await browser?.close().catch(()=>{})
  for(const child of children)try{process.kill(-child.pid,'SIGTERM')}catch{}
  if(output)rmSync(output,{recursive:true,force:true})
}
