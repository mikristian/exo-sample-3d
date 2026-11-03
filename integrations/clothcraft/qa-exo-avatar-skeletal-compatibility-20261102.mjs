import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5277/qa/exo-avatar-skeletal-compatibility-20261102.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__exoRigCompatibilityResults!==null,null,{timeout:65000});const results=await page.evaluate(()=>window.__exoRigCompatibilityResults);
 console.log('EXO_SKELETON_FAMILY_MATRIX',JSON.stringify({results,errors},null,2));assert.ok(Array.isArray(results));
 assert.equal(results.length,13);assert.deepEqual(errors,[]);
 assert.ok(results.slice(0,10).every(x=>x.compatible===true&&x.bones===163),JSON.stringify(results));
 assert.ok(results.slice(10).every(x=>x.compatible===false),JSON.stringify(results.slice(10)));
}finally{await browser.close()}
