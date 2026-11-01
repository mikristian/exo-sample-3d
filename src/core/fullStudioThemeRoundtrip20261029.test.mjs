import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeStudioCustomization} from './studioCustomization.js'
import {studioResolvedPalette} from './studioThemePresets.js'
import {resolveExoGradeChartThemes20261028} from './exoSettingsColorPresets20261028.js'
import {
  SAVED_THEME_PRESETS_KEY,captureThemeOverrides,saveNamedThemePreset,
  loadSavedThemePresets,exportSavedThemePresets,importSavedThemePresets,
  applySavedThemePreset,
} from './themePresetManager.js'

const local = new Map()
globalThis.localStorage={
  getItem:key=>local.get(key)??null,
  setItem:(key,value)=>{local.set(key,String(value))},
  removeItem:key=>local.delete(key),
}

const saved=()=>normalizeStudioCustomization({
  appearance:{
    theme:'obsidian-night',panelFinish:'deep',sidebarColor:'#05070c',
    studioColor:'#241225',backgroundMode:'color',floorColor:'#1d2028',floorMode:'color',
    environmentPreset:'dramatic',lightColor:'#ffe5d1',lightIntensity:1.55,
    lightPositionX:-3.2,lightPositionY:5.5,lightPositionZ:2,
    globalToolbarIconColor:'#9610da',rightRailColor:'#202027',
    patternClearGlass:false,liquidGlass:true,
  },
  preferences:{
    twoDCanvasColor:'#0d1724',twoDGridColor:'#aabbcc',twoDGridStyle:'dots',
    twoDPatternSurfaceStyle:'glass',twoDPatternGlassOpacity:.025,
    twoDPatternOutlineGlow:true,twoDPatternOutlineGlowStrength:.85,
    twoDPatternOutlineGlowColor:'#75e3ff',
    twoDPointColor:'#77ffdd',gradeChartThemeMode:'auto',
    gradeTableColorTheme:'night',compareLengthColorTheme:'paper',
    units:'in',autoSave:false,
  },
  workspace:{
    panelOrder:'swapped',libraryWidth:315,
    nativeToolIconColors:{'2d:A01':'#bb44ff','3d:B02':'#00ddaa'},
    customToolbars:[{
      id:'my-precision-tools',name:'Precision',color:'#4b155b',finish:'glass',
      iconColors:{'2d:A01':'#44ccff'},dock:'floating',x:177,y:299,
      tools:[],
    }],
  },
  profile:{displayName:'Keep this brand'},
})

test('one-click theme captures and reapplies 2D/3D/color/icons/chart mode without moving workspace or garment',()=>{
  local.clear()
  const original=saved()
  const preset=saveNamedThemePreset('All my colors',original)
  assert.equal(loadSavedThemePresets()[0].id,preset.id)
  assert.equal(preset.overrides.appearance.backgroundMode,'color')
  assert.equal(preset.overrides.appearance.environmentPreset,'dramatic')
  assert.equal(preset.overrides.preferences.gradeChartThemeMode,'auto')
  assert.equal(preset.overrides.preferences.twoDPatternGlassOpacity,.025)
  assert.equal(preset.overrides.preferences.twoDPatternOutlineGlow,true)
  assert.equal(preset.overrides.preferences.twoDPatternOutlineGlowStrength,.85)
  assert.equal(preset.overrides.workspace.nativeToolIconColors['2d:A01'],'#bb44ff')
  assert.equal(preset.overrides.workspace.customToolbarAppearance['my-precision-tools'].color,'#4b155b')

  const different=normalizeStudioCustomization({
    ...original,
    appearance:{...original.appearance,theme:'raspberry',studioColor:'#313337',floorMode:'default',globalToolbarIconColor:'auto'},
    preferences:{...original.preferences,twoDCanvasColor:'auto',gradeChartThemeMode:'custom',
      gradeTableColorTheme:'paper',compareLengthColorTheme:'night',units:'cm',autoSave:true,
      twoDPatternGlassOpacity:.35,twoDPatternOutlineGlow:false},
    workspace:{...original.workspace,panelOrder:'standard',libraryWidth:240,
      nativeToolIconColors:{'2d:A01':'#ffffff'},
      customToolbars:[{...original.workspace.customToolbars[0],x:550,y:620,color:'#ffffff',finish:'solid',iconColors:{}}]},
    profile:{...original.profile,displayName:'Different brand'},
  })
  const restored=applySavedThemePreset(different,preset)
  assert.deepEqual(captureThemeOverrides(restored),captureThemeOverrides(original))
  assert.equal(restored.workspace.customToolbars[0].x,550)
  assert.equal(restored.workspace.customToolbars[0].y,620)
  assert.equal(restored.workspace.panelOrder,'standard')
  assert.equal(restored.workspace.libraryWidth,240)
  assert.equal(restored.preferences.units,'cm')
  assert.equal(restored.preferences.autoSave,true)
  assert.equal(restored.profile.displayName,'Different brand')
  const palette=studioResolvedPalette(restored.appearance.theme,restored.appearance.panelFinish)
  const charts=resolveExoGradeChartThemes20261028(restored.preferences,palette)
  assert.deepEqual(charts.values,charts.compare,'both grading tables must follow active theme when auto is saved')
  assert.equal(charts.values.paper,palette.panelColor)
})

test('JSON export and import preserve complete theme, custom grading palette and reversible legacy partial themes',()=>{
  local.clear()
  const original=saved()
  const customized=normalizeStudioCustomization({...original,preferences:{
    ...original.preferences,gradeChartThemeMode:'custom',
    gradeTableColorTheme:'paper',compareLengthColorTheme:'night',
  }})
  const created=saveNamedThemePreset('Manual worksheets',customized)
  const exported=exportSavedThemePresets()
  local.clear()
  const imported=importSavedThemePresets(exported)
  assert.equal(imported.length,1)
  const restored=applySavedThemePreset(s(saved()),imported[0])
  assert.equal(restored.preferences.gradeChartThemeMode,'custom')
  assert.equal(restored.preferences.gradeTableColorTheme,'paper')
  assert.equal(restored.preferences.compareLengthColorTheme,'night')
  assert.equal(created.overrides.appearance.environmentPreset,'dramatic')
  // A legacy v1 theme only overrides the properties it actually saved;
  // absent new fields must not reset the current environment/table colors.
  const legacy={version:1,presets:[{id:'custom-legacy-12345678',name:'Old user preset',
    overrides:{appearance:{theme:'graphite'},preferences:{twoDCanvasColor:'#123456'}}}]}
  local.clear()
  const [old]=importSavedThemePresets(JSON.stringify(legacy))
  const baseline=saved()
  const next=applySavedThemePreset(baseline,old)
  assert.equal(next.appearance.theme,'graphite')
  assert.equal(next.appearance.environmentPreset,baseline.appearance.environmentPreset)
  assert.equal(next.appearance.backgroundMode,baseline.appearance.backgroundMode)
  assert.equal(next.preferences.gradeChartThemeMode,baseline.preferences.gradeChartThemeMode)
  assert.equal(next.workspace.nativeToolIconColors['2d:A01'],'#bb44ff')
})

function s(value){return value}

test('untrusted imported workspace colors and invalid 3D values fail closed',()=>{
  const base={version:1,presets:[{id:'custom-malware-12345678',name:'Imported',
    overrides:{appearance:{theme:'graphite'},preferences:{},workspace:{nativeToolIconColors:{'2d:A01':'red'}}}}]}
  local.clear()
  assert.throws(()=>importSavedThemePresets(JSON.stringify(base)),/color/i)
  base.presets[0].overrides.workspace.nativeToolIconColors={'2d:A01':'#aabbcc'}
  base.presets[0].overrides.appearance.lightIntensity=999
  assert.throws(()=>importSavedThemePresets(JSON.stringify(base)),/Invalid theme value/i)
  base.presets[0].overrides.appearance.lightIntensity=1
  base.presets[0].overrides.workspace.customToolbarAppearance={'abc':{color:'#ffffff',finish:'solid',iconColors:{'3d:A01':'nothex'}}}
  assert.throws(()=>importSavedThemePresets(JSON.stringify(base)),/color/i)
  assert.equal(local.has(SAVED_THEME_PRESETS_KEY),false,'reject must not store partial imported themes')
})
