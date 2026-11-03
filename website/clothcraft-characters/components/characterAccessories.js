// All-original, flat vector embellishments — no raster art or 3D meshes.
import {normaliseSvgLibrary} from './svgTattooImport.jsx'
export const ACCESSORY_COLLECTION=[
  {id:'sigil',name:'Gothic sigil',category:'Tattoo',x:302,y:139,color:'#c7e4ef',secondary:'#708694'},
  {id:'bolt',name:'Lightning',category:'Tattoo',x:153,y:424,color:'#e8f4ff',secondary:'#758797'},
  {id:'star',name:'Eight-point star',category:'Tattoo',x:442,y:423,color:'#d6e9f3',secondary:'#7a8892'},
  {id:'barbed',name:'Barbed wire',category:'Tattoo',x:300,y:428,color:'#e9e9ed',secondary:'#65737d'},
  {id:'butterfly',name:'Butterfly',category:'Tattoo',x:290,y:132,color:'#d1edfa',secondary:'#7b94a3'},
  {id:'cross',name:'Cross',category:'Tattoo',x:460,y:416,color:'#edf0f2',secondary:'#647989'},
  {id:'crescent',name:'Crescent moon',category:'Tattoo',x:146,y:413,color:'#e0f2ff',secondary:'#7d9aa9'},
  {id:'serpent',name:'Serpent line',category:'Tattoo',x:308,y:439,color:'#c4e1ef',secondary:'#7d8c99'},
  {id:'heart',name:'Heart mark',category:'Tattoo',x:450,y:421,color:'#f29aab',secondary:'#7a303c'},
  {id:'rune',name:'Rune glyph',category:'Tattoo',x:306,y:134,color:'#e4e1f5',secondary:'#8176a4'},
  {id:'diamond',name:'Diamond jewel',category:'Gem',x:301,y:136,color:'#64dbfd',secondary:'#ecf9ff'},
  {id:'teardrop',name:'Teardrop gem',category:'Gem',x:145,y:398,color:'#f6a3d0',secondary:'#fff3fc'},
  {id:'trinity',name:'Triple crystals',category:'Gem',x:307,y:149,color:'#98d0ff',secondary:'#edf7ff'},
  {id:'opal',name:'Opal stud',category:'Gem',x:448,y:408,color:'#c6b0ff',secondary:'#f4eeff'},
  {id:'gemstar',name:'Star jewel',category:'Gem',x:308,y:439,color:'#b6ffc5',secondary:'#f6fff9'},
  {id:'crystal',name:'Crystal shard',category:'Gem',x:148,y:419,color:'#fbbf7f',secondary:'#fff2db'},
  {id:'brow-hoop',name:'Eyebrow hoop',category:'Piercing',x:155,y:190,color:'#e2dfd5',secondary:'#a0a3aa'},
  {id:'brow-studs',name:'Double brow studs',category:'Piercing',x:455,y:181,color:'#d9e5ed',secondary:'#8c959e'},
  {id:'hoop',name:'Silver hoop',category:'Piercing',x:468,y:384,color:'#dde4ed',secondary:'#9299a3'},
  {id:'barbell',name:'Barbell',category:'Piercing',x:150,y:393,color:'#ebd5d9',secondary:'#9a8b9a'},
  {id:'septum',name:'Horseshoe ring',category:'Piercing',x:301,y:399,color:'#e0dcf4',secondary:'#9290a6'},
  {id:'stud',name:'Single stud',category:'Piercing',x:142,y:410,color:'#f1d7a7',secondary:'#9c956f'},
  {id:'chain',name:'Tiny chain',category:'Piercing',x:451,y:401,color:'#e1eaed',secondary:'#98b1ba'},
]
export const ACCESSORY_CATEGORIES=['Tattoo','Gem','Piercing']
// Ready-to-customize looks use the same editable layers as individually added
// details — choosing one never bakes its decoration into the character art.
export const ACCESSORY_LOOKS=[
  {id:'cathedral',name:'Gothic',description:'Sigil + ornaments',items:[{type:'sigil',x:301,y:132,scale:1.1},{type:'barbed',x:301,y:431,scale:.9},{type:'brow-hoop',x:147,y:200,scale:.65}]},
  {id:'crystal',name:'Crystalline',description:'Three set jewels',items:[{type:'trinity',x:302,y:134,scale:1.05},{type:'opal',x:150,y:423,scale:.78},{type:'gemstar',x:450,y:423,scale:.73}]},
  {id:'pierced',name:'Pierced',description:'Metalwork set',items:[{type:'brow-studs',x:447,y:184,scale:.63},{type:'hoop',x:460,y:403,scale:.7},{type:'barbell',x:147,y:410,scale:.61}]},
  {id:'mixed',name:'Nightfall',description:'Tattoo + jewel + ring',items:[{type:'crescent',x:148,y:415,scale:.84},{type:'diamond',x:303,y:136,scale:.95},{type:'septum',x:453,y:412,scale:.65}]},
]
export const ACCESSORY_COLORS=['#f2f2f2','#1f1f1f','#d1d1d1','#67e2f1','#bb9af8','#ffb6cf','#f9cf75','#93edba']
const clamp=(number,min,max)=>Math.max(min,Math.min(max,number))
export const ACCESSORY_MAX=16
export function normaliseAccessories(items,library=[]){
  if(!Array.isArray(items))return []
  return items.slice(0,ACCESSORY_MAX).filter(item=>ACCESSORY_COLLECTION.some(variant=>variant.id===item?.type)||(item?.type==='user-svg'&&library.some(asset=>asset.id===item.assetId))).map((item,i)=>{
    const variant=ACCESSORY_COLLECTION.find(v=>v.id===item.type)||{id:'user-svg',x:300,y:438,color:'#f2f2f2',secondary:'#737373'}
    return {
      id:typeof item.id==='string'&&item.id.length<100?item.id:`decoration-${i}`,
      type:variant.id,
      x:clamp(Number.isFinite(Number(item.x))?Number(item.x):variant.x,85,515),
      y:clamp(Number.isFinite(Number(item.y))?Number(item.y):variant.y,85,515),
      scale:clamp(Number(item.scale)||1,.45,2.5),
      rotation:clamp(Number(item.rotation)||0,-180,180),
      color:/^#[0-9a-fA-F]{6}$/.test(item.color||'')?item.color:variant.color,
      secondary:/^#[0-9a-fA-F]{6}$/.test(item.secondary||'')?item.secondary:variant.secondary,
      flip:!!item.flip,
      ...(variant.id==='user-svg'?{assetId:item.assetId,tint:!!item.tint}:{}),
    }
  })
}
export function createAccessory(type,id){
  const variant=ACCESSORY_COLLECTION.find(item=>item.id===type)
  if(!variant)return null
  return {id,type,x:variant.x,y:variant.y,scale:1,rotation:0,color:variant.color,secondary:variant.secondary,flip:false}
}
