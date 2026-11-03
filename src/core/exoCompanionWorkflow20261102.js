// Deterministic conversational context for the app's genuinely implemented
// garment-template creation action. Local language models never mutate projects.
export const EXO_GARMENTS_20261102=Object.freeze({
 tee:{name:'T-shirt',templateId:'tee'},
 hoodie:{name:'hoodie',templateId:'hoodie'},
 pants:{name:'pants',templateId:'pants'},
})
const garmentIn=text=>/\b(?:t[ -]?shirt|tee|shirt)\b/i.test(text)?'tee':/\b(?:hoodie|sweatshirt)\b/i.test(text)?'hoodie':/\b(?:pants|trousers)\b/i.test(text)?'pants':null
const action=/\b(?:make|create|build|start|draw|draft|design|generate|do|load|begin)\b/i
const confirm=/^(?:yes|yeah|yep|sure|okay|ok|alright|absolutely|go ahead|do it|let'?s do it|please|sounds good|start|make it|create it|do the pattern|start the pattern|use (?:a |the )?(?:basic |foundation )?template|start with (?:a |the )?(?:basic |foundation )?template)[!., ]*$/i
const questions=/\b(?:what|why|how|explain|tell me|where|can you explain)\b/i
export function interpretExoCompanionWorkflow20261102(input,context=null){
 const raw=String(input||'').trim().slice(0,600)
 if(!raw)return{kind:'empty'}
 const selected=garmentIn(raw)
 const pending=context?.pendingTemplateId
 const explicitNow=/\b(?:now|actually|immediately|go ahead|just do|do it|without asking)\b/i.test(raw)
 const declines=/^(?:no|not now|cancel|nevermind|never mind|stop|wait)[!., ]*$/i.test(raw)
 if(pending&&declines)return{kind:'cancel'}
 if(pending&&(/\b(?:my measurements|custom measurements|from scratch|measurements first|own measurements)\b/i.test(raw)))return{kind:'measurements',templateId:pending}
 if(pending&&(confirm.test(raw)||/\b(?:ok|okay|yes|sure|yeah|start|make|create|draw|draft|load|do)\b.*\b(?:pattern|template|that|it)\b/i.test(raw)&&!questions.test(raw)))return{kind:'create',templateId:pending}
 if(selected&&action.test(raw)&&!questions.test(raw)){
  if(explicitNow)return{kind:'create',templateId:selected}
  return{kind:'offer',templateId:selected}
 }
 if(pending&&selected&&action.test(raw))return{kind:'offer',templateId:selected}
 if(!pending&&/\b(?:make|create|start|draw)\b.*\b(?:pattern|garment)\b/i.test(raw)&&!questions.test(raw))return{kind:'choose'}
 return{kind:'none'}
}

// A small declarative protocol for the Companion UI. Executable steps use
// existing, allowlisted App handlers; inspection and approval remain manual.
const STEPS = Object.freeze({
  create: { id:'create', label:'Create an editable foundation pattern', action:{type:'createGarment'}, requiresConfirmation:true },
  inspect: { id:'inspect', label:'Inspect the actual 2D pattern pieces', action:{type:'workspace',value:'2d'}, checkpoint:'Confirm that the pieces and outlines look correct' },
  grading: { id:'grading', label:'Open the grading controls', action:{type:'navigate',target:'grading'}, checkpoint:'Choose the base size and size increments in the editor' },
  autoGrade: { id:'autoGrade', label:'Apply automatic XS–XXL grading to the pattern', action:{type:'autoGrade',sizes:['XS','S','M','L','XL','XXL']}, checkpoint:'Verify generated size rules and measure each graded piece' },
  nest: { id:'nest', label:'Display graded size outlines', action:{type:'gradingNest',value:true}, checkpoint:'Inspect XS–XXL spacing and grade rules' },
  fabric: { id:'fabric', label:'Select and inspect material', action:{type:'fabric',action:'open'}, checkpoint:'Choose a material and confirm its properties' },
  sewing: { id:'sewing', label:'Inspect sewing and hardware', action:{type:'navigate',target:'sewing'}, checkpoint:'Review seam attachments and construction' },
  preview: { id:'preview', label:'Review the garment in 3D', action:{type:'workspace',value:'3d'}, checkpoint:'Check fit and collision before production' },
  techpack: { id:'techpack', label:'Review the technical package', action:{type:'navigate',target:'techpack'}, checkpoint:'Review measurements, grading and factory details' },
})
const PRESETS = Object.freeze({
  'pattern-creation':{title:'Create a foundation pattern',steps:['create','inspect','sewing','preview']},
  'pattern-grading':{title:'Grade and review a pattern',steps:['inspect','grading','autoGrade','nest','techpack']},
  'garment-development':{title:'Develop a garment from pattern to technical package',steps:['create','inspect','grading','autoGrade','nest','fabric','sewing','preview','techpack']},
  'fabric-review':{title:'Inspect garment materials',steps:['fabric','preview']},
})
const MAX_CUSTOM=30
const MAX_STEPS=12
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k)
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)
const safeText=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max&&!/[\u0000-\u001f\u007f]/.test(value)

export function listExoCompanionWorkflows20261102(){
  return Object.entries(PRESETS).map(([id,workflow])=>({id,title:workflow.title,steps:workflow.steps.map(step=>({...STEPS[step],action:{...STEPS[step].action,...(STEPS[step].action.sizes?{sizes:[...STEPS[step].action.sizes]}:{})}}))}))
}

/** Validate and copy user-authored flows; no arbitrary functions/commands. */
export function validateExoCompanionCustomWorkflow20261102(value){
  if(!plain(value)||!safeText(value.id,64)||!/^custom-[a-z0-9][a-z0-9-]{0,56}$/.test(value.id)||!safeText(value.title,100)||!Array.isArray(value.steps)||value.steps.length<1||value.steps.length>MAX_STEPS)
    return {ok:false,error:'Invalid workflow identifier, title or step count.'}
  if(Object.keys(value).some(key=>!['id','title','steps'].includes(key)))return {ok:false,error:'Unexpected workflow property.'}
  const steps=[]
  for(const step of value.steps){
    if(typeof step!=='string'||!own(STEPS,step))return {ok:false,error:'Unknown or unsafe workflow step.'}
    steps.push(step)
  }
  return {ok:true,workflow:{id:value.id,title:value.title.trim(),steps}}
}

export function resolveExoCompanionWorkflow20261102(id,custom=[]){
  if(typeof id!=='string')return null
  const preset=own(PRESETS,id)?{id,...PRESETS[id]}:Array.isArray(custom)?custom.find(entry=>entry?.id===id):null
  if(!preset)return null
  const validated=own(PRESETS,id)?{ok:true,workflow:preset}:validateExoCompanionCustomWorkflow20261102(preset)
  if(!validated.ok)return null
  return {...validated.workflow,steps:validated.workflow.steps.map(step=>({...STEPS[step],action:{...STEPS[step].action,...(STEPS[step].action.sizes?{sizes:[...STEPS[step].action.sizes]}:{})}}))}
}

/** Persistence adapter accepts a caller-owned storage object (e.g. localStorage).
 * Reads never execute commands, and corrupt/oversized records fail closed. */
export const EXO_COMPANION_WORKFLOW_STORAGE_KEY_20261102='exo.companion.customWorkflows.v1'
export function readExoCompanionCustomWorkflows20261102(storage,key=EXO_COMPANION_WORKFLOW_STORAGE_KEY_20261102){
  try{
    const raw=storage?.getItem?.(key)
    if(!raw||typeof raw!=='string'||raw.length>25000)return []
    const parsed=JSON.parse(raw)
    if(!Array.isArray(parsed)||parsed.length>MAX_CUSTOM)return []
    const valid=parsed.map(validateExoCompanionCustomWorkflow20261102)
    if(valid.some(item=>!item.ok))return []
    const ids=valid.map(item=>item.workflow.id)
    return new Set(ids).size===ids.length?valid.map(item=>item.workflow):[]
  }catch{return []}
}
export function saveExoCompanionCustomWorkflows20261102(storage,workflows,key=EXO_COMPANION_WORKFLOW_STORAGE_KEY_20261102){
  if(!Array.isArray(workflows)||workflows.length>MAX_CUSTOM)return {ok:false,error:'Too many workflows.'}
  const checked=workflows.map(validateExoCompanionCustomWorkflow20261102)
  if(checked.some(entry=>!entry.ok))return {ok:false,error:checked.find(entry=>!entry.ok).error}
  const normalized=checked.map(entry=>entry.workflow)
  if(new Set(normalized.map(entry=>entry.id)).size!==normalized.length)return {ok:false,error:'Duplicate workflow identifier.'}
  try{
    if(typeof storage?.setItem!=='function')return {ok:false,error:'Workflow storage is unavailable.'}
    storage.setItem(key,JSON.stringify(normalized))
    return {ok:true,workflows:normalized}
  }catch{return {ok:false,error:'Workflow storage could not save the changes.'}}
}

/** One step at a time. The caller must execute action, inspect the result,
 * and pass its success into advance; advancing never dispatches edits. */
export function advanceExoCompanionWorkflow20261102(workflow,index,result,{confirmed=false}={}){
  if(!workflow||!Array.isArray(workflow.steps)||!Number.isSafeInteger(index)||index<0||index>=workflow.steps.length)
    return {ok:false,error:'Invalid workflow position.'}
  const step=workflow.steps[index]
  if(step.requiresConfirmation&&!confirmed)return {ok:false,needsConfirmation:true,step}
  if(result?.ok!==true)return {ok:false,error:result?.message||'The editor did not confirm this step.',step}
  const nextIndex=index+1
  return {ok:true,completed:nextIndex===workflow.steps.length,index:nextIndex,step:workflow.steps[nextIndex]||null}
}
