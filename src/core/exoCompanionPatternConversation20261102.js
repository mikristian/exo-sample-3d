import {createTemplateProject} from '../data/templates.js'
import {draftExoTextSketchPattern20261102} from './exoTextSketchPatternCandidate20261102.js'
import {draftExoPhotoConditionedPattern20261102,seedExoPhotoEvidence20261102} from './exoPhotoConditionedPattern20261102.js'

const clone=value=>structuredClone(value)
const INITIAL={design:null,history:[],revision:0,proposalKey:null,proposal:null,sketch:null,photo:null}
const PREFIX={tee:'crew neck T-shirt with short sleeves',hoodie:'hoodie with long sleeves','zip-hoodie':'zip-up hoodie with long sleeves',skirt:'skirt','jeans-501-fit':'straight leg trousers','jeans-501':'classic straight-leg denim jeans'}
const FAMILY=[
  ['zip-hoodie',/\b(?:zip(?:[ -]?(?:up|front))?\s+hoodie|hoodie\s+with\s+(?:a\s+)?(?:front\s+)?zipper|zippered\s+hoodie|(?:add|put)\s+(?:a\s+)?zipper\s+to\s+(?:the\s+)?hoodie)\b/i],
  ['hoodie',/\bhoodie|hooded\s+sweatshirt\b/i],
  ['tee',/\b(?:t[ -]?shirt|tee|crew[ -]?neck\s+shirt)\b/i],
  ['skirt',/\bskirt\b/i],
  ['jeans-501',/\b(?:jeans|denim)\b/i],
  ['jeans-501-fit',/\b(?:trousers|pants)\b/i],
]
const COLORS=/\b(navy|black|white|cream|red|blue|green|grey|gray|brown|tan|beige|pink|purple|orange|yellow)\b/gi
const LENGTH=/\b(?:body|garment|shirt|hoodie|total)\s+length\s*(?:is|of|to|:|=)?\s*(\d+(?:\.\d+)?)\s*(cm|mm|inches?|in\b)/i
const SKETCH_ONLY=/^(?:(?:please\s+)?(?:use|apply|follow)\s+(?:(?:this|my|the|uploaded)\s+)?sketch|(?:please\s+)?(?:make|create|draft|generate)(?:\s+(?:a|the))?\s+(?:pattern\s+)?(?:from|using|with|based\s+on)\s+(?:(?:this|my|the|uploaded)\s+)?sketch)[.!]?$/i
const SKETCH_PHRASE=/\b(?:using|from|with|based\s+on)\s+(?:(?:this|my|the|uploaded)\s+)?sketch\b/gi
const PHOTO_ONLY=/^(?:(?:please\s+)?(?:use|apply|follow)\s+(?:(?:this|my|the|uploaded)\s+)?(?:photo|photograph|picture|image|reference(?:\s+photo)?)|(?:please\s+)?(?:make|create|draft|generate)(?:\s+(?:a|the))?\s+(?:pattern\s+)?(?:from|using|with|based\s+on)\s+(?:(?:this|my|the|uploaded)\s+)?(?:photo|photograph|picture|image|reference(?:\s+photo)?))[.!]?$/i
const PHOTO_PHRASE=/\b(?:using|from|with|based\s+on)\s+(?:(?:this|my|the|uploaded)\s+)?(?:photo|photograph|picture|image|reference(?:\s+photo)?)\b/gi
const sketchSeed=sketch=>sketch==null?null:{
  ok:sketch.ok,
  normalizedContour:Array.isArray(sketch.normalizedContour)&&sketch.normalizedContour.length<=1024
    ?sketch.normalizedContour.map(point=>({x:point.x,y:point.y})):[],
  silhouetteAspectRatio:sketch.silhouetteAspectRatio,
  evidence:{possibleSleeveExtension:{detected:sketch.evidence?.possibleSleeveExtension?.detected===true}},
  manufacturingApproved:sketch.manufacturingApproved,
  measurementCalibrationVerified:sketch.measurementCalibrationVerified,
}
const CM=(n,unit)=>Number((Number(n)*(unit==='mm'?.1:unit.startsWith('in')?2.54:1)).toFixed(2))
const ERR=(context,message,kind='rejected')=>({ok:false,kind,context,message,actions:['edit','preview','undo','cancel']})
const success=(kind,context,message,proposal=context.proposal,actions=['edit','preview','undo','cancel','confirm pattern'])=>({ok:true,kind,context,message,...(proposal?{proposal}:{}),actions})
const validContext=c=>c&&typeof c==='object'&&Number.isSafeInteger(c.revision)&&c.revision>=0&&Array.isArray(c.history)&&c.history.length<=30&&(!c.design||PREFIX[c.design.templateId])&&(!c.proposal||c.proposal.ok===true)
const baseHeight=templateId=>{
  const template=createTemplateProject(templateId)
  const piece=template.pieces.find(p=>p.id===(templateId==='zip-hoodie'?'back':'front'))
  return piece?Math.max(...piece.points.map(p=>p.y))-Math.min(...piece.points.map(p=>p.y)):null
}
const normalizedFamily=input=>{
  const detected=FAMILY.filter(([,re])=>re.test(input)).map(([id])=>id)
  if(detected.includes('zip-hoodie'))return detected.filter(id=>id!=='hoodie')
  if(detected.includes('jeans-501'))return detected.filter(id=>id!=='jeans-501-fit')
  return detected
}
const canonicalPrompt=design=>{
  let text='Create '+(design.fit==='oversized'?'an oversized ':design.fit==='relaxed'?'a relaxed ':design.fit==='slim'?'a slim ':'a ')+PREFIX[design.templateId]
  if(design.lengthCm!=null)text+=`, body length ${design.lengthCm} cm`
  if(design.seamAllowanceCm!=null)text+=`, seam allowance ${design.seamAllowanceCm} cm`
  if(design.extra)text+=`, ${design.extra}`
  return text
}
function parseChange(message,design){
  const text=message.trim()
  if(/\b(?:don't|do not|never|without|instead of|remove|no longer|not)\b/i.test(text))
    return {error:'Negative instructions need a specific supported replacement (for example, “make it regular fit”).'}
  const families=normalizedFamily(text)
  if(families.length>1)return {error:'Please choose one garment family for this pattern.'}
  const creation=/\b(?:make|create|draft|design|generate|start|new|switch|change|convert|turn|add)\b/i.test(text)
  if(!design&&(!families.length||!creation))return {error:'Tell me which garment to draft, such as “make an oversized hoodie”.'}
  const next=design?clone(design):{templateId:families[0],fit:null,lengthCm:null,seamAllowanceCm:null,color:null,extra:null}
  if(families.length){
    if(design&&families[0]!==design.templateId&&!/\b(?:change|switch|convert|turn|instead|new|make|create|draft|design|generate|add)\b/i.test(text))
      return {error:'Specify “change to” when replacing the garment family.'}
    if(families[0]!==next.templateId){next.templateId=families[0];next.lengthCm=null;next.extra=null}
  }
  const fitWords=[
    ['oversized',/\b(?:oversized|boxy)\b/i],
    ['relaxed',/\b(?:relaxed|loose|baggy|roomy)\b/i],
    ['slim',/\b(?:slim|fitted|tight)\b/i],
    ['regular',/\b(?:regular|standard|normal)\s*(?:fit)?\b/i],
  ].filter(([,re])=>re.test(text)).map(([id])=>id)
  if(fitWords.length>1)return {error:'Conflicting fit instructions; choose one fit.'}
  if(fitWords.length)next.fit=fitWords[0]==='regular'?null:fitWords[0]
  const lengths=[...text.matchAll(new RegExp(LENGTH.source,'gi'))]
  if(lengths.length>1)return {error:'Provide just one garment length.'}
  if(lengths.length)next.lengthCm=CM(lengths[0][1],lengths[0][2].toLowerCase())
  const crop=/\b(?:crop|cropped|shorten|shorter)\b/i.test(text)
  const extend=/\b(?:lengthen|longer|extend|elongate)\b/i.test(text)
  if(crop&&extend)return {error:'Choose either shortening or lengthening.'}
  if((crop||extend)&&lengths.length)return {error:'Choose a target body length or a relative length change.'}
  if(crop||extend){
    const relative=text.match(/\b(?:crop|cropped|shorten|shorter|lengthen|longer|extend)(?:\s+it|\s+the\s+(?:body|hem|garment|hoodie|shirt))?\s*(?:by)?\s*(\d+(?:\.\d+)?)\s*(cm|mm|inches?|in\b)/i)
    if(/\b\d/.test(text)&&!relative)return {error:'Use “crop it 8 cm” or “body length 58 cm” for a measured edit.'}
    if(relative){
      const amount=CM(relative[1],relative[2].toLowerCase())
      if(amount<=0||amount>100)return {error:'Requested length change exceeds the supported drafting range.'}
      if(!['tee','hoodie','zip-hoodie'].includes(next.templateId))return {error:'Measured relative length editing is currently supported for T-shirts and hoodies.'}
      const startingLength=next.lengthCm??baseHeight(next.templateId)
      if(startingLength==null)return {error:'Unable to measure the source template.'}
      next.lengthCm=Number((startingLength+(crop?-amount:amount)).toFixed(2))
    }else if(crop){
      next.lengthCm=Number(((next.lengthCm??baseHeight(next.templateId))-8).toFixed(2))
    }else{
      next.lengthCm=Number(((next.lengthCm??baseHeight(next.templateId))+5).toFixed(2))
    }
  }
  const allowance=text.match(/\bseam\s+allowance\s*(?:to|is|of|:|=)?\s*(\d+(?:\.\d+)?)\s*(cm|mm|inches?|in\b)/i)
  if(allowance)next.seamAllowanceCm=CM(allowance[1],allowance[2].toLowerCase())
  const colors=[...new Set([...text.matchAll(COLORS)].map(m=>m[1].toLowerCase().replace('grey','gray')))]
  if(colors.length>1)return {error:'Choose one color for this garment.'}
  if(colors.length)next.color=colors[0]
  const unsupported=/\b(?:padding|padded|trapunto|quilted|raglan|drop[ -]shoulder|princess\s+seam|pleated|pleats|asymmetrical|asymmetric|molded|embroider|puff\s+print|cutouts?)\b/i
  if(unsupported.test(text))return {error:'That construction detail needs a supported source topology and cannot be drafted automatically yet.'}
  const allowed=text
    .replace(/\b(?:create|make|design|draft|generate|start|new|change|switch|convert|turn|add|into|to|a|an|the|it|this|that|my|please|pattern|with|and|for|from|by|show|me|can|you|could|would|like|want|give|now|then)\b/gi,' ')
    .replace(/\b(?:oversized|boxy|relaxed|loose|baggy|roomy|slim|fitted|tight|regular|standard|normal|fit|classic|straight|leg|crew|neck|short|long|sleeves?|up|front|zip|zipper|zippered|hoodie|hooded|sweatshirt|t[ -]?shirt|tee|shirt|skirt|trousers|pants|denim|jeans|body|garment|length|seam|allowance|crop|cropped|shorten|shorter|lengthen|longer|extend|elongate|navy|black|white|cream|red|blue|green|grey|gray|brown|tan|beige|pink|purple|orange|yellow)\b/gi,' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:cm|mm|inches?|in)\b/gi,' ')
    .replace(/[\s,.;!?-]+/g,' ').trim()
  if(allowed)return {error:`I couldn't safely interpret “${allowed.slice(0,80)}” as a supported pattern edit.`}
  if(design&&JSON.stringify(next)===JSON.stringify(design))return {unchanged:true,design:next}
  return {design:next}
}

/** Pure multi-turn pattern drafting. Host must independently confirm and back up before installing. */
export function advanceExoCompanionPatternConversation20261102({context=null,message='',expectedRevision=null,expectedProposalKey=null,sketch=null,photo=null}={}){
  const previous=context==null?clone(INITIAL):context
  if(!validContext(previous))return ERR(clone(INITIAL),'Invalid conversation state.')
  if(typeof message!=='string'||message.length>4000||![...message].every(c=>c==='\n'||c==='\t'||c>=' '))
    return ERR(previous,'Enter up to 4000 printable characters.')
  const input=message.trim()
  if(!input)return ERR(previous,'Describe a garment or ask to preview the current pattern.')
  if(expectedRevision!=null&&expectedRevision!==previous.revision)return ERR(previous,'Conversation has changed; refresh before applying this edit.','stale')
  if(expectedProposalKey!=null&&expectedProposalKey!==previous.proposalKey)return ERR(previous,'Preview has changed; review the latest pattern.','stale')
  if(/^(?:cancel|discard|stop)(?:\s+(?:pattern|draft|this))?[.!]?$/i.test(input)){
    const next={...clone(INITIAL),revision:previous.revision+1}
    return success('cancelled',next,'Pattern conversation cleared.',null,['create'])
  }
  if(/^(?:undo|undo that|undo last|undo that last edit|revert last(?: edit)?)[.!]?$/i.test(input)){
    if(!previous.history.length)return ERR(previous,'There is no previous edit to undo.')
    const history=clone(previous.history),record=history.pop()
    const next={...previous,design:record.design,proposal:record.proposal,sketch:record.sketch??null,photo:record.photo??null,history,revision:previous.revision+1,proposalKey:`pattern-${previous.revision+1}`}
    return success('undone',next,'Restored the preceding pattern revision.')
  }
  if(/^(?:show(?:\s+(?:me|the))?\s+preview|preview(?:\s+(?:pattern|it))?|show(?:\s+(?:me|the))?\s+pattern)[.!]?$/i.test(input))
    return previous.proposal?success('preview',previous,'Here is the current editable draft preview.'):ERR(previous,'Create a garment pattern first.')
  if(/^(?:confirm pattern|confirm this pattern|approve pattern|use this pattern)[.!]?$/i.test(input))
    return previous.proposal?success('ready_to_install',previous,'Pattern approved for native editor import. The editor must request installation confirmation and preserve a backup.'):ERR(previous,'Create and preview a garment pattern before confirming.')
  if(/\b(?:cancel|undo|confirm|approve|preview)\b/i.test(input)&&/\b(?:pattern|draft|last|edit)\b/i.test(input))
    return ERR(previous,'Please issue one standalone command: preview, undo, cancel, or confirm pattern.')
  const sketchOnly=SKETCH_ONLY.test(input)
  const photoOnly=PHOTO_ONLY.test(input)
  if((sketchOnly||photoOnly)&&!previous.design)return ERR(previous,'Choose a garment type first, for example “make an oversized hoodie using this photo”.')
  if(sketchOnly&&!sketch)return ERR(previous,'Attach a reviewed sketch before asking me to use it.')
  if(photoOnly&&!photo)return ERR(previous,'Attach a reviewed garment photo before asking me to use it.')
  if(photo&&sketch)return ERR(previous,'Use one reference image at a time so the pattern evidence remains clear.')
  const cleanedInput=sketchOnly||photoOnly?'':input.replace(SKETCH_PHRASE,' ').replace(PHOTO_PHRASE,' ').replace(/\s+/g,' ').trim()
  const parsed=sketchOnly||photoOnly?{design:clone(previous.design)}:parseChange(cleanedInput,previous.design)
  if(parsed.error)return ERR(previous,parsed.error)
  if(parsed.unchanged&&!sketch&&!photo)return success('unchanged',previous,'The current draft already has those settings.')
  const design=parsed.design
  const prompt=canonicalPrompt(design)
  const nextSketch=photo!=null?null:sketch==null?previous.sketch??null:sketchSeed(sketch)
  const nextPhoto=sketch!=null?null:photo==null?previous.photo??null:seedExoPhotoEvidence20261102(photo)
  if(nextPhoto?.ok===false)return ERR(previous,nextPhoto.reason)
  const candidate=nextPhoto?draftExoPhotoConditionedPattern20261102({prompt,photo:nextPhoto}):draftExoTextSketchPattern20261102({prompt,sketch:nextSketch})
  if(!candidate.ok)return ERR(previous,candidate.reason||'The requested change did not pass pattern validation.')
  const history=previous.design?[...clone(previous.history),{design:clone(previous.design),proposal:previous.proposal,sketch:previous.sketch??null,photo:previous.photo??null}].slice(-30):[]
  const revision=previous.revision+1
  const next={design,proposal:candidate,sketch:nextSketch,photo:nextPhoto,history,revision,proposalKey:`pattern-${revision}`}
  const styleNote=design.color?` Color note: ${design.color} (visual styling only).`:''
  return success('draft',next,`Editable ${design.templateId} pattern drafted and digitally checked. Review before installation.${styleNote}`)
}

export const createExoCompanionPatternConversation20261102=()=>clone(INITIAL)

/** Companion intent gate: keep app navigation, questions and theme controls with existing assistants. */
export function handleExoCompanionPatternTurn20261102(input,context=null,{sketch=null,photo=null,expectedRevision=null,expectedProposalKey=null}={}){
  const raw=typeof input==='string'?input.trim():''
  const active=Boolean(context?.design)
  const commands=/^(?:(?:show(?:\s+(?:me|the))?\s+)?preview(?:\s+(?:pattern|it))?|show(?:\s+(?:me|the))?\s+pattern|undo(?:\s+(?:that(?:\s+last\s+edit)?|last(?:\s+(?:design\s+)?revision)?))?|revert last(?: edit)?|cancel(?:\s+(?:pattern|draft|this))?|discard(?:\s+(?:pattern|draft|this))?|stop(?:\s+(?:pattern|draft|this))?|confirm(?:\s+(?:this\s+)?pattern)|approve pattern|use this pattern)[.!]?$/i
  const direct=/\b(?:make|create|draft|design|generate|start)\b.{0,100}\b(?:hoodie|shirt|tee|skirt|trousers|pants|jeans|denim)\b/i
  const replacement=/\b(?:change|switch|convert|turn)\s+(?:it|the\s+(?:design|pattern|garment)|this)?\s*(?:into|to)\s+(?:an?\s+)?(?:zip(?:[ -]?up)?\s+)?(?:hoodie|shirt|tee|skirt|trousers|pants|jeans)\b/i
  const refinement=/\b(?:crop|cropped|shorten|shorter|lengthen|longer|extend|oversized|boxy|relaxed|loose|baggy|slim|fitted|regular|body\s+length|garment\s+length|seam\s+allowance)\b/i
  const styling=/\b(?:make|change|set|color|colour)\s+(?:it|the\s+(?:hoodie|garment|pattern))?\s*(?:to\s+)?(?:navy|black|white|cream|red|blue|green|grey|gray|brown|tan|beige|pink|purple|orange|yellow)\b/i
  const outOfScope=/\b(?:theme|app|website|interface|saved|projects?|open|navigate|how\s+to|how\s+do|explain|why|what\s+is|help\s+me\s+understand)\b/i
  const handle=commands.test(raw)||SKETCH_ONLY.test(raw)||PHOTO_ONLY.test(raw)||(direct.test(raw)&&!outOfScope.test(raw))||(replacement.test(raw)&&active)||(active&&!outOfScope.test(raw)&&(refinement.test(raw)||styling.test(raw)||/\badd\s+(?:a\s+)?zipper\s+to\s+(?:the\s+)?hoodie\b/i.test(raw)))
  if(!handle)return {handled:false,ok:false,kind:'unhandled',context,message:''}
  const normalized=/^undo\s+last\s+design\s+revision[.!]?$/i.test(raw)?'undo':raw
  const result=advanceExoCompanionPatternConversation20261102({context,message:normalized,sketch,photo,expectedRevision,expectedProposalKey})
  return {...result,handled:true,kind:result.ok&&result.kind==='draft'&&active?'revise':result.ok?result.kind:'error'}
}
export default advanceExoCompanionPatternConversation20261102
