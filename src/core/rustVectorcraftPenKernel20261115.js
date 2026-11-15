import {fetchWasmBytes} from './wasmTransport.js'

// VectorCraft-derived native Rust pen geometry. UI remains React; committed
// pattern edits still go through the authenticated EXO/ClothCraft Rust session.
// Before WASM is loaded, the original EXO JS preview math remains available.
let kernel=null
let loading=null
let error=null
const calls={tangent:0,cubic:0,closest:0,anchor:0,handle:0}
const finitePoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)
const finiteOptions=(...values)=>values.every(Number.isFinite)
export const rustVectorcraftPenKernelReady=()=>Boolean(kernel)
export const rustVectorcraftPenKernelStatus=()=>({
  backend:kernel?'rust-wasm':'javascript-fallback',
  error,
  operations:{...calls},
})
export async function initializeRustVectorcraftPenKernel({
  bytes,url='/wasm/exo_vectorcraft_pen_kernel.wasm',
}={}){
  if(kernel)return true
  if(loading)return loading
  loading=(async()=>{
    try{
      const raw=bytes??await fetchWasmBytes(url,'VectorCraft pen WASM HTTP ')
      const module=await WebAssembly.instantiate(raw,{})
      const e=module.instance?.exports??module.exports
      const names=['exo_pen_tangent_component','exo_pen_cubic_component',
        'exo_pen_anchor_kind','exo_pen_opposing_handle_component',
        'exo_pen_nearest_cubic_parameter']
      if(e?.exo_vectorcraft_pen_abi_version?.()!==1||names.some(name=>typeof e[name]!=='function'))
        throw Error('Invalid EXO VectorCraft Rust pen ABI')
      kernel=e
      error=null
      return true
    }catch(e){error=String(e?.message||e);return false}
    finally{loading=null}
  })()
  return loading
}
export function rustPenTangent(start,cursor,{shift=false,alt=false,threshold=.002}={}){
  if(!kernel||!finitePoint(start)||!finitePoint(cursor)||
     !finiteOptions(threshold)||threshold<0)return null
  const flags=(shift?1:0)|(alt?2:0)
  const values=[0,1].map(axis=>kernel.exo_pen_tangent_component(
    ...start,...cursor,flags,threshold,axis))
  if(!values.every(Number.isFinite))return null
  calls.tangent++
  return values
}
export function rustPenCubicAt(a,b,ta=[0,0],tb=[0,0],t=.5){
  if(!kernel||![a,b,ta,tb].every(finitePoint)||!Number.isFinite(t)||t<0||t>1)return null
  const args=[...a,...b,...ta,...tb,t]
  const values=Array.from({length:6},(_,axis)=>kernel.exo_pen_cubic_component(...args,axis))
  if(!values.every(Number.isFinite))return null
  calls.cubic++
  return {p:values.slice(0,2),left:values.slice(2,4),right:values.slice(4,6)}
}
export function rustPenClosestParameter(a,b,ta,tb,pos){
  if(!kernel||![a,b,ta,tb,pos].every(finitePoint))return null
  const value=kernel.exo_pen_nearest_cubic_parameter(...a,...b,...ta,...tb,...pos)
  if(!Number.isFinite(value)||value<=0||value>=1)return null
  calls.closest++
  return value
}
export function rustVectorcraftAnchorKind(p,hIn,hOut){
  if(!kernel||![p,hIn,hOut].every(finitePoint))return null
  const value=kernel.exo_pen_anchor_kind(...p,...hIn,...hOut)
  if(value===2)return null
  calls.anchor++
  return value===1?'smooth':'corner'
}
export function rustVectorcraftOppositeHandle(p,other,moved){
  if(!kernel||![p,other,moved].every(finitePoint))return null
  const values=[0,1].map(axis=>kernel.exo_pen_opposing_handle_component(
    ...p,...other,...moved,axis))
  if(!values.every(Number.isFinite))return null
  calls.handle++
  return values
}
if(typeof window!=='undefined'&&typeof WebAssembly!=='undefined')
  void initializeRustVectorcraftPenKernel()
