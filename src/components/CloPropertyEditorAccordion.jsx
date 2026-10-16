import React, {useEffect, useRef, useState} from 'react'
import {ChevronDown, ChevronRight} from 'lucide-react'
import './CloPropertyEditorAccordion.css'

// Mirror the grouping of CLO's context-sensitive pattern Property Editor.
// This is an EXO UI shell. A setting is editable only when its underlying
// native/project command really exists; Bond and Solidify are not fake toggles.
export const CLO_PROPERTY_GROUPS = [
  ['information','Information'],
  ['selected-line','Selected Line'],
  ['simulation','Simulation Properties'],
  ['fabric','Fabric'],
  ['bond','Bond'],
  ['solidify','Solidify'],
  ['arrange','Arrange'],
  ['miscellaneous','Miscellaneous'],
]

const EDITOR_GROUP_FOR_SECTION = {
  Pattern:'arrange',
  Sewing:'selected-line',
  Fit:'simulation',
  Fabric:'fabric',
  Render:'miscellaneous',
  Avatar:'miscellaneous',
  Production:'miscellaneous',
}

function Readout({label,value}) {
  return <div className="clo-pe-readout"><span>{label}</span><strong>{value ?? '—'}</strong></div>
}

export default function CloPropertyEditorAccordion({
  activeSection,selectedPiece,project,fabric,clothcraftHybrid,clothcraftLive,
  selectedArea,onSwitchSection,onShowFabric,onSimulate,onReset,
  children,
}) {
  const contextGroup=EDITOR_GROUP_FOR_SECTION[activeSection]||'miscellaneous'
  const [open,setOpen]=useState(()=>['information'])
  const previousSection=useRef(activeSection)
  useEffect(()=>{
    // Start compact like CLO's category accordion. When the user actually
    // changes workspaces, reveal its relevant advanced fields automatically.
    // Keeping collapsed bodies mounted preserves PatternEditor's portal host.
    if(previousSection.current===activeSection)return
    previousSection.current=activeSection
    setOpen(previous=>previous.includes(contextGroup)?previous:[...previous,contextGroup])
  },[activeSection,contextGroup])
  const toggle=id=>setOpen(previous=>previous.includes(id)?previous.filter(item=>item!==id):[...previous,id])
  const selectedSeams=selectedPiece
    ? (project?.seams||[]).filter(seam=>seam.a?.pieceId===selectedPiece.id||seam.b?.pieceId===selectedPiece.id).length
    : 0
  const selectedFabric=selectedPiece?.fabricId
    ? project?.fabrics?.[selectedPiece.fabricId]
    : fabric

  const overview=id=>{
    switch(id){
      case 'information':
        return <>
          <Readout label="Name" value={selectedPiece?.name||project?.name||'Untitled garment'}/>
          <Readout label="Type" value={selectedPiece?'Pattern Piece':'Garment Project'}/>
          <Readout label="Item No." value={selectedPiece?.id||'—'}/>
          <Readout label="Pattern Pieces" value={clothcraftHybrid?(clothcraftLive?.panels??'Loading'):(project?.pieces?.length??0)}/>
          {selectedPiece&&<Readout label="Area" value={`${selectedArea.toFixed(1)} cm²`}/>}
          {clothcraftHybrid&&<p className="clo-pe-note">The native ClothCraft garment and EXO draft have separate property records. Native simulation is controlled by Rust.</p>}
        </>
      case 'selected-line':
        return <>
          <Readout label="Selected Pattern" value={selectedPiece?.name||'No pattern selected'}/>
          <Readout label="Sewing Links" value={selectedSeams}/>
          <p className="clo-pe-note">Select a sewn edge or internal line in the 2D window to edit its line-specific settings.</p>
          {activeSection!=='Sewing'&&<button className="clo-pe-action" onClick={()=>onSwitchSection('Sewing')}>OPEN SEWING PROPERTIES</button>}
        </>
      case 'simulation':
        return <>
          <Readout label="Engine" value={clothcraftHybrid?'ClothCraft · Rust VBD + OGC':'EXO Cloth Simulation'}/>
          <Readout label="Status" value={clothcraftLive?.running?'Running':'Ready / Paused'}/>
          <div className="clo-pe-actions">
            <button type="button" onClick={onSimulate}>SIMULATE / PAUSE</button>
            <button type="button" onClick={onReset}>RESET PANELS</button>
          </div>
          {activeSection!=='Fit'&&<button className="clo-pe-action" onClick={()=>onSwitchSection('Fit')}>OPEN FIT SETTINGS</button>}
          {clothcraftHybrid&&<p className="clo-pe-note">Rust collision and cloth fitting remain experimental, not production certified.</p>}
        </>
      case 'fabric':
        return <>
          <Readout label="Assigned Fabric" value={selectedFabric?.name||'Not assigned'}/>
          <div className="clo-pe-fabric"><span aria-hidden="true" style={{background:selectedFabric?.color||'#818a96'}}/>
            <strong>{selectedFabric?.name||'Fabric'}</strong>
            <small>{Number.isFinite(selectedFabric?.gsm)?`${selectedFabric.gsm} gsm`:'Material'}</small></div>
          {activeSection!=='Fabric'&&<button className="clo-pe-action" onClick={onShowFabric}>OPEN FABRIC PROPERTIES</button>}
        </>
      case 'bond':
        return <>
          <Readout label="Bond" value="Not configured"/>
          <p className="clo-pe-note">Bond/Skive is a separate physical reinforcement property in CLO. No equivalent native Rust bonding command is connected yet.</p>
        </>
      case 'solidify':
        return <>
          <Readout label="Solidify" value="Not enabled"/>
          <p className="clo-pe-note">CLO Solidify maintains a selected pattern’s simulated 3D shape. This Rust solver has no equivalent Solidify strength property yet; the UI does not change physics.</p>
        </>
      case 'arrange':
        return <>
          <Readout label="Pattern" value={selectedPiece?.name||'No pattern selected'}/>
          {selectedPiece&&['X','Y','Z'].map(axis=><Readout key={axis} label={`Position ${axis}`}
            value={`${(Number(selectedPiece.arrangement3d?.[`stagingOffset${axis}`]||0)*100).toFixed(1)} cm`}/>)}
          {activeSection!=='Pattern'&&<button className="clo-pe-action" onClick={()=>onSwitchSection('Pattern')}>OPEN PATTERN ARRANGEMENT</button>}
          <p className="clo-pe-note">Use the Move tool in 3D to reposition a draped panel; reset to arrange the starting pattern.</p>
          {/* PatternEditor portals precision controls here. Its target must
              remain the SAME DOM node as workspaces change or accordions
              collapse, or the drafting controls would become detached. */}
          <div id="clo-pattern-properties-host" className="clo-pattern-properties-host"
            hidden={!['Pattern','Sewing','Production'].includes(activeSection)}/>
        </>
      case 'miscellaneous':
        return <>
          <Readout label="Workspace" value={activeSection}/>
          {activeSection!=='Render'&&<button className="clo-pe-action" onClick={()=>onSwitchSection('Render')}>RENDER / ENVIRONMENT SETTINGS</button>}
        </>
      default:return null
    }
  }

  return <>
    <div className="inspector-head clo-pe-header"><span>PROPERTY EDITOR</span><strong>{selectedPiece?.name||activeSection.toUpperCase()}</strong></div>
    <div className="clo-pe-list" aria-label="Property Editor sections">
      {CLO_PROPERTY_GROUPS.map(([id,title])=>{
        const expanded=open.includes(id)
        return <section key={id} className={`clo-pe-section ${expanded?'expanded':''}`}>
          <button type="button" className="clo-pe-trigger" aria-expanded={expanded}
            aria-controls={`clo-pe-section-${id}`} onClick={()=>toggle(id)}>
            {expanded?<ChevronDown size={13}/>:<ChevronRight size={13}/>}
            <span>{title}</span>
          </button>
          <div id={`clo-pe-section-${id}`} role="region" hidden={!expanded}
            aria-label={`${title} properties`} className="clo-pe-content">
            {overview(id)}
            {id===contextGroup&&<div className="clo-pe-existing-properties" aria-label={`${title} advanced settings`}>{children}</div>}
          </div>
        </section>
      })}
    </div>
  </>
}
