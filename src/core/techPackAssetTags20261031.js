// Persistent Notion-like labels for Tech Pack media. Tags describe search and
// placement intent; they are not an endorsement or physical factory approval.
const safeId=value=>typeof value==='string'&&/^[a-z\d_-]{1,120}$/i.test(value)
export const TECHPACK_MEDIA_TAG_SUGGESTIONS=Object.freeze([
 'front','back','side','detail','mockup','drawing','technical','pattern','fabric',
 'color','fit','sewing','trim','label','artwork','packaging','quality','inspiration'])
export function normalizeTechPackAssetTags(input){
 const tokens=Array.isArray(input)?input:String(input??'').split(/[,\n]+/)
 return [...new Set(tokens.map(value=>String(value||'').trim().toLowerCase().replace(/\s+/g,'-')
   .replace(/[^a-z0-9_-]/g,'').slice(0,32)).filter(Boolean))].slice(0,20)
}
export function getTechPackAssetTags(workspace={},assetId){
 if(!safeId(assetId))return []
 return normalizeTechPackAssetTags(workspace.assetTags?.[assetId]||[])
}
export function setTechPackAssetTags(workspace={},assetId,input){
 if(!safeId(assetId))throw Error('Invalid asset identifier')
 return {...workspace,assetTags:{...workspace.assetTags,[assetId]:normalizeTechPackAssetTags(input)}}
}
export function removeTechPackAssetTags(workspace={},assetId){
 const updated={...workspace.assetTags};delete updated[assetId]
 return {...workspace,assetTags:updated}
}
export function inferTechPackAssetTags(filename='',category='reference'){
 const normalized=String(filename||'').toLowerCase().replace(/([a-z])([0-9])/g,'$1 $2')
 const words=normalized.replace(/[^a-z0-9]+/g,' ').split(/\s+/)
 const mappings=[
  ['front',['front','frnt']],['back',['back','rear']],['side',['side','profile']],
  ['detail',['detail','closeup','zoom']],['mockup',['mockup','render']],
  ['drawing',['drawing','flat','sketch']],['pattern',['pattern','piece']],
  ['fabric',['fabric','textile','swatch']],['fit',['fit','fitting']],
  ['sewing',['seam','stitch','construction']],['trim',['trim','zipper','button']],
  ['label',['label','tag']],['artwork',['artwork','graphic','print','logo']],
  ['packaging',['packaging','packing','box','bag']],['quality',['defect','inspection','qc']]
 ]
 const tags=mappings.filter(([,aliases])=>aliases.some(alias=>words.includes(alias))).map(([name])=>name)
 const categoryTags=normalizeTechPackAssetTags(category)
 return normalizeTechPackAssetTags([...tags,...categoryTags])
}
