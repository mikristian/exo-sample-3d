import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import {suggestExoAssistantLocal20261102} from './integrations/clothcraft/exoAppAssistantLocal20261102.mjs'
import {askConnectedProvider20261102,connectedProviderStatus20261102} from './integrations/clothcraft/exoConnectedProvider20261102.mjs'
import {installMacSpeechEndpoint} from './integrations/clothcraft/exoMacSpeechLocal20261102.mjs'
import {installKokoroEndpoint} from './integrations/clothcraft/exoKokoroLocal20261102.mjs'

export default defineConfig({
  plugins: [react(), {name: 'exo-local-kokoro-neural', configureServer: installKokoroEndpoint}, {name: 'exo-local-macos-speech', configureServer: installMacSpeechEndpoint}, {
    name: 'exo-assistant-local-neural-voice',
    configureServer(server) {
      // Optional local-only Azure Neural TTS. The subscription key is never
      // bundled into the browser. Browser voice synthesis works without it.
      const env=loadEnv(server.config.mode,server.config.root,'EXO_')
      const key=process.env.EXO_AZURE_SPEECH_KEY||env.EXO_AZURE_SPEECH_KEY
      const region=process.env.EXO_AZURE_SPEECH_REGION||env.EXO_AZURE_SPEECH_REGION||'eastus'
      const enabled=Boolean(key&&/^[a-z0-9-]+$/i.test(region))
      const xmlEscape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
      server.middlewares.use('/api/exo-assistant/speech',async(req,res,next)=>{
        if(req.url==='/status'&&req.method==='GET'){
          res.setHeader('Content-Type','application/json')
          res.setHeader('Cache-Control','no-store')
          res.end(JSON.stringify({available:enabled,voice:enabled?'en-US-JennyNeural':null}))
          return
        }
        if(req.url!=='/'||req.method!=='POST')return next()
        res.setHeader('Cache-Control','no-store')
        if(!enabled){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Azure voice is not configured in this local server.'}));return}
        try{
          let body=''
          for await(const part of req){
            body+=part
            if(body.length>1500)throw Error('Request exceeds speech limit')
          }
          const phrase=JSON.parse(body)?.text
          if(typeof phrase!=='string'||!phrase.trim()||phrase.length>650)throw Error('Speech input must contain up to 650 characters')
          const ssml=`<speak version="1.0" xml:lang="en-US"><voice xml:lang="en-US" name="en-US-JennyNeural">${xmlEscape(phrase)}</voice></speak>`
          const response=await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,{
            method:'POST',signal:AbortSignal.timeout(15000),
            headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3','User-Agent':'EXO-Local-Assistant'},
            body:ssml,
          })
          if(!response.ok)throw Error(`Speech provider returned ${response.status}`)
          const bytes=Buffer.from(await response.arrayBuffer())
          res.writeHead(200,{'Content-Type':'audio/mpeg','Content-Length':bytes.length})
          res.end(bytes)
        }catch(error){
          res.writeHead(/limit|characters/.test(error.message)?400:502,{'Content-Type':'application/json'})
          res.end(JSON.stringify({error:'Local neural speech could not be generated.'}))
        }
      })
    },
  }, {
    name:'exo-assistant-browser-local-ai',
    configureServer(server){
      server.middlewares.use('/api/exo-assistant/provider',async(req,res,next)=>{
        if(req.url==='/status'&&req.method==='GET'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({providers:connectedProviderStatus20261102()}));return}
        if(req.url!=='/'||req.method!=='POST')return next()
        try{let body='';for await(const chunk of req){body+=chunk;if(body.length>5000)throw Error('Too large')}
          const result=await askConnectedProvider20261102(JSON.parse(body));res.writeHead(result.ok?200:result.code==='INVALID_REQUEST'?400:503,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(result))}
        catch{res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,code:'INVALID_REQUEST'}))}
      })
      // The browser preview can ask the already-installed local Ollama model.
      // Only the bound loopback development server exposes this read-only route.
      server.middlewares.use('/api/exo-assistant/chat',async(req,res,next)=>{
        if(req.url==='/status'&&req.method==='GET'){
          res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'})
          res.end(JSON.stringify({available:true,model:'qwen3-vl-instruct:2b',executed:false}))
          return
        }
        if(req.url!=='/'||req.method!=='POST')return next()
        res.setHeader('Cache-Control','no-store')
        try{
          let body=''
          for await(const chunk of req){
            body+=chunk
            if(body.length>4300)throw Error('Message too long')
          }
          const result=await suggestExoAssistantLocal20261102(JSON.parse(body))
          res.writeHead(result.ok?200:503,{'Content-Type':'application/json'})
          res.end(JSON.stringify(result))
        }catch{
          res.writeHead(400,{'Content-Type':'application/json'})
          res.end(JSON.stringify({ok:false,reason:'Invalid local assistant request.'}))
        }
      })
    },
  }, {
    name: 'exo-native-node-util-browser-guard',
    enforce: 'pre',
    resolveId(source, importer, options) {
      // Native source fixture/grade sidecar safety guards require Node's
      // util.types.isProxy. In a browser there is no equivalent. Keep direct
      // Node imports intact for native QA, and fail closed if a web UI tries
      // to invoke one of these Node-only grade validators.
      if (!options?.ssr && source === 'node:util' &&
          /[/\\]src[/\\]core[/\\]/.test(importer || '')) {
        return '\0exo-node-util-browser-guard'
      }
      return null
    },
    load(id) {
      if (id === '\0exo-node-util-browser-guard')
        return `export const types = Object.freeze({isProxy() { throw new Error('EXO native grade safety validation requires Node and is unavailable in the browser. No grading changes were applied.') }})`
      return null
    },
  }],
  server: {
    host: '127.0.0.1',
    port: 5188,
  },
})
