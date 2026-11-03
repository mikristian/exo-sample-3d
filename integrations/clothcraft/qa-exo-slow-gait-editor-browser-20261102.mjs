import assert from 'node:assert/strict';import {chromium} from 'playwright-core'
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
try{
 const page=await browser.newPage({viewport:{width:1250,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5277/qa/exo-avatar-animation-rig-gate-20261102.html',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>document.querySelector('canvas[data-walk-avatar-loaded="exo-masculine-02-pose-t"]'),null,{timeout:60000});
 await page.locator('select[aria-label="Walk avatar model"]').selectOption('exo-masculine-02-exact')
 await page.locator('select[aria-label="Avatar skeletal motion clip"]').selectOption('slow-footlock-v6')
 await page.waitForFunction(()=>document.querySelector('canvas[data-exo-motion-review="research-slow-not-professional"]'),null,{timeout:45000})
 const slow=await page.evaluate(()=>{const c=document.querySelector('.cc-scene canvas');return{
  model:c?.dataset.walkAvatarLoaded,review:c?.dataset.exoMotionReview,rigStatus:c?.dataset.exoMotionRigStatus,
  groundOffsetMm:c?.dataset.exoMotionGroundOffsetMm,physical:c?.dataset.metahumanPhysics,
  errors:[...document.querySelectorAll('.cc-animation-error')].map(n=>n.textContent)}})
 assert.equal(slow.model,'exo-masculine-02-exact');assert.equal(slow.review,'research-slow-not-professional')
 assert.equal(slow.rigStatus,'compatible');assert.equal(Number(slow.groundOffsetMm),-6.5)
 assert.ok(slow.errors.some(x=>/too slow/i.test(x)))
 await page.locator('select[aria-label="Walk avatar model"]').selectOption('exo-masculine-02-pose-t')
 await page.waitForFunction(()=>document.querySelector('canvas[data-exo-motion-rig-status="uncalibrated-foot-contact"]'),null,{timeout:45000})
 const rejected=await page.evaluate(()=>{const c=document.querySelector('.cc-scene canvas');return{
  model:c?.dataset.walkAvatarLoaded,status:c?.dataset.exoMotionRigStatus,ground:c?.dataset.exoMotionGroundOffsetMm,
  errors:[...document.querySelectorAll('.cc-animation-error')].map(n=>n.textContent)}})
 assert.equal(rejected.status,'uncalibrated-foot-contact');assert.equal(rejected.ground,undefined)
 assert.ok(rejected.errors.some(x=>/calibration/i.test(x)))
 console.log('EXO_EDITOR_SLOW_GAIT_CALIBRATION',JSON.stringify({slow,rejected,errors},null,2));assert.deepEqual(errors,[])
}finally{await browser.close()}
