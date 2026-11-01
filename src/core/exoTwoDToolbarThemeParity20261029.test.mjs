import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import postcss from 'postcss'
import {studioResolvedPalette} from './studioThemePresets.js'

test('clear 2D pattern glass cannot repaint the docked 2D rail across themes',()=>{
  const crystal=postcss.parse(readFileSync(new URL('../components/ExoPatternCrystalGlass20261029.css',import.meta.url),'utf8'))
  const forbidden=[]
  crystal.walkRules(rule=>{
    if(!rule.selector.includes('data-pattern-clear-glass'))return
    // Nested 2D buttons may use glass. The outer docked 2D nav belongs to
    // the same Studio theme as the left 3D toolbar.
    const targetsOuterPalette=rule.selectors.some(selector=>
      /\.clo-right-tool-palette\s*$/.test(selector.trim()))
    if(!targetsOuterPalette)return
    rule.walkDecls(decl=>{
      if(/^(background(?:-color|-image)?|backdrop-filter|-webkit-backdrop-filter)$/.test(decl.prop))
        forbidden.push(`${rule.selector}: ${decl.prop}`)
    })
  })
  assert.deepEqual(forbidden,[],`Pattern glass overrides the themed 2D toolbar: ${forbidden.join(', ')}`)

  const studio=postcss.parse(readFileSync(new URL('../studioCustomizationTheme.css',import.meta.url),'utf8'))
  let themedRail=false
  studio.walkRules(rule=>{
    if(rule.selector.includes('data-studio-customized') && rule.selector.includes('.tool-rail') &&
       rule.selector.includes('.clo-right-tool-palette')){
      rule.walkDecls(decl=>{
        if(decl.prop==='background' && decl.value.includes('var(--studio-sidebar'))themedRail=true
      })
    }
  })
  assert.equal(themedRail,true,'Both toolbars must share the selected theme sidebar color')
  assert.notEqual(studioResolvedPalette('graphite').sidebarColor,studioResolvedPalette('pure-white-light').sidebarColor)
})
