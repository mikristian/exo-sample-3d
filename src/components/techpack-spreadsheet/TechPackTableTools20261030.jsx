import React, {useMemo, useState} from 'react'
import {AlignLeft,AlignCenter,AlignRight,Bold,Italic,Underline,Plus,Rows3,Columns3,Copy,ArrowLeft,ArrowRight,ArrowUp,ArrowDown,PaintBucket,Type,PanelTop,Trash2,RotateCcw,Table2,X,Pencil,Save} from 'lucide-react'
import {toGridTable,fromGridTable,makeColumnId,moveGridColumn,TABLE_THEMES,normalizeTableStyle} from '../../core/techpack-spreadsheet/tableAdapter.js'
import {gridcraftTableCommand} from '../../core/techpack-spreadsheet/gridcraftTableCommands20261030.js'
import './TechPackTableTools20261030.css'

const clamp=(n,max)=>Math.max(0,Math.min(max,Number.isFinite(Number(n))?Number(n):0))
const rowId=()=>`manual-${Date.now()}-${Math.random().toString(36).slice(2,9)}`
const blankRow=count=>({id:rowId(),cells:Array.from({length:count},()=>'' )})
const cellKey=(row,index)=>`${row?.id??index}:`
const color=value=>/^#[a-f0-9]{6}$/i.test(value||'')?value:'#ffffff'

/**
 * Standalone table actions for a techpack table. Controlled props:
 * table, onChange(nextCanonicalTable), onClose, readOnly, compact.
 * Optional selected={r,c,r2?,c2?} supports a parent-owned grid selection.
 * Existing GridCraft-compatible canonical columns/rows are preserved by tableAdapter.
 */
export default function TechPackTableTools({
  table, onChange=()=>{}, selected={r:0,c:0}, readOnly=false,
  onClose, compact=false, className='',savedThemes=[],onSaveTheme=()=>{}
}){
  const [section,setSection]=useState('styles')
  const [themeName,setThemeName]=useState('')
  const model=useMemo(()=>toGridTable(table||{}),[table])
  const headers=model.headers||[]
  const rows=model.rows||[]
  const row=clamp(selected?.r,Math.max(0,rows.length-1))
  const col=clamp(selected?.c,Math.max(0,headers.length-1))
  const r2=clamp(selected?.r2??row,Math.max(0,rows.length-1))
  const c2=clamp(selected?.c2??col,Math.max(0,headers.length-1))
  const range={r:Math.min(row,r2),r2:Math.max(row,r2),c:Math.min(col,c2),c2:Math.max(col,c2)}
  const styles=model.cellStyles||{}
  const key=`${rows[row]?.id??row}:${col}`
  const current=styles[key]||{}
  const tableStyle=normalizeTableStyle(model.tableStyle)
  const palette={...(TABLE_THEMES[tableStyle.theme]||TABLE_THEMES.light),...Object.fromEntries(Object.entries(tableStyle).filter(([name,value])=>name!=='theme'&&value))}
  const [error,setError]=useState('')
  const command=(operation)=>{
    if(readOnly)return
    try {const next=gridcraftTableCommand(table||{},operation,{row,column:col});setError('');onChange(next)}
    catch(cause){setError(cause instanceof Error?cause.message:String(cause))}
  }
  const runBatch=operations=>{
    if(readOnly)return
    try {let next=table||{};for(const operation of operations)next=gridcraftTableCommand(next,operation,{row,column:col});setError('');onChange(next)}
    catch(cause){setError(cause instanceof Error?cause.message:String(cause))}
  }
  const updateHeader=label=>command({type:'renameHeading',column:col,label})
  const insertRow=at=>command({type:'insertRow',at})
  const deleteRow=()=>command({type:'deleteRow',row})
  const duplicateRow=()=>command({type:'duplicateRow',row})
  const insertColumn=at=>command({type:'insertColumn',at,label:'NEW COLUMN'})
  const deleteColumn=()=>command({type:'deleteColumn',column:col})
  const duplicateColumn=()=>command({type:'duplicateColumn',column:col})
  const moveRow=direction=>command({type:'moveRow',row,to:row+direction})
  const moveColumn=direction=>command({type:'moveColumn',column:col,to:col+direction})
  const applyCellStyle=(name,value)=>{
    const operations=[]
    for(let r=range.r;r<=range.r2;r++)for(let c=range.c;c<=range.c2;c++){
      const existing=styles[`${rows[r]?.id??r}:${c}`]||{}
      operations.push({type:'formatCell',row:r,column:c,style:{[name]:value===undefined?!existing[name]:value}})
    }
    runBatch(operations)
  }
  const clearStyles=()=>{
    const operations=[]
    for(let r=range.r;r<=range.r2;r++)for(let c=range.c;c<=range.c2;c++)operations.push({type:'formatCell',row:r,column:c,style:{bold:false,italic:false,underline:false,align:'left',background:'#ffffff',color:'#222222'}})
    runBatch(operations)
  }
  const updatePalette=(name,value)=>command({type:'setTableStyle',style:{theme:'custom',...palette,[name]:value}})
  const action=(label,Icon,fn,disabled=false,active=false)=> <button type="button" className={active?'tpt-action is-active':'tpt-action'} title={label} aria-label={label} aria-pressed={active} disabled={readOnly||disabled} onClick={fn}><Icon size={16} strokeWidth={1.7}/><span>{label}</span></button>
  return <section className={`tpt-panel ${compact?'tpt-compact':''} ${className}`} aria-label="Tech pack table tools">
    <header className="tpt-heading"><div><Table2 size={17}/><strong>TABLE TOOLS</strong><small>{rows.length} × {headers.length}</small></div>{onClose&&<button type="button" className="tpt-icon" onClick={onClose} aria-label="Close table tools"><X size={17}/></button>}</header>
    <>
      <nav className="tpt-tabs" aria-label="Table tool categories">{[['structure','Rows & Columns'],['format','Format'],['styles','Styles']].map(([id,label])=><button key={id} type="button" aria-current={section===id?'page':undefined} className={section===id?'selected':''} onClick={()=>setSection(id)}>{label}</button>)}</nav>
      {section==='structure'&&<div className="tpt-body">
        <p className="tpt-caption">COLUMN HEADING</p><label className="tpt-header-edit"><Pencil size={15}/><input type="text" aria-label="Selected column heading" value={headers[col]??''} disabled={readOnly||!headers.length} onChange={event=>updateHeader(event.target.value)} placeholder="Column heading"/></label>
        <p className="tpt-caption">ROWS</p><div className="tpt-actions">
          {action('Insert row above',Plus,()=>insertRow(row))}
          {action('Add row below',Rows3,()=>insertRow(row+1))}
          {action('Duplicate row',Copy,duplicateRow,!rows.length)}
          {action('Delete row',Trash2,deleteRow,rows.length<=1)}
          {action('Move row up',ArrowUp,()=>moveRow(-1),row===0)}
          {action('Move row down',ArrowDown,()=>moveRow(1),row===rows.length-1)}
        </div>
        <p className="tpt-caption">COLUMNS</p><div className="tpt-actions">
          {action('Insert column left',Plus,()=>insertColumn(col))}
          {action('Add column right',Columns3,()=>insertColumn(col+1))}
          {action('Duplicate column',Copy,duplicateColumn,!headers.length)}
          {action('Delete column',Trash2,deleteColumn,headers.length<=1)}
          {action('Move column left',ArrowLeft,()=>moveColumn(-1),col===0)}
          {action('Move column right',ArrowRight,()=>moveColumn(1),col===headers.length-1)}
        </div>
      </div>}
      {section==='format'&&<div className="tpt-body">
        <p className="tpt-caption">CELL TEXT</p><div className="tpt-actions">
          {action('Bold',Bold,()=>applyCellStyle('bold'),false,!!current.bold)}
          {action('Italic',Italic,()=>applyCellStyle('italic'),false,!!current.italic)}
          {action('Underline',Underline,()=>applyCellStyle('underline'),false,!!current.underline)}
          {action('Align left',AlignLeft,()=>applyCellStyle('align','left'),false,(current.align||'left')==='left')}
          {action('Align center',AlignCenter,()=>applyCellStyle('align','center'),false,current.align==='center')}
          {action('Align right',AlignRight,()=>applyCellStyle('align','right'),false,current.align==='right')}
        </div>
        <div className="tpt-colors"><label><PaintBucket size={16}/>Cell fill<input type="color" aria-label="Cell fill color" disabled={readOnly} value={color(current.background)} onChange={e=>applyCellStyle('background',e.target.value)}/></label><label><Type size={16}/>Text color<input type="color" aria-label="Cell text color" disabled={readOnly} value={/^#[a-f0-9]{6}$/i.test(current.color||'')?current.color:'#222222'} onChange={e=>applyCellStyle('color',e.target.value)}/></label></div>
        {action('Clear selected formatting',RotateCcw,clearStyles)}
      </div>}
      {section==='styles'&&<div className="tpt-body">
        <p className="tpt-caption">CHOOSE A TABLE STYLE</p>
        <div className="tpt-themes">{Object.entries(TABLE_THEMES).map(([theme,colors])=>
          <button key={theme} disabled={readOnly} type="button" className={tableStyle.theme===theme?'is-selected':''}
            onClick={()=>command({type:'setTheme',theme})} aria-label={`Apply ${theme} table style`}
            aria-pressed={tableStyle.theme===theme} title={`${theme} table theme`}>
            <span className="tpt-theme-preview" style={{borderColor:colors.border}}>
              <i style={{background:colors.header}}/><i style={{background:colors.body}}/>
              <i style={{background:colors.stripe}}/><i style={{background:colors.body}}/>
            </span><strong>{theme}</strong>
          </button>)}</div>
        <p className="tpt-caption">CUSTOMIZE COLORS</p>
        <div className="tpt-colors">
          {[['header','Header',PanelTop],['text','Header text',Type],['body','Body',PaintBucket],
            ['bodyText','Body text',Type],['stripe','Alternate rows',Rows3],['border','Grid lines',Columns3]]
            .map(([key,label,Icon])=><label key={key}><Icon size={16}/>{label}
              <input disabled={readOnly} type="color" aria-label={`Table ${label.toLowerCase()} color`}
                value={color(palette[key])} onChange={e=>updatePalette(key,e.target.value)}/></label>)}
        </div>
        <p className="tpt-caption">COLUMN HEADINGS</p>
        <div className="tpt-heading-format">
          <label>Alignment<select aria-label="Table heading alignment" disabled={readOnly}
            value={tableStyle.headerAlign||'left'}
            onChange={e=>command({type:'setTableStyle',style:{headerAlign:e.target.value}})}>
            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
          </select></label>
          <label>Letter case<select aria-label="Table heading letter case" disabled={readOnly}
            value={tableStyle.headerCase||'normal'}
            onChange={e=>command({type:'setTableStyle',style:{headerCase:e.target.value}})}>
            <option value="normal">As written</option><option value="uppercase">UPPERCASE</option>
          </select></label>
        </div>
        <p className="tpt-caption">SAVED TABLE STYLES</p>
        {savedThemes.length>0&&<div className="tpt-saved-styles">{savedThemes.map(item=>
          <button type="button" key={item.id} disabled={readOnly} title={`Apply saved table style ${item.name}`}
            onClick={()=>command({type:'setTableStyle',style:{theme:'custom',...item.style}})}>
            <span style={{background:item.style.header,borderColor:item.style.border}}/>{item.name}
          </button>)}</div>}
        <div className="tpt-save-style">
          <input type="text" maxLength={40} aria-label="Name for saved table style"
            placeholder="My Tech Pack style" value={themeName} onChange={e=>setThemeName(e.target.value)}/>
          <button type="button" disabled={readOnly} onClick={()=>{
            try{
              onSaveTheme({name:themeName.trim()||'Custom style',style:{...palette,
                headerAlign:tableStyle.headerAlign||'left',headerCase:tableStyle.headerCase||'normal'}})
              setThemeName('');setError('')
            }catch(e){setError(e?.message||'Unable to save style')}
          }}><Save size={14}/> Save style</button>
        </div>
      </div>}
      {error&&<p className="tpt-error" role="alert">{error}</p>}
      <footer className="tpt-foot">Selected cell: {row+1}, {col+1} <span>·</span> {range.r2-range.r+1} × {range.c2-range.c+1} range</footer>
    </>
  </section>
}

export {TechPackTableTools as TechPackTableTools20261030}
