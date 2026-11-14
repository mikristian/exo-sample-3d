#!/usr/bin/env node
/** Local/private SEAGGS purchased raster fixture, not a public example asset.
 * Exercises the SAME browser alpha-removal module as Tech Pack Properties.
 */
import fs from 'node:fs'
import path from 'node:path'
import {chromium} from 'playwright-core'
import * as esbuild from 'esbuild'
import {techPackSource} from '../src/core/techPackWorkspaceModel.js'
import {renderTechPackWorkspacePrintHTML} from '../src/core/techPackWorkspacePrint.js'
import {applyTechPackMediaAssetToBox} from '../src/core/techPackMediaObjectMigration20261031.js'

const root=path.resolve('integrations/clothcraft/output/techpacks')
const base=path.join(root,'MIKRISTIAN_SEAGGS_TSHIRT_MEDIA_OBJECTS_PRIVATE_20261031')
const input=JSON.parse(fs.readFileSync(base+'.json'))
const workspace=input.draft.workspace
const original=workspace.assets.find(a=>a.id==='seaggs-private-tshirt-flat-20261031')
if(!original?.dataUrl?.startsWith('data:image/png;base64,'))throw Error('Verified purchased SEAGGS private raster asset missing')
const bundle=await esbuild.build({entryPoints:['src/core/techPackTechnicalFlatCleanup20261031.js'],bundle:true,
  write:false,format:'iife',globalName:'EXORaster',platform:'browser'})
const browser=await chromium.launch({headless:true,
  executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--disable-gpu','--no-first-run']})
let result
try{
  const page=await browser.newPage()
  await page.goto('about:blank')
  await page.addScriptTag({content:bundle.outputFiles[0].text})
  result=await page.evaluate(async src=>
    await EXORaster.prepareTechnicalFlatTransparentAsset(src,
      {enabled:true,background:'corner',tolerance:18,trim:true,padding:8}),original.dataUrl)
}finally{await browser.close()}
if(!result||result.removedPixels<1000||result.dataUrl.length>250000)throw Error('Private transparent flat validation failed')
const clean={...original,id:'seaggs-private-transparent-20261031',
  name:'SEAGGS T-shirt front/back — transparent derived reference',
  caption:'SEAGGS T-shirt front/back · transparent (raster, source preserved)',
  dataUrl:result.dataUrl,width:result.width,height:result.height,
  sourceAssetId:original.id,derived:'flat-background-removal',
  vectorStatus:'raster-only',license:'private purchased reference'}
const pageId='custom-mikristian-seaggs-reference'
const pageBoxes=workspace.pageBoxes?.[pageId]||[]
const replaced=pageBoxes.map(box=>box.assetId===original.id?
  applyTechPackMediaAssetToBox(box,clean,{width:clean.width,height:clean.height}):box)
if(!replaced.some(b=>b.assetId===clean.id))throw Error('Target T-shirt drawing not found on private page')
const revised={...workspace,
  assets:[...workspace.assets,clean],
  pageBoxes:{...workspace.pageBoxes,[pageId]:replaced},
  assetTags:{...workspace.assetTags,[clean.id]:['technical','drawing','tshirt','seaggs','transparent']}}
const draft={...input.draft,workspace:revised}
const out=base.replace('_PRIVATE_','_TRANSPARENT_PRIVATE_')
fs.writeFileSync(out+'.json',JSON.stringify({...input,draft,metadata:{
  ...input.metadata,transparencyRemovedPixels:result.removedPixels,
  sourceAssetPreserved:true,sourceVectorEditable:false}},null,2))
const native=JSON.parse(fs.readFileSync('public/saved-garments/EXO_Previous_Tshirt_preserved_20261025.garment.json'))
const source=techPackSource(null,native,true)
fs.writeFileSync(out+'.html',renderTechPackWorkspacePrintHTML(source,draft,revised,revised.assets))
console.log(JSON.stringify({privateFixture:out,removed:result.removedPixels,
  original:[original.width,original.height],derived:[clean.width,clean.height],
  pages:revised.pageOrder?.length,hasOriginal:true,hasEditedRaster:true},null,2))
