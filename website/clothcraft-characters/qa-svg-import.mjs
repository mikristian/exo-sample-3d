import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=dirname(fileURLToPath(import.meta.url)),output=join(root,'qa')
mkdirSync(output,{recursive:true})
const pageUrl='http://127.0.0.1:5288/circle.html'
const report={safeSvg:false,illustratorStyles:false,localGradients:false,blockedUnsafe:[],colorPreserved:false,recolor:false,drag:false,svgExport:false,pngExport:false,jsonExport:false,persistence:false,preset:false,resetKeepsLibrary:false,libraryReuse:false,libraryDelete:false,mobile:false,errors:[]}
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-dev-shm-usage']})
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true})
  page.on('pageerror',err=>report.errors.push(err.message))
  await page.goto(pageUrl,{waitUntil:'networkidle'})
  await page.evaluate(()=>localStorage.removeItem('exo-circle-eye-lab-display-v4'))
  await page.reload({waitUntil:'networkidle'})
  await page.getByRole('tab',{name:'Details'}).click()
  const fileInput=page.getByLabel('Choose SVG tattoo file')
  const upload=async(name,markup)=>fileInput.setInputFiles({name,mimeType:'image/svg+xml',buffer:Buffer.from(markup)})
  const safeSvg=`<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80">
      <style>.cls-1 { fill: #ff2255; stroke: #222222; stroke-width: 2; } .cls-2 { fill: #9a77ff; }</style>
      <g transform="translate(3,2)">
        <path class="cls-1" d="M10 12 L90 12 L70 58 Z"/>
        <circle class="cls-2" cx="55" cy="34" r="12" />
      </g>
    </svg>`
  await upload('Illustrator Tattoo.svg',safeSvg)
  await page.getByText('Added "Illustrator Tattoo"').waitFor()
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-type="user-svg"]').count(),1)
  const art=page.locator('.eye-stage-avatar [data-accessory-type="user-svg"]')
  assert.equal(await art.locator('path').first().getAttribute('fill'),'#ff2255')
  assert.equal(await art.locator('circle').first().getAttribute('fill'),'#9a77ff')
  report.safeSvg=true;report.illustratorStyles=true;report.colorPreserved=true
  assert.equal(await page.getByRole('button',{name:'Add uploaded tattoo Illustrator Tattoo'}).count(),1)
  await page.screenshot({path:join(output,'character-studio-svg-upload.png'),fullPage:true})
  await page.getByRole('checkbox',{name:/Recolor SVG/}).check()
  await page.getByRole('button',{name:'DETAIL COLOR #67e2f1'}).click()
  assert.equal(await art.locator('path').first().getAttribute('fill'),'#67e2f1')
  report.recolor=true
  await page.locator('.eye-stage').scrollIntoViewIfNeeded()
  const before=await art.getAttribute('transform'),bounds=await art.boundingBox()
  const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+28,y-28,{steps:8});await page.mouse.up()
  assert.notEqual(await art.getAttribute('transform'),before)
  report.drag=true
  const svgDl=page.waitForEvent('download')
  await page.getByRole('button',{name:'SVG',exact:true}).click()
  const svgFile=await svgDl;const svgPath=join(output,'character-imported-tattoo.svg');await svgFile.saveAs(svgPath)
  const xml=readFileSync(svgPath,'utf8')
  assert(xml.includes('data-uploaded-svg="true"')&&xml.includes('#67e2f1')&&!xml.includes('class="cls-1"')&&!xml.includes('<style')&&!xml.includes('data-editor-only'))
  report.svgExport=true
  const pngDl=page.waitForEvent('download')
  await page.getByRole('button',{name:'Export PNG'}).click()
  const pngFile=await pngDl;const pngPath=join(output,'character-imported-tattoo.png');await pngFile.saveAs(pngPath)
  const buffer=readFileSync(pngPath)
  assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a')
  assert(buffer.length>14000)
  report.pngExport=true
  const jsonDl=page.waitForEvent('download')
  await page.getByRole('button',{name:'JSON'}).click()
  const jsonFile=await jsonDl;const jsonPath=join(output,'character-imported-tattoo.json');await jsonFile.saveAs(jsonPath)
  const config=JSON.parse(readFileSync(jsonPath,'utf8')).config
  assert.equal(config.tattooLibrary.length,1)
  assert.equal(config.accessories.filter(a=>a.type==='user-svg').length,1)
  assert.equal(config.tattooLibrary[0].children[0].children[0].attrs.fill,'#ff2255')
  report.jsonExport=true
  await page.reload({waitUntil:'networkidle'})
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-type="user-svg"]').count(),1)
  report.persistence=true
  await page.getByRole('button',{name:'Select Orbit circle character'}).click()
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-type="user-svg"]').count(),1)
  report.preset=true
  await page.getByRole('button',{name:'Reset',exact:true}).click()
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-type="user-svg"]').count(),0)
  await page.getByRole('tab',{name:'Details'}).click()
  assert.equal(await page.getByRole('button',{name:'Add uploaded tattoo Illustrator Tattoo'}).count(),1)
  report.resetKeepsLibrary=true
  await page.getByRole('button',{name:'Add uploaded tattoo Illustrator Tattoo'}).click()
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-type="user-svg"]').count(),1)
  report.libraryReuse=true

  // Poison input must not become interactive HTML, executable SVG or fetches.
  const attacks=[
    ['script',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><script>alert('x')</script><path d="M0 0L80 0L80 80Z"/></svg>`],
    ['event',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path onload="alert(1)" d="M0 0L80 0L80 80Z"/></svg>`],
    ['remote',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><image href="https://example.com/data.png" width="90" height="90"/></svg>`],
    ['html',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">oops</div></foreignObject></svg>`],
    ['external-use',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><use href="https://example.com/sprite.svg#tattoo"/></svg>`],
  ]
  for(const [label,source] of attacks){
    await upload(label+'.svg',source)
    await page.locator('.cc-svg-import-error').waitFor()
    assert.equal(await page.locator('.eye-stage-avatar [data-accessory-type="user-svg"]').count(),1)
    assert.equal(await page.locator('.cc-svg-library-entry').count(),1)
    report.blockedUnsafe.push(label)
  }
  await page.setViewportSize({width:390,height:850})
  await page.screenshot({path:join(output,'character-svg-upload-mobile.png'),fullPage:true})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
  report.mobile=true
  await page.getByRole('button',{name:'Delete uploaded tattoo Illustrator Tattoo'}).click()
  assert.equal(await page.locator('.cc-svg-library-entry').count(),0)
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-type="user-svg"]').count(),0)
  report.libraryDelete=true
  const gradientSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <defs>
      <linearGradient id="g1"><stop offset="0%" stop-color="#ff6611"/><stop offset="100%" stop-color="#6600ff"/></linearGradient>
      <clipPath id="c1"><circle cx="60" cy="60" r="40"/></clipPath>
    </defs>
    <rect width="120" height="120" fill="url(#g1)" clip-path="url(#c1)"/>
  </svg>`
  await upload('Local Gradient.svg',gradientSvg)
  await page.getByText('Added "Local Gradient"').waitFor()
  const gradient=page.locator('.eye-stage-avatar [data-accessory-type="user-svg"]')
  const gradPath=await gradient.locator('rect').getAttribute('fill')
  const gradId=await gradient.locator('linearGradient').getAttribute('id')
  assert.equal(gradPath,`url(#${gradId})`)
  assert.match(await gradient.locator('rect').getAttribute('clip-path'),/^url\(#exo-tattoo-.*-c1\)$/)
  report.localGradients=true
  assert.deepEqual(report.errors,[])
  writeFileSync(join(output,'character-svg-import-qa.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify(report,null,2))
}finally{await browser.close()}
