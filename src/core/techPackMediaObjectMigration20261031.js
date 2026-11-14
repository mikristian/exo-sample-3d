import {fittedTechPackMediaBounds} from './techPackMediaObjectGeometry20261031.js'

const validSize=value=>Number.isFinite(Number(value))&&Number(value)>0
const intrinsicOf=(asset,intrinsic)=>{
  if(validSize(intrinsic?.width)&&validSize(intrinsic?.height))return intrinsic
  if(validSize(asset?.width)&&validSize(asset?.height))return {width:asset.width,height:asset.height}
  if(validSize(asset?.naturalWidth)&&validSize(asset?.naturalHeight))return {width:asset.naturalWidth,height:asset.naturalHeight}
  return null
}
const hasAuthoredGeometry=box=>box?.mediaGeometryManual===true||box?.slot?.mediaGeometryManual===true||
  box?.geometryAuthored===true||box?.slot?.geometryAuthored===true||box?.manualGeometry===true||
  box?.slot?.manualGeometry===true||box?.transform?.authored===true||box?.slot?.transform?.authored===true

/** Reduce a photo's container to the pixels actually visible under contain.
 * Opt-in force:true is required to replace a user-authored manual rectangle.
 * The image source, caption, positioning metadata, and transforms are preserved.
 */
export function shrinkMediaBoxToArtwork(box,intrinsic,options={}){
  if(!box||typeof box!=='object')return box
  if(hasAuthoredGeometry(box)&&options?.force!==true)return box
  const source=intrinsicOf(null,intrinsic)
  if(!source)return box
  const fit=options?.fit||box?.slot?.mediaFit||'contain'
  if(fit==='cover')return box
  const bounds=fittedTechPackMediaBounds(box,source,'contain')
  if(!bounds)return box
  if(bounds.x===Number(box.x||0)&&bounds.y===Number(box.y||0)&&bounds.width===Number(box.width)&&bounds.height===Number(box.height))return box
  return {...box,x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height}
}

/** Assign an existing library asset to an editable page object.
 * A missing asset leaves the authored object untouched. The caller controls
 * persistence and can pass {force:true} as the intrinsic argument's fit request
 * through its optional fourth parameter when an explicit refit is requested.
 */
export function applyTechPackMediaAssetToBox(box,asset,intrinsic,options={}){
  if(!box||typeof box!=='object'||!asset||asset.id==null||String(asset.id)==='')return box
  const slot=box.slot&&typeof box.slot==='object'&&!Array.isArray(box.slot)?box.slot:{}
  const next={...box,assetId:asset.id,assetSrc:null,
    slot:{...slot,contentType:'photo',mediaFit:slot.mediaFit==='cover'?'cover':'contain'}}
  const source=intrinsicOf(asset,intrinsic)
  if(!source)return next
  // Legacy placeholder rectangles are automated layout intent; an explicitly
  // authored transform belongs to the designer and must not be overwritten.
  return shrinkMediaBoxToArtwork(next,source,options)
}

/** Inserting into a semantic media slot must not implicitly paint a second
 * loose page reference. Keep a separately positioned/edited artwork instance
 * when there is evidence the designer authored it intentionally.
 */
export function removeUnpositionedDuplicateMediaAsset(workspace,pageId,assetId){
  if(!workspace||!pageId||!assetId)return workspace
  const refs=workspace.pageAssets?.[pageId]
  if(!Array.isArray(refs)||!refs.includes(assetId))return workspace
  // A loose photo is *not* a duplicate merely because it lacks an authored
  // transform! Previous logic accidentally hid every newly attached image
  // on otherwise empty pages, including the private SEAGGS T-shirt flat.
  // Only suppress when this exact image is already placed in a media slot.
  const alreadyPlaced=(workspace.pageBoxes?.[pageId]||[]).some(box=>
    box?.assetId===assetId && ['photo','swatch'].includes(box?.slot?.contentType))
  if(!alreadyPlaced)return workspace
  const transform=workspace.boardObjects?.[pageId]?.['asset-'+assetId]
  if(transform&&(['x','y','scaleX','scaleY','rotation','rotate','zIndex'].some(key=>
    transform[key]!=null && Number(transform[key])!== (key==='scaleX'||key==='scaleY'?1:0))))return workspace
  return {...workspace,pageAssets:{...workspace.pageAssets,
    [pageId]:refs.filter(item=>item!==assetId)}}
}
