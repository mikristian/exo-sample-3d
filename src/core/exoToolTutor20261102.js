import { RIGHT_PALETTE_TOOLS } from './exoExtraToolCatalog.js'
import { EXTRA_WORKSPACE_COMMANDS } from './workspaceCommandIndex.js'
import { ACCUMARK_2D_COMMANDS } from './accumark2dCommandRegistry.js'
import { EXO_GUIDES_20261102 } from './exoAssistantGuides20261102.js'

// Discovery is read-only. A visible control or declared route is not proof
// that its callback is installed in the current workspace.
const TOPICS = Object.freeze({
  pattern: { aliases: 'draft draw 2d curve seam notch pattern', guide: 'pattern', steps: ['Open Pattern or the 2D workspace.', 'Select the pattern piece and the required drawing or editing tool.', 'Inspect the result before saving.'] },
  grading: { aliases: 'grade grading size nest size run grading lines pom', guide: 'grading', steps: ['Open Grading and select the base pattern and size.', 'Choose size rules or point deltas, then inspect each graded size.', 'Check seams, notches, measurements and nest before export.'] },
  simulation: { aliases: '3d simulate simulation physics drape cloth fit', steps: ['Open the 3D workspace.', 'Arrange sewn pieces around the avatar and start simulation.', 'Inspect fit and strain before saving.'] },
  print: { aliases: 'print pdf tile tiled letter a4 8.5x11 pages pattern layout', steps: ['Open the Print Layout workspace.', 'Choose US Letter (8.5 × 11 in) and check scale is 100%.', 'Review page tiles, overlap, registration marks and the calibration square before exporting or printing.'] },
  techpack: { aliases: 'tech pack techpack specifications bom production sheet', guide: 'techpack', steps: ['Open Techpack Workspace.', 'Enter measurements, materials, construction notes and grading details from the current garment.', 'Review specification pages and export only after checking them.'] },
  fabric: { aliases: 'fabric material textile gsm swatch texture properties', guide: 'material', steps: ['Select the pattern piece.', 'Open Fabric or material properties.', 'Adjust the assignment and inspect appearance and drape.'] },
  sewing: { aliases: 'sew sewing seam stitch topstitch notch join', steps: ['Open Sewing tools and identify the edges to join.', 'Choose Free Sewing or the seam correspondence tool.', 'Check seam alignment and simulate the garment.'] },
  avatar: { aliases: 'avatar mannequin model fitting body hair poses', steps: ['Open the Avatar section.', 'Choose the model and adjust supported body or appearance controls.', 'Check garment fit against the selected avatar.'] },
  import: { aliases: 'import open dxf svg pattern file aama astm', steps: ['Open the import command or file menu.', 'Select a supported source format.', 'Inspect imported units, piece geometry and notches before editing.'] },
  export: { aliases: 'export save download dxf pdf file factory', steps: ['Open the export or production workspace.', 'Choose the required output format and verify units and size selection.', 'Review the output preview and production checks before downloading.'] },
  workspace: { aliases: 'workspace 2d 3d split panel library view', guide: 'basics', steps: ['Use the workspace selector or command search.', 'Select the 2D, 3D or split view.', 'Open the relevant tool panel.'] },
})

const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const words = value => normalize(value).split(/\s+/).filter(Boolean)
const topicFor = value => {
  const text = ` ${normalize(value)} `
  let best = 'workspace', points = 0
  for (const [key, topic] of Object.entries(TOPICS)) {
    const aliases = [key, ...topic.aliases.split(' ')]
    const score = aliases.reduce((n, alias) => n + (alias.length > 2 && text.includes(` ${alias} `) ? 1 : 0), 0)
    if (score > points) { best = key; points = score }
  }
  return best
}

function entry(id, label, domain, source, route, description = '') {
  return Object.freeze({ id, label, domain, source, route: Object.freeze(route), description })
}

export const EXO_TOOL_TUTOR_CATALOG_20261102 = Object.freeze([
  ...RIGHT_PALETTE_TOOLS.map(([id, label, action]) => entry(`palette.${id}`, label, topicFor(`${label} ${id}`), 'right-palette', action ? { kind: 'palette', action, controlId: id } : { kind: 'reference' })),
  ...EXTRA_WORKSPACE_COMMANDS.map(({ action, label, group }) => entry(action, label, topicFor(`${group} ${label}`), 'workspace-command', { kind: 'workspace', action })),
  ...ACCUMARK_2D_COMMANDS.map(({ id, label, domain, purpose, route }) => entry(id, label, topicFor(`${domain} ${label}`), 'accumark-registry', route, purpose)),
  ...Object.entries(EXO_GUIDES_20261102).map(([id, guide]) => entry(`guide.${id}`, guide.title, id === 'material' ? 'fabric' : id === 'basics' ? 'workspace' : id, 'assistant-guide', { kind: 'guide', guideId: id }, guide.intro)),
  entry('workspace.print-layout', 'Print Layout (tiled pattern pages)', 'print', 'assistant-workflow', { kind: 'navigation', target: 'print-layout' }, 'Page tiling and scale inspection for Letter and A4 printing.'),
  entry('workspace.techpack', 'Techpack Workspace', 'techpack', 'assistant-workflow', { kind: 'navigation', target: 'techpack' }),
  entry('workspace.avatar', 'Avatar section', 'avatar', 'assistant-workflow', { kind: 'navigation', target: 'avatar' }),
])

/** Verified means a caller provided *current* handler evidence. Registry and UI
 * declarations alone are discoverable but cannot be executed by this module. */
export function getExoToolCapability20261102(tool, handlers = {}) {
  if (!tool || !tool.route) return { status: 'unavailable', canExecute: false, reason: 'Unknown tool.' }
  const { kind, action, target } = tool.route
  if (kind === 'reference' || kind === 'guide') return { status: 'guidance-only', canExecute: false, reason: 'No executable action is declared.' }
  const evidence = handlers && typeof handlers === 'object' ? handlers : {}
  const available = kind === 'palette' ? evidence.paletteActions?.[action] === true
    : kind === 'workspace' ? evidence.workspaceActions?.[action] === true
    : kind === 'navigation' ? evidence.navigationTargets?.[target] === true
    : evidence.registryRoutes?.[tool.id] === true
  return available
    ? { status: 'available', canExecute: true, reason: 'Host confirmed a connected action for this session.' }
    : { status: 'unverified', canExecute: false, reason: 'The current workspace has not confirmed an action handler.' }
}

export function searchExoTools20261102(query, { domain, limit = 12, evidence = {} } = {}) {
  const terms = words(query).filter(w => !['how', 'do', 'i', 'the', 'a', 'to', 'can', 'me', 'please', 'show', 'where', 'is', 'for', 'with', 'help', 'use', 'tool'].includes(w))
  const bounded = Math.max(0, Math.min(50, Number.isFinite(limit) ? Math.trunc(limit) : 12))
  return EXO_TOOL_TUTOR_CATALOG_20261102.map((tool, index) => {
    if (domain && tool.domain !== domain) return null
    const label = normalize(tool.label), haystack = normalize(`${tool.id} ${tool.label} ${tool.domain} ${tool.description}`)
    const matching = terms.filter(term => haystack.includes(term))
    if (terms.length && !matching.length) return null
    const score = matching.reduce((s, term) => s + (label.includes(term) ? 5 : 1), 0) + (terms.length && matching.length === terms.length ? 6 : 0)
    return { ...tool, capability: getExoToolCapability20261102(tool, evidence), score, index }
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, bounded)
}

export function answerExoToolQuestion20261102(question, { evidence = {}, limit = 5 } = {}) {
  const text = normalize(question).slice(0, 500)
  if (!text) return { kind: 'clarify', message: 'Which EXO tool or workflow would you like help with?', tools: [] }
  const domain = topicFor(text)
  const topic = TOPICS[domain]
  const actionRequested = /\b(do it|do this|for me|automatically|perform|execute|apply|make it|turn on|turn off)\b/.test(text)
  const tools = searchExoTools20261102(text, { domain, evidence, limit })
  const available = tools.filter(t => t.capability.canExecute)
  const message = actionRequested
    ? available.length ? `I found a connected ${domain} control: ${available[0].label}. It can be offered for execution after checking the current selection and action result.` : `I can explain the ${domain} workflow, but I cannot confirm an executable action in this workspace. Open the relevant controls or connect and verify the handler first.`
    : `To work with ${domain}: ${topic.steps.join(' ')} ` + (tools.length ? `Related controls: ${tools.slice(0, 3).map(t => t.label).join(', ')}.` : '')
  return { kind: actionRequested ? 'action-availability' : 'how-to', domain, message, steps: [...topic.steps], guideId: topic.guide || null, tools, canExecute: available.length > 0, executableToolId: available[0]?.id || null }
}
