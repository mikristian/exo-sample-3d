import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {buttonValuesFromPreset,zipperValuesFromPreset} from './appHardwarePresetValues20261030.mjs'

test('button preset retains existing dimensions, style overrides and fallbacks',()=>{
  const preset={id:'b',name:'Pearl',dimensionsMm:{diameter:16,frontThickness:3},holes:4,pbr:{baseColor:'#abc',roughness:.35}}
  const original=structuredClone(preset)
  const button=buttonValuesFromPreset(preset,{widthMm:19,color:'#123'})
  assert.equal(button.widthMm,19)
  assert.equal(button.diameterCm,1.9)
  assert.equal(button.heightMm,16)
  assert.equal(button.thicknessMm,3)
  assert.equal(button.holes,4)
  assert.equal(button.color,'#123')
  assert.equal(button.roughness,.35)
  assert.deepEqual(preset,original)
  assert.equal(buttonValuesFromPreset(null).hardwarePresetId,'four-hole-shirt-button')
})

test('zipper preset preserves invisible/metal branches and default measurements',()=>{
  const metal=zipperValuesFromPreset({zipperType:'metal',dimensionsMm:{nominalChainWidth:8,tapeWidthEachSide:15},pbr:{metalness:.9}})
  assert.equal(metal.toothPitchMm,2.8)
  assert.equal(metal.sliderWidthMm,11.04)
  assert.equal(metal.widthCm,1.5)
  assert.equal(metal.metalness,.9)
  assert.equal(metal.teethMaterialType,'metal')
  const invisible=zipperValuesFromPreset({zipperType:'invisible-coil',pbr:{}})
  assert.equal(invisible.tapeColor,'#d8d1c6')
  assert.equal(invisible.teethMaterialType,'nylon')
  assert.equal(zipperValuesFromPreset(null).hardwarePresetId,'coil-zipper-5')
})

test('architecture gate: App imports extracted pure values and does not duplicate definitions',()=>{
  const app=readFileSync(new URL('../App.jsx',import.meta.url),'utf8')
  assert.match(app,/import \{buttonValuesFromPreset,zipperValuesFromPreset\} from '\.\/core\/appHardwarePresetValues20261030\.mjs'/)
  assert.doesNotMatch(app,/const buttonValuesFromPreset\s*=/)
  assert.doesNotMatch(app,/const zipperValuesFromPreset\s*=/)
})
