import assert from 'node:assert/strict';import {chromium} from 'playwright-core'
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']});try{
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5277/qa/exo-avatar-exact-rig-deform-20261102.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__rigDeformResult!==null,null,{timeout:45000});const result=await page.evaluate(()=>window.__rigDeformResult);console.log('EXO_PRECISE_RIG_DEFORM',JSON.stringify({result,errors},null,2));assert.ok(!result.error,result.error);assert.equal(result.bones,163);assert.ok(result.numberOver1mm>100,'No actual skin motion');assert.ok(result.maxMotionMm>10,'Skin deformation too small');assert.deepEqual(errors,[])
}finally{await browser.close()}
