import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
let browser
try{
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage()
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:5277/qa/exo-avatar-motion-hair-20261102.html',{waitUntil:'domcontentloaded',timeout:30000})
 await page.waitForFunction(()=>Array.isArray(window.__exoRiggedMotionResults),null,{timeout:60000})
 const result=await page.evaluate(()=>window.__exoRiggedMotionResults)
 console.log('EXO_MOTION_HAIR_BROWSER',JSON.stringify({result,errors}))
 assert.equal(errors.length,0)
 assert.equal(result.length,7)
 for(const row of result){
  assert.equal(row.error,undefined,row.error)
  assert.equal(row.rigBones,163)
  assert.ok(row.skinnedMeshes>=4)
  assert.ok(row.channels>100)
  assert.ok(row.duration>.1)
  assert.ok(row.midpointRigChange>.0001,'No actual keyframed motion: '+row.name)
  assert.ok(row.hairStyledCount>=1)
  assert.ok(row.hidden)
 }
}finally{await browser?.close()}
