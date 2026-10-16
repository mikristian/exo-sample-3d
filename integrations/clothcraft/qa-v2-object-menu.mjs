// Standalone Object Browser menu relocation regression. Runs disposable
// localhost services and never edits either installed Studio's saved garment.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdirSync,mkdtempSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const output=mkdtempSync(path.join(root,'integrations/clothcraft/output/qa-object-menu-'))
mkdirSync(path.join(output,'workspace'),{recursive:true})
const api='http://127.0.0.1:5415',ui='http://127.0.0.1:5416',children=[]
const launch=(binary,args,env={})=>{
 const p=spawn(binary,args,{cwd:root,env:{...process.env,...env},stdio:'ignore',detached:true})
 children.push(p);return p
}
const ready=async url=>{
 for(let n=0;n<100;n++){
  try{if((await fetch(url,{signal:AbortSignal.timeout(1200)})).ok)return}catch{}
  if(children.some(child=>child.exitCode!==null))throw Error('QA server stopped')
  await new Promise(resolve=>setTimeout(resolve,200))
 }
 throw Error('QA timeout: '+url)
}
let browser
try{
 launch(process.execPath,['integrations/clothcraft/server.mjs'],{
  EXO_CLOTHCRAFT_PORT:'5415',EXO_CLOTHCRAFT_REPO:path.join(root,'research/oss/clothcraft'),
  EXO_CLOTHCRAFT_SESSION_BIN:path.join(root,'research/oss/clothcraft/target/debug/exo-session'),
  EXO_CLOTHCRAFT_OUTPUT_DIR:output,EXO_CLOTHCRAFT_GPU:'0'})
 launch(path.join(root,'node_modules/.bin/vite'),['--host','127.0.0.1','--port','5416','--strictPort'],
  {VITE_CLOTHCRAFT_BRIDGE_URL:api})
 await Promise.all([ready(api+'/health'),ready(ui)])
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1660,height:1010}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(ui+'/?desktop=1&engine=clothcraft',{waitUntil:'domcontentloaded'})
 await page.getByRole('navigation',{name:'Right workspace tools'}).waitFor({timeout:40000})
 const rail=page.getByRole('navigation',{name:'Right workspace tools'})
 const category=rail.getByRole('button',{name:'Object Browser category list'})
 assert.equal(await category.count(),1,'Exactly one actual bullet-list button should exist')
 assert.equal(await page.locator('.clo-object-bullet-menu-trigger').count(),0,'Old header menu must be removed')
 const placement=await rail.evaluate(node=>{
  const trigger=node.querySelector('.clo-object-category-trigger')
  const scene=node.querySelector('[aria-label="Scene hierarchy"]')
  const browser=document.querySelector('.clo-object-browser')
  return {
   besideScene:trigger?.nextElementSibling===scene && trigger?.parentElement===scene?.parentElement,
   inRail:node.contains(trigger),oldMenu:browser?.querySelector('.clo-object-hierarchy-menu')!==null,
   sameSize:Math.abs(trigger?.getBoundingClientRect().width-scene?.getBoundingClientRect().width)<2,
  }
 })
 assert.deepEqual(placement,{besideScene:true,inRail:true,oldMenu:false,sameSize:true})
 assert.equal(await category.getAttribute('aria-expanded'),'false')
 await category.click()
 assert.equal(await category.getAttribute('aria-expanded'),'true')
 const categories=['2D Pattern','Sewing','3D Form','Material','Environment']
 for(const name of categories) assert.equal(await rail.getByRole('button',{name,exact:true}).count(),1,name)
 assert.equal(await rail.getByRole('button',{name:'Pattern Pieces'}).count(),1)
 await rail.getByRole('button',{name:'Sewing',exact:true}).click()
 assert.equal(await rail.getByRole('button',{name:'Sewing Relationships'}).count(),1)
 await rail.getByRole('button',{name:'Material',exact:true}).click()
 await rail.getByRole('button',{name:'Fabric Editor'}).click()
 assert.equal(await page.getByRole('tab',{name:'Fabric',selected:true}).count(),1)
 await rail.getByRole('button',{name:'Environment',exact:true}).click()
 await rail.getByRole('button',{name:'Studio Lighting'}).click()
 assert.equal(await page.getByRole('combobox',{name:'Workspace',exact:true}).inputValue(),'Render')
 await page.screenshot({path:path.join(output,'object-menu-in-tool-rail.png')})
 const all=rail.getByRole('button',{name:'Show focused tools'})
 assert.equal(await all.count(),1,'All/focused toggle must remain available as distinct header text')
 await all.click()
 assert.equal(await rail.getByRole('button',{name:'Show all tools'}).count(),1)
 assert.equal(await rail.getByRole('button',{name:'Object Browser category list'}).count(),1)
 await rail.getByRole('button',{name:'Show all tools'}).click()
 assert.equal(await rail.getByRole('button',{name:'Object Browser category list'}).count(),1)
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,bulletMenuBeforeScene:true,removedFromHeader:true,
  inlineSideCategories:categories,childCategoryNavigation:true,allFocusedAvailable:true,
  output,errors},null,2))
} finally {
 await browser?.close().catch(()=>{})
 for(const child of children)try{process.kill(-child.pid,'SIGTERM')}catch{}
}
