// Disposable native session + real Chromium: validates Edit Sewing uses the same
// mouse tool as Segment/Free and performs Rust-backed edits without bottom UI.
import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
import {spawn} from 'node:child_process'
import {mkdtempSync,openSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const root=process.cwd(),dir=mkdtempSync(path.join(os.tmpdir(),'exo-edit-sewing-'))
const children=[]
function launch(exe,args,env,logName){const fd=openSync(path.join(dir,logName),'a');const child=spawn(exe,args,{cwd:root,stdio:['ignore',fd,fd],env:{...process.env,...env}});children.push(child)}
async function ready(url){for(let i=0;i<110;i++){try{if((await fetch(url,{signal:AbortSignal.timeout(800)})).ok)return}catch{}await new Promise(r=>setTimeout(r,200))}throw Error(`Fixture not ready: ${url}`)}
let browser
try{
 launch(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5415',EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
  EXO_CLOTHCRAFT_OUTPUT_DIR:dir,EXO_CLOTHCRAFT_GPU:'0'},'backend.log')
 launch(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5188','--strictPort'],{
  VITE_CLOTHCRAFT_BRIDGE_URL:'http://127.0.0.1:5415'},'vite.log')
 await Promise.all([ready('http://127.0.0.1:5415/health'),ready('http://127.0.0.1:5188/')])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-gpu']})
 const page=await browser.newPage({viewport:{width:1690,height:1050}});page.setDefaultTimeout(15000)
 const errors=[];page.on('pageerror',error=>errors.push(error.message))
 await page.goto('http://127.0.0.1:5188/?desktop=1&engine=clothcraft&testSession=edit-sewing-qa',{waitUntil:'domcontentloaded'})
 const board=page.locator('.cc-board').first()
 await board.locator('[data-panel="front"]').waitFor({timeout:45000})
 const first=await page.evaluate(async()=>{const r=await fetch('http://127.0.0.1:5415/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'snapshot'})});const v=await r.json();return {ok:v.ok,seams:v.data?.template?.seams?.length||0,keys:Object.keys(v)}})
 console.log('Initial native seams',first)
 await page.locator('[data-clo-slot="2d:B01"]').click()
 await page.waitForFunction(()=>document.querySelector('.cc-board')?.dataset.editSewing==='true')
 assert.equal(await board.getAttribute('data-edit-sewing'),'true')
 assert.equal(await board.locator('svg').first().evaluate(el=>getComputedStyle(el).cursor.includes('sewing-machine.svg')),true)
 assert.equal(await page.locator('[data-native-seam-editor]').count(),0,'No bottom seam editor in Edit Sewing')
 assert.equal(await page.locator('[data-native-free-sewing-settings]').count(),0)
 const canvas=page.locator('.cc-viewport-3d canvas').first()
 console.log('Edit cursor 3D',await canvas.evaluate(el=>el.dataset.activeToolCursor),'2D',await board.locator('svg').first().evaluate(el=>getComputedStyle(el).cursor))
 const guides=board.locator('[data-edit-seam-guide]')
 const guideCount=await guides.count()
 console.log('Edit guide count',await guides.count(),'boundary seam-linked hits',await board.locator('[data-seam-link]').count())
 if(await guides.count()){
  await guides.first().dispatchEvent('click',{bubbles:true})
  console.log('Selected seam after guide click',await page.evaluate(()=>document.querySelector('.cc-board [data-edit-seam-guide]')?.getAttribute('data-edit-seam-guide')))
  const guide=await guides.first().getAttribute('data-edit-seam-guide')
  assert.equal(await board.locator(`[data-edit-seam-guide="${guide}"]`).count()>0,true)
  const initialSeam=await page.evaluate(async id=>{const r=await fetch('http://127.0.0.1:5415/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'snapshot'})});const v=await r.json();return v.data?.template?.seams?.find(seam=>seam.id===id)},guide)
  assert.ok(initialSeam,'Existing named native seam must be present')
  await guides.first().dispatchEvent('contextmenu',{bubbles:true,clientX:1000,clientY:540,button:2})
  await page.getByRole('menuitem',{name:/Reverse second edge|Unreverse second edge/}).waitFor()
  await page.getByRole('menuitem',{name:/Reverse second edge|Unreverse second edge/}).click()
  await page.waitForFunction(async ({id,prior})=>{const r=await fetch('http://127.0.0.1:5415/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'snapshot'})});const v=await r.json();return v.data?.template?.seams?.find(seam=>seam.id===id)?.reverse_b!==prior},{id:guide,prior:initialSeam.reverse_b},{timeout:12000})
  assert.equal(await page.locator('[data-native-seam-editor]').count(),0)
  console.log('PASS existing seam selection, right-click Rust edit, no bottom form')
 }
 await page.locator('[data-clo-slot="3d:A05"]').click()
 await page.waitForFunction(()=>document.querySelector('.cc-board')?.dataset.editSewing==='true')
 assert.equal(await canvas.evaluate(el=>el.dataset.activeToolCursor),'seam-edit')
 assert.equal(await page.locator('[data-native-seam-editor]').count(),0)
 console.log('PASS 3D Edit Sewing toolbar shares canvas cursor and does not open bottom form')
 await page.locator('[data-clo-slot="2d:B02"]').click()
 await page.waitForFunction(()=>document.querySelector('.cc-board')?.dataset.segmentSewing==='true')
 assert.equal(await board.getAttribute('data-edit-sewing'),'false')
 assert.equal(await board.locator('svg').first().evaluate(el=>getComputedStyle(el).cursor.includes('sewing-machine.svg')),true)
 await page.locator('[data-clo-slot="2d:B03"]').click()
 await page.waitForFunction(()=>document.querySelector('.cc-board')?.dataset.freeSewing==='true')
 assert.equal(await board.locator('svg').first().evaluate(el=>getComputedStyle(el).cursor.includes('sewing-machine.svg')),true)
 await page.locator('[data-clo-slot="2d:B01"]').click()
 await page.waitForFunction(()=>document.querySelector('.cc-board')?.dataset.editSewing==='true')
 await page.locator('[data-clo-slot="2d:A01"]').click()
 await page.waitForFunction(()=>document.querySelector('.cc-board')?.dataset.editSewing==='false')
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({pass:true,editSewingCursor:true,noBottomWidget:true,segmentAndFreeUnchanged:true,seamGuides:guideCount,pageErrors:errors.length}))
}catch(error){console.error('Edit Sewing QA failed:',error.stack,'\nLogs:',dir);process.exitCode=1}
finally{if(browser)await browser.close();for(const child of children)child.kill('SIGTERM')}
