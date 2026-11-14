import React,{useEffect,useMemo,useRef,useState} from 'react'
import {AlignCenter,AlignLeft,AlignRight,Bold,Check,ChevronDown,Columns3,Combine,Copy,GripHorizontal,Grid3X3,Italic,Library,Lock,PaintBucket,Plus,Rows3,Split,Table2,Trash2,Type,Underline,X} from 'lucide-react'
import TechPackSpreadsheetBlock from './TechPackSpreadsheetBlock.jsx'
import TechPackTableTools from './TechPackTableTools20261030.jsx'
import {TABLE_THEMES,normalizeTableStyle,toGridTable} from '../../core/techpack-spreadsheet/tableAdapter.js'
import {gridcraftTableCommand} from '../../core/techpack-spreadsheet/gridcraftTableCommands20261030.js'
import {mergedCellAt} from '../../core/techpack-spreadsheet/mergedCells20261030.js'
import {techPackTablePopoverPosition} from '../../core/techpack-spreadsheet/tablePopoverPosition20261030.js'
import {TECHPACK_TABLE_GALLERY,TECHPACK_HEADER_GALLERY,createTechPackGalleryTable,replaceTechPackHeaderPreset} from '../../core/techpack-spreadsheet/techPackTableGallery20261030.js'
import './TechPackTableStudio20261030.css'
import './TechPackTableGallery20261031.css'

/** Nonmodal, draggable popover anchored to its page/table. The artboard stays visible. */
export default function TechPackTableStudio20261030({
  open=false,table,onChange=()=>{},onClose=()=>{},onSaveToLibrary,onEmbed,draftMode=false,
  onRemove,
  readOnly=false,sourceLabel='Techpack table',anchorId='',anchorPageId='',
  savedThemes=[],onSaveTheme=()=>{},
}){
  const panel=useRef(null),closeButton=useRef(null),drag=useRef(null),manuallyPlaced=useRef(false)
  const columnDrag=useRef(null),rowDrag=useRef(null),latestTable=useRef(table),latestChange=useRef(onChange)
  const sheet=useRef(null)
  latestTable.current=table
  latestChange.current=onChange
  const previousFocus=useRef(null)
  const [selected,setSelected]=useState({r:0,c:0})
  const [ribbon,setRibbon]=useState('home')
  const [galleryType,setGalleryType]=useState('tables')
  const [galleryCategory,setGalleryCategory]=useState('All')
  const [pendingPreset,setPendingPreset]=useState('')
  const [advanced,setAdvanced]=useState(false)
  const [error,setError]=useState('')
  const [position,setPosition]=useState({left:120,top:145})
  const grid=useMemo(()=>toGridTable(table||{}),[table])
  const rows=grid.rows||[],columns=grid.headers||[]
  const row=Math.max(0,Math.min(rows.length-1,selected.r??0))
  const column=Math.max(0,Math.min(columns.length-1,selected.c??0))
  const tableStyle=normalizeTableStyle(grid.tableStyle)
  const palette={...(TABLE_THEMES[tableStyle.theme]||TABLE_THEMES.light),...Object.fromEntries(Object.entries(tableStyle).filter(([k,value])=>k!=='theme'&&value!==undefined))}
  const key=`${rows[row]?.id}:${column}`
  const cellStyle=grid.cellStyles?.[key]||{}
  const mergedHere=useMemo(()=>{
    try{return mergedCellAt(grid,row,column)}catch{return null}
  },[table,row,column])

  useEffect(()=>{
    if(!open)return
    manuallyPlaced.current=false
    previousFocus.current=document.activeElement
    const place=()=>{
      if(manuallyPlaced.current)return
      const scope=document.querySelector('.tpws-center')?.getBoundingClientRect()
      const objects=[...document.querySelectorAll('[data-board-object]')]
      const anchor=objects.find(node=>node.dataset.boardObject===anchorId&&node.dataset.boardPage===anchorPageId)
        ||[...document.querySelectorAll('[data-techpack-sheet]')].find(node=>node.dataset.techpackSheet===anchorPageId)
      const rect=anchor?.getBoundingClientRect()||scope
      const width=Math.min(690,Math.max(320,window.innerWidth-32))
      const height=Math.min(470,Math.max(300,window.innerHeight-32))
      setPosition(techPackTablePopoverPosition({anchor:rect,canvas:scope,viewport:{width:window.innerWidth,height:window.innerHeight},width,height}))
    }
    const frame=requestAnimationFrame(()=>{place();closeButton.current?.focus({preventScroll:true})})
    window.addEventListener('resize',place)
    window.addEventListener('scroll',place,true)
    return()=>{
      cancelAnimationFrame(frame)
      window.removeEventListener('resize',place)
      window.removeEventListener('scroll',place,true)
      drag.current=null
      if(previousFocus.current?.isConnected)previousFocus.current.focus({preventScroll:true})
    }
  },[open,anchorId,anchorPageId])

  useEffect(()=>{
    if(!open||readOnly)return
    const move=event=>{
      const active=columnDrag.current
      const activeRow=rowDrag.current
      if(active?.pointer!==event.pointerId&&activeRow?.pointer!==event.pointerId)return
      const payload=active?.pointer===event.pointerId
        ?{type:'setColumnWidth',column:active.column,width:Math.max(40,Math.min(500,Math.round(active.width+event.clientX-active.x)))}
        :{type:'setRowHeight',row:activeRow.row,height:Math.max(20,Math.min(200,Math.round(activeRow.height+event.clientY-activeRow.y)))}
      const target=active?.pointer===event.pointerId?active:activeRow
      const size=payload.width??payload.height
      if(size===target.lastSize)return
      target.lastSize=size
      try{latestChange.current(gridcraftTableCommand(latestTable.current,payload))}
      catch{/* The table may have been replaced while dragging. */}
    }
    const stop=event=>{
      if(columnDrag.current?.pointer===event.pointerId)columnDrag.current=null
      if(rowDrag.current?.pointer===event.pointerId)rowDrag.current=null
    }
    window.addEventListener('pointermove',move)
    window.addEventListener('pointerup',stop)
    window.addEventListener('pointercancel',stop)
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);columnDrag.current=null;rowDrag.current=null}
  },[open,readOnly])

  // Keep this hook ahead of the closed-state return. Opening a placed table
  // must execute the same hooks as the preceding closed render.
  useEffect(()=>{
    if(!open||ribbon==='presets')return
    const host=sheet.current
    if(!host)return
    const decorate=()=>{
      host.querySelectorAll('.tps tbody tr').forEach((tr,at)=>{
        const head=tr.querySelector(':scope > .tps-rowhead')
        if(!head)return
        const height=Number(rows[at]?.height)
        if(Number.isFinite(height)&&height>=20&&height<=200)tr.style.height=`${height}px`
        else tr.style.removeProperty('height')
        if(!head.querySelector('.tpts-row-resizer')){
          const grip=document.createElement('span')
          grip.className='tpts-row-resizer'
          grip.setAttribute('role','separator')
          grip.setAttribute('aria-label',`Resize row ${at+1}`)
          grip.setAttribute('title',`Drag to resize row ${at+1}`)
          head.appendChild(grip)
        }
      })
    }
    decorate()
    if(typeof MutationObserver==='undefined')return
    const observer=new MutationObserver(decorate)
    observer.observe(host,{childList:true,subtree:true})
    return()=>observer.disconnect()
  },[open,ribbon,table])

  if(!open||!table)return null

  const update=next=>{if(readOnly)return;setError('');onChange(next)}
  const command=payload=>{
    if(readOnly)return
    try{update(gridcraftTableCommand(table,payload,{row,column}));setError('')}
    catch(e){setError(e?.message||'Table operation unavailable')}
  }
  const toggleStyle=property=>command({type:'formatCell',row,column,style:{[property]:!cellStyle[property]}})
  const updateStyle=(property,value)=>command({type:'formatCell',row,column,style:{[property]:value}})
  const updatePalette=(property,value)=>command({type:'setTableStyle',style:{theme:'custom',...palette,[property]:value}})
  const mergeSelection=()=>{
    const r=Math.min(row,selected.r2??row),r2=Math.max(row,selected.r2??row)
    const c=Math.min(column,selected.c2??column),c2=Math.max(column,selected.c2??column)
    command({type:'mergeCells',range:{r,c,r2,c2}})
  }
  const addHeading=()=>{
    command({type:'addMergedHeading',label:table.title||'SECTION HEADING'})
    setSelected({r:0,c:0,r2:0,c2:columns.length-1})
  }
  const sourceBound=Boolean(table.origin==='source'||table.sourceLinked||
    table.rows?.some(item=>item.sourceRef||item.origin==='native'||Object.values(item.cells||{}).some(cell=>
      cell?.sourceRef||cell?.origin==='native'||cell?.override||cell?.provenance?.kind==='source')))
  const authoredValues=Boolean(table.rows?.some(item=>Object.values(item.cells||{}).some(cell=>
    String(cell?.input??cell?.value??cell??'').trim().length>0)))
  const applyGalleryTable=id=>{
    if(readOnly||sourceBound){setError('Source-linked tables cannot be replaced by a preset. Make a new table instead.');return}
    if(authoredValues&&pendingPreset!==id){
      setPendingPreset(id)
      setError('Replacing this table clears its authored cells. Click the same preset again to confirm.')
      return
    }
    try{
      const next=createTechPackGalleryTable(id)
      update({...next,id:table.id,pageId:table.pageId,boxId:table.boxId})
      setPendingPreset('');setSelected({r:0,c:0});setRibbon('home')
    }catch(e){setError(e?.message||'Unable to apply preset')}
  }
  const applyGalleryHeader=id=>{
    if(readOnly)return
    try{
      update(replaceTechPackHeaderPreset(table,id,{label:table.title||'TECHNICAL SPECIFICATION'}))
      setSelected({r:0,c:0});setPendingPreset('');setRibbon('home')
    }catch(e){setError(e?.message||'Unable to apply header')}
  }
  const availableCategories=['All',...new Set(TECHPACK_TABLE_GALLERY.map(item=>item.category))]
  const save=()=>{
    try{onSaveToLibrary?.(table);setError('')}
    catch(e){setError(e?.message||'Could not save table')}
  }
  const embed=()=>{
    try{onEmbed?.(table);setError('')}
    catch(e){setError(e?.message||'Could not insert table')}
  }
  const removePlacedTable=()=>{
    if(readOnly||draftMode||typeof onRemove!=='function')return
    try{onRemove();setError('')}
    catch(e){setError(e?.message||'Could not remove table')}
  }
  const beginDrag=event=>{
    if(event.button!==0||event.target.closest('button,input,select'))return
    event.preventDefault()
    manuallyPlaced.current=true
    drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,left:position.left,top:position.top}
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag=event=>{
    const item=drag.current
    if(!item||item.pointer!==event.pointerId)return
    const width=panel.current?.getBoundingClientRect().width||690
    const height=panel.current?.getBoundingClientRect().height||470
    setPosition({left:Math.max(8,Math.min(window.innerWidth-width-8,item.left+event.clientX-item.x)),
      top:Math.max(8,Math.min(window.innerHeight-height-8,item.top+event.clientY-item.y))})
  }
  const endDrag=event=>{if(drag.current?.pointer===event.pointerId)drag.current=null}
  const beginColumnResize=event=>{
    const handle=event.target.closest?.('.tps-resizer')
    if(!handle||readOnly||event.button!==0)return
    const th=handle.closest('th')
    const at=th?.cellIndex-1
    if(!Number.isInteger(at)||at<0||at>=columns.length)return
    event.preventDefault()
    event.stopPropagation()
    const width=Math.max(40,Math.min(500,Number(grid.columnWidths?.[at])||160))
    columnDrag.current={pointer:event.pointerId,column:at,x:event.clientX,width,lastSize:width}
    setSelected(previous=>({...previous,c:at}))
  }
  const beginRowResize=event=>{
    const handle=event.target.closest?.('.tpts-row-resizer')
    if(!handle||readOnly||event.button!==0)return
    const tr=handle.closest('tr'),at=tr?.sectionRowIndex
    if(!Number.isInteger(at)||at<0||at>=rows.length)return
    event.preventDefault()
    event.stopPropagation()
    const height=Math.max(20,Math.min(200,Number(rows[at]?.height)||tr.getBoundingClientRect().height||27))
    rowDrag.current={pointer:event.pointerId,row:at,y:event.clientY,height,lastSize:Math.round(height)}
    setSelected(previous=>({...previous,r:at}))
  }
  // The spreadsheet block owns its markup; the effect above decorates row
  // headers with resize grips without disturbing editing or cell selection.
  const tool=(label,Icon,handler,{active=false,disabled=false}={})=><button type="button" className={`tpts-tool ${active?'is-active':''}`} title={label} aria-label={label} aria-pressed={active} disabled={readOnly||disabled} onClick={handler}><Icon size={15}/></button>
  const swatch=(theme,colors)=><button type="button" key={theme} className={`tpts-swatch ${tableStyle.theme===theme?'is-selected':''}`}
    title={`Apply ${theme} table theme`} aria-label={`Apply ${theme} table theme`} aria-pressed={tableStyle.theme===theme} disabled={readOnly}
    onClick={()=>command({type:'setTheme',theme})}><span style={{background:colors.header}}/><span style={{background:colors.stripe}}/><small>{theme}</small></button>

  return <div className="tpts-overlay" onKeyDown={event=>{
      if(event.key==='Escape'&&!event.target.closest('.tps-editor')){event.stopPropagation();event.preventDefault();onClose()}
      else event.stopPropagation()
    }}>
    <section ref={panel} className="tpts-dialog" role="dialog" aria-modal="false" aria-label="Table widget editor"
      style={{left:position.left,top:position.top}} onPointerDown={event=>event.stopPropagation()}>
      <header className="tpts-header" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <GripHorizontal className="tpts-grip" size={18}/>
        <Table2 size={16}/><div className="tpts-title"><strong>TABLE EDITOR</strong><small>{rows.length} rows · {columns.length} columns {readOnly?'· Locked':''}</small></div>
        <span className="tpts-header-spacer"/>
        {readOnly&&<Lock size={14} aria-label="Table locked"/>}
        {typeof onSaveToLibrary==='function'&&<button type="button" title="Save reusable table template" aria-label="Save table to library" onClick={save} disabled={readOnly}><Library size={15}/></button>}
        <button ref={closeButton} type="button" aria-label="Close table widget" title="Close editor" onClick={onClose}><X size={18}/></button>
      </header>
      <div className="tpts-namebar"><input aria-label="Table title" maxLength={160} value={table.title||''} disabled={readOnly} onChange={event=>update({...table,title:event.target.value})}/><span title={sourceLabel}>{draftMode?'New table · place on page':'Editing table on page'}</span></div>
      {!draftMode&&<div className="tpts-table-actions" role="group" aria-label="Table replacement and removal">
        <button type="button" aria-label="Replace this table with another template" disabled={readOnly||sourceBound}
          onClick={()=>{setRibbon('presets');setGalleryType('tables');setPendingPreset('');setError('')}}><Table2 size={13}/> Replace table</button>
        {typeof onRemove==='function'&&<button type="button" className="tpts-remove-table" aria-label="Remove this table from the page"
          disabled={readOnly} onClick={removePlacedTable}><Trash2 size={13}/> Remove table</button>}
        {sourceBound&&<small>Source-linked data cannot be replaced with a preset.</small>}
      </div>}
      <nav className="tpts-tabs" aria-label="Table editing tools">
        {['home','insert','design','presets'].map(tab=><button key={tab} type="button" aria-selected={ribbon===tab} className={ribbon===tab?'active':''} onClick={()=>{setRibbon(tab);setError('');setPendingPreset('')}}>{tab==='home'?'Home':tab==='insert'?'Rows & Columns':tab==='design'?'Table Design':'Presets'}</button>)}
        <button type="button" className={`tpts-more ${advanced?'active':''}`} aria-expanded={advanced} onClick={()=>setAdvanced(value=>!value)}>More <ChevronDown size={13}/></button>
      </nav>
      <div className="tpts-ribbon">
        {ribbon!=='presets'&&<label className="tpts-width-control" title="Selected column width in pixels">Column {column+1} width
          <input type="number" aria-label="Selected column width (px)" min="40" max="500" step="1"
            disabled={readOnly||!columns.length} value={Math.max(40,Math.min(500,Number(grid.columnWidths?.[column])||160))}
            onChange={event=>{if(event.target.value==='')return;const width=Number(event.target.value);if(Number.isFinite(width))command({type:'setColumnWidth',column,width:Math.max(40,Math.min(500,Math.round(width)))})}}/>
          <span>px</span>
        </label>}
        {ribbon!=='presets'&&<label className="tpts-width-control" title="Selected row height in pixels">Row {row+1} height
          <input type="number" aria-label="Selected row height (px)" min="20" max="200" step="1"
            disabled={readOnly||!rows.length} value={Math.max(20,Math.min(200,Number(rows[row]?.height)||27))}
            onChange={event=>{if(event.target.value==='')return;const height=Number(event.target.value);if(Number.isFinite(height))command({type:'setRowHeight',row,height:Math.max(20,Math.min(200,Math.round(height)))})}}/>
          <span>px</span>
        </label>}
        {ribbon==='home'&&<>
          <div className="tpts-toolgroup">{tool('Bold',Bold,()=>toggleStyle('bold'),{active:Boolean(cellStyle.bold)})}{tool('Italic',Italic,()=>toggleStyle('italic'),{active:Boolean(cellStyle.italic)})}{tool('Underline',Underline,()=>toggleStyle('underline'),{active:Boolean(cellStyle.underline)})}</div>
          <div className="tpts-toolgroup">{tool('Align left',AlignLeft,()=>updateStyle('align','left'),{active:!cellStyle.align||cellStyle.align==='left'})}{tool('Align center',AlignCenter,()=>updateStyle('align','center'),{active:cellStyle.align==='center'})}{tool('Align right',AlignRight,()=>updateStyle('align','right'),{active:cellStyle.align==='right'})}</div>
          <label className="tpts-color" title="Cell fill"><PaintBucket size={13}/><input type="color" aria-label="Cell fill" value={cellStyle.background||'#ffffff'} disabled={readOnly} onChange={event=>updateStyle('background',event.target.value)}/></label>
          <label className="tpts-color" title="Text color"><Type size={13}/><input type="color" aria-label="Text color" value={cellStyle.color||'#273244'} disabled={readOnly} onChange={event=>updateStyle('color',event.target.value)}/></label>
          <label className="tpts-heading-label">Heading<input aria-label="Selected column heading" value={columns[column]||''} disabled={readOnly||!columns.length} onChange={event=>command({type:'renameHeading',column,label:event.target.value})}/></label>
          <div className="tpts-toolgroup tpts-merging">
            <button type="button" className="tpts-merge-button" title="Merge selected cells and center heading"
              disabled={readOnly} onClick={mergeSelection}><Combine size={14}/> Merge &amp; Center</button>
            {mergedHere&&tool('Unmerge current cell',Split,()=>command({type:'unmergeCells',row,column}))}
          </div>
        </>}
        {ribbon==='insert'&&<>
          <span className="tpts-ribbon-label">Rows</span>
          {tool('Insert row above',Plus,()=>command({type:'insertRow',at:row}))}
          {tool('Insert row below',Rows3,()=>command({type:'insertRow',at:row+1}))}
          {tool('Duplicate row',Copy,()=>command({type:'duplicateRow',row}))}
          {tool('Delete selected row',Trash2,()=>command({type:'deleteRow',row}),{disabled:rows.length<=1})}
          <span className="tpts-divider"/><span className="tpts-ribbon-label">Columns</span>
          {tool('Insert column left',Plus,()=>command({type:'insertColumn',at:column}))}
          {tool('Insert column right',Columns3,()=>command({type:'insertColumn',at:column+1}))}
          {tool('Delete selected column',Trash2,()=>command({type:'deleteColumn',column}),{disabled:columns.length<=1})}
          <span className="tpts-divider"/>
          <button type="button" className="tpts-merge-button" disabled={readOnly||rows.length>=100&&columns.length>=50}
            onClick={()=>command({type:'expandGrid',rows:Math.min(100,rows.length+5),
              columns:Math.min(50,columns.length+2)})}>
            <Grid3X3 size={14}/> More cells
          </button>
          <button type="button" className="tpts-merge-button" disabled={readOnly||columns.length<2}
            onClick={addHeading}><Combine size={14}/> Heading row</button>
        </>}
        {ribbon==='design'&&<>
          <div className="tpts-theme-strip" aria-label="Table themes">{Object.entries(TABLE_THEMES).map(([theme,colors])=>swatch(theme,colors))}</div>
          <label className="tpts-color" title="Header color"><span>Header</span><input type="color" aria-label="Header color" value={palette.header} disabled={readOnly} onChange={event=>updatePalette('header',event.target.value)}/></label>
          <label className="tpts-color" title="Stripe color"><span>Stripe</span><input type="color" aria-label="Stripe color" value={palette.stripe} disabled={readOnly} onChange={event=>updatePalette('stripe',event.target.value)}/></label>
          <button type="button" className="tpts-merge-button" disabled={readOnly||columns.length<2}
            onClick={addHeading}><Combine size={14}/> Title band</button>
        </>}
        {ribbon==='presets'&&<div className="tpts-gallery-ribbon">
          <button type="button" aria-pressed={galleryType==='tables'} onClick={()=>setGalleryType('tables')}>Table templates</button>
          <button type="button" aria-pressed={galleryType==='headers'} onClick={()=>setGalleryType('headers')}>Header designs</button>
          <span>Choose a layout, then edit every cell.</span>
        </div>}
      </div>
      <div ref={sheet} className="tpts-sheet" aria-label="Editable GridCraft-style table widget" onPointerDownCapture={event=>{beginRowResize(event);beginColumnResize(event)}}>
        {ribbon==='presets'?<div className="tpts-gallery" aria-label="Tech pack table preset gallery">
          <div className="tpts-gallery-heading">
            <strong>{galleryType==='tables'?'READY-TO-EDIT TECH PACK TABLES':'PROFESSIONAL TABLE HEADERS'}</strong>
            {galleryType==='tables'&&<select value={galleryCategory} aria-label="Filter tech pack table presets"
              onChange={event=>setGalleryCategory(event.target.value)}>{availableCategories.map(item=>
                <option key={item} value={item}>{item}</option>)}</select>}
            <span>{galleryType==='tables'?TECHPACK_TABLE_GALLERY.length:TECHPACK_HEADER_GALLERY.length} designs</span>
          </div>
          <div className="tpts-gallery-items">
            {galleryType==='tables'?TECHPACK_TABLE_GALLERY.filter(item=>galleryCategory==='All'||item.category===galleryCategory).map(item=>
              <button key={item.id} type="button" className={pendingPreset===item.id?'tpts-gallery-card is-confirming':'tpts-gallery-card'}
                onClick={()=>applyGalleryTable(item.id)} disabled={readOnly||sourceBound}
                aria-label={`Use ${item.name} preset`}>
                <span className="tpts-gallery-category">{item.category}</span>
                <strong>{item.name}</strong><small>{item.description}</small>
                <span className="tpts-gallery-mini-grid">
                  <i>{item.headings.slice(0,4).map((head,i)=><b key={i}>{head}</b>)}</i>
                  {item.rowLabels.slice(0,2).map((label,r)=><i key={r}>{item.headings.slice(0,4).map((_,c)=>
                    <em key={c}>{c===0?label:' '}</em>)}</i>)}
                </span>
                <span className="tpts-gallery-card-action">{pendingPreset===item.id?'Confirm replacement':'Use table'}</span>
              </button>):
              TECHPACK_HEADER_GALLERY.map(item=><button key={item.id} className="tpts-gallery-card tpts-header-card"
                disabled={readOnly} onClick={()=>applyGalleryHeader(item.id)} aria-label={`Apply ${item.name} header`}>
                <span className="tpts-gallery-category">HEADER STYLE</span>
                <strong>{item.name}</strong><small>{item.description}</small>
                <span className="tpts-header-preview">
                  {item.rows>0&&<b style={{background:item.background,color:item.color,textAlign:item.align}}>
                    {table.title||'TECHNICAL SPECIFICATION'}</b>}
                  <i><em>SPEC</em><em>DESCRIPTION</em><em>SIZE</em></i>
                  <i><em>—</em><em>—</em><em>—</em></i>
                </span><span className="tpts-gallery-card-action">Apply header</span>
              </button>)}
          </div>
          {sourceBound&&galleryType==='tables'&&<p className="tpts-gallery-warning">This table contains linked garment data. Create a new table to use a preset without overwriting source values.</p>}
        </div>:<TechPackSpreadsheetBlock table={table} readOnly={readOnly} sourceLabel={sourceLabel} externalTools
          onChange={update} onSelectionChange={setSelected} onExit={onClose}/>}
      </div>
      {advanced&&<aside className="tpts-advanced" aria-label="Advanced table formatting"><TechPackTableTools table={table} onChange={update} selected={selected} readOnly={readOnly} compact savedThemes={savedThemes} onSaveTheme={onSaveTheme}/></aside>}
      <footer className="tpts-bottom"><span role="alert">{error}</span><small>Changes remain on this Tech Pack page</small>
        {draftMode&&onEmbed&&!readOnly?<button type="button" className="tpts-done" onClick={embed}><Check size={14}/> Place on page</button>
          :<button type="button" className="tpts-done" onClick={onClose}><Check size={14}/> Done</button>}
      </footer>
    </section>
  </div>
}

export {TechPackTableStudio20261030}
