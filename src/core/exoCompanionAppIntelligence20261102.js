import { EXO_COMPANION_TOUR_MODES } from './exoCompanionExperience20261102.js'

// Information and routing only. Execution belongs to the app's verified handlers.
const TOPICS = [
  {id:'pattern',name:'Pattern',section:'Pattern',tour:'pattern',aliases:['2d','pattern drafting','draft','pattern piece','curves','notch','measure','mirror'],actions:['2d.select','2d.points','2d.split','2d.curve','2d.internal','2d.notch','2d.pin','2d.measure','2d.mirror','2d.add']},
  {id:'sewing',name:'Sewing',section:'Sewing',tour:'sewing',aliases:['seam','stitch','topstitch','zipper','button','buttonhole','fastener','trim'],actions:['sewing.sew','sewing.inspect','sewing.fastener','object.buttons','object.buttonholes','object.topstitch','object.trim']},
  {id:'fabric',name:'Fabric',section:'Fabric',tour:'fabric',aliases:['materials','textile','swatch','fabric library'],actions:['materials.fabric','materials.edit','materials.add']},
  {id:'avatar',name:'Avatar',section:'Avatar',tour:'avatar',aliases:['mannequin','body model','measurements avatar'],actions:['avatar.library','avatar.properties']},
  {id:'fit',name:'Fit',section:'Fit',tour:'3d',aliases:['3d','simulation','simulate','drape','collision','strain','ease'],actions:['3d.fit']},
  {id:'production',name:'Production',section:'Production',tour:'grading',aliases:['grading','nest','sizes','pom','size rules'],actions:['workspace.production','object.grading','object.pom']},
  {id:'render',name:'Render',section:'Render',tour:'render',aliases:['rendering','lighting','camera','photorealistic'],actions:['render.workspace']},
  {id:'animation',name:'Animation',section:'Animation',tour:'animation',aliases:['walk','walk cycle','runway','motion','spin','turntable'],actions:[]},
  {id:'techpack',name:'Techpack',section:null,tour:'techpack',aliases:['tech pack','technical package','spec sheet','bill of materials'],actions:[]},
  {id:'settings',name:'Settings',section:null,tour:'navigation',aliases:['theme','appearance','preferences','palette','interface color','customization'],actions:['settings.simulation']},
  {id:'print',name:'Print layout',section:null,tour:'print',aliases:['printing','printer','tile','tiled','paper','pdf layout','a4','letter'],actions:[]},
  {id:'library',name:'File Library',section:null,tour:'library',aliases:['saved projects','reference library','asset library','moodboard','references'],actions:[]},
  {id:'widget-studio',name:'Widget Studio',section:null,tour:'widgets',aliases:['custom widget','custom panel','plugin panel','widget editor','studio widget'],actions:[]},
]

export const EXO_APP_KNOWLEDGE_20261102 = Object.freeze(TOPICS.map(topic=>Object.freeze({...topic,aliases:Object.freeze([...topic.aliases]),actions:Object.freeze([...topic.actions])})))
const clean = value => typeof value === 'string' ? value.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\b2[ -]?d\b/g,'2d').replace(/\b3[ -]?d\b/g,'3d').replace(/[^\p{L}\p{N}\s'-]/gu,' ').replace(/\s+/g,' ').trim() : ''
const contains = (text,phrase) => new RegExp(`(?:^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+')}(?=$|\\s)`).test(text)
const teach = /\b(?:walk me through|teach|tutorial|guide me|guided|step by step|show me how|how do i|how to|demonstrate)\b/
const explain = /\b(?:what is|what does|why|explain|tell me about|which tools|what options|help with|help me understand)\b/
const navigate = /\b(?:open|go to|navigate to|take me to|switch to|bring up|show me|where is|find|pull up|view)\b/
const actionWord = /\b(?:make|create|change|set|apply|insert|add|delete|remove|simulate|grade|sew|render|export|print|save|update|turn on|turn off)\b/
// A dedicated tour is preferred; until installed, route to an existing small tour.
const TOUR_FALLBACK = Object.freeze({sewing:'navigation',avatar:'3d',render:'navigation',animation:'3d',library:'navigation',widgets:'navigation',print:'grading'})

/** Pure response descriptor; no handler is invoked or successful editing claimed.
 * kind: 'tour' | 'navigate' | 'answer' | 'unrecognized'.
 * For navigation section may be null; consumers must use verified routes.
 */
export function interpretExoAppQuestion20261102(request,context={}) {
  const text=clean(request)
  if(!text||text.length>1200)return {kind:'unrecognized',message:'Ask about an EXO workspace or named tool.'}
  const scored=EXO_APP_KNOWLEDGE_20261102.map(topic=>{
    const phrases=[topic.id,topic.name.toLowerCase(),...topic.aliases]
    const matches=phrases.filter(phrase=>contains(text,clean(phrase)))
    return {topic,score:matches.length?Math.max(...matches.map(phrase=>phrase.length))+matches.length:0}
  }).filter(entry=>entry.score>0).sort((a,b)=>b.score-a.score)
  const broad=contains(text,'entire app')||contains(text,'everything')||contains(text,'software')||contains(text,'all workspaces')
  const topic=broad?null:scored[0]?.topic
  const how=teach.test(text)
  if(topic===undefined){
    if(how)return {kind:'tour',topic:'full',tourMode:'full',message:'I can guide you through the EXO studio, starting with its main workspaces.'}
    return {kind:'unrecognized',message:'I can explain Pattern, Sewing, Fabric, Avatar, Fit, Production, Render, Animation, Techpack, Settings, Print layout, File Library and Widget Studio.'}
  }
  const target=topic||{id:'full',name:'EXO studio',section:null,tour:'full',actions:[]}
  const tourMode=Object.hasOwn(EXO_COMPANION_TOUR_MODES,target.tour)?target.tour:TOUR_FALLBACK[target.tour]||'navigation'
  const info={topic:target.id,section:target.section,tourMode,availableActions:[...target.actions]}
  if(how)return {kind:'tour',...info,message:`I'll guide you through ${target.name}. The tour points to existing tools and does not change your garment.`}
  if(explain.test(text)||/\b(?:list|all|options|tools|features|available)\b/.test(text))return {kind:'answer',...info,message:target.actions.length?`${target.name} includes these registered commands: ${target.actions.join(', ')}. Select a command in the app to use it.`:`${target.name} is available in EXO. Open its workspace or use the guided tour to inspect the available controls.`}
  if(navigate.test(text)&&(!actionWord.test(text)||/\b(?:where is|where can i find|how can i find|find|locate)\b/.test(text)))return {kind:'navigate',...info,message:target.section?`The ${target.section} workspace can be opened through studio navigation. No action has been taken.`:`Find ${target.name} through the existing studio navigation. No action has been taken.`}
  if(actionWord.test(text))return {kind:'answer',...info,requiresVerifiedAction:true,message:`For ${target.name}, use the application's verified command handlers. I can explain or show the available controls, but this answer has not performed an edit.`}
  return {kind:'answer',...info,message:`${target.name}: ${target.actions.length?`available registered commands include ${target.actions.join(', ')}.`:'use the workspace navigation and its available controls.'}`}
}
