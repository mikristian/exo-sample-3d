import { ASSISTANT_ACTIONS } from './assistantActions.js'

// Provider text is untrusted. Only descriptors matching the existing editor
// command registry reach the host-supplied executor.
const ACTIONS = new Map(ASSISTANT_ACTIONS.map(item => [item.id, item]))
const CATEGORIES = ['Garment', 'Avatar', 'Hanger', 'Fabric', 'Hardware and Trims', 'Material', 'Stage', 'Patterns']
const ARGUMENTS = Object.freeze({
  'library.open': { category: CATEGORIES },
  'workspace.view': { layout: ['2d', '3d', 'split'] },
  'pattern.importSvg': {},
  'pattern.loadOutline': { templateId: 'id' },
  'fabric.apply': { presetId: 'id' },
  'stage.select': { stageId: 'id' },
  'hanger.select': { hangerId: 'id' },
  'simulation.start': {}, 'simulation.reset': {}, 'project.save': {},
  'history.undo': {}, 'history.redo': {}, 'render.exportStill': {},
})
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
const id = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value)

export function normalizeExoCompanionProvider20261102(value) {
  if (typeof value !== 'string') return null
  const name = value.trim().toLowerCase()
  if (['openai', 'chatgpt', 'gpt'].includes(name)) return 'openai'
  if (['claude', 'anthropic'].includes(name)) return 'claude'
  if (['local', 'offline', 'on-device'].includes(name)) return 'local'
  return null
}

/** Validate a single structured provider proposal; never parse executable text. */
export function normalizeExoCompanionProviderProposal20261102(response) {
  if (!plain(response)) return { ok: false, error: 'Provider response must be an object.' }
  const provider = normalizeExoCompanionProvider20261102(response.provider)
  if (!provider) return { ok: false, error: 'Unknown provider.' }
  const proposed = response.proposedAction ?? response.action
  if (!plain(proposed)) return { ok: false, provider, error: 'Missing structured action.' }
  const action = proposed.id ?? proposed.action
  if (typeof action !== 'string' || !ACTIONS.has(action) || !Object.hasOwn(ARGUMENTS, action))
    return { ok: false, provider, error: 'Action is not allowed.' }
  const args = proposed.args ?? {}
  if (!plain(args)) return { ok: false, provider, error: 'Action arguments must be an object.' }
  const shape = ARGUMENTS[action]
  if (Object.keys(args).some(key => !Object.hasOwn(shape, key)))
    return { ok: false, provider, error: 'Unexpected action argument.' }
  for (const [key, rule] of Object.entries(shape)) {
    if (!Object.hasOwn(args, key) || !(Array.isArray(rule) ? rule.includes(args[key]) : id(args[key])))
      return { ok: false, provider, error: `Invalid ${key}.` }
  }
  // File imports require a separately validated host file selection; a model
  // cannot provide a local file path, bytes, or URL through this protocol.
  if (ACTIONS.get(action).requiresFile)
    return { ok: false, provider, error: 'File action requires the host file picker.' }
  return { ok: true, provider, action, args: { ...args }, mutates: ACTIONS.get(action).mutates === true }
}

/**
 * The host must supply executeAction({action,args,provider}) and explicitly
 * confirm `{ok:true}` after the editor actually handles the command.
 * A thrown error, boolean, undefined, or optimistic provider claim fails.
 */
export async function executeExoCompanionProviderProposal20261102(response, { executeAction } = {}) {
  const proposal = normalizeExoCompanionProviderProposal20261102(response)
  if (!proposal.ok) return { ok: false, status: 'rejected', provider: proposal.provider ?? null, error: proposal.error }
  const { provider, action, args } = proposal
  if (typeof executeAction !== 'function')
    return { ok: false, status: 'unavailable', provider, action, error: 'Host executor is not connected.' }
  try {
    const receipt = await executeAction({ provider, action, args: { ...args } })
    if (!plain(receipt) || receipt.ok !== true)
      return { ok: false, status: 'unconfirmed', provider, action, error: 'Editor did not confirm execution.' }
    return { ok: true, status: 'confirmed', provider, action, args, receipt: {
      ok: true, ...(id(receipt.id) ? { id: receipt.id } : {}),
      ...(typeof receipt.message === 'string' ? { message: receipt.message.slice(0, 500) } : {}),
    } }
  } catch (error) {
    return { ok: false, status: 'failed', provider, action,
      error: typeof error?.message === 'string' ? error.message.slice(0, 500) : 'Host execution failed.' }
  }
}
