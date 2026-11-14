import {renderVectorArtworkDataUrl} from './techPackVectorArtwork20261031.js'

export const isTechPackVectorAsset20261031=value=>typeof value==='string'&&
  /^(?:data:image\/svg\+xml(?:;charset=[\w-]+)?(?:;base64)?[,]|\s*<svg\b)/i.test(value)

/** Display-only vector paint. The original uploaded asset remains untouched.
 * Bitmap files are returned as-is; painting bitmap pixels is not SVG editing.
 */
export function resolveTechPackArtworkSource20261031(assetSource,slot={},asset={}){
  if(!isTechPackVectorAsset20261031(assetSource))return assetSource||''
  const options={}
  const validHex=value=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value)
  if(slot.vectorFillMode==='none')options.fill='none'
  else if(slot.vectorFillMode==='color'&&validHex(slot.vectorFill))options.fill=slot.vectorFill
  if(slot.vectorStrokeMode==='none')options.stroke='none'
  else if(slot.vectorStrokeMode==='color'&&validHex(slot.vectorStroke))options.stroke=slot.vectorStroke
  if(Number.isFinite(Number(slot.vectorStrokeWidth))&&slot.vectorStrokeWidth!==''&&slot.vectorStrokeWidth!=null)
    options.strokeWidth=Number(slot.vectorStrokeWidth)
  if(slot.vectorRemoveWhite===true||/preserved source outline|saved source outline/i.test(String(asset?.name||'')))
    options.removeWhiteBackground=true
  if(slot.vectorTrimToArtwork===true||
    (slot.vectorTrimToArtwork!==false&&/technical[ -]?flat|technical[ -]?drawing|botanical|line[ -]?art|pattern/i.test(String(asset?.category||''))))
    options.trimToArtwork=true
  if(!Object.keys(options).length)return assetSource
  try{return renderVectorArtworkDataUrl(assetSource,options)}
  catch{
    // Print/asset metadata may also be composed outside WebKit. There is no
    // DOMParser in Node: keep an existing source reference visible rather than
    // silently dropping a technical drawing. Editing/paint happens in browser.
    return typeof DOMParser==='undefined'?assetSource:''
  }
}
