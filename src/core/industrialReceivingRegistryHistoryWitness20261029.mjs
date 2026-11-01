// Local, append-only history witness for authenticated issuer-status observations.
// Detects loss/substitution of earlier versions after a witness has been
// established. This is not a signature, remote transparency log, or defense
// against an attacker able to erase ALL local history under the service UID.
import {open,readdir,lstat} from 'node:fs/promises'
import {constants} from 'node:fs'
import {join} from 'node:path'
import {sha256Bytes} from './sha256Bytes.js'
import {verifyTrustedReceivingLedger20261029} from './industrialReceivingLedgerPathGuard20261029.mjs'

const encoder=new TextEncoder()
const uid=typeof process.getuid==='function'?process.getuid():null
const hash=value=>sha256Bytes(encoder.encode(value))
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 [Object.prototype,null].includes(Object.getPrototypeOf(value))
const exact=(value,keys)=>plain(value)&&
 Object.keys(value).sort().join('|')===keys.slice().sort().join('|')
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino
const privateFile=s=>s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&
 (uid===null||s.uid===uid)&&(s.mode&0o077)===0
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)
const keys=['format','issuerAudience','ledgerNamespace','registryRootSha256',
 'registryVersion','observations','previousWitnessVersion','previousWitnessSha256']
const pairKeys=['registryVersion','issuerStatusSnapshotSha256']
const witnessPrefix=prefix=>prefix.replace(/\.issuer-registry-v$/u,'.issuer-registry-history-v')
const version=x=>Number.isSafeInteger(x)&&x>0

async function readWitness(path,expected){
 let handle
 try{
  const before=await lstat(path)
  if(!privateFile(before)||before.size<2||before.size>1024*1024)return null
  handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW)
  const opened=await handle.stat()
  if(!privateFile(opened)||!same(before,opened))return null
  const raw=await handle.readFile('utf8')
  const row=JSON.parse(raw)
  if(!exact(row,keys)||row.format!=='exo.receiving-issuer-registry-history.v1'||
   row.issuerAudience!==expected.issuerAudience||
   row.ledgerNamespace!==expected.ledgerNamespace||
   row.registryRootSha256!==expected.registryRootSha256||
   !version(row.registryVersion)||
   !Array.isArray(row.observations)||row.observations.length<1||
   row.observations.length>4096||
   !(row.previousWitnessVersion===0||version(row.previousWitnessVersion))||
   !(row.previousWitnessSha256===null||hex(row.previousWitnessSha256)))return null
  for(const entry of row.observations){
   if(!exact(entry,pairKeys)||!version(entry.registryVersion)||
    !hex(entry.issuerStatusSnapshotSha256))return null
  }
  return {row,digest:hash(raw)}
 }catch{return null}finally{if(handle)await handle.close().catch(()=>{})}
}

function pairs(observations){
 return observations.slice().sort((a,b)=>a.registryVersion-b.registryVersion)
  .map(({registryVersion,issuerStatusSnapshotSha256})=>
   ({registryVersion,issuerStatusSnapshotSha256}))
}

/** Verify all recorded witnesses and every observation each one attests.
 * No requirement for numerically contiguous issuer registry versions.
 * An existing witness must cover the current highest observation.
 */
export async function inspectRegistryHistoryWitness20261029(
 ledger,prefix,expected,observations,
){
 if(!await verifyTrustedReceivingLedger20261029(ledger))
  return {ok:false}
 const historyPrefix=witnessPrefix(prefix)
 const names=await readdir(ledger.canonical)
 const versions=[]
 for(const name of names){
  if(!name.startsWith(historyPrefix))continue
  const match=/^([1-9][0-9]*)\.json$/.exec(name.slice(historyPrefix.length))
  if(!match||!version(Number(match[1]))||String(Number(match[1]))!==match[1])
   return {ok:false}
  versions.push(Number(match[1]))
 }
 versions.sort((a,b)=>a-b)
 const sorted=pairs(observations)
 if(sorted.length>4096)return {ok:false}
 for(let i=1;i<sorted.length;i++){
  if(sorted[i-1].registryVersion>=sorted[i].registryVersion)return {ok:false}
 }
 // Newly written v2 observations explicitly require a witness. A missing
 // entire witness set must not be mistaken for a legacy v1 bootstrap.
 if(versions.length===0)return {
  ok:!observations.some(row=>row.historyWitnessRequired===true),latest:null}
 if(sorted.length===0||
  versions[versions.length-1]!==sorted[sorted.length-1].registryVersion)
  return {ok:false}
 let previous=null
 for(const v of versions){
  const found=await readWitness(join(ledger.canonical,historyPrefix+v+'.json'),expected)
  if(!found||found.row.registryVersion!==v)return {ok:false}
  const expectedPreviousVersion=previous?.row.registryVersion??0
  const expectedPreviousDigest=previous?.digest??null
  if(found.row.previousWitnessVersion!==expectedPreviousVersion||
   found.row.previousWitnessSha256!==expectedPreviousDigest)return {ok:false}
  const subset=sorted.filter(entry=>entry.registryVersion<=v)
  if(subset.length!==found.row.observations.length||
   subset.length===0||subset[subset.length-1].registryVersion!==v||
   JSON.stringify(subset)!==JSON.stringify(found.row.observations))
   return {ok:false}
  previous=found
 }
 return {ok:await verifyTrustedReceivingLedger20261029(ledger),latest:previous}
}

/** Append a new witness only under the caller's exclusive registry lock.
 * Failed or partial writes are NEVER removed or rewritten automatically.
 */
export async function appendRegistryHistoryWitness20261029(
 ledger,prefix,expected,observations,previous,
){
 const sorted=pairs(observations)
 if(sorted.length<1||sorted.length>4096||
  !await verifyTrustedReceivingLedger20261029(ledger))return false
 const highest=sorted[sorted.length-1].registryVersion
 const row={format:'exo.receiving-issuer-registry-history.v1',
  issuerAudience:expected.issuerAudience,
  ledgerNamespace:expected.ledgerNamespace,
  registryRootSha256:expected.registryRootSha256,
  registryVersion:highest,observations:sorted,
  previousWitnessVersion:previous?.row.registryVersion??0,
  previousWitnessSha256:previous?.digest??null}
 const path=join(ledger.canonical,witnessPrefix(prefix)+highest+'.json')
 let file
 try{
  file=await open(path,constants.O_CREAT|constants.O_EXCL|
   constants.O_WRONLY|constants.O_NOFOLLOW,0o600)
  await file.writeFile(JSON.stringify(row)+'\n')
  await file.sync()
  await file.close()
  file=null
  await ledger.handle.sync()
  const checked=await inspectRegistryHistoryWitness20261029(
   ledger,prefix,expected,observations)
  return checked.ok&&checked.latest?.row.registryVersion===highest
 }catch{return false}finally{if(file)await file.close().catch(()=>{})}
}
