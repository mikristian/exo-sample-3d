import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRuntimeOwnershipAudit } from './runtime-ownership-audit.mjs'
import { evaluateArchitectureGraph } from './architecture-dependency-audit-20261030.mjs'

test('reports actual synchronous cycles and avoids treating dynamic imports as cycles', () => {
  const sources = {
    'src/main.jsx': "import './components/A.jsx'",
    'src/components/A.jsx': "import './B.jsx'; import('../core/config.js')",
    'src/components/B.jsx': "export * from './A.jsx'",
    'src/core/config.js': "export const config = {}"
  }
  const result = evaluateArchitectureGraph(buildRuntimeOwnershipAudit(sources, ['src/main.jsx']))
  assert.deepEqual(result.cycles.largest, [['src/components/A.jsx', 'src/components/B.jsx']])
  assert.equal(result.cycles.filesInCycles, 2)
  assert.equal(result.potentialReachableFromBrowser, 4)
  assert.equal(result.boundaries.coreToComponentsReferenceCount, 0)
})

test('captures core to UI import breaches and stable coupling ranks', () => {
  const sources = {
    'src/main.jsx': "import './core/engine.js'",
    'src/core/engine.js': "import '../components/View.jsx'",
    'src/components/View.jsx': "export const View = 1",
    'src/core/other.js': "import '../components/View.jsx'"
  }
  const result = evaluateArchitectureGraph(buildRuntimeOwnershipAudit(sources, ['src/main.jsx']))
  assert.equal(result.boundaries.coreToComponentsReferenceCount, 2)
  assert.deepEqual(result.boundaries.coreToComponentsExamples.map(row => row.from),
    ['src/core/engine.js', 'src/core/other.js'])
  assert.deepEqual(result.coupling.topIncoming[0], { file: 'src/components/View.jsx', count: 2 })
  assert.equal(result.cycles.count, 0)
  assert.deepEqual(result, evaluateArchitectureGraph(
    buildRuntimeOwnershipAudit(Object.fromEntries(Object.entries(sources).reverse()), ['src/main.jsx'])))
})
