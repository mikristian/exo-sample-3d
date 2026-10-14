// Verify the complete SVG pack and each DOM toolbar slot's command-to-artwork
// mapping. This checks 100% SVG asset coverage, NOT pixel-exact CLO fidelity.
import assert from 'node:assert/strict'
import { chromium } from '../../music-empire-game/node_modules/playwright-core/index.mjs'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dir = join(root, 'src/assets/toolbar-icons')
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
assert.equal(manifest.uniqueCount, 47)
assert.equal(manifest.slotCount, 78)
assert.equal(manifest.files.length, manifest.uniqueCount)
assert.equal(manifest.placements.length, manifest.slotCount)
assert.equal(new Set(manifest.files.map(f=>f.id)).size, manifest.files.length)
for (const {id,file} of manifest.files) {
  const path = join(dir,file)
  assert.ok(existsSync(path), 'Missing SVG file: '+id)
  const svg=readFileSync(path,'utf8')
  assert.match(svg,/<svg[^>]+viewBox="0 0 24 24"/,'Missing viewBox: '+id)
  assert.match(svg,/(<path|<ellipse|<rect|<circle)/,'Empty SVG: '+id)
  assert.ok(!svg.includes('currentColor'), 'Standalone SVG cannot rely on inherited currentColor: '+id)
}
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
try {
  const page=await browser.newPage({viewport:{width:1530,height:950}})
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(process.env.GARMENT_UI_URL || 'http://127.0.0.1:5173/?desktop=1',{waitUntil:'networkidle'})
  const bars=[...await page.locator('.tool-rail .clo-left-3d-column > button, .tool-rail > button').all(),...await page.locator('.clo-reference-dual-bars .clo-reference-column button').all()]
  assert.equal(bars.length,manifest.placements.length)
  const rendered=[]
  for(let i=0;i<bars.length;i++){
    const actual=await bars[i].locator('img.cad-tool-icon').evaluate(img=>({id:img.dataset.iconId,loaded:img.complete&&img.naturalWidth>0,source:img.getAttribute('src'),format:img.dataset.iconFormat}))
    const expected=manifest.placements[i]
    assert.equal(actual.id,expected.id,`Wrong icon in ${expected.side} position ${expected.position}`)
    assert.equal(actual.format,'svg')
    assert.ok(actual.loaded,`Broken image in ${expected.side} position ${expected.position}`)
    rendered.push({...expected,loaded:true})
  }
  assert.deepEqual(errors,[], 'Browser JavaScript errors')
  const output=join(root,'native_app/qa/toolbar-svg-asset-coverage.json')
  mkdirSync(join(root,'native_app/qa'),{recursive:true})
  writeFileSync(output,JSON.stringify({passed:true,slots:rendered.length,uniqueAssets:manifest.uniqueCount,exactCloVerified:0,rendered},null,2)+'\n')
  console.log(JSON.stringify({passed:true,leftSlots:44,rightSlots:34,uniqueAssets:manifest.uniqueCount,loadedIcons:rendered.length,exactCloVerified:0,output},null,2))
}finally{await browser.close()}
