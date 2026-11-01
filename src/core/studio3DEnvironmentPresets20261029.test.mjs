import test from 'node:test'
import assert from 'node:assert/strict'
import {STUDIO_3D_ENVIRONMENT_PRESETS_20261029,applyStudio3DEnvironmentChoice20261029,isStudio3DEnvironmentChoiceActive20261029} from './studio3DEnvironmentPresets20261029.js'

test('3D environment choices preview only their category and keep unrelated appearance',()=>{
  const saved={backgroundMode:'default',floorMode:'default',environmentPreset:'studio',
    studioColor:'#373941',floorColor:'#ebebed',lightColor:'#ffffff',lightIntensity:1,
    lightPositionX:2.5,toolbarGlowStrength:.7,theme:'obsidian-night'}
  const all=STUDIO_3D_ENVIRONMENT_PRESETS_20261029
  assert.deepEqual(all.map(group=>group.id),['background','floor','lighting'])
  for(const group of all){
    for(const option of group.options){
      const changed=applyStudio3DEnvironmentChoice20261029(saved,option)
      assert.notEqual(changed,saved)
      assert.equal(saved.theme,'obsidian-night')
      assert.equal(changed.theme,saved.theme)
      assert.equal(changed.toolbarGlowStrength,saved.toolbarGlowStrength)
      assert.equal(changed.lightPositionX,saved.lightPositionX)
      assert.equal(isStudio3DEnvironmentChoiceActive20261029(changed,group.id,option),true)
      if(group.id==='background')assert.equal(changed.floorColor,saved.floorColor)
      if(group.id==='floor')assert.equal(changed.studioColor,saved.studioColor)
      if(group.id==='lighting')assert.equal(changed.floorMode,saved.floorMode)
    }
  }
  assert.equal(saved.backgroundMode,'default','hover preview must leave saved appearance untouched')
})

test('original floor and background choices restore default modes without losing custom swatches',()=>{
  const originalBackground=STUDIO_3D_ENVIRONMENT_PRESETS_20261029[0].options[0]
  const originalFloor=STUDIO_3D_ENVIRONMENT_PRESETS_20261029[1].options[0]
  const personalized={backgroundMode:'color',floorMode:'color',studioColor:'#fe1020',floorColor:'#ddccaa'}
  const next=applyStudio3DEnvironmentChoice20261029(applyStudio3DEnvironmentChoice20261029(personalized,originalBackground),originalFloor)
  assert.deepEqual(next,{...personalized,backgroundMode:'default',floorMode:'default'})
  assert.equal(isStudio3DEnvironmentChoiceActive20261029(next,'background',originalBackground),true)
  assert.equal(isStudio3DEnvironmentChoiceActive20261029(next,'floor',originalFloor),true)
})
