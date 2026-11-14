/**
 * Conservative 2D history routing until grading drafts and native geometry
 * share one durable transaction journal. A local grading edit must never
 * silently undo unrelated Rust geometry through a global shortcut.
 *
 * A mixed native/draft history cannot be ordered by the separate journals.
 * Block global history rather than guessing, while explicit grading-table
 * history remains available. This is NOT a chronological history journal.
 */
export function resolveModaris2DHistoryPriority20261029({
  direction, draftUndoCount=0, draftRedoCount=0, draftEligible=false,
  nativeUndoAvailable=false, nativeRedoAvailable=false,
}={}) {
  if(direction!=='undo'&&direction!=='redo')return Object.freeze({route:'blocked',reason:'Unknown 2D history direction'})
  if(!Number.isSafeInteger(draftUndoCount)||draftUndoCount<0||
     !Number.isSafeInteger(draftRedoCount)||draftRedoCount<0)
    return Object.freeze({route:'blocked',reason:'Invalid 2D grading draft history'})
  if(typeof nativeUndoAvailable!=='boolean'||typeof nativeRedoAvailable!=='boolean')
    return Object.freeze({route:'blocked',reason:'Invalid native history availability'})
  if((draftUndoCount>0||draftRedoCount>0)&&(nativeUndoAvailable||nativeRedoAvailable))
    return Object.freeze({route:'blocked',reason:'Native and grading draft histories have ambiguous chronology. Use explicit grading-table Undo/Redo or save and reconcile the native document; global history is blocked.'})
  const count=direction==='undo'?draftUndoCount:draftRedoCount
  if(count>0){
    if(!draftEligible)return Object.freeze({route:'blocked',reason:'Grading draft history is unavailable for the current native pattern'})
    return Object.freeze({route:'draft',reason:'Restore most recent local grading draft before native Rust history'})
  }
  return Object.freeze({route:'native',reason:'No pending local grading history in this direction'})
}
