import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {initializeRustThemeKernel,rustThemeColorTokens} from './rustThemeKernel.js'
import {readableUiInk} from './interfaceColorContrast.js'

test('2D icon Auto inherits the overall icon swatch on every viewport token',async()=>{
  const wasm=readFileSync(new URL('../../public/wasm/exo_ui_kernel.wasm',import.meta.url))
  assert.equal(await initializeRustThemeKernel({bytes:wasm}),true)
  const tokens=rustThemeColorTokens({
    globalToolbarIconColor:'#0566f7',
    twoDToolbarIconColor:'auto',
    twoDViewerHorizontalColor:'auto',
    twoDViewerVerticalColor:'auto',
  },{},'#dcefff')
  assert.equal(tokens['--exo-ui-icon-ink'],'#0566f7')
  assert.equal(tokens['--exo-2d-toolbar-ink'],'#0566f7')
  assert.equal(tokens['--exo-2d-horizontal-ink'],'#0566f7')
  assert.equal(tokens['--exo-2d-vertical-ink'],'#0566f7')
  const railBlue=readableUiInk(tokens['--exo-2d-toolbar-ink'],'#05070c')
  const canvasBlue=readableUiInk(tokens['--exo-2d-horizontal-ink'],'#c6c7c9')
  assert.match(railBlue,/^#[0-9a-f]{6}$/)
  assert.match(canvasBlue,/^#[0-9a-f]{6}$/)
  assert.notEqual(railBlue,'#000000')
  assert.notEqual(canvasBlue,'#000000')
})

test('intentional 2D icon overrides stay independent of global color',async()=>{
  const wasm=readFileSync(new URL('../../public/wasm/exo_ui_kernel.wasm',import.meta.url))
  assert.equal(await initializeRustThemeKernel({bytes:wasm}),true)
  const tokens=rustThemeColorTokens({
    globalToolbarIconColor:'#0566f7',
    twoDToolbarIconColor:'#a742d1',
    twoDViewerHorizontalColor:'#34b6d1',
    twoDViewerVerticalColor:'auto',
  },{},'#dcefff')
  assert.equal(tokens['--exo-ui-icon-ink'],'#0566f7')
  assert.equal(tokens['--exo-2d-toolbar-ink'],'#a742d1')
  assert.equal(tokens['--exo-2d-horizontal-ink'],'#34b6d1')
  assert.equal(tokens['--exo-2d-vertical-ink'],'#a742d1')
})

test('the 2D toolbar style and Settings shortcut use the global swatch in Auto mode',()=>{
  const styles=readFileSync(new URL('../twoDOverallIconSync20261029.css',import.meta.url),'utf8')
  const app=readFileSync(new URL('../App.jsx',import.meta.url),'utf8')
  const dialog=readFileSync(new URL('../components/StudioSettingsDialog.jsx',import.meta.url),'utf8')
  assert.match(app,/twoDOverallIconSync20261029\.css/)
  assert.match(styles,/data-2d-toolbar-color-custom="false"/)
  assert.match(styles,/data-2d-horizontal-custom="false"/)
  assert.match(styles,/data-2d-vertical-custom="false"/)
  assert.match(styles,/\.cad-tool-icon-mask/)
  assert.match(styles,/cc-v2-board-orientation/)
  assert.match(dialog,/studio-2d-match-overall-icon-color/)
  for(const key of ['twoDToolbarIconColor','twoDViewerHorizontalColor','twoDViewerVerticalColor'])
    assert.ok(dialog.includes(key+":'auto'"))
})
