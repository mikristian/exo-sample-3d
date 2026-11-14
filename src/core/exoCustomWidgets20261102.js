// EXO custom widgets use a bounded data format. Never evaluate imported source.
export const EXO_WIDGET_STORAGE_KEY = 'exo.custom.widgets.v1'
export const EXO_WIDGET_VERSION = 1
export const EXO_WIDGET_MAX = 32
export const EXO_WIDGET_BLOCK_TYPES = Object.freeze(['text', 'metric', 'divider', 'button', 'status', 'progress'])
export const EXO_WIDGET_ACCENTS = Object.freeze(['blue', 'violet', 'teal', 'amber', 'neutral'])
const BLOCK_LIMIT = 20
export const EXO_WIDGET_MAX_JSON_BYTES = 32768
const text = (input, limit = 120) => typeof input === 'string' ? input.trim().slice(0, limit) : ''
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)
const plain = (value) => !!value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
const safeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : fallback

export function makeExoCustomWidget(overrides = {}) {
  const id = globalThis.crypto?.randomUUID?.() || `exo-widget-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return { version: EXO_WIDGET_VERSION, id, title: 'My custom widget', description: '', accent: 'blue', blocks: [{ type: 'text', label: 'Welcome', value: 'Create your own EXO panel.' }], ...overrides }
}

export function validateExoCustomWidget(input) {
  if (!plain(input)) throw new Error('Widget must be a JSON object.')
  if (own(input, 'version') && input.version !== EXO_WIDGET_VERSION) throw new Error('Unsupported widget format version.')
  const title = text(input.title, 64)
  if (!title) throw new Error('A widget title is required.')
  const id = text(input.id, 100)
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('Widget ID must contain only letters, numbers, _ or -.')
  if (!Array.isArray(input.blocks) || input.blocks.length > BLOCK_LIMIT) throw new Error(`Widgets support up to ${BLOCK_LIMIT} blocks.`)
  const blocks = input.blocks.map((block, index) => {
    if (!plain(block) || !EXO_WIDGET_BLOCK_TYPES.includes(block.type)) throw new Error(`Unsupported block at position ${index + 1}.`)
    const result = { type: block.type, label: text(block.label, 64) }
    if (block.type === 'divider') return result
    if (block.type === 'progress') return { ...result, value: safeNumber(block.value), detail: text(block.detail, 160) }
    if (block.type === 'button') {
      // Buttons may invoke only explicitly registered host commands. Imported JSON
      // cannot specify URLs, handlers, function bodies, HTML or arbitrary JS.
      const command = text(block.command, 100)
      if (command && !/^[a-zA-Z0-9._:-]+$/.test(command)) throw new Error('Button command has invalid characters.')
      return { ...result, command }
    }
    return { ...result, value: text(block.value, 240), detail: text(block.detail, 160) }
  })
  return { version: EXO_WIDGET_VERSION, id, title, description: text(input.description, 240), accent: EXO_WIDGET_ACCENTS.includes(input.accent) ? input.accent : 'blue', blocks }
}

export function parseExoCustomWidgetJson(source) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).byteLength > EXO_WIDGET_MAX_JSON_BYTES) throw new Error('Widget JSON must be under 32 KB.')
  let parsed
  try { parsed = JSON.parse(source) } catch { throw new Error('Invalid JSON. Paste a declarative widget object.') }
  return validateExoCustomWidget(parsed)
}

export function exportExoCustomWidgetJson(widget) {
  return JSON.stringify(validateExoCustomWidget(widget), null, 2)
}

export function readExoCustomWidgetLibrary(storage = globalThis.localStorage) {
  try {
    const serialized = storage?.getItem?.(EXO_WIDGET_STORAGE_KEY)
    if (!serialized || serialized.length > 1024 * 1024) return []
    const values = JSON.parse(serialized)
    if (!Array.isArray(values)) return []
    const seen = new Set()
    return values.slice(0, EXO_WIDGET_MAX).flatMap(value => {
      try {
        const item = validateExoCustomWidget(value)
        if (seen.has(item.id)) return []
        seen.add(item.id)
        return [item]
      } catch { return [] }
    })
  } catch { return [] }
}

export function saveExoCustomWidgetLibrary(widgets, storage = globalThis.localStorage) {
  if (!Array.isArray(widgets) || widgets.length > EXO_WIDGET_MAX) throw new Error(`Widget library limit is ${EXO_WIDGET_MAX}.`)
  const valid = widgets.map(validateExoCustomWidget)
  if (new Set(valid.map(item => item.id)).size !== valid.length) throw new Error('Duplicate widget IDs are not allowed.')
  if (!storage?.setItem) throw new Error('Local widget storage is unavailable.')
  storage.setItem(EXO_WIDGET_STORAGE_KEY, JSON.stringify(valid))
  return valid
}

export function importExoCustomWidgetJson(source, existing = []) {
  const widget = parseExoCustomWidgetJson(source)
  if (existing.some(item => item.id === widget.id)) return validateExoCustomWidget({ ...widget, id: makeExoCustomWidget().id })
  return widget
}

export async function importExoCustomWidgetFile(file, existing = []) {
  if (!file || typeof file.name !== 'string' || !/\.json$/i.test(file.name)) throw new Error('Choose a .json widget file.')
  if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > EXO_WIDGET_MAX_JSON_BYTES) throw new Error('Widget JSON file must be 32 KB or smaller.')
  if (typeof file.text !== 'function') throw new Error('Unable to read this widget file.')
  return importExoCustomWidgetJson(await file.text(), existing)
}
