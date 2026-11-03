// Keep this schema small and independent of the character editor's artwork and accessories.
export const EXO_COMPANION_CHARACTER_PREFERENCES_STORAGE_KEY_20261102='exo-companion-character-preferences-20261102'
export const EXO_COMPANION_CHARACTER_MOVEMENT_OPTIONS_20261102=Object.freeze([
  {value:'roam',label:'Roam around the screen'},
  {value:'steady',label:'Stay in place'},
  {value:'gentle',label:'Gentle drifting'},
  {value:'energetic',label:'Energetic explorer'},
  {value:'pointer-follow',label:'Follow pointer'},
])
export const EXO_COMPANION_CHARACTER_ACCESSORY_OPTIONS_20261102=Object.freeze([
  {value:'none',label:'None',category:'None'},
  {value:'sigil',label:'Gothic sigil',category:'Tattoo'},
  {value:'bolt',label:'Lightning tattoo',category:'Tattoo'},
  {value:'butterfly',label:'Butterfly tattoo',category:'Tattoo'},
  {value:'star',label:'Star tattoo',category:'Tattoo'},
  {value:'diamond',label:'Diamond gem',category:'Gem'},
  {value:'opal',label:'Opal gem',category:'Gem'},
  {value:'crystal',label:'Crystal gem',category:'Gem'},
  {value:'trinity',label:'Triple crystal',category:'Gem'},
])
export const EXO_COMPANION_CHARACTER_GEM_OPTIONS_20261102=Object.freeze(['none','ruby','sapphire','emerald','amethyst'])
export const EXO_COMPANION_CHARACTER_TATTOO_OPTIONS_20261102=Object.freeze(['none','star','crescent','lightning'])
export const EXO_COMPANION_SVG_ARTWORK_LIMIT_20261102=12
export const EXO_COMPANION_SVG_ARTWORK_BYTES_20261102=160*1024
const svgTags=new Set(['g','svg','defs','path','rect','circle','ellipse','line','polygon','polyline','clipPath','linearGradient','radialGradient','stop','use'])
const svgShapes=new Set(['path','rect','circle','ellipse','line','polygon','polyline'])
const svgAttrs=new Set(['id','d','points','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','width','height','viewBox','preserveAspectRatio','transform','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','fill-rule','clip-rule','opacity','fill-opacity','stroke-opacity','display','clip-path','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','spreadMethod','href'])
const svgColor=/^(?:none|currentColor|transparent|#[0-9a-fA-F]{3,8}|[a-zA-Z]{1,25}|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\))$/
const svgRef=/^url\(\s*['"]?#[a-zA-Z_][\w.:-]{0,90}['"]?\s*\)$/
const svgNumber=/^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?(?:px|pt|mm|cm|in|%)?$/
function safeSvgAttribute(name,value){
  if(!svgAttrs.has(name)||typeof value!=='string'||value.length>14000||/[<>\\;]/.test(value))return false
  if(name==='href')return /^#[a-zA-Z_][\w.:-]{0,90}$/.test(value)
  if(name==='clip-path')return value==='none'||svgRef.test(value)
  if(['fill','stroke','stop-color'].includes(name))return svgColor.test(value)||svgRef.test(value)
  if(name==='d')return /^[\d\s.,+\-eE MmLlHhVvCcSsQqTtAaZz]*$/.test(value)
  if(['points','viewBox','stroke-dasharray'].includes(name))return /^[\d\s.,+\-eE]*$/.test(value)
  if(['transform','gradientTransform'].includes(name))return value.length<=1000&&/^(?:\s*(?:matrix|translate|scale|rotate|skewX|skewY)\s*\([\d\s.,+\-eE]*\)\s*)*$/.test(value)
  if(name==='id')return /^[a-zA-Z_][\w.:-]{0,90}$/.test(value)
  if(['x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','width','height','offset','opacity','fill-opacity','stroke-opacity','stroke-width','stroke-miterlimit','stroke-dashoffset','stop-opacity'].includes(name))return svgNumber.test(value)
  const options={'display':['inline','block','none'],'preserveAspectRatio':['none','xMinYMin','xMidYMin','xMaxYMin','xMinYMid','xMidYMid','xMaxYMid','xMinYMax','xMidYMax','xMaxYMax'],'gradientUnits':['objectBoundingBox','userSpaceOnUse'],'spreadMethod':['pad','reflect','repeat'],'fill-rule':['evenodd','nonzero'],'clip-rule':['evenodd','nonzero'],'stroke-linecap':['butt','round','square'],'stroke-linejoin':['miter','round','bevel']}
  return options[name]?.includes(value)??false
}
function normalizeSvgTree(node,state,depth=0){
  if(depth>24||!isRecord(node)||!svgTags.has(node.tag)||!isRecord(node.attrs)||!Array.isArray(node.children)||node.children.length>750)return null
  if(++state.count>750)return null
  if(svgShapes.has(node.tag))state.shapes++
  const attrs={}
  for(const [key,value] of Object.entries(node.attrs)){
    if(!safeSvgAttribute(key,value))return null
    attrs[key]=value
  }
  const children=[]
  for(const child of node.children){const safe=normalizeSvgTree(child,state,depth+1);if(!safe)return null;children.push(safe)}
  return {tag:node.tag,attrs,children}
}
function normalizeSvgArtwork(item){
  if(!isRecord(item)||!/^svg-[\w-]{1,80}$/.test(item.id)||!['tattoo','gem'].includes(item.category)||!Array.isArray(item.viewBox)||item.viewBox.length!==4||item.viewBox.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e6)||item.viewBox[2]<=0||item.viewBox[3]<=0||!Array.isArray(item.children)||item.children.length>750)return null
  const state={count:0,shapes:0},children=[]
  for(const child of item.children){const safe=normalizeSvgTree(child,state);if(!safe)return null;children.push(safe)}
  if(!state.shapes)return null
  const name=typeof item.name==='string'?item.name.replace(/[<>\x00-\x1f]/g,'').slice(0,55):'Uploaded artwork'
  const normalized={id:item.id,category:item.category,name,viewBox:[...item.viewBox],children}
  return JSON.stringify(normalized).length<=EXO_COMPANION_SVG_ARTWORK_BYTES_20261102*1.8?normalized:null
}
function normalizeSvgArtworkLibrary(raw){
  if(!Array.isArray(raw))return []
  const entries=[],ids=new Set();let total=0
  for(const candidate of raw.slice(0,EXO_COMPANION_SVG_ARTWORK_LIMIT_20261102)){
    const artwork=normalizeSvgArtwork(candidate)
    if(!artwork||ids.has(artwork.id))continue
    const size=JSON.stringify(artwork).length
    if(total+size>700000)break
    entries.push(artwork);ids.add(artwork.id);total+=size
  }
  return entries
}
/** Accepts a structured result from sanitizeSvgTattoo, never raw SVG markup. */
export function addExoCompanionSvgArtwork20261102(preferences,asset,category='tattoo'){
  const settings=normalizeExoCompanionCharacterPreferences20261102(preferences)
  if(settings.tattooLibrary.length>=EXO_COMPANION_SVG_ARTWORK_LIMIT_20261102)throw new Error('Artwork library is full (12 maximum).')
  if(!isRecord(asset)||typeof asset.markup==='string')throw new Error('Sanitize the SVG before adding artwork.')
  const used=new Set(settings.tattooLibrary.map(item=>item.id))
  let index=1
  while(used.has('svg-custom-'+index))index++
  const artwork=normalizeSvgArtwork({...asset,id:'svg-custom-'+index,category})
  if(!artwork)throw new Error('Invalid or unsafe SVG artwork.')
  const tattooLibrary=normalizeSvgArtworkLibrary([...settings.tattooLibrary,artwork])
  if(tattooLibrary.length!==settings.tattooLibrary.length+1)throw new Error('Artwork library storage limit reached.')
  return {...settings,tattooLibrary,[category==='gem'?'gemAssetId':'tattooAssetId']:artwork.id}
}
export function removeExoCompanionSvgArtwork20261102(preferences,id){
  const settings=normalizeExoCompanionCharacterPreferences20261102(preferences)
  return {...settings,tattooLibrary:settings.tattooLibrary.filter(item=>item.id!==id),tattooAssetId:settings.tattooAssetId===id?null:settings.tattooAssetId,gemAssetId:settings.gemAssetId===id?null:settings.gemAssetId}
}
export const EXO_COMPANION_CHARACTER_VOICE_OPTIONS_20261102=Object.freeze([
  {value:'auto',label:'Automatic'},
  {value:'browser',label:'System voice'},
  {value:'azure',label:'Cloud voice'},
  {value:'local',label:'Local neural'},
])
const accessoryPlacements={
  sigil:{x:302,y:139},bolt:{x:153,y:424},butterfly:{x:290,y:132},star:{x:442,y:423},
  diamond:{x:301,y:136},opal:{x:448,y:408},crystal:{x:148,y:419},trinity:{x:307,y:149},
}
export const EXO_COMPANION_CHARACTER_EYE_SHAPE_OPTIONS_20261102=Object.freeze([
  {value:'display-tall',label:'Display / Tall'},
  {value:'display-round',label:'Display / Round'},
  {value:'display-wide',label:'Display / Wide'},
  {value:'display-sleepy',label:'Display / Sleepy'},
  {value:'oval-classic',label:'Oval'},
  {value:'pill-classic',label:'Pill'},
  {value:'heart-classic',label:'Heart'},
  {value:'pixel-classic',label:'Pixel'},
  {value:'narrow-classic',label:'Slit'},
])
export const EXO_COMPANION_CHARACTER_IRIS_OPTIONS_20261102=Object.freeze([
  {value:'none',label:'None'},
  {value:'round',label:'Round'},
  {value:'diamond',label:'Diamond'},
  {value:'slit',label:'Slit'},
  {value:'square',label:'Square'},
])
const legacyShapes={oval:'oval-classic',tall:'oval-tall',pill:'pill-classic',narrow:'narrow-classic',wide:'round-wide',pixel:'pixel-classic'}
const eyeFamilies=['oval','round','pill','bean','squircle','diamond','pixel','triangle','spark','heart','narrow','wink','crescent','sleepy','droplet','wing']
const eyeModifiers=['classic','wide','tall','tilted','petite']
const knownShapes=new Set([...EXO_COMPANION_CHARACTER_EYE_SHAPE_OPTIONS_20261102.map(({value})=>value),...eyeFamilies.flatMap(family=>eyeModifiers.map(modifier=>`${family}-${modifier}`))])
const knownIrises=new Set(EXO_COMPANION_CHARACTER_IRIS_OPTIONS_20261102.map(({value})=>value))
export const EXO_COMPANION_CHARACTER_DEFAULTS_20261102=Object.freeze({
  enabled:true,
  movement:'roam',
  accessory:'none',
  gem:'none',
  tattoo:'none',
  showTitle:true,
  color:'#111317',
  eyeColor:'#d9ed74',
  irisColor:'#6c4ddc',
  leftIrisColor:'#6c4ddc',
  rightIrisColor:'#20bacc',
  eyeMode:'independent',
  eyeShape:'display-tall',
  iris:'slit',
  pupilColor:'#140712',
  pupilVisible:false,
  glint:false,
  glintColor:'#ffffff',
  tattooLibrary:[],
  tattooAssetId:null,
  gemAssetId:null,
})

const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const color=value=>typeof value==='string'&&/^#[\da-f]{6}$/i.test(value)?value.toLowerCase():null
const boolean=(value,fallback)=>typeof value==='boolean'?value:fallback

/** Parse untrusted settings, ignore unknown fields, and reject values outside the renderer's supported schema. */
export function normalizeExoCompanionCharacterPreferences20261102(raw){
  const input=isRecord(raw)?raw:{}
  const defaults=EXO_COMPANION_CHARACTER_DEFAULTS_20261102
  const output={...defaults}
  for(const field of ['enabled','showTitle','pupilVisible','glint'])output[field]=boolean(input[field],defaults[field])
  if(input.movement==='follow')output.movement='pointer-follow'
  else if(EXO_COMPANION_CHARACTER_MOVEMENT_OPTIONS_20261102.some(option=>option.value===input.movement))output.movement=input.movement
  if(Object.hasOwn(accessoryPlacements,input.accessory)||input.accessory==='none')output.accessory=input.accessory
  if(EXO_COMPANION_CHARACTER_GEM_OPTIONS_20261102.includes(input.gem))output.gem=input.gem
  if(EXO_COMPANION_CHARACTER_TATTOO_OPTIONS_20261102.includes(input.tattoo))output.tattoo=input.tattoo
  for(const field of ['color','eyeColor','irisColor','leftIrisColor','rightIrisColor','pupilColor','glintColor']){
    output[field]=color(input[field])??defaults[field]
  }
  if(input.eyeMode==='independent'||input.eyeMode==='matched')output.eyeMode=input.eyeMode
  const candidate=typeof input.eyeShape==='string'?(Object.hasOwn(legacyShapes,input.eyeShape)?legacyShapes[input.eyeShape]:input.eyeShape):null
  if(knownShapes.has(candidate))output.eyeShape=candidate
  if(knownIrises.has(input.iris))output.iris=input.iris
  output.tattooLibrary=normalizeSvgArtworkLibrary(input.tattooLibrary)
  for(const [field,category] of [['tattooAssetId','tattoo'],['gemAssetId','gem']]){
    output[field]=output.tattooLibrary.some(item=>item.id===input[field]&&item.category===category)?input[field]:null
  }
  return output
}

/** Handles localStorage strings, malformed JSON, unavailable storage and non-object input safely. */
export function parseExoCompanionCharacterPreferences20261102(serialized){
  if(typeof serialized!=='string'||serialized.length>750000)return normalizeExoCompanionCharacterPreferences20261102()
  try{return normalizeExoCompanionCharacterPreferences20261102(JSON.parse(serialized))}
  catch{return normalizeExoCompanionCharacterPreferences20261102()}
}

export function readExoCompanionCharacterPreferences20261102(storage=globalThis?.localStorage){
  try{return parseExoCompanionCharacterPreferences20261102(storage?.getItem(EXO_COMPANION_CHARACTER_PREFERENCES_STORAGE_KEY_20261102))}
  catch{return normalizeExoCompanionCharacterPreferences20261102()}
}

export function saveExoCompanionCharacterPreferences20261102(value,storage=globalThis?.localStorage){
  const settings=normalizeExoCompanionCharacterPreferences20261102(value)
  try{storage?.setItem(EXO_COMPANION_CHARACTER_PREFERENCES_STORAGE_KEY_20261102,JSON.stringify(settings))}catch{}
  return settings
}

/** Matches CircleEyes renderer's `settings` names; avoids leaking app-only settings. */
export function toExoCompanionCircleEyesSettings20261102(preferences){
  const p=normalizeExoCompanionCharacterPreferences20261102(preferences)
  const accessory=accessoryPlacements[p.accessory]
  const accessories=accessory?[{id:'companion-preset',type:p.accessory,...accessory,scale:1,rotation:0,flip:false,color:['diamond','opal','crystal','trinity'].includes(p.accessory)?'#b6dcff':'#e0edf2',secondary:'#93a3bc'}]:[]
  if(p.gem!=='none')accessories.push({id:'companion-gem',type:'diamond',x:300,y:137,scale:.82,rotation:0,flip:false,color:{ruby:'#f26479',sapphire:'#80aaff',emerald:'#54cb91',amethyst:'#ad91fb'}[p.gem],secondary:'#f9f7ff'})
  if(p.tattoo!=='none')accessories.push({id:'companion-tattoo',type:p.tattoo==='lightning'?'bolt':p.tattoo,x:146,y:412,scale:.75,rotation:0,flip:false,color:'#dde9ed',secondary:'#879caa'})
  const tattooLibrary=p.tattooLibrary
  for(const [field,category] of [['tattooAssetId','tattoo'],['gemAssetId','gem']]){
    const artwork=p.tattooLibrary.find(item=>item.id===p[field]&&item.category===category)
    if(artwork)accessories.push({id:'companion-upload-'+artwork.id,type:'user-svg',assetId:artwork.id,x:category==='gem'?300:153,y:category==='gem'?139:424,scale:.8,rotation:0,flip:false,tint:false,color:'#e0edf2'})
  }
  const settings={shape:p.eyeShape,eyeMode:p.eyeMode,iris:p.iris,accessories,tattooLibrary}
  for(const field of ['color','eyeColor','irisColor','leftIrisColor','rightIrisColor','pupilColor','pupilVisible','glint','glintColor'])settings[field]=p[field]
  return settings
}
