import React,{useEffect,useRef,useState} from 'react'
import {Table2,Search,X} from 'lucide-react'
import {TECHPACK_TABLE_GALLERY} from '../core/techpack-spreadsheet/techPackTableGallery20261030.js'
import {BOTTOM_TABLE_PRESETS} from '../core/techPackBottomTableTemplates20261031.js'
import './TechPackBottomTablePicker20261031.css'

// Frequent Tech Pack tables, not dummy numeric specifications or calculated
// measurements. The whole canonical table is still editable after insertion.
const gallery=new Map(TECHPACK_TABLE_GALLERY.map(item=>[item.id,item]))

export default function TechPackBottomTablePicker({onSelect,onClose}){
  const [query,setQuery]=useState('')
  const ref=useRef(null)
  useEffect(()=>{
    const onDown=event=>{
      if(event.key==='Escape'){event.preventDefault();onClose()}
    }
    const onPointer=event=>{if(ref.current&&!ref.current.contains(event.target))onClose()}
    document.addEventListener('keydown',onDown)
    document.addEventListener('pointerdown',onPointer,true)
    return()=>{document.removeEventListener('keydown',onDown);document.removeEventListener('pointerdown',onPointer,true)}
  },[onClose])
  return <section className="tpws-bottom-table-picker" ref={ref} role="dialog"
    aria-label="Choose bottom table template" onClick={event=>event.stopPropagation()}>
    <header className="tpws-bottom-picker-header">
      <Table2 size={16}/><div><strong>ADD SPECIFICATION TABLE</strong><small>Choose a layout · edit every cell after insertion</small></div>
      <button type="button" className="tpws-bottom-picker-close" aria-label="Close table templates" onClick={onClose}><X size={15}/></button>
    </header>
    <label className="tpws-bottom-picker-search"><Search size={13}/>
      <input value={query} onChange={event=>setQuery(event.target.value)}
        placeholder="Search: size chart, fabric, POM…" aria-label="Filter table templates" autoFocus/>
    </label>
    <div className="tpws-bottom-picker-list">
      {BOTTOM_TABLE_PRESETS.map(id=>gallery.get(id)).filter(Boolean).filter(item=>
        [item.name,item.category,item.description].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
        .map(item=><button key={item.id} type="button" className="tpws-bottom-picker-item"
          onClick={()=>onSelect(item.id)} aria-label={`Insert ${item.name} table`}>
          <span className="tpws-bottom-picker-thumb" aria-hidden="true">
            <i className="tpws-bottom-picker-thumb-head"/>
            {Array.from({length:3},(_,row)=><i key={row} className="tpws-bottom-picker-thumb-row" style={{'--cols':Math.min(5,item.headings.length)}}/>)}
          </span>
          <span className="tpws-bottom-picker-info"><strong>{item.name}</strong>
            <small>{item.category} · {item.headings.length} columns · {item.rowLabels.length} rows</small></span>
          <span className="tpws-bottom-picker-action">Insert</span>
        </button>)}
      {!BOTTOM_TABLE_PRESETS.some(id=>{
        const item=gallery.get(id)
        return item&&[item.name,item.category,item.description].join(' ').toLowerCase().includes(query.trim().toLowerCase())
      })&&<p className="tpws-bottom-picker-empty">No table templates match that search.</p>}
    </div>
  </section>
}
