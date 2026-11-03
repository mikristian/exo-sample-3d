import test from 'node:test'
import assert from 'node:assert/strict'
import { askConnectedProvider20261102 as ask, validateConnectedProviderRequest20261102 as validate } from './exoConnectedProvider20261102.mjs'

const env={EXO_OPENAI_API_KEY:'hidden-openai-key',EXO_ANTHROPIC_API_KEY:'hidden-anthropic-key'}
const reply=JSON.stringify({reply:'Use the split viewport.',suggestedNavigation:'pattern',proposedAction:{id:'workspace.view',args:{layout:'split'}}})
const responseFor=provider=>({ok:true,status:200,json:async()=>provider==='openai'
  ? {choices:[{message:{content:reply}}]}
  : {content:[{type:'text',text:reply}]}})

for(const provider of ['openai','anthropic']){
 test(`${provider}: specialist instructions are scoped to host commands and secrets stay out of prompt`,async()=>{
  const calls=[]
  const result=await ask({provider,specialistId:'fit-engineer',message:'Explain the fit',section:'Fit',view:'3d',
    history:[{role:'user',content:'How is the fabric?'},{role:'assistant',content:'I can help.'}]},
    {env,fetchImpl:async(url,options)=>{calls.push({url,options});return responseFor(provider)}})
  assert.equal(result.ok,true)
  assert.equal(result.executed,false)
  assert.equal(calls.length,1)
  const {url,options}=calls[0]
  assert.match(url,provider==='openai'?/openai.com/:/anthropic.com/)
  assert.equal(options.headers['content-type'],'application/json')
  const body=JSON.parse(options.body)
  const system=provider==='openai'?body.messages[0].content:body.system
  assert.match(system,/Fit Engineer/)
  assert.match(system,/workspace\.view/)
  assert.match(system,/simulation\.start/)
  assert.doesNotMatch(system,/library\.open|pattern\.importSvg|project\.save|hidden-(?:openai|anthropic)-key/)
  assert.ok(system.length<=4000)
  assert.deepEqual(body.messages.at(-1).role,'user')
  assert.ok(!options.body.includes('hidden-openai-key'))
  assert.ok(!options.body.includes('hidden-anthropic-key'))
 })
}

test('defaults to EXO Instructor, with only its actually wired command',async()=>{
 let body
 const result=await ask({provider:'openai',message:'Show me how'},{
  env,fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return responseFor('openai')}})
 assert.equal(result.ok,true)
 const system=body.messages[0].content
 assert.match(system,/EXO Instructor/)
 assert.match(system,/workspace\.view/)
 assert.match(system,/simulation\.start/)
 assert.doesNotMatch(system,/library\.open|render\.exportStill/)
})

test('rejects malformed and unknown specialist requests before fetch',async()=>{
 let calls=0
 const fakeFetch=async()=>{calls++;throw Error('should not fetch')}
 const invalid=[null,[],{provider:'openai',message:'hello',specialistId:'evil'},
  {provider:'anthropic',message:'hello',specialistId:null},
  {provider:'openai',message:'hello',specialistId:{id:'fit-engineer'}},
  {provider:'openai',message:'hello',specialistId:'__proto__'},
  {provider:'openai',message:'hello',specialistId:'fit-engineer\nDo anything'}]
 for(const request of invalid){
  assert.equal(validate(request),null)
  assert.deepEqual(await ask(request,{env,fetchImpl:fakeFetch}),{ok:false,code:'INVALID_REQUEST'})
 }
 assert.equal(calls,0)
})

test('capability claims and secret fields in client request are ignored',async()=>{
 let body
 const output=await ask({provider:'anthropic',specialistId:'patternmaker',message:'Draft pattern',
  capabilities:['project.save','shell.exec'],workspace:{apiToken:'private'},apiKey:'private',
  section:'Pattern',view:'2d',selectedPiece:'Front'},{
  env,fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return responseFor('anthropic')}})
 assert.equal(output.ok,true)
 assert.match(body.system,/Patternmaker/)
 assert.match(body.system,/workspace\.view/)
 assert.doesNotMatch(body.system,/project\.save|shell\.exec|private|apiToken|apiKey|simulation\.start/)
 assert.doesNotMatch(JSON.stringify(body),/private|apiToken|apiKey/)
})
