import {sha256Bytes} from './sha256Bytes.js'

// This is a browser-local recovery journal, NOT the Rust garment's atomic
// edit journal. Keep the current rule set in the legacy sidecar key as well
// so older EXO builds can still open a draft after an upgrade.
export const MODARIS_GRADE_DRAFT_JOURNAL_VERSION_20261029=1
const MAX_BYTES=1500000
const MAX_HISTORY=40
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null)
const exactKeys=(value,keys)=>plain(value)&&
  Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key))
const digest=text=>sha256Bytes(new TextEncoder().encode(text))
const checkEntry=(value,key,validate)=>{
  if(value===null)return
  if(!plain(value)||`exo-native-grade-sidecar:${value.templateFingerprint}`!==key||
     validate(value)!==true)throw Error('Grade history entry does not match the current native source')
}

/** Produce a single self-checking, bounded history record for localStorage. */
export function encodeModaris2DGradeDraftJournal20261029({key,current,undo,redo,validate}={}){
  if(typeof key!=='string'||!key.startsWith('exo-native-grade-sidecar:')||
     key.length>256||typeof validate!=='function'||
     !Array.isArray(undo)||!Array.isArray(redo)||
     undo.length>MAX_HISTORY||redo.length>MAX_HISTORY)
    throw Error('Invalid grade draft journal identity or history bounds')
  checkEntry(current,key,validate)
  for(const item of [...undo,...redo])checkEntry(item,key,validate)
  const payload={version:MODARIS_GRADE_DRAFT_JOURNAL_VERSION_20261029,key,current,undo,redo}
  const canonical=JSON.stringify(payload)
  if(typeof canonical!=='string'||new TextEncoder().encode(canonical).length>MAX_BYTES)
    throw Error('Grade draft journal exceeds local recovery size limit')
  return JSON.stringify({payload,sha256:digest(canonical)})
}

/**
 * Recover history only if the legacy current sidecar agrees with the journal.
 * A partial two-key write, changed source, corrupt checksum or invalid rule
 * fails closed: callers can still load the legacy current draft, but must not
 * expose stale Undo/Redo entries.
 */
export function decodeModaris2DGradeDraftJournal20261029(text,{key,current,validate}={}){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES+256)
    throw Error('Invalid grade draft journal size')
  const envelope=JSON.parse(text)
  if(!exactKeys(envelope,['payload','sha256'])||
     typeof envelope.sha256!=='string'||!/^([a-f0-9]{64})$/.test(envelope.sha256))
    throw Error('Invalid grade draft journal envelope')
  const payload=envelope.payload
  if(!exactKeys(payload,['version','key','current','undo','redo'])||
     payload.version!==MODARIS_GRADE_DRAFT_JOURNAL_VERSION_20261029||payload.key!==key||
     !Array.isArray(payload.undo)||!Array.isArray(payload.redo)||
     payload.undo.length>MAX_HISTORY||payload.redo.length>MAX_HISTORY)
    throw Error('Stale or invalid grade draft journal source')
  if(digest(JSON.stringify(payload))!==envelope.sha256)
    throw Error('Grade draft journal checksum mismatch')
  if(JSON.stringify(payload.current)!==JSON.stringify(current))
    throw Error('Grade draft journal disagrees with current saved sidecar')
  if(typeof validate!=='function')throw Error('Missing grade draft validator')
  checkEntry(payload.current,key,validate)
  for(const item of [...payload.undo,...payload.redo])checkEntry(item,key,validate)
  return {undo:structuredClone(payload.undo),redo:structuredClone(payload.redo)}
}

/**
 * Compare the whole locally observed grading state before changing storage.
 * A second EXO window can edit the same source fingerprint between this
 * window's recovery and its next edit. Comparing only the visible current
 * rule misses an external Undo/Redo branch change that returns to that rule.
 * This is a synchronous stale-write guard, not an atomic cross-window CAS:
 * localStorage offers no transaction spanning the current and journal keys.
 */
const assertExpectedStorage=(storage,{key,expected,validate})=>{
  if(!exactKeys(expected,['current','undo','redo'])||
     !Array.isArray(expected.undo)||!Array.isArray(expected.redo)||
     expected.undo.length>MAX_HISTORY||expected.redo.length>MAX_HISTORY||
     typeof validate!=='function')
    throw Error('Missing or invalid expected grading state; reload before editing')
  checkEntry(expected.current,key,validate)
  for(const item of [...expected.undo,...expected.redo])checkEntry(item,key,validate)
  const currentText=storage.getItem(key)
  let storedCurrent=null
  if(currentText!==null){
    try{storedCurrent=JSON.parse(currentText)}catch{
      throw Error('Stored grading draft is invalid; reload before editing')
    }
  }
  if(JSON.stringify(storedCurrent)!==JSON.stringify(expected.current))
    throw Error('Grading draft changed in another workspace; reload before editing')
  const journalText=storage.getItem(`${key}:history-v1`)
  if(journalText===null){
    if(expected.undo.length||expected.redo.length)
      throw Error('Grading history changed in another workspace; reload before editing')
  }else{
    let recovered
    try{recovered=decodeModaris2DGradeDraftJournal20261029(journalText,{
      key,current:storedCurrent,validate,
    })}catch{
      throw Error('Stored grading history is stale or invalid; reload before editing')
    }
    if(JSON.stringify(recovered.undo)!==JSON.stringify(expected.undo)||
       JSON.stringify(recovered.redo)!==JSON.stringify(expected.redo))
      throw Error('Grading history changed in another workspace; reload before editing')
  }
  return journalText
}

// A failed second-key operation must not blindly restore an older journal:
// another EXO workspace may have committed a newer grading history after our
// first-key stage. Only roll back the exact stage still visible in storage.
// This is a best-effort ownership check, NOT an atomic localStorage CAS.
const restoreStagedHistoryIfOwned=(storage,historyKey,staged,previous)=>{
  let observed
  try{observed=storage.getItem(historyKey)}catch{
    throw Error('Grading history rollback ownership could not be inspected; reopen to reconcile saved state')
  }
  if(observed!==staged)
    throw Error('Concurrent grading history changed during failed write; older rollback refused. Reopen to reconcile saved state')
  try{
    if(previous===null)storage.removeItem(historyKey)
    else storage.setItem(historyKey,previous)
    if(storage.getItem(historyKey)!==previous)
      throw Error('History rollback did not persist')
  }catch{
    throw Error('Grading history rollback could not be confirmed; reopen to reconcile saved state')
  }
}

/**
 * Stage the self-checking journal before the legacy current rule sidecar.
 * A crash after stage one is detected on reopen by the current mismatch.
 * A synchronous write error rolls back the staged journal best-effort, and
 * is NEVER reported as a committed grade edit to the caller.
 */
export function persistModaris2DGradeDraftJournal20261029(storage,{key,current,undo,redo,validate,expected}={}){
  const journal=encodeModaris2DGradeDraftJournal20261029({key,current,undo,redo,validate})
  const historyKey=`${key}:history-v1`
  const currentText=current===null?null:JSON.stringify(current)
  const oldJournal=assertExpectedStorage(storage,{key,expected,validate})
  storage.setItem(historyKey,journal)
  try{
    if(current===null)storage.removeItem(key)
    else storage.setItem(key,currentText)
  }catch(error){
    restoreStagedHistoryIfOwned(storage,historyKey,journal,oldJournal)
    throw Error(`Grading draft persistence failed: ${error?.message||String(error)}`)
  }
  // A second window can write between the optimistic preflight and our two
  // storage operations. Never report a successful save if either committed
  // key is already different. Do not roll back on a mismatch: that could
  // overwrite the other window's newer state. Reopen for reconciliation.
  try{
    if(storage.getItem(key)!==currentText||storage.getItem(historyKey)!==journal)
      throw Error('Concurrent grading draft change detected')
  }catch{
    throw Error('Grading draft commit could not be verified after a concurrent change or storage read failure; reopen to reconcile saved state')
  }
  return true
}

/** Remove both local keys; do not claim a clear when the current sidecar stays. */
export function clearModaris2DGradeDraftJournal20261029(storage,key,{expected,validate}={}){
  if(typeof key!=='string'||!key.startsWith('exo-native-grade-sidecar:'))
    throw Error('Invalid grading draft key')
  const historyKey=`${key}:history-v1`
  const oldJournal=assertExpectedStorage(storage,{key,expected,validate})
  storage.removeItem(historyKey)
  try{storage.removeItem(key)}catch(error){
    restoreStagedHistoryIfOwned(storage,historyKey,null,oldJournal)
    throw Error(`Grading draft clear failed: ${error?.message||String(error)}`)
  }
  // A concurrent writer may recreate either key while clear is in flight.
  // Do not claim that the local draft was cleared unless both are absent.
  try{
    if(storage.getItem(key)!==null||storage.getItem(historyKey)!==null)
      throw Error('Concurrent grading draft change detected')
  }catch{
    throw Error('Grading draft clear could not be verified after a concurrent change or storage read failure; reopen to reconcile saved state')
  }
  return true
}

/**
 * Identify ONLY the narrow interrupted-first-write case: a valid journal
 * contains the *proposed* rule, while the legacy current sidecar still equals
 * the last Undo/Redo source of that proposal. A corrupt journal, unrelated
 * mismatch or already-committed matching pair is not repairable here.
 * This is inspection, not an automatic recovery or an atomic transaction.
 */
export function inspectInterruptedModaris2DGradeDraftStage20261030(storage,{key,validate}={}){
  try{
    if(typeof key!=='string'||!key.startsWith('exo-native-grade-sidecar:')||
       key.length>256||typeof validate!=='function')throw Error('Invalid grade recovery source')
    const historyKey=`${key}:history-v1`
    const currentText=storage.getItem(key)
    const journalText=storage.getItem(historyKey)
    if(journalText===null)throw Error('No interrupted grading history stage')
    if(typeof journalText!=='string'||new TextEncoder().encode(journalText).length>MAX_BYTES+256||
       (currentText!==null&&(typeof currentText!=='string'||
         new TextEncoder().encode(currentText).length>MAX_BYTES)))
      throw Error('Oversized or invalid interrupted grading storage record')
    let current=null
    if(currentText!==null){
      current=JSON.parse(currentText)
      checkEntry(current,key,validate)
    }
    // Parse only to supply the embedded current to the strict envelope,
    // checksum, source identity and history validator above. Never trust the
    // parsed envelope by itself or use it to replace the visible current.
    const staged=JSON.parse(journalText)?.payload?.current
    const recovered=decodeModaris2DGradeDraftJournal20261029(journalText,{
      key,current:staged,validate,
    })
    if(JSON.stringify(current)===JSON.stringify(staged))
      throw Error('Grading history already matches the saved current; no recovery needed')
    const lastUndo=recovered.undo.at(-1)
    const lastRedo=recovered.redo.at(-1)
    if((!recovered.undo.length||JSON.stringify(lastUndo)!==JSON.stringify(current))&&
       (!recovered.redo.length||JSON.stringify(lastRedo)!==JSON.stringify(current)))
      throw Error('Mismatched grading history does not prove an interrupted stage; manual review required')
    return Object.freeze({ok:true,key,currentText,journalText,
      note:'Operator may abandon the incomplete local history stage, retaining the legacy current grading draft. Undo/Redo history will be discarded.'})
  }catch(error){return Object.freeze({ok:false,reason:error?.message||String(error)})}
}

/**
 * Explicitly abandon an independently inspected interrupted journal stage.
 * The caller must present the exact raw witness captured before the user
 * initiated recovery. Re-read both keys immediately before removal and after
 * removal; never modify the legacy grading sidecar or silently restore older
 * history over a newer writer. localStorage lacks atomic compare-and-remove,
 * so simultaneous other tabs must be closed and true crash safety still needs
 * a single Rust-authoritative transaction.
 */
export function recoverInterruptedModaris2DGradeDraftStage20261030(storage,{key,validate,witness}={}){
  if(!witness||witness.ok!==true||witness.key!==key||
     typeof witness.journalText!=='string')
    throw Error('Missing exact interrupted grading recovery witness; reopen before recovery')
  const observed=inspectInterruptedModaris2DGradeDraftStage20261030(storage,{key,validate})
  if(!observed.ok||observed.currentText!==witness.currentText||
     observed.journalText!==witness.journalText)
    throw Error('Grading recovery witness changed or is stale; reopen before recovery')
  const historyKey=`${key}:history-v1`
  if(storage.getItem(key)!==witness.currentText||
     storage.getItem(historyKey)!==witness.journalText)
    throw Error('Concurrent grading change detected before recovery; reopen')
  storage.removeItem(historyKey)
  try{
    if(storage.getItem(key)!==witness.currentText||storage.getItem(historyKey)!==null)
      throw Error('Concurrent grading change detected during recovery')
  }catch{
    throw Error('Grading recovery could not be verified after a concurrent change or storage failure; reopen to reconcile')
  }
  return true
}
