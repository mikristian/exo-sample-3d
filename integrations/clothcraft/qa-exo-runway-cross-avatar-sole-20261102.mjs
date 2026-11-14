import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5277/qa/exo-runway-cross-avatar-real-sole-20261102.html?calibrate='+String(process.env.EXO_AVATAR_GROUND_CALIBRATION==='1'?'1':'0'),{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.__exoAllBodySoleQA!==null,null,{timeout:120000});const result=await page.evaluate(()=>window.__exoAllBodySoleQA);
 console.log('EXO_ALL_BODY_SOLE_QA',JSON.stringify({result,errors},null,2));assert.ok(Array.isArray(result));assert.equal(result.length,4);assert.deepEqual(errors,[])
 for(const model of result){assert.ok(!model.error,model.error);assert.equal(model.bones,163)}
}finally{await browser.close()}
