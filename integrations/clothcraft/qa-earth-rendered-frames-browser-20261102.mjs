/** End-to-end browser contract: same Earth scene, alternative CC0 frames-only media. */
import {chromium} from 'playwright-core';import assert from 'node:assert/strict';import fs from 'node:fs';
const website=process.env.EXO_EARTH_SITE_URL||'http://127.0.0.1:8100/';
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await chromium.launch({headless:true,executablePath:fs.existsSync(chrome)?chrome:undefined,
 args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
const result=[];
try{
 for(const [mode,width,height,reduced] of [['desktop',1440,900,'no-preference'],['mobile',390,844,'no-preference'],['reduced-motion',810,900,'reduce']]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:reduced});const page=await context.newPage();
  const requested=[],jsErrors=[];
  page.on('request',r=>{if(/assets\/fashion-avatars\//.test(r.url()))requested.push(r.url())});
  page.on('pageerror',e=>jsErrors.push(e.message));
  await page.goto(new URL('?avatarRender=frames',website).href,{waitUntil:'domcontentloaded',timeout:30000});
  const canvas=page.locator('#cc-runway-canvas');await canvas.scrollIntoViewIfNeeded();
  if(reduced!=='reduce')await page.waitForFunction(()=>document.querySelector('#cc-runway-canvas')?.dataset?.renderedFrameStatus==='ready',null,{timeout:45000});
  else await page.waitForTimeout(800);
  await page.waitForTimeout(450);
  const data=await canvas.evaluate(node=>({dataset:{...node.dataset},width:node.width,height:node.height,rect:node.getBoundingClientRect().toJSON()}));
  const requestedGLB=requested.filter(url=>/\.(?:glb|gltf|fbx|obj)(?:[?#]|$)/i.test(url));
  const caseResult={mode,data,requestedCount:requested.length,requestedGLB,jsErrors};result.push(caseResult);
  assert.equal(data.dataset.avatarRenderMode,'frames');assert.equal(data.dataset.avatarCount,'4');
  assert.equal(Number(data.dataset.earthSpin),.082);assert.equal(Number(data.dataset.orbitWalk),.021);
  assert.equal(data.dataset.avatarOutfits,'denim-shirt,dress,denim-shirt,dress');
  assert.equal(requestedGLB.length,0,'Rendered media mode delivered underlying 3D models!');
  assert.deepEqual(jsErrors,[]);
  if(reduced!=='reduce'){
   assert.equal(data.dataset.loadedRenderedFigures,'4',`${mode} did not load all rendered characters`);
   assert.equal(data.dataset.renderedFrameStatus,'ready');
   assert.equal(data.dataset.avatarSource,'cc0-rendered-frames');
   assert.ok(requested.some(url=>url.endsWith('/masculine.webp')));
   assert.ok(requested.some(url=>url.endsWith('/feminine.webp')));
   const dest=`website/clothcraft/qa/earth-frames-${mode}-20261102.png`;
   await page.screenshot({path:dest});
  }else{
   assert.equal(data.dataset.loadedRenderedFigures,'0','Reduced-motion should not load active animated frame sprites');
  }
  await context.close();
 }
 console.log('EXO_EARTH_FRAMES_BROWSER_QA',JSON.stringify(result,null,2));
}finally{await browser.close()}
