// Standalone browser check: node website/clothcraft/qa-globe-clothed-20261102.mjs
// Optional: CC_SITE_URL=http://127.0.0.1:5174/ CC_QA_SCREENSHOT=/tmp/clothcraft-globe.png
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const url=process.env.CC_SITE_URL||'http://127.0.0.1:5174/website/clothcraft/';
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await chromium.launch({headless:true,executablePath:existsSync(chrome)?chrome:undefined,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
const failures=[];
for(const [mode,width,height,reduceMotion] of [['desktop',1440,900,'no-preference'],['mobile',390,844,'no-preference'],['reduced-motion',768,900,'reduce']]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:reduceMotion});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
  await page.locator('#cc-runway-canvas').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1800);
  const result=await page.locator('#cc-runway-canvas').evaluate(canvas=>({status:{...canvas.dataset},rect:canvas.getBoundingClientRect().toJSON(),width:canvas.width,height:canvas.height}));
  if(result.status.renderedFigures&&result.status.renderedFigures!=='4')failures.push(`${mode}: expected 4 figures`);
  if(result.status.avatarOutfits&&result.status.avatarOutfits!=='denim-shirt,dress,denim-shirt,dress')failures.push(`${mode}: incorrect outfit configuration`);
  if(!result.status.renderedFigures)console.warn(`${mode}: headless WebGL unavailable; scene correctness unverified in this viewport`);
  if(!result.width||!result.height)failures.push(`${mode}: canvas not sized`);
  if(errors.length)failures.push(`${mode}: ${errors.join('; ')}`);
  if(mode==='desktop'&&process.env.CC_QA_SCREENSHOT)await page.screenshot({path:process.env.CC_QA_SCREENSHOT});
  console.log(JSON.stringify({mode,...result,errors}));
  await context.close();
}
await browser.close();
if(failures.length){console.error(failures.join('\n'));process.exitCode=1}
