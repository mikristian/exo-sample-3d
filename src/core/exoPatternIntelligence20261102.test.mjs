import test from 'node:test'
import assert from 'node:assert/strict'
import {
  describePatternGeometry,recommendSimilarPatternPanels,recommendSeamPartners
} from './exoPatternIntelligence20261102.js'

const square={id:'a',units:'cm',outline:[[0,0],[10,0],[10,10],[0,10]],sourceSha256:'a'.repeat(64)}
test('converts explicit cm coordinates to mm and computes shape metrics',()=>{
  const result=describePatternGeometry(square)
  assert.equal(result.ok,true)
  assert.equal(result.widthMm,100)
  assert.equal(result.areaMm2,10000)
  assert.equal(result.perimeterMm,400)
  assert.equal(result.provenance.sourceSha256,'a'.repeat(64))
  assert.equal(result.trainedModelUsed,false)
})
test('rejects missing units, nonfinite and degenerate outlines',()=>{
  assert.equal(describePatternGeometry({outline:square.outline}).reason,'explicit_supported_units_required')
  assert.equal(describePatternGeometry({units:'mm',outline:[[0,0],[1,0],[NaN,1]]}).reason,'nonfinite_outline_coordinate')
  assert.equal(describePatternGeometry({units:'mm',outline:[[0,0],[1,0],[2,0]]}).reason,'degenerate_outline')
})
test('ranks geometrically identical shapes above dimensionally different candidates without mutation',()=>{
  const candidates=[
    {id:'wide',units:'mm',outline:[[0,0],[300,0],[300,20],[0,20]]},
    {id:'equivalent',units:'mm',outline:[[0,0],[100,0],[100,100],[0,100]]}
  ]
  const copy=JSON.stringify(candidates)
  const result=recommendSimilarPatternPanels(square,candidates)
  assert.equal(result.ok,true)
  assert.equal(result.suggestions[0].candidate.id,'equivalent')
  assert.equal(result.suggestions[0].score,1)
  assert.equal(result.suggestions[0].applied,false)
  assert.equal(result.suggestions[0].scoreType,'geometric_similarity_not_probability')
  assert.equal(JSON.stringify(candidates),copy)
})
test('seam partners tolerate explicit length difference and are review only',()=>{
  const result=recommendSeamPartners({id:'edge-a',panelId:'p',length:10,units:'cm'},[
    {id:'edge-a',panelId:'p',length:10,units:'cm'},
    {id:'near',panelId:'other',lengthMm:102},
    {id:'far',panelId:'other',lengthMm:114}
  ],{toleranceMm:5})
  assert.equal(result.ok,true)
  assert.deepEqual(result.suggestions.map(x=>x.edgeId),['near'])
  assert.equal(result.suggestions[0].lengthDifferenceMm,2)
  assert.equal(result.suggestions[0].reviewRequired,true)
  assert.equal(result.suggestions[0].trainedModelUsed,false)
})
