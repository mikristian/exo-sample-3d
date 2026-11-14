// UI-only projection of editor actions. A provider never decides whether an edit succeeded.
export const EXO_COMPANION_ACTION_PHASES_20261102 = Object.freeze(['thinking', 'planning', 'navigating', 'working', 'verified', 'failed'])

const TARGET_BY_TYPE = Object.freeze({
  createGarment: '2d-canvas', pattern: '2d-canvas', patternEdit: '2d-canvas',
  gradingNest: '2d-canvas', autoGrade: '2d-canvas', sewing: '2d-canvas',
  fabric: 'fabric-tool', hardware: '2d-canvas', simulation: '3d-canvas',
  avatar: '3d-canvas', render: '3d-canvas', animation: '3d-canvas',
  theme: 'settings-window', techpack: 'techpack-window',
  patternPrint: 'print-layout-window', library: 'library-window',
  widgets: 'widget-window', save: 'save',
})

const TARGET_BY_NAVIGATION = Object.freeze({
  pattern: '2d-canvas', grading: 'grading-tool', sewing: '2d-canvas',
  '2d': '2d-canvas', '3d': '3d-canvas', simulation: '3d-canvas',
  avatar: '3d-canvas', render: '3d-canvas', animation: '3d-canvas',
  techpack: 'techpack-window', library: 'library-window',
  settings: 'settings-window', theme: 'settings-window',
  print: 'print-layout-window', widgets: 'widget-window',
})

const LABELS = Object.freeze({
  thinking: 'Considering the editor request',
  planning: 'Preparing an editor action',
  navigating: 'Moving to the requested workspace',
  working: 'Applying the editor action',
  verified: 'Editor confirmed the action',
  failed: 'Editor could not confirm the action',
})

const validTarget = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(value)

export function describeExoCompanionActionAnimation20261102(intent = {}) {
  const action = intent && typeof intent === 'object' ? intent : {}
  const type = typeof action.type === 'string' ? action.type : 'unknown'
  const navigation = type === 'navigate' ? action.target : type === 'workspace' ? action.value : null
  const mapped = navigation == null ? TARGET_BY_TYPE[type] : TARGET_BY_NAVIGATION[navigation]
  const target = mapped || (validTarget(action.target) && type !== 'navigate' ? action.target : null)
  const possibleIds = Array.isArray(action.pieceIds) ? action.pieceIds : Array.isArray(action.affectedPieceIds) ? action.affectedPieceIds : []
  const pieceIds = [...new Set(possibleIds.filter(id => typeof id === 'string' && id.length > 0 && id.length <= 128))].slice(0, 100)
  // A named canvas target is not evidence that any piece was actually modified.
  return { type, target, pieceIds, isNavigation: type === 'navigate' || type === 'workspace' || action.action === 'open', intent: action }
}

export function createExoCompanionActionAnimation20261102(intent, executionId = null) {
  const action = describeExoCompanionActionAnimation20261102(intent)
  return { executionId, phase: 'thinking', target: action.target, pieceIds: [], requestedPieceIds: action.pieceIds,
    type: action.type, label: LABELS.thinking, confirmed: false, error: null, result: null }
}

/** The UI can navigate while awaiting an editor callback, but only an explicit
 * `{ok:true}` from that callback may put the character in verified state. */
export function advanceExoCompanionActionAnimation20261102(state, phase, detail = {}) {
  if (!state || !EXO_COMPANION_ACTION_PHASES_20261102.includes(phase)) return state
  if (detail.executionId != null && detail.executionId !== state.executionId) return state
  if (state.phase === 'verified' || state.phase === 'failed') return state
  const result = detail.result
  if (phase === 'verified' && (!result || result.ok !== true)) return state
  if (phase === 'failed' && result?.ok === true) return state
  const target = validTarget(result?.target) ? result.target : state.target
  const confirmed = phase === 'verified'
  const reportedIds = Array.isArray(result?.affectedPieceIds) ? result.affectedPieceIds :
    Array.isArray(result?.pieceIds) ? result.pieceIds : []
  const approvedIds = [...new Set(reportedIds.filter(id => typeof id === 'string' && id.length > 0 && id.length <= 128))].slice(0, 100)
  return { ...state, phase, target, confirmed, pieceIds: confirmed ? approvedIds : [],
    error: phase === 'failed' ? String(detail.error?.message || detail.error || result?.message || 'The editor did not confirm the operation.') : null,
    label: LABELS[phase], result: phase === 'verified' || phase === 'failed' ? result ?? null : null }
}

/** Call with the actual EXO editor callback; onState receives animation snapshots.
 * Missing callbacks, thrown errors and ambiguous results all end in failed. */
export async function executeExoCompanionAnimatedAction20261102(intent, execute, { onState, executionId = null } = {}) {
  let state = createExoCompanionActionAnimation20261102(intent, executionId)
  const emit = () => { if (typeof onState === 'function') onState(state) }
  emit()
  const step = phase => { state = advanceExoCompanionActionAnimation20261102(state, phase); emit() }
  step('planning')
  if (describeExoCompanionActionAnimation20261102(intent).isNavigation) step('navigating')
  step('working')
  try {
    if (typeof execute !== 'function') throw new Error('The editor action is not connected.')
    const result = await execute(intent)
    state = advanceExoCompanionActionAnimation20261102(state, result?.ok === true ? 'verified' : 'failed', { result })
    emit()
    return { state, result: result ?? { ok: false, message: 'The editor did not confirm the operation.' } }
  } catch (error) {
    state = advanceExoCompanionActionAnimation20261102(state, 'failed', { error })
    emit()
    return { state, result: { ok: false, message: state.error } }
  }
}
