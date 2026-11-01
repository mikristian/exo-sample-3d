import {createBlankFramedTechPackPage,startFreshFramedTechPack} from './techPackMinimalFrame20261031.js'
import {createTechPackMiddleTemplate} from './techPackMiddleTemplates20261031.js'
import {createFramedBottomTableBox} from './techPackBottomTableTemplates20261031.js'
import {TECHPACK_PRODUCTION_PAGES,createTechPackProductionPackRecipe,getTechPackProductionPage} from './techPackProductionTemplateCatalog20261031.js'
import {resolveTechPackPages,MAX_TECHPACK_PAGES} from './techPackPageComposer.js'

/** Layout choices are presentation-only. Every pattern and factory value remains unapproved
 * until connected to and inspected against a source garment; no values are fabricated. */
const composition={
 'cover':['middle-photos-1',null],
 'technical-flats':['middle-front-back',null],
 'construction':['middle-detail-strip','stitch-seam'],
 'sewing-operations':['middle-sewing-steps','construction'],
 'detail-callouts':['middle-callouts',null],
 'pattern-inventory':['middle-pattern-pieces','pattern-cutlist'],
 'pattern-cut-plan':['middle-pattern-pieces','cutting-plan'],
 'pattern-notches':['middle-detail-strip','pattern-notches'],
 'pattern-seam-allowance':['middle-callouts','pattern-seam-allowance'],
 'pattern-grading':['middle-grade-compare','grading'],
 'measurements':['middle-measure-points','pom-spec'],
 'size-spec':['middle-measure-points','measurement-matrix'],
 'fit-comments':['middle-fit-evidence','fit-comments'],
 'fabric':['middle-fabrics','fabric-spec'],
 'colors':['middle-two-colorways','colorways'],
 'bom':['middle-material-map','bom'],
 'trim':['middle-trim-hardware','trim-labels'],
 'artwork':['middle-artwork-scale','print-artwork'],
 'print-embroidery':['middle-artwork-scale','embroidery'],
 'labels':['middle-label-placement','care-label'],
 'qc':['middle-qc-evidence','quality-control'],
 'testing':['middle-qc-evidence','wash-testing'],
 'packing':['middle-packing-steps','packing'],
 'shipping-cartons':['middle-photos-2','carton-assortment'],
 'costing':['middle-photos-1','costing'],
 'revision-history':['middle-photos-1','revision-log'],
 'reference-board':['middle-photos-6',null],
}
const slug=v=>String(v||'x').replace(/[^a-z0-9_-]/gi,'').slice(0,40)||'x'
const scopedId=(pageId,key)=>`production-${slug(pageId)}-${key}`
export const TECHPACK_PRODUCTION_PAGE_COUNT=TECHPACK_PRODUCTION_PAGES.length

/** Compose one blank production page with distinct editable visual and data regions.
 * The existing saved document is not overwritten when inserting a single page. */
export function insertProductionTechPackPage(workspace,recipeId,{
  afterId='',id='custom-production-'+slug(recipeId),source={},draft={},headerFields={}
}={}){
  const definition=getTechPackProductionPage(recipeId)
  const [middleId,tableId]=composition[recipeId]||[]
  if(!middleId)throw new RangeError('No authored middle composition for production page')
  if(resolveTechPackPages(workspace,[]).some(page=>page.id===id)||workspace?.customPages?.some(page=>page.id===id))
    throw new RangeError('Production page ID already exists')
  const options={source,draft,headerFields,title:definition.name.toUpperCase()}
  let next=createBlankFramedTechPackPage(workspace,id,afterId,[],options)
  const bottom=tableId?createFramedBottomTableBox(tableId,id,scopedId(id,'table'),
    {orientation:next.orientation,paperSize:next.paperSize}):null
  const middle=createTechPackMiddleTemplate(middleId,{
    pageId:id,bottomTop:bottom?bottom.y:591,
    orientation:next.orientation||'portrait',paperSize:next.paperSize||'Letter'})
  const boxes=[...(next.pageBoxes?.[id]||[]),...middle.pageBoxes,...(bottom?[bottom]:[])]
  next={...next,
    pageBoxes:{...next.pageBoxes,[id]:boxes},
    annotations:{...next.annotations,[id]:middle.annotations},
    pages:{...next.pages,[id]:{...next.pages[id],title:definition.name.toUpperCase(),
      subtitle:'PRODUCTION WORKSHEET · SOURCE AND FACTORY APPROVAL REQUIRED',
      description:definition.description,
      productionRecipeId:definition.id,productionCompositionId:middleId,
      notes:`TECH PACK WORKSHEET · UNAPPROVED. ${definition.description}. Insert original garment references, verify all source data, and obtain explicit signoff. Empty cells are intentionally unspecified.`}}
  }
  return next
}

/** Replace the PRESENTATION with a brand-new multi-page authoring system.
 * Previous user design pages are archived by startFreshFramedTechPack; garment
 * source data, native 2D pattern and 3D simulation are never touched. */
export function buildProductionTechPack(workspace={},packId,{source={},draft={},headerFields={}}={}){
 const pack=createTechPackProductionPackRecipe(packId)
 if(pack.pageRecipeIds.length>MAX_TECHPACK_PAGES)throw new RangeError('Too many pages in production pack')
 const firstId=`custom-production-${slug(pack.pageRecipeIds[0])}`
 let next=startFreshFramedTechPack(workspace,firstId,{source,draft,headerFields})
 // Reuse the first framed page identity rather than creating a blank extra page.
 const initial=next.pageBoxes?.[firstId]?.find(box=>box.slot?.templateRole==='shared-header')
 next={...next,customPages:[],pageOrder:[],pageBoxes:{},annotations:{},pages:{},factoryPagesHidden:true,
   sourceTemplateArchived:Boolean(initial),productionPackId:pack.id,productionPackName:pack.name}
 let afterId=''
 for(const recipeId of pack.pageRecipeIds){
   const id=`custom-production-${slug(recipeId)}`
   next=insertProductionTechPackPage(next,recipeId,{id,afterId,source,draft,headerFields})
   afterId=id
 }
 next={...next,pageOrder:pack.pageRecipeIds.map(recipeId=>`custom-production-${slug(recipeId)}`)}
 return {workspace:next,firstPage:firstId,pageCount:pack.pageRecipeIds.length}
}
