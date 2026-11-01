// Properties bridge: keep material measurements on their source record.
export const TECHPACK_MEDIA_PALETTE=Object.freeze(['#080808','#FFFFFF','#242424','#767676','#D9D9D9','#C5B8A4','#263A53','#7C2929'])
const HEX=/^#[0-9a-f]{6}$/i
const value=(input)=>typeof input==='string'?input.trim():''
export function normalizeTechPackFillHex(input){
  const raw=value(input).replace(/^#/,'')
  if(/^[0-9a-f]{3}$/i.test(raw))return '#'+[...raw].map(c=>c+c).join('').toUpperCase()
  return /^[0-9a-f]{6}$/i.test(raw)?'#'+raw.toUpperCase():null
}
export function getLinkedFabricMedia(fabricId,fabrics=[],assets=[]){
  const fabric=fabrics.find(item=>item?.id===fabricId)||null
  if(!fabric)return null
  const texture=fabric.texture||null
  const asset=assets.find(item=>item?.id===(fabric.swatchAssetId||fabric.assetId))||null
  const metadata={}
  for(const key of ['gsm','composition','construction','thickness','width','stretchWarp','stretchWeft','finish','supplier','surfaceFamily']){
    if(fabric[key]!==undefined&&fabric[key]!==null&&fabric[key]!=='')metadata[key]=fabric[key]
  }
  const verification=fabric.verificationStatus==='verified'||fabric.labVerified===true?'verified':
    fabric.verificationStatus==='estimated'?'estimated':'unverified'
  return {id:fabric.id,name:fabric.name||fabric.id,color:HEX.test(fabric.color||'')?fabric.color:null,
    metadata,texture,asset,verification,source:fabric.source||'EXO garment fabric library'}
}
export function selectTechPackMediaAssets(assets=[],{kind='mockup',role='',tags=[]}={}){
  const categories=kind==='technical-flat'?['technical flat','reference']:kind==='fabric'?['fabric','fabric swatch']:kind==='photo'?['reference','photo','fit','construction','inspiration']:['mockup','technical flat','reference','photo','graphic']
  const required=Array.isArray(tags)?tags.map(t=>value(t).toLowerCase()).filter(Boolean):[]
  return assets.filter(item=>{
    if(!item?.id)return false
    const category=value(item.category).toLowerCase()
    const itemTags=Array.isArray(item.tags)?item.tags.map(t=>value(t).toLowerCase()):[]
    if(!categories.includes(category)&&!itemTags.includes(kind))return false
    if(required.some(tag=>!itemTags.includes(tag)))return false
    if(role&& !itemTags.includes(value(role).toLowerCase())&&item.role!==role)return false
    return true
  })
}
export function patchTechPackMediaSlot(slot={},changes={}){
  const next={...slot}
  if(Object.hasOwn(changes,'swatchHex')){
    const hex=normalizeTechPackFillHex(changes.swatchHex)
    if(hex){next.swatchHex=hex;next.swatchOverride=changes.swatchOverride!==false}
  }
  if(Object.hasOwn(changes,'swatchOverride'))next.swatchOverride=changes.swatchOverride===true
  if(Object.hasOwn(changes,'swatchStrokeMode')&&['none','color'].includes(changes.swatchStrokeMode))next.swatchStrokeMode=changes.swatchStrokeMode
  if(Object.hasOwn(changes,'swatchStrokeHex')){
    const hex=normalizeTechPackFillHex(changes.swatchStrokeHex)
    if(hex)next.swatchStrokeHex=hex
  }
  if(Object.hasOwn(changes,'swatchStrokeWidth')){
    const width=Number(changes.swatchStrokeWidth)
    if(Number.isFinite(width)&&width>=0&&width<=24)next.swatchStrokeWidth=width
  }
  if(Object.hasOwn(changes,'linkedFabricId')){
    if(typeof changes.linkedFabricId==='string'&&changes.linkedFabricId)next.linkedFabricId=changes.linkedFabricId
    else delete next.linkedFabricId
  }
  if(Object.hasOwn(changes,'linkedColorwayId')){
    if(typeof changes.linkedColorwayId==='string'&&changes.linkedColorwayId)next.linkedColorwayId=changes.linkedColorwayId
    else delete next.linkedColorwayId
  }
  if(Object.hasOwn(changes,'swatchDisplay')&&['color','photo'].includes(changes.swatchDisplay))next.swatchDisplay=changes.swatchDisplay
  if(Object.hasOwn(changes,'swatchMode')&&['color','fabric'].includes(changes.swatchMode))next.swatchMode=changes.swatchMode
  // Persist Illustrator-like paint overrides only on the placed media slot:
  // the original linked SVG remains untouched and reusable elsewhere.
  for(const kind of ['Fill','Stroke']){
    const mode='vector'+kind+'Mode',color='vector'+kind
    if(Object.hasOwn(changes,mode)&&['original','color','none'].includes(changes[mode]))next[mode]=changes[mode]
    if(Object.hasOwn(changes,color)){
      const validated=normalizeTechPackFillHex(changes[color])
      if(validated)next[color]=validated
    }
  }
  if(Object.hasOwn(changes,'vectorStrokeWidth')){
    const value=changes.vectorStrokeWidth
    if(value==null||value==='')delete next.vectorStrokeWidth
    else if(Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=50)next.vectorStrokeWidth=Number(value)
  }
  if(Object.hasOwn(changes,'vectorRemoveWhite'))next.vectorRemoveWhite=changes.vectorRemoveWhite===true
  if(Object.hasOwn(changes,'vectorTrimToArtwork'))next.vectorTrimToArtwork=changes.vectorTrimToArtwork===true
  return next
}
