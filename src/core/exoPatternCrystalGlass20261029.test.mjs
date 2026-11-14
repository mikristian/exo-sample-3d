import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveExoPatternCrystalSurface20261029 as surface} from './exoPatternCrystalGlass20261029.js'
import {normalizeStudioCustomization} from './studioCustomization.js'
import {EXO_PATTERN_UI_PRESETS_20261028} from './exoSettingsColorPresets20261028.js'
test('2D pattern crystal clear is on by default, including legacy settings',()=>{
 assert.equal(normalizeStudioCustomization({}).appearance.patternClearGlass,true)
 assert.equal(normalizeStudioCustomization({appearance:{theme:'raspberry'}}).appearance.patternClearGlass,true)
 assert.equal(surface({patternClearGlass:true},{twoDPatternSurfaceStyle:'solid'}),'glass')
})
test('crystal toggle is independent from studio theme, solid option and outline mode',()=>{
 assert.equal(surface({patternClearGlass:true},{twoDPatternSurfaceStyle:'outline'}),'outline')
 assert.equal(surface({patternClearGlass:false},{twoDPatternSurfaceStyle:'solid'}),'solid')
 assert.equal(surface({patternClearGlass:false},{twoDPatternSurfaceStyle:'glass'}),'glass')
 assert.equal(normalizeStudioCustomization({appearance:{patternClearGlass:false}}).appearance.patternClearGlass,false)
})
test('transient pattern preview overrides active crystal without writing saved choice',()=>{
 const preferences={twoDPatternSurfaceStyle:'solid'}
 const appearance={patternClearGlass:true}
 assert.equal(surface(appearance,preferences,{surface:'outline'}),'outline')
 assert.equal(surface(appearance,preferences,{surface:'solid'}),'solid')
 assert.equal(surface(appearance,preferences,{surface:'glass'}),'glass')
 assert.equal(surface(appearance,preferences),'glass')
 assert.equal(preferences.twoDPatternSurfaceStyle,'solid')
})
test('transparent pattern opacity and luminous cutline strength stay bounded and preserve legacy defaults',()=>{
 const prefs=normalizeStudioCustomization({}).preferences
 assert.equal(prefs.twoDPatternGlassOpacity,.08)
 assert.equal(prefs.twoDPatternOutlineGlow,false)
 assert.equal(prefs.twoDPatternOutlineGlowStrength,.55)
 assert.equal(prefs.twoDPatternOutlineGlowColor,'auto')
 const low=normalizeStudioCustomization({preferences:{twoDPatternGlassOpacity:-1,twoDPatternOutlineGlowStrength:-2}}).preferences
 const high=normalizeStudioCustomization({preferences:{twoDPatternGlassOpacity:20,twoDPatternOutlineGlowStrength:20}}).preferences
 assert.equal(low.twoDPatternGlassOpacity,0)
 assert.equal(high.twoDPatternGlassOpacity,.35)
 assert.equal(low.twoDPatternOutlineGlowStrength,0)
 assert.equal(high.twoDPatternOutlineGlowStrength,1)
 assert.equal(normalizeStudioCustomization({preferences:{twoDPatternOutlineGlowColor:'invalid'}}).preferences.twoDPatternOutlineGlowColor,'auto')
 const preset=EXO_PATTERN_UI_PRESETS_20261028.find(item=>item.id==='glass-neon-clear')
 assert.equal(preset.surface,'glass')
 assert.equal(preset.glow,true)
 assert.equal(preset.glassOpacity,.035)
})
