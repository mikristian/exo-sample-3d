import React from 'react'
import {Bold,Italic,Underline,AlignLeft,AlignCenter,AlignRight,Type} from 'lucide-react'
import './TechPackCharacterProperties20261031.css'

export const TECHPACK_FONT_CHOICES=Object.freeze([
 'Arial','Helvetica','Georgia','Times New Roman','Courier New','Verdana','Trebuchet MS','Impact'
])
export default function TechPackCharacterProperties({style={},selection='',onChange=()=>{},disabled=false}){
 const field=(property,value)=>onChange({[property]:value})
 return <section className="tpws-character-properties" aria-label="Character properties for selected text">
  <header><Type size={15}/><div><strong>CHARACTER</strong><small>{selection||'Select text or a table cell'}</small></div></header>
  <label className="tpws-character-font">Font family
    <select aria-label="Character font family" disabled={disabled} value={TECHPACK_FONT_CHOICES.includes(style.fontFamily)?style.fontFamily:'Arial'}
      onChange={event=>field('fontFamily',event.target.value)}>
      {TECHPACK_FONT_CHOICES.map(font=><option key={font} value={font}>{font}</option>)}
    </select>
  </label>
  <div className="tpws-character-grid">
    <label>Size <input type="number" aria-label="Character font size" min="6" max="72" step="1"
      disabled={disabled} value={style.fontSize??12} onChange={e=>field('fontSize',Math.min(72,Math.max(6,Math.round(Number(e.target.value)||12))))}/></label>
    <label>Tracking <input type="number" aria-label="Character tracking" min="-3" max="10" step=".1"
      disabled={disabled} value={style.letterSpacing??0} onChange={e=>field('letterSpacing',Math.min(10,Math.max(-3,Number(e.target.value)||0)))}/></label>
    <label>Leading <input type="number" aria-label="Character line height" min=".8" max="2.5" step=".1"
      disabled={disabled} value={style.lineHeight??1.1} onChange={e=>field('lineHeight',Math.min(2.5,Math.max(.8,Number(e.target.value)||1.1)))}/></label>
    <label>Color <input type="color" aria-label="Character text color" disabled={disabled}
      value={/^#[0-9a-f]{6}$/i.test(style.color||'')?style.color:'#171717'} onChange={e=>field('color',e.target.value)}/></label>
  </div>
  <div className="tpws-character-toolbar" role="group" aria-label="Character formatting">
    <button type="button" disabled={disabled} title="Bold" aria-label="Bold text" aria-pressed={Boolean(style.bold)} onClick={()=>field('bold',!style.bold)}><Bold size={15}/></button>
    <button type="button" disabled={disabled} title="Italic" aria-label="Italic text" aria-pressed={Boolean(style.italic)} onClick={()=>field('italic',!style.italic)}><Italic size={15}/></button>
    <button type="button" disabled={disabled} title="Underline" aria-label="Underline text" aria-pressed={Boolean(style.underline)} onClick={()=>field('underline',!style.underline)}><Underline size={15}/></button>
    {[[AlignLeft,'left'],[AlignCenter,'center'],[AlignRight,'right']].map(([Icon,align])=>
      <button key={align} type="button" disabled={disabled} title={`Align ${align}`}
        aria-label={`Align text ${align}`} aria-pressed={(style.align||'left')===align}
        onClick={()=>field('align',align)}><Icon size={15}/></button>)}
  </div>
  <small className="tpws-character-hint">Choose a table cell on the artboard. Double-click its text to select words without opening Table Studio.</small>
 </section>
}
