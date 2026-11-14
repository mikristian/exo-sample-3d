#!/usr/bin/env node
/** Rebuild a local, private EXO example Tech Pack from the archived native T-shirt.
 * Never marks production measurements, factory approval or Nike rights as true.
 * Runs without opening or changing the user's currently edited garment project.
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createNikeTshirtExampleTechPack,NIKE_TEE_DEMO_SOURCE} from '../src/core/techPackNikeTshirtExample20261031.js'
import {techPackSource} from '../src/core/techPackWorkspaceModel.js'
import {renderTechPackWorkspacePrintHTML} from '../src/core/techPackWorkspacePrint.js'

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const outDir=path.join(repo,'integrations/clothcraft/output/techpacks')
fs.mkdirSync(outDir,{recursive:true})
const saved=JSON.parse(fs.readFileSync(path.join(repo,'public/saved-garments/EXO_Previous_Tshirt_preserved_20261025.garment.json')))
const render='data:image/webp;base64,'+fs.readFileSync(path.join(repo,'public/techpack-demo/nike-saved-native-render.webp')).toString('base64')
const svg=fs.readFileSync(path.join(repo,'public/graphic-presets/nike-swoosh.svg'),'utf8').replace(/^\s*<\?xml[^>]*\?>\s*/i,'').trim()
const logo='data:image/svg+xml,'+encodeURIComponent(svg)
const {workspace,draftPatch,pageCount}=createNikeTshirtExampleTechPack({orientation:'portrait',paperSize:'Letter'},saved,{render,logo})
const native={kind:'exo-native-techpack-v2',version:2,draft:{...draftPatch,workspace},
  samples:[],metadata:{source:NIKE_TEE_DEMO_SOURCE,privateDemo:true,
    notFactoryApproved:true,logoRights:'Nike trademark; not licensed for manufacture, sale or promotion'}}
const base=path.join(outDir,'NIKE_GRAPHIC_TEE_EXO_MOCK_TECHPACK_20261031')
fs.writeFileSync(base+'.json',JSON.stringify(native,null,2))
const source=techPackSource(null,saved,true)
const assets=workspace.assets.map(x=>({...x,_src:x.dataUrl,_source:'assets'}))
const html=renderTechPackWorkspacePrintHTML(source,native.draft,native.draft.workspace,assets)
fs.writeFileSync(base+'.html',html)
if(process.argv.includes('--pdf')){
  // Only opt in on a desktop with Chrome + Playwright-Core installed.
  const {chromium}=await import('playwright-core')
  const binary=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const browser=await chromium.launch({headless:true,executablePath:binary,args:['--disable-gpu','--no-first-run','--no-default-browser-check']})
  try{
    const page=await browser.newPage({viewport:{width:1100,height:900}})
    await page.goto(pathToFileURL(base+'.html').href,{waitUntil:'load',timeout:25000})
    await page.emulateMedia({media:'print'})
    const stats=await page.evaluate(()=>({sheets:document.querySelectorAll('.sheet').length,brokenImages:[...document.images].filter(x=>!x.complete||!x.naturalWidth).length}))
    if(stats.sheets!==pageCount||stats.brokenImages)throw Error('Tech Pack print image/sheet validation failed: '+JSON.stringify(stats))
    await page.pdf({path:base+'.pdf',preferCSSPageSize:true,printBackground:true,timeout:70000})
  }finally{await browser.close()}
}
console.log(JSON.stringify({source:NIKE_TEE_DEMO_SOURCE,pageCount,json:base+'.json',html:base+'.html',
  ...(process.argv.includes('--pdf')?{pdf:base+'.pdf'}:{}),previewImageCount:assets.length},null,2))
