/** Opt-in Node process boundary for untrusted signed factory ZIP inspection.
 * No result from this local preflight is cutting or receiving-CAD authorization.
 * A V8 heap cap and wall deadline are NOT an OS-level CPU/RSS sandbox.
 */
import {spawn} from 'node:child_process'
import {createPublicKey} from 'node:crypto'
import {closeSync,constants,mkdirSync,openSync,lstatSync} from 'node:fs'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

const WORKER=fileURLToPath(new URL('./industrialSignedFactoryZipIsolatedWorker20261030.mjs',import.meta.url))
const LOCK_LAUNCHER=fileURLToPath(new URL('./industrialSignedFactoryZipLockf20261031.sh',import.meta.url))
// Match the guarded factory ZIP ceiling before allocating an IPC snapshot.
const MAX_ARCHIVE=16*1024*1024
const MAX_PROJECT_JSON=6_000_000
const MAX_INPUT=52_000_000
const MAX_OUTPUT=512_000
const MAX_NODES=30000
// Use the native typed-array accessors for archive intake. A caller can add
// own byteLength/length/buffer/iterator properties to an otherwise genuine
// Uint8Array; none may control the guarded byte budget or copy operation.
const typedArrayPrototype=Object.getPrototypeOf(Uint8Array.prototype)
const intrinsicByteLength=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteLength').get
const intrinsicBuffer=Object.getOwnPropertyDescriptor(typedArrayPrototype,'buffer').get
const intrinsicByteOffset=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteOffset').get
// Bound the number of expensive verification children in this Node process.
// No queue: reject excess untrusted requests rather than retaining archives
// and source snapshots while waiting for an available child.
const MAX_ACTIVE_RECEIVERS=2
let activeReceivers=0
// On macOS, kernel-backed lockf slots enforce the same two-worker limit
// across independent Node processes. A private, fixed per-UID directory is
// necessary: per-process TMPDIR values are not necessarily identical.
function machineSlots(){
  if(process.platform!=='darwin')return null
  const directory=`/private/tmp/exo-clothcraft-v2-signed-receiver-${process.getuid()}`
  try{mkdirSync(directory,{mode:0o700})}catch(error){
    if(error.code!=='EEXIST')throw error
  }
  const stat=lstatSync(directory)
  if(!stat.isDirectory()||stat.isSymbolicLink()||stat.uid!==process.getuid()||
    (stat.mode&0o077)!==0)throw Error('unsafe machine admission directory')
  const slots=[join(directory,'slot-0.lock'),join(directory,'slot-1.lock')]
  const identities=[]
  for(const slot of slots){
    try{
      const fd=openSync(slot,constants.O_CREAT|constants.O_EXCL|
        constants.O_WRONLY|constants.O_NOFOLLOW,0o600)
      closeSync(fd)
    }catch(error){if(error.code!=='EEXIST')throw error}
    // Carry the checked inode identity into the lockf-held command. An
    // unlinked/replaced pathname between this check and lock acquisition
    // must not silently become an independent third admission slot.
    const entry=lstatSync(slot,{bigint:true})
    if(!entry.isFile()||entry.isSymbolicLink()||entry.uid!==BigInt(process.getuid())||
      entry.nlink!==1n||(entry.mode&0o077n)!==0n)
      throw Error('unsafe machine admission lockfile')
    identities.push(`${entry.dev}:${entry.ino}`)
  }
  return {paths:slots,identities}
}
const fail=(code)=>({
  schema:'exo-offline-signed-notch-dxf-receiving-preflight.20261030.v1',
  status:'BLOCKED',issues:[{code,scope:'isolated-zip'}],blockers:1,rows:[],
  independentlyReceived:false,licensedReceiverCadAccepted:false,
  physicalNotchStationsCertified:false,physicalCuttingAuthorized:false,
  factoryCertified:false,bulkProductionAuthorized:false,
  limitation:'Local isolated ZIP inspection is not independent receiving-CAD, cutter, or sewn-sample acceptance.',
})
const plain=x=>x!==null&&typeof x==='object'&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null)
const ownValue=(object,key)=>{
  if(!plain(object))throw Error('non-plain options')
  const descriptor=Object.getOwnPropertyDescriptor(object,key)
  if(!descriptor)return undefined
  if(!Object.hasOwn(descriptor,'value'))throw Error('options accessor')
  return descriptor.value
}

// Reject getters, cycles, shared references, functions and oversized structures
// before serializing source/approval. Do not execute caller-provided toJSON.
// Account for cumulative string/key bytes *within each copied root* while
// traversing: many individually legal strings must not be cloned without a
// byte limit. This is a lower bound, not an exact JSON-encoded size, so it
// cannot reject an otherwise valid JSON payload due to punctuation overhead.
function copyJson(value,seen=new WeakSet(),budget={nodes:0,bytes:0}){
  if(++budget.nodes>MAX_NODES)throw Error('node budget')
  const charge=bytes=>{
    budget.bytes+=bytes
    if(budget.bytes>MAX_PROJECT_JSON)throw Error('cumulative JSON byte budget')
  }
  if(value===null||typeof value==='boolean'){
    charge(Buffer.byteLength(JSON.stringify(value)))
    return value
  }
  // Preserve JSON.stringify's treatment of optional undefined fields while
  // rejecting functions, symbols, accessors and cyclic references.
  if(value===undefined)return undefined
  if(typeof value==='string'&&value.length<=1_000_000){
    charge(Buffer.byteLength(value,'utf8'))
    return value
  }
  if(typeof value==='number'&&Number.isFinite(value)){
    charge(Buffer.byteLength(JSON.stringify(value)))
    return value
  }
  if(typeof value!=='object'||(!Array.isArray(value)&&!plain(value))||seen.has(value))
    throw Error('non-JSON source')
  seen.add(value)
  const descriptors=Object.getOwnPropertyDescriptors(value)
  const keys=Reflect.ownKeys(descriptors)
  if(keys.length>10000||keys.some(key=>typeof key!=='string'))throw Error('invalid keys')
  if(Array.isArray(value)){
    if(value.length>20000||keys.length!==value.length+1)throw Error('sparse array')
    return Array.from({length:value.length},(_,i)=>{
      if(!Object.hasOwn(descriptors,i)||!Object.hasOwn(descriptors[i],'value'))
        throw Error('array accessor')
      return copyJson(descriptors[i].value,seen,budget)
    })
  }
  const out=Object.create(null)
  for(const key of keys){
    if(!Object.hasOwn(descriptors[key],'value'))throw Error('object accessor')
    // JSON.stringify omits object properties whose values are undefined;
    // counting their names would reject otherwise small, valid JSON projects.
    if(descriptors[key].value!==undefined)charge(Buffer.byteLength(key,'utf8'))
    out[key]=copyJson(descriptors[key].value,seen,budget)
  }
  return out
}

// Reuse the exact receiver input policy at the authenticated record boundary,
// before a backend-owned project or approval is cloned wholesale. This avoids
// invoking nested accessors through structuredClone and caps copy allocation.
// Each root is independently bounded, as in the isolated receiver itself.
export function snapshotSignedFactoryReceivingJsonBounded20261031(project,approval){
  return {project:copyJson(project),approval:copyJson(approval)}
}

/** Process-isolated signed receiving: always fail closed on timeout, crash or
 * invalid IPC. This is opt-in and does not alter existing factory release.
 */
export async function inspectSignedFactoryZipHandoffIsolated20261030(project,archive,options={}){
  let input,deadline,slots
  try{
    // Intrinsic access fails closed on proxies, detached buffers and non-views
    // without executing caller-defined byteLength/iterator/getter overrides.
    const archiveBytes=intrinsicByteLength.call(archive)
    const archivePrototype=Object.getPrototypeOf(archive)
    if(archiveBytes<22||archiveBytes>MAX_ARCHIVE||
      (archivePrototype!==Uint8Array.prototype&&archivePrototype!==Buffer.prototype))
      return fail('ZIP_ISOLATED_ARCHIVE_BUDGET')
    if(activeReceivers>=MAX_ACTIVE_RECEIVERS)return fail('ZIP_ISOLATED_CAPACITY')
    const nativeView=new Uint8Array(intrinsicBuffer.call(archive),
      intrinsicByteOffset.call(archive),archiveBytes)
    // Snapshot before reading any source/options metadata; Buffer.from on the
    // original view could consult an attacker-defined length or iterator.
    const snapshot=Buffer.from(nativeView)
    // A genuine 503-file six-size export can require >20s of deterministic
    // source regeneration on the target Mac; preserve a finite deadline.
    const configuredDeadline=ownValue(options,'timeoutMs')
    deadline=configuredDeadline===undefined?60000:configuredDeadline
    if(!Number.isInteger(deadline)||deadline<1||deadline>120000)
      return fail('ZIP_ISOLATED_OPTIONS')
    const approval=copyJson(ownValue(options,'approval'))
    const sourceRevision=copyJson(ownValue(options,'sourceRevision'))
    const trust=ownValue(options,'trustedKeyConfig')
    const suppliedKey=ownValue(trust,'publicKey')
    const key=suppliedKey?.type==='public'&&typeof suppliedKey.export==='function'
      ?suppliedKey:createPublicKey(suppliedKey)
    if(key.type!=='public'||key.asymmetricKeyType!=='ed25519')throw Error('public key')
    const trustedKeyConfig={
      publicKey:key.export({format:'pem',type:'spki'}).toString(),
      pinnedSpkiSha256:copyJson(ownValue(trust,'pinnedSpkiSha256')),
    }
    const source=JSON.stringify(copyJson(project))
    if(Buffer.byteLength(source)>MAX_PROJECT_JSON)return fail('ZIP_ISOLATED_PROJECT_BUDGET')
    input=JSON.stringify({project:JSON.parse(source),archiveBase64:snapshot.toString('base64'),
      options:{approval,sourceRevision,trustedKeyConfig}})
    if(Buffer.byteLength(input)>MAX_INPUT)return fail('ZIP_ISOLATED_IPC_BUDGET')
    slots=machineSlots()
  }catch{return fail('ZIP_ISOLATED_INPUT')}
  if(activeReceivers>=MAX_ACTIVE_RECEIVERS)return fail('ZIP_ISOLATED_CAPACITY')
  activeReceivers++
  return new Promise(resolve=>{
    let child
    try{
      child=spawn(slots?'/bin/sh':process.execPath,
        slots?[LOCK_LAUNCHER,...slots.paths,...slots.identities,
          process.execPath,'--max-old-space-size=256',WORKER]:
          ['--max-old-space-size=256',WORKER],{
        shell:false,detached:!!slots,stdio:['pipe','pipe','pipe'],windowsHide:true,
        env:{PATH:process.env.PATH||''},
      })
    }catch{
      activeReceivers--
      return resolve(fail('ZIP_ISOLATED_SPAWN'))
    }
    let settled=false,released=false,timedOut=false,overflow=false,spawnError=false,outputSize=0
    const chunks=[]
    const terminate=()=>{
      if(slots&&Number.isSafeInteger(child.pid)&&child.pid>1){
        try{process.kill(-child.pid,'SIGKILL')}catch(error){
          if(error.code!=='ESRCH')child.kill('SIGKILL')
        }
      }else child.kill('SIGKILL')
    }
    const release=()=>{
      if(released)return
      released=true
      activeReceivers--
    }
    const finish=value=>{
      if(settled)return
      settled=true
      clearTimeout(timer)
      resolve(value)
    }
    // Settle at the deadline even if stdio 'close' is delayed. Retain the
    // admission slot until the child actually exits: a failed SIGKILL must
    // not allow more than MAX_ACTIVE_RECEIVERS live children.
    const timer=setTimeout(()=>{
      timedOut=true
      terminate()
      finish(fail('ZIP_ISOLATED_TIMEOUT'))
    },deadline)
    child.on('error',()=>{
      spawnError=true
      terminate()
      finish(fail('ZIP_ISOLATED_SPAWN'))
    })
    child.on('exit',()=>release())
    child.stdout.on('data',chunk=>{
      outputSize+=chunk.length
      if(outputSize>MAX_OUTPUT){
        overflow=true
        terminate()
        finish(fail('ZIP_ISOLATED_OUTPUT_BUDGET'))
      }
      else chunks.push(chunk)
    })
    child.stderr.on('data',()=>{}) // Drain, never trust diagnostic text.
    child.stdin.on('error',()=>{}) // EPIPE when worker exits early.
    child.on('close',(code,signal)=>{
      release()
      if(timedOut)return finish(fail('ZIP_ISOLATED_TIMEOUT'))
      if(overflow)return finish(fail('ZIP_ISOLATED_OUTPUT_BUDGET'))
      if(spawnError)return finish(fail('ZIP_ISOLATED_SPAWN'))
      if(slots&&code===75)return finish(fail('ZIP_ISOLATED_CAPACITY'))
      if(code!==0||signal)return finish(fail('ZIP_ISOLATED_EXIT'))
      try{
        const result=JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if(!result||result.schema!=='exo-offline-signed-notch-dxf-receiving-preflight.20261030.v1'||
          !['BLOCKED','LOCAL_SIGNED_NOTCH_DXF_INVENTORY_MATCH'].includes(result.status)||
          !Array.isArray(result.issues)||result.issues.length>200||
          !Array.isArray(result.rows)||result.rows.length>2000||
          !Number.isInteger(result.blockers)||result.blockers!==result.issues.length||
          result.independentlyReceived!==false||result.licensedReceiverCadAccepted!==false||
          result.physicalCuttingAuthorized!==false||result.factoryCertified!==false||
          result.bulkProductionAuthorized!==false||result.physicalNotchStationsCertified!==false||
          (result.status==='BLOCKED')!==(result.issues.length>0))
          return finish(fail('ZIP_ISOLATED_PROTOCOL'))
        finish(result)
      }catch{return finish(fail('ZIP_ISOLATED_PROTOCOL'))}
    })
    try{child.stdin.end(input)}catch{
      terminate()
      finish(fail('ZIP_ISOLATED_INPUT'))
    }
  })
}
