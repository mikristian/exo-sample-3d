/** Private mockup references are user-selected. No purchased artwork is bundled. */
export const PRIVATE_SEAGGS_TSHIRT_REFERENCE=Object.freeze({
  manifestPath:'research/techpack-library/seaggs-v2-private/seaggs-tshirt-source-manifest.json',
  previewPath:'research/techpack-library/seaggs-v2-private/seaggs-tshirt-front-back-raster-private.png',
  category:'mockup',access:'explicit-local-import',representation:'private raster reference',
})

export const TECHPACK_MOCKUP_FOLDER=Object.freeze({
  id:'mockups',name:'Mockups',uploadCategory:'mockup',categories:['mockup'],
})

const imageDataUrl=/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i
const safeId=s=>typeof s==='string'&&/^[a-z0-9_-]{1,80}$/i.test(s)

/** A caller explicitly reads a user's local file and passes its bytes. */
export function createPrivateSeaggsMockupAsset({id,dataUrl,name='Private SEAGGS T-shirt front / back'}={}){
  if(!safeId(id))throw new TypeError('Valid asset ID required')
  if(typeof dataUrl!=='string'||dataUrl.length>12_000_000||!imageDataUrl.test(dataUrl))
    throw new TypeError('Explicit local PNG/JPEG/WebP image data required')
  return {id,name,category:'mockup',dataUrl,tags:['mockup','tshirt','front','back'],
    caption:'SEAGGS T-shirt · front/back (raster preview)',
    privateSource:true,sourceRepresentation:'raster'}
}

/** Import actual PDF/Illustrator-backed SEAGGS vector shapes only after an
 * explicit private user-local source conversion, never a traced bitmap.
 * Sanitization and source provenance checks happen at the file-read boundary.
 */
export function createPrivateSeaggsVectorAsset({id,dataUrl,name='SEAGGS T-shirt flat · editable SVG'}={}){
  if(!safeId(id)||typeof dataUrl!=='string'||dataUrl.length>600000||
     !/^data:image\/svg\+xml,%3Csvg/i.test(dataUrl))
    throw new TypeError('Validated private SVG vector data required')
  return {id,name,category:'mockup',dataUrl,tags:['mockup','tshirt','front','back','svg','vector','drawing'],
    caption:name,
    privateSource:true,sourceRepresentation:'private-pdf-vector'}
}

/** Original schematic line drawing; hand-authored independently of SEAGGS. */
export function createOriginalTshirtMockupAsset({id='exo-original-tshirt-flat',view='front',stroke='#242424'}={}){
  if(!safeId(id)||!['front','back'].includes(view)||!/^#[\da-f]{6}$/i.test(stroke))throw new TypeError('Invalid mockup options')
  const neckline=view==='front'?'M116 71 Q150 115 184 71':'M116 71 Q150 88 184 71'
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="340" viewBox="0 0 300 340"><g fill="none" stroke="${stroke}" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round"><path d="M111 46 Q150 32 189 46 L238 71 283 133 244 156 210 117 210 311 90 311 90 117 56 156 17 133 62 71 Z"/><path d="${neckline}"/><path d="M90 117 L62 71 M210 117 L238 71 M90 311 L210 311"/></g></svg>`
  return {id,name:`EXO original T-shirt flat · ${view}`,category:'mockup',
    dataUrl:'data:image/svg+xml,'+encodeURIComponent(svg),tags:['mockup','tshirt',view,'drawing'],
    caption:`EXO T-shirt ${view.toUpperCase()} · editable SVG`,
    sourceRepresentation:'original-vector',width:300,height:340}
}

export function addMockupAssets(workspace,assets){
  if(!workspace||typeof workspace!=='object'||!Array.isArray(assets))throw new TypeError('Invalid workspace/assets')
  const existing=Array.isArray(workspace.assets)?workspace.assets:[]
  const ids=new Set(existing.map(asset=>asset.id))
  for(const asset of assets){
    if(!asset||!safeId(asset.id)||asset.category!=='mockup'||typeof asset.dataUrl!=='string'||ids.has(asset.id))
      throw new TypeError('Invalid or duplicate mockup asset')
    ids.add(asset.id)
  }
  if(existing.length+assets.length>60)throw new RangeError('Asset library limit reached')
  return {...workspace,assets:[...existing,...assets]}
}
