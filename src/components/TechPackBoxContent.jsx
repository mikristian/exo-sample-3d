import React, {useMemo,useRef,useState} from 'react'
import {ImagePlus, Pencil, Trash2, X, Maximize2} from 'lucide-react'
import TechPackSpreadsheetBlock from './techpack-spreadsheet/TechPackSpreadsheetBlock.jsx'
import {createTableV3} from '../core/techpack-spreadsheet/schemaV3.js'
import {toGridTable,normalizeTableStyle,TABLE_THEMES} from '../core/techpack-spreadsheet/tableAdapter.js'
import {evaluateTableFormulas} from '../core/techpack-spreadsheet/formulas.js'
import {mergeLookup} from '../core/techpack-spreadsheet/mergedCells20261030.js'
import {resolveTechPackArtworkSource20261031} from '../core/techPackArtworkPresentation20261031.js'
import './TechPackBoxContent.css'

/**
 * Editable content inside a positioned Techpack page box.
 * box: {id,title,note,slot?:{category,id,title,headers,rows,header},assetId?}.
 * layoutMode: true disables all content editing for the outer transform overlay.
 * assets: [{id,name?,caption?,_src?,dataUrl?,url?}].
 * onEdit(patch): persist a shallow box patch (including updated slot).
 * onDelete(): remove this box; onAssetPick(): open the workspace asset picker.
 * onApplyTemplate(preset): apply a dropped EXO template to this box.
 * The parent owns state and persistence; this component never renders arbitrary HTML.
 */
export const safeBoxImageSrc=src=>typeof src==='string'&&(
  (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src)&&src.length<400000)||
  (/^data:image\/svg\+xml(?:;charset=[\w-]+)?,%3Csvg/i.test(src)&&src.length<500000)
) ? src : ''

export const boxAssetInfo=(box,assets)=>{
  const selected=Array.isArray(assets)?assets.find(asset=>String(asset.id)===String(box?.assetId)):null
  // An unlinked URL must never render as a reference after a linked photo is cleared.
  const imageSource=selected?(selected._src||selected.dataUrl||selected.url):box?.assetId?'':box?.assetSrc
  return {selected,safeSrc:safeBoxImageSrc(imageSource),source:selected?selected._source||'library':'',category:selected?selected.category||'reference':''}
}

/** Resolve drag data solely to an asset already registered in this document. */
export const droppedBoxAssetId=(transfer,assets)=>{
  if(!transfer||!Array.isArray(assets))return null
  const types=Array.from(transfer.types||[])
  if(types.includes('application/x-exo-techpack-template'))return null
  for(const type of ['application/x-exo-techpack-asset','application/x-exo-asset','text/plain']){
    if(!types.includes(type))continue
    const raw=transfer.getData(type)
    if(typeof raw!=='string'||!raw||raw.length>4096)continue
    let candidate=raw
    if(raw.trim().startsWith('{')){
      try{const parsed=JSON.parse(raw);candidate=parsed?.assetId??parsed?.id??''}catch{continue}
    }
    if(typeof candidate!=='string'&&typeof candidate!=='number')continue
    const id=String(candidate)
    if(assets.some(asset=>asset&&String(asset.id)===id))return id
  }
  return null
}

const safeColor=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:undefined
/** Read-only page preview uses the same formula engine and formatting contract as the editor. */
export const spreadsheetBoxPreview=table=>{
  const grid=toGridTable(table)
  let mergeRegions
  try{mergeRegions=mergeLookup(grid)}
  catch{mergeRegions={anchors:new Map(),covered:new Map()}}
  const evaluation=evaluateTableFormulas(table)
  const theme=normalizeTableStyle(grid.tableStyle)
  const palette={...(TABLE_THEMES[theme.theme]||TABLE_THEMES.light),...Object.fromEntries(Object.entries(theme).filter(([key,value])=>key!=='theme'&&value))}
  return {
    theme:theme.theme,palette,
    columns:grid.headers.map((label,index)=>({label,width:Math.min(700,Math.max(table?.kind==='framed-header'?24:76,Number(grid.columnWidths?.[index])||160))})),
    rows:grid.rows.map((row,r)=>({id:row.id||`row-${r}`,height:Number(row.height)||0,cells:grid.headers.map((_,c)=>{
      const result=evaluation.getCell(r,c)
      const rawCell=table?.columns?.[c]?.id?table.rows?.[r]?.cells?.[table.columns[c].id]:null
      const source=rawCell&&typeof rawCell==='object'?rawCell:null
      const status=source?.override||source?.provenance?.kind==='override'?'Override · review required':
        source?.origin==='native'||source?.sourceRef||source?.provenance?.kind==='source'?'Source linked':''
      const style=grid.cellStyles?.[`${row.id||`row-${r}`}:${c}`]||{}
      const position=String(r)+':'+String(c)
      return {value:String(result?.error||(result?.value??'')),error:result?.error||'',status,
        merge:mergeRegions.anchors.get(position)||null,
        covered:mergeRegions.covered.has(position),
        style:{fontWeight:style.bold?'bold':undefined,fontStyle:style.italic?'italic':undefined,
          textDecoration:style.underline?'underline':undefined,
          fontFamily:['Arial','Helvetica','Georgia','Times New Roman','Courier New','Verdana','Trebuchet MS','Impact'].includes(style.fontFamily)?style.fontFamily:undefined,
          fontSize:Number.isFinite(style.fontSize)&&style.fontSize>=6&&style.fontSize<=72?style.fontSize:undefined,
          letterSpacing:Number.isFinite(style.letterSpacing)&&style.letterSpacing>=-3&&style.letterSpacing<=10?style.letterSpacing:undefined,
          lineHeight:Number.isFinite(style.lineHeight)&&style.lineHeight>=.8&&style.lineHeight<=2.5?style.lineHeight:undefined,
          textAlign:['left','center','right'].includes(style.align)?style.align:undefined,
          color:safeColor(style.color),background:safeColor(style.background)}}
    })}))
  }
}

/** Column widths are edited in pixels in Table Studio, but an embedded chart
 * is responsive artwork. A fixed <col> pixel sum wider than its box clips
 * the last header fields, even when the table itself says width:100%. */
export function fittedEmbeddedColumnWidths(columns=[]){
  if(!Array.isArray(columns)||!columns.length)return []
  const widths=columns.map(column=>Math.max(1,Number(column?.width)||1))
  const total=widths.reduce((sum,width)=>sum+width,0)
  return widths.map(width=>`${width/total*100}%`)
}

const sourceAttached=value=>Boolean(value&&(value.sourceLinked===true||value.sourceRef!=null||value.origin==='native'||value.origin==='source'||value.override===true||value.provenance?.linked===true||['source','override'].includes(value.provenance?.kind)))
/** A source-bound table is edited in Studio, where overrides receive review metadata. */
export const canInlineEditSpreadsheet=(table,slot={})=>Boolean(table&&Array.isArray(table.columns)&&Array.isArray(table.rows)&&
  !sourceAttached(slot)&&!sourceAttached(table)&&!table.rows.some(row=>sourceAttached(row)||
    Object.values(row.cells||{}).some(sourceAttached))&&!table.columns.some(sourceAttached))

/** Immutable, exact-coordinate edit. Returns null when the target is guarded or invalid. */
export const patchInlineSpreadsheet=(table,kind,rowIndex,columnIndex,value,slot={})=>{
  if(!canInlineEditSpreadsheet(table,slot)||!Number.isInteger(columnIndex)||columnIndex<0||columnIndex>=table.columns.length)return null
  const column=table.columns[columnIndex]
  if(!column||typeof column.id!=='string'||!column.id)return null
  const text=String(value??'')
  if(kind==='header'){
    if(rowIndex!==-1)return null
    return {...table,columns:table.columns.map((entry,index)=>index===columnIndex?{...entry,label:text}:entry)}
  }
  if(kind!=='cell'||!Number.isInteger(rowIndex)||rowIndex<0||rowIndex>=table.rows.length)return null
  let covered
  try{covered=mergeLookup(toGridTable(table)).covered}
  catch{return null}
  if(covered.has(`${rowIndex}:${columnIndex}`))return null
  const row=table.rows[rowIndex]
  const original=row?.cells?.[column.id]
  if(!row||!original||typeof original!=='object'||Array.isArray(original))return null
  return {...table,rows:table.rows.map((entry,index)=>index===rowIndex?{
    ...entry,cells:{...entry.cells,[column.id]:{...original,input:text,value:text,origin:'authored',
      provenance:original.provenance||{kind:'authored'}}}
  }:entry)}
}

export default function TechPackBoxContent({box={},layoutMode=false,readOnly=false,assets=[],sourceFabrics=[],colorways=[],onEdit=()=>{},onDelete=()=>{},onApplyTemplate=()=>{},onAssetPick=()=>{},onTableSelection=()=>{},onTextSelect=()=>{},onOpenTableStudio=()=>{},externalTableTools=false}){
  const id=box.id
  const editable=!layoutMode&&!readOnly
  const slot=box.slot&&typeof box.slot==='object'?box.slot:{}
  const patch=change=>{if(editable)onEdit(change)}
  const patchSlot=change=>patch({slot:{...slot,...change}})
  const kind=slot.category==='tables'?'table':slot.category==='headers'?'header':
    slot.contentType==='swatch'?'swatch':slot.contentType==='photo'?'asset':
    ['pages','packs','garments','custom','themes','interactive'].includes(slot.category)?'module':
    box.templateType||box.contentType||((Array.isArray(slot.headers)&&slot.headers.length)||(Array.isArray(box.headers)&&box.headers.length)?'table':box.headerStyle?'header':box.assetId||box.assetSrc?'asset':'note')
  const headers=Array.isArray(slot.headers)?slot.headers.map(String).slice(0,12):Array.isArray(box.headers)?box.headers.map(String).slice(0,12):[]
  const rows=Array.isArray(slot.rows)?slot.rows.slice(0,40):Array.isArray(box.rows)?box.rows.slice(0,40):[]
  const typedSpreadsheet=useMemo(()=>slot.spreadsheetTable||createTableV3({
    id:slot.id||`box-grid-${id}`,title:slot.title||box.title||'Specification table',
    pageId:'',boxId:id,origin:'authored',
    columns:headers.map((label,i)=>({id:`col-${i}`,label,type:'text'})),
    rows:rows.map((row,i)=>({id:row.id||`row-${i}`,cells:headers.map((_,j)=>String(row?.cells?.[j]??''))}))
  }),[slot.spreadsheetTable,slot.id,slot.title,box.title,id,slot.headers,slot.rows,box.headers,box.rows])
  // The artboard is a print-accurate table object, never a miniature editor.
  // All table chrome lives in the nonmodal Table Studio and inspector.
  const preview=useMemo(()=>kind==='table'?spreadsheetBoxPreview(typedSpreadsheet):null,[kind,typedSpreadsheet])
  const fittedColumns=useMemo(()=>preview?fittedEmbeddedColumnWidths(preview.columns):[],[preview])
  const framedHeader=kind==='table'&&typedSpreadsheet.kind==='framed-header'
  const [inlineEdit,setInlineEdit]=useState(null)
  const inlineInput=useRef(null)
  const inlineGuard=kind==='table'&&canInlineEditSpreadsheet(typedSpreadsheet,slot)
  const openInline=(kind,row,column)=>{
    if(!editable)return
    onTextSelect({kind,row,column})
    if(!inlineGuard){onOpenTableStudio();return}
    const current=kind==='header'?typedSpreadsheet.columns?.[column]?.label:
      typedSpreadsheet.rows?.[row]?.cells?.[typedSpreadsheet.columns?.[column]?.id]?.input
    if(current==null)return
    setInlineEdit({kind,row,column,value:String(current)})
  }
  const notifyTextSelection=(event,kind,row,column)=>{
    if(!editable)return
    const selection=event.currentTarget.ownerDocument?.defaultView?.getSelection?.()
    if(selection&&!selection.isCollapsed&&event.currentTarget.contains(selection.anchorNode)&&event.currentTarget.contains(selection.focusNode)){
      onTextSelect({kind,row,column})
    }
  }
  const commitInline=(next=null)=>{
    if(!inlineEdit)return
    const {kind,row,column,value}=inlineEdit
    const result=patchInlineSpreadsheet(typedSpreadsheet,kind,row,column,value,slot)
    setInlineEdit(null)
    if(result&&value!==String(kind==='header'?typedSpreadsheet.columns[column]?.label??'':
      typedSpreadsheet.rows[row]?.cells?.[typedSpreadsheet.columns[column]?.id]?.input??'')){
      onEdit({slot:{...slot,spreadsheetTable:result}})
    }
    if(next){
      const columnCount=typedSpreadsheet.columns.length
      const total=columnCount*(typedSpreadsheet.rows.length+1)
      const position=(kind==='header'?0:row+1)*columnCount+column+1
      const target=position<total?position:0
      const targetRow=Math.floor(target/columnCount)-1
      // Transfer the edit session to the next visible coordinate.
      setInlineEdit({kind:targetRow<0?'header':'cell',row:targetRow,column:target%columnCount,
        value:String(targetRow<0?result?.columns?.[target%columnCount]?.label??typedSpreadsheet.columns[target%columnCount]?.label??'':
          result?.rows?.[targetRow]?.cells?.[typedSpreadsheet.columns[target%columnCount]?.id]?.input??typedSpreadsheet.rows[targetRow]?.cells?.[typedSpreadsheet.columns[target%columnCount]?.id]?.input??'')})
    }
  }
  const editorFor=(kind,row,column,label)=>inlineEdit?.kind===kind&&inlineEdit?.row===row&&inlineEdit?.column===column?
    <input key={`${kind}-${row}-${column}`} ref={element=>{inlineInput.current=element;if(element&&document.activeElement!==element){
      element.focus({preventScroll:true})
      // WebKit focuses a controlled input at the END by default. For longer
      // labels this scrolls the text left and looks like the grid has moved.
      element.setSelectionRange?.(0,0)
      element.scrollLeft=0
    }}}
      className="tpbc-inline-input" aria-label={`Edit ${label}`} value={inlineEdit.value}
      onChange={event=>setInlineEdit(current=>current?{...current,value:event.target.value}:current)}
      onClick={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()}
      onKeyDown={event=>{event.stopPropagation();if(event.key==='Enter'||event.key==='Tab'){
        event.preventDefault();commitInline(event.key==='Tab')
      }else if(event.key==='Escape'){event.preventDefault();setInlineEdit(null)}}}
      onBlur={event=>{if(event.currentTarget.isConnected)commitInline()}}/>:null
  const {selected,safeSrc:originalSrc,source,category}=boxAssetInfo(box,assets)
  const safeSrc=useMemo(()=>safeBoxImageSrc(slot.rasterRecoloredDataUrl||
    resolveTechPackArtworkSource20261031(originalSrc,slot,selected)),
    [originalSrc,selected?.category,slot.rasterRecoloredDataUrl,slot.vectorFillMode,slot.vectorFill,slot.vectorStrokeMode,slot.vectorStroke,slot.vectorStrokeWidth,slot.vectorRemoveWhite,slot.vectorTrimToArtwork])
  const hasAsset=Boolean(box.assetId||box.assetSrc)
  // Once a semantic slot is populated, the artboard owns only its artwork.
  // Titles, picker controls and notes live in the inspector rather than
  // expanding the selected rectangle around a much smaller image.
  const pureMedia=(kind!=='table'&&kind!=='header'&&Boolean(safeSrc))||
    (kind==='swatch'&&Boolean(slot.swatchHex||slot.linkedFabricId||slot.linkedColorwayId))
  const linkedFabric=(Array.isArray(sourceFabrics)?sourceFabrics:[]).find(item=>String(item.id)===String(slot.linkedFabricId))
  const linkedColorway=(Array.isArray(colorways)?colorways:[]).find(item=>String(item.id)===String(slot.linkedColorwayId))
  const swatchLabel=slot.swatchLabelEdited?slot.swatchLabel:String(linkedFabric?.name||linkedColorway?.name||slot.swatchLabel||'Assign color or fabric')
  const linkedHex=String(linkedColorway?.hex||linkedFabric?.color||'')
  const swatchHex=slot.swatchOverride?slot.swatchHex:/^#[0-9a-f]{6}$/i.test(linkedHex)?linkedHex:slot.swatchHex
  const clearImage=()=>patch({assetId:null,assetSrc:null})
  const stopLayoutKeys=event=>{
    // Keep ordinary text editing and grid navigation inside the active control.
    // The spreadsheet owns its keyboard behavior and must continue receiving it.
    if(event.target.closest?.('input,textarea,button')&&!event.target.closest?.('.tps'))event.stopPropagation()
  }
  const updateCell=(index,column,value)=>patchSlot({rows:rows.map((row,i)=>i===index?{...(typeof row==='object'&&row?row:{}),id:row?.id||`row-${i}`,cells:headers.map((_,j)=>j===column?value:String(row?.cells?.[j]||''))}:row)})
  const normalizedRow=row=>headers.map((_,i)=>String(row?.cells?.[i]||''))
  const addRow=()=>{if(rows.length<40)patchSlot({rows:[...rows,{id:`row-${Date.now()}-${rows.length}`,cells:headers.map(()=>'')}]})}
  const removeRow=index=>patchSlot({rows:rows.filter((_,i)=>i!==index)})
  const addColumn=()=>{if(headers.length<12)patchSlot({headers:[...headers,`COLUMN ${headers.length+1}`],rows:rows.map(row=>({...row,cells:[...normalizedRow(row),'']}))})}
  const removeColumn=index=>{if(headers.length<=1)return;patchSlot({headers:headers.filter((_,i)=>i!==index),rows:rows.map(row=>({...row,cells:normalizedRow(row).filter((_,i)=>i!==index)}))})}
  const onDragOver=event=>{
    if(!editable)return
    const types=Array.from(event.dataTransfer?.types||[])
    if(types.includes('application/x-exo-techpack-template')||
      ((kind==='asset'||hasAsset||slot.templateRole==='reference')&&
       ['application/x-exo-techpack-asset','application/x-exo-asset','text/plain'].some(type=>types.includes(type)))){
      event.preventDefault();event.dataTransfer.dropEffect='copy'
    }
  }
  const onDrop=event=>{
    if(!editable)return
    if(kind==='asset'||hasAsset||slot.templateRole==='reference'){
      const assetId=droppedBoxAssetId(event.dataTransfer,assets)
      if(assetId){event.preventDefault();event.stopPropagation();patch({assetId,assetSrc:null});return}
    }
    const raw=event.dataTransfer?.getData('application/x-exo-techpack-template')
    if(!raw)return
    event.preventDefault();event.stopPropagation()
    try{const preset=JSON.parse(raw);if(preset&&typeof preset==='object'&&!Array.isArray(preset)&&['boxes','tables','headers'].includes(preset.category))onApplyTemplate(preset)}catch{/* Ignore malformed external drag data. */}
  }
  // Do not stop events in the capture phase: that also prevents the nested
  // spreadsheet cell editor from receiving Enter, Escape, Tab and letter keys.
  // TechPackSpreadsheetBlock handles its own keystrokes and stops bubbling to
  // global layout shortcuts at its grid boundary.
  return <section className={`tpbc tpbc-${kind} ${pureMedia?'tpbc-pure-media':''} ${layoutMode?'tpbc-layout':'tpbc-content'}`} aria-label={`Techpack detail box ${box.title||'Untitled'}`}
    onContextMenu={event=>{if(kind==='table'){event.preventDefault();event.stopPropagation();onOpenTableStudio()}}}
    onDragOver={onDragOver} onDrop={onDrop} onKeyDown={stopLayoutKeys}>
    {kind!=='table'&&!pureMedia&&<div className="tpbc-topline">
      {editable?<input className="tpbc-title" aria-label="Box title" maxLength={80} value={box.title||''} placeholder="DETAIL TITLE" onChange={event=>patch({title:event.target.value})}/>:<strong className="tpbc-title">{box.title||'DETAIL TITLE'}</strong>}
      {kind==='table'&&<button className="tpbc-icon-button tpbc-expand-table" type="button" aria-label={`Open table pop-up editor for ${box.title||'Table'}`} title="Edit this table in the compact GridCraft-style pop-up"
        onClick={event=>{event.stopPropagation();onOpenTableStudio()}}><Maximize2 size={14}/></button>}
      {editable&&<button className="tpbc-icon-button" type="button" aria-label={`Delete box ${box.title||''}`} title="Delete box" onClick={()=>onDelete()}><Trash2 size={13}/></button>}
    </div>}
    {kind==='header'&&<div className={`tpbc-header-panel tpbc-header-${/^[a-z0-9-]{1,32}$/i.test(slot.header||box.headerStyle||'')?slot.header||box.headerStyle:'technical'}`}>
      <small>TECHNICAL DOCUMENT / {slot.header||box.headerStyle||'HEADER'}</small>
      <strong>{slot.title||box.headerText||box.title||'GARMENT SPECIFICATION'}</strong>
      {editable&&<input aria-label="Header headline" maxLength={100} value={slot.title||''} placeholder="Header headline" onChange={event=>patchSlot({title:event.target.value})}/>}
      <span>STYLE / DEVELOPMENT / REVISION</span>
    </div>}
    {kind==='module'&&!pureMedia&&<div className="tpbc-template-module" aria-label="Inserted editable page template module">
      <small>{String(slot.category||'page').toUpperCase()} / {String(slot.layout||'BALANCED').toUpperCase()}</small>
      <strong>{slot.title||slot.name||'CUSTOM LAYOUT'}</strong>
      <span>Editable detail region · Add notes, table elements or an image to this box</span>
    </div>}
    {kind==='table'&&
      <div className="tpbc-table-scroll" title={!layoutMode?'Click a cell to edit; right-click anywhere on the table to open Table Studio':'Select to transform; right-click for Table Studio'}>
        <table className={`tpbc-table ${framedHeader?'tpbc-reference-header-grid':''}`} data-reference-header={String(framedHeader)} aria-label={`${slot.title||box.title||'Techpack table'} embedded artwork`} style={{tableLayout:'fixed',width:'100%',maxWidth:'100%'}}><colgroup>{preview.columns.map((column,index)=><col key={index} style={{width:fittedColumns[index]}}/>)}</colgroup>{!framedHeader&&<thead><tr>{preview.columns.map((column,index)=><th key={index} onClick={event=>{event.stopPropagation();openInline('header',-1,index)}} onMouseUp={event=>notifyTextSelection(event,'header',-1,index)} style={{background:preview.palette.header,color:preview.palette.text}}>{editorFor('header',-1,index,`header ${index+1}`)||column.label}</th>)}</tr></thead>}<tbody>{preview.rows.map((row,index)=><tr key={row.id||index} style={row.height?{height:row.height}:undefined}>{row.cells.map((cell,j)=>cell.covered?null:
        <td key={j} colSpan={cell.merge?.colSpan||undefined} rowSpan={cell.merge?.rowSpan||undefined}
          className={cell.merge?'tpbc-merged-heading':undefined} onClick={event=>{event.stopPropagation();openInline('cell',index,j)}} onMouseUp={event=>notifyTextSelection(event,'cell',index,j)}
          title={[cell.status,cell.error,framedHeader?cell.value:''].filter(Boolean).join(' · ')||undefined} data-source-status={cell.status||undefined}
          style={{background:cell.merge?preview.palette.header:index%2?preview.palette.stripe:undefined,
            color:cell.merge?preview.palette.text:undefined,...cell.style}}>
          {editorFor('cell',index,j,`row ${index+1} column ${j+1}`)||cell.value}{cell.status&&<span aria-label={cell.status} style={{display:'block',fontSize:8,fontWeight:600,opacity:.8}}>{cell.status}</span>}
        </td>)}</tr>)}</tbody></table></div>}
    {kind==='swatch'&&<div className="tpbc-composed-swatch" aria-label={pureMedia?'Fabric or colorway swatch':'Fabric or colorway swatch placeholder'}>
      <div className="tpbc-composed-swatch-color" style={{background:/^#[0-9a-f]{6}$/i.test(swatchHex||'')?swatchHex:'#e6e9ed',
        boxSizing:'border-box',border:slot.swatchStrokeMode==='color'?`${Math.max(0,Math.min(24,Number(slot.swatchStrokeWidth??1)||0))}px solid ${/^#[a-f0-9]{6}$/i.test(slot.swatchStrokeHex||'')?slot.swatchStrokeHex:'#171717'}`:'none'}}>
        {safeSrc&&(slot.swatchDisplay==='photo'||(!slot.swatchDisplay&&!slot.swatchHex))&&<img src={safeSrc} alt={selected?.name||'Linked swatch'}/>}
      </div>
      {!pureMedia&&(editable?<input aria-label="Swatch label" value={swatchLabel} maxLength={80} onChange={event=>patchSlot({swatchLabel:event.target.value,swatchLabelEdited:true})}/>:<label>{swatchLabel}</label>)}
      {!pureMedia&&editable&&<input type="color" aria-label="Swatch color" value={/^#[0-9a-f]{6}$/i.test(swatchHex||'')?swatchHex:'#e6e9ed'} onChange={event=>patchSlot({swatchHex:event.target.value,swatchOverride:true})}/>}
      {!pureMedia&&editable&&<button type="button" onClick={onAssetPick}><ImagePlus size={12}/> Attach fabric image</button>}
      {!pureMedia&&box.note&&<small>{box.note}</small>}
    </div>}
    {kind==='asset'||hasAsset&&kind!=='swatch'?<figure className="tpbc-asset">
      <div className={`tpbc-photo-frame ${safeSrc?'tpbc-photo-filled':'tpbc-photo-empty'}`} onDoubleClick={event=>{if(!editable)return;event.stopPropagation();onAssetPick()}} title={editable?'Double-click to replace image':undefined}>
        {safeSrc?<img src={safeSrc} alt={selected?.caption||selected?.name||box.title||'Techpack reference'} draggable={false}
          style={{objectFit:slot.mediaFit==='cover'?'cover':'contain'}}/>:<div className="tpbc-empty-asset">{hasAsset?'Image preview unavailable':'No image selected'}</div>}
        {editable&&!safeSrc&&<button type="button" className="tpbc-photo-overlay" aria-label={hasAsset?'Replace selected image':'Choose image'} onClick={event=>{event.stopPropagation();onAssetPick()}}><Pencil size={13}/>{hasAsset?'Replace image':'Choose image'}</button>}
      </div>
      {selected&&!pureMedia&&<figcaption className="tpbc-asset-caption"><span>{selected.caption||selected.name||'Selected reference'}</span><span className="tpbc-asset-origin">{category} · {source}</span></figcaption>}
      {box.assetId&&!selected&&<figcaption className="tpbc-asset-missing">Linked asset is unavailable · {String(box.assetId).slice(0,45)}</figcaption>}
    </figure>:null}
    {editable&&!safeSrc&&!pureMedia&&(kind==='asset'||kind==='note'||kind==='header'||kind==='module'||hasAsset)&&<div className="tpbc-photo-actions">
      <button type="button" className="tpbc-asset-picker" onClick={event=>{event.stopPropagation();onAssetPick()}}><ImagePlus size={12}/> {hasAsset?'Replace photo':'Insert photo'}</button>
      {hasAsset&&<button type="button" className="tpbc-clear-photo" aria-label="Clear box photo" title="Remove photo from this box, keep text and layout" onClick={event=>{event.stopPropagation();clearImage()}}><X size={12}/> Clear</button>}
    </div>}
    {kind!=='table'&&kind!=='swatch'&&!pureMedia&&(editable?<textarea className="tpbc-note" aria-label={`Notes for ${box.title||'box'}`} placeholder="Add garment details or factory instructions…" maxLength={1200} value={box.note||''} onChange={event=>patch({note:event.target.value})}/>:box.note?<p className="tpbc-note-readonly">{box.note}</p>:null)}
  </section>
}
