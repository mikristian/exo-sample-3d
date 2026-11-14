/** Source-independent, US Letter portrait compositions (points). */
export const TECHPACK_COMPOSABLE_PAGE_SIZE = Object.freeze({width:612,height:792})
const region = (role,x,y,width,height,type=role) => ({role,type,rect:{x,y,width,height}})
const HEADER = region('header',32,28,548,64)
const FOOTER = region('footer',32,738,548,30,'note')
const catalog = [
  ['spec-sheet','Specification sheet',[HEADER,region('table',32,112,548,565),region('note',32,689,548,38),FOOTER]],
  ['color-swatches','Color swatch gallery',[HEADER,region('swatch',32,112,173,190),region('swatch',219,112,174,190),region('swatch',407,112,173,190),region('swatch',32,315,173,190),region('swatch',219,315,174,190),region('swatch',407,315,173,190),region('bottom-table',32,522,548,195,'table'),FOOTER]],
  ['fabric-swatches','Fabric swatch gallery',[HEADER,region('swatch',32,112,260,210),region('swatch',320,112,260,210),region('swatch',32,337,260,210),region('swatch',320,337,260,210),region('bottom-table',32,563,548,155,'table'),FOOTER]],
  ['references','Reference board',[HEADER,region('photo',32,112,348,340),region('photo',394,112,186,160),region('photo',394,288,186,164),region('note',32,468,548,250),FOOTER]],
  ['technical-callouts','Technical callouts',[HEADER,region('photo',32,112,346,420),region('note',393,112,187,130),region('note',393,255,187,130),region('note',393,398,187,134),region('bottom-table',32,548,548,170,'table'),FOOTER]],
  ['front-back','Front and back views',[HEADER,region('front-view',32,112,262,450,'photo'),region('back-view',318,112,262,450,'photo'),region('bottom-table',32,579,548,139,'table'),FOOTER]],
  ['logo-placement','Logo placement',[HEADER,region('photo',32,112,330,425),region('logo',379,112,201,190,'photo'),region('note',379,317,201,220),region('bottom-table',32,552,548,166,'table'),FOOTER]],
  ['fit-measurements','Fit and measurements',[HEADER,region('photo',32,112,210,310),region('table',256,112,324,440),region('note',32,438,210,114),region('bottom-table',32,568,548,150,'table'),FOOTER]],
  ['brand-cover','Brand title, table and footer',[region('header',32,35,548,130),region('photo',32,187,548,285),region('table',32,490,548,211),region('footer',32,714,548,54,'note')]],
  ['construction','Construction details',[HEADER,region('photo',32,112,280,270),region('photo',328,112,252,270),region('note',32,398,548,135),region('bottom-table',32,549,548,169,'table'),FOOTER]],
  ['bill-of-materials','Bill of materials',[HEADER,region('table',32,112,548,405),region('swatch',32,533,170,185),region('photo',216,533,170,185),region('note',400,533,180,185),FOOTER]]
]

export const TECHPACK_COMPOSABLE_PAGE_TEMPLATES = Object.freeze(catalog.map(([id,name,regions]) => Object.freeze({
  id,name,pageSize:TECHPACK_COMPOSABLE_PAGE_SIZE,regions:Object.freeze(regions.map(r=>Object.freeze({...r,rect:Object.freeze({...r.rect})})))
})))
const byId = new Map(TECHPACK_COMPOSABLE_PAGE_TEMPLATES.map(t=>[t.id,t]))
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
const object = value => value && typeof value==='object' && !Array.isArray(value) ? value : {}
const safeId = value => typeof value==='string' && /^[a-z\d_-]{1,80}$/i.test(value)
const templateFor = id => {const item=byId.get(id);if(!item)throw new RangeError(`Unknown Tech Pack page template: ${String(id)}`);return item}
const kindFor = region => region.type==='table'?'tables':region.type==='header'?'headers':'custom'
const keyFor = (role,index) => `${role}:${index}`
const roleOf = box => box?.semanticRole || box?.slot?.semanticRole || box?.role || null
const geometry = rect => ({positionMode:'absolute',...rect})
const styleFrom = style => {
  const src=object(style),out={}
  if(typeof src.lineColor==='string'&&/^#[0-9a-f]{6}$/i.test(src.lineColor))out.lineColor=src.lineColor
  if(typeof src.border==='string'&&['solid','dashed','none'].includes(src.border))out.border=src.border
  if(typeof src.headerStyle==='string')out.headerStyle=src.headerStyle.slice(0,80)
  return out
}
const assetFor = (assets,role,index) => {
  const src=object(assets)
  const candidate=src[keyFor(role,index)] ?? (index===0?src[role]:undefined)
  // Asset IDs must come from the destination document's asset library.
  return typeof candidate==='string' && safeId(candidate) ? candidate : undefined
}
const slotFor = (region,roleIndex) => ({category:kindFor(region),semanticRole:region.role,roleIndex,
  title:'',...(region.type==='table'?{headers:[],rows:[]}:{}),contentType:region.type})
const makeBox = (region,roleIndex,pageId,style,assets) => ({
  id:`composed-${pageId}-${region.role}-${roleIndex}`,semanticRole:region.role,roleIndex,
  ...geometry(region.rect),title:'',note:'',border:'none',...style,
  slot:slotFor(region,roleIndex),...(assetFor(assets,region.role,roleIndex)?{assetId:assetFor(assets,region.role,roleIndex)}:{})
})
const numbered = regions => {
  const counts=new Map()
  return regions.map(region=>{const index=counts.get(region.role)||0;counts.set(region.role,index+1);return {region,index}})
}

/** Creates editable empty boxes; optional assets are explicit destination asset IDs. */
export function createComposedTechPackPage(templateId,{pageId='custom-composed',sourceAssets={},brandStyle={}}={}){
  templateFor(templateId)
  if(!safeId(pageId))throw new TypeError('A safe pageId is required')
  const template=templateFor(templateId)
  const style=styleFrom(brandStyle)
  return {id:pageId,pageId,templateId,pageSize:{...TECHPACK_COMPOSABLE_PAGE_SIZE},
    pageBoxes:numbered(template.regions).map(({region,index})=>makeBox(region,index,pageId,style,sourceAssets))}
}

/** Recompose by role and occurrence; every existing box survives, including unknown roles.
 * Authored table cells, source links, notes, asset references and custom metadata are copied untouched.
 * An extra box without a destination region stays at its authored geometry.
 */
export function restyleComposedTechPackPage(existing,templateId,{pageId,sourceAssets={},brandStyle={}}={}){
  const template=templateFor(templateId)
  const prior=Array.isArray(existing)?existing:existing?.pageBoxes
  if(!Array.isArray(prior))throw new TypeError('Expected a pageBoxes array or composed page')
  const id=pageId ?? (Array.isArray(existing)?'custom-composed':existing.pageId||existing.id||'custom-composed')
  if(!safeId(id))throw new TypeError('A safe pageId is required')
  const style=styleFrom(brandStyle)
  const pool=new Map()
  prior.forEach((box,i)=>{
    const role=roleOf(box)
    if(!role)return
    if(!pool.has(role))pool.set(role,[])
    pool.get(role).push({box,i})
  })
  const used=new Set()
  const next=numbered(template.regions).map(({region,index})=>{
    const matches=pool.get(region.role)||[]
    const matched=matches.find(({box,i})=>!used.has(i)&&box.roleIndex===index)||matches.find(({i})=>!used.has(i))
    if(!matched)return makeBox(region,index,id,style,sourceAssets)
    used.add(matched.i)
    const original=clone(matched.box)
    return {...original,...geometry(region.rect),semanticRole:region.role,roleIndex:index,
      slot:{...object(original.slot),semanticRole:region.role,roleIndex:index}}
  })
  // Old boxes with no matching destination remain unchanged, including data and geometry.
  prior.forEach((box,i)=>{if(!used.has(i))next.push(clone(box))})
  if(Array.isArray(existing))return next
  return {...clone(existing),id,pageId:id,templateId,pageSize:{...TECHPACK_COMPOSABLE_PAGE_SIZE},pageBoxes:next}
}
