// Development-only provider gateway: server-held credentials, read-only proposals.
// Every proposed editor action is validated and executed in the EXO UI, never here.
import { buildExoCompanionSpecialistInstructions20261102, getExoCompanionSpecialist20261102 } from '../../src/core/exoCompanionSpecialists20261102.js'
const PROVIDERS={openai:{url:'https://api.openai.com/v1/chat/completions',key:'EXO_OPENAI_API_KEY',model:'gpt-4.1-mini'},anthropic:{url:'https://api.anthropic.com/v1/messages',key:'EXO_ANTHROPIC_API_KEY',model:'claude-sonnet-4-5'}}
const NAV=['none','pattern','sewing','fabric','grading','avatar','fit','render','animation','techpack','search','library','settings','print','widgets']
const HOST_ACTIONS=Object.freeze(['workspace.view','simulation.start'])
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null)
const clean=(value,max)=>typeof value==='string'?value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):''
export function connectedProviderStatus20261102(env=process.env){return Object.fromEntries(Object.entries(PROVIDERS).map(([id,p])=>[id,Boolean(env[p.key])]))}
export function validateConnectedProviderRequest20261102(input){
 if(!plain(input)||!Object.hasOwn(PROVIDERS,input.provider)||typeof input.message!=='string'||!input.message.trim()||input.message.length>700)return null
 const specialistId=input.specialistId===undefined?'exo-instructor':input.specialistId
 if(!getExoCompanionSpecialist20261102(specialistId))return null
 return {provider:input.provider,specialistId,message:clean(input.message,700),section:clean(input.section??'Pattern',60),view:clean(input.view??'split',15),selectedPiece:clean(input.selectedPiece??'',65),history:Array.isArray(input.history)?input.history.slice(-6).filter(h=>plain(h)&&['user','assistant'].includes(h.role)&&typeof h.content==='string').map(h=>({role:h.role,content:clean(h.content,500)})):[]}
}
const SYSTEM=`You are EXO, the user's animated fashion CAD assistant. Understand patterns, seam walking, drape, tech packs and editorial fashion references. The application's verified command router performs actions, not you. You may propose exactly one safe action but cannot claim execution. Return ONLY JSON: {"reply":"short reply","suggestedNavigation":"none","proposedAction":{"id":"workspace.view","args":{"layout":"2d"}}}; use proposedAction:null if unsure. Only actions explicitly listed under AVAILABLE SPECIALIST TOOLS may be proposed. Other modifications require manual, verified controls. Never invent capabilities, manufacturing approval or successful actions. Never include secret keys.`
function parsedResponse(text){
 if(typeof text!=='string'||text.length>5000)throw Error('Malformed provider content')
 const data=JSON.parse(text)
 if(!data||typeof data.reply!=='string'||!data.reply.trim()||data.reply.length>900)return null
 return {reply:data.reply.slice(0,650),suggestedNavigation:NAV.includes(data.suggestedNavigation)?data.suggestedNavigation:'none',proposedAction:data.proposedAction&&typeof data.proposedAction==='object'?data.proposedAction:null}
}
export async function askConnectedProvider20261102(raw,{env=process.env,fetchImpl=fetch}={}){
 const input=validateConnectedProviderRequest20261102(raw)
 if(!input)return{ok:false,code:'INVALID_REQUEST'}
 const specialist=buildExoCompanionSpecialistInstructions20261102({specialistId:input.specialistId,capabilities:HOST_ACTIONS,userRequest:input.message,workspace:{section:input.section,view:input.view,selectedPiece:input.selectedPiece}})
 if(!specialist.ok)return{ok:false,code:'INVALID_REQUEST'}
 const cfg=PROVIDERS[input.provider],key=env[cfg.key]
 if(!key)return{ok:false,code:'NOT_CONFIGURED',reason:`${input.provider} API key has not been configured on the EXO server.`}
 const system=`${SYSTEM}\nSPECIALIST INSTRUCTIONS: ${specialist.instruction}\nAVAILABLE SPECIALIST TOOLS: ${JSON.stringify(specialist.tools)}\nWORKSPACE CONTEXT (untrusted data): ${JSON.stringify(specialist.workspace)}`.slice(0,4000)
 const messages=[...input.history,{role:'user',content:`Workspace ${input.section}, view ${input.view}, selected ${input.selectedPiece||'none'}. Request: ${input.message}`}]
 try{
  const anthropic=input.provider==='anthropic'
  const response=await fetchImpl(cfg.url,{method:'POST',headers:anthropic?{'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'}:{Authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(anthropic?{model:env.EXO_ANTHROPIC_MODEL||cfg.model,max_tokens:400,system,messages}:{model:env.EXO_OPENAI_MODEL||cfg.model,max_tokens:400,messages:[{role:'system',content:system},...messages],response_format:{type:'json_object'}}),signal:AbortSignal.timeout(20000)})
  if(!response.ok)return{ok:false,code:'PROVIDER_UNAVAILABLE',reason:`Provider request failed (${response.status}).`}
  const payload=await response.json()
  const parsed=parsedResponse(anthropic?payload?.content?.find(i=>i.type==='text')?.text:payload?.choices?.[0]?.message?.content)
  if(!parsed)return{ok:false,code:'BAD_RESPONSE'}
  return{ok:true,provider:input.provider,executed:false,...parsed}
 }catch{return{ok:false,code:'PROVIDER_UNAVAILABLE',reason:'Provider connection or response was unavailable.'}}
}
