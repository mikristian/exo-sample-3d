import React, {useState} from 'react'
import {Layers3, ScanLine, Spline, Scissors, Ruler} from 'lucide-react'
import ViewportQuickTools from './ViewportQuickTools.jsx'
import './ClothCraftCornerTools.css'

// Reuse Garment Studio's real CAD widget/icon system. Map only the commands
// available in the Rust-linked ClothCraft canvas to working V2 interactions.
const MODE_BY_TOOL = {
  '2d': {select:'edit',point:'edit',split:'edit',curve:'edit',polygon:'pen',measure:'edit',sew:'sew',internal:'line',notch:'edit',allowance:'edit'},
  '3d': {orbit:'edit',transform:'move3d',move:'move3d',rotate:'rotate3d',hand:'stretch3d'},
}
const ACTIVE_TOOL = {
  '2d': {edit:'select',sew:'sew',line:'internal',pen:'polygon'},
  '3d': {edit:'orbit',move3d:'move',rotate3d:'rotate',stretch3d:'hand'},
}

export default function ClothCraftCornerTools({dimension,mode,activeTool:controlledTool,onChangeMode,onChangeTool,disabled=false,
  displayLayers, onToggleDisplayLayer, allowanceWidthMm=10,onChangeAllowanceWidth,selectedGuide,onCreateGuideLine,onRemoveGuideLine,onClearGuide,cameraHandControl}) {
  const tools = MODE_BY_TOOL[dimension] || {}
  const [lastTool,setLastTool] = useState(null)
  const [displayOpen,setDisplayOpen] = useState(false)
  const [displayHovered,setDisplayHovered] = useState(false)
  const [displayFocused,setDisplayFocused] = useState(false)
  const [displayDismissed,setDisplayDismissed] = useState(false)
  const activeTool = controlledTool && tools[controlledTool] === mode ? controlledTool : lastTool && tools[lastTool] === mode
    ? lastTool : (ACTIVE_TOOL[dimension]?.[mode] || 'select')
  const displayVisible = !displayDismissed && (displayOpen || displayHovered || displayFocused)
  const displayGroup=dimension==='2d' ? <div className="canvas-tool-group clo-corner-tool-group cc-2d-display-host"
    data-tool-family="pattern-display" data-open={String(displayVisible)} data-dismissed={String(displayDismissed)}
    onPointerEnter={()=>{setDisplayHovered(true);setDisplayDismissed(false)}}
    onPointerLeave={()=>setDisplayHovered(false)}
    onFocusCapture={()=>{setDisplayFocused(true);setDisplayDismissed(false)}}
    onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setDisplayFocused(false)}}
    onKeyDown={event=>{
      if(event.key==='Escape'){
        event.preventDefault();event.stopPropagation()
        setDisplayOpen(false);setDisplayHovered(false);setDisplayFocused(false);setDisplayDismissed(true)
        event.currentTarget.querySelector('.cc-2d-display-trigger')?.focus()
      } else if(event.key==='ArrowRight' && event.target.classList.contains('cc-2d-display-trigger')){
        event.preventDefault()
        setDisplayDismissed(false)
        event.currentTarget.querySelector('.cc-2d-display-menu > button')?.focus()
      }
    }}>
    <button type="button" className="cc-2d-display-trigger" aria-label="2D Pattern Display"
      title="2D Pattern Display · hover to toggle reference, internal, notch and allowance guides"
      aria-expanded={displayVisible} aria-haspopup="true"
      onClick={()=>{setDisplayDismissed(false);setDisplayOpen(value=>!value)}}>
      <Layers3 size={19}/>
      <span className="clo-corner-flyout-caret" aria-hidden="true"/>
    </button>
    <div className="canvas-tool-options clo-corner-tool-options cc-2d-display-menu" role="group" aria-label="2D Pattern Display options">
      {[
        ['reference','Show Reference Lines',ScanLine],
        ['internal','Show Internal Lines',Spline],
        ['notches','Show Notches',Scissors],
        ['allowances','Show Seam Allowance',Ruler],
      ].map(([key,label,Icon])=><button key={key} type="button"
        className={`cc-2d-display-option${displayLayers?.[key]?' active':''}`}
        aria-label={label} title={label} aria-pressed={Boolean(displayLayers?.[key])}
        onClick={()=>onToggleDisplayLayer?.(key)}>
        <Icon size={19} aria-hidden="true"/>
      </button>)}
    </div>
    {(controlledTool==='allowance'||selectedGuide)&&<div className="cc-2d-display-details">
      {controlledTool==='allowance'&&<label className="cc-2d-display-width">Allowance (mm)
        <input aria-label="Seam allowance width in millimetres" type="number"
          min=".1" max="500" step=".5" value={allowanceWidthMm}
          onChange={event=>onChangeAllowanceWidth?.(Number(event.target.value))}/>
      </label>}
      {selectedGuide&&<div className="cc-2d-display-selection">
        <span>{selectedGuide.kind.replaceAll('-',' ')} · {(selectedGuide.lengthMetres*100).toFixed(2)} cm</span>
        {selectedGuide.nativeLineId
          ?<button type="button" onClick={onRemoveGuideLine} disabled={disabled}>Remove native internal line</button>
          :<button type="button" onClick={onCreateGuideLine} disabled={disabled}>Create native internal line</button>}
        <button type="button" onClick={onClearGuide}>Clear selection</button>
      </div>}
    </div>}
  </div> : null
  return <div className="cc-corner-tool-host">
    <ViewportQuickTools dimension={dimension}
      extraGroup={dimension==='3d'&&cameraHandControl
        ?<div className="canvas-tool-group clo-corner-tool-group cc-3d-camera-hand-host" data-tool-family="camera-hand">{cameraHandControl}</div>
        :displayGroup}
      activeTool={activeTool}
      availableTools={Object.keys(tools)}
      disabled={disabled}
      onChangeTool={name => {
        if (tools[name]) {
          setLastTool(name)
          onChangeTool?.(name)
          onChangeMode?.(tools[name])
        }
      }}/>
  </div>
}
