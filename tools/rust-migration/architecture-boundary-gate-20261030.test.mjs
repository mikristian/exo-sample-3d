import test from 'node:test'
import assert from 'node:assert/strict'
import {buildRuntimeOwnershipAudit} from './runtime-ownership-audit.mjs'
import {evaluateArchitectureGraph} from './architecture-dependency-audit-20261030.mjs'
import {checkArchitectureBoundaries} from './architecture-boundary-gate-20261030.mjs'

const inspect=sources=>checkArchitectureBoundaries(
  evaluateArchitectureGraph(buildRuntimeOwnershipAudit(sources,['src/main.jsx'])))

test('an isolated clean domain module has no new violations',()=>{
  assert.equal(inspect({
    'src/main.jsx': "import './components/Drawing.jsx'",
    'src/components/Drawing.jsx':"import '../core/math.js'",
    'src/core/math.js':'export const mm = 1',
  }).ok,true)
})

test('new core imports of presentation code are refused',()=>{
  const result=inspect({
    'src/main.jsx':"import './core/mistake.js'",
    'src/core/mistake.js':"import '../components/Panel.jsx'",
    'src/components/Panel.jsx':'export const Panel = 1'
  })
  assert.equal(result.ok,false)
  assert.equal(result.issues[0].code,'NEW_CORE_TO_UI_DEPENDENCY')
})

test('new synchronous cycles are refused',()=>{
  const result=inspect({
    'src/main.jsx':"import './core/a.js'",
    'src/core/a.js':"import './b.js'",
    'src/core/b.js':"import './a.js'",
  })
  assert.equal(result.ok,false)
  assert.equal(result.issues[0].code,'NEW_SYNCHRONOUS_IMPORT_CYCLE')
})
