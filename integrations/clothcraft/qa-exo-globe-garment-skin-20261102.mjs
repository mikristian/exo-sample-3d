import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8192/qa/globe-garment-skin-20261102.html'+(process.env.EXO_CUSTOM_HEAD_QA==='1'?'?customHeads=1':''),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__exoGlobeGarmentSkinQA!==null,null,{timeout:90000});const results=await page.evaluate(()=>window.__exoGlobeGarmentSkinQA);
 console.log('EXO_EARTH_REAL_CLOTHING_SKIN_QA',JSON.stringify({results,errors},null,2));
 assert.ok(Array.isArray(results),JSON.stringify(results));assert.equal(results.length,2);assert.deepEqual(errors,[]);
 for(const model of results){
  assert.ok(model.boneCount>=150,`Incomplete skeleton ${model.model}`);
  assert.ok(model.hasRealWalk,`No actual animation on ${model.model}`);
  assert.equal(model.missingRequired.length,0,`Missing ${model.missingRequired.join(' / ')}`);
  assert.ok(model.garments.length>=2,`Missing garment pieces for ${model.model}`);
  for(const garment of model.garments){
   assert.ok(garment.skinned&&garment.hasSkinIndices&&garment.hasSkinWeights&&garment.boundBones>=150,`Incorrect skin on ${garment.mesh}`);
   assert.equal(garment.zeroWeight,0,`Unweighted cloth vertices on ${garment.mesh}`);
   assert.ok(garment.maxLocalArticulatedDeformationM>.002,`Garment does not move with avatar bones ${garment.mesh}`);
  }
 }
}finally{await browser.close()}
