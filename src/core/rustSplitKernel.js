/** Rust/WASM calculations for native-compatible Split Line geometry. */
export const RUST_SPLIT_ABI_VERSION = 1
const WASM_URL = '/wasm/exo_split_kernel.wasm'
const required = ['exo_split_abi_version','exo_split_uniform_fraction',
  'exo_split_length_fraction','exo_split_ratio_fraction','exo_split_quadratic_parameter']
let rust = null
let loading = null
let error = null

export const rustSplitKernelReady = () => rust !== null
export const rustSplitKernelStatus = () => ({
  backend: rust ? 'rust-wasm' : 'javascript-fallback',
  abiVersion: rust?.exo_split_abi_version() ?? null, error,
})

export async function initializeRustSplitKernel({bytes,url=WASM_URL}={}) {
  if(rust) return true
  if(loading) return loading
  loading = (async()=>{
    try {
      const input = bytes ?? await fetch(url).then(response=>{
        if(!response.ok) throw new Error(`Split WASM HTTP ${response.status}`)
        return response.arrayBuffer()
      })
      const instance = await WebAssembly.instantiate(input,{})
      const exports = instance.instance?.exports ?? instance.exports
      if(required.some(name=>typeof exports?.[name]!=='function') ||
        exports.exo_split_abi_version()!==RUST_SPLIT_ABI_VERSION) {
        throw new Error('Unexpected EXO Rust split ABI')
      }
      rust=exports
      error=null
      return true
    } catch(caught) {
      error=String(caught?.message ?? caught)
      return false
    } finally { loading=null }
  })()
  return loading
}

/** Null requests the original synchronous JS implementation. */
export function rustSplitUniformFractions(count) {
  if(!rust) return null
  const fractions=Array.from({length:count-1},(_,index)=>rust.exo_split_uniform_fraction(index+1,count))
  return fractions.every(Number.isFinite) ? fractions : null
}
export function rustSplitSingleFraction(method,value,edgeLengthCm) {
  if(!rust) return null
  const fraction=method==='length'
    ? rust.exo_split_length_fraction(value,edgeLengthCm)
    : method==='ratio' ? rust.exo_split_ratio_fraction(value) : NaN
  return Number.isFinite(fraction) ? fraction : null
}
export function rustSplitQuadraticParameter(a,control,b,fraction) {
  if(!rust) return null
  const values=[a?.x,a?.y,control?.x,control?.y,b?.x,b?.y,fraction]
  if(!values.every(Number.isFinite)) return null
  const t=rust.exo_split_quadratic_parameter(...values)
  return Number.isFinite(t) ? t : null
}

if(typeof window!=='undefined' && typeof fetch==='function' && typeof WebAssembly!=='undefined') {
  void initializeRustSplitKernel()
}
