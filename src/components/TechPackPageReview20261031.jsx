import React,{useRef} from 'react'
import {Check,MessageSquare,StickyNote,Trash2} from 'lucide-react'
import './TechPackPageReview20261031.css'

/** Review notes float on artboards and are excluded from factory print/export. */
export default function TechPackPageReview({pageId,tool='select',notes=[],width=612,height=792,onAdd,onUpdate,onDelete}){
  const anchor=useRef(null),move=useRef(null)
  const getPoint=event=>{
    const rect=anchor.current?.getBoundingClientRect()
    if(!rect)return {x:50,y:50}
    return {x:Math.max(0,Math.min(width-40,Math.round((event.clientX-rect.left)/Math.max(1,rect.width)*width))),
      y:Math.max(0,Math.min(height-40,Math.round((event.clientY-rect.top)/Math.max(1,rect.height)*height)))}
  }
  return <div ref={anchor} className="tpws-review-overlay" data-review-page={pageId} aria-label={'Review comments on '+pageId}>
    {['comment','sticky'].includes(tool)&&<div className="tpws-review-placement" role="button" tabIndex={0}
      aria-label={tool==='sticky'?'Place sticky note on page':'Place review comment on page'}
      onPointerDown={event=>{if(event.button!==0)return;event.stopPropagation();event.preventDefault();onAdd(tool,getPoint(event))}}
      onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();onAdd(tool,{x:width-160,y:50})}}}/>}
    {(Array.isArray(notes)?notes:[]).slice(0,100).map(note=><section key={note.id}
      className={'tpws-review-note tpws-review-'+note.kind+(note.status==='resolved'?' resolved':'')}
      style={{left:(Math.max(0,Number(note.x)||0)/width*100)+'%',
        top:(Math.max(0,Number(note.y)||0)/height*100)+'%',background:note.color||'#fff0a6'}}>
      <header onPointerDown={event=>{
        if(event.button!==0||event.target.closest('button'))return
        event.stopPropagation();event.preventDefault()
        move.current={id:note.id,pointer:event.pointerId,start:getPoint(event),from:{x:note.x,y:note.y}}
        event.currentTarget.setPointerCapture(event.pointerId)
      }} onPointerMove={event=>{
        const drag=move.current
        if(!drag||drag.pointer!==event.pointerId)return
        const at=getPoint(event)
        onUpdate(note.id,{x:drag.from.x+at.x-drag.start.x,y:drag.from.y+at.y-drag.start.y})
      }} onPointerUp={event=>{if(move.current?.pointer===event.pointerId)move.current=null}}
        onPointerCancel={()=>{move.current=null}}>
        {note.kind==='sticky'?<StickyNote size={13}/>:<MessageSquare size={13}/>}
        <strong>{note.kind==='sticky'?'STICKY NOTE':'REVIEW COMMENT'}</strong>
        <button title={note.status==='resolved'?'Reopen':'Mark resolved'} aria-label={'Toggle resolved '+note.id}
          onClick={()=>onUpdate(note.id,{status:note.status==='resolved'?'open':'resolved'})}><Check size={13}/></button>
        <button title="Remove review note" aria-label={'Delete review note '+note.id} onClick={()=>onDelete(note.id)}><Trash2 size={13}/></button>
      </header>
      <textarea aria-label={'Review note '+note.id} maxLength={2000} value={note.text||''}
        placeholder={note.kind==='sticky'?'Add a reminder or design idea…':'Add feedback, question, or change request…'}
        onChange={event=>onUpdate(note.id,{text:event.target.value})}/>
    </section>)}
  </div>
}
