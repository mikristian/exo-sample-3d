import {TECHPACK_PRODUCTION_PACKS,TECHPACK_PRODUCTION_PAGES} from './techPackProductionTemplateCatalog20261031.js'
import {TECHPACK_COMPOSABLE_PAGE_TEMPLATES} from './techPackComposablePageTemplates20261031.js'

/** New template picker inventory. Existing document loading uses its original identifiers. */
export const TECHPACK_NEW_PAGE_TEMPLATES=Object.freeze(TECHPACK_PRODUCTION_PAGES.map(page=>Object.freeze({
  ...page,kind:'production-page-recipe',category:'pages',system:'production-20261031'
})))

export const TECHPACK_NEW_FULL_TEMPLATES=TECHPACK_PRODUCTION_PACKS

/** Direct objects without the legacy white/bordered placeholder frames. */
export const TECHPACK_NEW_BOX_TEMPLATES=Object.freeze([
  {id:'media-artwork',name:'Artwork / technical drawing',description:'Direct image or vector drawing with its own visible bounds',width:280,height:280,semanticRole:'artwork'},
  {id:'media-photo',name:'Reference photograph',description:'Place a photo with an editable image crop',width:280,height:210,semanticRole:'photo'},
  {id:'media-swatch',name:'Fabric or color swatch',description:'Unframed swatch, editable size and position',width:180,height:180,semanticRole:'swatch'},
  {id:'text-callout',name:'Construction callout',description:'Editable annotation beside a drawing or detail',width:250,height:110,semanticRole:'note'},
  {id:'text-factory-note',name:'Factory instructions',description:'Editable manufacturing note without decorative framing',width:320,height:120,semanticRole:'note'},
].map(entry=>Object.freeze({...entry,kind:'direct-object',category:'boxes',border:'none'})))

const allowedPages=new Set(TECHPACK_NEW_PAGE_TEMPLATES.map(item=>item.id))
const allowedPacks=new Set(TECHPACK_NEW_FULL_TEMPLATES.map(item=>item.id))
const allowedBoxes=new Set(TECHPACK_NEW_BOX_TEMPLATES.map(item=>item.id))
const compositionIds=new Set(TECHPACK_COMPOSABLE_PAGE_TEMPLATES.map(item=>item.id))

/** Apply only at the library presentation boundary; never prune persisted documents. */
export function isVisibleNewTechPackTemplate(item,category=item?.category){
  if(!item || typeof item!=='object')return false
  if(category==='pages')return item.kind==='production-page-recipe'&&allowedPages.has(item.id)
    &&compositionIds.has(item.compositionId)
  if(category==='packs')return item.kind==='production-pack-recipe'&&allowedPacks.has(item.id)
  if(category==='boxes')return item.kind==='direct-object'&&allowedBoxes.has(item.id)
  return false
}

export function getNewTechPackTemplates(category){
  if(category==='pages')return TECHPACK_NEW_PAGE_TEMPLATES
  if(category==='packs')return TECHPACK_NEW_FULL_TEMPLATES
  if(category==='boxes')return TECHPACK_NEW_BOX_TEMPLATES
  return Object.freeze([])
}
