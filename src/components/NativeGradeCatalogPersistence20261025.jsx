import React from 'react'

export default function NativeGradeCatalogPersistence20261025({
  ruleSet,catalogStatus,message,disabled=false,onCommit,onClear,onCheck,onRecover,
  activeSize=null,previewSize='M',runtimeReady=false,onChoosePreviewSize,onActivate,onRestore,
  onNativeUndo,onNativeRedo,canNativeUndo=false,canNativeRedo=false,
  onDraftUndo,onDraftRedo,canDraftUndo=false,canDraftRedo=false,
}){
  const saved=Boolean(catalogStatus?.ok&&catalogStatus?.persisted)
  const sizes=ruleSet?.sizes||catalogStatus?.sizes||[]
  const previewing=typeof activeSize==='string'&&activeSize.length>0
  return <section className="exo-native-graded-catalog" aria-label="Native grading catalog">
    <header><strong>Native Rust · {sizes.length||6}-size catalog</strong><span>{previewing?`2D / 3D · ${activeSize}`:saved?'SAVED IN PROJECT':'NOT SAVED'}</span></header>
    <p>{previewing?
      `You are viewing and simulating saved size ${activeSize} in native 2D and 3D. The original pattern, its simulation state and the XS–XXL catalog remain preserved. Restore the original before editing grade rules or exporting factory CUT.`:
      saved?'All graded templates are saved in the native Rust project. Activate one to view its 2D contour and 3D cloth mesh, or keep editing the original garment.':
      'Save the validated size run in the native Rust garment project to unlock size-specific 2D and 3D fitting previews. Factory cutting remains restricted.'}</p>
    <div className="exo-native-graded-catalog-actions">
      <button type="button" disabled={disabled||previewing||!ruleSet} onClick={onCommit}>
        {saved?'Update native grading catalog':'Save grading catalog to Rust'}
      </button>
      <button type="button" disabled={disabled||previewing||!ruleSet} onClick={onCheck}>
        Verify saved sizes
      </button>
      {!ruleSet&&!previewing&&<button type="button" disabled={disabled} onClick={onRecover}>
        Recover sizes from native project
      </button>}
      {saved&&!previewing&&<button type="button" disabled={disabled} onClick={onClear}>
        Detach catalog
      </button>}
    </div>
    <details className="exo-native-graded-catalog-history" data-exo-native-grading-history="scoped">
      <summary>Grading history: Draft / Rust</summary>
      <small>Local point-rule drafts and saved Rust catalog edits have separate histories. Global Undo is deliberately blocked when both are pending; choose which history you want to change.</small>
      <div className="exo-native-graded-catalog-actions" role="group" aria-label="Explicit grading history actions">
        <button type="button" aria-label="Undo local grading draft" disabled={disabled||!canDraftUndo} onClick={onDraftUndo}>Undo draft</button>
        <button type="button" aria-label="Redo local grading draft" disabled={disabled||!canDraftRedo} onClick={onDraftRedo}>Redo draft</button>
        <button type="button" aria-label="Undo verified Rust grading catalog" disabled={disabled||!canNativeUndo} onClick={onNativeUndo}>Undo Rust catalog</button>
        <button type="button" aria-label="Redo verified Rust grading catalog" disabled={disabled||!canNativeRedo} onClick={onNativeRedo}>Redo Rust catalog</button>
      </div>
      <small>Rust catalog history is available only for a verified unchanged native revision. A changed garment or ambiguous history fails closed.</small>
    </details>
    {saved&&<div data-native-graded-size-activation="true" style={{display:'flex',gap:8,alignItems:'end',flexWrap:'wrap'}}>
      <label>Native fitting size<select aria-label="Saved native grading size" value={previewSize}
        disabled={disabled} onChange={event=>onChoosePreviewSize?.(event.target.value)}>
        {sizes.map(size=><option key={size} value={size}>{size}</option>)}
      </select></label>
      <button type="button" disabled={disabled||!runtimeReady||activeSize===previewSize} onClick={()=>onActivate?.(previewSize)}>
        Activate {previewSize} in 2D + 3D
      </button>
    </div>}
    {saved&&!runtimeReady&&!previewing&&<small role="status">Native 2D/3D size activation requires the updated Rust session binary; the saved catalog remains safe until that build is installed.</small>}
    {previewing&&<button type="button" disabled={disabled} onClick={onRestore}>
      Restore original garment
    </button>}
    {previewing&&<small role="status">Active size {activeSize} is a reversible fitting preview. Its simulation is never saved over the original base-size pose.</small>}
    {saved&&<small role="status">{catalogStatus.sizes?.join(' · ')} · Rust project revision {catalogStatus.sourceRevision} · source verified against current grade rules</small>}
    {!saved&&<small>Six-size source proposals may be edited without committing. Manufacturing checks remain separate.</small>}
    {message&&<p role="status" data-native-catalog-message="true">{message}</p>}
  </section>
}
