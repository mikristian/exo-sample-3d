import test from 'node:test'
import assert from 'node:assert/strict'
import { STUDIO_THEME_PRESETS, STUDIO_PANEL_FINISHES } from './studioThemePresets.js'
import { classifyExoThemeRequest20261102 as classify, describeExoThemes20261102 as describe } from './exoCompanionThemeIntelligence20261102.js'

test('guides through installed theme settings and opens relevant tab', () => {
  const guide = classify('Can you walk me through the theme settings?')
  assert.equal(guide.type, 'tutorial')
  assert.deepEqual(guide.steps.slice(0,2), ['open-settings','select-theme-tab'])
  assert.deepEqual([classify('open appearance settings').type, classify('open appearance settings').tab], ['open','theme'])
})

test('lists and paginates real installed theme choices with specific filters', () => {
  const all = describe({ limit: 1000 })
  assert.equal(all.total, STUDIO_THEME_PRESETS.length)
  assert.equal(all.options.length, Math.min(200, STUDIO_THEME_PRESETS.length))
  assert.equal(all.hasMore, STUDIO_THEME_PRESETS.length > 200)
  const purple = classify('what other purple themes are available?')
  assert.equal(purple.type, 'list')
  assert.ok(purple.options.length > 0)
  assert.ok(purple.options.every(t => STUDIO_THEME_PRESETS.some(p => p.id === t.id)))
  assert.ok(purple.options.some(t => t.category === 'Purple'))
  const light = classify('show me all light themes')
  assert.ok(light.options.every(t => t.mode === 'light'))
  assert.ok(light.total > 0)
  const next = classify('show more', { themeContext: true, query:'purple themes', offset:0, limit:3 })
  assert.deepEqual([next.type,next.offset,next.options.length], ['list',3,3])
  assert.notEqual(next.options[0].id, classify('purple themes', {limit:3}).options[0].id)
})

test('exact named installed themes, panel finishes and context references produce safe actions', () => {
  for (const [request, id] of [
    ['switch my interface to Sapphire Night','sapphire-night'],
    ['apply pure white theme','pure-white-light'],
    ['change theme to violet','violet'],
    ['use Soft Cream theme','cream-light'],
    ['set theme to midnight blue','midnight'],
  ]) {
    const outcome = classify(request)
    assert.deepEqual([outcome.type, outcome.id, outcome.tool], ['apply',id,'app.appearance.setTheme'], request)
  }
  const followup = classify('switch to that one',{ themeContext:true, lastThemeId:'sage' })
  assert.deepEqual([followup.type,followup.id], ['apply','sage'])
  assert.deepEqual([classify('what theme am I using now?',{selectedThemeId:'orchid'}).type,
    classify('what theme am I using now?',{selectedThemeId:'orchid'}).id], ['explain','orchid'])
  assert.equal(classify('what theme am I using now?').requiresCurrentTheme, true)
  assert.deepEqual([classify('make the sidebar unified').type,classify('make the sidebar unified').id], ['apply','unified'])
  const finishes = classify('show panel finish options')
  assert.deepEqual(finishes.options.map(f => f.id), STUDIO_PANEL_FINISHES.map(f => f.id))
})

test('rejects clothing changes, fabricated options and unsupported icon mutations', () => {
  for (const request of ['make the hoodie purple','change the fabric to blue','turn my pattern pieces red','make the garment theme purple','change my avatar color','hello','switch to ultraviolet theme']) {
    assert.notEqual(classify(request).type, 'apply', request)
  }
  assert.equal(classify('change app icons to gold').supported, false)
  assert.equal(classify('switch to ultraviolet theme').type, 'open')
  assert.equal(classify('unknown command').type, 'unknown')
  assert.equal(classify('x'.repeat(1001)).type, 'unknown')
})
