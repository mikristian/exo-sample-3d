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
  selectedArea,onSwitchSection,onShowFabric,onSimulate,onReset,onSetLineTarget,objectTab='Scene',draftLineSelection,objectSelection,
  children,
}) {
  const selection=clothcraftHybrid?clothcraftLive?.selection:null
  const nativeLine=clothcraftHybrid?(selection?.kind==='line'?selection:null):draftLineSelection
  const nativePattern=selection?.kind==='pattern'?selection:null
  const propertySubject=objectSelection?.name||(clothcraftHybrid?(selection?.panelName||'Native garment'):(selectedPiece?.name||project?.name||'Project'))
  const selectedObjectKind=objectSelection?.type?.toLowerCase()
    || (objectTab==='Fabric'&&activeSection==='Fabric'?'fabric'
    : ['Button','Buttonhole','Topstitch','Puckering','Graphic','Grading','POM'].includes(objectTab)?objectTab.toLowerCase()
    : nativeLine?'line':selection?.kind==='pattern'||selectedPiece?'pattern':'project')
  const visibleGroups=selectedObjectKind==='fabric'
    ? CLO_PROPERTY_GROUPS.filter(([id])=>['information','simulation','fabric','miscellaneous'].includes(id))
    : selectedObjectKind==='pattern'||selectedObjectKind==='line'||selectedObjectKind==='project'
      ? CLO_PROPERTY_GROUPS
      : CLO_PROPERTY_GROUPS.filter(([id])=>['information','selected-line','fabric','miscellaneous'].includes(id))
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
  useEffect(()=>{
    if(nativeLine)setOpen(previous=>previous.includes('selected-line')?previous:[...previous,'selected-line'])
  },[nativeLine?.panelId,nativeLine?.edgeId])
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
          <Readout label="Name" value={propertySubject}/>
          <Readout label="Type" value={selectedObjectKind==='line'?'Pattern Line':selectedObjectKind==='pattern'?'Pattern Piece':selectedObjectKind==='project'?'Garment Project':selectedObjectKind[0].toUpperCase()+selectedObjectKind.slice(1)}/>
          <Readout label="Item No." value={objectSelection?.id||(clothcraftHybrid?(selection?.edgeId||selection?.panelId||'—'):(selectedPiece?.id||'—'))}/>
          <Readout label="Pattern Pieces" value={clothcraftHybrid?(clothcraftLive?.panels??'Loading'):(project?.pieces?.length??0)}/>
          {!clothcraftHybrid&&selectedPiece&&<Readout label="Area" value={`${selectedArea.toFixed(1)} cm²`}/>}
          {nativePattern&&<><Readout label="2D Perimeter" value={nativePattern.length2DCm?.toFixed(2)+' cm'}/><Readout label="3D Perimeter" value={nativePattern.length3DCm?.toFixed(2)+' cm'}/></>}
          {clothcraftHybrid&&<p className="clo-pe-note">The native ClothCraft garment and EXO draft have separate property records. Native simulation is controlled by Rust.</p>}
        </>
      case 'selected-line':
        return <>
          <Readout label="Selected Pattern" value={clothcraftHybrid?(selection?.panelName||'No pattern selected'):(selectedPiece?.name||'No pattern selected')}/>
          <Readout label="Selected Line" value={nativeLine?.edgeId||'Select a line in the 2D or 3D view'}/>
          <Readout label="2D Line Length" value={nativeLine?.length2DCm!=null?`${nativeLine.length2DCm.toFixed(2)} cm`:'—'}/>
          <Readout label="3D Line Length" value={nativeLine?.length3DCm!=null?`${nativeLine.length3DCm.toFixed(2)} cm`:'—'}/>
          <Readout label="3D Stretch" value={nativeLine?.elongationPercent!=null?`${nativeLine.elongationPercent>=0?'+':''}${nativeLine.elongationPercent.toFixed(2)}%`:'—'}/>
          <Readout label="Sewing Links" value={nativeLine?nativeLine.seamIds.join(', ')||'None':selectedSeams}/>
          {nativeLine&&<form className="clo-pe-line-target" onSubmit={event=>{event.preventDefault();const value=Number(event.currentTarget.elements.namedItem('targetLength')?.value);if(Number.isFinite(value)&&value>0&&value<=1000&&nativeLine.source==='rust')onSetLineTarget?.(nativeLine.panelId,nativeLine.edgeId,value)}}>
            <label htmlFor="clo-pe-target-length">Target 2D length (cm)</label>
            <input id="clo-pe-target-length" key={`${nativeLine.panelId}:${nativeLine.edgeId}:${nativeLine.revision}`} name="targetLength" type="number" min="0.01" max="1000" step="0.01" defaultValue={(nativeLine.targetLengthCm??nativeLine.length2DCm)?.toFixed(2)||''} disabled={nativeLine.source!=='rust'||!onSetLineTarget}/>
            <button type="submit" disabled={nativeLine.source!=='rust'||!onSetLineTarget}>SET LENGTH SPEC</button>
          </form>}
          <div className="clo-pe-line-settings" aria-label="Elastic and seam taping properties">
            <div className="clo-pe-line-subheading">ELASTIC</div>
            <label><span>Elastic</span><input type="checkbox" disabled aria-label="Elastic physical simulation not yet implemented"/></label>
            <Readout label="Strength" value="10 (not simulated)"/>
            <Readout label="Ratio" value="100% (not simulated)"/>
            <Readout label="Segment Length" value={nativeLine?.length2DCm!=null?`${nativeLine.length2DCm.toFixed(2)} cm`:'—'}/>
            <div className="clo-pe-line-subheading">SEAM TAPING</div>
            <label><span>Seam Taping</span><input type="checkbox" disabled aria-label="Seam taping physical simulation not yet implemented"/></label>
            <Readout label="Width" value="— mm"/>
            <Readout label="Preset" value="Not assigned"/>
            <Readout label="Extend" value="None"/>
          </div>
          <p className="clo-pe-note">{nativeLine?.source==='rust'?'2D and 3D lengths come from the same selected Rust boundary, using pattern UVs and live simulated vertices. The editable target length is a drafting specification, not an elastic force.':'2D length comes from the selected EXO draft segment. A corresponding measured 3D simulated boundary is not yet mapped, so no 3D length is invented.'} Elastic and Seam Taping have no physical Rust solver support yet.</p>
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
          <Readout label="Assigned Fabric" value={clothcraftHybrid?(selection?.fabricName||'Select a native panel'):(selectedFabric?.name||'Not assigned')}/>
          {!clothcraftHybrid&&<div className="clo-pe-fabric"><span aria-hidden="true" style={{background:selectedFabric?.color||'#818a96'}}/>
            <strong>{selectedFabric?.name||'Fabric'}</strong>
            <small>{Number.isFinite(selectedFabric?.gsm)?`${selectedFabric.gsm} gsm`:'Material'}</small></div>}
          {clothcraftHybrid&&<p className="clo-pe-note">The native Rust fabric library is available in the Fabric workspace. Draft swatches are not substituted for native physical material properties.</p>}
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
          <Readout label="Pattern" value={clothcraftHybrid?(selection?.panelName||'No pattern selected'):(selectedPiece?.name||'No pattern selected')}/>
          {clothcraftHybrid&&selection?.positionCm?.map((cm,index)=><Readout key={index} label={`Position ${'XYZ'[index]}`} value={`${cm.toFixed(1)} cm`}/>)}
          {!clothcraftHybrid&&selectedPiece&&['X','Y','Z'].map(axis=><Readout key={axis} label={`Position ${axis}`}
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
    <div className="inspector-head clo-pe-header"><span>PROPERTY EDITOR</span><strong>{propertySubject}</strong></div>
    <div className="clo-pe-list" aria-label="Property Editor sections">
      {visibleGroups.map(([id,title])=>{
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
