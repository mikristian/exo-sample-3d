import assert from 'node:assert/strict';import {chromium} from 'playwright-core'
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']});try{
 const page=await browser.newPage({viewport:{width:1250,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5277/qa/exo-avatar-animation-rig-gate-20261102.html',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>document.querySelector('canvas[data-walk-avatar-loaded="exo-masculine-02-pose-t"]'),null,{timeout:60000});
 await page.locator('select[aria-label="Avatar skeletal motion clip"]').selectOption('turn-360-v3')
 await page.waitForFunction(()=>document.querySelector('canvas[data-exo-motion-rig-status="compatible"]'),null,{timeout:45000})
 let passed=await page.evaluate(()=>{const c=document.querySelector('.cc-scene canvas');return {model:c?.dataset.walkAvatarLoaded,rigStatus:c?.dataset.exoMotionRigStatus,bones:c?.dataset.exoMotionRigMatchedBones,review:c?.dataset.exoMotionReview,physics:c?.dataset.metahumanPhysics}})
 assert.equal(passed.model,'exo-masculine-02-pose-t');assert.equal(passed.rigStatus,'compatible');assert.equal(passed.bones,'163');assert.equal(passed.review,'preview')
 await page.locator('select[aria-label="Walk avatar model"]').selectOption('theo')
 await page.waitForFunction(()=>document.querySelector('canvas[data-exo-motion-rig-status="blocked"]'),null,{timeout:45000})
 const blocked=await page.evaluate(()=>{const c=document.querySelector('.cc-scene canvas');return{model:c?.dataset.walkAvatarLoaded,rigStatus:c?.dataset.exoMotionRigStatus,bones:c?.dataset.exoMotionRigMatchedBones,errors:[...document.querySelectorAll('[role="alert"]')].map(n=>n.textContent)}})
 assert.equal(blocked.model,'theo');assert.equal(blocked.rigStatus,'blocked');assert.ok(blocked.errors.some(s=>/retarget/i.test(s)))
 console.log('EXO_RIG_GATING',JSON.stringify({passed,blocked,errors},null,2));assert.deepEqual(errors,[])
}finally{await browser.close()}
