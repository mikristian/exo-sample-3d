// Session credential ownership lives here, never in individual UI features.
// Only the configured loopback native bridge receives the shell credential.
export function nativeBridgeOrigin(location=globalThis.window?.location,env=import.meta.env){
 const port=location?.port
 const value=port==='5486'?'http://127.0.0.1:5485':port==='5386'?'http://127.0.0.1:5385':env?.VITE_CLOTHCRAFT_BRIDGE_URL||'http://127.0.0.1:5193'
 const url=new URL(value)
 return ['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&url.protocol==='http:'?url.origin:null
}
export function nativeWorkspaceHeaders(){
 const token=globalThis.window?.__EXO_WORKSPACE_TOKEN__||(import.meta.env?.DEV?import.meta.env?.VITE_CLOTHCRAFT_WORKSPACE_TOKEN:null)
 return {'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})}
}
let pendingCredentialRequest=null
async function nativeWorkspaceAuthorization(){
 const existing=nativeWorkspaceHeaders().Authorization
 if(existing)return existing
 const win=globalThis.window
 // Never request a credential from a regular website or development preview.
 if(!['5386','5486'].includes(win?.location?.port)||win?.location?.hostname!=='127.0.0.1'||
    typeof win?.webkit?.messageHandlers?.exoWorkspaceAuth?.postMessage!=='function')return null
 if(!pendingCredentialRequest){
  pendingCredentialRequest=new Promise(resolve=>{
   let finished=false
   let timeout
   const finish=auth=>{
    if(finished)return
    finished=true
    win.removeEventListener('exo-workspace-credential-ready',onCredential)
    clearTimeout(timeout)
    resolve(auth)
   }
   const onCredential=()=>{const auth=nativeWorkspaceHeaders().Authorization;if(auth)finish(auth)}
   win.addEventListener('exo-workspace-credential-ready',onCredential)
   timeout=setTimeout(()=>finish(null),1500)
   try{win.webkit.messageHandlers.exoWorkspaceAuth.postMessage('request')}
   catch{finish(null)}
   onCredential()
  }).finally(()=>{pendingCredentialRequest=null})
 }
 return pendingCredentialRequest
}
export async function nativeBridgeFetch(input,options={}){
 const location=globalThis.window?.location
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location?.href||'http://localhost')
 // Agent/collaboration credentials have different scopes; never replace them.
 if(url.origin!==nativeBridgeOrigin()||/^\/(agent|collab)\/v1\//.test(url.pathname))return globalThis.fetch(input,options)
 const headers=new Headers(input instanceof Request?input.headers:undefined)
 new Headers(options.headers).forEach((v,k)=>headers.set(k,v))
 const auth=await nativeWorkspaceAuthorization()
 if(auth&&!headers.has('Authorization'))headers.set('Authorization',auth)
 return globalThis.fetch(input,{...options,headers,redirect:'error'})
}
