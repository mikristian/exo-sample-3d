import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
const origin='http://127.0.0.1:5277'
let browser
try{
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']})
 const page=await browser.newPage({viewport:{width:1080,height:900}})
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(origin+'/qa/exo-avatar-visual-native-alignment-20261102.html',{waitUntil:'domcontentloaded',timeout:30000})
 await page.waitForFunction(()=>Array.isArray(window.__avatarAlignmentResults),null,{timeout:50000})
 const results=await page.evaluate(()=>window.__avatarAlignmentResults)
 console.log('EXO_BROWSER_COLLIDER_ALIGNMENT',JSON.stringify({results,errors},null,2))
 assert.equal(results.length,10)
 assert.deepEqual(errors,[])
 for(const result of results){assert.equal(result.failed,undefined,JSON.stringify(result));assert.equal(result.matched,true,JSON.stringify(result));assert.ok(result.errorMm<=result.thresholdMm,JSON.stringify(result))}
}finally{await browser?.close()}
