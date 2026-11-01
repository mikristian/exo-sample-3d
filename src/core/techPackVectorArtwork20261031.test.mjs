import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeVectorArtwork,renderVectorArtworkDataUrl,isFullViewportWhiteBackgroundRect} from './techPackVectorArtwork20261031.js'

test('raster data is rejected rather than claimed to be SVG', () => {
  for (const source of ['data:image/png;base64,iVBORw0K','data:image/jpeg;base64,/9j/','blob:example','https://site.test/art.svg']) {
    assert.throws(() => analyzeVectorArtwork(source))
    assert.throws(() => renderVectorArtworkDataUrl(source,{stroke:'#222222'}))
  }
})

test('SVG payload takes precedence over imported provenance metadata', () => {
  const asset={source:'SEAGGS Illustrator PDF page 1',dataUrl:'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E'}
  if(typeof DOMParser==='undefined') assert.throws(()=>analyzeVectorArtwork(asset),/browser XML parser/)
  else assert.equal(analyzeVectorArtwork(asset).kind,'svg')
})

test('XML entities and doctypes are rejected before parsing', () => {
  const payload = '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>'
  assert.throws(() => analyzeVectorArtwork(payload),/SVG/)
})

test('SVG document parsing is explicitly browser-based', () => {
  if (typeof DOMParser !== 'undefined') return
  assert.throws(() => analyzeVectorArtwork('<svg xmlns="http://www.w3.org/2000/svg"/>'),/browser XML parser/)
})

test('white background detection requires an exact untransformed full viewBox rectangle', () => {
  const full = {x:'-5',y:'10',width:'400',height:'300',fill:'#fff'}
  assert.equal(isFullViewportWhiteBackgroundRect(full,'-5 10 400 300'),true)
  assert.equal(isFullViewportWhiteBackgroundRect({...full,width:'399'},'-5 10 400 300'),false)
  assert.equal(isFullViewportWhiteBackgroundRect({...full,transform:'translate(1)'},'-5 10 400 300'),false)
  assert.equal(isFullViewportWhiteBackgroundRect({...full,fill:'white',height:'200'},'-5 10 400 300'),false)
  assert.equal(isFullViewportWhiteBackgroundRect({...full,fill:'none'},'-5 10 400 300'),false)
  assert.equal(isFullViewportWhiteBackgroundRect({...full,rx:'2'},'-5 10 400 300'),false)
})
