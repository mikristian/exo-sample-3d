import React,{useState} from 'react'
import {Palette} from 'lucide-react'
import {TECHPACK_THEMES} from '../core/techPackTemplatePresets.js'
import {TECHPACK_STUDIO_PALETTES,TECHPACK_PRINT_PALETTES,TECHPACK_COLOR_FIELDS,resolveTechPackPalette} from '../core/techPackVisualThemes20261031.js'
import './TechPackVisualThemeLibrary20261031.css'
export default function TechPackVisualThemeLibrary({selected='mono',onHover=()=>{},onApply=()=>{},onApplyColors=()=>{},colors={}}){
 const [paletteGroup,setPaletteGroup]=useState('print')
 const [edits,setEdits]=useState({})
 const [scope,setScope]=useState('page')
 const themes=paletteGroup==='studio'?TECHPACK_STUDIO_PALETTES:paletteGroup==='print'?TECHPACK_PRINT_PALETTES:TECHPACK_THEMES
 const active=(()=>{try{return resolveTechPackPalette(selected)}catch{return resolveTechPackPalette('mono')}})()
 const current={...active,...colors,...edits}
 return <section className="tpws-visual-theme-library" aria-label="Tech Pack visual color themes">
  <header><Palette size={16}/><div><strong>TECH PACK THEMES</strong><small>Live preview · no garment values changed</small></div></header>
  <p>Choose a palette and customize page, header, tables and body separately.</p>
  <div className="tpws-visual-theme-switch"><button type="button" aria-pressed={paletteGroup==='print'} onClick={()=>setPaletteGroup('print')}>Print palettes</button><button type="button" aria-pressed={paletteGroup==='techpack'} onClick={()=>setPaletteGroup('techpack')}>Classic</button><button type="button" aria-pressed={paletteGroup==='studio'} onClick={()=>setPaletteGroup('studio')}>EXO Studio</button></div>
  <div className="tpws-visual-theme-gallery">{themes.map(item=><article key={item.id} className={selected===item.id?'active':''}
    onMouseEnter={()=>onHover(item.id)} onMouseLeave={()=>onHover('')}>
    <div className="tpws-visual-theme-mini" style={{'--t-accent':item.header||item.accent,'--t-line':item.line,'--t-wash':item.table||item.wash,'--t-paper':item.background||item.wash,'--t-body':item.body||item.wash}}>
      <div className="tpws-visual-theme-mini-header"><i/><i/><i/><i/></div>
      <div className="tpws-visual-theme-mini-band"/>
      <div className="tpws-visual-theme-mini-blank"/>
      <div className="tpws-visual-theme-mini-grid"><i/><i/><i/><i/><i/><i/></div>
    </div>
    <strong>{item.name}</strong><div className="tpws-visual-theme-swatches">
      {[item.background||item.wash,item.header||item.accent,item.table||item.wash,item.body||item.wash].map((color,index)=><span key={index} style={{background:color}}/>)}
    </div>
    <div className="tpws-visual-theme-actions">
      <button type="button" onFocus={()=>onHover(item.id)} onBlur={()=>onHover('')} onClick={()=>onApplyColors(Object.fromEntries(TECHPACK_COLOR_FIELDS.map(field=>[field.key,item[field.key]||item.wash])), 'page',item.id)}>This page</button>
      <button type="button" onFocus={()=>onHover(item.id)} onBlur={()=>onHover('')} onClick={()=>onApplyColors(Object.fromEntries(TECHPACK_COLOR_FIELDS.map(field=>[field.key,item[field.key]||item.wash])), 'all',item.id)}>All pages</button>
    </div>
  </article>)}</div>
  <div className="tpws-visual-theme-custom"><strong>Custom document colors</strong><div className="tpws-visual-theme-color-grid">{TECHPACK_COLOR_FIELDS.map(field=><label key={field.key}><span>{field.label}</span><input aria-label={field.label} type="color" value={current[field.key]||'#ffffff'} onChange={event=>setEdits(previous=>({...previous,[field.key]:event.target.value}))}/></label>)}</div>
   <div className="tpws-visual-theme-switch"><label><input type="radio" name="tpws-color-scope" checked={scope==='page'} onChange={()=>setScope('page')}/> This page</label><label><input type="radio" name="tpws-color-scope" checked={scope==='all'} onChange={()=>setScope('all')}/> All pages</label></div>
   <button type="button" disabled={!Object.keys(edits).length} onClick={()=>{onApplyColors(edits,scope);setEdits({})}}>Apply custom colors</button><button type="button" onClick={()=>setEdits({})}>Reset edits</button>
  </div>
 </section>
}
