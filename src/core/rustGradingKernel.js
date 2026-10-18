// Sync public grading calls preserve compatibility while this standalone WASM loads.
export const RUST_GRADING_ABI_VERSION = 1
let kernel = null
let pending = null
let error = null
export const rustGradingKernelReady = () => Boolean(kernel)
export const rustGradingKernelStatus = () => ({backend:kernel?'rust-wasm':'javascript-fallback', error})
export async function initializeRustGradingKernel({bytes,url='/wasm/exo_grading_kernel.wasm'}={}) {
  if (kernel) return true
  if (pending) return pending
  pending = (async () => {
    try {
      const raw = bytes ?? await fetch(url).then(r => {if(!r.ok)throw new Error(`Grading WASM HTTP ${r.status}`);return r.arrayBuffer()})
      const module = await WebAssembly.instantiate(raw,{})
      const exports = module.instance?.exports ?? module.exports
      if (exports.exo_grading_abi_version?.() !== RUST_GRADING_ABI_VERSION ||
          typeof exports.exo_grade_point_x !== 'function' || typeof exports.exo_grade_point_y !== 'function')
        throw new Error('Unexpected EXO Rust grading ABI')
      kernel = exports
      error = null
      return true
    } catch (e) { error=String(e?.message??e); return false }
    finally { pending=null }
  })()
  return pending
}
export function gradeAutomaticCoordinates(point,bounds,offset,width,length) {
  const {minX,maxX,minY,maxY}=bounds
  const {x,y}=point
  if(kernel) {
    return {x:kernel.exo_grade_point_x(x,y,minX,maxX,minY,maxY,offset,width,length),
      y:kernel.exo_grade_point_y(x,y,minX,maxX,minY,maxY,offset,width,length)}
  }
  const centerX=(minX+maxX)*0.5
  const normalizedY=(y-minY)/Math.max(1,maxY-minY)
  return {x:x+Math.sign(x-centerX)*(width*offset)*0.5*(0.55+0.45*(1-normalizedY)),
    y:y-length*offset*(1-normalizedY)}
}
// Kick off loading during browser module evaluation, preserving the synchronous API.
if(typeof window!=='undefined' && typeof WebAssembly!=='undefined')void initializeRustGradingKernel()
