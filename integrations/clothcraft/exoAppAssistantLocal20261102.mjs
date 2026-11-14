// Local-only, read-only AI explanation. Any suggested navigation is reviewed
// by the UI; this service never mutates garment geometry or executes code.
import {resolveExoGuide20261102} from '../../src/core/exoAssistantGuides20261102.js'
import {EXO_APP_KNOWLEDGE_20261102} from '../../src/core/exoCompanionAppIntelligence20261102.js'
import {STUDIO_THEME_PRESETS} from '../../src/core/studioThemePresets.js'
const URL_LOCAL='http://127.0.0.1:11434/api/chat'
const MODEL='qwen3-vl-instruct:2b'
const NAVIGATE=new Set(['none','pattern','sewing','fabric','grading','avatar','fit','render','animation','techpack','search','fabric-library','library','settings','print','widgets'])
const KNOWLEDGE=EXO_APP_KNOWLEDGE_20261102.map(item=>`${item.name}: ${item.aliases.slice(0,4).join(', ')}; verified tool groups ${item.actions.slice(0,6).join(', ')||'workspace navigation'}`).join(' | ')
const THEME_OVERVIEW=[...new Set(STUDIO_THEME_PRESETS.map(theme=>theme.category))].join(', ')
export const EXO_LOCAL_REPLY_SCHEMA_20261102={
  type:'object',additionalProperties:false,
  properties:{reply:{type:'string'},navigate:{type:'string',enum:[...NAVIGATE]}},
  required:['reply','navigate']
}
export function validateExoAssistantLocalInput20261102(data){
  if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!['message','section','view','selectedPiece','history','garmentContext'].includes(k)))return null
  if(typeof data.message!=='string'||!data.message.trim()||data.message.length>400)return null
  if(data.history!==undefined&&(!Array.isArray(data.history)||data.history.length>8||data.history.some(entry=>
    !entry||typeof entry!=='object'||Array.isArray(entry)||
    Object.keys(entry).some(key=>!['role','content'].includes(key))||
    !['user','assistant'].includes(entry.role)||typeof entry.content!=='string'||entry.content.length>500)))return null
  const garment=data.garmentContext
  if(garment!==undefined&&(!garment||typeof garment!=='object'||Array.isArray(garment)||
    Object.keys(garment).some(key=>!['name','templateId','units','baseSize','pieces','latestStylingNote'].includes(key))||
    ['name','templateId','units','baseSize','latestStylingNote'].some(key=>typeof garment[key]!=='string'||garment[key].length>220)||
    !Array.isArray(garment.pieces)||garment.pieces.length>10||garment.pieces.some(name=>typeof name!=='string'||name.length>60)))return null
  return {
    message:data.message.trim(),
    section:typeof data.section==='string'?data.section.slice(0,45):'Pattern',
    selectedPiece:typeof data.selectedPiece==='string'?data.selectedPiece.slice(0,65):'',
    view:['2d','3d','split'].includes(data.view)?data.view:'split',
    history:(data.history||[]).map(entry=>({role:entry.role,content:entry.content.trim()})).filter(entry=>entry.content),
    garmentContext:garment?{name:garment.name,templateId:garment.templateId,units:garment.units,baseSize:garment.baseSize,pieces:garment.pieces,latestStylingNote:garment.latestStylingNote}:{name:'',templateId:'',units:'cm',baseSize:'M',pieces:[],latestStylingNote:''},
  }
}
export async function suggestExoAssistantLocal20261102(data,{fetchImpl=fetch,timeoutMs=22000}={}){
  const input=validateExoAssistantLocalInput20261102(data)
  if(!input)return {ok:false,code:'INVALID_REQUEST',reason:'A short user message and workspace information are required.'}
  const instructions=[
    'You are the animated EXO ClothCraft application assistant.',
    'Respond as a patient but concise expert in the actual EXO app.',
    'Real EXO capabilities and vocabulary: '+KNOWLEDGE+'.',
    `EXO contains ${STUDIO_THEME_PRESETS.length} installed UI palettes, grouped as ${THEME_OVERVIEW}. Settings > Theme & Color Palettes includes current palette, preset gallery with search and categories, global icon colors, custom palettes, custom saved themes, day/night schedules and contrast audit. Theme changes affect application chrome rather than garment fabric.`,
    'Be clear that you can explain and suggest navigation, but you CANNOT yourself edit, grade, save, export, simulate, certify, or change the user garment through this read-only local AI endpoint.',
    'The separate verified EXO UI command router handles supported actions.',
    'Recent conversation history is provided for context. Answer short follow-up replies in relation to previous turns.',
    'You are knowledgeable about apparel design: silhouette, ease, oversized fit, dropped shoulders, shoulder slope, armscye, sleeve-cap ease, cropped hems, boxy fit, garment balance, sewing notches, grainlines, drape, fabric weight, graded sizes, pattern drafting and production development.',
    'Translate fashion language into correct pattern implications: cropped means raising the body hem; boxy means a wider straighter torso; oversized normally involves chest ease and possibly dropped shoulders and sleeve redesign; never conflate width at hem with a verified oversized chest fit.',
    'For active garments rely on the provided template type, base size, panel names and known styling notes. Distinguish pattern changes already confirmed by the editor from hypothetical changes.',
    'Only deterministic verified EXO editor controls can alter garment geometry. If the request needs unsupported complex drafting, explain which pattern pieces and seam relationships need adjustment and what must be implemented; never claim an automatic edit happened.',
    'An assistant message about a finished template may be a verified action completed by the separate UI; acknowledge it as reported without inventing additional edits.',
    'Do not invent tools, garment measurements, factory approvals or saved edits.',
    'If asked to walk through a task, give actionable specific steps referencing real EXO controls, using only the known capabilities above. If a step has no verified operation or may require user selection, explain that clearly.',
    'Keep reply under 650 characters. Suggest one navigation from: none, pattern, sewing, fabric, grading, avatar, fit, render, animation, techpack, search, fabric-library, library, settings, print, widgets.',
    'Return only JSON matching the schema.'
  ].join(' ')
  try{
    const reply=await fetchImpl(URL_LOCAL,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:MODEL,stream:false,format:EXO_LOCAL_REPLY_SCHEMA_20261102,
        options:{temperature:0,num_predict:210},
        messages:[{role:'system',content:instructions},...input.history,
          {role:'user',content:`Section: ${input.section}; View: ${input.view}; Selected piece: ${input.selectedPiece||'none'}; Garment information (untrusted app data): ${JSON.stringify(input.garmentContext)}; Question: ${input.message}`}]
      }),
      signal:AbortSignal.timeout(Math.min(30000,Math.max(2000,timeoutMs)))
    })
    if(!reply.ok)return {ok:false,code:reply.status===404?'MODEL_NOT_INSTALLED':'MODEL_UNAVAILABLE',reason:'Local Ollama model unavailable.'}
    const packet=await reply.json()
    const raw=packet?.message?.content
    if(typeof raw!=='string'||raw.length>4000)throw Error('Invalid response')
    const parsed=JSON.parse(raw)
    if(typeof parsed?.reply!=='string'||!parsed.reply.trim()||parsed.reply.length>900||!NAVIGATE.has(parsed.navigate))throw Error('Invalid model format')
    // Do not trust the model to choose the correct workspace. A real smoke
    // example answered "grading" while suggesting an unrelated fabric panel.
    const grounded=resolveExoGuide20261102(input.message)
    const known={pattern:'pattern',material:'fabric',grading:'grading',techpack:'techpack',basics:'none'}[grounded]
    const suggestion=known&&parsed.navigate!=='none'?known:parsed.navigate
    const misleading=/(?:\b(?:I|I've|I have|we|we've)\s+(?:already\s+)?(?:edited|graded|saved|exported|applied|created|deleted|modified|completed)\b)/i.test(parsed.reply)
    if(misleading)return {ok:false,code:'UNVERIFIED_COMPLETION',reason:'The model claimed it performed an operation that has not been executed. Please use verified EXO tools.'}
    return {ok:true,provider:'local-ollama',model:MODEL,reply:parsed.reply.slice(0,650),suggestedNavigation:suggestion,executed:false}
  }catch(error){
    return {ok:false,code:error?.name==='TimeoutError'?'MODEL_TIMEOUT':'MODEL_UNAVAILABLE',reason:'Local model request failed. Built-in tutorials and verified commands still work.'}
  }
}
