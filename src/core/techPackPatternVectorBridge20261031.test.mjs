import test from 'node:test'
import assert from 'node:assert/strict'
import {nativePatternPanelToTechPackPath,appendNativePatternVectorToTechPack} from './techPackPatternVectorBridge20261031.js'

const panel=()=>({id:'front',name:'Front panel',polygon:{points:[[0,0],[.4,0],[.4,.6],[0,.6]],edges:['a','b','c','d'],curves:{b:[[.5,.15],[.5,.45]]},vertex_ids:['v0','v1','v2','v3']}})
test('native cubic and vertex anchors become source-linked editable vector with no image/background',()=>{
  const source=panel(),original=structuredClone(source)
  const result=nativePatternPanelToTechPackPath(source,{id:'front-path',pageId:'pattern',fill:'none'})
  assert.equal(result.kind,'path');assert.equal(result.fill,'none');assert.equal(result.anchors.length,4)
  assert.match(result.d,/ C /);assert.match(result.d,/ Z$/)
  assert.equal(result.sourceLink.panelId,'front');assert.deepEqual(result.sourceLink.edgeIds,['a','b','c','d'])
  assert.equal(result.anchors[0].sourceVertexId,'v0')
  assert.deepEqual(source,original)
  result.sourceLink.sourcePolygon.points[0][0]=999
  assert.deepEqual(source,original)
  assert.ok(!('assetId' in result)&&!('dataUrl' in result))
})
test('append preserves other pages and existing editable objects',()=>{
  const workspace={vectorObjects:{pattern:[{id:'existing'}],other:[{id:'other'}]}}
  const result=appendNativePatternVectorToTechPack(workspace,'pattern',panel())
  assert.equal(result.vectorObjects.pattern.length,2)
  assert.deepEqual(workspace.vectorObjects.pattern,[{id:'existing'}])
  assert.deepEqual(result.vectorObjects.other,workspace.vectorObjects.other)
  assert.throws(()=>appendNativePatternVectorToTechPack(result,'pattern',panel()),/Duplicate/)
})
test('rejects invalid native outlines and controls',()=>{
  const malformed=panel();malformed.polygon.curves.b=[[Infinity,0],[1,1]]
  assert.throws(()=>nativePatternPanelToTechPackPath(malformed),/Invalid native cubic/)
  const repeated=panel();repeated.polygon.edges[1]='a'
  assert.throws(()=>nativePatternPanelToTechPackPath(repeated),/distinct ordered/)
})
