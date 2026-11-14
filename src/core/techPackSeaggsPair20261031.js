/** A source-faithful, two-view Illustrator/PDF SVG mockup; no raster tracing.
 * Inputs must already have passed analyzeVectorArtwork() sanitation.
 */
const numericViewBox=value=>{
  const parts=String(value||'').trim().split(/[\s,]+/).map(Number)
  if(parts.length!==4||!parts.every(Number.isFinite)||parts[2]<=0||parts[3]<=0)
    throw new TypeError('Source SVG requires a valid viewBox')
  return parts
}

export function pairSeaggsTshirtSvg(front,back){
  const sources=[front,back]
  const parsed=sources.map((value,index)=>{
    if(typeof value!=='string'||value.length>285000||!value.trim().startsWith('<svg'))throw new TypeError('Private source must be SVG')
    if(/<(?:script|foreignObject|image|iframe|use|animate|set)\b|\bon\w+\s*=|\b(?:href|src)\s*=|url\s*\(/i.test(value))throw new TypeError('External or executable SVG unsupported')
    const match=value.match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i)
    if(!match)throw new TypeError('Malformed root SVG')
    const vb=match[1].match(/\bviewBox\s*=\s*["']([^"']+)["']/i)
    const box=numericViewBox(vb?.[1])
    const paths=match[2].match(/<path\b[^>]*\/>/gi)||[]
    if(!paths.length||paths.length>1000||/<(?:svg|g|rect|text|polygon|circle|polyline|line)\b/i.test(match[2]))throw new TypeError('Only standalone private SVG paths supported')
    return {view:index===0?'front':'back',box,paths}
  })
  const first=parsed[0],second=parsed[1]
  const height=Math.max(first.box[3],second.box[3]),gap=Math.max(24,height*.06)
  const width=first.box[2]+gap+second.box[2]
  const fmt=x=>Number(x.toFixed(3))
  const content=parsed.map(({view,box,paths},index)=>{
    const x=index?first.box[2]+gap:0,y=(height-box[3])/2
    return `<g data-mockup-view="${view}" transform="translate(${fmt(x-box[0])} ${fmt(y-box[1])})">${paths.join('')}</g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(width)} ${fmt(height)}" width="${fmt(width)}" height="${fmt(height)}">${content}</svg>`
}

/** Each placement uses a distinct layer ID. The original library asset stays reusable. */
export function placeSeaggsPairInstance(workspace,source,{pageId,id,x=0,y=0}={}){
  if(!pageId||!id||!source||!/^data:image\/svg\+xml,%3Csvg/i.test(source.dataUrl||''))
    throw new TypeError('Source and distinct placement ID required')
  const exists=(workspace?.assets||[]).some(a=>a.id===id)
  if(exists)throw new TypeError('Duplicate artwork instance ID')
  const count=(workspace?.pageAssets?.[pageId]||[]).length
  if(count>=24)throw new RangeError('Maximum 24 page artwork placements')
  const placed={...source,id,name:`SEAGGS T-shirt front / back · copy ${count+1}`,caption:'',
    sourceAssetId:source.id,placementOnly:true,tags:source.tags||['mockup','tshirt','front','back']}
  const layerId='asset-'+id
  return {
    ...workspace,
    assets:[...(workspace.assets||[]),placed],
    pageAssets:{...workspace.pageAssets,[pageId]:[...(workspace.pageAssets?.[pageId]||[]),id]},
    boardObjects:{...workspace.boardObjects,[pageId]:{
      ...workspace.boardObjects?.[pageId],[layerId]:{x,y,scaleX:1,scaleY:1,zIndex:8+count}}},
  }
}
