import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {renderTechPackWorkspacePrintHTML} from './techPackWorkspacePrint.js'
import {createNikeTshirtExampleTechPack} from './techPackNikeTshirtExample20261031.js'
import {techPackSource} from './techPackWorkspaceModel.js'
const native=JSON.parse(fs.readFileSync(new URL('../../public/saved-garments/EXO_Previous_Tshirt_preserved_20261025.garment.json',import.meta.url)))
const source=techPackSource(null,native,true)
const base=createNikeTshirtExampleTechPack({orientation:'portrait',paperSize:'Letter'},native).workspace
const print=(paperSize,orientation,background)=>renderTechPackWorkspacePrintHTML(source,{brand:'Demo',status:'draft'},
  {...base,paperSize,orientation,templateColors:{background},
    pages:Object.fromEntries(Object.entries(base.pages).map(([k,v])=>[k,{...v,templateColors:{...v.templateColors,background}}]))},[])
test('custom page print background uses true authored paper color and legible ink',()=>{
 const html=print('Letter','portrait','#222222')
 assert.match(html,/page:MinimalFrameLetterPortrait;--exo-page-width:816px/)
 assert.match(html,/--exo-page-wash:#222222/)
 assert.match(html,/--exo-page-ink:#ffffff/)
 assert.match(html,/print-color-adjust:exact/)
})
test('A4 and landscape emit exact physical page types with responsive geometry',()=>{
 const a4=print('A4','portrait','#e5d6be')
 assert.match(a4,/page:MinimalFrameA4Portrait/)
 assert.match(a4,/--exo-artboard-width:595px;--exo-artboard-height:842px/)
 assert.match(a4,/@page MinimalFrameA4Portrait\{size:A4 portrait;margin:0\}/)
 const landscape=print('Letter','landscape','#ffffff')
 assert.match(landscape,/page:MinimalFrameLetterLandscape/)
 assert.match(landscape,/--exo-artboard-width:792px;--exo-artboard-height:612px/)
 const a4Landscape=print('A4','landscape','#ffffff')
 assert.match(a4Landscape,/page:MinimalFrameA4Landscape/)
 assert.match(a4Landscape,/--exo-artboard-width:842px;--exo-artboard-height:595px/)
})
