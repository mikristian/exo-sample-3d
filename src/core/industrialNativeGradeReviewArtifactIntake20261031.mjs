// Local byte-integrity gate for six-size signed manufacturing review packets.
// Native CAD and .RUL formats are NOT parsed or authenticated by this module.
import {sha256Bytes} from './sha256Bytes.js'

const SIZES=Object.freeze(['XS','S','M','L','XL','XXL'])
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 [Object.prototype,null].includes(Object.getPrototypeOf(value))
const exact=(value,keys)=>plain(value)&&Reflect.ownKeys(value).length===keys.length&&
 keys.every(key=>Object.hasOwn(value,key)&&
  Object.getOwnPropertyDescriptor(value,key)?.enumerable===true&&
  Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))
const deny=(code,detail=code)=>({ok:false,code,detail,artifactBytesCrosschecked:false,
 releaseReadyForIndependentAudit:false,independentReceiverAuthenticated:false,
 nativeCadParsed:false,gradingRulesParsed:false,physicalTruthVerified:false,
 cuttingAuthorized:false,factoryApproved:false,manufacturingApproved:false})

const typedArrayProto=Object.getPrototypeOf(Uint8Array.prototype)
const nativeLength=Object.getOwnPropertyDescriptor(typedArrayProto,'byteLength').get
const nativeOffset=Object.getOwnPropertyDescriptor(typedArrayProto,'byteOffset').get
const nativeBuffer=Object.getOwnPropertyDescriptor(typedArrayProto,'buffer').get
const arrayBufferLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get

function snapshot(value){
 const length=nativeLength.call(value),offset=nativeOffset.call(value)
 const backing=nativeBuffer.call(value)
 // Reject SharedArrayBuffer, including cross-realm shared backing and proxies.
 arrayBufferLength.call(backing)
 if(length<1||length>16_000_000)throw Error('Empty or oversized artifact')
 const copy=new Uint8Array(length)
 Uint8Array.prototype.set.call(copy,new Uint8Array(backing,offset,length))
 return copy
}

/** Strict byte inventory, not proof of a licensed CAD operation.
 * inventory: {native,rules,received,returned}; every file entry has
 * {filename,byteLength,sha256,bytes:Uint8Array}.
 * expectedSourceHashes: caller-provisioned {nativeSha256,rulesSha256}.
 * No trust anchor is bundled or inferred from a caller-supplied hash.
 */
export function inspectIndustrialNativeGradeReviewArtifactIntake20261031(
 evidence,inventory,expectedSourceHashes,
){
 try{
  if(!exact(inventory,['native','rules','received','returned'])||
   !exact(expectedSourceHashes,['nativeSha256','rulesSha256'])||
   !hex(expectedSourceHashes.nativeSha256)||!hex(expectedSourceHashes.rulesSha256)||
   !exact(inventory.received,SIZES)||!exact(inventory.returned,SIZES))
   return deny('REVIEW_ARTIFACT_SET_INVALID')
  const cad=evidence?.reports?.find(report=>report?.role==='receiving-cad')
  if(!cad||!Array.isArray(cad.sizeReports)||cad.sizeReports.length!==SIZES.length||
   SIZES.some((size,i)=>cad.sizeReports[i]?.size!==size))
   return deny('REVIEW_SIGNED_CAD_SIZE_SET_INVALID')
  const names=new Set()
  let total=0
  const checked=[]
  const inspect=(entry,expectedName,expectedHash,label)=>{
   if(!exact(entry,['filename','byteLength','sha256','bytes'])||
    entry.filename!==expectedName||names.has(entry.filename)||
    !Number.isSafeInteger(entry.byteLength)||entry.byteLength<1||
    entry.byteLength>16_000_000||!hex(entry.sha256)||
    (expectedHash!==null&&entry.sha256!==expectedHash))
    return deny('REVIEW_ARTIFACT_MANIFEST_INVALID',label)
   const descriptor=Object.getOwnPropertyDescriptor(entry,'bytes')
   let bytes
   try{bytes=snapshot(descriptor.value)}catch{
    return deny('REVIEW_ARTIFACT_BYTES_INVALID',label)
   }
   total+=bytes.length
   if(total>64_000_000)return deny('REVIEW_ARTIFACT_BUDGET_EXCEEDED')
   if(bytes.length!==entry.byteLength||sha256Bytes(bytes)!==entry.sha256)
    return deny('REVIEW_ARTIFACT_CONTENT_DRIFT',label)
   names.add(entry.filename)
   checked.push({filename:entry.filename,byteLength:bytes.length,sha256:entry.sha256})
   return null
  }
  const nativeName=inventory.native?.filename
  const rulesName=inventory.rules?.filename
  if(typeof nativeName!=='string'||!/^native\/[A-Za-z0-9_-]{1,72}\.(?:pds|mdl)$/i.test(nativeName)||
   typeof rulesName!=='string'||!/^rules\/[A-Za-z0-9_-]{1,72}\.rul$/i.test(rulesName))
   return deny('REVIEW_SOURCE_ARTIFACT_NAME_INVALID')
  let failure=inspect(inventory.native,nativeName,expectedSourceHashes.nativeSha256,'native')
  if(failure)return failure
  failure=inspect(inventory.rules,rulesName,expectedSourceHashes.rulesSha256,'rules')
  if(failure)return failure
  for(let i=0;i<SIZES.length;i++){
   const size=SIZES[i],signed=cad.sizeReports[i]
   if(signed.returnedFileName!==size+'.dxf'&&signed.returnedFileName!==`returned/${size}.dxf`)
    return deny('REVIEW_SIGNED_RETURNED_FILENAME_DRIFT',size)
   failure=inspect(inventory.received[size],`received/${size}.dxf`,signed.receivedFileSha256,`received ${size}`)
   if(failure)return failure
   failure=inspect(inventory.returned[size],`returned/${size}.dxf`,signed.returnedFileSha256,`returned ${size}`)
   if(failure)return failure
  }
  return {ok:true,code:'LOCAL_SIGNED_REVIEW_ARTIFACT_BYTES_CROSSCHECKED',
   artifactBytesCrosschecked:true,files:checked,verifiedSizes:[...SIZES],
   releaseReadyForIndependentAudit:false,
   nativeCadParsed:false,gradingRulesParsed:false,
   independentReceiverAuthenticated:false,physicalTruthVerified:false,
   receiverCadVerified:false,aamaCertified:false,astmCertified:false,
   cuttingAuthorized:false,factoryApproved:false,manufacturingApproved:false,
   limitations:'Actual supplied bytes match the signed CAD report digests and caller-provisioned native/rule hashes. Native CAD and .RUL semantics, independent source provenance, licensed receiving CAD operation, physical samples and cutting authorization remain unverified.'}
 }catch(error){return deny('REVIEW_ARTIFACT_INSPECTION_REFUSED',String(error?.message||error))}
}
