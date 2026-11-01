import React,{useEffect,useMemo,useState} from 'react'
import {ChevronDown,ChevronRight,Folder,Layers,Plus,Save,Search,Trash2,Table2,Square,LayoutTemplate} from 'lucide-react'
import LibraryAssetHover from './LibraryAssetHover.jsx'
import TechPackTemplatePreview from './TechPackTemplatePreview.jsx'
import TechPackMiddleTemplatePreview from './TechPackMiddleTemplatePreview20261031.jsx'
import {TECHPACK_MIDDLE_TEMPLATES} from '../core/techPackMiddleTemplates20261031.js'
import {loadTechPackUserPresets,saveTechPackUserPreset,deleteTechPackUserPreset} from '../core/techPackTemplatePresets.js'
import {getNewTechPackTemplates} from '../core/techPackPageTemplates20261031.js'
import {TECHPACK_OBJECT_TEMPLATES} from '../core/techPackObjectTemplateCatalog20261031.js'
import {captureTechPackPageLayout} from '../core/techPackPageComposer.js'
import {FRAMED_HEADER_PRESETS,FRAMED_TABLE_GALLERY} from '../core/techPackVisualThemes20261031.js'
import {techPackPageLayout} from '../core/techPackPageLayout.js'
import './TechPackTemplateLibrary.css'

const FOLDERS=[
  {id:'packs',name:'Full techpacks',sub:'Production page sequences with real deliverable requirements'},
  {id:'pages',name:'Page templates',sub:'Individual production spec and pattern pages'},
  {id:'headers',name:'Header templates',sub:'Change the title block only'},
  {id:'middle',name:'Middle layouts',sub:'Swatches, reference photos and numbered drawing callouts'},
  {id:'boxes',name:'Objects & frames',sub:'Real photo, flat, fabric, color and fine-line objects'},
  {id:'tables',name:'Table templates',sub:'Insert preformatted specification tables'},
  {id:'custom',name:'Saved presets',sub:'Your reusable layouts'},
]
const MINIMAL_FRAME_PRESET=Object.freeze({id:'mikristian-minimal-frame',kind:'minimal-frame-page',category:'pages',name:'Blank framed sheet · Mikristian-inspired',description:'Letter-sized ruled sheet with empty drawing space and optional specification area'})
const itemsFor=(id,custom)=>id==='headers'?FRAMED_HEADER_PRESETS.map(item=>({...item,kind:'framed-header-variant',category:'headers',description:item.description})):
  id==='packs'?getNewTechPackTemplates('packs'):
  id==='middle'?TECHPACK_MIDDLE_TEMPLATES.map(item=>({...item,kind:'middle-page',category:'middle'})):
  id==='boxes'?TECHPACK_OBJECT_TEMPLATES:id==='tables'?FRAMED_TABLE_GALLERY.map(item=>({...item,kind:'canonical-gallery-table',category:'tables',description:item.description})):id==='custom'?custom.filter(item=>['page-layout','pack-layout'].includes(item.kind)):id==='pages'?[MINIMAL_FRAME_PRESET,...getNewTechPackTemplates('pages')]:[]

export default function TechPackTemplateLibrary({workspace={},page,onApply,onNavigate,onInsertBox=()=>{},onInsertTable=()=>{},onApplyFramedHeader=()=>{},onApplyMiddleTemplate=()=>{},onCreatePage=()=>{},onCreatePack=()=>{},onCreateProductionPage=()=>{},onCreateProductionPack=()=>{},onCreateNikeDemo,onRestyle=()=>{},onCreateMinimalFrame=()=>{},onRestyleMinimalFrame,onRestoreOriginalPages=()=>{}}){
  const currentPaper=techPackPageLayout(workspace,page)
  const currentBottomTop=Math.min(currentPaper.orientation==='landscape'?455:591,...(workspace.pageBoxes?.[page]||[])
    .filter(box=>box.slot?.templateRole==='bottom-table').map(box=>Number(box.y)||591))
  const [folder,setFolder]=useState('pages')
  const [custom,setCustom]=useState(loadTechPackUserPresets)
  useEffect(()=>{const reload=()=>setCustom(loadTechPackUserPresets());window.addEventListener('exo-techpack-user-templates-changed',reload);window.addEventListener('storage',reload);return ()=>{window.removeEventListener('exo-techpack-user-templates-changed',reload);window.removeEventListener('storage',reload)}},[])
  const [search,setSearch]=useState('')
  const [builderOpen,setBuilderOpen]=useState(false)
  const [name,setName]=useState('My studio layout')
  const [notice,setNotice]=useState('')
  const saveCurrentArtboard=()=>{
    if(!name.trim()){setNotice('Name your blank artboard before saving.');return}
    if(!page){setNotice('Select an artboard to save its layout.');return}
    try{
      setCustom(saveTechPackUserPreset(captureTechPackPageLayout(workspace,page,name.trim(),{includeContent:false})))
      setFolder('custom')
      setNotice('Blank artboard saved. Frames, positions, table headers and styling are reusable; entered values are excluded.')
      window.dispatchEvent(new Event('exo-techpack-user-templates-changed'))
    }catch{setNotice('Could not save the artboard in local storage.')}
  }
  const apply=(preset,toPage)=>{
    onApply(preset,toPage)
    if(preset.pageId&&toPage)onNavigate(preset.pageId)
    setNotice(`${preset.name} applied ${toPage?'to the selected sheet':'across the document'}.`)
  }
  const insert=(item)=>{
    if(item.category==='boxes')onInsertBox(item)
    else onInsertTable(item)
    setNotice(`${item.name} inserted on the selected page.`)
  }
  const usePreset=item=>{
    if(item.kind==='minimal-frame-page')onCreateMinimalFrame(item)
    else if(item.kind==='middle-page')onApplyMiddleTemplate(item.id)
    else if(item.kind==='framed-header-variant')onApplyFramedHeader(item.id)
    else if(item.kind==='production-page-recipe')onCreateProductionPage(item)
    else if(item.kind==='production-pack-recipe')onCreateProductionPack(item)
    else if(item.category==='boxes'||item.category==='tables')insert(item)
    else if(item.kind==='pack-layout')onCreatePack(item)
    else if(item.kind==='page-layout')onCreatePage(item)
    else apply(item,['pages','interactive'].includes(item.category)?item.pageId||page:page)
  }
  const startDrag=(event,item)=>{
    const payload={...item,id:item.id,category:item.category,pageId:item.pageId||null,name:item.name}
    const json=JSON.stringify(payload)
    event.dataTransfer.setData('application/x-exo-techpack-template',json)
    event.dataTransfer.setData('text/plain',json)
    event.dataTransfer.effectAllowed='copy'
  }
  const list=useMemo(()=>itemsFor(folder,custom).filter(item=>(item.name+' '+(item.description||'')+' '+(item.pageId||'')).toLowerCase().includes(search.toLowerCase().trim())),[folder,custom,search])
  const visibleList=list
  return <div className="tpws-template-library" aria-label="Techpack templates and layout builder">
    <header className="tpws-template-library-title"><Layers size={16}/><div><strong>TEMPLATE LIBRARY</strong><small>EXO / REUSABLE SHEETS & COMPONENTS</small></div></header>
    <label className="tpws-template-search"><Search size={14}/><input aria-label="Search Techpack templates" placeholder="Search pages, headers, tables..." value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" onClick={()=>setSearch('')} aria-label="Clear template search">×</button>}</label>
    <nav className="tpws-template-folders" aria-label="Techpack template folders">
      {FOLDERS.map(item=><button type="button" key={item.id} className={folder===item.id?'active':''} aria-current={folder===item.id?'page':undefined} aria-label={`Open ${item.name} templates`} onClick={()=>setFolder(item.id)}>
        {item.id==='boxes'?<Square size={15}/>:item.id==='tables'?<Table2 size={15}/>:item.id==='headers'?<LayoutTemplate size={15}/>:<Folder size={15}/>}<span>{item.name}</span><small>{itemsFor(item.id,custom).length}</small>
      </button>)}
    </nav>
    <div className="tpws-template-collection">
      <div className="tpws-template-collection-heading"><strong>{FOLDERS.find(item=>item.id===folder)?.name}</strong><small>{FOLDERS.find(item=>item.id===folder)?.sub}</small><span>{list.length} {list.length===1?'PRESET':'PRESETS'}</span></div>
      {folder==='pages'&&<p className="tpws-template-page-note">Current connected media-object pages only. Add a blank framed sheet or a production worksheet; previous fixed-box page templates are no longer offered.</p>}
      {folder==='packs'&&<p className="tpws-template-page-note">Each complete pack contains an ordered, distinct set of production pages for its garment workflow. Choose a pack to create its pages, then populate the editable specifications and approvals.</p>}
      {folder==='packs'&&typeof onCreateNikeDemo==='function'&&<div className="tpws-template-demo"><strong>Graphic tee sample project</strong><p>Build Nike graphic tee demo Tech Pack using the saved EXO T-shirt garment. Includes illustrative sample data. Nike marks are third-party trademarks; confirm artwork rights before manufacture or distribution.</p><button type="button" onClick={onCreateNikeDemo}><Plus size={12}/> Build Nike graphic tee demo Tech Pack</button></div>}
      {folder==='headers'&&<p className="tpws-template-page-note">{FRAMED_HEADER_PRESETS.length} editable factory-style header compositions with different row proportions, merged heading bands and typography. Hover to preview.</p>}
      {folder==='middle'&&<p className="tpws-template-page-note">Place clean images, technical flats, color and fabric swatches. Empty placeholders accept project assets; filled media has its own editable transform bounds and appearance.</p>}
      {folder==='boxes'&&<p className="tpws-template-page-note">Only new unframed media, color, fabric, and note objects. The former bordered detail cards and placeholder frames are no longer available.</p>}
      {folder==='tables'&&<p className="tpws-template-page-note">The same table presets as Table Studio. Every cell, size, border and row is editable after insertion.</p>}
      <div className="tpws-template-card-grid">{visibleList.map(item=><LibraryAssetHover key={item.id} category="Techpack" id={item.id} title={item.name} description={item.description||item.detail||'Reusable document composition'}
        details={[["Type",FOLDERS.find(f=>f.id===folder)?.name],["Destination",item.pageId||'Selected page / complete pack'],["Paper",`${currentPaper.paperSize} · ${currentPaper.orientation}`]]}
        source="Visual template preview only. Factory measurements and source patterns are not replaced."
        preview={item.kind==='middle-page'?<TechPackMiddleTemplatePreview templateId={item.id} orientation={currentPaper.orientation} paperSize={currentPaper.paperSize} bottomTop={currentBottomTop}/>:<TechPackTemplatePreview preset={item}/>}>
        <article className={`tpws-template-card ${item.kind==='minimal-frame-page'?'tpws-template-card-featured':''}`} tabIndex={0} draggable={item.kind!=='minimal-frame-page'&&item.kind!=='middle-page'} onDragStart={event=>{if(item.kind!=='minimal-frame-page'&&item.kind!=='middle-page')startDrag(event,item)}} onDoubleClick={event=>{if(event.target.closest('button'))return;usePreset(item)}} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='Enter'){event.preventDefault();usePreset(item)}}} aria-label={`${item.name} template. Double click or press Enter to use.`} title="Double-click to use">
          {item.kind==='middle-page'?<TechPackMiddleTemplatePreview templateId={item.id} orientation={currentPaper.orientation} paperSize={currentPaper.paperSize} bottomTop={currentBottomTop}/>:<TechPackTemplatePreview preset={item} compact/>}
          <div className="tpws-template-card-copy"><strong>{item.name}</strong><small>{item.description||item.detail}</small></div>
          <div className="tpws-template-card-actions">
            {item.kind==='minimal-frame-page'?<><button type="button" onClick={()=>onCreateMinimalFrame(item)}><Plus size={12}/> Create framed artboard</button>{typeof onRestyleMinimalFrame==='function'&&<button type="button" onClick={()=>onRestyleMinimalFrame(item)}>Restyle active page</button>}</>:
              item.kind==='framed-header-variant'?<button type="button" onClick={()=>onApplyFramedHeader(item.id)}><LayoutTemplate size={12}/> Apply header</button>:
              item.kind==='middle-page'?<button type="button" onClick={()=>onApplyMiddleTemplate(item.id)}><Plus size={12}/> Place middle layout</button>:
              ['boxes','tables'].includes(folder)?<button type="button" onClick={()=>insert(item)}><Plus size={12}/> Insert {folder==='boxes'?'box':'table'}</button>:
              item.kind==='pack-layout'?<button type="button" title="Apply all page layouts and Excel schemas from this saved studio Techpack system to the current garment" onClick={()=>onCreatePack(item)}>Use complete system</button>:
              item.kind==='production-pack-recipe'?<button type="button" onClick={()=>onCreateProductionPack(item)}><Plus size={12}/> Create {item.pageRecipeIds.length} pages</button>:
              item.kind==='production-page-recipe'?<button type="button" onClick={()=>onCreateProductionPage(item)}><Plus size={12}/> Create production page</button>:
              item.kind==='page-layout'?<><button type="button" title="Create a completely new page from this saved design" onClick={()=>onCreatePage(item)}><Plus size={12}/> New artboard</button><button type="button" title="Retain all information and objects; only adopt this template's theme, paper and header" onClick={()=>onRestyle(item)}>Restyle only</button></>:
              folder==='pages'||folder==='interactive'?<button type="button" onClick={()=>apply(item,item.pageId||page)}>Use on {item.pageId||'page'}</button>:
              <><button type="button" onClick={()=>apply(item,page)}>This page</button><button type="button" className="tpws-apply-pack" onClick={()=>apply(item,null)}>Whole pack</button></>}
            {folder==='custom'&&<button type="button" title={`Delete ${item.name}`} aria-label={`Delete template ${item.name}`} onClick={()=>{setCustom(deleteTechPackUserPreset(item.id));setNotice('Saved template removed.')}}><Trash2 size={12}/></button>}
          </div>
        </article>
      </LibraryAssetHover>)}
      </div>
      {list.length===0&&<p className="tpws-template-empty">No templates match your search in this folder.</p>}
    </div>
    <section className="tpws-template-builder" aria-label="Create custom techpack template">
      <button type="button" className="tpws-template-builder-toggle" aria-expanded={builderOpen} onClick={()=>setBuilderOpen(open=>!open)}><Plus size={14}/><strong>CREATE YOUR OWN TEMPLATE</strong>{builderOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>}</button>
      {builderOpen&&<div className="tpws-template-builder-body">
        <label>Preset name<input aria-label="Custom template name" maxLength={70} value={name} onChange={e=>setName(e.target.value)}/></label>
        <p className="tpws-template-page-note">Save the current editable artboard as a reusable object-based layout. Photos, color swatches, fabric and table positions are kept; document-specific values are omitted.</p>
        <div className="tpws-template-builder-actions"><button type="button" className="tpws-template-save" onClick={saveCurrentArtboard}><LayoutTemplate size={13}/> Save current artboard as template</button></div>
      </div>}
      {notice&&<p className="tpws-template-notice" role="status">{notice}</p>}
      <p className="tpws-template-helper">Use new object-based production pages and media components. Double-click a saved artboard to reuse its geometry; source garment values and artwork remain independently editable.</p>
    </section>
  </div>
}
