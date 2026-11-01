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
export function nativeBridgeFetch(input,options={}){
 const location=globalThis.window?.location
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location?.href||'http://localhost')
 // Agent/collaboration credentials have different scopes; never replace them.
 if(url.origin!==nativeBridgeOrigin()||/^\/(agent|collab)\/v1\//.test(url.pathname))return globalThis.fetch(input,options)
 const headers=new Headers(input instanceof Request?input.headers:undefined)
 new Headers(options.headers).forEach((v,k)=>headers.set(k,v))
 const auth=nativeWorkspaceHeaders().Authorization
 if(auth&&!headers.has('Authorization'))headers.set('Authorization',auth)
 return globalThis.fetch(input,{...options,headers,redirect:'error'})
}
