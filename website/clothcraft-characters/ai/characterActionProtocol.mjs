/**
 * EXO Character AI v1: pure, provider-neutral model action contract.
 *
 * This is a SAFE PROPOSE/PREVIEW primitive, not a live model integration.
 * Providers suggest strict actions. The editor validates every operation,
 * displays a preview and commits only after the user accepts it.
 * Never run arbitrary code or unvalidated SVG content from an AI response.
 */
export const CHARACTER_ACTION_SCHEMA='exo.character.actions.v1'
export const MAX_AI_ACTIONS=12
export const MAX_CHARACTER_DETAILS=16
const HEX=/^#[a-fA-F0-9]{6}$/
const allowed={
  set_body_color:['action','color'],
  set_eye_colors:['action','eyeColor','irisColor','pupilColor'],
  set_eye_shape:['action','shape'],
  set_eye_geometry:['action','eyeScale','spacing'],
  add_accessory:['action','type','x','y'],
  add_saved_svg:['action','assetId','x','y'],
  move_accessory:['action','id','x','y'],
  remove_accessory:['action','id'],
  set_expression:['action','expression'],
}
const emotions=new Set(['idle','happy','sleepy','surprised','curious','blink'])
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const exactKeys=(value,keys)=>Object.keys(value).every(key=>keys.includes(key))
const range=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max
const validId=value=>typeof value==='string'&&value.length>0&&value.length<=100&&/^[a-zA-Z0-9_-]+$/.test(value)
const fail=(code,detail,index)=>({ok:false,code,detail,index})

/**
 * @param {object} proposal Parsed JSON from any provider.
 * @param {object} snapshot Current editor snapshot: {revision, config, emotion}.
 * @param {object} catalog Real editor IDs: {eyeShapes,accessoryTypes}.
 * @returns {object} Validated, atomic preview; no caller state is changed.
 */
export function planCharacterActions(proposal,snapshot,catalog={}){
  if(!object(snapshot)||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<0||!object(snapshot.config)||!Array.isArray(snapshot.config.accessories)||!Array.isArray(snapshot.config.tattooLibrary))return fail('INVALID_SNAPSHOT','Character state is unavailable.')
  if(!object(proposal)||!exactKeys(proposal,['schema','expectedRevision','actions'])||proposal.schema!==CHARACTER_ACTION_SCHEMA||!Array.isArray(proposal.actions)||proposal.actions.length<1||proposal.actions.length>MAX_AI_ACTIONS)return fail('INVALID_PLAN','Expected a versioned list of 1–12 actions.')
  if(proposal.expectedRevision!==snapshot.revision)return fail('STALE_REVISION','The character changed since the AI request.')
  const eyeShapes=new Set(catalog.eyeShapes||[])
  const accessoryTypes=new Set(catalog.accessoryTypes||[])
  const candidate=structuredClone(snapshot.config)
  let expression=typeof snapshot.emotion==='string'?snapshot.emotion:'idle'
  const summary=[]
  for(let index=0;index<proposal.actions.length;index++){
    const edit=proposal.actions[index]
    if(!object(edit)||!allowed[edit.action]||!exactKeys(edit,allowed[edit.action]))return fail('UNSUPPORTED_ACTION','Unknown or additional action properties.',index)
    const hasPosition=()=>range(edit.x,85,515)&&range(edit.y,85,515)
    switch(edit.action){
      case 'set_body_color':
        if(!HEX.test(edit.color||''))return fail('INVALID_COLOR','Use a six-digit hex color.',index)
        candidate.color=edit.color;summary.push('Body color');break
      case 'set_eye_colors':
        if(![edit.eyeColor,edit.irisColor,edit.pupilColor].every(c=>HEX.test(c||'')))return fail('INVALID_COLOR','Provide the base, iris and pupil colors.',index)
        candidate.eyeMode='matched'
        candidate.eyeColor=edit.eyeColor;candidate.irisColor=edit.irisColor;candidate.pupilColor=edit.pupilColor
        summary.push('Eye colors');break
      case 'set_eye_shape':
        if(typeof edit.shape!=='string'||!eyeShapes.has(edit.shape))return fail('UNKNOWN_SHAPE','Shape is not in the installed eye library.',index)
        candidate.shape=edit.shape;summary.push('Eye shape');break
      case 'set_eye_geometry':
        if(!range(edit.eyeScale,.55,1.35)||!range(edit.spacing,.75,1.3))return fail('INVALID_GEOMETRY','Eye scale or spacing out of range.',index)
        candidate.eyeScale=edit.eyeScale;candidate.spacing=edit.spacing;summary.push('Eye size and spacing');break
      case 'add_accessory':
        if(!accessoryTypes.has(edit.type)||!hasPosition())return fail('INVALID_ACCESSORY','Unknown detail or invalid placement.',index)
        if(candidate.accessories.length>=MAX_CHARACTER_DETAILS)return fail('DETAIL_LIMIT','Character already has 16 details.',index)
        candidate.accessories.push({id:`ai-${snapshot.revision+1}-${index}`,type:edit.type,x:edit.x,y:edit.y,scale:1,rotation:0,color:'#eeeeee',secondary:'#999999',flip:false})
        summary.push('Added '+edit.type);break
      case 'add_saved_svg':
        if(!validId(edit.assetId)||!candidate.tattooLibrary.some(a=>a.id===edit.assetId)||!hasPosition())return fail('UNKNOWN_SVG','Only an existing approved SVG-library ID is allowed.',index)
        if(candidate.accessories.length>=MAX_CHARACTER_DETAILS)return fail('DETAIL_LIMIT','Character already has 16 details.',index)
        candidate.accessories.push({id:`ai-${snapshot.revision+1}-${index}`,type:'user-svg',assetId:edit.assetId,x:edit.x,y:edit.y,scale:1,rotation:0,color:'#eeeeee',secondary:'#999999',tint:false,flip:false})
        summary.push('Placed saved SVG');break
      case 'move_accessory':{
        const target=candidate.accessories.find(a=>a.id===edit.id)
        if(!validId(edit.id)||!target||!hasPosition())return fail('UNKNOWN_DETAIL','Cannot move an unknown detail.',index)
        target.x=edit.x;target.y=edit.y;summary.push('Moved detail');break
      }
      case 'remove_accessory':{
        if(!validId(edit.id)||!candidate.accessories.some(a=>a.id===edit.id))return fail('UNKNOWN_DETAIL','Cannot remove an unknown detail.',index)
        candidate.accessories=candidate.accessories.filter(a=>a.id!==edit.id)
        summary.push('Removed detail');break
      }
      case 'set_expression':
        if(!emotions.has(edit.expression))return fail('INVALID_EXPRESSION','Unknown expression.',index)
        expression=edit.expression;summary.push('Expression');break
    }
  }
  return {
    ok:true,schema:CHARACTER_ACTION_SCHEMA,baseRevision:snapshot.revision,
    nextRevision:snapshot.revision+1,requiresConfirmation:true,
    preview:{config:candidate,emotion:expression},summary,
  }
}
