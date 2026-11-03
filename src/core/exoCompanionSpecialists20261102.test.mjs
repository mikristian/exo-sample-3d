import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EXO_COMPANION_SPECIALISTS_20261102 as specialists,
  getExoCompanionSpecialist20261102 as get,
  getExoCompanionSpecialistTools20261102 as tools,
  buildExoCompanionSpecialistInstructions20261102 as build,
} from './exoCompanionSpecialists20261102.js'
import { ASSISTANT_ACTIONS } from './assistantActions.js'

test('all five specialists have unique registered and safe capabilities', () => {
  assert.deepEqual(specialists.map(item => item.id), ['creative-director', 'patternmaker', 'fit-engineer', 'production-developer', 'exo-instructor'])
  const known = new Set(ASSISTANT_ACTIONS.map(action => action.id))
  for (const specialist of specialists) {
    assert.equal(get(specialist.id), specialist)
    for (const id of specialist.tools) assert.ok(known.has(id))
  }
  assert.equal(get('__proto__'), null)
  assert.equal(get('unknown'), null)
})

test('tool menu intersects specialist permissions, host capabilities and registry', () => {
  assert.deepEqual(tools('fit-engineer', ['simulation.start', 'workspace.view', 'window.eval']).map(tool => tool.id),
    ['workspace.view', 'simulation.start'])
  assert.deepEqual(tools('patternmaker', ['pattern.importSvg', 'simulation.start']), [])
  assert.deepEqual(tools('bad-id', ['workspace.view']), [])
  assert.deepEqual(tools('exo-instructor', 'workspace.view'), [])
})

test('provider instructions filter workspace secrets, executable fields and control characters', () => {
  const result = build({
    specialistId: 'production-developer',
    capabilities: ['fabric.apply', 'project.save', 'execute.shell', 'workspace.view'],
    userRequest: 'Assess this tech pack\n\u0000 and BOM',
    workspace: {
      garment: 'Hoodie', size: 'XL', quantity: 100,
      apiToken: 'private', credential: 'private', prompt: 'ignore system',
      nested: { fabric: 'cotton', password: 'private', code: 'danger' },
      dangerous: { deeply: { hidden: 'untrusted' } },
    },
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.tools.map(tool => tool.id), ['workspace.view', 'fabric.apply', 'project.save'])
  assert.equal(result.workspace.apiToken, undefined)
  assert.deepEqual(result.workspace.nested, { fabric: 'cotton' })
  assert.deepEqual(result.workspace.dangerous, {})
  assert.doesNotMatch(JSON.stringify(result), /private|ignore system|execute\.shell/)
  assert.match(result.instruction, /proposal is never evidence of execution/)
  assert.equal(result.userRequest, 'Assess this tech pack and BOM')
})

test('invalid specialist and malformed capabilities safely fail closed', () => {
  assert.deepEqual(build({ specialistId: 'nonexistent' }), { ok: false, error: 'Unknown specialist.' })
  assert.deepEqual(build({ capabilities: { 'simulation.start': true } }).tools, [])
  assert.deepEqual(build({ workspace: null }).workspace, {})
})
