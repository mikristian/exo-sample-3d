import {createTechPackVector} from './techPackVectorStudio.js'

// Only primitive artwork objects are offered here. Existing authored boxes and
// page snapshots are deliberately unaffected by this replacement catalog.
export const TECHPACK_OBJECT_TEMPLATES=Object.freeze([
  {id:'media-swatch',category:'boxes',name:'Color / fabric swatch',description:'Bare editable material color or fabric photograph',kind:'swatch',width:140,height:140,color:'#d9d7d2'},
  {id:'media-photo',category:'boxes',name:'Photo',description:'Direct image placement with no visible frame',kind:'photo',width:260,height:220},
  {id:'media-artwork',category:'boxes',name:'Technical drawing / artwork',description:'Transparent technical flat, mockup or SVG artwork',kind:'photo',width:280,height:300},
  {id:'text-callout',category:'boxes',name:'Callout note',description:'Editable standalone annotation',kind:'text',width:240,height:90},
  {id:'text-factory-note',category:'boxes',name:'Factory note',description:'Editable standalone production note',kind:'text',width:300,height:110},
  {id:'rectangle',category:'boxes',name:'Rectangle',description:'Editable fill and stroke geometry',kind:'vector',vectorKind:'rect',width:160,height:110},
  {id:'square',category:'boxes',name:'Square',description:'Editable square fill and stroke',kind:'vector',vectorKind:'rect',width:132,height:132},
  {id:'ellipse',category:'boxes',name:'Ellipse',description:'Editable ellipse fill and stroke',kind:'vector',vectorKind:'ellipse',width:170,height:110},
  {id:'circle',category:'boxes',name:'Circle',description:'Editable circular fill and stroke',kind:'vector',vectorKind:'ellipse',width:132,height:132},
  {id:'outline-frame',category:'boxes',name:'Outline frame',description:'Editable vector outline without an inset card',kind:'vector',vectorKind:'rect',width:240,height:160,fill:'none'},
])

const validId=value=>typeof value==='string'&&/^[a-z\d_-]{1,80}$/i.test(value)
const finite=(v,fallback)=>Number.isFinite(v)?v:fallback
const templateById=id=>TECHPACK_OBJECT_TEMPLATES.find(item=>item.id===id)

/** Returns a box for workspace.pageBoxes[pageId] or a vector for workspace.vectorObjects[pageId]. */
export function createTechPackObjectFromPreset(presetId,{id,pageId,x=70,y=125,assetId,color,pageWidth=612,pageHeight=792,orientation='portrait'}={}){
  const preset=templateById(presetId)
  if(!preset)throw new RangeError('Unknown object template')
  if(!validId(id)||!validId(pageId))throw new TypeError('Valid object and page IDs are required')
  if(!Number.isFinite(x)||!Number.isFinite(y))throw new TypeError('Object position must be finite')
  if(assetId!==undefined&&!validId(assetId))throw new TypeError('Invalid asset ID')
  if(color!==undefined&&!/^#[\da-f]{6}$/i.test(color))throw new TypeError('Invalid color')
  if(!['portrait','landscape'].includes(orientation)||!Number.isFinite(pageWidth)||!Number.isFinite(pageHeight)||pageWidth<=0||pageHeight<=0)throw new TypeError('Invalid artboard geometry')
  const left=Math.max(0,Math.min(x,Math.max(0,pageWidth-preset.width)))
  const top=Math.max(0,Math.min(y,Math.max(0,pageHeight-preset.height)))
  if(preset.kind==='vector'){
    const vector=createTechPackVector(preset.vectorKind,{x:left,y:top,width:preset.width,height:preset.height},id)
    return {collection:'vectorObjects',object:{...vector,name:preset.name,fill:color||preset.fill||'none',stroke:preset.fill==='none'?'#171717':'none',strokeWidth:preset.fill==='none'?1.5:0}}
  }
  if(preset.kind==='text'){
    const vector=createTechPackVector('text',{x:left,y:top,width:preset.width,height:preset.height},id)
    return {collection:'vectorObjects',object:{...vector,name:preset.name,text:preset.name,fill:color||'#171717',fontSize:15}}
  }
  const swatch=preset.kind==='swatch'
  const box={id,positionMode:'absolute',x:left,y:top,width:preset.width,height:preset.height,
    title:'',note:'',border:'solid',lineColor:'transparent',
    slot:{category:'boxes',contentType:swatch?'swatch':'photo',templateRole:'object-artwork',
      placeholder:!swatch&&!assetId,sourceLinked:false,
      ...(swatch?{swatchHex:color||preset.color,swatchOverride:true,swatchLabel:''}:{})},
    ...(assetId?{assetId}:{})}
  return {collection:'pageBoxes',object:box}
}

/** Immutable insertion helper matching TechPackWorkspace's page-keyed storage. */
export function insertTechPackObjectPreset(workspace,presetId,{id,pageId,x,y,assetId,color,pageWidth,pageHeight,orientation}={}){
  if(!workspace||typeof workspace!=='object')throw new TypeError('Workspace required')
  const {collection,object}=createTechPackObjectFromPreset(presetId,{id,pageId,x,y,assetId,color,pageWidth,pageHeight,orientation})
  const existing=workspace[collection]?.[pageId]||[]
  if(!Array.isArray(existing))throw new TypeError('Invalid page object collection')
  if(existing.some(item=>item.id===id))throw new Error('Duplicate object ID')
  const limit=collection==='pageBoxes'?24:250
  if(existing.length>=limit)throw new RangeError('Page object limit reached')
  return {...workspace,[collection]:{...workspace[collection],[pageId]:[...existing,object]}}
}
