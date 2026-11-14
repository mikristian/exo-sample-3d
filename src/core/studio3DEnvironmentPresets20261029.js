// Appearance-only 3D scene presets. These never change garment materials,
// pattern geometry, simulation settings, or the saved workspace layout.
export const STUDIO_3D_ENVIRONMENT_PRESETS_20261029 = Object.freeze([
  {id:'background',label:'3D background',options:[
    {id:'original',label:'Original',appearance:{backgroundMode:'default'},swatch:'#373941'},
    {id:'midnight',label:'Midnight',appearance:{backgroundMode:'color',studioColor:'#11151e'},swatch:'#11151e'},
    {id:'slate',label:'Slate',appearance:{backgroundMode:'color',studioColor:'#354454'},swatch:'#354454'},
    {id:'warm',label:'Warm studio',appearance:{backgroundMode:'color',studioColor:'#55483f'},swatch:'#55483f'},
  ]},
  {id:'floor',label:'3D floor',options:[
    {id:'original',label:'Original',appearance:{floorMode:'default'},swatch:'#ebebed'},
    {id:'charcoal',label:'Charcoal',appearance:{floorMode:'color',floorColor:'#2d3038'},swatch:'#2d3038'},
    {id:'concrete',label:'Concrete',appearance:{floorMode:'color',floorColor:'#91979b'},swatch:'#91979b'},
    {id:'cream',label:'Cream',appearance:{floorMode:'color',floorColor:'#e9dfce'},swatch:'#e9dfce'},
  ]},
  {id:'lighting',label:'3D lighting',options:[
    {id:'studio',label:'Studio',appearance:{environmentPreset:'studio',lightColor:'#ffffff',lightIntensity:1},swatch:'#f9f8f4'},
    {id:'softbox',label:'Softbox',appearance:{environmentPreset:'softbox',lightColor:'#f5f7ff',lightIntensity:1.15},swatch:'#d8e6ff'},
    {id:'dramatic',label:'Dramatic',appearance:{environmentPreset:'dramatic',lightColor:'#ffe0bf',lightIntensity:1.3},swatch:'#a85d37'},
    {id:'neutral',label:'Neutral',appearance:{environmentPreset:'neutral',lightColor:'#ffffff',lightIntensity:0.9},swatch:'#d0d3d6'},
  ]},
])

export function applyStudio3DEnvironmentChoice20261029(appearance={},option){
  return {...appearance,...option.appearance}
}

export function isStudio3DEnvironmentChoiceActive20261029(appearance={},group,option){
  if(group==='background')return (appearance.backgroundMode||'default')===option.appearance.backgroundMode&&
    (option.appearance.backgroundMode==='default'||appearance.studioColor===option.appearance.studioColor)
  if(group==='floor')return (appearance.floorMode||'default')===option.appearance.floorMode&&
    (option.appearance.floorMode==='default'||appearance.floorColor===option.appearance.floorColor)
  return (appearance.environmentPreset||'studio')===option.appearance.environmentPreset&&
    (appearance.lightColor||'#ffffff').toLowerCase()===option.appearance.lightColor.toLowerCase()&&
    Number(appearance.lightIntensity??1)===option.appearance.lightIntensity
}
