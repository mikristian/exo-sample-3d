import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=dirname(fileURLToPath(import.meta.url))
const output=join(root,'qa')
mkdirSync(output,{recursive:true})
const url=process.env.CLOTHCRAFT_CIRCLE_URL||'http://127.0.0.1:5288/circle.html'
const results={url,desktop:false,flatBody:false,multicolorLayers:false,colorways:0,independentColors:false,eyeStyles:0,search:false,categories:false,resize:[],preset:false,customize:false,expressions:false,gaze:false,svgExport:false,pngExport:false,jsonExport:false,persistence:false,oldStudioLinked:false,errors:[]}
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-dev-shm-usage']})

try{
  const page=await browser.newPage({viewport:{width:1512,height:1000},acceptDownloads:true})
  page.on('pageerror',error=>results.errors.push(error.message))
  await page.goto(url,{waitUntil:'networkidle'})
  await page.locator('.eye-stage-avatar svg[data-circle-character]').waitFor()
  assert.equal(await page.locator('.eye-variant').count(),6)
  assert.equal(await page.locator('.eye-stage-avatar svg .circle-eye-pair > g').count(),2)
  assert.equal(await page.locator('.eye-stage-avatar svg circle[data-flat-body]').count(),1)
  assert.equal(await page.locator('.eye-stage-avatar svg').locator('radialGradient,linearGradient,filter').count(),0)
  assert.equal(await page.locator('.eye-stage-avatar svg circle[data-flat-body]').getAttribute('fill'),'#0a0a0b')
  assert.equal(await page.locator('.eye-stage-avatar svg .circle-eye-pair>g>path').count(),2)
  assert.equal(await page.locator('.eye-stage-avatar svg .circle-eye-pair g[clip-path]').count(),2,'Both eyes should have multicolor layers by default')
  for(const layer of ['eye-white','iris']){
    assert.equal(await page.locator(`.eye-stage-avatar svg [data-layer="${layer}"]`).count(),2,`${layer} must render in each eye`)
  }
  for(const layer of ['pupil','glint'])assert.equal(await page.locator(`.eye-stage-avatar svg [data-layer="${layer}"]`).count(),0,`${layer} must be off initially`)
  assert.equal(await page.locator('.eye-stage-avatar svg').getAttribute('data-eye-shape'),'display-tall')
  assert.equal(await page.locator('.eye-stage-avatar svg [data-eye-side="left"] [data-layer="eye-white"]').getAttribute('fill'),'#d2f31c')
  assert.equal(await page.locator('.eye-stage-avatar svg [data-eye-side="left"] [data-layer="iris"]').getAttribute('fill'),'#94151b')
  assert.equal(await page.locator('.eye-stage-avatar svg [data-eye-side="right"] [data-layer="iris"]').getAttribute('fill'),'#124ce9')
  results.multicolorLayers=true
  results.flatBody=true
  results.eyeStyles=await page.locator('button.eye-library-item').count()
  assert(results.eyeStyles>=60,`Expected >=60 selectable eyes; got ${results.eyeStyles}`)
  results.desktop=true
  await page.screenshot({path:join(output,'circle-eye-lab-desktop.png'),fullPage:true})
  await page.getByRole('tab',{name:'Colors'}).click()
  results.colorways=await page.getByRole('button',{name:/^Apply .* eye colorway$/}).count()
  assert.equal(results.colorways,16,'The 16 featured colorways should be visible before expansion')
  await page.getByRole('button',{name:'View all 100 colorways'}).click()
  assert.equal(await page.getByRole('button',{name:/^Apply .* eye colorway$/}).count(),100)
  await page.getByRole('button',{name:'Apply Mix 01 eye colorway'}).click()
  assert.equal(await page.locator('.eye-stage-avatar svg [data-eye-side="left"] [data-layer="eye-white"]').getAttribute('fill'),'#ff512c')
  await page.getByRole('button',{name:'Show featured colorways'}).click()
  results.colorways=100
  await page.getByRole('button',{name:'Apply Lilac eye colorway'}).click()
  assert.equal(await page.locator('.eye-stage-avatar svg [data-eye-side="right"] [data-layer="iris"]').getAttribute('fill'),'#ae80ff')
  assert.equal(await page.locator('.eye-stage-avatar svg [data-eye-side="right"] [data-layer="eye-white"]').getAttribute('fill'),'#f4e8ff')
  await page.getByRole('button',{name:'Left / right separately'}).click()
  await page.getByRole('button',{name:'Left iris #44dcd8'}).click()
  await page.getByRole('button',{name:'Right iris #645bff'}).click()
  assert.equal(await page.locator('.eye-stage-avatar svg [data-eye-side="left"] [data-layer="iris"]').getAttribute('fill'),'#44dcd8')
  assert.equal(await page.locator('.eye-stage-avatar svg [data-eye-side="right"] [data-layer="iris"]').getAttribute('fill'),'#645bff')
  await page.locator('.eye-stage').screenshot({path:join(output,'circle-eye-multicolor-independent.png')})
  results.independentColors=true
  await page.getByRole('button',{name:'Both eyes',exact:true}).click()
  await page.getByRole('tab',{name:'Eyes'}).click()
  await page.locator('button.eye-variant').filter({hasText:'Orbit'}).click()
  assert.equal(await page.locator('.eye-stage-avatar svg').getAttribute('data-eye-shape'),'display-round')
  results.preset=true
  await page.getByRole('button',{name:'Eye design Slit / Classic'}).click()
  assert.equal(await page.locator('.eye-stage-avatar svg').getAttribute('data-eye-shape'),'narrow-classic')
  results.customize=true
  await page.getByRole('searchbox',{name:'Search eye shapes'}).fill('wing')
  assert.equal(await page.locator('button.eye-library-item').count(),5)
  await page.getByRole('searchbox',{name:'Search eye shapes'}).fill('')
  results.search=true
  await page.getByRole('button',{name:'Graphic',exact:true}).click()
  assert.equal(await page.locator('button.eye-library-item').count(),25)
  await page.getByRole('button',{name:'All',exact:true}).click()
  results.categories=true
  await page.getByRole('button',{name:'Sleepy expression'}).click()
  assert.equal(await page.locator('.eye-stage-avatar svg').getAttribute('data-emotion'),'sleepy')
  await page.getByRole('button',{name:'Blink expression'}).click()
  await page.locator('.eye-stage-avatar svg.is-blinking').waitFor()
  results.expressions=true
  await page.getByRole('tab',{name:'Colors'}).click()
  await page.getByRole('button',{name:'Round',exact:true}).click()
  await page.locator('.eye-stage').scrollIntoViewIfNeeded()
  const box=await page.locator('.eye-stage-avatar').boundingBox()
  await page.mouse.move(box.x+box.width*.29,box.y+box.height*.47,{steps:6})
  await page.waitForTimeout(120)
  const before=await page.locator('.eye-stage-avatar .circle-eye-pair g[clip-path] g[transform]').first().getAttribute('transform')
  await page.mouse.move(box.x+box.width*.72,box.y+box.height*.47,{steps:6})
  await page.waitForTimeout(120)
  const after=await page.locator('.eye-stage-avatar .circle-eye-pair g[clip-path] g[transform]').first().getAttribute('transform')
  assert.notEqual(before,after,'The pupil should move with the cursor')
  results.gaze=true
  await page.getByRole('checkbox',{name:'Optional third-color pupil'}).check()
  await page.getByRole('checkbox',{name:'Optional highlight (off by default)'}).check()
  for(const layer of ['pupil','glint'])assert.equal(await page.locator(`.eye-stage-avatar svg [data-layer="${layer}"]`).count(),2)
  const svgTask=page.waitForEvent('download')
  await page.getByRole('button',{name:'SVG',exact:true}).click()
  const svgDl=await svgTask
  assert.match(svgDl.suggestedFilename(),/\.svg$/)
  await svgDl.saveAs(join(output,'EXO-Circle-Eyes-QA.svg'))
  const svgFile=readFileSync(join(output,'EXO-Circle-Eyes-QA.svg'),'utf8')
  assert(svgFile.includes('<svg')&&svgFile.includes('data-flat-body')&&!svgFile.includes('Gradient')&&!svgFile.includes('<filter'))
  for(const layer of ['eye-white','iris','pupil','glint'])assert(svgFile.includes(`data-layer="${layer}"`))
  results.svgExport=true
  const pngTask=page.waitForEvent('download')
  await page.getByRole('button',{name:'Export PNG'}).click()
  const pngDl=await pngTask
  assert.match(pngDl.suggestedFilename(),/\.png$/)
  await pngDl.saveAs(join(output,'EXO-Circle-Eyes-QA.png'))
  const pngSignature=readFileSync(join(output,'EXO-Circle-Eyes-QA.png')).subarray(0,8)
  assert.equal(pngSignature.toString('hex'),'89504e470d0a1a0a')
  results.pngExport=true
  const jsonTask=page.waitForEvent('download')
  await page.getByRole('button',{name:'JSON'}).click()
  const jsonDl=await jsonTask
  const jsonPath=join(output,'EXO-Eye-Settings-QA.json')
  await jsonDl.saveAs(jsonPath)
  const settings=JSON.parse(readFileSync(jsonPath,'utf8')).config
  assert.equal(settings.shape,'narrow-classic')
  assert.equal(settings.eyeColor,'#bb00d9')
  assert.equal(settings.irisColor,'#e8fb00')
  results.jsonExport=true
  await page.reload({waitUntil:'networkidle'})
  assert.equal(await page.locator('.eye-stage-avatar svg').getAttribute('data-eye-shape'),'narrow-classic')
  results.persistence=true
  const old=await browser.newPage()
  await old.goto('http://127.0.0.1:5288/',{waitUntil:'domcontentloaded'})
  assert.equal(await old.locator('a.eye-lab-entry[href="./circle.html"]').count(),1)
  results.oldStudioLinked=true
  await old.close()
  for(const width of [390,768,1200,1512]){
    await page.setViewportSize({width,height:850})
    await page.waitForTimeout(80)
    const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>window.innerWidth+1,stageVisible:document.querySelector('.eye-stage-avatar svg')?.getBoundingClientRect().width>100}))
    assert.equal(metrics.overflow,false,`${width}px horizontal overflow`)
    assert.equal(metrics.stageVisible,true,`${width}px stage is hidden`)
    if(width===390)await page.screenshot({path:join(output,'circle-eye-lab-mobile.png'),fullPage:true})
    results.resize.push(width)
  }
  assert.deepEqual(results.errors,[])
  console.log(JSON.stringify(results,null,2))
  writeFileSync(join(output,'circle-eye-qa-results.json'),JSON.stringify(results,null,2)+'\n')
}finally{await browser.close()}
