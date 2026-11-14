/**
 * Explicit, narrow Rust catalog history ownership. Global Undo must remain
 * fail-closed when local grading drafts and Rust history both exist. A native
 * catalog commit can be undone independently only when its exact revision and
 * source template are still current. Redo requires a recorded matching Undo.
 * This is NOT a merger or a chronological ordering of separate journals.
 */
const blocked=reason=>Object.freeze({ok:false,reason})
// Existing native grading verification canonicalizes every Rust object key.
// Compare the same canonical content, not incidental JSON property order.
const canonical=value=>Array.isArray(value)?value.map(canonical):
  value&&typeof value==='object'?
    Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value
const signature=value=>JSON.stringify(canonical(value))
const same=(a,b)=>signature(a)===signature(b)

export function inspectScopedNativeGradeHistory20261112({
  direction,snapshot,catalogStatus,redoWitness=null,busy=false,playing=false,
  nativeBusy=false,draftRuleSet=null,
}={}){
  if(direction!=='undo'&&direction!=='redo')return blocked('Unknown native grade history action')
  if(busy||playing||nativeBusy)return blocked('Pause native editing and simulation first')
  if(!snapshot?.template||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<0)
    return blocked('An authoritative native project revision is required')
  if(snapshot.activeGradedSize)return blocked('Restore the original garment before changing catalog history')
  if(draftRuleSet?.templateFingerprint&&catalogStatus?.templateFingerprint&&
    draftRuleSet.templateFingerprint!==catalogStatus.templateFingerprint)
    return blocked('The local grading rules do not match the native source pattern')
  if(direction==='undo'){
    if(snapshot.canUndo!==true)return blocked('The native Rust session has no Undo operation')
    if(catalogStatus?.ok!==true||catalogStatus.persisted!==true||
      catalogStatus.sourceRevision!==snapshot.revision||
      !same(catalogStatus.sourceTemplate,snapshot.template)||
      snapshot.gradeRunPersisted!==true)
      return blocked('The latest native grade commit is not verified at this exact document revision')
    return Object.freeze({ok:true,op:'undo',revision:snapshot.revision,
      templateKey:signature(snapshot.template),
      projectId:snapshot.projectId??null,documentId:snapshot.documentId??null})
  }
  if(snapshot.canRedo!==true)return blocked('The native Rust session has no Redo operation')
  if(!redoWitness||redoWitness.revision!==snapshot.revision||
    redoWitness.templateKey!==signature(snapshot.template)||
    redoWitness.projectId!==(snapshot.projectId??null)||
    redoWitness.documentId!==(snapshot.documentId??null)||
    snapshot.gradeRunPersisted!==false)
    return blocked('No source-matched native grading Undo has been witnessed for this Redo')
  return Object.freeze({ok:true,op:'redo',revision:snapshot.revision,
    templateKey:redoWitness.templateKey,
    projectId:redoWitness.projectId,documentId:redoWitness.documentId})
}

export function verifyScopedNativeGradeResult20261112({decision,response,direction}={}){
  if(decision?.ok!==true||response?.template==null||
     response.revision!==decision.revision+1||
     signature(response.template)!==decision.templateKey||
     response.projectId!==undefined&&response.projectId!==decision.projectId&&decision.projectId!==null||
     response.documentId!==undefined&&response.documentId!==decision.documentId&&decision.documentId!==null)
    return blocked('Native grading history response changed the source or document identity')
  if(direction==='undo'&&response.gradeRunPersisted!==false)
    return blocked('Rust Undo did not remove the native grade catalog as expected')
  if(direction==='redo'&&response.gradeRunPersisted!==true)
    return blocked('Rust Redo did not restore the native grade catalog as expected')
  return Object.freeze({ok:true,revision:response.revision,
    projectId:decision.projectId,documentId:decision.documentId,
    templateKey:decision.templateKey})
}
