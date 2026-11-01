import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {inspectWomensInternalPaths20261031,qualifyThirdUpstreamPatterns20261031,ORIGINAL_WOMENS_BLOCK,THIRD_PATTERN_CANDIDATES} from './valentinaThirdPatternQualification20261031.mjs'

test('original independent womens block rejects exactly its four internal modeling paths',()=>{
  assert.ok(fs.existsSync(ORIGINAL_WOMENS_BLOCK),'authentic upstream file required')
  const result=inspectWomensInternalPaths20261031()
  assert.equal(result.ok,false)
  assert.equal(result.code,'UNSUPPORTED_SOURCE')
  assert.equal(result.safeForNativeEvaluation,false)
  assert.deepEqual(result.blockers.map(d=>d.id),['378','384','390','396'])
  assert.ok(result.blockers.every(d=>d.location==='draw[0]/modeling/path'))
  assert.equal(result.blockers.length,result.allDiagnostics.length)
})

test('original modeling objects remain blocked even when calculation tools are otherwise valid',()=>{
  const xml=fs.readFileSync(ORIGINAL_WOMENS_BLOCK,'utf8')
  const source=inspectWomensInternalPaths20261031(xml)
  assert.equal(source.safeForNativeEvaluation,false)
  assert.equal(source.blockers.length,4)
})

test('missing archive is reported as unqualified rather than treated as a successful export',()=>{
  const outcome=qualifyThirdUpstreamPatterns20261031('/nonexistent/valentina-upstream.zip')
  assert.equal(outcome.length,THIRD_PATTERN_CANDIDATES.length)
  assert.ok(outcome.every(c=>!c.ok && c.code==='ARCHIVE_MISSING'))
})

test('authentic upstream archive candidates retain provenance and explicit conversion outcomes',()=>{
  const zip='/Users/mikylecouto/Downloads/pattern-develop.zip'
  if (!fs.existsSync(zip)) return
  const results=qualifyThirdUpstreamPatterns20261031(zip)
  assert.equal(results.length,THIRD_PATTERN_CANDIDATES.length)
  for (const candidate of results) {
    assert.ok(candidate.code)
    if(candidate.sourceSha256) assert.match(candidate.sourceSha256,/^[a-f0-9]{64}$/)
    if(candidate.ok) {
      assert.equal(candidate.code,'CONVERSION_SUPPORTED')
      assert.ok(candidate.constructionTools>0)
      assert.equal(candidate.nativeProof,'NOT_RUN')
    }
  }
})
