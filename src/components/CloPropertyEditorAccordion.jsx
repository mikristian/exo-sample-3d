import React, {useEffect, useRef, useState} from 'react'
import {ChevronDown, ChevronRight} from 'lucide-react'
import CloObjectPropertyFields from './CloObjectPropertyFields.jsx'
import {resolveCloDraftTarget} from '../core/cloPropertyCommands.js'
import {CLO_LENGTH_UNITS,fromCentimetres,toCentimetresValue,formatPropertyLength} from '../core/cloPropertyUnits.js'
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

// These are real selection classes, not extra accordion headings shown for
// every pattern. CLO's Fabric asset and a fabric assigned to a pattern have
// different editors; the same is true of topstitch and hardware instances.
const CONTEXT_GROUPS={
  sewing:[['information','Information'],['sewing','Sewing'],['miscellaneous','Miscellaneous']],
  button:[['information','Information'],['button','Button'],['position','2D Placement'],['miscellaneous','Miscellaneous']],
  buttonhole:[['information','Information'],['buttonhole','Buttonhole'],['position','2D Placement'],['miscellaneous','Miscellaneous']],
  topstitch:[['information','Information'],['topstitch','Stitch'],['miscellaneous','Miscellaneous']],
  graphic:[['information','Information'],['graphic','Graphic'],['position','2D Placement'],['miscellaneous','Miscellaneous']],
  avatar:[['information','Information'],['miscellaneous','Miscellaneous']],
  grading:[['information','Information'],['grading','Grading'],['miscellaneous','Miscellaneous']],
  pom:[['information','Information'],['pom','POM'],['miscellaneous','Miscellaneous']],
  puckering:[['information','Information'],['puckering','Puckering'],['miscellaneous','Miscellaneous']],
}

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
  selectedArea,onSwitchSection,onShowFabric,onSimulate,onReset,onSetLineTarget,objectTab='Scene',draftLineSelection,objectSelection,onPropertyEdit,onSelectNativeSeam,
  children,
}) {
  const selection=clothcraftHybrid?clothcraftLive?.selection:null
  const nativeLine=clothcraftHybrid?(selection?.kind==='line'?selection:null):draftLineSelection
  const nativeSewing=selection?.kind==='sewing'?selection:null
  const nativePattern=selection?.kind==='pattern'?selection:null
  const propertySubject=objectSelection?.name||(clothcraftHybrid?(selection?.panelName||'Native garment'):(selectedPiece?.name||project?.name||'Project'))
  const selectedObjectKind=objectSelection?.type?.toLowerCase()
    || (objectTab==='Fabric'&&activeSection==='Fabric'?'fabric'
    : ['Button','Buttonhole','Topstitch','Puckering','Graphic','Grading','POM'].includes(objectTab)?objectTab.toLowerCase()
    : nativeLine?'line':nativeSewing?'sewing':selection?.kind==='pattern'||selectedPiece?'pattern':'project')
  const visibleGroups=CONTEXT_GROUPS[selectedObjectKind] || (selectedObjectKind==='fabric'
    ? CLO_PROPERTY_GROUPS.filter(([id])=>['information','simulation','fabric','miscellaneous'].includes(id))
    : selectedObjectKind==='pattern'||selectedObjectKind==='line'||selectedObjectKind==='project'
      ? CLO_PROPERTY_GROUPS
      : CLO_PROPERTY_GROUPS.filter(([id])=>['information','miscellaneous'].includes(id)))
  const draftSelection=!clothcraftHybrid?(objectSelection?.type==='Scene'&&objectSelection.pieceId
    ? {...objectSelection,type:'pattern'}
    : objectSelection|| (selectedPiece ? {type:'pattern',id:selectedPiece.id,pieceId:selectedPiece.id,name:selectedPiece.name}:null)):null
  const draftObject=resolveCloDraftTarget(project,draftSelection)
  const contextGroup=EDITOR_GROUP_FOR_SECTION[activeSection]||'miscellaneous'
  const [open,setOpen]=useState(()=>['information'])
  const [lengthUnit,setLengthUnit]=useState('cm')
  const length=cm=>formatPropertyLength(cm,lengthUnit)
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
  useEffect(()=>{
    if(!objectSelection)return
    const relevant={fabric:'fabric',button:'button',buttonhole:'buttonhole',topstitch:'topstitch',graphic:'graphic',grading:'grading',pom:'pom',puckering:'puckering'}[selectedObjectKind]
    if(relevant)setOpen(previous=>previous.includes(relevant)?previous:[...previous,relevant])
  },[objectSelection?.id,selectedObjectKind])
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
          {nativePattern&&<><Readout label="2D Perimeter" value={length(nativePattern.length2DCm)}/><Readout label="3D Perimeter" value={length(nativePattern.length3DCm)}/><Readout label="Boundary Count" value={nativePattern.edgeCount}/></>}
          {draftObject&&<CloObjectPropertyFields group="information" selection={draftSelection} project={project} onEdit={onPropertyEdit}/>}
          {clothcraftHybrid&&<p className="clo-pe-note">The native ClothCraft garment and EXO draft have separate property records. Native simulation is controlled by Rust.</p>}
        </>
      case 'selected-line':
        return <>
          <Readout label="Selected Pattern" value={clothcraftHybrid?(selection?.panelName||'No pattern selected'):(selectedPiece?.name||'No pattern selected')}/>
          <Readout label="Selected Line" value={nativeLine?.edgeId||'Select a line in the 2D or 3D view'}/>
          <Readout label="2D Line Length" value={length(nativeLine?.length2DCm)}/>
          <Readout label="3D Line Length" value={length(nativeLine?.length3DCm)}/>
          <Readout label="3D Stretch" value={nativeLine?.elongationPercent!=null?`${nativeLine.elongationPercent>=0?'+':''}${nativeLine.elongationPercent.toFixed(2)}%`:'—'}/>
          <Readout label="Sewing Links" value={nativeLine?nativeLine.seamIds.join(', ')||'None':selectedSeams}/>
          {nativeLine&&<form className="clo-pe-line-target" onSubmit={event=>{event.preventDefault();const value=toCentimetresValue(Number(event.currentTarget.elements.namedItem('targetLength')?.value),lengthUnit);if(Number.isFinite(value)&&value>=0.01&&value<=1000&&nativeLine.source==='rust')onSetLineTarget?.(nativeLine.panelId,nativeLine.edgeId,value)}}>
            <label htmlFor="clo-pe-target-length">Target 2D length ({lengthUnit})</label>
            <input id="clo-pe-target-length" key={`${nativeLine.panelId}:${nativeLine.edgeId}:${nativeLine.revision}:${lengthUnit}`} name="targetLength" type="number" min={fromCentimetres(.01,lengthUnit)} max={fromCentimetres(1000,lengthUnit)} step="any" defaultValue={fromCentimetres(nativeLine.targetLengthCm??nativeLine.length2DCm,lengthUnit)?.toFixed(lengthUnit==='in'?3:lengthUnit==='mm'?1:2)||''} disabled={nativeLine.source!=='rust'||!onSetLineTarget}/>
            <button type="submit" disabled={nativeLine.source!=='rust'||!onSetLineTarget}>SET LENGTH SPEC</button>
          </form>}
          <div className="clo-pe-line-settings" aria-label="Elastic and seam taping properties">
            <div className="clo-pe-line-subheading">ELASTIC</div>
            <label><span>Elastic</span><input type="checkbox" disabled aria-label="Elastic physical simulation not yet implemented"/></label>
            <Readout label="Strength" value="10 (not simulated)"/>
            <Readout label="Ratio" value="100% (not simulated)"/>
            <Readout label="Segment Length" value={length(nativeLine?.length2DCm)}/>
            <div className="clo-pe-line-subheading">SEAM TAPING</div>
            <label><span>Seam Taping</span><input type="checkbox" disabled aria-label="Seam taping physical simulation not yet implemented"/></label>
            <Readout label="Width" value="— mm"/>
            <Readout label="Preset" value="Not assigned"/>
            <Readout label="Extend" value="None"/>
          </div>
          <p className="clo-pe-note">{nativeLine?.source==='rust'?'2D and 3D lengths come from the same selected Rust boundary, using pattern UVs and live simulated vertices. The editable target length is a drafting specification, not an elastic force.':'2D length comes from the selected EXO draft segment. A corresponding measured 3D simulated boundary is not yet mapped, so no 3D length is invented.'} Elastic and Seam Taping have no physical Rust solver support yet.</p>
          {activeSection!=='Sewing'&&<button className="clo-pe-action" onClick={()=>onSwitchSection('Sewing')}>OPEN SEWING PROPERTIES</button>}
        </>
      case 'sewing':
        return <>
          <Readout label="Sewing Relationship" value={nativeSewing?.seamId||'Select sewing in the native seam list'}/>
          {nativeSewing&&<>
            <Readout label="First Edge" value={`${nativeSewing.first.panel} · ${nativeSewing.first.edge}`}/>
            <Readout label="First 2D Line Length" value={length(nativeSewing.first.length2DCm)}/>
            <Readout label="First 3D Line Length" value={length(nativeSewing.first.length3DCm)}/>
            <Readout label="Second Edge" value={`${nativeSewing.second.panel} · ${nativeSewing.second.edge}`}/>
            <Readout label="Second 2D Line Length" value={length(nativeSewing.second.length2DCm)}/>
            <Readout label="Second 3D Line Length" value={length(nativeSewing.second.length3DCm)}/>
            <Readout label="Measured 3D Seam Gap" value={nativeSewing.gapMm!=null?`${nativeSewing.gapMm.toFixed(2)} mm`:'Not simulated'}/>
            <Readout label="Reverse Orientation" value={nativeSewing.reversed?'Yes':'No'}/>
            <Readout label="Ease Allowed" value={nativeSewing.allowEase?'Yes':'No'}/>
            <Readout label="Native Seam Stiffness" value={nativeSewing.nativeStiffnessNPerM2!=null?`${nativeSewing.nativeStiffnessNPerM2.toFixed(0)} N/m²`:'—'}/>
          </>}
          <div className="clo-pe-line-settings"><div className="clo-pe-line-subheading">SEWING TENSION</div>
          <Readout label="Strength" value="Not implemented"/><Readout label="Ratio" value="Not implemented"/>
          <div className="clo-pe-line-subheading">FOLD</div><Readout label="Turned" value="Not implemented"/>
          <Readout label="Fold Angle" value="Not implemented"/><Readout label="Fold Strength" value="Not implemented"/></div>
          <p className="clo-pe-note">Native Rust reports real paired sewing lengths, seam geometry and correspondence. CLO-style tension and fold controls require new solver constraints; they cannot be emulated by an appearance-only toggle.</p>
        </>
      case 'simulation':
        return <>
          {draftObject&&<CloObjectPropertyFields group="simulation" selection={draftSelection} project={project} onEdit={onPropertyEdit}/>}
          {nativePattern&&<>
            <Readout label="Actual Rust vertices" value={nativePattern.meshVertexCount}/>
            <Readout label="Actual Rust triangles" value={nativePattern.meshTriangleCount}/>
            <Readout label="Mesh edge target" value={nativePattern.meshTargetEdgeMm!=null?`${nativePattern.meshTargetEdgeMm.toFixed(2)} mm`:'Mesh preset · not specified'}/>
            <Readout label="Material thickness" value={nativePattern.materialThicknessMm!=null?`${nativePattern.materialThicknessMm.toFixed(3)} mm`:'—'}/>
          </>}
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
          {draftObject&&<CloObjectPropertyFields group="fabric" selection={draftSelection} project={project} onEdit={onPropertyEdit}/>}
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
          {draftObject&&<CloObjectPropertyFields group="arrange" selection={draftSelection} project={project} onEdit={onPropertyEdit}/>}
          {nativePattern?.grainAngleDeg!=null&&<Readout label="Native Grain Direction" value={`${nativePattern.grainAngleDeg.toFixed(2)}°`}/>}
          {nativePattern?.rotationDeg?.map((deg,index)=><Readout key={`rot-${index}`} label={`3D Rotation ${'XYZ'[index]}`} value={`${deg.toFixed(2)}°`}/>)}
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
          {!draftObject&&objectSelection&&<p className="clo-pe-note">Selected {selectedObjectKind} has no validated editable settings in this session. Its unavailable CLO properties are documented in the property parity audit.</p>}
          {activeSection!=='Render'&&<button className="clo-pe-action" onClick={()=>onSwitchSection('Render')}>RENDER / ENVIRONMENT SETTINGS</button>}
        </>
      case 'button':case 'buttonhole':case 'topstitch':case 'graphic':case 'position':
        return draftObject?<CloObjectPropertyFields group={id} selection={draftSelection} project={project} onEdit={onPropertyEdit}/>:<p className="clo-pe-note">Select an EXO draft object to edit these properties. Rust garment objects have separate schemas and must not inherit EXO draft values.</p>
      case 'grading':
        return <><Readout label="Size" value={objectSelection?.id||'—'}/><Readout label="Available Sizes" value={project.grading?.sizes?.join(', ')||'—'}/><p className="clo-pe-note">Grading rules and size deltas are authored in the Production workspace. Selection does not mutate the base pattern.</p></>
      case 'pom': {
        const pom=project.customMeasurements?.find((m,i)=>String(m.id??i)===String(objectSelection?.id))
        return <><Readout label="Measurement" value={pom?.name||'—'}/><Readout label="Draft Value" value={typeof pom?.valueCm==='number'?`${pom.valueCm.toFixed(2)} cm`:'Not independently measured'}/><p className="clo-pe-note">See Production for traced 2D/3D POM construction and size grading. Unmapped 3D length is never copied from the 2D value.</p></>
      }
      case 'puckering':return <p className="clo-pe-note">Puckering patterns and seam-tension physics are not wired to the native solver yet; no simulated value is implied.</p>
      default:return null
    }
  }

  return <>
    <div className="inspector-head clo-pe-header"><span>PROPERTY EDITOR</span><strong>{propertySubject}</strong></div>
    <label className="clo-pe-unit-selection">Measurement Display
      <select aria-label="Property Editor length unit" value={lengthUnit} onChange={event=>setLengthUnit(event.target.value)}>
        {CLO_LENGTH_UNITS.map(unit=><option key={unit} value={unit}>{unit}</option>)}
      </select>
    </label>
    {clothcraftHybrid&&activeSection==='Sewing'&&clothcraftLive?.seamRefs?.length>0&&
      <label className="clo-pe-native-seam-picker">Sewing Relationship
        <select aria-label="Select native sewing relationship" value={nativeSewing?.seamId||''}
          onChange={event=>onSelectNativeSeam?.(event.target.value)}>
          <option value="">Select a sewn edge pair…</option>
          {clothcraftLive.seamRefs.map(ref=><option key={ref.id} value={ref.id}>{ref.id} · {ref.first} ↔ {ref.second}</option>)}
        </select>
      </label>}
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
            {(id===contextGroup||(!visibleGroups.some(([key])=>key===contextGroup)&&id==='miscellaneous'))&&<div className="clo-pe-existing-properties" aria-label={`${title} advanced settings`}>{children}</div>}
          </div>
        </section>
      })}
    </div>
    {!visibleGroups.some(([id])=>id==='arrange')&&<div id="clo-pattern-properties-host" className="clo-pattern-properties-host" hidden/>}
  </>
}
