/** Node-only, opt-in adapter for a trusted factory receiving service.
 *
 * The caller supplies only an archive and an opaque source ID. The project,
 * source revision, approval and pinned signer MUST come from separately
 * controlled backend records, not from ZIP metadata or a browser request.
 * This local inspection never authorizes CUT, manufacturing or factory release.
 */
import {createHash,createPublicKey,KeyObject} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import {inspectSignedFactoryZipHandoffIsolated20261030} from './industrialSignedFactoryZipIsolated20261030.mjs'

const schema='exo-offline-signed-notch-dxf-receiving-preflight.20261030.v1'
// Intrinsic typed-array accessors ignore own byteLength/buffer/byteOffset
// getters on an otherwise ordinary Uint8Array or Buffer instance.
const typedArrayPrototype=Object.getPrototypeOf(Uint8Array.prototype)
const intrinsicBytes=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteLength').get
const intrinsicBuffer=Object.getOwnPropertyDescriptor(typedArrayPrototype,'buffer').get
const intrinsicOffset=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteOffset').get
const intrinsicArrayBufferBytes=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get
// Bound retained raw ZIP snapshots while backend authorization is pending.
// Worker admission happens later, after async record lookup, and cannot
// protect this earlier memory allocation. This is per Node process, not an
// operating-system or cross-process quota.
const maxPendingTrustedIntakes=2
const backendResolutionDeadlineMs=15000
let pendingTrustedIntakes=0
async function resolveBackendRecordsBounded(resolveSource,resolveApproval,sourceId,onLookupSettled){
  // A backend promise may never settle. Race only the record lookup, not the
  // verifier: late completion cannot launch inspection after the deadline.
  // Cooperating backend resolvers receive a signal to cancel pending I/O;
  // resolvers that ignore it still fail closed at the deadline.
  let timer,expired=false
  const controller=new AbortController()
  const context=Object.freeze({signal:controller.signal})
  const started=performance.now()
  const expire=()=>{
    expired=true
    if(!controller.signal.aborted)
      controller.abort(Error('trusted backend record lookup deadline'))
  }
  const assertBeforeDeadline=()=>{
    // A synchronous resolver can block the event loop so that setTimeout
    // cannot run on time. Check elapsed monotonic time after every await.
    if(expired||performance.now()-started>=backendResolutionDeadlineMs){
      expire()
      throw Error('trusted backend record lookup expired')
    }
  }
  // Arm the deadline BEFORE invoking a resolver: an async function begins
  // executing synchronously until its first await.
  const deadline=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      expire()
      reject(Error('trusted backend record lookup deadline'))
    },backendResolutionDeadlineMs)
  })
  const lookup=(async()=>{
    assertBeforeDeadline()
    const source=await resolveSource(sourceId,context)
    assertBeforeDeadline()
    const approval=await resolveApproval(sourceId,context)
    assertBeforeDeadline()
    return {source,approval}
  })()
  // A deadline rejects the request but cannot terminate an uncooperative
  // backend promise. Keep its intake reservation until that work actually
  // settles, otherwise repeated timeouts could create unbounded concurrent
  // backend reads despite the two-slot admission limit.
  void lookup.then(onLookupSettled,onLookupSettled)
  try{
    return await Promise.race([lookup,deadline])
  }finally{clearTimeout(timer)}
}
const blocked=code=>({schema,status:'BLOCKED',issues:[{code,scope:'trusted-boundary'}],
  blockers:1,rows:[],independentlyReceived:false,licensedReceiverCadAccepted:false,
  physicalNotchStationsCertified:false,physicalCuttingAuthorized:false,
  factoryCertified:false,bulkProductionAuthorized:false,
  limitation:'Local authenticated ZIP inspection is not independent receiving CAD or cutting authorization.'})
const ownData=(object,key)=>{
  if(object===null||typeof object!=='object'||Array.isArray(object))throw Error('object required')
  const descriptor=Object.getOwnPropertyDescriptor(object,key)
  if(!descriptor||!Object.hasOwn(descriptor,'value'))throw Error('missing data property')
  return descriptor.value
}

/** Configure once with backend-owned resolvers and an independently pinned key.
 * A self-pinned key supplied by a requester must NEVER be used to configure
 * this boundary. Neither resolver may load authority from the inspected ZIP.
 */
export function createTrustedFactoryZipReceivingBoundary20261031(configuration){
  const resolveSource=ownData(configuration,'resolveSource')
  const resolveApproval=ownData(configuration,'resolveApproval')
  const trustedKeyConfig=ownData(configuration,'trustedKeyConfig')
  if(typeof resolveSource!=='function'||typeof resolveApproval!=='function')
    throw Error('trusted source and approval resolvers required')
  const supplied=ownData(trustedKeyConfig,'publicKey')
  const pinned=ownData(trustedKeyConfig,'pinnedSpkiSha256')
  // Do not trust a duck-typed object with forged .type/.export methods or
  // attacker-controlled getters to impersonate a genuine Node KeyObject.
  if(!(supplied instanceof KeyObject)&&typeof supplied!=='string'&&
    !Buffer.isBuffer(supplied))throw Error('trusted public key format required')
  const key=supplied instanceof KeyObject?supplied:createPublicKey(supplied)
  if(key.type!=='public'||key.asymmetricKeyType!=='ed25519'||
    typeof pinned!=='string'||!/^[a-f0-9]{64}$/.test(pinned))
    throw Error('trusted Ed25519 pin required')
  const der=key.export({format:'der',type:'spki'})
  if(createHash('sha256').update(der).digest('hex')!==pinned)
    throw Error('trusted Ed25519 key/pin mismatch')
  // Capture a stable independent trust root before any request is received.
  const trust=Object.freeze({publicKey:key.export({format:'pem',type:'spki'}).toString(),
    pinnedSpkiSha256:pinned})

  return async function inspectTrustedFactoryZip(request){
    let intakeReserved=false
    let backendLookupSettled=true
    let requestFinished=false
    const releaseIfSafe=()=>{
      if(intakeReserved&&backendLookupSettled&&requestFinished){
        intakeReserved=false
        pendingTrustedIntakes--
      }
    }
    try{
      // Exact request schema: no browser-provided source, signer, revision,
      // approval, factory release or CAD acceptance may cross this boundary.
      if(request===null||typeof request!=='object'||Array.isArray(request)||
        Reflect.ownKeys(request).length!==2||
        !Object.hasOwn(request,'archive')||!Object.hasOwn(request,'sourceId'))
        return blocked('ZIP_TRUSTED_REQUEST_SCHEMA')
      const archive=ownData(request,'archive')
      const sourceId=ownData(request,'sourceId')
      if(typeof sourceId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(sourceId))
        return blocked('ZIP_TRUSTED_SOURCE_ID')
      // Exclude subclasses overriding byteLength/iteration during snapshot.
      // Standard Buffer and Uint8Array are the only admitted byte containers.
      if(!(archive instanceof Uint8Array)||
        (Object.getPrototypeOf(archive)!==Uint8Array.prototype&&
          Object.getPrototypeOf(archive)!==Buffer.prototype))
        return blocked('ZIP_TRUSTED_ARCHIVE_BUDGET')
      const byteLength=intrinsicBytes.call(archive)
      if(byteLength<22||byteLength>16*1024*1024)
        return blocked('ZIP_TRUSTED_ARCHIVE_BUDGET')
      // A SharedArrayBuffer-backed ZIP can be changed by another worker while
      // Buffer.from copies it, producing a torn snapshot. A signed receiving
      // intake must start from an exclusively owned, non-shared byte source.
      // Check the intrinsic backing store rather than caller-owned properties.
      const backing=intrinsicBuffer.call(archive)
      try{
        // The intrinsic ArrayBuffer getter rejects SharedArrayBuffer even when
        // it originated in another JS realm; instanceof does not.
        intrinsicArrayBufferBytes.call(backing)
      }catch{return blocked('ZIP_TRUSTED_SHARED_ARCHIVE')}
      if(pendingTrustedIntakes>=maxPendingTrustedIntakes)
        return blocked('ZIP_TRUSTED_INTAKE_CAPACITY')
      pendingTrustedIntakes++
      intakeReserved=true
      // A backend lookup can await disk/network I/O. Snapshot caller-owned
      // bytes before that first await. Create a fresh native view rather than
      // invoking caller-owned length, buffer, offset or iterator overrides.
      const view=new Uint8Array(backing,
        intrinsicOffset.call(archive),byteLength)
      const archiveSnapshot=Buffer.from(view)
      backendLookupSettled=false
      const {source,approval}=await resolveBackendRecordsBounded(resolveSource,resolveApproval,sourceId,()=>{
        backendLookupSettled=true
        releaseIfSafe()
      })
      const project=ownData(source,'project')
      const sourceRevision=ownData(source,'sourceRevision')
      if(typeof sourceRevision!=='string'||!sourceRevision||sourceRevision.length>256)
        return blocked('ZIP_TRUSTED_SOURCE_REVISION')
      return await inspectSignedFactoryZipHandoffIsolated20261030(project,archiveSnapshot,
        {sourceRevision,approval,trustedKeyConfig:trust})
    }catch{return blocked('ZIP_TRUSTED_RESOLUTION_FAILED')}
    finally{
      requestFinished=true
      releaseIfSafe()
    }
  }
}
