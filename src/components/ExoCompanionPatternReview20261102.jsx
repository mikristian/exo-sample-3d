import React,{useMemo,useState} from 'react'
import {buildExoCompanionPatternPreview20261102} from '../core/exoCompanionPatternPreview20261102.js'
import {projectToDxf} from '../core/dxf.js'
import './ExoCompanionPatternReview20261102.css'

/** Review surface owned by the EXO chat character, not an autonomous editor
 * command. An explicit user action, independently passing preflight and the
 * App's native capture+durable backup are required before replacement.
 */
export default function ExoCompanionPatternReview20261102({
  proposal,proposalKey,sourceSignature,currentSignature,nativeMode=false,onApply,onInstalled,
}){
  const [reviewed,setReviewed]=useState(false)
  const [confirmed,setConfirmed]=useState(false)
  const [applying,setApplying]=useState(false)
  const [installed,setInstalled]=useState(false)
  const [notice,setNotice]=useState('')
  const preview=useMemo(()=>buildExoCompanionPatternPreview20261102(proposal?.project),[proposal])
  const report=proposal?.report
  const stale=sourceSignature!==currentSignature
  const ready=Boolean(proposal?.ok&&proposal?.qa?.status==='pass'&&
    proposal?.project?.patternGeneration?.reviewRequired===true&&preview.ok&&
    report?.manufacturingApproved===false&&report?.physicalFitVerified===false)
  const saveDraftDxf=()=>{
    if(!ready)return
    try{
      const size=proposal.project.grading?.baseSize||'M'
      const contents=projectToDxf(proposal.project,size)
      const url=URL.createObjectURL(new Blob([contents],{type:'application/dxf'}))
      const link=document.createElement('a')
      link.href=url;link.download=`exo-companion-${report.sourceTemplateId}-${size}-development.dxf`
      document.body.appendChild(link);link.click();link.remove()
      setTimeout(()=>URL.revokeObjectURL(url),1000)
      setNotice('Downloaded a development DXF; this is not a factory-approved cutting file.')
    }catch(error){setNotice(`DXF export failed: ${error.message}`)}
  }
  const apply=async()=>{
    if(!ready||stale||!reviewed||(nativeMode&&!confirmed)||applying||installed||typeof onApply!=='function')return
    setApplying(true);setNotice('')
    try{
      const result=await onApply(proposal.project)
      if(result!==true){setNotice('EXO rejected the proposed import. The existing garment was not confirmed replaced.');onInstalled?.({ok:false});return}
      setInstalled(true);setReviewed(false);setConfirmed(false)
      const message=nativeMode?'EXO opened the reviewed pattern. The previous native project was saved to File Library; native Undo started a new history.':'EXO applied the reviewed pattern through an editable Undo step.'
      setNotice(message)
      onInstalled?.({ok:true,message})
    }catch(error){setNotice(`Pattern import was blocked: ${error.message}`);onInstalled?.({ok:false})}
    finally{setApplying(false)}
  }
  return <section className="exo-ai-pattern-review" aria-label="EXO conversational pattern review" data-proposal-key={proposalKey}>
    <div className="exo-ai-pattern-review-head"><strong>Pattern draft · review before opening</strong><span>{report?.sourceTemplateId||'Development'} · {proposal?.project?.grading?.baseSize||'M'}</span></div>
    {ready?<>
      <p>{report.panels} editable pattern pieces · {report.seams} source-authored sewing relationships. EXO base-size digital geometry and seam QA passed.</p>
      <div className="exo-ai-pattern-review-shapes" aria-label="Generated pattern piece shapes">
        {preview.pieces.slice(0,12).map(piece=><div key={piece.id} className="exo-ai-pattern-review-piece">
          <svg viewBox={`${piece.x-2} ${piece.y-2} ${piece.widthCm+4} ${piece.heightCm+4}`} role="img" aria-label={`${piece.name} pattern outline`} preserveAspectRatio="xMidYMid meet">
            <path d={piece.svgPath} fill="none" stroke="currentColor" strokeWidth={Math.max(.25,Math.min(1.2,piece.widthCm/80))}/>
          </svg>
          <span title={piece.name}>{piece.name}</span>
        </div>)}
      </div>
      {preview.pieces.length>12&&<small>{preview.pieces.length-12} additional editable pattern pieces are included in the DXF.</small>}
      <small>{report.adjustments?.length?`Changes: ${report.adjustments.map(item=>item.feature).join(', ')}. `:''}This is template-conditioned garment development, not an unrestricted neural generator. Physical fit, approved grading, fabric behavior and manufacturing certification remain unverified.</small>
      {stale&&!installed&&<p role="alert">The current editor garment changed after this preview. Ask EXO to regenerate the design before applying it.</p>}
      {installed?<p role="status">This approved draft was opened. Ask EXO for another revision to generate a new preview.</p>:<>
        <label><input type="checkbox" checked={reviewed} onChange={event=>{setReviewed(event.target.checked);setConfirmed(false)}}/> I reviewed the generated pieces, sewing and production limitations.</label>
        {nativeMode&&<label><input type="checkbox" checked={confirmed} disabled={!reviewed||stale} onChange={event=>setConfirmed(event.target.checked)}/> Replace the current native garment after EXO saves a File Library backup; native Undo history will reset.</label>}
        <div className="exo-ai-pattern-review-actions">
          <button type="button" onClick={saveDraftDxf} disabled={applying}>Download draft DXF</button>
          <button type="button" className="primary" disabled={!ready||stale||!reviewed||(nativeMode&&!confirmed)||applying} onClick={apply}>{applying?'Checking and opening…':nativeMode?'Confirm native import':'Apply reviewed pattern'}</button>
        </div>
      </>}
    </>:<p role="alert">The proposed geometry could not be previewed or did not satisfy the digital QA and provenance gates. Nothing can be applied. {preview.reason||''}</p>}
    {notice&&<p role="status">{notice}</p>}
  </section>
}
