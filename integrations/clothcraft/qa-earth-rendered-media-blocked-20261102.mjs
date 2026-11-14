import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
const website=process.env.EXO_EARTH_SITE_URL||'http://127.0.0.1:8100/'
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser=await chromium.launch({headless:true,executablePath:fs.existsSync(chrome)?chrome:undefined,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']})
const baseline=JSON.parse(fs.readFileSync('website/clothcraft/assets/fashion-avatars/rendered-cc0-proof-20261102/manifest.json','utf8'))
const scenarios=[
 ['academic-clo',{...baseline,sourceKind:'clo-derived',license:'academic',commercialSourceAuthorized:false}],
 ['unapproved-glb',{...baseline,models:{masculine:{...baseline.models.masculine,atlas:'../garment-v1/EXO_masculine_cc0_distincthead_20261102.glb'},feminine:baseline.models.feminine}}],
 ['external-image',{...baseline,models:{masculine:{...baseline.models.masculine,atlas:'https://example.com/avatar.webp'},feminine:baseline.models.feminine}}],
]
const results=[]
try{
 for(const [name,manifest] of scenarios){
  const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'no-preference'})
  const page=await context.newPage();const requests=[],jsErrors=[]
  page.on('request',r=>{if(/assets\/fashion-avatars\//.test(r.url()))requests.push(r.url())})
  page.on('pageerror',e=>jsErrors.push(e.message))
  await page.route('**/rendered-cc0-proof-20261102/manifest.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)}))
  await page.goto(new URL('?avatarRender=frames',website).href,{waitUntil:'domcontentloaded'})
  await page.locator('#cc-runway-canvas').scrollIntoViewIfNeeded()
  await page.waitForFunction(()=>document.querySelector('#cc-runway-canvas')?.dataset?.renderedFrameStatus==='fallback',null,{timeout:25000})
  const state=await page.locator('#cc-runway-canvas').evaluate(c=>({...c.dataset}))
  const modelRequests=requests.filter(u=>/\.(glb|gltf|obj|fbx)(?:[?#]|$)/i.test(u))
  const imageRequests=requests.filter(u=>/\.(png|webp|avif)(?:[?#]|$)/i.test(u))
  assert.equal(state.loadedRenderedFigures,'0',name+' unexpectedly rendered unauthorized media')
  assert.equal(state.avatarRenderMode,'frames')
  assert.equal(modelRequests.length,0)
  assert.equal(imageRequests.length,0)
  assert.deepEqual(jsErrors,[])
  results.push({name,loadedRenderedFigures:state.loadedRenderedFigures,
   status:state.renderedFrameStatus,modelRequests:modelRequests.length,imageRequests:imageRequests.length})
  await context.close()
 }
 console.log('EXO_EARTH_MEDIA_REJECTION_QA',JSON.stringify(results,null,2))
}finally{await browser.close()}
