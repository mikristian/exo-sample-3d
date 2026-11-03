// Review-only normalization for on-device vision model output.
// Never treat model observations as sewing topology, calibrated dimensions, or fit approval.
const TEMPLATES = {
  tee: 'crew neck T-shirt',
  hoodie: 'hoodie',
  'zip-hoodie': 'zip-up hoodie',
  skirt: 'skirt',
  'jeans-501-fit': 'straight leg trousers',
  'jeans-501': 'straight leg denim jeans',
}
const ALIASES = {
  tee: 'tee', 't-shirt': 'tee', 't shirt':'tee', tshirt: 'tee', shirt: 'tee', 'crew neck shirt': 'tee',
  hoodie: 'hoodie', sweatshirt: 'hoodie', 'hooded sweatshirt': 'hoodie',
  'zip hoodie': 'zip-hoodie', 'zip-up hoodie': 'zip-hoodie', 'zip up hoodie':'zip-hoodie', 'zippered hoodie': 'zip-hoodie',
  skirt: 'skirt', pants: 'jeans-501-fit', trousers: 'jeans-501-fit',
  'straight trousers': 'jeans-501-fit', jeans: 'jeans-501', denim: 'jeans-501',
  'denim jeans': 'jeans-501',
}
const FITS = {regular: 'regular', standard: 'regular', oversized: 'oversized', boxy: 'oversized',
  relaxed: 'relaxed', loose: 'relaxed', slim: 'slim', fitted: 'slim'}
const COLORS = new Set(['black','white','gray','navy','blue','red','green','brown','tan','beige','cream','pink','purple','orange','yellow'])
const CLOSURES = {none:'none', pullover:'none', zipper:'zipper', zip:'zipper', 'zip-front':'zipper',
  'zip up':'zipper', buttons:'buttons', button:'buttons', snaps:'snaps', unknown:'unknown'}
const TRAITS = {cropped:'cropped', crop:'cropped', boxy:'boxy', oversized:'oversized',
  'long sleeves':'long sleeves','short sleeves':'short sleeves', 'crew neck':'crew neck',
  'straight leg':'straight leg', 'a-line':'a-line'}
const SENSITIVE_FIELDS = /^(?:measurement|measurements|measurementscm|size|sizing|dimensions|lengthcm|chestcm|waistcm|inseamcm|pattern|panels|seams|hiddenconstruction|fitverified|factoryapproved|manufacturingapproved)$/i
const FAMILY_FROM_TEXT = [
  ['zip-hoodie', /\b(?:zip(?:[ -]?up)?[ -]?hoodie|zippered hoodie)\b/i],
  ['hoodie', /\b(?:hoodie|hooded sweatshirt)\b/i],
  ['tee', /\b(?:t[ -]?shirt|tee|crew neck shirt)\b/i],
  ['skirt', /\bskirt\b/i],
  ['jeans-501', /\b(?:jeans|denim)\b/i],
  ['jeans-501-fit', /\b(?:trousers|pants)\b/i],
]
const safeText = s => typeof s === 'string' && s.length <= 4000 && !/[\u0000-\u001f]/.test(s)
const normalize = value => typeof value === 'string' ? value.trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ') : ''
const dedupe = values => [...new Set(values)]
const pick = (record,keys) => {
  const values=keys.filter(key=>Object.hasOwn(record,key)).map(key=>record[key])
  return values
}
const fail = (reason,unsupportedTerms=[],decisionBlockers=[]) => ({
  ok:false,status:'review_blocked',reason,reviewCandidates:[],suggestedPrompt:null,
  unsupportedTerms:dedupe(unsupportedTerms),decisionBlockers:dedupe(decisionBlockers),
  requiresHumanConfirmation:true,readyToDraft:false,physicalFitVerified:false,manufacturingApproved:false,
})
const choice = (raw,map,label,unsupported,ambiguous) => {
  if(raw==null||raw==='')return null
  if(!safeText(raw)){unsupported.push(label+': invalid type or length');return null}
  const resolved=map[normalize(raw)]??null
  if(!resolved){unsupported.push(label+': '+String(raw).slice(0,80));return null}
  return resolved
}
function familyFromDescription(text) {
  const matched=FAMILY_FROM_TEXT.filter(([,re])=>re.test(text)).map(([id])=>id)
  if(matched.includes('zip-hoodie'))matched.splice(matched.indexOf('hoodie'),1)
  if(matched.includes('jeans-501'))matched.splice(matched.indexOf('jeans-501-fit'),1)
  return dedupe(matched)
}
function findUserTrait(text,patterns) {
  return Object.entries(patterns).filter(([,re])=>re.test(text)).map(([key])=>key)
}
const USER_FITS = {oversized:/\b(?:oversized|boxy)\b/i,relaxed:/\b(?:relaxed|baggy|loose)\b/i,
  slim:/\b(?:slim|fitted)\b/i,regular:/\b(?:regular|standard)\b/i}
const USER_COLORS=Object.fromEntries([...COLORS].map(c=>[c,new RegExp('\\b'+c+'\\b','i')]))
const USER_CLOSURES={zipper:/\b(?:zipper|zip-up|zip hoodie|zippered)\b/i,buttons:/\bbuttons?\b/i,
  snaps:/\bsnaps?\b/i,pullover:/\bpullover\b/i}

/** ModelResult is untrusted Ollama JSON (object or JSON string). No network, drafts or side effects. */
export function planExoVisionPhotoDraft20261102(modelResult,{userDescription='',userTemplateId=null}={}) {
  if(!safeText(userDescription)||typeof userDescription!=='string')
    return fail('Description must be printable text under 4000 characters.')
  if(userTemplateId!=null&&!Object.hasOwn(TEMPLATES,userTemplateId))
    return fail('Selected garment template is not supported.',[String(userTemplateId)])
  let model=modelResult
  if(typeof modelResult==='string'){
    if(modelResult.length>12000)return fail('Vision response is too large.')
    try{model=JSON.parse(modelResult)}catch{return fail('Vision response must contain valid JSON.')}
  }
  if(!model||typeof model!=='object'||Array.isArray(model))return fail('Vision response must be one JSON object.')
  if(model.ok===false||model.error)return fail('Vision model did not produce a usable review.')
  const unsupportedTerms=[],decisionBlockers=[]
  const knownKeys=new Set(['ok','family','garmentFamily','garment_type','garmentType','fit','color','colour',
    'closure','closures','visibleTraits','visibleFeatures','onBody','on_body','wornByModel',
    'view','confidence','notes','description','uncertainty','uncertain','reason','model'])
  for(const key of Object.keys(model)){
    if(SENSITIVE_FIELDS.test(key))unsupportedTerms.push('unverified photo-derived '+key)
    else if(!knownKeys.has(key))unsupportedTerms.push('unrecognized model field '+key.slice(0,80))
  }
  const selections=(name,keys,map)=>{
    const raw=pick(model,keys)
    const recognized=dedupe(raw.map(value=>choice(value,map,name,unsupportedTerms)).filter(Boolean))
    if(recognized.length>1)decisionBlockers.push('Conflicting vision '+name+' labels.')
    return recognized[0]??null
  }
  const visionFamily=selections('family',['family','garmentFamily','garment_type','garmentType'],ALIASES)
  const visionFit=selections('fit',['fit'],FITS)
  const visionColor=selections('color',['color','colour'],Object.fromEntries([...COLORS].map(c=>[c,c]).concat([['grey','gray']])))
  const visionClosure=selections('closure',['closure','closures'],CLOSURES)
  const traitsInput=model.visibleTraits??model.visibleFeatures??[]
  if(!Array.isArray(traitsInput)||traitsInput.length>20)decisionBlockers.push('Visible traits must be an array of at most 20 strings.')
  const traits=Array.isArray(traitsInput)&&traitsInput.length<=20
    ?dedupe(traitsInput.map(t=>choice(t,TRAITS,'visible trait',unsupportedTerms)).filter(Boolean)):[]
  const userFamilies=familyFromDescription(userDescription)
  if(userFamilies.length>1)decisionBlockers.push('User description names multiple garment families.')
  if(userTemplateId&&userFamilies.length&&userFamilies[0]!==userTemplateId)
    decisionBlockers.push('Selected template conflicts with the user description.')
  const family=userTemplateId??userFamilies[0]??visionFamily
  if(!family)decisionBlockers.push('Confirm one supported garment family before drafting.')
  if(visionFamily&&family&&visionFamily!==family)
    decisionBlockers.push('The vision garment label conflicts with the user-selected family; review the reference.')
  const fitWords=findUserTrait(userDescription,USER_FITS)
  const colorWords=findUserTrait(userDescription,USER_COLORS)
  const closureWords=findUserTrait(userDescription,USER_CLOSURES)
  if(fitWords.length>1)decisionBlockers.push('User description contains conflicting fits.')
  if(colorWords.length>1)decisionBlockers.push('User description contains conflicting colors.')
  if(closureWords.length>1)decisionBlockers.push('User description contains conflicting closures.')
  const fit=fitWords[0]??visionFit
  const color=colorWords[0]??visionColor
  const closure=closureWords[0]??visionClosure
  const onBody=model.onBody===true||model.on_body===true||model.wornByModel===true||/\b(?:on.body|worn|modeled|modelled)\b/i.test(String(model.view??''))
  if(onBody)decisionBlockers.push('Model-worn photo conceals measurements, ease, and hidden cutting lines; review garment family and visible design details with the user.')
  if((model.onBody!=null&&typeof model.onBody!=='boolean')||(model.wornByModel!=null&&typeof model.wornByModel!=='boolean'))
    decisionBlockers.push('On-body classification is invalid or ambiguous.')
  if(!['none','zipper',null].includes(closure))unsupportedTerms.push('closure '+closure+' requires authored construction confirmation')
  if(family==='hoodie'&&closure==='zipper')decisionBlockers.push('Visible zipper suggests zip-up hoodie; user must select the zip-hoodie family.')
  if(family==='zip-hoodie'&&closure==='none')decisionBlockers.push('Selected zip-up hoodie conflicts with a pullover closure.')
  if(closure==='zipper'&&!['zip-hoodie','hoodie'].includes(family))unsupportedTerms.push('zipper has no supported geometry for '+family)
  if(family==='tee'&&traits.includes('long sleeves'))unsupportedTerms.push('long sleeves require a different authored shirt block')
  if(family==='hoodie'&&traits.includes('short sleeves'))unsupportedTerms.push('short sleeves require a different authored hoodie block')
  if(traits.includes('a-line')&&family!=='skirt')unsupportedTerms.push('a-line geometry unsupported for '+family)
  if((family==='jeans-501'||family==='jeans-501-fit')&&traits.includes('cropped'))unsupportedTerms.push('cropped trousers require size-specific pattern review')
  if(typeof model.confidence==='number'&&model.confidence<.5)decisionBlockers.push('Vision model reported low confidence.')
  if(model.uncertain===true||model.uncertainty===true)decisionBlockers.push('Vision model marked the description uncertain.')
  if(unsupportedTerms.length)decisionBlockers.push('Vision result contains unsupported or unverified attributes; review them manually.')
  // Only finite supported text is ever fed forward. Freeform model prose cannot enter a draft prompt.
  const promptParts=family?['Create a']:['Review a']
  if(fit&&fit!=='regular')promptParts.push(fit)
  if(traits.includes('cropped')&&['tee','hoodie','zip-hoodie'].includes(family))promptParts.push('cropped')
  promptParts.push(family?TEMPLATES[family]:'garment')
  const suggestedPrompt=family?promptParts.join(' ').replace(/^Create a (?=[aeiou])/,'Create an '):null
  const reviewCandidates=family?[{templateId:family,fit:fit??null,color:color??null,
    closure:closure??null,visibleTraits:traits,suggestedPrompt,source:'vision_observation_requires_review'}]:[]
  return {ok:decisionBlockers.length===0,status:decisionBlockers.length?'review_blocked':'review_required',
    reviewCandidates,suggestedPrompt,unsupportedTerms:dedupe(unsupportedTerms),
    decisionBlockers:dedupe(decisionBlockers),requiresHumanConfirmation:true,readyToDraft:false,
    selectedByUser:{templateId:userTemplateId,descriptionSupplied:Boolean(userDescription.trim())},
    visionEvidence:{family:visionFamily,fit:visionFit,color:visionColor,closure:visionClosure,
      visibleTraits:traits,onBody,uncalibrated:true},
    physicalFitVerified:false,manufacturingApproved:false,
    nextAction:'Ask the user to confirm the garment family and visible traits; then explicitly submit a confirmed text prompt to the existing pattern drafter.'}
}
