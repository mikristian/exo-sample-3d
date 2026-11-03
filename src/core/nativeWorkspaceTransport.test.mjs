import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {nativeBridgeFetch,nativeBridgeOrigin} from './nativeWorkspaceTransport.js';
test('native credential is confined to configured bridge and never overrides agent scope',async()=>{const previousWindow=globalThis.window,previousFetch=globalThis.fetch;const credential=randomUUID();globalThis.window={location:{port:'5386',href:'http://127.0.0.1:5386/'},__EXO_WORKSPACE_TOKEN__:credential};const calls=[];globalThis.fetch=async(input,options)=>{calls.push({input,options});return {ok:true}};try{await nativeBridgeFetch('http://127.0.0.1:5385/production/native-verified/v1/order',{method:'POST'});assert.equal(calls[0].options.headers.get('Authorization'),'Bearer '+credential);assert.equal(calls[0].options.redirect,'error');for(const url of ['https://example.com/workspace','http://127.0.0.1:5193/workspace','http://127.0.0.1:5385/agent/v1/actions']){await nativeBridgeFetch(url,{});assert.equal(calls.at(-1).options.headers,undefined);}assert.equal(nativeBridgeOrigin({port:'5173'},{VITE_CLOTHCRAFT_BRIDGE_URL:'https://example.com'}),null);}finally{globalThis.window=previousWindow;globalThis.fetch=previousFetch;}});

test('native WKWebView can recover missing document-start credential before workspace POST',async()=>{
 const previousWindow=globalThis.window,previousFetch=globalThis.fetch
 const listeners=new Set(),calls=[]
 const token=randomUUID()
 let handshakes=0
 const win={location:{port:'5386',hostname:'127.0.0.1',href:'http://127.0.0.1:5386/'},
  addEventListener:(event,fn)=>{if(event==='exo-workspace-credential-ready')listeners.add(fn)},
  removeEventListener:(event,fn)=>{listeners.delete(fn)},
  webkit:{messageHandlers:{exoWorkspaceAuth:{postMessage(message){
   assert.equal(message,'request');handshakes++
   queueMicrotask(()=>{win.__EXO_WORKSPACE_TOKEN__=token;for(const listener of listeners)listener()})
  }}}}}
 globalThis.window=win
 globalThis.fetch=async(input,options)=>{calls.push({input,options});return {ok:true}}
 try{
  await Promise.all([nativeBridgeFetch('http://127.0.0.1:5385/workspace',{method:'POST'}),
   nativeBridgeFetch('http://127.0.0.1:5385/production/native-verified/v1/order',{method:'POST'})])
  assert.equal(handshakes,1)
  assert.equal(calls.length,2)
  assert.ok(calls.every(call=>call.options.headers.get('Authorization')==='Bearer '+token))
  assert.equal(listeners.size,0)
 }finally{globalThis.window=previousWindow;globalThis.fetch=previousFetch}
})
