import { STUDIO_THEME_PRESETS, STUDIO_PANEL_FINISHES } from './studioThemePresets.js'

// This module interprets requests only. The host must validate and dispatch any
// declared action using its existing settings callbacks.
const NORMALIZE = value => typeof value === 'string'
  ? value.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}#\s-]/gu, ' ').replace(/\s+/g, ' ').trim()
  : ''
const words = text => ` ${text} `
const has = (text, expression) => expression.test(text)
const basic = (type, extra = {}) => ({ type, target: 'studioCustomization.appearance', ...extra })
const themes = STUDIO_THEME_PRESETS.map(theme => ({ ...theme, search: NORMALIZE(theme.name), idSearch: NORMALIZE(theme.id.replace(/-/g, ' ')) }))
const categories = [...new Set(themes.map(theme => theme.category))]
const panelFinishes = STUDIO_PANEL_FINISHES.map(({ id, label, description }) => ({ id, name: label, description }))
const COLORS = {
  purple: ['Purple', 'Soft Color'], violet: ['Purple'], lilac: ['Purple'], lavender: ['Purple', 'Soft Color'],
  blue: ['Blue', 'Soft Color'], navy: ['Blue'], green: ['Nature', 'Soft Color'], mint: ['Nature', 'Soft Color'],
  pink: ['Pink', 'Soft Color'], rose: ['Pink', 'Soft Color'], cream: ['Cream & Linen', 'Light & Cream'],
  white: ['White & Paper', 'Light & Cream'], gray: ['Neutrals', 'Gray & Silver'], grey: ['Neutrals', 'Gray & Silver'],
  black: ['Neutrals'], brown: ['Earth'], earth: ['Earth'], orange: ['Warm'], yellow: ['Warm'],
  red: ['Warm', 'Pink'], neutral: ['Neutrals', 'Gray & Silver'],
}
const ALIASES = {
  'midnight blue': 'midnight', 'dark mode': 'graphite-night', 'light mode': 'pure-white-light',
  'soft cream': 'cream-light', 'pure white': 'pure-white-light', 'dark gray': 'graphite-night',
  'dark grey': 'graphite-night', 'deep purple': 'amethyst-night',
}
const UI = /\b(?:theme|themes|theming|appearance|interface|ui|app|application|software|settings|preferences|sidebar|sidebars|panel|panels|accent|chrome|skin|dark mode|light mode|palette|customi[sz]ation)\b/
const GARMENT = /\b(?:garment|fabric|shirt|hoodie|coat|jacket|dress|pants|trousers|jeans|pattern|material|textile|mesh|sewing|embroidery|swatch|outfit|model|avatar)\b/
const GUIDE = /\b(?:tutorial|walk me through|walk through|guide me|guided tour|show me how|teach me|explain how|step by step|how do i|how can i|demonstrate)\b/
const LIST = /\b(?:list|show|what|which|available|options|choices|browse|explore|find|search|other|more|compare|comparison|versus|vs|different|alternatives|recommend|suggest|filter)\b/
const APPLY = /\b(?:apply|set|switch|change|use|select|choose|pick|make|turn|update|give me|put|activate)\b/
const OPEN = /\b(?:open|go to|take me to|bring up|navigate to|where are|where is|find the|pull up)\b/
const CURRENT = /\b(?:current|currently|now|active|selected|using|on right now)\b/
const referencesPrior = text => /\b(?:that one|this one|it|the one|same one|last one|previous one)\b/.test(text)
const exactTheme = text => {
  const matches = themes.filter(theme => {
    const name = theme.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]+')
    const id = theme.idSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]+')
    return new RegExp(`\\b(?:${name}|${id})\\b`).test(text)
  }).sort((a,b) => {
    const matchLength = theme => text.includes(theme.search) ? theme.search.length : theme.idSearch.length
    return matchLength(b) - matchLength(a)
  })
  return matches[0] || null
}
const resolveTheme = (text, context) => {
  const named = exactTheme(text)
  if (named) {
    if (!named.id.endsWith('-night') && /\bnight\b/.test(text))
      return themes.find(theme => theme.id === `${named.id}-night`) || named
    return named
  }
  for (const [phrase,id] of Object.entries(ALIASES).sort((a,b) => b[0].length-a[0].length)) {
    if (words(text).includes(` ${phrase} `)) return themes.find(t => t.id === id) || null
  }
  if (referencesPrior(text)) {
    const id = context?.lastThemeId || context?.suggestedThemeId || context?.selectedThemeId
    return themes.find(t => t.id === id) || null
  }
  return null
}
const detectCategory = text => categories.find(category => words(text).includes(` ${NORMALIZE(category)} `)) || null
const detectColor = text => Object.keys(COLORS).find(color => new RegExp(`\\b${color}\\b`).test(text)) || null
const detectMode = text => has(text, /\b(?:light|bright|daytime)\b/) ? 'light' : has(text, /\b(?:dark|night)\b/) ? 'dark' : null
const option = theme => ({ id: theme.id, name: theme.name, category: theme.category, mode: theme.mode || (theme.id.endsWith('-night') ? 'dark' : 'dark'), accent: theme.accent, panelColor: theme.panelColor, sidebarColor: theme.sidebarColor })
const modeMatches = (theme, mode) => !mode || (mode === 'light' ? theme.mode === 'light' : theme.mode !== 'light')
const filteredThemes = (text, context = {}) => {
  const category = detectCategory(text)
  const color = detectColor(text)
  const mode = detectMode(text)
  const query = typeof context.query === 'string' && /\b(?:more|other|alternatives|show more)\b/.test(text)
    ? context.query : null
  const colorKey = color || (query ? detectColor(NORMALIZE(query)) : null)
  const categoryKey = category || (query ? detectCategory(NORMALIZE(query)) : null)
  const modeKey = mode || (query ? detectMode(NORMALIZE(query)) : null)
  const categoriesForColor = COLORS[colorKey] || null
  const matches = themes.filter(t => (!categoryKey || t.category === categoryKey) &&
    (!categoriesForColor || categoriesForColor.includes(t.category) || t.search.includes(colorKey)) &&
    modeMatches(t, modeKey) && (!colorKey || !categoriesForColor || colorKey === 'purple' || colorKey === 'blue' || colorKey === 'green' || colorKey === 'pink' || colorKey === 'cream' || colorKey === 'white' || colorKey === 'gray' || colorKey === 'grey' || colorKey === 'brown' || colorKey === 'earth' || colorKey === 'orange' || colorKey === 'red' || colorKey === 'neutral' || t.search.includes(colorKey)))
  return { matches, color: colorKey, category: categoryKey, mode: modeKey }
}

/** Describe only installed options, with optional category/mode/color filters. */
export function describeExoThemes20261102(options = {}) {
  const text = [options.query, options.color, options.category, options.mode].filter(Boolean).join(' ')
  const { matches, color, category, mode } = filteredThemes(NORMALIZE(text), options)
  const offset = Number.isSafeInteger(options.offset) ? Math.max(0, options.offset) : 0
  const limit = Number.isSafeInteger(options.limit) ? Math.max(1, Math.min(options.limit, 200)) : 24
  return { options: matches.slice(offset, offset + limit).map(option), total: matches.length,
    offset, hasMore: offset + limit < matches.length, filters: { color, category, mode },
    categories, panelFinishes }
}

/**
 * @param {string} request User utterance.
 * @param {{selectedThemeId?:string,lastThemeId?:string,suggestedThemeId?:string,query?:string,offset?:number,limit?:number,themeContext?:boolean}} context
 */
export function classifyExoThemeRequest20261102(request, context = {}) {
  const text = NORMALIZE(request)
  if (!text || text.length > 1000) return { type: 'unknown' }
  const previousThemeContext = context.themeContext === true || !!context.query
  const explicitUi = UI.test(text)
  const garment = GARMENT.test(text)
  // Clothing requests with 'color', 'palette' or 'look' should never set UI chrome.
  if (garment && !/\b(?:ui|interface|app|application|software|theme settings|appearance settings)\b/.test(text)) return { type: 'unknown' }
  const relevant = explicitUi || (previousThemeContext && (LIST.test(text) || APPLY.test(text)))
  if (!relevant) return { type: 'unknown' }
  const selectedTheme = themes.find(t => t.id === context.selectedThemeId)
  const found = resolveTheme(text, context)
  const panel = panelFinishes.find(finish => new RegExp(`\\b${finish.id}\\b`).test(text))
  const mentionsPanel = /\b(?:panel|panels|sidebar|sidebars|finish)\b/.test(text)
  const mentionsIcon = /\b(?:icon|icons)\b/.test(text)

  if (GUIDE.test(text)) return basic('tutorial', { topic: mentionsPanel ? 'panel' : mentionsIcon ? 'icon' : 'theme',
    action: 'openThemeSettings', steps: ['open-settings', 'select-theme-tab', 'inspect-options', 'choose-preview', 'apply-theme'],
    ...(found ? { id: found.id } : {}) })
  if (CURRENT.test(text) && /\b(?:what|which|tell|show|theme|appearance|using)\b/.test(text))
    return basic('explain', { topic: 'currentTheme', ...(selectedTheme ? { id: selectedTheme.id, theme: option(selectedTheme) } : { requiresCurrentTheme: true }) })
  if (mentionsIcon) return basic('explain', { topic: 'icons', supported: false,
    message: 'No standalone icon theme settings are declared in the installed theme presets.' })
  if (mentionsPanel && panel && APPLY.test(text)) return basic('apply', { topic: 'panelFinish', id: panel.id,
    action: 'setStudioPanelFinish', value: panel.id })
  if (mentionsPanel && (LIST.test(text) || /\b(?:available|options|finishes|types)\b/.test(text)))
    return basic('list', { topic: 'panelFinish', options: panelFinishes })
  if (mentionsPanel && APPLY.test(text)) return basic('open', { topic: 'panelFinish', action: 'openThemeSettings' })

  if (APPLY.test(text) && found) return basic('apply', { topic: 'theme', id: found.id, value: found.id,
    theme: option(found), action: 'setStudioTheme', tool: 'app.appearance.setTheme', operation: 'updateStudioCustomization' })

  const broad = filteredThemes(text, context)
  const wantsList = LIST.test(text) || /\b(?:show more|how many|all|list|options|choices|palette|themes)\b/.test(text)
  if (wantsList && !/\b(?:settings|preferences)\b/.test(text) || wantsList && /\b(?:themes|colors|colours|options|choices|available|more|compare|purple|blue|green|pink|light|dark)\b/.test(text)) {
    const offset = /\b(?:more|next)\b/.test(text) && previousThemeContext ? (context.offset || 0) + (context.limit || 24) : 0
    const page = describeExoThemes20261102({ query: text, offset, limit: context.limit })
    return basic('list', { topic: 'theme', ...page, query: text,
      ...(found ? { highlightedId: found.id } : {}), comparison: /\b(?:compare|versus|vs|difference)\b/.test(text) })
  }
  if (found) return basic('explain', { topic: 'theme', id: found.id, theme: option(found) })
  if (OPEN.test(text) || APPLY.test(text) || /\bsettings\b/.test(text))
    return basic('open', { topic: 'theme', action: 'openThemeSettings', tab: 'theme' })
  if (broad.color || broad.category || broad.mode) return basic('list', { topic: 'theme', ...describeExoThemes20261102({ query: text }), query: text })
  return { type: 'unknown' }
}
