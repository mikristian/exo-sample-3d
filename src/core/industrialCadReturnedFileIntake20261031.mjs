// Strict local file-byte intake for claimed receiver DXF re-exports.
// No filename, digest, or local geometry parity authenticates licensed CAD.
import {sha256Bytes} from './sha256Bytes.js'
import {inspectIndustrialCadReceivingReexport20261028} from './industrialCadReceivingReexport20261028.mjs'

const encoder=new TextEncoder()
const decoder=new TextDecoder('utf-8',{fatal:true})
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 [Object.prototype,null].includes(Object.getPrototypeOf(value))
const deny=(code,detail=code)=>({ok:false,status:'BLOCKED',issues:[{code,detail}],
 returnedDxfFileBytesVerified:false,independentReceiverAuthenticated:false,
 receiverCadVerified:false,aamaCertified:false,astmCertified:false,
 cuttingAuthorized:false,factoryApproved:false,manufacturingApproved:false})
const sizeToken=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,32}$/.test(s)
const hex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)
const typedArrayPrototype=Object.getPrototypeOf(Uint8Array.prototype)
const nativeLength=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteLength').get
const nativeOffset=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteOffset').get
const nativeBuffer=Object.getOwnPropertyDescriptor(typedArrayPrototype,'buffer').get
const arrayBufferLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get

function snapshot(value){
 // Native accessors reject forged typed-array properties, subclasses with
 // overridden length, and Proxy impostors before any file bytes are copied.
 const length=nativeLength.call(value),offset=nativeOffset.call(value)
 const backing=nativeBuffer.call(value)
 // ArrayBuffer's native getter accepts cross-realm ordinary ArrayBuffers but
 // rejects cross-realm SharedArrayBuffers; instanceof is not sufficient here.
 try{arrayBufferLength.call(backing)}catch{throw Error('Shared returned file backing is not accepted')}
 if(length===0||length>16_000_000)throw Error('Empty or oversized returned DXF file')
 const copy=new Uint8Array(length)
 Uint8Array.prototype.set.call(copy,new Uint8Array(backing,offset,length))
 return copy
}

/** File-byte proof is additional LOCAL inspection, not receiving CAD approval.
 * packet: {records:[{size,filename,bytes,sha256}],files:{filename:Uint8Array}}
 * Exact canonical paths: received/<size>.dxf. No filesystem access or writes.
 */
export function inspectIndustrialCadReturnedFileIntake20261031(
 project,explorer,plansByFabric,handoffPacket,outboundWires,evidence,packet,
){
 try{
  const sizes=project?.grading?.sizes
  if(!Array.isArray(sizes)||sizes.length<2||sizes.length>24||
   new Set(sizes).size!==sizes.length||sizes.some(s=>!sizeToken(s))||
   !plain(packet)||!plain(packet.files)||!Array.isArray(packet.records)||
   packet.records.length!==sizes.length||Reflect.ownKeys(packet.files).length!==sizes.length)
   return deny('RETURNED_DXF_FILE_SET_INVALID')
  const records=new Map()
  for(const row of packet.records){
   if(!plain(row)||Object.keys(row).sort().join(',')!=='bytes,filename,sha256,size'||
    !sizes.includes(row.size)||records.has(row.size)||
    row.filename!==`received/${row.size}.dxf`||
    !Number.isSafeInteger(row.bytes)||row.bytes<1||row.bytes>16_000_000||
    !hex(row.sha256))return deny('RETURNED_DXF_FILE_MANIFEST_INVALID')
   records.set(row.size,row)
  }
  let total=0
  const hashes=[]
  for(const size of sizes){
   const row=records.get(size)
   if(!row||!Object.hasOwn(packet.files,row.filename))
    return deny('RETURNED_DXF_FILE_MISSING',size)
   const descriptor=Object.getOwnPropertyDescriptor(packet.files,row.filename)
   if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)
    return deny('RETURNED_DXF_FILE_INVALID',size)
   let bytes
   try{bytes=snapshot(descriptor.value)}catch{return deny('RETURNED_DXF_FILE_INVALID',size)}
   total+=bytes.length
   if(total>64_000_000)return deny('RETURNED_DXF_FILE_BUDGET_EXCEEDED')
   const hash=sha256Bytes(bytes)
   let decoded
   try{decoded=decoder.decode(bytes)}catch{return deny('RETURNED_DXF_FILE_CONTENT_DRIFT',size)}
   if(bytes.length!==row.bytes||hash!==row.sha256||
    typeof evidence?.reexportWiresBySize?.[size]!=='string'||
    decoded!==evidence.reexportWiresBySize[size]||
    hash!==sha256Bytes(encoder.encode(evidence.reexportWiresBySize[size])))
    return deny('RETURNED_DXF_FILE_CONTENT_DRIFT',size)
   hashes.push({size,filename:row.filename,bytes:bytes.length,sha256:hash})
  }
  const local=inspectIndustrialCadReceivingReexport20261028(
   project,explorer,plansByFabric,handoffPacket,outboundWires,evidence)
  if(!local.ok)return {...local,returnedDxfFileBytesVerified:false}
  return {...local,status:'LOCAL_RETURNED_DXF_FILE_BYTES_CROSSCHECKED',
   returnedDxfFileBytesVerified:true,returnedDxfFiles:hashes,
   independentReceiverAuthenticated:false,receiverCadVerified:false,
   cuttingAuthorized:false,factoryApproved:false,manufacturingApproved:false,
   limitations:'Caller-supplied actual DXF file bytes crosschecked with all-size local geometry. '
    +'No authenticated licensed receiving CAD import, native project or RUL interpretation, '
    +'physical cutting authorization or factory release.'}
 }catch(error){return deny('RETURNED_DXF_FILE_INSPECTION_REFUSED',String(error?.message||error))}
}
