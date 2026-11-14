import test from 'node:test'
import assert from 'node:assert/strict'
import {createBlankFramedTechPackPage,applyBlankFramedTechPackPage,MINIMAL_FRAMED_TECHPACK,
  createFramedHeaderTable,startFreshFramedTechPack,synchronizeFramedHeaderTables,restorePreviousTechPackPages,
  shouldInitializeFreshTechPack,upgradeLegacyFramedHeaders} from './techPackMinimalFrame20261031.js'
import {techPackPageLayout} from './techPackPageLayout.js'
import {resolveTechPackPages} from './techPackPageComposer.js'
import {createDefaultProject} from '../data/defaultProject.js'
import {techPackSource,TECHPACK_PAGES} from './techPackWorkspaceModel.js'
import {renderTechPackWorkspacePrintHTML} from './techPackWorkspacePrint.js'
test('one minimal page is a genuinely blank Letter page with persistent common framed header',()=>{
 const before={customPages:[],pages:{},pageBoxes:{},assets:[{id:'my-logo'}]}
 const next=createBlankFramedTechPackPage(before,'custom-seville-one','',[])
 assert.equal(next.pageBoxes['custom-seville-one'].length,1)
 assert.equal(next.pageBoxes['custom-seville-one'][0].slot.templateRole,'shared-header')
 assert.equal(next.pageBoxes['custom-seville-one'][0].slot.spreadsheetTable.columns.length,10)
 assert.equal(next.pageBoxes['custom-seville-one'][0].height,72)
 assert.equal(next.pages['custom-seville-one'].minimalFramedTemplate,true)
 assert.equal(next.assets,before.assets)
 assert.equal(next.pages['custom-seville-one'].title,'TECHNICAL DETAILS')
 assert.equal(techPackPageLayout(next,'custom-seville-one').pageStyle,'LetterPortrait')
 assert(MINIMAL_FRAMED_TECHPACK.content.y>MINIMAL_FRAMED_TECHPACK.frame.y+MINIMAL_FRAMED_TECHPACK.headerHeight)
})
test('restyling only changes the custom artboard frame and cannot erase content',()=>{
 const table={id:'tb',slot:{spreadsheetTable:{rows:[{id:'r',cells:{a:{input:'real value'}}}]}}}
 const source={customPages:[{id:'custom-seville-test'}],pageBoxes:{'custom-seville-test':[table]},
   pages:{'custom-seville-test':{title:'My sheet'}},annotations:{'custom-seville-test':[{id:'arrow'}]}}
 const next=applyBlankFramedTechPackPage(source,'custom-seville-test')
 assert.equal(next.pageBoxes['custom-seville-test'].length,2)
 assert.equal(next.pageBoxes['custom-seville-test'][1],table)
 assert.equal(next.annotations,source.annotations)
 assert.equal(next.pages['custom-seville-test'].title,'My sheet')
 assert.throws(()=>applyBlankFramedTechPackPage(source,'patterns'),/custom artboard/)
})
test('print projects one consistent header inside the frame and leaves the center blank',()=>{
 const workspace=createBlankFramedTechPackPage({},'custom-minimal-one','overview',TECHPACK_PAGES)
 const source=techPackSource(createDefaultProject(),null,false)
 const html=renderTechPackWorkspacePrintHTML(source,{brand:'OWN BRAND',sku:'TEST-01'},workspace)
 const sheet=html.match(/<section class="sheet seville custom-artboard exo-minimal-framed-print"[^]*?<\/main>/)?.[0]||''
 assert.match(sheet,/class="exo-minimal-export-frame"/)
 assert.match(sheet,/class="exo-spreadsheet-print exo-reference-header-grid"/)
 assert.match(sheet,/TECHNICAL DETAILS/)
 assert.match(sheet,/style="page:MinimalFrameLetterPortrait;--exo-page-width:816px;[^"]*--exo-page-wash:#ffffff;/)
 assert.match(html,/class="exo-minimal-export-brand">OWN BRAND/)
 assert.doesNotMatch(sheet,/Add optional|No image selected|Table templates|INSERT SAMPLE/)
 assert.doesNotMatch(sheet,/class="custom-artboard-box"/)
})
test('print hides unfilled drawing placeholders and does not lose authored images',()=>{
 const blank=createBlankFramedTechPackPage({},'custom-minimal-test','overview',TECHPACK_PAGES)
 const photo={id:'visual',title:'Technical drawing / reference',x:40,y:150,width:528,height:405,
  slot:{category:'custom',contentType:'photo',templateRole:'reference'},assetId:'asset-1'}
 const next={...blank,pageBoxes:{...blank.pageBoxes,'custom-minimal-test':[photo]}}
 const source=techPackSource(createDefaultProject(),null,false)
 const missing=renderTechPackWorkspacePrintHTML(source,{},next)
 assert.doesNotMatch(missing,/class="exo-minimal-print-reference"/)
 const withAssets=renderTechPackWorkspacePrintHTML(source,{},next,[{id:'asset-1',name:'Uploaded flat',
  dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL7SQAAAABJRU5ErkJggg=='}])
 assert.match(withAssets,/class="exo-minimal-print-reference"/)
 assert.match(withAssets,/alt="Technical drawing \/ reference"/)
})
test('one-click header editing operates on canonical authored table with source values only as snapshots',()=>{
 const table=createFramedHeaderTable({source:{name:'Garment',fabrics:[{name:'Heavy cotton'}],revision:8},
   draft:{brand:'MIKRISTIAN',sku:'MK-HD002'}})
 assert.equal(table.columns.length,10)
 assert.equal(table.rows.length,3)
 assert.equal(table.rows[0].cells[table.columns[3].id].input,'MK-HD002')
 assert.equal(table.rows[1].cells[table.columns[1].id].value,'MIKRISTIAN')
 assert.equal(table.rows[0].cells[table.columns[7].id].value,'Heavy cotton')
 assert.equal(table.rows[0].cells[table.columns[9].id].provenance.kind,'authored')
 assert.deepEqual(table.mergedCells,[{r:1,c:3,rowSpan:1,colSpan:3},{r:2,c:0,rowSpan:1,colSpan:10}])
 assert.equal(table.columns.map(c=>c.width).reduce((sum,width)=>sum+width,0),573)
})
test('start-from-scratch hides all old pages and archives the layout while preserving asset library',()=>{
 const prior={pages:{overview:{title:'Old overview'}},customPages:[{id:'custom-old',name:'Old custom'}],
   pageOrder:['overview','custom-old'],pageBoxes:{overview:[{id:'old-picture'}]},
   vectorObjects:{overview:[{id:'drawing'}]},assets:[{id:'logo-a'}],
   savedTableTemplates:[{id:'old-preset'}],cells:{overview:{'pom':'real'}}}
 const clean=startFreshFramedTechPack(prior)
 assert.equal(clean.cleanStartVersion,1)
 assert.equal(clean.factoryPagesHidden,true)
 assert.deepEqual(resolveTechPackPages(clean,TECHPACK_PAGES).map(p=>p.id),['custom-clean-start'])
 assert.equal(clean.pageBoxes['custom-clean-start'].length,1)
 assert.equal(clean.previousTechPackLayout.pageBoxes.overview[0].id,'old-picture')
 assert.equal(clean.previousTechPackLayout.cells.overview.pom,'real')
 assert.equal(clean.assets,prior.assets)
 assert.equal(clean.savedTableTemplates,prior.savedTableTemplates)
 const restored=restorePreviousTechPackPages(clean)
 assert.deepEqual(restored.pageOrder,prior.pageOrder)
 assert.equal(restored.pageBoxes.overview[0].id,'old-picture')
 assert.equal(restored.factoryPagesHidden,false)
})
test('header changes propagate to additional framed pages while section title remains page-specific',()=>{
 const first=createBlankFramedTechPackPage({factoryPagesHidden:true},'custom-head-1','',[],{draft:{brand:'MIKRISTIAN'}})
 const second=createBlankFramedTechPackPage(first,'custom-head-2','custom-head-1',[])
 const a=first.pageBoxes['custom-head-1'][0].slot.spreadsheetTable
 const b=second.pageBoxes['custom-head-2'][0].slot.spreadsheetTable
 assert.equal(b.rows[1].cells[b.columns[1].id].input,'MIKRISTIAN')
 const edited={...a,rows:a.rows.map((row,i)=>i===1?{...row,cells:{...row.cells,
   [a.columns[1].id]:{...row.cells[a.columns[1].id],input:'MY LABEL',value:'MY LABEL'}}}:row)}
 const synced=synchronizeFramedHeaderTables(second,'custom-head-1',edited)
 assert.equal(synced.pageBoxes['custom-head-2'][0].slot.spreadsheetTable.rows[1].cells[b.columns[1].id].input,'MY LABEL')
 assert.equal(synced.pageBoxes['custom-head-2'][0].slot.spreadsheetTable.rows[2].cells[b.columns[0].id].input,'TECHNICAL DETAILS')
 assert.equal(synced.pageBoxes['custom-head-2'][0].slot.spreadsheetTable.id,b.id)
})
test('first clean-start replaces the current old Tech Pack, never repeats after completion',()=>{
 const old={customPages:[{id:'custom-previous'}],pageOrder:['overview','custom-previous']}
 assert.equal(shouldInitializeFreshTechPack(old,true),true)
 assert.equal(shouldInitializeFreshTechPack(old,false),false)
 assert.equal(shouldInitializeFreshTechPack({},false),true)
 assert.equal(shouldInitializeFreshTechPack({cleanStartVersion:1},true),false)
})
test('old five-column header upgrades to reference geometry without losing user-authored fields',()=>{
 const raw=createFramedHeaderTable({draft:{brand:'MY BRAND',sku:'SKU-1'}})
 const oldColumns=raw.columns.slice(0,5)
 const labels=['SEASON','STYLE NO.','CATEGORY','FABRIC','REV.']
 const rows=[['2026 FW','SKU-1','HOODIE','COTTON','R7'],['BRAND','NAME','SIZE','MAT.','ISSUE'],
  ['MY BRAND','Design Name','S','COTTON RIB','APPROVED'],['MY OWN TITLE','','','','']]
 const old={...raw,columns:oldColumns.map((col,i)=>({...col,label:labels[i]})),
   rows:rows.map((values,i)=>({id:'old-'+i,cells:Object.fromEntries(oldColumns.map((col,c)=>[
     col.id,{input:values[c],value:values[c],origin:'authored',provenance:{kind:'authored'}}]))})),
   mergedCells:[{r:3,c:0,rowSpan:1,colSpan:5}]}
 const workspace={pageBoxes:{'custom-sheet':[{id:'old-header',
   slot:{category:'tables',templateRole:'shared-header',spreadsheetTable:old}}]}}
 const upgraded=upgradeLegacyFramedHeaders(workspace)
 assert.equal(upgraded.framedHeaderDesignVersion,2)
 const b=upgraded.pageBoxes['custom-sheet'][0],table=b.slot.spreadsheetTable
 assert.equal(b.width,560)
 assert.equal(table.columns.length,10)
 assert.equal(table.rows[0].cells[table.columns[3].id].input,'SKU-1')
 assert.equal(table.rows[1].cells[table.columns[1].id].input,'MY BRAND')
 assert.equal(table.rows[1].cells[table.columns[3].id].input,'Design Name')
 assert.equal(table.rows[2].cells[table.columns[0].id].input,'MY OWN TITLE')
 assert.equal(b.slot.legacyRevision,'R7')
 assert.equal(b.slot.legacyIssue,'APPROVED')
 assert.deepEqual(b.slot.legacyFramedHeader,old)
 assert.equal(upgradeLegacyFramedHeaders(upgraded),upgraded)
 assert.equal(workspace.pageBoxes['custom-sheet'][0].slot.spreadsheetTable,old)
})
