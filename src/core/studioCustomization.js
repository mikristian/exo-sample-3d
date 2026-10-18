import {CLO7_3D_A,CLO7_3D_B,CLO7_2D_A,CLO7_2D_B} from '../data/clo7ToolbarOrder.js'
import {STUDIO_THEME_IDS,getStudioTheme,STUDIO_PANEL_FINISHES,studioResolvedPalette} from './studioThemePresets.js'
import {EXO_LEFT_EXTRA_IDS,EXO_RIGHT_EXTRA_IDS} from './exoExtraToolCatalog.js'
import {DEFAULT_CLO_SETTINGS,normalizeCloSettings} from './cloSettingsDefaults.js'

export const STUDIO_CUSTOMIZATION_KEY = 'exo.studioCustomization.v1'
export const STUDIO_SIDE_TOOL_CATALOG = Object.freeze([
  ...[...CLO7_3D_A,...CLO7_3D_B].map(slot=>({id:`3d:${slot.id}`,label:slot.label,group:'left'})),
  ...[...CLO7_2D_A,...CLO7_2D_B].map(slot=>({id:`2d:${slot.id}`,label:slot.label,group:'right'})),
])
export const DEFAULT_LEFT_TOOL_IDS = Object.freeze(STUDIO_SIDE_TOOL_CATALOG.filter(t=>t.group==='left').map(t=>t.id))
export const DEFAULT_RIGHT_TOOL_IDS = Object.freeze(STUDIO_SIDE_TOOL_CATALOG.filter(t=>t.group==='right').map(t=>t.id))

export const STUDIO_TOOL_CATALOG = Object.freeze([
  {id:'select',label:'Select',group:'2d',icon:'mouse-pointer-2'},
  {id:'point',label:'Edit Point',group:'2d',icon:'pen-tool'},
  {id:'sew',label:'Segment Sewing',group:'2d',icon:'scissors'},
  {id:'move3d',label:'Move 3D',group:'3d',icon:'move-3d'},
  {id:'rotate3d',label:'Rotate 3D',group:'3d',icon:'rotate-3d'},
  {id:'simulate',label:'Simulate',group:'3d',icon:'play'},
  {id:'reset',label:'Reset Arrangement',group:'3d',icon:'rotate-ccw'},
  {id:'grid',label:'Toggle Grid',group:'view',icon:'grid-3x3'},
  {id:'seams',label:'Toggle Seams',group:'view',icon:'waypoints'},
  {id:'library',label:'Library',group:'panels',icon:'library'},
  {id:'properties',label:'Properties',group:'panels',icon:'sliders-horizontal'},
  {id:'save',label:'Save',group:'file',icon:'save'},
  {id:'fit',label:'Fit View',group:'view',icon:'maximize'},
  {id:'zipper',label:'Zipper Browser',group:'extra tools',icon:'move-horizontal'},
  {id:'trim',label:'Trim Browser',group:'extra tools',icon:'scissors'},
  {id:'foam-padding',label:'Foam Padding / Trapunto',group:'extra tools',icon:'layers-3'}
])

export const DEFAULT_STUDIO_CUSTOMIZATION = Object.freeze({
  version:1,
  appearance:{theme:'graphite',panelFinish:'balanced',liquidGlass:false,glassBackdrop:'#253d57',glassDensity:'balanced',glassBlur:'smooth',glassIconColor:'adaptive',glassLibrary:true,glassInspector:true,glassToolbars:true,glassMenu:true,glassWidgets:false,accent:getStudioTheme('graphite').accent,sidebarColor:getStudioTheme('graphite').sidebarColor,panelColor:getStudioTheme('graphite').panelColor,studioColor:'#373941',backgroundMode:'default',environmentPreset:'studio',lightColor:'#ffffff',lightIntensity:1,lightPositionX:2.5,lightPositionY:4.5,lightPositionZ:3.1},
  profile:{displayName:'',brandName:'',bio:'',avatarDataUrl:'',logoDataUrl:''},
  workspace:{toolbarVisible:false,toolbarDock:'left',toolbarPosition:{x:24,y:95},toolbarIds:['select','point','sew','move3d','rotate3d','simulate','grid','save'],toolbarCompact:false,toolbarEditMode:false,leftToolbarDock:'left',rightToolbarDock:'right',leftToolbarPosition:{x:0,y:0},rightToolbarPosition:{x:0,y:0},leftToolbarIds:[...DEFAULT_LEFT_TOOL_IDS],rightToolbarIds:[...DEFAULT_RIGHT_TOOL_IDS],extraLeftToolIds:[],extraRightToolIds:[],panelOrder:'standard',libraryWidth:240,inspectorWidth:350,objectBrowserHeight:350,viewportLayout:'split',viewportSplit:50,topTabsVisible:true,objectBrowserVisible:true},
  preferences:{language:'en',units:'mm',graphicsQuality:'high',antialias:true,viewControls:'clo',shortcutsPreset:'clo',showGrid:true,showGuides:true,autoSave:true,defaultFolder:'',apiBaseUrl:''},
  plugins:{enableLocalTools:true,enableAssetBridge:false},
  cloSettings:DEFAULT_CLO_SETTINGS
})

const palettes=[...STUDIO_THEME_IDS]
const choices=(value,allowed,fallback)=>allowed.includes(value)?value:fallback
const short=(value,max=120)=>typeof value==='string'?value.slice(0,max):''
const hex=(value,fallback)=>typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value)?value:fallback
const bool=(value,fallback)=>typeof value==='boolean'?value:fallback
const num=(value,fallback,min,max)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{}

export function normalizeStudioCustomization(value){
  const raw=object(value)
  const a=object(raw.appearance),p=object(raw.profile),w=object(raw.workspace),q=object(raw.preferences),g=object(raw.plugins)
  const d=DEFAULT_STUDIO_CUSTOMIZATION
  const theme=choices(a.theme,palettes,d.appearance.theme)
  const panelFinish=choices(a.panelFinish,STUDIO_PANEL_FINISHES.map(p=>p.id),d.appearance.panelFinish)
  const themePalette=studioResolvedPalette(theme,panelFinish)
  const allowedIds=new Set(STUDIO_TOOL_CATALOG.map(t=>t.id))
  const toolbarIds=Array.isArray(w.toolbarIds)?Array.from(new Set(w.toolbarIds.filter(id=>typeof id==='string'&&allowedIds.has(id)))):d.workspace.toolbarIds.slice()
  const safeImage=value=>{const data=short(value,300000);return /^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(data)&&data.length<=300000?data:''}
  return {
    version:1,
    appearance:{theme,panelFinish,liquidGlass:bool(a.liquidGlass,false),glassBackdrop:hex(a.glassBackdrop,d.appearance.glassBackdrop),glassDensity:choices(a.glassDensity,['clear','balanced','rich'],d.appearance.glassDensity),glassBlur:choices(a.glassBlur,['crisp','soft','smooth'],d.appearance.glassBlur),glassIconColor:choices(a.glassIconColor,['adaptive','white','ink','accent'],d.appearance.glassIconColor),glassLibrary:bool(a.glassLibrary,d.appearance.glassLibrary),glassInspector:bool(a.glassInspector,d.appearance.glassInspector),glassToolbars:bool(a.glassToolbars,d.appearance.glassToolbars),glassMenu:bool(a.glassMenu,d.appearance.glassMenu),glassWidgets:bool(a.glassWidgets,d.appearance.glassWidgets),accent:themePalette.accent,sidebarColor:themePalette.sidebarColor,panelColor:themePalette.panelColor,studioColor:hex(a.studioColor,d.appearance.studioColor),backgroundMode:choices(a.backgroundMode,['default','color'],d.appearance.backgroundMode),environmentPreset:choices(a.environmentPreset,['studio','softbox','dramatic','neutral'],d.appearance.environmentPreset),lightColor:hex(a.lightColor,d.appearance.lightColor),lightIntensity:num(a.lightIntensity,d.appearance.lightIntensity,0.1,3),lightPositionX:num(a.lightPositionX,d.appearance.lightPositionX,-20,20),lightPositionY:num(a.lightPositionY,d.appearance.lightPositionY,-20,20),lightPositionZ:num(a.lightPositionZ,d.appearance.lightPositionZ,-20,20)},
    profile:{displayName:short(p.displayName,80),brandName:short(p.brandName,100),bio:short(p.bio,500),avatarDataUrl:safeImage(p.avatarDataUrl),logoDataUrl:safeImage(p.logoDataUrl)},
    workspace:{toolbarVisible:bool(w.toolbarVisible,d.workspace.toolbarVisible),toolbarDock:choices(w.toolbarDock,['top','right','bottom','left','floating'],d.workspace.toolbarDock),toolbarPosition:{x:num(object(w.toolbarPosition).x,24,0,3000),y:num(object(w.toolbarPosition).y,95,0,3000)},toolbarIds,toolbarCompact:bool(w.toolbarCompact,d.workspace.toolbarCompact),toolbarEditMode:bool(w.toolbarEditMode,false),leftToolbarDock:choices(w.leftToolbarDock,['left','right','top','bottom','floating'],d.workspace.leftToolbarDock),rightToolbarDock:choices(w.rightToolbarDock,['left','right','top','bottom','floating'],d.workspace.rightToolbarDock),leftToolbarPosition:{x:num(object(w.leftToolbarPosition).x,0,-1400,1400),y:num(object(w.leftToolbarPosition).y,0,-1200,1200)},rightToolbarPosition:{x:num(object(w.rightToolbarPosition).x,0,-1400,1400),y:num(object(w.rightToolbarPosition).y,0,-1200,1200)},leftToolbarIds:Array.isArray(w.leftToolbarIds)?Array.from(new Set(w.leftToolbarIds.filter(x=>DEFAULT_LEFT_TOOL_IDS.includes(x)))):d.workspace.leftToolbarIds.slice(),rightToolbarIds:Array.isArray(w.rightToolbarIds)?Array.from(new Set(w.rightToolbarIds.filter(x=>DEFAULT_RIGHT_TOOL_IDS.includes(x)))):d.workspace.rightToolbarIds.slice(),extraLeftToolIds:Array.isArray(w.extraLeftToolIds)?Array.from(new Set(w.extraLeftToolIds.filter(x=>EXO_LEFT_EXTRA_IDS.has(x)))):d.workspace.extraLeftToolIds.slice(),extraRightToolIds:Array.isArray(w.extraRightToolIds)?Array.from(new Set(w.extraRightToolIds.filter(x=>EXO_RIGHT_EXTRA_IDS.has(x)))):d.workspace.extraRightToolIds.slice(),panelOrder:choices(w.panelOrder,['standard','swapped'],d.workspace.panelOrder),libraryWidth:num(w.libraryWidth,d.workspace.libraryWidth,160,350),inspectorWidth:num(w.inspectorWidth,d.workspace.inspectorWidth,295,540),objectBrowserHeight:num(w.objectBrowserHeight,d.workspace.objectBrowserHeight,230,650),viewportLayout:choices(w.viewportLayout,['split','stack','3d','2d'],d.workspace.viewportLayout),viewportSplit:num(w.viewportSplit,d.workspace.viewportSplit,20,80),topTabsVisible:bool(w.topTabsVisible,d.workspace.topTabsVisible),objectBrowserVisible:bool(w.objectBrowserVisible,d.workspace.objectBrowserVisible)},
    preferences:{language:choices(q.language,['en','es','fr','de','it','pt','ja','ko','zh'],d.preferences.language),units:choices(q.units,['mm','cm','in'],d.preferences.units),graphicsQuality:choices(q.graphicsQuality,['low','medium','high','ultra'],d.preferences.graphicsQuality),antialias:bool(q.antialias,d.preferences.antialias),viewControls:choices(q.viewControls,['clo','maya','blender','trackpad'],d.preferences.viewControls),shortcutsPreset:choices(q.shortcutsPreset,['clo','illustrator','blender'],d.preferences.shortcutsPreset),showGrid:bool(q.showGrid,d.preferences.showGrid),showGuides:bool(q.showGuides,d.preferences.showGuides),autoSave:bool(q.autoSave,d.preferences.autoSave),defaultFolder:short(q.defaultFolder,512),apiBaseUrl:short(q.apiBaseUrl,1024)},
    plugins:{enableLocalTools:bool(g.enableLocalTools,d.plugins.enableLocalTools),enableAssetBridge:bool(g.enableAssetBridge,d.plugins.enableAssetBridge)},
    cloSettings:normalizeCloSettings(raw.cloSettings)
  }
}

export function loadStudioCustomization(){
  try{
    if(typeof localStorage==='undefined')return normalizeStudioCustomization()
    const json=localStorage.getItem(STUDIO_CUSTOMIZATION_KEY)
    if(!json)return normalizeStudioCustomization()
    const parsed=JSON.parse(json)
    return parsed?.version===1?normalizeStudioCustomization(parsed):normalizeStudioCustomization()
  }catch{return normalizeStudioCustomization()}
}

export function saveStudioCustomization(value){
  const normalized=normalizeStudioCustomization(value)
  try{if(typeof localStorage!=='undefined')localStorage.setItem(STUDIO_CUSTOMIZATION_KEY,JSON.stringify(normalized))}catch{/* Storage may be unavailable or full. */}
  return normalized
}
