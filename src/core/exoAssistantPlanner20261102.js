import { ASSISTANT_ACTIONS, interpretAssistantIntent } from './assistantActions.js'
import { classifyExoCompanionCommand } from './exoCompanionCommands20261102.js'
import { interpretExoCompanionWorkflow20261102 } from './exoCompanionWorkflow20261102.js'

// A proposal only. Executable commands still require the caller's existing
// selection, permission, history and availability guards.
const ACTIONS = new Map(ASSISTANT_ACTIONS.map(item => [item.id, item]))
const PHASES = Object.freeze([
  { id: 'draft', label: 'Draft garment pattern', test: /\b(draft|create|make|design|build)\b.*\b(pattern|hoodie|shirt|tee|pants|garment)\b|\b(pattern|hoodie|shirt|tee|pants|garment)\b.*\b(draft|create|make|design|build)\b/i, prerequisite: [], capability: 'pattern.loadOutline' },
  { id: 'grade', label: 'Grade pattern sizes', test: /\b(grad(?:e|ing)|size run|size range|xs\s*(?:to|through|-)\s*xl)\b/i, prerequisite: ['draft'], capability: null },
  { id: 'techpack', label: 'Prepare tech pack', test: /\b(tech\s*pack|technical pack|spec sheet|bill of materials|\bbom\b)\b/i, prerequisite: ['draft'], capability: null },
  { id: 'quality', label: 'Review production quality', test: /\b(quality|\bqa\b|quality check|inspect|verify|preflight|check measurements|factory ready)\b/i, prerequisite: [], capability: null },
  { id: 'campaign', label: 'Plan campaign', test: /\b(campaign|moodboard|photoshoot|social content|launch plan|marketing)\b/i, prerequisite: [], capability: null },
  { id: 'tracking', label: 'Track project milestones', test: /\b(track|milestone|project status|timeline|progress report|task board|deadline)\b/i, prerequisite: [], capability: null },
])
const GARMENT = /\b(t[ -]?shirt|tee|shirt|hoodie|sweatshirt|pants|trousers)\b/i
const stopped = text => /^(?:please\s+)?(?:stop|cancel|abort|nevermind|never mind|pause)(?:\s+(?:it|that|now|please))?[!. ]*$/i.test(text)
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

export function getExoAssistantCapabilityRegistry20261102() {
  return ASSISTANT_ACTIONS.map(item => ({ id: item.id, mutates: Boolean(item.mutates),
    requiresFile: Boolean(item.requiresFile), requiresValidation: true,
    execution: 'external', undo: item.mutates ? 'check-host-history' : 'not-applicable' }))
}

function operationForPhase(phase, raw, context) {
  if (phase.id !== 'draft') return null
  const workflow = interpretExoCompanionWorkflow20261102(raw, context)
  // Template drafting must never silently turn an offer into a create.
  if (workflow.kind !== 'create') return null
  return { action: 'pattern.loadOutline', args: { templateId: workflow.templateId } }
}

/** Deterministic dependency planner; never invokes tools or changes the project. */
export function planExoAssistantRequest20261102(input, { context = null, availableActions = null } = {}) {
  const raw = typeof input === 'string' ? input.trim() : ''
  if (!raw || raw.length > 2000) return { kind: 'invalid', steps: [], executable: false, requiresReview: false }
  if (stopped(raw)) return { kind: 'cancel', steps: [], executable: false, requiresReview: false }
  const allow = availableActions === null ? new Set(ACTIONS.keys()) : new Set(Array.isArray(availableActions) ? availableActions : [])
  const phases = PHASES.filter(phase => phase.test.test(raw))
  const phaseIds = new Set(phases.map(phase => phase.id))
  if (phaseIds.has('grade') && GARMENT.test(raw) && !phaseIds.has('draft')) {
    // Existing pattern may be supplied by host; an implicit prerequisite is a check.
    phases.unshift({ id: 'source', label: 'Identify existing pattern and measurement chart', prerequisite: [], capability: null })
  }
  const steps = phases.map((phase, index) => {
    const operation = operationForPhase(phase, raw, context)
    const dependsOn = phase.prerequisite.filter(id => phaseIds.has(id))
    if (phase.id === 'grade' && phases.some(item => item.id === 'source')) dependsOn.unshift('source')
    const capability = operation?.action || phase.capability
    const supported = Boolean(operation && ACTIONS.has(operation.action) && allow.has(operation.action))
    return { id: phase.id, order: index + 1, label: phase.label, dependsOn,
      status: supported ? 'proposed' : 'unsupported', capability,
      action: supported ? operation : null,
      reason: supported ? null : capability && !allow.has(capability) ? 'Capability unavailable in this session' :
        phase.id === 'draft' ? 'Specify a supported template and explicitly request creation' :
        'No verified assistant execution command for this workflow',
      validation: supported ? ['Verify selected project and template', 'Check host permissions and command result'] : ['Human review or verified integration required'],
      undo: supported ? 'Use host history only if action confirms undo support' : 'No action performed',
    }
  })
  if (!steps.length) {
    const simple = interpretAssistantIntent(raw) || null
    const companion = classifyExoCompanionCommand(raw)
    const operation = simple && ACTIONS.has(simple.action) ? { action: simple.action, args: simple.args || {} } : null
    const supported = Boolean(operation && allow.has(operation.action))
    if (operation || companion.type !== 'unknown') steps.push({ id: 'command', order: 1,
      label: 'Review requested workspace command', dependsOn: [], status: supported ? 'proposed' : 'unsupported',
      capability: operation?.action || companion.tool || companion.operation || null,
      action: supported ? operation : null, reason: supported ? null : 'No verified executable assistant action',
      validation: ['Check current selection, permissions and host command result'], undo: 'Check host history before undo' })
  }
  if (!steps.length) steps.push({ id: 'unrecognized', order: 1, label: 'Clarify requested operation', dependsOn: [], status: 'unsupported', capability: null,
    action: null, reason: 'No deterministic workflow matched', validation: ['Clarify intent'], undo: 'No action performed' })
  return { kind: 'plan', steps, executable: steps.some(step => step.status === 'proposed'),
    requiresReview: true, executionState: 'not-started' }
}

/** Accept host receipts only for proposed steps, never infer completion from a plan. */
export function auditExoAssistantPlan20261102(plan, receipts = []) {
  const validReceipts = Array.isArray(receipts) ? receipts : []
  const steps = (Array.isArray(plan?.steps) ? plan.steps : []).map(step => {
    const receipt = validReceipts.find(item => item && item.stepId === step.id && item.action === step.action?.action)
    if (step.status !== 'proposed' || !receipt) return { ...step, execution: 'not-executed' }
    if (receipt.ok === true && receipt.validated === true && typeof receipt.receiptId === 'string' && receipt.receiptId.trim()) {
      return { ...step, execution: 'confirmed', receiptId: receipt.receiptId }
    }
    return { ...step, execution: 'unverified' }
  })
  return { steps, confirmed: steps.filter(step => step.execution === 'confirmed').length,
    pending: steps.filter(step => step.execution !== 'confirmed').length }
}

export function compareExoProjectVersions20261102(before = {}, after = {}) {
  const oldValue = before && typeof before === 'object' && !Array.isArray(before) ? before : {}
  const newValue = after && typeof after === 'object' && !Array.isArray(after) ? after : {}
  const fields = [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])].sort()
  return fields.filter(field => !Object.is(oldValue[field], newValue[field]) &&
    JSON.stringify(oldValue[field]) !== JSON.stringify(newValue[field])).map(field => ({ field,
      kind: !own(oldValue, field) ? 'added' : !own(newValue, field) ? 'removed' : 'changed',
      before: own(oldValue, field) ? oldValue[field] : undefined,
      after: own(newValue, field) ? newValue[field] : undefined }))
}
