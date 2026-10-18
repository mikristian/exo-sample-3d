import React, {useRef, useState} from 'react'
import {flushSync} from 'react-dom'
import CadToolIcon from './CadToolIcon.jsx'
import './ViewportQuickTools.css'

// Original Garment Studio CAD SVGs, arranged as compact CLO-inspired tool
// families. Each icon runs the real editor command; hovering or focusing its
// flyout reveals alternative actions from the same family.
const TOOLS = {
  '2d': [
    { name: 'select', label: 'Select / Transform', icon: 'select-2d', options: ['select', 'point', 'split'] },
    { name: 'point', label: 'Edit Pattern Points', icon: 'points', options: ['point', 'curve', 'split'] },
    { name: 'curve', label: 'Edit Curve Point', icon: 'curve', options: ['curve', 'point', 'split'] },
    { name: 'polygon', label: 'Draw New Polygon Pattern', icon: 'polygon-tool', options: ['polygon', 'internal'] },
    { name: 'sew', label: 'Edit Sewing', icon: 'sew', options: ['sew', 'notch', 'allowance', 'fastener'] },
    { name: 'notch', label: 'Notches / Seam Allowance', icon: 'notch', options: ['notch', 'allowance'] },
    { name: 'internal', label: 'Internal Line / Dart', icon: 'internal', options: ['internal', 'pin', 'measure'] },
    { name: 'measure', label: 'Measure', icon: 'measure', options: ['measure', 'notch', 'allowance', 'pin'] },
  ],
  '3d': [
    { name: 'orbit', label: 'Orbit Camera', icon: 'camera', options: ['orbit', 'hand'] },
    { name: 'transform', label: 'Select / Move', icon: 'select-3d', options: ['transform', 'move', 'rotate'] },
    { name: 'move', label: 'Move Garment', icon: 'move-3d', options: ['move', 'transform'] },
    { name: 'rotate', label: 'Rotate Garment', icon: 'rotate-3d', options: ['rotate', 'transform'] },
    { name: 'hand', label: 'Fabric Hand', icon: 'hand', options: ['hand', 'orbit'] },
  ],
}

const LABELS = {
  select: 'Select / Transform', point: 'Edit Points', split: 'Add / Split Point', polygon: 'Draw Polygon',
  curve: 'Edit Curve Point', sew: 'Free Sewing', notch: 'Add Notch', allowance: 'Seam Allowance',
  fastener: 'Fastener', internal: 'Internal Line / Dart', pin: 'Pin',
  measure: 'Measure', orbit: 'Orbit', transform: 'Select / Move',
  move: 'Move', rotate: 'Rotate', hand: 'Fabric Hand',
}
const ICONS = {
  select: 'select-2d', point: 'points', split: 'split', curve: 'curve', polygon: 'polygon-tool',
  sew: 'sew', notch: 'notch', allowance: 'seam-links', fastener: 'fastener', internal: 'internal',
  pin: 'pin', measure: 'measure', orbit: 'camera', transform: 'select-3d',
  move: 'move-3d', rotate: 'rotate-3d', hand: 'hand',
}

export default function ViewportQuickTools({ dimension, activeTool, onChangeTool, availableTools, disabled = false, extraGroup = null }) {
  const [selectedByFamily, setSelectedByFamily] = useState({})
  const [touchOpenFamily, setTouchOpenFamily] = useState(null)
  const [dismissedFamily, setDismissedFamily] = useState(null)
  const touchPointer = useRef(false)
  const usable = name => !disabled && (!availableTools || availableTools.includes(name))
  const choose = (family, name) => {
    if (!usable(name)) return
    setSelectedByFamily(previous => ({...previous, [family]:name}))
    setTouchOpenFamily(null)
    setDismissedFamily(family)
    onChangeTool?.(name)
  }
  const handleFamilyKeys = (event, family) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setTouchOpenFamily(null)
      setDismissedFamily(family)
      // Return keyboard focus to the owning family button when its flyout
      // closes, matching a conventional menu while keeping Escape usable.
      event.currentTarget.querySelector(':scope > button')?.focus()
    }
    if (event.key === 'ArrowRight' && event.target === event.currentTarget.firstElementChild) {
      event.preventDefault()
      // A previously dismissed group needs to become visible again before
      // its first alternative can receive focus.
      flushSync(() => setDismissedFamily(null))
      event.currentTarget.querySelector('.clo-corner-tool-options > button:not(:disabled)')?.focus()
    }
    if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && event.target.closest?.('.clo-corner-tool-options')) {
      const buttons = [...event.currentTarget.querySelectorAll('.clo-corner-tool-options > button:not(:disabled)')]
      if (!buttons.length) return
      const index = buttons.indexOf(event.target)
      event.preventDefault()
      buttons[(index + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length]?.focus()
    }
  }
  return (
    <div className={`canvas-tool-flyouts clo-corner-toolkit clo-corner-toolkit-${dimension} exo-viewport-inline-tools`} aria-label={`${dimension.toUpperCase()} viewport quick tools`} role="toolbar" aria-orientation="vertical">
      {(TOOLS[dimension] || []).filter(group => !availableTools || availableTools.includes(group.name)).map((group) => {
        const chosen = selectedByFamily[group.name] || group.name
        const active = chosen === activeTool
        return <div className="canvas-tool-group clo-corner-tool-group" key={group.name}
          data-tool-family={group.name} data-current-tool={chosen} data-touch-open={String(touchOpenFamily === group.name)} data-dismissed={String(dismissedFamily === group.name)}
          onPointerEnter={() => setDismissedFamily(previous => previous === group.name ? null : previous)}
          onKeyDown={event => handleFamilyKeys(event, group.name)}>
          <button
            type="button"
            aria-label={group.label}
            title={`${group.label}${chosen !== group.name ? ` · ${LABELS[chosen]}` : ''}`}
            aria-pressed={active}
            aria-haspopup="true"
            className={active ? 'active' : ''}
            disabled={!usable(chosen)}
            onPointerDown={event => {
              setDismissedFamily(null)
              touchPointer.current = event.pointerType === 'touch'
              if (touchPointer.current) setTouchOpenFamily(old => old === group.name ? null : group.name)
            }}
            onClick={event => {
              if (touchPointer.current) {touchPointer.current = false;return}
              choose(group.name, chosen)
              event.currentTarget.blur()
            }}
          >
            <CadToolIcon id={ICONS[chosen] || group.icon} size={21}/>
            <span className="clo-corner-flyout-caret" aria-hidden="true" />
          </button>
          <div className="canvas-tool-options clo-corner-tool-options" role="group" aria-label={`${group.label} alternatives`}>
            {group.options.map((name) => (
              <button key={name} type="button" disabled={!usable(name)} className={activeTool === name ? 'active' : ''} aria-pressed={activeTool === name} aria-label={LABELS[name]} title={usable(name) ? LABELS[name] : `${LABELS[name]} (available in full Garment Studio)`} onClick={event => {choose(group.name, name);event.currentTarget.blur()}}>
                <CadToolIcon id={ICONS[name]} size={19}/><span className="clo-corner-option-label">{LABELS[name]}</span>
              </button>
            ))}
          </div>
        </div>
      })}
      {extraGroup}
    </div>
  )
}
