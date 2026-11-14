import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const jsx=fs.readFileSync(new URL('../components/TechPackWorkspace.jsx',import.meta.url),'utf8')
const media=fs.readFileSync(new URL('../components/TechPackMediaProperties20261031.jsx',import.meta.url),'utf8')
test('private SEAGGS appears as a visible selectable mockup flat, not only a hidden import action',()=>{
 assert.match(jsx,/tpws-private-mockup-preview/)
 assert.match(jsx,/Add SEAGGS T-shirt flat mockup from local library/)
 assert.match(jsx,/private-mockups\/seaggs-tshirt-private-transparent\.png/)
})
test('Smart Reference Layout is collapsed and follows the folder content',()=>{
 const folder=jsx.indexOf('<nav className="tpws-asset-folders"')
 const assets=jsx.indexOf('<div className="tpws-native-assets">')
 const smart=jsx.indexOf('<details className="tpws-media-automation-fold"')
 assert(folder>=0&&assets>folder&&smart>assets)
 assert.doesNotMatch(jsx.slice(smart,smart+90),/\sopen(?:=|\s|>)/)
  assert(jsx.indexOf('Mockup &amp; VectorCraft tools')>assets)
})
test('selected swatch and vector reference have independent fill and stroke controls',()=>{
 assert.match(media,/Swatch fill color/)
 assert.match(media,/Swatch stroke color/)
 assert.match(media,/Swatch stroke width/)
 assert.match(media,/Drawing fill color/)
 assert.match(media,/Drawing stroke color/)
  assert.match(jsx,/setSelectedVectorIds\(\[objects\[0\]\.id\]\)/)
})
test('SVG paint rendering accepts the charset-bearing data URI produced by VectorCraft',()=>{
 assert.match(jsx,/svg\\\+xml\(\?:;charset=/)
 assert.match(jsx,/renderVectorArtworkDataUrl|resolveTechPackArtworkSource20261031/)
})
