import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname,join} from 'node:path'

const root=dirname(fileURLToPath(import.meta.url));const out=join(root,'qa');mkdirSync(out,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-dev-shm-usage']})
const report={page:'http://127.0.0.1:5288/circle.html',theme:null,themes:[],designs:0,quickLooks:false,added:0,dragged:false,quickPosition:false,updatedColor:false,duplicate:false,remove:false,exportSvg:false,exportPng:false,exportJson:false,reload:false,presetKeepsDecorations:false,resetClearsDecorations:false,responsive:[],errors:[]}
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true})
  page.on('pageerror',error=>report.errors.push(error.message))
  await page.goto(report.page,{waitUntil:'networkidle'})
  await page.evaluate(()=>localStorage.removeItem('clothcraft-site-theme-v2'))
  await page.reload({waitUntil:'networkidle'})
  assert.equal(await page.locator('html').getAttribute('data-cc-theme'),'charcoal')
  assert.equal(await page.locator('.eye-controls').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(48, 48, 48)')
  report.theme='charcoal'
  const launch=page.getByRole('button',{name:/Launch App/})
  assert(await launch.isDisabled())
  const themeButton=page.getByRole('button',{name:/^Theme:/})
  await themeButton.click()
  assert.equal(await page.getByRole('button',{name:/^Use .* theme$/}).count(),16)
  await page.getByRole('button',{name:'Use White theme'}).click()
  assert.equal(await page.locator('html').getAttribute('data-cc-theme'),'white')
  assert.equal(await page.locator('.eye-controls').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(238, 238, 238)')
  report.themes.push('white')
  await themeButton.click();await page.getByRole('button',{name:'Use Olive / Bone theme'}).click()
  assert.equal(await page.locator('html').getAttribute('data-cc-theme'),'olive-bone')
  report.themes.push('olive-bone')
  await page.reload({waitUntil:'networkidle'})
  assert.equal(await page.locator('html').getAttribute('data-cc-theme'),'olive-bone')
  await themeButton.click();await page.getByRole('button',{name:'Use Charcoal theme'}).click()
  await page.getByRole('tab',{name:/Details/}).click()
  assert.equal(await page.getByRole('button',{name:/^Apply .* look$/}).count(),4)
  await page.getByRole('button',{name:'Apply Gothic look'}).click()
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-id]').count(),3)
  assert(await page.locator('.eye-stage-avatar [data-accessory-type="sigil"]').count()===1)
  await page.getByRole('button',{name:'Apply Crystalline look'}).click()
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-id]').count(),3)
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-type="trinity"]').count(),1)
  report.quickLooks=true
  await page.getByRole('button',{name:'Clear all details'}).click()
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-id]').count(),0)
  report.designs=await page.locator('.cc-accessory-choice').count()
  assert.equal(report.designs,10)
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-id]').count(),0)
  await page.getByRole('button',{name:'Add Gothic sigil'}).click()
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-id]').count(),1)
  report.added++
  await page.getByRole('button',{name:'Gemstones'}).click()
  await page.getByRole('button',{name:'Add Diamond jewel'}).click()
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-id]').count(),2)
  report.added++
  await page.getByRole('button',{name:'Piercings'}).click()
  await page.getByRole('button',{name:'Add Eyebrow hoop'}).click()
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-id]').count(),3)
  report.added++
  const selected=page.locator('.eye-stage-avatar [data-accessory-type="brow-hoop"]')
  const before=await selected.getAttribute('transform')
  await page.getByRole('button',{name:'Right cheek'}).click()
  const placed=await selected.getAttribute('transform')
  assert.notEqual(before,placed)
  assert(placed.includes('450 411'))
  report.quickPosition=true
  await page.locator('.eye-stage').scrollIntoViewIfNeeded()
  const bounds=await selected.boundingBox()
  assert(bounds?.width>5)
  const center={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2}
  await page.mouse.move(center.x,center.y)
  await page.mouse.down()
  await page.mouse.move(center.x-46,center.y-33,{steps:10})
  await page.mouse.up()
  const dragged=await selected.getAttribute('transform')
  assert.notEqual(dragged,placed,`Expected pointer drag to update geometry: ${placed}`)
  report.dragged=true
  await page.getByRole('button',{name:'DETAIL COLOR #67e2f1'}).click()
  assert.equal(await selected.locator('[data-accessory-art] path').first().getAttribute('stroke'),'#67e2f1')
  report.updatedColor=true
  await page.getByRole('button',{name:'Duplicate'}).click()
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-id]').count(),4)
  report.duplicate=true
  await page.getByRole('button',{name:'Remove',exact:true}).click()
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-id]').count(),3)
  report.remove=true
  const details=page.locator('.eye-stage')
  await details.screenshot({path:join(out,'circle-studio-with-tattoos-gems-piercings.png')})
  await page.screenshot({path:join(out,'circle-studio-clothcraft-details-desktop.png'),fullPage:true})
  const svgReady=page.waitForEvent('download')
  await page.getByRole('button',{name:'SVG',exact:true}).click()
  const svgDl=await svgReady;const svgPath=join(out,'circle-accessories-export-qa.svg');await svgDl.saveAs(svgPath)
  const svg=readFileSync(svgPath,'utf8')
  assert(svg.includes('data-accessory-type="sigil"')&&svg.includes('data-accessory-type="diamond"'))
  assert(!svg.includes('data-editor-only='),'Selection guides must not be exported')
  assert(!svg.includes('<filter')&&!svg.includes('Gradient'))
  report.exportSvg=true
  const pngReady=page.waitForEvent('download')
  await page.getByRole('button',{name:'Export PNG'}).click()
  const pngDl=await pngReady;const pngPath=join(out,'circle-accessories-export-qa.png');await pngDl.saveAs(pngPath)
  assert.equal(readFileSync(pngPath).subarray(0,8).toString('hex'),'89504e470d0a1a0a')
  report.exportPng=true
  const jsonReady=page.waitForEvent('download')
  await page.getByRole('button',{name:'JSON'}).click()
  const jsonDl=await jsonReady;const jsonPath=join(out,'circle-accessories-export-qa.json');await jsonDl.saveAs(jsonPath)
  const saved=JSON.parse(readFileSync(jsonPath,'utf8'))
  assert.equal(saved.config.accessories.length,3)
  assert(saved.config.accessories.some(item=>item.type==='brow-hoop'&&item.color==='#67e2f1'))
  report.exportJson=true
  await page.reload({waitUntil:'networkidle'})
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-id]').count(),3)
  report.reload=true
  for(const width of [390,768,1200,1440]){
    await page.setViewportSize({width,height:850})
    await page.waitForTimeout(90)
    const checks=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,svg:!!document.querySelector('.eye-stage-avatar [data-accessory-type="sigil"]')}))
    assert.equal(checks.overflow,false,`${width}px horizontal overflow`)
    assert.equal(checks.svg,true,`${width}px artwork missing`)
    if(width===390)await page.screenshot({path:join(out,'circle-studio-clothcraft-mobile.png'),fullPage:true})
    report.responsive.push(width)
  }
  await page.getByRole('button',{name:'Select Orbit circle character'}).click()
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-id]').count(),3,'Choosing a face preset should retain saved styling details')
  assert.equal(await page.locator('.eye-stage-avatar svg[data-circle-character]').getAttribute('data-eye-shape'),'display-round')
  report.presetKeepsDecorations=true
  await page.getByRole('button',{name:'Reset',exact:true}).click()
  assert.equal(await page.locator('.eye-stage-avatar [data-accessory-id]').count(),0)
  report.resetClearsDecorations=true
  assert.deepEqual(report.errors,[])
  writeFileSync(join(out,'circle-styling-qa-results.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report,null,2))
}finally{await browser.close()}
