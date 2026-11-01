/** Bounded raw-ZIP adapter for the opt-in offline signed factory receiving gate.
 * This is local inspection only: no external CAD acceptance or CUT authorization.
 * Unlike the file-map gate, this checks ZIP entries before decompression can
 * collapse duplicate names or allocate untrusted advertised output sizes.
 * It is not a process-level CPU/RSS sandbox.
 */
import {unzipSync} from 'fflate'
import {auditFactoryZipMetadataGuard20261024_0400} from './factoryZipMetadataGuard20261024_0400.mjs'
import {verifyApprovedGradedNotchGeometry20261023} from './approvedGradedNotchGeometry20261023_1600.js'
import {
  inspectSignedFactoryNotchHandoff20261030,
  sourceInventoryBudget,
} from './industrialSignedNotchReceivingGate20261030.mjs'

const MAX_ARCHIVE_BYTES=32_000_000
const MAX_FILE_BYTES=32_000_000
const MAX_TOTAL_BYTES=100_000_000
const MAX_EXPANSION_RATIO=1000
const decoder=new TextDecoder('utf-8',{fatal:true})
const crcTable=Uint32Array.from({length:256},(_,n)=>{
  let c=n
  for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)
  return c>>>0
})
const crc32=data=>{
  let c=0xffffffff
  for(const byte of data)c=(c>>>8)^crcTable[(c^byte)&255]
  return (c^0xffffffff)>>>0
}
const blocked=(code,scope='archive')=>({
  schema:'exo-offline-signed-notch-dxf-receiving-preflight.20261030.v1',
  status:'BLOCKED',issues:[{code,scope}],blockers:1,rows:[],
  independentlyReceived:false,licensedReceiverCadAccepted:false,
  physicalNotchStationsCertified:false,physicalCuttingAuthorized:false,
  factoryCertified:false,bulkProductionAuthorized:false,
  limitation:'Raw ZIP metadata and local signed-source parity are not independent receiving-CAD, cutter, plotter, or sewn-sample acceptance.',
})

/** Only accepts raw bytes, not a caller's already-extracted ZIP map.
 * All pre-inflate budgets are finite; raw ZIP aliases and CRC inconsistencies
 * are refused before the signed file-map verifier can report a local match.
 */
export function inspectSignedFactoryZipHandoff20261030(project,archive,options={}){
  if(!(archive instanceof Uint8Array)||archive.byteLength<22||
    archive.byteLength>MAX_ARCHIVE_BYTES)
    return blocked('ZIP_COMPRESSED_ARCHIVE_BUDGET')
  try{
    // Snapshot once, so a mutable caller buffer cannot change between checks.
    const bytes=Uint8Array.from(archive)
    const metadata=auditFactoryZipMetadataGuard20261024_0400(bytes)
    if(!metadata.ok)
      return blocked('ZIP_METADATA_'+(metadata.diagnostics[0]?.code||'INVALID'))
    // Authenticate the source used to calculate the dynamic entry ceiling
    // before allocating decompressed data. The map gate rechecks it later.
    const signed=verifyApprovedGradedNotchGeometry20261023(
      project,options?.sourceRevision,options?.approval,options?.trustedKeyConfig)
    if(signed.status!=='authenticated_graded_identity_only')
      return blocked('SIGNED_BASELINE_'+(signed.issues?.[0]||'UNVERIFIED'),'approval')
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
    const u16=at=>view.getUint16(at,true)
    const u32=at=>view.getUint32(at,true)
    let eocd=-1
    for(let at=bytes.byteLength-22;at>=Math.max(0,bytes.byteLength-22-65535);at--){
      if(u32(at)===0x06054b50&&at+22+u16(at+20)===bytes.byteLength){
        eocd=at
        break
      }
    }
    if(eocd<0)return blocked('ZIP_DIRECTORY_INVALID')
    const count=u16(eocd+10)
    const budget=sourceInventoryBudget(project)
    if(!Number.isSafeInteger(budget)||count<4||count>budget)
      return blocked('ZIP_AUTHENTICATED_SOURCE_ENTRY_BUDGET')
    const entries=new Map()
    let cursor=u32(eocd+16),total=0
    for(let i=0;i<count;i++){
      // The existing envelope already validates all central/local offsets,
      // compression methods, path aliases, and duplicate entry names.
      const compressed=u32(cursor+20),expanded=u32(cursor+24)
      const nameLength=u16(cursor+28)
      const name=decoder.decode(bytes.subarray(cursor+46,cursor+46+nameLength))
      if(expanded>MAX_FILE_BYTES||(total+=expanded)>MAX_TOTAL_BYTES)
        return blocked('ZIP_DECLARED_EXPANSION_BUDGET',name)
      if(expanded>0&&(compressed===0||expanded>compressed*MAX_EXPANSION_RATIO))
        return blocked('ZIP_EXPANSION_RATIO_BUDGET',name)
      entries.set(name,{expanded,crc:u32(cursor+16)})
      cursor+=46+nameLength+u16(cursor+30)+u16(cursor+32)
    }
    let files
    try{files=unzipSync(bytes)}
    catch{return blocked('ZIP_DECOMPRESSION_FAILED')}
    if(Object.keys(files).length!==count)
      return blocked('ZIP_EXTRACTED_ENTRY_COUNT_MISMATCH')
    for(const [name,expected] of entries){
      const data=Object.prototype.hasOwnProperty.call(files,name)?files[name]:null
      if(!(data instanceof Uint8Array)||data.byteLength!==expected.expanded)
        return blocked('ZIP_EXTRACTED_SIZE_MISMATCH',name)
      if(crc32(data)!==expected.crc)
        return blocked('ZIP_EXTRACTED_CRC_MISMATCH',name)
    }
    return inspectSignedFactoryNotchHandoff20261030(project,files,options)
  }catch{
    return blocked('ZIP_RECEIVING_PREFLIGHT_EXCEPTION')
  }
}
