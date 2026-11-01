import {prepareModarisNativeMeasurementCommit20261027 as prepareNative} from './modarisNativeMeasurementCommit20261027.js'
import {prepareModarisNativeMultiPanelMeasurementCommit20261030 as prepareMultiple} from './modarisNativeMultiPanelMeasurementCommit20261030.js'
import {reviewNativeBindingMeasurements as reviewNative} from './nativeBindingMeasurementReview20261027.js'

const fail=reason=>Object.freeze({ok:false,reason,manufacturingApproved:false})
const direct=value=>typeof value==='number'?value:
  value&&typeof value==='object'&&!Object.hasOwn(value,'formula')?value.valueMm:undefined

/** Route a reviewed worksheet edit through the existing Rust-owned geometric
 * transaction only when it changes one saved direct measurement. Do not
 * advertise browser-computed AnchorGroup edits as a native chart transaction.
 */
export function prepareModarisNativeWorksheetCommit20261030(snapshot,sidecar,reviewed){
  try {
    if(reviewed?.ok!==true||!reviewed.sidecar||!sidecar?.measurements||
      !reviewed.sidecar.measurements)throw Error('Missing validated worksheet review')
    // The native RPC has no browser-supplied point positions, but the UI must
    // still prove that the reviewed chart, graph identity and displayed point
    // deltas belong to THIS source revision. Comparing only measurement values
    // would accept a stale/altered review and advertise a different operation
    // from the one the operator actually inspected. Rebuild the entire bounded
    // read-only review from the current source before permitting the RPC.
    const fresh=reviewNative(snapshot,sidecar,reviewed.sidecar.measurements)
    if(!fresh.ok||JSON.stringify(fresh)!==JSON.stringify(reviewed))
      throw Error('Worksheet review evidence differs from the current source, bindings or displayed geometry')
    const before=sidecar.measurements,after=reviewed.sidecar.measurements
    const names=Object.keys(before),nextNames=Object.keys(after)
    if(names.length!==nextNames.length||nextNames.some(name=>!Object.hasOwn(before,name)))
      throw Error('One-step native worksheet edit cannot add or remove measurements')
    const changed=names.filter(name=>{
      const previous=direct(before[name]),next=direct(after[name])
      if(Number.isFinite(previous)&&Number.isFinite(next))return previous!==next
      return JSON.stringify(before[name])!==JSON.stringify(after[name])
    })
    if(changed.length!==1)throw Error('One-step native worksheet edit requires exactly one changed direct measurement; other charts require explicit separate review')
    const measurement=changed[0],valueMm=direct(after[measurement])
    if(!Number.isFinite(valueMm)||!Number.isFinite(direct(before[measurement])))
      throw Error('One-step native worksheet edit cannot change formulas or computed definitions')
    const panelCount=new Set((sidecar.bindings??[]).map(binding=>binding.panelId)).size
    const native=panelCount>1?
      prepareMultiple(snapshot,sidecar,reviewed):
      prepareNative(snapshot,sidecar,measurement,valueMm)
    if(!native.ok)throw Error(native.reason)
    // Return the precise native preparation envelope. The independent
    // postcommit witness compares its complete shape against a fresh preflight.
    return native
  }catch(error){return fail(error?.message??String(error))}
}
