import assert from 'node:assert/strict';import {chromium} from 'playwright-core'
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']});try{
const page=await browser.newPage({viewport:{width:1300,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5277/qa/exo-avatar-react-scene-pose-20261102.html',{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForFunction(()=>document.querySelector('.cc-scene canvas')||String(window.__scenePoseStatus).startsWith('error'),null,{timeout:30000});
await page.waitForFunction(()=>{
 const c=document.querySelector('.cc-scene canvas');return Boolean(c&&(c.dataset.walkAvatarLoaded==='exo-masculine-02-pose-t'||document.querySelector('.cc-animation-error')))
},null,{timeout:45000});
const result=await page.evaluate(()=>{const c=document.querySelector('.cc-scene canvas');return{scene:window.__scenePoseStatus,loaded:c?.dataset.walkAvatarLoaded,
 physicalPose:c?.dataset.exoFittingPhysicalPose,alignmentM:c?.dataset.exoAvatarColliderAlignmentM,physics:c?.dataset.metahumanPhysics,
 canvas:c?.width?'webgl-canvas':'missing',error:document.querySelector('.cc-animation-error')?.textContent??null}});
await page.screenshot({path:'../exo-avatar-research-20261102/visual_collider_exact/exo-react-physical-t-pose-preview.png',fullPage:true});console.log('EXO_REACT_PHYSICAL_POSE',JSON.stringify({result,errors},null,2));
assert.equal(result.loaded,'exo-masculine-02-pose-t');assert.equal(result.physicalPose,'fit-t');assert.ok(Number(result.alignmentM)<.002);assert.ok(!result.error,result.error);assert.deepEqual(errors,[]);
}finally{await browser.close()}
