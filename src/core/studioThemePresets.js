// Curated, readable interface themes. Scene lighting and garment materials are
// intentionally independent of these UI colors.
const seeds = [
  // Factory Graphite uses the original neutral CLO-like grey chrome, without
  // the lavender tint that inadvertently became its default accent.
  ['graphite','Graphite','Neutrals','#c9cbcf','#262729'],['obsidian','Obsidian','Neutrals','#c5d1dd','#17191e'],
  ['slate','Slate','Neutrals','#a9c3db','#27313a'],['espresso','Espresso','Neutrals','#ecc69d','#30251f'],
  ['midnight','Midnight','Blue','#69bfea','#192333'],['ocean','Deep Ocean','Blue','#91d8e9','#142d38'],
  ['sapphire','Sapphire','Blue','#a3bbff','#1b2854'],['denim','Indigo Denim','Blue','#a9c8f5','#26384d'],
  ['cobalt','Cobalt','Blue','#abc5fc','#222e65'],['azure','Azure','Blue','#8bd8ee','#123b56'],
  ['lilac','Lilac','Purple','#d8b7f7','#32263f'],['orchid','Orchid','Purple','#e1b5ed','#402a42'],
  ['amethyst','Amethyst','Purple','#cab0ff','#30284f'],['aubergine','Aubergine','Purple','#f0acd7','#38243a'],
  ['plum','Plum Velvet','Purple','#e2b5d7','#422b42'],['violet','Violet','Purple','#bcb0ff','#30295b'],
  ['forest','Forest','Nature','#9fd5b4','#23372e'],['sage','Sage','Nature','#bfd9bd','#33453a'],
  ['moss','Moss','Nature','#b4d69e','#37402a'],['emerald','Emerald','Nature','#88e0bd','#163b32'],
  ['olive','Olive','Nature','#dfdb91','#40402a'],['jade','Jade','Nature','#a9e2d1','#1c3a37'],
  ['clay','Clay','Earth','#e9b3a3','#42312c'],['terra','Terracotta','Earth','#e7ae91','#422d26'],
  ['sandstone','Sandstone','Earth','#e8d2ae','#40362b'],['bronze','Bronze','Earth','#ecc48b','#433428'],
  ['rose','Rose','Pink','#f2b8cc','#482e3b'],['blush','Blush','Pink','#f2c5dc','#48333f'],
  ['raspberry','Raspberry','Pink','#f29ec7','#492439'],['magenta','Magenta','Pink','#f5aedf','#432449'],
  ['coral','Coral','Warm','#ffa995','#492b2c'],['amber','Amber','Warm','#f3cc91','#453323'],
  ['copper','Copper','Warm','#eeb88e','#493126'],['vermillion','Vermilion','Warm','#f4ada3','#4d2a29'],
]
const modes = [
  ['studio','Studio',0],['night','Night',-13],
]
const clamp = value => Math.max(0,Math.min(255,Math.round(value)))
const rgb = color => [1,3,5].map(index=>parseInt(color.slice(index,index+2),16))
const hex = parts => '#'+parts.map(value=>clamp(value).toString(16).padStart(2,'0')).join('')
const shade = (color,amount) => hex(rgb(color).map(value=>value+amount))
const mix = (a,b,alpha) => hex(rgb(a).map((v,i)=>v*(1-alpha)+rgb(b)[i]*alpha))
const channel = v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4}
const luminance = color=>rgb(color).map(channel).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)
export const colorContrast = (a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
function safeAccent(color,surface) {
  let result=color
  for(let i=0;i<30&&colorContrast(result,surface)<4.5;i++) result=mix(result,'#ffffff',.1)
  return result
}
export const STUDIO_THEME_PRESETS = Object.freeze(seeds.flatMap(([id,name,category,accent,base])=>modes.map(([variant,variantName,delta])=>{
  const originalGrey=id==='graphite'&&variant==='studio'
  const panel=originalGrey?'#262729':shade(base,delta+8)
  const sidebar=originalGrey?'#262729':shade(base,delta-5)
  return Object.freeze({
    id:variant==='studio'?id:`${id}-${variant}`,
    name:`${name} ${variantName}`,category,
    accent:safeAccent(accent,panel),panelColor:panel,sidebarColor:sidebar,
    textColor:originalGrey?'#e9eaec':'#f2f5f8',mutedColor:originalGrey?'#bfc1c5':'#c4cbd3',
    borderColor:originalGrey?'#47494d':mix(panel,'#ffffff',.23),
  })
})))
export const STUDIO_THEME_IDS = new Set(STUDIO_THEME_PRESETS.map(p=>p.id))
export const getStudioTheme = id=>STUDIO_THEME_PRESETS.find(theme=>theme.id===id)||STUDIO_THEME_PRESETS[0]
export const STUDIO_PANEL_FINISHES = Object.freeze([
  {id:'balanced',label:'Balanced',description:'Coordinated sidebar and Property Editor'},
  {id:'deep',label:'Deep',description:'Extra separation for object and tool panels'},
  {id:'unified',label:'Unified',description:'A single color across the interface'},
  {id:'tinted',label:'Tinted',description:'Soft accent tint for side panels'},
])
export const studioResolvedPalette = (theme,finish='balanced')=>{
  const p=typeof theme==='string'?getStudioTheme(theme):theme
  const sidebar=finish==='unified'?p.panelColor:finish==='deep'?shade(p.sidebarColor,-12):finish==='tinted'?mix(p.sidebarColor,p.accent,.12):p.sidebarColor
  const panel=finish==='deep'?shade(p.panelColor,-4):p.panelColor
  return {...p,sidebarColor:sidebar,panelColor:panel,borderColor:p.id==='graphite'&&finish==='balanced'?p.borderColor:mix(panel,'#ffffff',.24)}
}
