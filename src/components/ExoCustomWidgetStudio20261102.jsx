import React, { useEffect, useMemo, useState } from 'react'
import {
  EXO_WIDGET_ACCENTS, EXO_WIDGET_BLOCK_TYPES, EXO_WIDGET_MAX,
  exportExoCustomWidgetJson, importExoCustomWidgetJson, importExoCustomWidgetFile, makeExoCustomWidget,
  readExoCustomWidgetLibrary, saveExoCustomWidgetLibrary, validateExoCustomWidget,
} from '../core/exoCustomWidgets20261102.js'
import './ExoCustomWidgetStudio20261102.css'

const BLOCK_NAMES = { text: 'Text', metric: 'Metric', divider: 'Divider', button: 'Action', status: 'Status', progress: 'Progress' }
const human = error => error instanceof Error ? error.message : 'Unable to complete that operation.'

export function ExoCustomWidgetPreview20261102({ widget, commands = {}, onCommand }) {
  const [active, setActive] = useState('')
  if (!widget) return <div className="exo-cws-empty">Select a widget to preview it.</div>
  return <section className={`exo-cws-preview exo-cws-accent-${widget.accent}`} aria-label={`${widget.title} widget preview`}>
    <header><strong>{widget.title}</strong>{widget.description && <small>{widget.description}</small>}</header>
    <div className="exo-cws-blocks">{widget.blocks.map((block, i) => {
      if (block.type === 'divider') return <hr key={i} />
      if (block.type === 'button') {
        const allowed = !!block.command && Object.prototype.hasOwnProperty.call(commands, block.command) && typeof commands[block.command] === 'function'
        return <button key={i} type="button" disabled={!allowed} title={!allowed ? 'This action is not connected to an EXO command.' : undefined} onClick={() => { if (!allowed) return; commands[block.command](); onCommand?.(block.command); setActive(`Executed ${block.label || block.command}`) }}>{block.label || 'Action'}</button>
      }
      return <div className={`exo-cws-block exo-cws-${block.type}`} key={i}>
        <span>{block.label}</span>
        {block.type === 'progress' ? <><progress max="100" value={block.value} /><strong>{block.value}%</strong></> : <strong>{block.value}</strong>}
        {block.detail && <small>{block.detail}</small>}
      </div>
    })}</div>
    {active && <p role="status">{active}</p>}
  </section>
}

export default function ExoCustomWidgetStudio20261102({ commands = {}, onChange, onClose }) {
  const [widgets, setWidgets] = useState(() => readExoCustomWidgetLibrary())
  const [selectedId, setSelectedId] = useState('')
  const [source, setSource] = useState('')
  const [message, setMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const selected = useMemo(() => widgets.find(widget => widget.id === selectedId) || widgets[0] || null, [widgets, selectedId])
  useEffect(() => { if (!selectedId && widgets[0]) setSelectedId(widgets[0].id) }, [widgets, selectedId])
  const persist = next => {
    try { const valid = saveExoCustomWidgetLibrary(next); setWidgets(valid); onChange?.(valid); setMessage('Widget library saved locally.'); return true }
    catch (error) { setMessage(human(error)); return false }
  }
  const update = patch => {
    if (!selected) return
    try {
      const next = validateExoCustomWidget({ ...selected, ...patch })
      persist(widgets.map(widget => widget.id === selected.id ? next : widget))
    } catch (error) { setMessage(human(error)) }
  }
  const add = () => {
    if (widgets.length >= EXO_WIDGET_MAX) return setMessage(`The library holds up to ${EXO_WIDGET_MAX} widgets.`)
    const newWidget = makeExoCustomWidget()
    if (persist([...widgets, newWidget])) setSelectedId(newWidget.id)
  }
  const importWidget = () => {
    try {
      const widget = importExoCustomWidgetJson(source, widgets)
      if (widgets.length >= EXO_WIDGET_MAX) throw new Error('The widget library is full.')
      if (persist([...widgets, widget])) { setSelectedId(widget.id); setSource(''); setMessage('Widget imported safely. Review its preview and commands.') }
    } catch (error) { setMessage(human(error)) }
  }
  const importFile = async file => {
    if (!file) return
    setUploading(true)
    try {
      if (widgets.length >= EXO_WIDGET_MAX) throw new Error('The widget library is full.')
      const widget = await importExoCustomWidgetFile(file, widgets)
      if (persist([...widgets, widget])) { setSelectedId(widget.id); setMessage(`Imported ${widget.title} from ${file.name}.`) }
    } catch (error) { setMessage(human(error)) }
    finally { setUploading(false) }
  }
  const exportWidget = () => {
    if (!selected) return
    const content = exportExoCustomWidgetJson(selected)
    setSource(content)
    if (typeof Blob === 'undefined' || typeof URL?.createObjectURL !== 'function') return
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url; link.download = `${selected.id}.exo-widget.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  const updateBlock = (index, patch) => update({ blocks: selected.blocks.map((block, i) => i === index ? { ...block, ...patch } : block) })
  return <section className="exo-cws" aria-label="EXO custom widget studio" data-testid="exo-custom-widget-studio">
    <div className="exo-cws-heading"><div><h2>Custom Widget Studio</h2><p>Design reusable EXO side panels with live previews and safe EXO command buttons.</p></div>{onClose && <button type="button" onClick={onClose} aria-label="Close custom widget studio">×</button>}</div>
    <div className="exo-cws-layout">
      <aside className="exo-cws-library"><div className="exo-cws-row"><strong>My widgets</strong><button type="button" onClick={add}>+ New widget</button></div>
        {widgets.map(widget => <button type="button" className={widget.id === selected?.id ? 'selected' : ''} key={widget.id} onClick={() => { setSelectedId(widget.id); setMessage('') }}>{widget.title}<small>{widget.blocks.length} blocks</small></button>)}
        {!widgets.length && <p>Create your first widget to begin.</p>}
      </aside>
      <div className="exo-cws-editor">
        {selected ? <><label>Widget title<input maxLength={64} value={selected.title} onChange={e => update({ title: e.target.value || 'Untitled widget' })} /></label>
          <label>Description<input maxLength={240} value={selected.description} onChange={e => update({ description: e.target.value })} /></label>
          <label>Accent<select value={selected.accent} onChange={e => update({ accent: e.target.value })}>{EXO_WIDGET_ACCENTS.map(accent => <option key={accent}>{accent}</option>)}</select></label>
          <div className="exo-cws-row"><strong>Panel blocks</strong><select aria-label="Add widget block" value="" onChange={e => { if (e.target.value) update({ blocks: [...selected.blocks, { type: e.target.value, label: BLOCK_NAMES[e.target.value], value: e.target.value === 'progress' ? 50 : '' }] }) }}><option value="">+ Add block…</option>{EXO_WIDGET_BLOCK_TYPES.map(type => <option value={type} key={type}>{BLOCK_NAMES[type]}</option>)}</select></div>
          {selected.blocks.map((block, i) => <div className="exo-cws-block-editor" key={`${selected.id}-${i}`}><div className="exo-cws-row"><strong>{BLOCK_NAMES[block.type]}</strong><button type="button" onClick={() => update({ blocks: selected.blocks.filter((_, index) => index !== i) })}>Remove</button></div>
            {block.type !== 'divider' && <label>Label<input maxLength={64} value={block.label || ''} onChange={e => updateBlock(i, { label: e.target.value })} /></label>}
            {['text', 'metric', 'status'].includes(block.type) && <label>Value<input maxLength={240} value={block.value || ''} onChange={e => updateBlock(i, { value: e.target.value })} /></label>}
            {block.type === 'progress' && <label>Progress (%)<input type="number" min="0" max="100" value={block.value ?? 0} onChange={e => updateBlock(i, { value: e.target.value })} /></label>}
            {block.type === 'button' && <label>Registered EXO command<select value={block.command || ''} onChange={e => updateBlock(i, { command: e.target.value })}><option value="">Choose a command…</option>{Object.entries(commands).filter(([, handler]) => typeof handler === 'function').map(([id]) => <option key={id} value={id}>{id}</option>)}</select></label>}
            {['text', 'metric', 'status', 'progress'].includes(block.type) && <label>Detail<input maxLength={160} value={block.detail || ''} onChange={e => updateBlock(i, { detail: e.target.value })} /></label>}
          </div>)}
          <div className="exo-cws-row"><button type="button" onClick={() => { persist(widgets.filter(widget => widget.id !== selected.id)); setSelectedId('') }}>Delete widget</button><button type="button" onClick={exportWidget}>Export JSON</button></div>
        </> : <p>Choose New widget to start designing.</p>}
        <div className="exo-cws-transfer"><label>Upload widget JSON (.json, max 32 KB)<input aria-label="Upload widget JSON file" type="file" accept=".json,application/json" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void importFile(file) }} /></label><label>Import / export JSON<textarea aria-label="Widget JSON" spellCheck={false} value={source} onChange={e => setSource(e.target.value)} placeholder="Paste an EXO widget JSON definition…" rows={6} /></label><button type="button" disabled={!source.trim() || uploading} onClick={importWidget}>Import JSON</button><small>JSON only. JavaScript, HTML, and third-party scripts are never executed.</small></div>
        {message && <p role="status" className="exo-cws-feedback">{message}</p>}
      </div>
      <aside className="exo-cws-viewport"><h3>Live preview</h3><ExoCustomWidgetPreview20261102 widget={selected} commands={commands} /><small>Commands run only when supplied by EXO.</small></aside>
    </div>
  </section>
}
