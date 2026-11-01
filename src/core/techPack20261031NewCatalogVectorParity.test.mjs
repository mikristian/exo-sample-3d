import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {getNewTechPackTemplates} from './techPackPageTemplates20261031.js'
import {TECHPACK_OBJECT_TEMPLATES,insertTechPackObjectPreset} from './techPackObjectTemplateCatalog20261031.js'
import {TECHPACK_ASSET_FOLDERS,assetInFolder} from './techPackAssetFolders.js'
import {nativePatternPanelToTechPackPath} from './techPackPatternVectorBridge20261031.js'
import {moveTechPackPathAnchor} from './techPackVectorAnchorEditing20261031.js'
import {renderTechPackVectorSvg} from './techPackVectorStudio.js'
import {svgPatternAsset} from './techPackNikeTshirtExample20261031.js'

test('visible production catalogs contain no historical cards or legacy layout recipes',()=>{
  assert.equal(getNewTechPackTemplates('pages').length,27)
  assert.equal(getNewTechPackTemplates('packs').length,13)
  assert.ok(TECHPACK_OBJECT_TEMPLATES.every(o=>!['outline-box','callout-box','swatch-box','square-technical-box'].includes(o.id)))
  assert.ok(TECHPACK_OBJECT_TEMPLATES.every(o=>o.kind!=='card'))
  for(const id of ['rectangle','square','ellipse','circle','outline-frame','media-photo','media-artwork','media-swatch']){
    const ws=insertTechPackObjectPreset({},id,{pageId:'custom-1',id:'test-object'})
    assert.equal((ws.vectorObjects?.['custom-1']||[]).length+(ws.pageBoxes?.['custom-1']||[]).length,1)
  }
})
test('Mockups folder filters reference flats, preserves independently authored garment sources',()=>{
  assert.ok(TECHPACK_ASSET_FOLDERS.some(f=>f.id==='mockups'))
  assert.ok(assetInFolder({category:'mockup'},'mockups'))
  assert.ok(assetInFolder({category:'technical flat'},'mockups'))
  assert.equal(assetInFolder({category:'fabric'},'mockups'),false)
})
test('saved production tee source renders real curved vector path without an opaque white rectangle',()=>{
  const native=JSON.parse(fs.readFileSync('public/saved-garments/EXO_Previous_Tshirt_preserved_20261025.garment.json','utf8'))
  const source=native.template.panels[0]
  const vector=nativePatternPanelToTechPackPath(source,{id:'front',pageId:'custom-tee-pattern'})
  assert.equal(vector.anchors.length,source.polygon.points.length)
  assert.match(vector.d,/ C /)
  const print=renderTechPackVectorSvg([vector])
  assert.match(print,/<path/)
  assert.match(print,/ C /)
  assert.doesNotMatch(print,/<rect/)
  const origin=vector.anchors[0].p
  const changed=moveTechPackPathAnchor(vector,0,[origin[0]+8,origin[1]+4])
  assert.notEqual(changed.d,vector.d)
  assert.deepEqual(source.polygon,native.template.panels[0].polygon)
  const embedded=decodeURIComponent(svgPatternAsset(source).split(',').slice(1).join(','))
  assert.match(embedded,/<path/)
  assert.doesNotMatch(embedded,/<rect|fill="#fff"|background="white"/)
})
