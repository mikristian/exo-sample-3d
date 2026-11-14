/** Browser regression for the exact URL requested: http://127.0.0.1:8100/.
 * Academic CLO geometry may only be exposed in the loopback research preview.
 */
import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const url='http://127.0.0.1:8100/'
const exe='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser=await chromium.launch({headless:true,executablePath:fs.existsSync(exe)?exe:undefined,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']})
const results=[]
try{
 for(const [mode,width,height,reduced] of [['desktop',1440,900,'no-preference'],['mobile',390,844,'no-preference'],['reduced-motion',900,900,'reduce']]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:reduced})
  const page=await context.newPage(),errors=[],cloRequests=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('request',req=>{if(req.url().includes('__exo_local_clo_research__'))cloRequests.push(req.url())})
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000})
  const canvas=page.locator('#cc-runway-canvas')
  await canvas.scrollIntoViewIfNeeded()
  if(reduced!=='reduce')await page.waitForFunction(()=>document.querySelector('#cc-runway-canvas')?.dataset?.cloPrivateFigures==='2',null,{timeout:60000})
  else await page.waitForTimeout(700)
  const attrs=await canvas.evaluate(e=>({...e.dataset}))
  assert.equal(response.status(),200)
  assert.equal(new URL(page.url()).searchParams.get('avatarSource'),'clo-private','Root should redirect into the private CLO preview')
  assert.equal(attrs.renderedFigures,'4')
  assert.equal(Number(attrs.earthSpin),.082)
  assert.equal(Number(attrs.orbitWalk),.021)
  assert.deepEqual(errors,[])
  if(reduced==='reduce'){
   assert.equal(cloRequests.length,0)
   assert.equal(attrs.avatarSource,'procedural-fallback')
  }else{
   assert.equal(attrs.avatarSource,'private-clo-thomas-mixed')
   assert.equal(attrs.cloPrivateFigures,'2')
   assert.equal(attrs.clothedCount,'4')
   assert.equal(attrs.cloPrivatePreview,'loaded')
   assert.equal(cloRequests.filter(s=>s.endsWith('thomas-walk.glb')).length,1)
   const title=page.locator('[data-clo-research-only]')
   assert.ok(await title.count())
   await page.screenshot({path:`website/clothcraft/qa/clo-earth-8100-${mode}-20261102.png`})
  }
  results.push({mode,finalUrl:page.url(),cloModels:attrs.cloPrivateFigures||'0',
    outfitCount:attrs.clothedCount,avatarSource:attrs.avatarSource,localCloHttpRequests:cloRequests.length,errors})
  await context.close()
 }
 // Alternate URL explicitly selecting safe/non-CLO source must not request Thomas.
 const context=await browser.newContext({viewport:{width:1200,height:800}})
 const page=await context.newPage(),cloRequests=[]
 page.on('request',req=>{if(req.url().includes('__exo_local_clo_research__'))cloRequests.push(req.url())})
 await page.goto(url+'?avatarSource=cc0',{waitUntil:'domcontentloaded'})
 await page.locator('#cc-runway-canvas').scrollIntoViewIfNeeded()
 await page.waitForFunction(()=>document.querySelector('#cc-runway-canvas')?.dataset?.avatarSource==='clothed-glb',null,{timeout:60000})
 assert.equal(cloRequests.length,0)
 results.push({mode:'safe-explicit-cc0',source:'clothed-glb',localCloHttpRequests:0})
 await context.close()
 console.log('EXO_8100_CLO_EARTH_HOME_QA',JSON.stringify(results,null,2))
}finally{await browser.close()}
