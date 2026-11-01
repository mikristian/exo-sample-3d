// Native .native state is authoritative. The JS fitting-project.json file is
// a compatibility mirror, committed after the Rust process has saved its own
// project and linked Undo/Redo journal. A durable intent lets cold startup
// repair an interrupted mirror without silently reopening stale geometry.
import fs from 'node:fs'
import path from 'node:path'
import {createHash, randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {isDeepStrictEqual} from 'node:util'

const intentPath = mirror => `${mirror}.native-mirror-intent-v1.json`
const nativePath = mirror => `${mirror}.native`
const ownerPath = mirror => `${mirror}.native-mirror-owner-v1.json`
const recoveryOwnerPath = mirror => `${mirror}.native-mirror-recovering-v1.json`
const journalPath = mirror => `${mirror}.native.undo-v1.json`
// Distinguish this server incarnation from a different process that happened
// to reuse its PID. A live writer is never guessed stale by a second save.
const instanceId = randomUUID()
const processStart = pid => {
  try { return execFileSync('/bin/ps',['-o','lstart=','-p',String(pid)],{
    encoding:'utf8',timeout:1500,stdio:['ignore','pipe','ignore']}).trim() || null }
  catch { return null }
}
const thisProcessStart=processStart(process.pid)
const digest = file => fs.existsSync(file)
  ? createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null

function durableDirectory(file) {
  const fd = fs.openSync(path.dirname(file), 'r')
  try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
}

function durableJson(file, document) {
  fs.mkdirSync(path.dirname(file), {recursive:true})
  // A fixed .tmp name can collide with another writer or follow a preexisting
  // symlink and truncate an unrelated file. Own a fresh, exclusive staging
  // inode; never clean up a temporary file created by another process.
  const temporary = `${file}.tmp-${randomUUID()}`
  try {
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT |
      fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0)
    const fd = fs.openSync(temporary, flags, 0o600)
    try {
      fs.writeFileSync(fd, JSON.stringify(document))
      fs.fsyncSync(fd)
    } finally { fs.closeSync(fd) }
    fs.renameSync(temporary, file)
    durableDirectory(file)
  } catch (error) {
    // Preserve the intent; the next cold start can complete the mirror write.
    try { fs.unlinkSync(temporary) } catch {}
    throw error
  }
}

function exclusiveJson(file, value) {
  const flags=fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|
    (fs.constants.O_NOFOLLOW??0)
  const fd=fs.openSync(file,flags,0o600)
  try {fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd)}
  finally {fs.closeSync(fd)}
  durableDirectory(file)
}
function ownerAlive(row) {
  if(!row||!Number.isSafeInteger(row.pid)||row.pid<=0||
    typeof row.instanceId!=='string'||typeof row.transactionId!=='string')
    throw Error('NATIVE_MIRROR_INVALID_OWNER')
  try {
    process.kill(row.pid,0)
    // An unrelated process may recycle a dead writer's numeric PID. Compare
    // the OS process-birth identity when it was captured by the original
    // writer; legacy owner records remain conservatively PID-only.
    if(row.pidStart!==undefined) {
      if(typeof row.pidStart!=='string'||!row.pidStart)throw Error('NATIVE_MIRROR_INVALID_OWNER')
      const current=processStart(row.pid)
      if(current&&current!==row.pidStart)return false
    }
    return true
  }
  catch(error) {if(error.code==='ESRCH')return false;return true}
}
function readOwner(file) {
  try {return JSON.parse(fs.readFileSync(file,'utf8'))}
  catch {throw Error('NATIVE_MIRROR_INVALID_OWNER')}
}
function removeOwner(file) {
  fs.unlinkSync(file)
  durableDirectory(file)
}
function recoverOwner(mirror, recover) {
  const file=ownerPath(mirror),claim=recoveryOwnerPath(mirror)
  if(!fs.existsSync(file)) {
    // If both owner and intent were durably removed before a recovery worker
    // died, a leftover claim is harmless housekeeping. Reclaim only in this
    // provably no-transaction state. Any surviving intent must stay blocked
    // for explicit audit instead of risking an unsafe stale-claim takeover.
    const noIntent=!fs.existsSync(intentPath(mirror))
    let claimStat
    try{claimStat=fs.lstatSync(claim)}catch(error){if(error.code!=='ENOENT')throw error}
    if(claimStat) {
      if(!claimStat.isFile()||ownerAlive(readOwner(claim))||
         !noIntent)throw Error('NATIVE_MIRROR_RECOVERY_ALREADY_ACTIVE')
      try{fs.unlinkSync(claim)}catch(error){if(error.code!=='ENOENT')throw error}
      durableDirectory(claim)
    }
    if(noIntent)return {recovered:false}
    // Upgrade a legacy write-ahead intent that predates the owner file under
    // the same exclusive recovery claim as modern transactions. Two cold
    // starters must not both mirror/clear the very same interrupted save.
    if(!fs.existsSync(intentPath(mirror)))return recover()
    const claimant={pid:process.pid,pidStart:thisProcessStart??undefined,instanceId,transactionId:randomUUID()}
    try{exclusiveJson(claim,claimant)}
    catch(error){
      if(error.code==='EEXIST')throw Error('NATIVE_MIRROR_RECOVERY_ALREADY_ACTIVE')
      throw error
    }
    try{return recover()}
    finally{
      if(fs.existsSync(claim)&&isDeepStrictEqual(readOwner(claim),claimant))removeOwner(claim)
    }
  }
  const old=readOwner(file)
  if(ownerAlive(old))throw Error('NATIVE_MIRROR_TRANSACTION_BUSY')
  // Only one cold-open worker may consume a dead writer's intent. Do not
  // rename the owner file away first, which would permit a new begin to race.
  const claimant={pid:process.pid,pidStart:thisProcessStart??undefined,instanceId,transactionId:randomUUID()}
  try {exclusiveJson(claim,claimant)}
  catch(error) {
    if(error.code==='EEXIST')throw Error('NATIVE_MIRROR_RECOVERY_ALREADY_ACTIVE')
    throw error
  }
  try {
    if(!isDeepStrictEqual(readOwner(file),old) || ownerAlive(old))
      throw Error('NATIVE_MIRROR_OWNER_CHANGED')
    const result=recover()
    removeOwner(file)
    return result
  } finally {
    // A failed recovery retains the original owner and intent; only the
    // claim of this still-live process is released for future repair.
    if(fs.existsSync(claim)&&isDeepStrictEqual(readOwner(claim),claimant))removeOwner(claim)
  }
}

function clearIntent(file) {
  fs.unlinkSync(intentPath(file))
  durableDirectory(file)
}

function requireNativeProject(file) {
  let project
  try { project = JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch { throw Error('NATIVE_MIRROR_RECOVERY_INVALID_NATIVE_PROJECT') }
  if (!project || typeof project !== 'object' || Array.isArray(project) ||
      !project.template || !Array.isArray(project.template.panels)) {
    throw Error('NATIVE_MIRROR_RECOVERY_INVALID_NATIVE_PROJECT')
  }
  return project
}

// The Rust history journal may carry a UUID/generation pair from the newest
// native writer. Legacy journals have none; after adoption the identity must
// never disappear, switch source, or roll back during a JS mirror commit.
const validNativeCommit=value=>value!==null && typeof value==='object' &&
  !Array.isArray(value) &&
  isDeepStrictEqual(Object.keys(value).sort(),['generation','project_id','schema_version']) &&
  value.schema_version===1 && Number.isSafeInteger(value.generation) &&
  value.generation>=1 && typeof value.project_id==='string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.project_id)
function nativeCommitInJournal(file) {
  let journal
  try {journal=JSON.parse(fs.readFileSync(file,'utf8'))}
  catch(error) {
    if(error.code==='ENOENT')return null
    throw Error('NATIVE_MIRROR_INVALID_COMMIT_JOURNAL')
  }
  if(!Object.hasOwn(journal,'commit'))return null
  if(!validNativeCommit(journal.commit))throw Error('NATIVE_MIRROR_INVALID_NATIVE_COMMIT_IDENTITY')
  return journal.commit
}
const laterNativeCommit=(previous,next)=>!previous ||
  validNativeCommit(next) && previous.project_id===next.project_id &&
  next.generation>previous.generation

// A direct native grade/notch RPC can rename the Rust document before its
// linked Undo/Redo journal is saved. A cold reopen must not silently accept
// that newer document with an older (or absent) history sidecar. Rust may
// leave the matching save-next journal staged after a process interruption.
function hasMatchingLinkedHistory(mirror, project, pending, allowStaged=true, strictPriorHistory=true) {
  const native = nativePath(mirror)
  const canonical = {...project, mesh_signature:null, avatar_path:''}
  let previous
  try { previous = pending.previousProject ?? JSON.parse(fs.readFileSync(mirror, 'utf8')) }
  catch { if(strictPriorHistory)return false }
  const templateKeys=['fabrics','format','name','panels','seams','version']
  const isTemplate = value => value && typeof value==='object' && !Array.isArray(value) &&
    isDeepStrictEqual(Object.keys(value).sort(),templateKeys) &&
    typeof value.format==='string' && Number.isSafeInteger(value.version) &&
    typeof value.name==='string' && Array.isArray(value.fabrics) &&
    Array.isArray(value.panels) && Array.isArray(value.seams)
  const isRecord = value => value !== null && typeof value==='object' && !Array.isArray(value)
  const fields = ['bindings','grade','facing','cross','envelope','variant','hardware','graphics','hardware_steps']
  // The Rust DurableHistoryV1 decoder rejects unknown fields and malformed
  // auxiliary stacks. JS recovery runs before Rust starts, so it must not
  // promote a newer native project on evidence Rust could never deserialize.
  const journalKeys = ['schema_version','project_digest','history',
    ...fields.flatMap(name=>[`${name}_undo`,`${name}_redo`])].sort()
  const validStep = (name, value) => {
    if (name==='hardware_steps') return typeof value==='boolean'
    if (name==='hardware'||name==='graphics') return Array.isArray(value) && value.every(isRecord)
    return value===null || isRecord(value)
  }
  const auxiliary={bindings:'native_point_bindings',grade:'grade_run',facing:'native_facing_dependency',cross:'native_cross_piece_link',envelope:'fabric_grade_envelope',variant:'piece_variant',hardware:'importedHardware',graphics:'printGraphics',metadata:'propertyMetadata'}
  const priorValue=name=>{
    if(name==='hardware_steps')return false // direct grade/notch transaction, not a hardware-only step
    const field=auxiliary[name]
    const alias=name==='hardware'?'imported_hardware':name==='graphics'?'print_graphics':field
    if(Object.hasOwn(previous,field)&&Object.hasOwn(previous,alias)&&
       !isDeepStrictEqual(previous[field],previous[alias]))return Symbol('conflicting aliases')
    return previous[field]??previous[alias]??(['hardware','graphics'].includes(name)?[]:null)
  }
  const candidates=[`${native}.undo-v1.json`,...(allowStaged?[`${mirror}.save-next.tmp.undo-v1.json`]:[])]
  for (const file of candidates) {
    let journal, linked
    try {
      journal = JSON.parse(fs.readFileSync(file, 'utf8'))
      linked = JSON.parse(journal.project_digest)
    } catch { continue }
    const undo = journal.history?.undo, redo = journal.history?.redo
    // Metadata history arrays were added after the original nine-graph v1
    // journal. Accept their absence only for an older document without native
    // metadata; new Rust documents must keep full metadata history alongside
    // their geometry and grade Undo graph.
    const metadataKeys=['metadata_undo','metadata_redo']
    const keys=isRecord(journal)?Object.keys(journal)
      .filter(key=>key!=='commit'&&!metadataKeys.includes(key)).sort():[]
    const hasMetadataStacks=metadataKeys.every(key=>Array.isArray(journal?.[key]))
    if (!isRecord(journal) || !isDeepStrictEqual(keys,journalKeys) ||
        (metadataKeys.some(key=>Object.hasOwn(journal,key))&&!hasMetadataStacks) ||
        (project.propertyMetadata!==undefined&&!hasMetadataStacks) ||
        (Object.hasOwn(journal,'commit')&&!validNativeCommit(journal.commit)) ||
        !laterNativeCommit(pending.previousNativeCommit,journal.commit) ||
        (project.native_commit!==undefined &&
          (!validNativeCommit(project.native_commit) || !isDeepStrictEqual(project.native_commit,journal.commit))) ||
        journal.schema_version !== 1 || !Array.isArray(undo) || undo.length > 32 ||
        (strictPriorHistory && undo.length<1) ||
        !Array.isArray(redo) || redo.length > 32 || !isDeepStrictEqual(linked, canonical) ||
        !isDeepStrictEqual(Object.keys(journal.history).sort(),['redo','undo']) ||
        !undo.every(isTemplate) || !redo.every(isTemplate) ||
        (strictPriorHistory && (redo.length!==0 || !isTemplate(previous?.template) ||
          !isDeepStrictEqual(undo.at(-1),previous.template)))) continue
    if ((!hasMetadataStacks ||
        (journal.metadata_undo.length===undo.length &&
         journal.metadata_redo.length===redo.length &&
         journal.metadata_undo.every(value=>validStep('metadata',value)) &&
         journal.metadata_redo.every(value=>validStep('metadata',value)) &&
         (!strictPriorHistory || isDeepStrictEqual(journal.metadata_undo.at(-1),priorValue('metadata'))))) &&
      fields.every(name => Array.isArray(journal[`${name}_undo`]) &&
        journal[`${name}_undo`].length === undo.length &&
        Array.isArray(journal[`${name}_redo`]) && journal[`${name}_redo`].length === redo.length &&
        journal[`${name}_undo`].every(value=>validStep(name,value)) &&
        journal[`${name}_redo`].every(value=>validStep(name,value)) &&
        (!strictPriorHistory || isDeepStrictEqual(journal[`${name}_undo`].at(-1),priorValue(name))))) return true
  }
  return false
}

function readIntent(mirror) {
  let pending
  try {pending=JSON.parse(fs.readFileSync(intentPath(mirror),'utf8'))} catch {throw Error('NATIVE_MIRROR_RECOVERY_INVALID_INTENT')}
  const allowed=['version','previousNativeSha256','previousJournalSha256','previousNativeCommit','requireLinkedHistory','previousProject']
  if(!pending||typeof pending!=='object'||Array.isArray(pending)||
     Object.keys(pending).some(k=>!allowed.includes(k))||pending.version!==1||
     !(pending.previousNativeSha256===null||typeof pending.previousNativeSha256==='string'&&/^[a-f0-9]{64}$/.test(pending.previousNativeSha256))||
     !(pending.previousJournalSha256===undefined||pending.previousJournalSha256===null||
       typeof pending.previousJournalSha256==='string'&&/^[a-f0-9]{64}$/.test(pending.previousJournalSha256))||
     !(pending.previousNativeCommit===undefined||pending.previousNativeCommit===null||
       validNativeCommit(pending.previousNativeCommit))||
     ![undefined,true,false].includes(pending.requireLinkedHistory)||
     (Object.hasOwn(pending,'previousProject')&&(!pending.previousProject?.template||!Array.isArray(pending.previousProject.template.panels))))
    throw Error('NATIVE_MIRROR_RECOVERY_INVALID_INTENT')
  return pending
}

export function recoverNativeMirror20261030(mirror) {
  return recoverOwner(mirror,()=>recoverUnlocked(mirror))
}

function recoverUnlocked(mirror) {
  const intent = intentPath(mirror)
  if (!fs.existsSync(intent)) return {recovered:false}
  const pending = readIntent(mirror)
  const native = nativePath(mirror)
  const currentHash = digest(native)
  if (currentHash === pending.previousNativeSha256) {
    if (pending.previousJournalSha256!==undefined &&
        pending.previousJournalSha256!==digest(journalPath(mirror)))
      throw Error('NATIVE_MIRROR_RECOVERY_JOURNAL_CHANGED_WITHOUT_PROJECT')
    // Rust never committed a new native project; the earlier JS mirror wins.
    clearIntent(mirror)
    return {recovered:false, nativeUnchanged:true}
  }
  if (currentHash === null) throw Error('NATIVE_MIRROR_RECOVERY_MISSING_NATIVE_PROJECT')
  // A v1 intent from before the explicit linked-history flag cannot prove
  // whether the interrupted native operation was geometry or an atomic
  // grade/notch edit. Preserve it for a controlled migration rather than
  // automatically promoting a project with possibly lost Undo/Redo history.
  if(pending.requireLinkedHistory===undefined)
    throw Error('NATIVE_MIRROR_RECOVERY_LEGACY_INTENT_REQUIRES_REVIEW')
  const project = requireNativeProject(native)
  if ((pending.requireLinkedHistory || project.native_commit!==undefined) &&
      !hasMatchingLinkedHistory(mirror, project, pending, true, pending.requireLinkedHistory)) {
    // Preserve the native project, older mirror, and recovery intent for
    // explicit repair. Never conceal lost Undo/Redo by clearing the intent.
    throw Error('NATIVE_MIRROR_RECOVERY_UNCOMMITTED_LINKED_HISTORY')
  }
  // The Rust project can be committed while only its matching save-next
  // journal exists. A Boolean "history found" is not enough: promoting the
  // mirror and clearing the intent while leaving the older committed journal
  // would make the very next Rust cold-open read two different generations.
  // Promote the EXACT verified staged journal under the recovery owner before
  // allowing this interrupted transaction to leave recovery state.
  if ((pending.requireLinkedHistory || project.native_commit!==undefined) &&
      !hasMatchingLinkedHistory(mirror,project,pending,false,pending.requireLinkedHistory)) {
    const staged=`${mirror}.save-next.tmp.undo-v1.json`
    const committed=journalPath(mirror)
    const file=fs.lstatSync(staged)
    if(!file.isFile()||file.isSymbolicLink())
      throw Error('NATIVE_MIRROR_RECOVERY_UNTRUSTED_STAGED_JOURNAL')
    if(fs.existsSync(committed)) {
      const previous=fs.lstatSync(committed)
      if(!previous.isFile()||previous.isSymbolicLink())
        throw Error('NATIVE_MIRROR_RECOVERY_UNTRUSTED_COMMITTED_JOURNAL')
      const backup=`${committed}.before-staged-history-recovery-${Date.now()}-${randomUUID()}.bak`
      fs.copyFileSync(committed,backup,fs.constants.COPYFILE_EXCL)
      durableDirectory(backup)
    }
    fs.renameSync(staged,committed)
    durableDirectory(committed)
    if(!hasMatchingLinkedHistory(mirror,project,pending,false,pending.requireLinkedHistory))
      throw Error('NATIVE_MIRROR_RECOVERY_STAGED_JOURNAL_PROMOTION_MISMATCH')
  }
  let oldMirror
  try { oldMirror = JSON.parse(fs.readFileSync(mirror, 'utf8')) } catch {}
  if (!isDeepStrictEqual(oldMirror, project)) {
    if (fs.existsSync(mirror)) {
      // Never discard the previous JS document on a recovery path.
      const backup = `${mirror}.before-native-mirror-recovery-${Date.now()}.bak`
      fs.copyFileSync(mirror, backup, fs.constants.COPYFILE_EXCL)
      durableDirectory(backup)
    }
    durableJson(mirror, project)
  }
  clearIntent(mirror)
  return {recovered:true, nativeSha256:currentHash}
}

export function beginNativeMirrorSave20261030(mirror, {requireLinkedHistory=false}={}) {
  // A prior unresolved transaction must be recovered before another native
  // commit is permitted to advance the document and invalidate its baseline.
  recoverNativeMirror20261030(mirror)
  if(typeof requireLinkedHistory!=='boolean')throw Error('NATIVE_MIRROR_RECOVERY_INVALID_INTENT')
  // A fresh garment starts without any metadata sidecar. Previously that
  // auxiliary write happened to create the workspace folder before this
  // owner lock. Native-owned metadata must not depend on the obsolete write
  // for its first successful project transaction.
  fs.mkdirSync(path.dirname(mirror),{recursive:true})
  const transactionId=randomUUID(),owner={
    pid:process.pid,pidStart:thisProcessStart??undefined,instanceId,transactionId}
  try {exclusiveJson(ownerPath(mirror),owner)}
  catch(error) {
    if(error.code==='EEXIST')throw Error('NATIVE_MIRROR_TRANSACTION_BUSY')
    throw error
  }
  // Preserve the old graph even if a crash happens after mirror rename.
  try {
    const previousProject=requireLinkedHistory?requireNativeProject(mirror):undefined
    const previousNativeProject=fs.existsSync(nativePath(mirror))
      ?requireNativeProject(nativePath(mirror)):null
    const previousNativeCommit=nativeCommitInJournal(journalPath(mirror))
    if(previousNativeProject &&
       !isDeepStrictEqual(previousNativeProject.native_commit??null,previousNativeCommit))
      throw Error('NATIVE_MIRROR_PREVIOUS_NATIVE_COMMIT_IDENTITY_MISMATCH')
    durableJson(intentPath(mirror), {
      version:1, previousNativeSha256:digest(nativePath(mirror)), requireLinkedHistory,
      previousJournalSha256:digest(journalPath(mirror)),
      previousNativeCommit,
      ...(previousProject?{previousProject}:{}),
    })
  } catch(error) {
    // No native mutation is started until begin returns successfully.
    if(!fs.existsSync(intentPath(mirror)))removeOwner(ownerPath(mirror))
    throw error
  }
  return transactionId
}

// A rejected native RPC must not strand a live in-process owner forever if
// neither the Rust document nor linked history changed. If either may have
// advanced, preserve the evidence and force explicit cold recovery instead.
export function abortUnchangedNativeMirrorSave20261030(mirror) {
  if(!fs.existsSync(ownerPath(mirror))||!fs.existsSync(intentPath(mirror)))
    return {aborted:false,noIntent:true}
  const owner=readOwner(ownerPath(mirror))
  if(owner.pid!==process.pid||owner.instanceId!==instanceId)
    return {aborted:false,foreignOwner:true}
  const pending=readIntent(mirror)
  if(digest(nativePath(mirror))!==pending.previousNativeSha256||
     pending.previousJournalSha256===undefined||
     digest(journalPath(mirror))!==pending.previousJournalSha256)
    return {aborted:false,nativeOrJournalChanged:true}
  clearIntent(mirror)
  removeOwner(ownerPath(mirror))
  return {aborted:true}
}

export function commitNativeMirrorSave20261030(mirror, project) {
  if (!fs.existsSync(intentPath(mirror))) throw Error('NATIVE_MIRROR_SAVE_INTENT_MISSING')
  const owner=readOwner(ownerPath(mirror))
  if(owner.pid!==process.pid||owner.instanceId!==instanceId||!owner.transactionId)
    throw Error('NATIVE_MIRROR_SAVE_OWNER_MISMATCH')
  const pending=readIntent(mirror)
  if (!isDeepStrictEqual(requireNativeProject(nativePath(mirror)), project)) {
    throw Error('NATIVE_MIRROR_SAVE_NATIVE_RESPONSE_MISMATCH')
  }
  if(pending.requireLinkedHistory&&!hasMatchingLinkedHistory(mirror,project,pending,false))
    throw Error('NATIVE_MIRROR_SAVE_UNCOMMITTED_LINKED_HISTORY')
  if(project.native_commit!==undefined &&
     !hasMatchingLinkedHistory(mirror,project,pending,false,pending.requireLinkedHistory))
    throw Error('NATIVE_MIRROR_SAVE_UNCOMMITTED_NATIVE_DOCUMENT')
  if(pending.previousNativeCommit &&
     !laterNativeCommit(pending.previousNativeCommit,nativeCommitInJournal(journalPath(mirror))))
    throw Error('NATIVE_MIRROR_SAVE_NATIVE_COMMIT_GENERATION_MISMATCH')
  durableJson(mirror, project)
  clearIntent(mirror)
  removeOwner(ownerPath(mirror))
}
