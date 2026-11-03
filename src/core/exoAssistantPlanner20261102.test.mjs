import test from 'node:test'
import assert from 'node:assert/strict'
import { planExoAssistantRequest20261102 as plan, auditExoAssistantPlan20261102 as audit,
  compareExoProjectVersions20261102 as compare, getExoAssistantCapabilityRegistry20261102 as registry } from './exoAssistantPlanner20261102.js'

test('complex fashion request follows dependencies and explicitly discloses unsupported actions', () => {
  const result = plan('Create a hoodie pattern now, grade XS to XL, prepare tech pack, quality check, plan campaign and track milestones')
  assert.deepEqual(result.steps.map(step => step.id), ['draft', 'grade', 'techpack', 'quality', 'campaign', 'tracking'])
  assert.deepEqual(result.steps[1].dependsOn, ['draft'])
  assert.deepEqual(result.steps[2].dependsOn, ['draft'])
  assert.equal(result.steps[0].action.action, 'pattern.loadOutline')
  assert.equal(result.steps[0].action.args.templateId, 'hoodie')
  assert.ok(result.steps.slice(1).every(step => step.status === 'unsupported' && step.action === null))
  assert.equal(result.executionState, 'not-started')
})

test('template drafting offer without explicit consent is not silently executed', () => {
  const result = plan('Make a hoodie pattern and grade it')
  assert.equal(result.steps[0].status, 'unsupported')
  assert.equal(result.steps[0].action, null)
  assert.equal(result.executable, false)
})

test('unavailable capabilities block execution, and unrelated single-step commands can be proposed', () => {
  assert.equal(plan('Create a hoodie pattern now', { availableActions: [] }).executable, false)
  const result = plan('Save project')
  assert.equal(result.steps[0].action.action, 'project.save')
  assert.equal(result.steps[0].status, 'proposed')
  assert.equal(registry().find(item => item.id === 'project.save').execution, 'external')
})

test('audit rejects invented, incomplete, failed and unsupported receipts', () => {
  const proposal = plan('Create a hoodie pattern now and grade XS to XL')
  assert.equal(audit(proposal).confirmed, 0)
  assert.equal(audit(proposal, [{ stepId: 'draft', action: 'pattern.loadOutline', ok: true }]).confirmed, 0)
  assert.equal(audit(proposal, [{ stepId: 'draft', action: 'pattern.loadOutline', ok: false, validated: true, receiptId: 'r1' }]).confirmed, 0)
  const result = audit(proposal, [
    { stepId: 'draft', action: 'pattern.loadOutline', ok: true, validated: true, receiptId: 'r1' },
    { stepId: 'grade', action: undefined, ok: true, validated: true, receiptId: 'r2' },
  ])
  assert.equal(result.confirmed, 1)
  assert.equal(result.steps[1].execution, 'not-executed')
})

test('cancellation and unknown input are safe and side-effect free', () => {
  assert.deepEqual(plan('stop').steps, [])
  assert.equal(plan('').kind, 'invalid')
  assert.equal(plan('quantum coat teleportation').steps[0].status, 'unsupported')
})

test('version comparison exposes changed, added and removed top-level fields', () => {
  assert.deepEqual(compare({ size: 'M', color: 'black' }, { size: 'L', style: 'hoodie' }).map(x => [x.field, x.kind]),
    [['color', 'removed'], ['size', 'changed'], ['style', 'added']])
  assert.deepEqual(compare({ sizes: ['S', 'M'] }, { sizes: ['S', 'M'] }), [])
})
