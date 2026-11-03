import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5277/qa/exo-runway-skinned-foot-surface-20261102.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__exoSoleSurfaceQA!==null,null,{timeout:90000});const report=await page.evaluate(()=>window.__exoSoleSurfaceQA);
 console.log('EXO_REAL_SKIN_FOOT_SURFACE_RESEARCH',JSON.stringify({report,errors},null,2));
 assert.ok(!report.error,report.error);assert.equal(report.bones,163);assert.ok(report.contactPoints.L>50);assert.ok(report.contactPoints.R>50);assert.deepEqual(errors,[]);
}finally{await browser.close()}
