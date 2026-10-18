import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { STUDIO_TOOL_CATALOG } from '../core/studioCustomization.js';
import * as studioCatalog from '../core/studioCustomization.js';
import {STUDIO_THEME_PRESETS,STUDIO_PANEL_FINISHES,studioResolvedPalette} from '../core/studioThemePresets.js';
import {EXO_LEFT_EXTRA_TOOLS,EXO_RIGHT_EXTRA_TOOLS} from '../core/exoExtraToolCatalog.js';
import {OPEN_SOURCE_PATTERN_SOURCES, PATTERN_TOOL_CATEGORIES, filterOpenSourcePatternTools} from '../core/openSourcePatternToolCatalog.js';
import {CLO7_3D_A,CLO7_3D_B,CLO7_2D_A,CLO7_2D_B} from '../data/clo7ToolbarOrder.js';
import CadToolIcon from './CadToolIcon.jsx';
import {CLO_SETTINGS_NAV,CloSettingsPages} from './CloSettingsPages.jsx';
import './StudioSettingsDialog.css';
import './StudioToolIndexGrid.css';

const SECTIONS = [ ['workspace','Workspace'], ['toolIndex','Tool Index'], ['theme','Theme'], ['environment','Environment'], ['profile','Profile'], ['preferences','Preferences'], ['filesApi','Files & API'], ['plugins','Plugins'] ];
const toolCatalog = Array.isArray(STUDIO_TOOL_CATALOG) ? STUDIO_TOOL_CATALOG : Object.entries(STUDIO_TOOL_CATALOG || {}).map(([id, tool]) => ({ id, ...(typeof tool === 'object' ? tool : { label: tool }) }));
const sideToolCatalog = Array.isArray(studioCatalog.STUDIO_SIDE_TOOL_CATALOG) ? studioCatalog.STUDIO_SIDE_TOOL_CATALOG : [];
const sideToolById = new Map(sideToolCatalog.map(tool => [tool.id, tool]));
const sideToolIds = new Set(sideToolById.keys());
const nativeIndexSections = [
  {side:'left',title:'3D CLO tools',kind:'native',tools:[...CLO7_3D_A.map(t=>({...t,id:`3d:${t.id}`,column:'A'})),...CLO7_3D_B.map(t=>({...t,id:`3d:${t.id}`,column:'B'}))]},
  {side:'right',title:'2D CLO tools',kind:'native',tools:[...CLO7_2D_A.map(t=>({...t,id:`2d:${t.id}`,column:'A'})),...CLO7_2D_B.map(t=>({...t,id:`2d:${t.id}`,column:'B'}))]},
];
const indexSections = [...nativeIndexSections,{side:'left',title:'3D EXO extra tools',kind:'extra',tools:EXO_LEFT_EXTRA_TOOLS},{side:'right',title:'2D EXO extra tools',kind:'extra',tools:EXO_RIGHT_EXTRA_TOOLS}];
const getToolId = (tool) => typeof tool === 'string' ? tool : tool.id;
const getToolLabel = (tool) => typeof tool === 'string' ? tool : tool.label || tool.name || tool.id;
const lookup = (value, section, key, fallback) => value?.[section]?.[key] ?? fallback;
const asArray = (value) => Array.isArray(value) ? value : [];
// Reopen safely when a saved window comes from a different monitor or a
// smaller macOS window. Do not leave its titlebar outside the usable screen.
const safeWindowGeometry = (input) => {
  const screenWidth = Math.max(320, window.innerWidth);
  const screenHeight = Math.max(340, window.innerHeight);
  const maxWidth = screenWidth < 520 ? screenWidth : screenWidth - 12;
  const maxHeight = screenHeight < 370 ? screenHeight : screenHeight - 12;
  const requestedWidth = Number(input.width) || 760;
  const requestedHeight = Number(input.height) || 590;
  // If a window was sized on a larger display, reopen as a useful floating
  // panel rather than stretching almost full-screen on the smaller display.
  const width = Math.min(Math.max(requestedWidth > maxWidth ? Math.min(1040,maxWidth) : requestedWidth, Math.min(480, screenWidth)), maxWidth);
  const height = Math.min(Math.max(requestedHeight > maxHeight ? Math.min(780,maxHeight) : requestedHeight, Math.min(340, screenHeight)), maxHeight);
  const availableX = Math.max(0,screenWidth-width);
  const availableY = Math.max(0,screenHeight-height);
  const originalX = Number(input.x) || 0;
  const originalY = Number(input.y) || 0;
  return {
    width, height,
    x: originalX > availableX+32 ? Math.round(availableX/2) : Math.max(0,Math.min(originalX,availableX)),
    y: originalY > availableY+32 ? Math.round(availableY/2) : Math.max(0,Math.min(originalY,availableY)),
  };
};

function Setting({ label, description, children }) {
  return <div className="studio-setting"><div className="studio-setting-copy"><strong>{label}</strong>{description && <small>{description}</small>}</div><div className="studio-setting-control">{children}</div></div>;
}
function Select({ value, options, onChange, label }) {
  return <select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>{options.map((option) => { const [id, title] = Array.isArray(option) ? option : [option, option]; return <option key={id} value={id}>{title}</option>; })}</select>;
}
function Color({ label, value, onChange }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#404650';
  return <div className="studio-color"><input type="color" aria-label={`${label} color picker`} value={safe} onChange={(e) => onChange(e.target.value)} /><input aria-label={`${label} hexadecimal color`} value={value ?? ''} onChange={(e) => onChange(e.target.value)} spellCheck={false} /></div>;
}

export default function StudioSettingsDialog({ value = {}, onChange = () => {}, onClose = () => {}, onApplyWorkspace, onSaveWorkspace, onRestoreWorkspace, onReset, onResetEnvironment, initialTab = 'workspace' }) {
  const [tab, setTab] = useState(initialTab==='appearance'?'theme':initialTab);
  const [search, setSearch] = useState('');
  const [themeSearch, setThemeSearch] = useState('');
  const [themeGroup, setThemeGroup] = useState('All');
  const [toolIndexSearch,setToolIndexSearch] = useState('');
  const [toolIndexSide,setToolIndexSide] = useState('all');
  const [toolIndexWorkspace,setToolIndexWorkspace] = useState(() => { try { return localStorage.getItem('exo.toolIndexWorkspace.v1') === 'pattern' ? 'pattern' : 'all'; } catch { return 'all'; } });
  const [toolIndexCategory,setToolIndexCategory] = useState('all');
  const [dragging, setDragging] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [confirmGlobalReset, setConfirmGlobalReset] = useState(false);
  const [geometry, setGeometry] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('exo.studioSettingsWindow.v1') || 'null'); if (saved && [saved.x,saved.y,saved.width,saved.height].every(Number.isFinite)) return safeWindowGeometry(saved); } catch {}
    return safeWindowGeometry({ x: Math.max(12, (window.innerWidth - 760) / 2), y: Math.max(12, (window.innerHeight - 590) / 2), width: 760, height: 590 });
  });
  const pointerSession = useRef(null);
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  const bounded = safeWindowGeometry;
  const startDrag = (event) => { if (event.button !== 0 || event.target.closest('button,input,select,textarea')) return; pointerSession.current = { x:event.clientX, y:event.clientY, geometry }; event.currentTarget.setPointerCapture(event.pointerId); };
  const dragWindow = (event) => { if (!pointerSession.current) return; const { x, y, geometry: start } = pointerSession.current; setGeometry(bounded({ ...start, x:start.x + event.clientX - x, y:start.y + event.clientY - y })); };
  const endDrag = () => { pointerSession.current = null; };
  useEffect(() => { try { localStorage.setItem('exo.studioSettingsWindow.v1', JSON.stringify(geometry)); } catch {} }, [geometry]);
  useEffect(() => { try { localStorage.setItem('exo.toolIndexWorkspace.v1', toolIndexWorkspace); } catch {} }, [toolIndexWorkspace]);
  useEffect(() => { const recalc = () => setGeometry((g) => bounded(g)); window.addEventListener('resize',recalc); return () => window.removeEventListener('resize',recalc); }, []);
  useEffect(() => { const node = dialogRef.current; if (!node || typeof ResizeObserver === 'undefined') return; const observer = new ResizeObserver(([entry]) => { const width = Math.round(entry.borderBoxSize?.[0]?.inlineSize || entry.contentRect.width); const height = Math.round(entry.borderBoxSize?.[0]?.blockSize || entry.contentRect.height); setGeometry((g) => Math.abs(g.width-width)>1 || Math.abs(g.height-height)>1 ? bounded({...g,width,height}) : g); }); observer.observe(node); return () => observer.disconnect(); }, []);
  const set = (section, key, next) => onChange({ ...value, [section]: { ...(value[section] || {}), [key]: next } });
  const restoreTheme = () => {
    const defaults=studioCatalog.DEFAULT_STUDIO_CUSTOMIZATION.appearance;
    const keys=['theme','panelFinish','liquidGlass','glassBackdrop','glassDensity','glassBlur','glassIconColor','glassLibrary','glassInspector','glassToolbars','glassMenu','glassWidgets','accent','sidebarColor','panelColor'];
    onChange({...value,appearance:{...value.appearance,...Object.fromEntries(keys.map(key=>[key,defaults[key]]))}});
  };
  const section = (name) => value[name] || {};
  const changeStudioBackground = (color) => onChange({...value,appearance:{...value.appearance,studioColor:color,backgroundMode:'color'}});
  const toolbar = asArray(lookup(value, 'workspace', 'toolbarIds', []));
  const toolbarIds = toolbar.map(getToolId);
  const sideToolbar = (side) => asArray(lookup(value,'workspace',`${side}ToolbarIds`,[])).filter(id=>sideToolIds.has(id) && id.startsWith(side === 'left' ? '3d:' : '2d:'));
  const editSideToolbar = (side,ids) => set('workspace',`${side}ToolbarIds`,[...new Set(ids.filter(id=>matchesSide(side,id)))]);
  const extraIds = side => asArray(lookup(value,'workspace',side==='left'?'extraLeftToolIds':'extraRightToolIds',[]));
  const editExtraIds = (side,ids) => {
    const allowed = new Set((side==='left'?EXO_LEFT_EXTRA_TOOLS:EXO_RIGHT_EXTRA_TOOLS).map(tool=>tool.id));
    set('workspace',side==='left'?'extraLeftToolIds':'extraRightToolIds',[...new Set(ids.filter(id=>allowed.has(id)))]);
  };
  const matchesSide = (side,id) => sideToolIds.has(id) && id.startsWith(side === 'left' ? '3d:' : '2d:');
  const catalog = toolCatalog.filter((tool) => tool?.id);
  const editToolbar = (ids) => set('workspace', 'toolbarIds', ids);
  const upload = (field, file) => {
    if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) { setUploadError('Please choose an image file.'); return; }
    if (file.size > 220000) { setUploadError('Choose an image smaller than 220 KB.'); return; }
    setUploadError('');
    const reader = new FileReader();
    reader.onerror = () => setUploadError('Unable to read this image.');
    reader.onload = () => { if (typeof reader.result === 'string') set('profile', field, reader.result); };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    previousFocus.current = document.activeElement;
    dialogRef.current?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previousFocus.current?.focus?.(); };
  }, []);

  const moveTool = (id, offset) => { const ids = [...toolbarIds]; const index = ids.indexOf(id); const target = index + offset; if (index < 0 || target < 0 || target >= ids.length) return; [ids[index], ids[target]] = [ids[target], ids[index]]; editToolbar(ids); };
  const available = catalog.filter((tool) => !toolbarIds.includes(tool.id) && `${getToolLabel(tool)} ${tool.group || ''}`.toLowerCase().includes(search.toLowerCase()));
  const livePalette=studioResolvedPalette(lookup(value,'appearance','theme','graphite'),lookup(value,'appearance','panelFinish','balanced'));

  return createPortal(<div className="studio-settings-overlay" data-testid="studio-settings-overlay" data-studio-settings-glass={lookup(value,'appearance','liquidGlass',false)?'true':'false'} style={{'--studio-accent':livePalette.accent,'--studio-glass-backdrop':lookup(value,'appearance','glassBackdrop','#253d57'),'--studio-panel':livePalette.panelColor,'--studio-sidebar':livePalette.sidebarColor,'--studio-text':livePalette.textColor,'--studio-muted':livePalette.mutedColor,'--studio-border':livePalette.borderColor}}>
    <div className="studio-settings-dialog" style={{left:geometry.x,top:geometry.y,width:geometry.width,height:geometry.height}} role="dialog" aria-modal="false" aria-labelledby={titleId} tabIndex={-1} ref={dialogRef} data-testid="studio-settings-dialog">
      <header className="studio-settings-header" onPointerDown={startDrag} onPointerMove={dragWindow} onPointerUp={endDrag} onPointerCancel={endDrag} data-testid="studio-settings-titlebar"><h2 id={titleId}>User Settings</h2><button type="button" className="studio-settings-close" onClick={onClose} aria-label="Close settings">×</button></header>
      <div className="studio-settings-layout"><nav className="studio-settings-nav" aria-label="Settings sections">{SECTIONS.map(([id, title]) => <button key={id} type="button" className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)} data-testid={`settings-tab-${id}`}>{title}</button>)}<div className="studio-settings-nav-heading">CLO Settings</div>{CLO_SETTINGS_NAV.map(([id,title])=><button key={id} type="button" className={tab===id?'active':''} aria-current={tab===id?'page':undefined} data-testid={`settings-tab-${id}`} onClick={()=>setTab(id)}>{title}</button>)}</nav>
      <main className="studio-settings-body" key={tab}>
        {CLO_SETTINGS_NAV.some(([id])=>id===tab)&&<CloSettingsPages tab={tab} value={value.cloSettings||{}} onChange={v=>{
          const preferences={...value.preferences};
          if(v.unitSystem!==value.cloSettings?.unitSystem)preferences.units=({Millimeter:'mm',Centimeter:'cm',Inch:'in'})[v.unitSystem]||'cm';
          if(v.antiAliasing!==value.cloSettings?.antiAliasing)preferences.antialias=v.antiAliasing!=='Off';
          onChange({...value,cloSettings:v,preferences});
        }} workspace={value.workspace||{}} onWorkspaceChange={(key,next,cloKey,cloValue)=>onChange({...value,workspace:{...value.workspace,[key]:next},cloSettings:{...value.cloSettings,[cloKey]:cloValue}})}/>} 
        {tab === 'workspace' && <><h3>Workspace</h3><p className="studio-settings-intro">Arrange the tools and panels you use every day.</p><div className="studio-settings-group"><h4>Layout</h4><Setting label="Workspace preset" description="Choose your starting arrangement."><Select label="Workspace preset" value={lookup(value,'workspace','viewportLayout','split')} onChange={(next) => set('workspace','viewportLayout',next)} options={[["split","Side by side"],["stack","Stacked"],["3d","3D only"],["2d","2D only"]]} /></Setting><Setting label="Custom toolbar dock" description="Choose where your optional custom toolbar appears."><Select label="Custom toolbar dock" value={lookup(value,'workspace','toolbarDock','left')} options={['left','right','top','bottom','floating']} onChange={(next) => set('workspace','toolbarDock',next)} /></Setting><div className="studio-settings-panel-grid">{[['toolbarVisible','Custom toolbar'],['toolbarCompact','Compact toolbar'],['topTabsVisible','Top tabs'],['objectBrowserVisible','Object Browser']].map(([key,label]) => <label key={key}><input type="checkbox" checked={!!lookup(value,'workspace',key,false)} onChange={(e) => set('workspace',key,e.target.checked)} />{label}</label>)}</div><Setting label="Panel ordering"><Select label="Panel ordering" value={lookup(value,'workspace','panelOrder','standard')} options={['standard','swapped']} onChange={(next) => set('workspace','panelOrder',next)} /></Setting>{[['libraryWidth','Library width',160,350],['inspectorWidth','Inspector width',295,540],['objectBrowserHeight','Object Browser height',230,650],['viewportSplit','Viewport split (%)',20,80]].map(([key,label,min,max]) => <Setting key={key} label={label}><div className="studio-range"><input type="range" aria-label={label} min={min} max={max} value={lookup(value,'workspace',key,min)} onChange={(e) => set('workspace',key,Number(e.target.value))} /><output>{lookup(value,'workspace',key,min)}</output></div></Setting>)}<div className="studio-settings-actions-inline"><button type="button" onClick={() => onApplyWorkspace?.(value)}>Apply layout</button><button type="button" onClick={() => onSaveWorkspace?.(value)}>Save workspace</button><button type="button" onClick={() => onRestoreWorkspace?.()}>Restore saved</button></div></div><div className="studio-settings-group"><h4>Custom toolbar</h4><p>Drag tools into your preferred order, or use the arrow buttons.</p><div className="studio-tool-list" aria-label="Current toolbar"
  onDragOver={event=>{if(event.dataTransfer.types.includes('text/plain'))event.preventDefault()}}
  onDrop={event=>{const raw=event.dataTransfer.getData('text/plain');if(!raw.startsWith('extra:'))return;event.preventDefault();const id=raw.slice(6);if(!catalog.some(tool=>tool.id===id)||toolbarIds.includes(id))return;onChange({...value,workspace:{...value.workspace,toolbarIds:[...toolbarIds,id],toolbarVisible:true}})}}>{toolbarIds.map((id, index) => <div key={`${id}-${index}`} className="studio-tool-item" draggable onDragStart={() => setDragging(id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!dragging || dragging === id) return; const ids = toolbarIds.filter((v) => v !== dragging); ids.splice(ids.indexOf(id), 0, dragging); editToolbar(ids); setDragging(null); }} onDragEnd={() => setDragging(null)}><span className="studio-tool-grip" aria-hidden="true">⠿</span><span>{getToolLabel(catalog.find((tool) => tool.id === id) || id)}</span><div className="studio-tool-buttons"><button type="button" disabled={index === 0} onClick={() => moveTool(id,-1)} aria-label={`Move ${id} up`}>↑</button><button type="button" disabled={index === toolbarIds.length - 1} onClick={() => moveTool(id,1)} aria-label={`Move ${id} down`}>↓</button><button type="button" onClick={() => editToolbar(toolbarIds.filter((v) => v !== id))} aria-label={`Remove ${id}`}>×</button></div></div>)}{!toolbarIds.length && <p>No tools selected. Add tools below.</p>}</div><label className="studio-settings-search-label" htmlFor="studio-settings-tool-search">Add tools</label><input id="studio-settings-tool-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tools…" /><div className="studio-tool-add-list">{available.map((tool) => <button type="button" key={tool.id} onClick={() => editToolbar([...toolbarIds,tool.id])}>+ {getToolLabel(tool)}</button>)}{!available.length && <small>No more matching tools</small>}</div></div></>}
        {tab === 'workspace' && <div className="studio-toolbar-edit-control">
          <button type="button" data-testid="toggle-toolbar-edit-mode" aria-pressed={!!lookup(value,'workspace','toolbarEditMode',false)}
            onClick={()=>set('workspace','toolbarEditMode',!lookup(value,'workspace','toolbarEditMode',false))}>
            {lookup(value,'workspace','toolbarEditMode',false)?'Finish Editing Toolbars':'Enter Toolbar Edit Mode'}
          </button>
          <p>{lookup(value,'workspace','toolbarEditMode',false)
            ?'Edit mode enabled: drag the left or right toolbar by its grip, or reorder tools. Finish editing to lock the workspace.'
            :'Both toolbars are locked during normal design work. Enter Edit Mode here to move and reorder them.'}</p>
        </div>}
        {tab === 'workspace' && <div className="studio-settings-group" data-testid="settings-dual-toolbar"><h4>Left and right toolbars</h4>
          <Setting label="Arrange toolbars" description="Turn on to drag the entire 2D or 3D toolbar and rearrange icons. Turn off to use drawing tools normally.">
            <label className="studio-switch"><input type="checkbox" aria-label="Arrange toolbars" checked={!!lookup(value,'workspace','toolbarEditMode',false)} onChange={e=>set('workspace','toolbarEditMode',e.target.checked)}/>{lookup(value,'workspace','toolbarEditMode',false)?'Editing toolbars':'Toolbars locked'}</label>
          </Setting>
          {['left','right'].map(side=><section key={side} className="studio-side-toolbar"><h4>{side === 'left' ? 'Left toolbar' : 'Right toolbar'}</h4><Setting label="Dock position"><Select label={`${side} toolbar dock`} value={lookup(value,'workspace',`${side}ToolbarDock`,side)} options={['left','right','top','bottom','floating']} onChange={v=>set('workspace',`${side}ToolbarDock`,v)}/></Setting><div className="studio-tool-list">{sideToolbar(side).map((id,index,ids)=><div key={id} className="studio-tool-item" draggable={lookup(value,'workspace','toolbarEditMode',false)} onDragStart={e=>{if(lookup(value,'workspace','toolbarEditMode',false))e.dataTransfer.setData('text/plain',`${side}:${id}`)}} onDragOver={e=>{if(lookup(value,'workspace','toolbarEditMode',false))e.preventDefault()}} onDrop={e=>{if(!lookup(value,'workspace','toolbarEditMode',false))return;e.preventDefault();const [source,moving]=e.dataTransfer.getData('text/plain').split(':');if(source!==side||!matchesSide(side,moving)||!sideToolbar(side).includes(moving)||!sideToolbar(side).includes(id)||moving===id)return;const destination=sideToolbar(side).filter(v=>v!==moving);destination.splice(destination.indexOf(id),0,moving);editSideToolbar(side,destination);}}><span className="studio-tool-grip">⠿</span><span>{getToolLabel(sideToolById.get(id)||id)}</span><div className="studio-tool-buttons"><button type="button" disabled={index===0} aria-label={`Move ${id} up in ${side} toolbar`} onClick={()=>{const next=[...ids];[next[index-1],next[index]]=[next[index],next[index-1]];editSideToolbar(side,next)}}>↑</button><button type="button" disabled={index===ids.length-1} aria-label={`Move ${id} down in ${side} toolbar`} onClick={()=>{const next=[...ids];[next[index+1],next[index]]=[next[index],next[index+1]];editSideToolbar(side,next)}}>↓</button><button type="button" disabled={ids.length <= 1} aria-label={`Remove ${id} from ${side} toolbar`} onClick={()=>editSideToolbar(side,ids.filter(slot=>slot!==id))}>×</button></div></div>)}</div><Setting label="Add tool"><Select label={`Add tool to ${side} toolbar`} value="" options={[["","Choose tool…"],...sideToolCatalog.filter(t=>matchesSide(side,t.id)&&!sideToolbar(side).includes(t.id)).map(t=>[t.id,t.label||t.id])]} onChange={id=>{if(matchesSide(side,id))editSideToolbar(side,[...sideToolbar(side),id])}}/></Setting></section>)}</div>}
        {tab==='toolIndex'&&<>
          <h3>Tool Index</h3>
          <p className="studio-settings-intro">Browse CLO and EXO tools. VectorCraft Pen draws new Bézier patterns; VectorCraft Edit Pattern adjusts points and handles on existing patterns, preserving physical measurements.</p>
          <div className="studio-pattern-workspace-switch"><label htmlFor="studio-tool-workspace">Tool workspace</label><select id="studio-tool-workspace" aria-label="Tool workspace" value={toolIndexWorkspace} onChange={event=>setToolIndexWorkspace(event.target.value)}><option value="all">All tools</option><option value="pattern">Pattern focus · 2D and grading</option></select><small>This filters the tool directory. Your garment and active workspace stay intact.</small></div>
          <div className="studio-index-controls">
            <input aria-label="Search all tools" placeholder="Search the full tool library…" value={toolIndexSearch} onChange={event=>setToolIndexSearch(event.target.value)}/>
            <div role="group" aria-label="Filter tool library by toolbar" className="studio-index-filters">
              {(toolIndexWorkspace==='pattern'?[['all','All 2D'],['right','Right · 2D']]:[['all','All'],['left','Left · 3D'],['right','Right · 2D']]).map(([id,label])=><button key={id} type="button" className={toolIndexSide===id?'selected':''} aria-pressed={toolIndexSide===id} onClick={()=>setToolIndexSide(id)}>{label}</button>)}
            </div>
          </div>
          <div className="studio-index-total">{indexSections.filter(section=>toolIndexWorkspace!=='pattern'||section.side==='right').reduce((sum,s)=>sum+s.tools.length,0)} tools in active directory · Native CLO and EXO</div>
          {indexSections.filter(({side})=>(toolIndexWorkspace!=='pattern'||side==='right')&&(toolIndexSide==='all'||toolIndexSide===side)).map(({side,title,kind,tools})=>{
            const displayed=tools.filter(tool=>`${tool.label} ${tool.id} ${tool.action||''} ${tool.column||''} ${side} ${kind} ${title}`.toLowerCase().includes(toolIndexSearch.trim().toLowerCase()));
            const ids=kind==='native'?sideToolbar(side):extraIds(side);
            const selected=new Set(ids);
            const update=kind==='native'?(next)=>editSideToolbar(side,next):(next)=>editExtraIds(side,next);
            return <section key={`${side}-${kind}`} className="studio-settings-group studio-tool-index-section" data-testid={kind==='extra'?`tool-index-${side}`:`tool-index-${side}-native`}>
              <div className="studio-index-heading"><div><h4>{title}</h4><small>{kind==='native'?`${selected.size} of ${tools.length} on ${side} toolbar`:`${tools.length} tools available in library`}</small></div>
                {kind==='native'&&<div className="studio-index-bulk"><button type="button" disabled={selected.size===tools.length} onClick={()=>update(tools.map(tool=>tool.id))} aria-label={`Add all ${title}`}>Add all</button><button type="button" disabled={ids.length<=1} onClick={()=>update(ids.slice(0,1))} aria-label={`Keep one ${title} tool`}>Keep one</button></div>}
              </div>
              <div className="studio-index-list">{displayed.map(tool=><div className="studio-index-tool" key={tool.id} data-tool-index-id={`${kind}:${tool.id}`}>
                <span className="studio-index-icon" aria-hidden="true"><CadToolIcon id={tool.icon} size={19}/></span>
                <span className="studio-index-description"><strong>{tool.label}</strong><small>{kind==='native'?`CLO · ${side==='left'?'3D':'2D'} · Column ${tool.column}`:tool.legacyOnly?'EXO · Legacy workspace':tool.action===null?'EXO · Planned':`EXO · ${side==='left'?'3D':'2D'} extras`}</small></span>
                {kind==='native'?<button type="button" className={selected.has(tool.id)?'is-added':''} disabled={selected.has(tool.id)&&ids.length<=1} aria-pressed={selected.has(tool.id)} aria-label={`${selected.has(tool.id)?'Remove':'Add'} ${tool.label} ${selected.has(tool.id)?'from':'to'} ${side} toolbar`} onClick={()=>update(selected.has(tool.id)?ids.filter(id=>id!==tool.id):[...ids,tool.id])}>{selected.has(tool.id)?'Remove':'+ Add'}</button>
                  :['vector-pen','vector-pencil','sewing-match-notches'].includes(tool.action)||tool.id==='vectorcraft-edit-pattern'
                    ?<button type="button" aria-label={`Use ${tool.label}`} title={tool.id==='vectorcraft-edit-pattern'?'Select an existing edge, then drag its Bézier handles or pattern points':'Activate on the 2D pattern canvas'} onClick={()=>{
                      window.dispatchEvent(new CustomEvent('exo-clothcraft-select-2d-tool',{detail:{tool:tool.action}}))
                      onClose()
                    }}>{tool.id==='vectorcraft-edit-pattern'?'Edit pattern':'Use tool'}</button>
                    :<span className="studio-index-library-status">In library</span>}
              </div>)}{!displayed.length&&<p className="studio-index-no-results">No matching tools in this group.</p>}</div>
            </section>;
          })}
          <section className="studio-settings-group studio-pattern-reference-index" aria-label="Open-source inspired pattern and grading tools" data-testid="open-source-pattern-tool-index">
            <div className="studio-index-heading"><div><h4>Advanced pattern and grading research</h4><small>Reference capabilities from six saved open-source projects · not yet connected to the editor</small></div></div>
            <p>These entries guide future engineering work. They cannot be activated until each implementation is integrated and verified.</p>
            <select aria-label="Pattern tool category" value={toolIndexCategory} onChange={event=>setToolIndexCategory(event.target.value)}><option value="all">All pattern categories</option>{PATTERN_TOOL_CATEGORIES.map(category=><option key={category} value={category}>{category}</option>)}</select>
            <div className="studio-pattern-reference-list">{filterOpenSourcePatternTools(toolIndexSearch,toolIndexCategory).map(tool=><article className="studio-pattern-reference-item" key={tool.id}><div><strong>{tool.label}</strong><small>{tool.category} · {tool.sources.map(source=>OPEN_SOURCE_PATTERN_SOURCES.find(item=>item.id===source)?.name||source).join(', ')}</small><p>{tool.description}</p></div><span className="studio-index-library-status">Research reference</span></article>)}{!filterOpenSourcePatternTools(toolIndexSearch,toolIndexCategory).length&&<p>No matching research tools.</p>}</div>
          </section>
          <div className="studio-settings-group" data-testid="extra-tool-directory">
            <h4>Custom toolbar directory</h4>
            <p>Optional browser shortcuts can also be added to the floating custom toolbar.</p>
            <div className="studio-tool-add-list">
              {catalog.filter(tool=>tool.group==='extra tools').map(tool=><button key={tool.id} type="button"
                disabled={toolbarIds.includes(tool.id)} draggable={!toolbarIds.includes(tool.id)}
                onDragStart={event=>event.dataTransfer.setData('text/plain',`extra:${tool.id}`)}
                onClick={()=>onChange({...value,workspace:{...value.workspace,toolbarIds:[...toolbarIds,tool.id],toolbarVisible:true}})}>
                {toolbarIds.includes(tool.id)?'Added: ':'+ '}{tool.label}
              </button>)}
            </div>
            <small>Zipper and Trim remain available even when their shortcuts are hidden from the workspace.</small>
          </div>
        </>}
        {tab === 'theme' && <>
          <h3>Theme</h3><p className="studio-settings-intro">Choose a complete, readable interface palette. These themes change menus, side panels, toolbars and inspector chrome; 3D lighting stays in Environment.</p>
          <div className="studio-settings-group studio-theme-library">
            <h4>Theme library <span>{STUDIO_THEME_PRESETS.length} presets</span></h4>
            <input className="studio-theme-search" aria-label="Search theme presets" placeholder="Search colors and themes…" value={themeSearch} onChange={event=>setThemeSearch(event.target.value)}/>
            <div className="studio-theme-filters" role="group" aria-label="Theme categories">
              {['All',...new Set(STUDIO_THEME_PRESETS.map(theme=>theme.category))].map(group=>
                <button key={group} type="button" className={themeGroup===group?'selected':''} aria-pressed={themeGroup===group} onClick={()=>setThemeGroup(group)}>{group}</button>)}
            </div>
            <div className="studio-theme-gallery" aria-label="Theme presets">
              {STUDIO_THEME_PRESETS.filter(theme=>(themeGroup==='All'||theme.category===themeGroup)
                &&(theme.name+' '+theme.category).toLowerCase().includes(themeSearch.toLowerCase())).map(theme=>{
                const selected=lookup(value,'appearance','theme','graphite')===theme.id;
                return <button key={theme.id} type="button" className={selected?'selected':''} aria-pressed={selected}
                  aria-label={theme.name+' theme'} data-theme-id={theme.id}
                  onClick={()=>set('appearance','theme',theme.id)}>
                  <span className="studio-theme-swatch" style={{background:theme.sidebarColor,borderColor:theme.borderColor}}>
                    <span style={{background:theme.panelColor}}><i style={{background:theme.accent}}/><b style={{background:theme.textColor}}/><b style={{background:theme.mutedColor}}/></span>
                  </span>
                  <span className="studio-theme-name">{theme.name}</span>
                </button>})}
            </div>
          </div>
          <div className="studio-settings-group">
            <h4>Side panels</h4>
            <p>Change the relationship between the Library, Object Browser and Property Editor without changing the 3D scene.</p>
            <div className="studio-panel-finish-grid" role="group" aria-label="Side panel color presets">
              {STUDIO_PANEL_FINISHES.map(finish=><button key={finish.id} type="button" className={lookup(value,'appearance','panelFinish','balanced')===finish.id?'selected':''}
                aria-pressed={lookup(value,'appearance','panelFinish','balanced')===finish.id} onClick={()=>set('appearance','panelFinish',finish.id)}>
                <strong>{finish.label}</strong><small>{finish.description}</small></button>)}
            </div>
          </div>
          <div className="studio-settings-group">
            <h4>Interface material</h4>
            <p>Choose a solid finish or clear Liquid Glass panels. Tool icons remain crisp, colorful, and transparent in either mode.</p>
            <div className="studio-glass-modes" role="group" aria-label="Interface material mode">
              <button type="button" aria-pressed={!lookup(value,'appearance','liquidGlass',false)} className={!lookup(value,'appearance','liquidGlass',false)?'selected':''} onClick={()=>set('appearance','liquidGlass',false)}><span className="studio-material-preview studio-material-solid" aria-hidden="true"><i/><b/><i/></span><strong>Solid</strong><small>Classic opaque panels</small></button>
              <button type="button" aria-pressed={!!lookup(value,'appearance','liquidGlass',false)} className={lookup(value,'appearance','liquidGlass',false)?'selected':''} onClick={()=>set('appearance','liquidGlass',true)}><span className="studio-material-preview studio-material-glass" aria-hidden="true"><i/><b/><i/></span><strong>Liquid Glass</strong><small>Clear layered panels</small></button>
            </div>
            {lookup(value,'appearance','liquidGlass',false)&&<div className="studio-glass-controls">
              <Setting label="Backdrop tint" description="Adds atmospheric color behind translucent panels; your garment colors stay unchanged."><Color label="Glass backdrop tint" value={lookup(value,'appearance','glassBackdrop','#253d57')} onChange={next=>set('appearance','glassBackdrop',next)}/></Setting>
              <div className="studio-glass-swatches" role="group" aria-label="Liquid Glass backdrop presets">
                {[['#253d57','Deep blue'],['#45315d','Iridescent violet'],['#22564c','Sea glass'],['#5a354c','Soft rose'],['#292e38','Neutral graphite']].map(([color,label])=><button key={color} type="button" aria-label={label+' glass backdrop'} aria-pressed={lookup(value,'appearance','glassBackdrop','#253d57')===color} title={label} style={{'--glass-preset-color':color}} onClick={()=>set('appearance','glassBackdrop',color)}/>) }
              </div>
              <Setting label="Panel clarity" description="Choose how transparent the glass surfaces appear."><Select label="Liquid Glass panel clarity" value={lookup(value,'appearance','glassDensity','balanced')} options={[["clear","Clear · light"],["balanced","Balanced"],["rich","Rich · deeper"]]} onChange={next=>set('appearance','glassDensity',next)}/></Setting>
              <Setting label="Background diffusion" description="Adjust softness behind glass panels without blurring icons or labels."><Select label="Liquid Glass background diffusion" value={lookup(value,'appearance','glassBlur','smooth')} options={[["crisp","Crisp · no blur"],["soft","Soft"],["smooth","Smooth"]]} onChange={next=>set('appearance','glassBlur',next)}/></Setting>
              <div className="studio-glass-subsection"><strong>Icon visibility</strong><small>Adaptive automatically uses dark icons on the light 2D board and light icons on dark viewports and tool rails.</small>
                <div className="studio-glass-icon-modes" role="group" aria-label="Liquid Glass icon colors">
                  {[["adaptive","Adaptive"],["white","Bright white"],["ink","Dark ink"],["accent","Theme accent"]].map(([id,label])=><button key={id} type="button" className={lookup(value,'appearance','glassIconColor','adaptive')===id?'selected':''} aria-pressed={lookup(value,'appearance','glassIconColor','adaptive')===id} data-icon-color={id} onClick={()=>set('appearance','glassIconColor',id)}><span aria-hidden="true">✦</span>{label}</button>)}
                </div>
              </div>
              <div className="studio-glass-subsection"><strong>Where to use Liquid Glass</strong><small>Turn individual interface areas on or off. Editing the garment itself remains unaffected.</small>
                <div className="studio-glass-targets" role="group" aria-label="Liquid Glass surfaces">
                  {[["glassLibrary","Library and asset browser"],["glassInspector","Object Browser and Property Editor"],["glassToolbars","Side toolbars"],["glassMenu","Top menu"],["glassWidgets","Floating viewport controls"]].map(([key,label])=><label key={key}><input type="checkbox" checked={!!lookup(value,'appearance',key,key!=='glassWidgets')} onChange={e=>set('appearance',key,e.target.checked)}/>{label}</label>)}
                </div>
              </div>
            </div>}
            <div className="studio-theme-current">
              <span>Active: {STUDIO_THEME_PRESETS.find(item=>item.id===lookup(value,'appearance','theme','graphite'))?.name||'Graphite Studio'}</span>
              <button type="button" onClick={restoreTheme}>Restore default theme</button>
            </div>
          </div>
        </>}
        {tab === 'environment' && <><h3>Environment</h3><p className="studio-settings-intro">Set the 3D studio background and lighting.</p><div className="studio-settings-group"><h4>Scene</h4><Setting label="Studio background mode"><Select label="Studio background mode" value={lookup(value,'appearance','backgroundMode','default')} options={[["default","Original 3D studio"],["color","Custom background"]]} onChange={v=>set('appearance','backgroundMode',v)}/></Setting><Setting label="Environment preset"><Select label="Environment preset" value={lookup(value,'appearance','environmentPreset','studio')} options={[["studio","Studio default"],["softbox","Softbox"],["dramatic","Dramatic"],["neutral","Neutral"]]} onChange={v=>set('appearance','environmentPreset',v)} /></Setting>{[['studioColor','Studio background','#373941'],['lightColor','Light color','#ffffff']].map(([key,label,fallback])=><Setting key={key} label={label}><Color label={label} value={lookup(value,'appearance',key,fallback)} onChange={v=>key==='studioColor'?changeStudioBackground(v):set('appearance',key,v)}/></Setting>)}<Setting label="Light intensity"><div className="studio-range"><input type="range" aria-label="Light intensity" min="0" max="5" step="0.05" value={lookup(value,'appearance','lightIntensity',1)} onChange={e=>set('appearance','lightIntensity',Number(e.target.value))}/><output>{Number(lookup(value,'appearance','lightIntensity',1)).toFixed(2)}×</output></div></Setting></div><div className="studio-settings-group"><h4>Light position</h4>{[['lightPositionX','Horizontal (X)'],['lightPositionY','Height (Y)'],['lightPositionZ','Depth (Z)']].map(([key,label])=><Setting key={key} label={label}><input type="number" step="0.1" min="-100" max="100" aria-label={label} value={lookup(value,'appearance',key,key==='lightPositionX'?2.5:key==='lightPositionY'?4.5:3.1)} onChange={e=>{const v=Number(e.target.value);if(Number.isFinite(v))set('appearance',key,Math.max(-100,Math.min(100,v)));}}/></Setting>)}</div><div className="studio-environment-reset-row"><button type="button" className="studio-environment-reset" data-testid="studio-reset-environment" onClick={() => onResetEnvironment?.()}>Reset Environment</button><small>Restore original background, lighting preset, color, intensity and light position.</small></div></>}
        {tab === 'profile' && <><h3>Profile & brand</h3><p className="studio-settings-intro">Personalize your identity in the design studio.</p><div className="studio-settings-group">{[['displayName','Display name'],['brandName','Designer brand']].map(([key,label]) => <Setting label={label} key={key}><input aria-label={label} maxLength={80} value={lookup(value,'profile',key,'')} onChange={(e) => set('profile',key,e.target.value)} /></Setting>)}<label className="studio-full-label" htmlFor="studio-profile-bio">Bio</label><textarea id="studio-profile-bio" rows={4} maxLength={500} value={lookup(value,'profile','bio','')} onChange={(e) => set('profile','bio',e.target.value)} /></div><div className="studio-settings-group"><h4>Images</h4>{[['avatarDataUrl','Profile picture'],['logoDataUrl','Brand logo']].map(([key,label]) => <div className="studio-upload-row" key={key}><div className="studio-image-preview">{section('profile')[key] ? <img src={section('profile')[key]} alt={`${label} preview`} /> : <span aria-hidden="true">◇</span>}</div><div><strong>{label}</strong><p>PNG, JPEG or WebP up to 220 KB.</p><input type="file" accept="image/png,image/jpeg,image/webp" aria-label={`Upload ${label}`} onChange={(e) => { upload(key,e.target.files?.[0]); e.target.value = ''; }} /><button type="button" disabled={!section('profile')[key]} onClick={() => set('profile',key,'')}>Remove</button></div></div>)}{uploadError && <p className="studio-settings-error" role="alert">{uploadError}</p>}</div></>}
        {tab === 'preferences' && <><h3>Preferences</h3><p className="studio-settings-intro">Set your default editing and display behavior.</p><div className="studio-settings-group">{[['language','Language preference (saved)',[['en','English'],['fr','Français'],['es','Español'],['de','Deutsch'],['it','Italiano'],['pt','Português'],['ja','日本語'],['ko','한국어'],['zh','中文']]],['units','Measurement units',[['mm','Millimeters'],['cm','Centimeters'],['in','Inches']]],['graphicsQuality','Graphics quality',['low','medium','high','ultra']],['viewControls','View controls',['clo','maya','blender','trackpad']],['shortcutsPreset','Keyboard shortcut preset (saved)',['clo','illustrator','blender']]].map(([key,label,options]) => <Setting key={key} label={label}><Select label={label} value={lookup(value,'preferences',key,key==='language'?'en':key==='units'?'mm':key==='graphicsQuality'?'high':'clo')} options={options} onChange={(next) => set('preferences',key,next)} /></Setting>)}{[['antialias','Anti-aliasing'],['showGrid','Show grid'],['showGuides','Show construction guides']].map(([key,label]) => <Setting key={key} label={label}><label className="studio-switch"><input type="checkbox" checked={!!lookup(value,'preferences',key,true)} onChange={(e) => set('preferences',key,e.target.checked)} />Enable</label></Setting>)}</div></>}
        {tab === 'filesApi' && <><h3>Files & API</h3><p className="studio-settings-intro">Choose local file defaults and configure an API endpoint for supported integrations.</p><div className="studio-settings-group"><h4>Files</h4><Setting label="Auto-save"><label className="studio-switch"><input type="checkbox" checked={!!lookup(value,'preferences','autoSave',false)} onChange={(e) => set('preferences','autoSave',e.target.checked)} />Enable</label></Setting><Setting label="Default folder (saved preference)"><input aria-label="Default folder (saved preference)" value={lookup(value,'preferences','defaultFolder','')} placeholder="Local folder path" onChange={(e) => set('preferences','defaultFolder',e.target.value)} /></Setting></div><div className="studio-settings-group"><h4>API</h4><Setting label="API base URL" description="Saved as a local preference; this does not establish a connection."><input type="url" aria-label="API base URL" value={lookup(value,'preferences','apiBaseUrl','')} placeholder="https://…" onChange={(e) => set('preferences','apiBaseUrl',e.target.value)} /></Setting><span className="studio-status">Not connected</span></div></>}
        {tab === 'plugins' && <><h3>Plugins</h3><p className="studio-settings-intro">Switch locally supported features. External services require a separate connection.</p><div className="studio-settings-group"><h4>Local integration preferences</h4>{[['enableLocalTools','Local design tools'],['enableAssetBridge','Asset bridge']].map(([id,label]) => <Setting key={id} label={label} description={id === 'enableAssetBridge' ? 'Preference only; availability depends on installed integration.' : 'Built-in studio tools'}><label className="studio-switch"><input type="checkbox" checked={!!section('plugins')[id]} onChange={(e) => set('plugins',id,e.target.checked)} />Enabled</label></Setting>)}</div><div className="studio-settings-group"><h4>External connections</h4><p>No external plugin connection is confirmed.</p><span className="studio-status">Not connected</span></div></>}
      </main></div>
      <footer className="studio-settings-footer" data-testid="studio-settings-footer">{confirmGlobalReset ? <div className="studio-settings-confirm" role="group" aria-label="Confirm reset all settings"><strong>Reset all settings?</strong><button type="button" onClick={() => { setConfirmGlobalReset(false); onReset?.(); }} data-testid="studio-confirm-global-reset">Reset everything</button><button type="button" onClick={() => setConfirmGlobalReset(false)}>Cancel</button></div> : <button type="button" className="studio-settings-reset" data-testid="studio-reset-all" onClick={() => setConfirmGlobalReset(true)}>Reset defaults</button>}<span>Settings are stored locally on this device</span><button type="button" className="studio-settings-done" onClick={() => { onApplyWorkspace?.(value); onClose(); }} data-testid="studio-settings-apply">Apply</button></footer>
    </div>
  </div>, document.body);
}
