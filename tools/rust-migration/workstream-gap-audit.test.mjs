import test from 'node:test'
import assert from 'node:assert/strict'
import { scopeMatches, subsystem, summarizeCoverage } from './workstream-gap-audit.mjs'

test('directory, exact and wildcard scopes match without crossing directories', () => {
  assert.equal(scopeMatches('src/core/a.js','src/core/'),true)
  assert.equal(scopeMatches('src/core/a.js','src/core/a.js'),true)
  assert.equal(scopeMatches('src/core/a.js','src/core/a'),false)
  assert.equal(scopeMatches('src/core/rustAnchorKernel.js','src/core/rust*Kernel.js'),true)
  assert.equal(scopeMatches('src/core/rust/nestedKernel.js','src/core/rust*Kernel.js'),false)
  assert.equal(scopeMatches('src/components/App.jsx','src/core/'),false)
  assert.equal(subsystem('integrations/clothcraft/server.mjs'),'integrations/clothcraft')
  assert.equal(subsystem('src/App.jsx'),'src/root')
})
test('unmapped totals, overlapping scopes and zero-coverage workstreams', () => {
  const workstreams=Array.from({length:20},(_,i)=>({
    id:'W'+String(i+1).padStart(2,'0'),name:'lane'+i,
    scope:i===0?['src/core/']:i===1?['src/core/math.js']:['missing/'+i+'/']
  }))
  const inventory={records:[
    {file:'src/core/math.js',lang:'javascript',lines:20,category:'production-code'},
    {file:'src/App.jsx',lang:'javascript',lines:30,category:'production-code'},
    {file:'native_cpp/core/sim.cpp',lang:'cpp',lines:50,category:'production-code'},
    {file:'src/core/test.js',lang:'javascript',lines:999,category:'qa-or-fixture'},
  ]}
  const r=summarizeCoverage(inventory,{workstreams})
  assert.equal(r.productionFiles,3)
  assert.equal(r.productionLines,100)
  assert.equal(r.unassignedFiles,2)
  assert.equal(r.unassignedLines,80)
  assert.equal(r.assignedLineSharePercent,20)
  assert.deepEqual(r.overlaps[0].workstreams,['W01','W02'])
  assert.equal(r.zeroProductionCoverageWorkstreams.length,18)
  assert.deepEqual(r.unmappedByLanguage.map(x=>x.language),['cpp','javascript'])
  assert.deepEqual(r.topUnassigned.map(x=>x.file),['native_cpp/core/sim.cpp','src/App.jsx'])
})
test('rejects malformed 20-lane configuration', () => {
  assert.throws(()=>summarizeCoverage({records:[]},{workstreams:[]}),/20/)
})
