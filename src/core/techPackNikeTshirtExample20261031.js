import {startFreshFramedTechPack,createBlankFramedTechPackPage} from './techPackMinimalFrame20261031.js'
import {createTechPackMiddleTemplate} from './techPackMiddleTemplates20261031.js'
import {createFramedBottomTableBox} from './techPackBottomTableTemplates20261031.js'
import {createTechPackGalleryTable} from './techpack-spreadsheet/techPackTableGallery20261030.js'

/**
 * Editable demonstration assembled from the user's preserved T-shirt project.
 * Only panel polygons, panel/fabric/seam identifiers and graphic dimensions are
 * source evidence; all speculative production data is visibly sample-only.
 * This document is never a manufacturing release or trademark authorization.
 */
export const NIKE_TEE_DEMO_SOURCE='/saved-garments/EXO_Previous_Tshirt_preserved_20261025.garment.json'
export const NIKE_TEE_DEMO_RENDER='/techpack-demo/nike-saved-native-render.webp'
export const NIKE_TEE_DEMO_LOGO='/graphic-presets/nike-swoosh.svg'
export const NIKE_TEE_DEMO_WATERMARK='EXAMPLE ONLY — NOT FOR MANUFACTURING OR COMMERCIAL NIKE USE'

const STEP=[
  ['cover','STYLE OVERVIEW','middle-photos-1',null,'Saved native T-shirt and graphic-render reference. This is a reconstructed preview, not a certified fitting.','hero'],
  ['flats','GARMENT FLATS / VIEWS','middle-photos-3',null,'Visuals are source-reference drawings, not validated technical flat artwork.','flats'],
  ['pattern','PATTERN PIECES — FRONT & BACK','middle-photos-2','blank','Preserved front/back polygon cutline outlines; seam allowances, notches, and true production dimensions require engineering validation.','patterns'],
  ['cutlist','PATTERN CUTTING REGISTER','middle-callouts','blank','Pattern piece cut quantities and grain arrows are examples only, not approved cutting directions.','patterns'],
  ['grading','SIZE RUN / GRADE RULES','middle-photos-1','grading','Grading is illustrative; saved T-shirt source does not certify a size run.','patterns'],
  ['pom','POINTS OF MEASURE','middle-photos-2','measurement-matrix','Example numeric POM targets are not measurements taken from the preserved T-shirt.','flats'],
  ['construction','CONSTRUCTION / SEAM MAP','middle-callouts','stitch-seam','The eight saved native seam identifiers are real; stitch classes, SPI, sewing sequence and allowances are sample-only.','patterns'],
  ['fabrics','FABRIC DETAILS','middle-fabrics','fabric-spec','Saved fixture uses a Stretch Rib Knit front and Uncalibrated woven reference back. Do not treat either as a confirmed retail fabric.','hero'],
  ['colors','COLOR DETAILS','middle-color-details','colorways','White garment / black artwork is a visual demo, not an approved factory lab dip.','hero'],
  ['artwork','FRONT GRAPHIC / PLACEMENT','middle-photos-2','print-artwork','Saved Nike-logo graphic width and height are from the actual project; the placement reference is source-space, not from a verified seam/neck point.','artwork'],
  ['bom','BILL OF MATERIALS','middle-fabric-palette','bom','Supplier, weight, consumption, cost, trim and label details are not source-certified.','hero'],
  ['trims','TRIMS / LABELS / BRANDING','middle-photos-3','trim-labels','Neck, care and size labels are placeholders; no legal-compliance or trademark rights approval.','artwork'],
  ['packing','FOLDING / PACKAGING','middle-photos-2','packing','Pack material, bag, barcode and carton decisions remain unapproved examples.','hero'],
  ['qc','QUALITY CONTROL / TESTING','middle-photos-1','quality-control','This is an inspection planning example; no lab results, test signoff or factory approvals exist.','hero'],
  ['samples','SAMPLE FIT / CORRECTIONS','middle-photos-2','fit-comments','No independent physical fit evaluation has been performed on this saved simulation.','hero'],
  ['revisions','REVISIONS / FINAL HANDOFF','middle-photos-1','revision-log','Draft reference prepared for EXO template demonstration. Never submit as a released factory specification.','hero']
]

const safe=v=>String(v??'').slice(0,180)
const note=(title,detail)=>`${NIKE_TEE_DEMO_WATERMARK}. ${title}: ${detail} Source: EXO_Previous_Tshirt_preserved_20261025.garment.json. Confirm materials, cut quantities, dimensions, grading, trim artwork, compliance and approval before factory use.`
const setCell=(table,r,c,value)=>{
  if(!table?.rows?.[r]||!table?.columns?.[c])return
  const row=table.rows[r],id=table.columns[c].id,v=safe(value)
  row.cells[id]={input:v,value:v,origin:'authored',provenance:{kind:'authored',demo:true}}
}
const fillRows=(table,values)=>{values.forEach((cells,r)=>cells.forEach((v,c)=>{if(v!=null)setCell(table,r,c,v)}));return table}

export function svgPatternAsset(panel){
  const points=panel?.polygon?.points
  if(!Array.isArray(points)||points.length<3||points.length>200||
    !points.every(p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite)))return null
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1])
  const minX=Math.min(...xs),minY=Math.min(...ys)
  const dx=Math.max(.001,Math.max(...xs)-minX),dy=Math.max(.001,Math.max(...ys)-minY)
  const scale=Math.min(430/dx,370/dy)
  const path=points.map(([x,y],i)=>`${i?'L':'M'} ${(x-minX)*scale+60} ${(y-minY)*scale+42}`).join(' ')+' Z'
  const label=safe(panel.name||panel.id).replace(/[<>&"']/g,'')
  // A production-pattern drawing is geometry, not white paper. Keep strokes
  // on a transparent SVG surface; labels and factory-disclaimer metadata live
  // in the Tech Pack, not as non-editable pixels inside the outline.
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 550 470"><path d="${path}" fill="none" stroke="#111111" stroke-width="2" stroke-linejoin="round"/></svg>`
  return 'data:image/svg+xml,'+encodeURIComponent(svg)
}

function tableValues(key,source){
  const print=source.printGraphics?.find(g=>/Nike|Swoosh/i.test(g.name||''))||source.printGraphics?.[0]||{}
  const panels=source.template?.panels||[],seams=source.template?.seams||[]
  const observed=seams.map(item=>safe(item.id)).join(', ')
  const example='EXAMPLE / REVIEW'
  if(key==='pattern')return [['front','Saved source polygon','14 pts',example],['back','Saved source polygon','14 pts',example],['Grainline','Unspecified',example],['Notches','Unspecified',example]]
  if(key==='cutlist')return [['Front panel',panels[0]?.id||'front','CUT QTY TBD',example],['Back panel',panels[1]?.id||'back','CUT QTY TBD',example],['Allowances','Not established',example],['Grainline','Not established',example]]
  if(key==='grading')return [['Chest width','Flat measurement','M base',example],['Body length','HPS to hem','M base',example],['Sleeve length','Shoulder to hem','M base',example]]
  if(key==='pom')return [['POM A','Chest width','±1 cm','50','52','54','56','58'],['POM B','Body length','±1 cm','66','68','70','72','74'],['POM C','Shoulder','±0.7 cm','42','44','46','48','50'],['POM D','Sleeve','±0.7 cm','19','20','21','22','23']]
  if(key==='construction')return [['Shoulders','Save refs: shoulder-right/left','TBD','OVERLOCK EXAMPLE'],['Side seams','Saved refs: side-right/left','TBD','OVERLOCK EXAMPLE'],['Sleeve seams','4 native saved references','TBD','STITCH CLASS UNVERIFIED'],['Neckline','No approved operation','TBD','AUTHOR IN FACTORY REVIEW']]
  if(key==='fabrics')return [['Front fixture','Stretch Rib Knit','UNVERIFIED',example],['Back fixture','Uncalibrated woven reference','UNVERIFIED',example],['Manufacturing shell','100% cotton jersey · example','180 GSM · example',example],['Neck rib','Example 1×1 rib','200 GSM · example',example]]
  if(key==='colors')return [['01','White tee · preview only','#FFFFFF',example],['02','Black Swoosh · preview only','#111111',example]]
  if(key==='artwork')return [['Saved Nike Swoosh', 'Front panel','SVG PNG reference',`${Number(print.widthMm||0).toFixed(1)} mm wide`,`${Number(print.heightMm||0).toFixed(1)} mm high`, 'Native preview only','NO NIKE COMMERCIAL LICENCE'],['Saved print source position',String(print.positionMm||'unavailable'),'Native coordinates','NOT factory datum']]
  if(key==='bom')return [['01','Shell jersey · EXAMPLE','Body','White','TBD','TBD','Confirm'],['02','Neck rib · EXAMPLE','Neck','White','TBD','TBD','Confirm'],['03','Sewing thread · EXAMPLE','All seams','White','TBD','TBD','Confirm'],['04','Print · saved artwork','Front panel','Black','1 placement','Source','Trademark restricted'],['05','Care / size labels','Interior','TBD','TBD','TBD','Confirm']]
  if(key==='trims')return [['Main label','NOT APPROVED','Neck','TBD'],['Care label','NOT APPROVED','Side seam','TBD'],['Size label','NOT APPROVED','Neck','TBD'],['Hangtag','NOT APPROVED','External','TBD']]
  if(key==='packing')return [['Fold','Flat fold','Sample only'],['Bag','Recyclable polybag · example','Not approved'],['Sticker','Size and SKU · example','Not approved'],['Carton','Assortment pending','Not approved']]
  if(key==='qc')return [['Graphic placement','Inspect against native screenshot','Not independently measured','PENDING'],['Seam integrity','Factory seam test required','No test recorded','PENDING'],['Dimensional stability','Wash testing required','No test recorded','PENDING'],['Brand/legal approval','Nike logo licence required','Not licensed','BLOCKED']]
  if(key==='samples')return [['Chest / silhouette','No physical sample','Review required'],['Shoulder / sleeve','No physical sample','Review required'],['Logo placement','Preview only','Check production method']]
  if(key==='revisions')return [['EXAMPLE v0','2026-10-31','Demonstration assembled from saved EXO product','UNAPPROVED'],['Production approval','','Not signed / no commercial Nike rights']]
  return []
}

export function createNikeTshirtExampleTechPack(workspace={},savedSource={},assetData={}){
  const source=savedSource&&typeof savedSource==='object'?savedSource:{}
  const panels=source.template?.panels||[],prints=source.printGraphics||[]
  if(!Array.isArray(panels)||panels.length<2||!prints.some(p=>/Nike|Swoosh/i.test(p.name||'')))
    throw new TypeError('The preserved Nike-logo T-shirt source must contain two panel outlines and its saved graphic')
  const headerOptions={draft:{brand:'MIKRISTIAN LAB / DEMO',sku:'EXO-NIKE-TEE-REF',season:'DEMO 2026',styleName:'Nike graphic tee · archived EXO sample',category:'T-shirt'},
    source:{kind:'native',ready:true,name:safe(source.template.name),fabrics:[],grading:null,revision:'EXAMPLE v0'},
    headerFields:{brand:'MIKRISTIAN LAB · DEMO',sku:'EXO-NIKE-TEE-REF',revision:'DRAFT / NO RELEASE',season:'EXAMPLE 2026'}}
  const first='custom-nike-tee-cover'
  let next=startFreshFramedTechPack(workspace,first,headerOptions)
  const prefix='nike-tee-demo-'
  const assetIds={hero:prefix+'render',artwork:prefix+'artwork',front:prefix+'front',back:prefix+'back'}
  const demoAssets=[
    {id:assetIds.hero,name:'Saved EXO Nike tee render · private reconstruction',category:'mockup',dataUrl:assetData.render||'',caption:'Saved project state render · not live screenshot'},
    {id:assetIds.artwork,name:'Nike Swoosh example · trademark-restricted',category:'graphic',dataUrl:assetData.logo||'',caption:'Nike third-party trademark · private illustration only'},
    ...panels.slice(0,2).map((panel,i)=>({id:i?assetIds.back:assetIds.front,
      name:`${safe(panel.name)} · preserved source outline`,category:'pattern',
      dataUrl:svgPatternAsset(panel),caption:'Source polygon; allowance, physical units and cutting approval not certified'}))
  ].filter(a=>typeof a.dataUrl==='string'&&a.dataUrl.length<350000&&a.dataUrl.startsWith('data:image/'))
  const available=new Set(demoAssets.map(asset=>asset.id))
  const prevAssets=(next.assets||[]).filter(asset=>!Object.values(assetIds).includes(asset.id))
  next={...next,assets:[...prevAssets,...demoAssets],factoryPagesHidden:true,
    headerFields:{...next.headerFields,...headerOptions.headerFields},
    demoTechPack:{kind:'saved-project-example',sourceFile:NIKE_TEE_DEMO_SOURCE,
      sourceName:safe(source.template.name),sourceGraphic:prints.find(p=>/Nike|Swoosh/i.test(p.name||''))?.name,
      status:'example-only',licensed:false,createdFrom:'original source; supplemental values clearly illustrative'}}
  let last=first
  for(let i=0;i<STEP.length;i++){
    const [slug,title,middleId,bottomId,description,assetKind]=STEP[i]
    const id=`custom-nike-tee-${slug}`
    if(i)next=createBlankFramedTechPackPage(next,id,last,[],headerOptions)
    last=id
    const chosen=assetKind==='patterns'?[assetIds.front,assetIds.back]:assetKind==='flats'?
      [assetIds.hero,assetIds.front,assetIds.back]:assetKind==='artwork'?
        [assetIds.artwork,assetIds.hero]:[assetIds.hero]
    let boxes=[...(next.pageBoxes?.[id]||[])].map(box=>{
      if(box.slot?.templateRole!=='shared-header'||!box.slot?.spreadsheetTable)return box
      const table=box.slot.spreadsheetTable
      const rows=table.rows.map((row,r)=>{
        if(r!==2)return row
        const firstCol=table.columns[0].id
        return {...row,cells:{...row.cells,[firstCol]:{...row.cells[firstCol],input:title,value:title}}}
      })
      return {...box,slot:{...box.slot,spreadsheetTable:{...table,rows}}}
    })
    let bottomTop=591
    if(bottomId){
      // A low, bounded chart leaves most of the page for the visual reference.
      const tableBox=createFramedBottomTableBox(bottomId==='blank'?'blank':bottomId,id,`nike-demo-table-${slug}`)
      fillRows(tableBox.slot.spreadsheetTable,tableValues(slug,source))
      tableBox.slot.spreadsheetTable.sampleOnly=true
      tableBox.slot.spreadsheetTable.sourceLinked=false
      boxes.push(tableBox)
      bottomTop=tableBox.y
    }
    const layout=createTechPackMiddleTemplate(middleId,{pageId:id,bottomTop})
    const photoBoxes=layout.pageBoxes.filter(box=>box.slot?.contentType==='photo')
    for(let p=0;p<photoBoxes.length;p++)if(available.has(chosen[p]||chosen[0]))photoBoxes[p].assetId=chosen[p]||chosen[0]
    if(slug==='colors'){
      const swatches=layout.pageBoxes.filter(box=>box.slot?.contentType==='swatch')
      if(swatches[0])swatches[0].slot={...swatches[0].slot,swatchHex:'#ffffff',swatchLabel:'BODY WHITE · VISUAL EXAMPLE',swatchOverride:true}
      if(swatches[1])swatches[1].slot={...swatches[1].slot,swatchHex:'#111111',swatchLabel:'PRINT BLACK · VISUAL EXAMPLE',swatchOverride:true}
    }
    boxes.push(...layout.pageBoxes)
    const pages={...next.pages,[id]:{...next.pages?.[id],title,subtitle:'SAVED EXO GRAPHIC TEE / SAMPLE DOCUMENT — NOT RELEASED',
      notes:note(title,description),templateColors:{background:'#ffffff',header:'#f2f0e9',table:'#ffffff',body:'#ffffff',accent:'#222222',line:'#262626'}}}
    next={...next,pages,pageBoxes:{...next.pageBoxes,[id]:boxes},
      annotations:{...next.annotations,[id]:layout.annotations}}
  }
  next={...next,pageOrder:STEP.map(([slug])=>`custom-nike-tee-${slug}`)}
  return {workspace:next,firstPage:first,pageCount:STEP.length,
    draftPatch:{styleName:'Nike graphic tee · EXO archived reference',brand:'MIKRISTIAN LAB / DEMO',
      sku:'EXO-NIKE-TEE-REF',season:'EXAMPLE 2026',status:'draft',
      factory:'UNASSIGNED — NOT MANUFACTURING READY'}}
}
