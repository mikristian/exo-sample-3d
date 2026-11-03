import { STUDIO_THEME_PRESETS } from './studioThemePresets.js'

// Pure parser: callers decide whether and how to perform each action. No UI or
// project state is modified here. `operation` names reflect actual App.jsx
// controls; `tool` names correspond to its automation command registry.
const THEMES = STUDIO_THEME_PRESETS.map(({ id, name }) => ({
  id, phrase: name.toLowerCase().replace(/\b(studio|night)\b/g, '').trim(),
}))
const AVATARS = [
  ['clo-thomas', /\b(?:clo\s*thomas|thomas)\b/],
  ['makehuman-base', /\b(?:make\s*human|makehuman)(?:\s*base)?\b/],
  ['theo', /\btheo\b/], ['nora', /\bnora\b/],
]
const ACTION = /\b(?:show|open|go|switch|change|set|make|select|choose|use|add|insert|place|edit|adjust|apply|assign|replace|attach|create|start|begin|launch|display|hide|remove|disable|enable|turn|toggle|close|stop|exit|take|bring|view|give|pull)\b/
const NEST = /\b(?:nest(?:ed|ing)?|grading|grade|size\s*run)\b/
const LINES = /\b(?:lines?|outlines?|overlays?|guides?|display|visibility|nest(?:ed|ing)?)\b/

const normalize = input => typeof input === 'string'
  ? input.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/\b2[\s-]*d\b/g, '2d').replace(/\b3[\s-]*d\b/g, '3d').replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim()
  : ''

const intent = (type, fields = {}) => ({ type, ...fields })
const nav = (target, fields = {}) => intent('navigate', { target, ...fields })
const unsupported = () => intent('unknown')

/** Convert workflow step descriptors into supported App callback invocations.
 * Explicit execution is delegated to the host and always checks its result. */
export async function executeExoCompanionWorkflowStep20261102(step,handlers={},options={}){
  if(!step||typeof step!=='object'||!step.action||typeof step.action!=='object')return {ok:false,message:'Invalid workflow step.'}
  const {type,value,target,action,sizes}=step.action
  if(type==='createGarment'){
    const templateId=options.templateId
    if(!['tee','hoodie','pants'].includes(templateId))return {ok:false,message:'Choose a supported foundation garment first.'}
    if(!options.confirmed)return {ok:false,needsConfirmation:true,message:'Confirm before replacing the active foundation pattern.'}
    if(typeof handlers.onCreateGarment!=='function')return {ok:false,message:'Pattern creation is not connected.'}
    try{return await handlers.onCreateGarment(templateId)}catch(error){return {ok:false,message:String(error?.message||'Pattern creation failed.')}}
  }
  const allowed=(type==='workspace'&&['2d','3d','split','stack'].includes(value))||
    (type==='gradingNest'&&typeof value==='boolean')||
    (type==='autoGrade'&&Array.isArray(sizes)&&sizes.length===6&&['XS','S','M','L','XL','XXL'].every((size,index)=>sizes[index]===size))||
    (type==='navigate'&&['grading','techpack','sewing'].includes(target))||
    (type==='fabric'&&action==='open')
  if(!allowed)return {ok:false,message:'This workflow action is not available.'}
  const callback=handlers.onCompanionAction
  if(typeof callback!=='function')return {ok:false,message:'Editor controls are not connected.'}
  // The existing App handler supports the first three actions; grading and
  // sewing can use the existing navigation handler until connected in App.
  if(type==='navigate'&&['grading','sewing'].includes(target)){
    if(typeof handlers.onNavigate!=='function')return {ok:false,message:`${target} navigation is not connected.`}
    try{
      const result=await handlers.onNavigate(target)
      return result?.ok===false?result:{ok:true,target}
    }catch(error){return {ok:false,message:String(error?.message||'Navigation failed.')}}
  }
  try{return await callback({...step.action})||{ok:false,message:'The editor did not confirm the action.'}}
  catch(error){return {ok:false,message:String(error?.message||'Workflow action failed.')}}
}

function requestedNestState(text) {
  // Preserve explicit user direction, even if the current state is unknown.
  if (/\b(?:turn|switch|set|make)\s+(?:the\s+)?(?:nest|grading|grade)?\s*(?:lines?\s+)?(?:off|on)\b/.test(text)) {
    return /\b(?:off)\b/.test(text) ? false : true
  }
  if (/\b(?:off|hide|remove|disable|invisible|without|clear)\b/.test(text)) return false
  if (/\b(?:on|show|enable|display|visible)\b/.test(text)) return true
  return null
}

function extractTheme(text) {
  const explicitNight = /\b(?:night|dark)\b/.test(text)
  const explicitDay = /\b(?:day|light)\b/.test(text)
  const alias = { 'black': 'obsidian', 'dark gray': 'graphite', 'grey': 'graphite', 'gray': 'graphite',
    'blue': 'midnight', 'green': 'forest', 'purple': 'violet', 'pink': 'rose',
    'brown': 'espresso', 'orange': 'coral', 'white': 'pure-white-light',
    'cream': 'cream-light', 'red': 'garnet', 'yellow': 'amber',
    'light mode': 'pure-white-light', 'dark mode': 'graphite-night' }
  const hits = THEMES.filter(theme => new RegExp(`\\b${theme.phrase.replace(/[-\s]+/g, '[\\s-]+')}\\b`).test(text))
  if (hits.length) {
    const longest = hits.sort((a, b) => b.phrase.length - a.phrase.length)[0]
    const requested = explicitNight && !longest.id.endsWith('-night') &&
      STUDIO_THEME_PRESETS.some(theme => theme.id === `${longest.id}-night`)
      ? `${longest.id}-night` : longest.id
    return requested
  }
  for (const [phrase, id] of Object.entries(alias).sort((a, b) => b[0].length - a[0].length)) {
    if (new RegExp(`\\b${phrase}\\b`).test(text)) {
      if (explicitNight && STUDIO_THEME_PRESETS.some(theme => theme.id === `${id}-night`)) return `${id}-night`
      if (explicitDay && STUDIO_THEME_PRESETS.some(theme => theme.id === `${id}-light`)) return `${id}-light`
      return id
    }
  }
  return null
}

/**
 * Convert an utterance into a single safe, declarative command. Returns
 * {type:'unknown'} for ambiguous input. An action is only a request; the caller
 * must validate availability, selection and permissions before execution.
 */
export function classifyExoCompanionCommand(input) {
  const text = normalize(input)
  if (!text || text.length > 1000) return unsupported()

  // Help and stop are handled before other targets to avoid accidentally
  // starting work when the user cancels an ongoing companion operation.
  if (/^(?:please\s+)?(?:stop|cancel|abort|nevermind|never mind|pause|shut up|be quiet|that's enough|exit tutorial)(?:\s+(?:it|that|now|please|the tour|tutorial|animation|assistant))?$/.test(text))
    return intent('stop', { target: 'companion' })
  if (/\b(?:celebrate|celebration|confetti|we did it|good job|task complete)\b/.test(text)) return intent('celebrate')
  if (/\b(?:tutorial|walk me through|guided tour|show me around|teach me (?:the app|how)|onboarding)\b/.test(text)) return intent('tour', { target: 'workspace' })

  // Physical page printing is already an EXO production workspace. Opening it
  // and configuring sheets are verified operations; printing stays a user action.
  if (/\b(?:print|printing|printer|pdf|paper|tile|tiled|taping|sheets|pages)\b/.test(text) &&
      /\b(?:pattern|garment|pieces|pages|sheets|letter|a4|8\s*(?:point\s*5|5)?\s*(?:by|x)\s*11|8\s*5\s*x\s*11|print layout)\b/.test(text) &&
      /\b(?:print|prepare|format|split|tile|paginate|set|make|open|show|export|download|need|want|how|help)\b/.test(text)) {
    const paper=/\b(?:8\s*(?:point\s*5|5)?\s*(?:by|x)\s*11|8\s*5\s*x\s*11|letter|us letter)\b/.test(text)?'Letter':/\ba4\b/.test(text)?'A4':null
    const orientation=/\blandscape\b/.test(text)?'landscape':/\bportrait\b/.test(text)?'portrait':null
    return intent('patternPrint',{target:'print-layout',operation:'enterPrintLayoutWorkspace',paper,orientation,scale:100})
  }

  // Nest grading lines are distinct from graded pattern geometry.
  const nestMention = NEST.test(text) && LINES.test(text)
  if (nestMention && (ACTION.test(text) || /\b(?:off|on)\b/.test(text))) {
    const value = requestedNestState(text)
    return intent('gradingNest', {
      target: 'showGradeNest', value,
      operation: value === null ? 'toggleShowGradeNest' : 'setShowGradeNest',
    })
  }

  // Treat 'theme' settings as more specific than general settings navigation.
  // Garment and avatar color changes belong to their own editors. An
  // ambiguous color command must never silently recolor the application UI.
  const garmentColorContext=/\b(?:hoodie|t shirt|shirt|garment|fabric|materials|pants|jacket|dress|embroidery|thread|pattern piece|avatar)\b/.test(text)&&
    !/\b(?:theme|ui|interface|app|software|theme settings|appearance settings)\b/.test(text)
  const themeContext = !garmentColorContext&&/\b(?:theme|color|colour|palette|appearance|interface|ui|skin|look|mode)\b/.test(text)
  const themeRequest = /\b(?:change|make|set|switch|use|apply|turn|choose|pick|want|give|update|put)\b/.test(text)
  const theme = themeContext && themeRequest ? extractTheme(text) : null
  if (theme) return intent('theme', { target: 'studioCustomization.appearance.theme', value: theme, tool: 'app.appearance.setTheme', operation: 'updateStudioCustomization' })
  if (/\b(?:settings?|preferences|customi[sz]e)\b/.test(text) && ACTION.test(text) &&
      (!/\b(?:fabric|material|zipper|button|hardware|trim|avatar)\b/.test(text) ||
       /^\s*(?:open|show|go to|view)\s+(?:the\s+)?(?:avatar|fabric|material|zipper|button|hardware|trim)\s+settings\b/.test(text)))
    return nav('settings', { tab: /\b(?:theme|colour|color|palette|appearance)\b/.test(text) ? 'theme' : 'workspace', operation: 'setStudioSettingsOpen' })
  if (themeContext && /\b(?:open|show|go|view|find|where|edit|adjust)\b/.test(text) && !/\b(?:change|make|set|switch|use|apply|turn|choose|pick|want|give|update|put)\b/.test(text))
    return nav('settings', { tab: 'theme', operation: 'setStudioSettingsOpen' })
  if(themeContext && themeRequest && /\b(?:theme|appearance|palette|interface)\b/.test(text) &&
      (/\b(?:another|different|new|other|some|which|what)\b/.test(text) ||
       /^(?:please )?(?:change|set|choose|pick|edit|open) (?:the )?(?:theme|theme color|appearance|palette)$/.test(text)))
    return nav('settings',{tab:'theme',operation:'setStudioSettingsOpen'})

  const split = /\b(?:split(?:\s+screen|\s+view|\s+workspace|\s+mode)?|side\s+by\s+side|both\s+(?:views?|windows?|2d|3d)|2d\s+(?:and|&|plus)\s+3d|3d\s+(?:and|&|plus)\s+2d)\b/.test(text)
  const stack = /\b(?:stack(?:ed)?(?:\s+(?:view|layout|workspace))?|top\s+and\s+bottom)\b/.test(text)
  const twoD = /\b(?:2d|two\s+dimensional|pattern\s+workspace|pattern\s+view)\b/.test(text)
  const threeD = /\b(?:3d|three\s+dimensional|3d\s+viewport|3d\s+workspace)\b/.test(text)
  const viewAction = /\b(?:view|workspace|window|layout|mode|screen|canvas|panel|viewport|open|show|switch|go|change|take|bring|display|zoom)\b/.test(text)
  if (viewAction && (split || stack || twoD || threeD) &&
      !/\b(?:model|avatar|fabric|material|pattern\s+piece|export|render|simulation|hair|rotate|turntable|turn|spin)\b/.test(text)) {
    const value = split ? 'split' : stack ? 'stack' : twoD && !threeD ? '2d' : threeD && !twoD ? '3d' : null
    if (value) return intent('workspace', { target: 'viewportLayout', value, tool: 'app.workspace.setLayout', operation: 'setViewportLayout' })
  }

  if (/\b(?:tech\s*pack|techpack|technical\s+package|spec\s+sheet)\b/.test(text) && ACTION.test(text))
    return nav('techpack', { operation: 'enterTechPackWorkspace' })

  const avatar = AVATARS.find(([, pattern]) => pattern.test(text))
  if (avatar && ACTION.test(text)) return intent('avatar', { target: 'avatarModel', value: avatar[0], operation: 'setAvatarModel', requiresAvailabilityCheck: true })
  if (/\b(?:avatar|fitting\s+model|mannequin)\b/.test(text) && ACTION.test(text))
    return nav('avatar', { section: 'Avatar', operation: 'setActiveSection' })

  const fabricNames=[['jersey',/\b(?:cotton jersey|cotton|jersey)\b/],['fleece',/\b(?:fleece|french terry|terry)\b/],['denim',/\bdenim\b/],['silk',/\bsilk\b/]]
  const matchedFabric=fabricNames.find(([,expression])=>expression.test(text))?.[0]||null
  if ((/\b(?:fabric|material|textile|swatch)\b/.test(text)||matchedFabric) && ACTION.test(text))
    return intent('fabric', { target: 'Fabric', operation: 'setActiveSection',
      action: /\b(?:add|insert|create|apply|assign|change|replace)\b/.test(text) ? 'edit' : 'open',
      ...(matchedFabric?{presetId:matchedFabric}:{}),
      requiresSelection: /\b(?:apply|assign|replace)\b/.test(text) })

  const hardware = /\b(?:zipper|zip|buttonholes?|buttons?|hardware|trims?|fasteners?)\b/.exec(text)?.[0]
  if (hardware && ACTION.test(text)) {
    const target = /^zip/.test(hardware) ? 'Zipper' : /^buttonhole/.test(hardware) ? 'Buttonhole' : /^button/.test(hardware) ? 'Button' : 'Trim'
    return intent('hardware', { target, section: 'Sewing', operation: 'setObjectTab', action: /\b(?:add|insert|create|place|apply|attach)\b/.test(text) ? 'add' : 'open', requiresSelection: /\b(?:add|insert|create|place|apply|attach)\b/.test(text) })
  }

  return unsupported()
}

export { classifyExoCompanionCommand as classifyExoCompanionIntent }
