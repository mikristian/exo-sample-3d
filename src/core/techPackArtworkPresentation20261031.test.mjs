import test from 'node:test'
import assert from 'node:assert/strict'
import {isTechPackVectorAsset20261031,resolveTechPackArtworkSource20261031} from './techPackArtworkPresentation20261031.js'
test('raster technical flats never receive fake SVG stroke editing',()=>{
 const src='data:image/png;base64,aaaa'
 assert.equal(resolveTechPackArtworkSource20261031(src,{vectorFill:'#FF0000'}),src)
 assert.equal(isTechPackVectorAsset20261031(src),false)
})
test('real SVG source with no edits remains source-linked, including namespace charset',()=>{
 const src='data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M0%200L3%203%22%2F%3E%3C%2Fsvg%3E'
 assert.equal(isTechPackVectorAsset20261031(src),true)
 assert.equal(resolveTechPackArtworkSource20261031(src,{}),src)
 assert.equal(isTechPackVectorAsset20261031('data:image/svg+xml;charset=utf-8,%3Csvg%3E'),true)
})
test('headless print assembly keeps SVG source visible if browser XML parser is absent',()=>{
 const source='data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M0%200L3%203%22%2F%3E%3C%2Fsvg%3E'
 assert.equal(resolveTechPackArtworkSource20261031(source,{vectorTrimToArtwork:true,vectorStrokeMode:'color',vectorStroke:'#111111'}),source)
})
