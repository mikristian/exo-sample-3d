import {strToU8} from 'fflate'
import {sha256Bytes} from './sha256Bytes.js'

/** Stable source evidence fingerprint. This is a *content identity* only,
 * never a vendor revision, signature, pattern certification or factory pass.
 * Intentionally ignores transitory UI state, screenshots and 3D simulation.
 */
export function techPackSourceIdentity20261031({source={},snapshot=null,project=null,nativeMode=true}={}){
 const native=nativeMode===true
 const panels=native?snapshot?.template?.panels:project?.pieces
 const seams=native?snapshot?.template?.seams:project?.seams
 const fabrics=native?snapshot?.template?.fabrics:project?.fabrics
 const graphic=native?snapshot?.printGraphics:project?.printGraphics
 const visible=Array.isArray(panels)&&panels.length>0
 const sorted=v=>Array.isArray(v)?[...v].sort((a,b)=>String(a?.id??a?.name??'').localeCompare(String(b?.id??b?.name??''))):[]
 const data={kind:native?'native':'project',panels:sorted(panels),seams:sorted(seams),
   fabrics:sorted(fabrics),artwork:sorted(graphic),pom:source.pom||null,
   grading:source.grading||null,productionSpec:source.productionSpec||null}
 const bytes=strToU8(JSON.stringify(data))
 if(!visible||bytes.length>8_000_000)return {key:null,status:'unavailable',contentHash:null}
 const contentHash=sha256Bytes(bytes)
 return {key:'content:'+contentHash.slice(0,32),contentHash,status:'source-fingerprint',
   sourceRevision:source.revision??null,manufacturingApproved:false,
   disclaimer:'Content fingerprint is a local change-detection reference, not a signed production revision.'}
}
