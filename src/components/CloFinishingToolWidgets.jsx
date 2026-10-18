import React, {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {CornerUpLeft, X} from 'lucide-react'
import {inspectSewingLengths,sewingLengthDiagnostic} from '../core/sewingLengthDiagnostics.js'
import './CloFinishingToolWidgets.css'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const defaultPosition = kind => {
  const width = kind === 'steam' ? 390 : kind === 'grading' ? 385 : 405
  const workspace = document.querySelector('.workspaces')
  const bounds = workspace?.getBoundingClientRect()
  const centre = bounds ? bounds.left+bounds.width*.5 : window.innerWidth*.5
  const top = bounds ? bounds.top+bounds.height*.5-117.5 : window.innerHeight*.5-117.5
  return {x: clamp(Math.round(centre-width/2), 8, Math.max(8, window.innerWidth-width-8)),
    y: clamp(Math.round(top), 48, Math.max(48, window.innerHeight-235))}
}

export function CloFloatingPanel({kind, title, open, active, onClose, onActivate, children}) {
  const [position, setPosition] = useState(() => defaultPosition(kind))
  const drag = useRef(null)
  const panel = useRef(null)
  const positioned = useRef(false)
  const bounds = () => ({
    maxX:Math.max(8,window.innerWidth-(panel.current?.offsetWidth||(kind==='steam'?390:kind==='grading'?385:405))-8),
    maxY:Math.max(45,window.innerHeight-(panel.current?.offsetHeight||235)-8),
  })
  useEffect(() => {
    if (!open) return undefined
    // On initial React render the workspace DOM may not yet be committed.
    // Centre the first opening against the actual 3D/2D panes, then preserve
    // the user's dragged position across subsequent closes and reopens.
    const firstOpen = !positioned.current
    if (firstOpen) {
      positioned.current = true
      setPosition(defaultPosition(kind))
    }
    const fit = () => setPosition(pos => {
      const {maxX,maxY}=bounds()
      return {x:clamp(pos.x,8,maxX),y:clamp(pos.y,45,maxY)}
    })
    // A panel's final height is only measurable after it is mounted. Keep it
    // inside the window as soon as the browser has laid out its contents.
    fit()
    const frame = window.requestAnimationFrame(() => {
      if (firstOpen && panel.current && !drag.current) {
        const workspace = document.querySelector('.workspaces')?.getBoundingClientRect()
        const centerY = workspace ? workspace.top + workspace.height / 2 : window.innerHeight / 2
        const {maxY} = bounds()
        // Measure the rendered height so every widget, including grading,
        // opens at the actual workspace center regardless of its form rows.
        setPosition(pos => ({...pos,y:clamp(Math.round(centerY-panel.current.offsetHeight/2),45,maxY)}))
      }
      fit()
    })
    window.addEventListener('resize', fit)
    return () => {window.cancelAnimationFrame(frame);window.removeEventListener('resize', fit)}
  }, [open, kind])
  if (!open) return null
  const startDrag = event => {
    if (event.button !== 0 || event.target.closest('button, input, select')) return
    drag.current = {pointerId:event.pointerId, x:event.clientX, y:event.clientY,
      left:position.x, top:position.y}
    event.currentTarget.setPointerCapture(event.pointerId)
    onActivate?.(kind)
    event.preventDefault()
  }
  const moveDrag = event => {
    if (drag.current?.pointerId!==event.pointerId) return
    const {maxX,maxY}=bounds()
    setPosition({
      x:clamp(drag.current.left+event.clientX-drag.current.x,8,maxX),
      y:clamp(drag.current.top+event.clientY-drag.current.y,45,maxY),
    })
  }
  const endDrag = event => {
    if (drag.current?.pointerId!==event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    drag.current = null
  }
  const loseCapture = event => {
    if (drag.current?.pointerId===event.pointerId) drag.current=null
  }
  return createPortal(<section ref={panel} className={`clo-floating-tool ${active?'is-active':''}`} role="dialog"
    aria-label={title} data-clo-floating-widget={kind} data-clo-widget-active={String(active)}
    style={{left:position.x,top:position.y}} onPointerDown={()=>onActivate?.(kind)}
    onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onClose(kind)}}}>
    <header className="clo-floating-tool-header" onPointerDown={startDrag} onPointerMove={moveDrag}
      onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={loseCapture} aria-label={`Move ${title} panel`}>
      <span className="clo-floating-tool-grip" aria-hidden="true">⋮</span>
      <strong>{title}</strong>
      <button type="button" onClick={()=>onClose(kind)} title={`Close ${title}`} aria-label={`Close ${title}`}><X size={15}/></button>
    </header>
    {children}
  </section>, document.body)
}

function ThresholdField({name, enabled, onEnabled, value, onValue, max, suffix, step}) {
  return <label className="clo-sewing-threshold">
    <span className="clo-threshold-name"><input type="checkbox" checked={enabled}
      onChange={event=>onEnabled(event.target.checked)}/>{name}</span>
    <span className="clo-finishing-number">
      <input type="number" min="0" max={max} step={step} value={value}
        disabled={!enabled} aria-label={`${name} threshold`}
        onChange={event=>{if(event.target.value!=='')onValue(clamp(Number(event.target.value)||0,0,max))}}/>
      <span>{suffix}</span>
    </span>
  </label>
}

function SteamSlider({label,value,onChange,min,max,unit,ticks}) {
  return <label className="clo-steam-row">
    <span className="clo-steam-label">{label}</span>
    <span className="clo-steam-slide">
      <input type="range" aria-label={label} min={min} max={max} step="1" value={value}
        style={{'--steam-progress':`${(value-min)/(max-min)*100}%`}}
        onChange={event=>onChange(Number(event.target.value))}/>
      {ticks&&<span className="clo-steam-ticks"><i>{min>0?'':min}</i><i>+{max}</i></span>}
    </span>
    <span className="clo-finishing-number">
      <input type="number" aria-label={`${label} numeric value`} min={min} max={max}
        step="1" value={value} onChange={event=>{if(event.target.value!=='')onChange(clamp(Number(event.target.value)||0,min,max))}}/>
      <span>{unit}</span>
    </span>
  </label>
}

export default function CloFinishingToolWidgets({openSewing=false,openSteam=false,active=null,
  onClose,onActivate,selection=null,seamRefs=[],seamMeasurements=[],onSelectSeam,legacySeam=null}) {
  const [lengthOn,setLengthOn]=useState(true)
  const [ratioOn,setRatioOn]=useState(true)
  const [lengthThreshold,setLengthThreshold]=useState(.5)
  const [ratioThreshold,setRatioThreshold]=useState(10)
  const [steam,setSteam]=useState({shrinkage:-3,size:130,hardness:70})
  const nativeSewing=selection?.kind==='sewing'?selection:null
  const options={lengthOn,ratioOn,lengthThreshold,ratioThreshold}
  const activeMeasurement=nativeSewing||(
    legacySeam?{seamId:null,first:{length2DCm:legacySeam.lengthA},second:{length2DCm:legacySeam.lengthB}}:null)
  const activeDiagnostic=sewingLengthDiagnostic(activeMeasurement,options)
  const diagnostics=inspectSewingLengths(seamMeasurements,options)
  const firstCm=activeDiagnostic.firstCm,secondCm=activeDiagnostic.secondCm
  const hasPair=activeDiagnostic.valid
  const setSteamValue=(key,value)=>setSteam(current=>({...current,[key]:value}))
  return <>
    <CloFloatingPanel kind="sewing" title="Check Sewing Length" open={openSewing}
      active={active==='sewing'} onClose={onClose} onActivate={onActivate}>
      <div className="clo-floating-tool-body">
        <div className="clo-finishing-inset" aria-label="Sewing length tolerance settings">
          <ThresholdField name="Length Difference" enabled={lengthOn} onEnabled={setLengthOn}
            value={lengthThreshold} onValue={setLengthThreshold} max={100} step={.05} suffix="cm"/>
          <ThresholdField name="Ratio Difference" enabled={ratioOn} onEnabled={setRatioOn}
            value={ratioThreshold} onValue={setRatioThreshold} max={100} step={.5} suffix="%"/>
        </div>
        <div className="clo-finishing-seam-status" role="status">
          {hasPair ? <>
            <span>{nativeSewing?.seamId||'Selected sewing'} · {firstCm.toFixed(2)} / {secondCm.toFixed(2)} cm</span>
            <strong className={activeDiagnostic.warning?'clo-finishing-warning':'clo-finishing-ok'}>
              {activeDiagnostic.signedDifferenceCm>=0?'+':''}{activeDiagnostic.signedDifferenceCm.toFixed(2)} cm · {activeDiagnostic.differencePercent.toFixed(1)}% {activeDiagnostic.warning?'Mismatch':'Within tolerance'}
            </strong>
          </> : <span>{seamRefs.length? 'Select a seam to inspect its measured lengths':'No sewn edge pair selected'}</span>}
        </div>
        {seamRefs.length>0&&<select className="clo-finishing-seam-selector" aria-label="Inspect sewing relationship"
          value={nativeSewing?.seamId||''} onChange={event=>onSelectSeam?.(event.target.value)}>
          <option value="">Select sewn edges…</option>
          {seamRefs.map(seam=><option key={seam.id} value={seam.id}>{seam.id} · {seam.first} / {seam.second}</option>)}
        </select>}
        {seamMeasurements.length>0&&<div className="clo-finishing-seam-review" data-native-sewing-length-review="true" aria-label="All native sewing length differences">
          <div className="clo-finishing-seam-overview" role="status">
            <strong>{diagnostics.warnings} over tolerance</strong>
            <span>{diagnostics.measured}/{diagnostics.total} measured{diagnostics.unavailable? ` · ${diagnostics.unavailable} unavailable`:''}</span>
          </div>
          <div className="clo-finishing-seam-pairs" role="list">
            {diagnostics.rows.map(row=><button type="button" key={row.seamId} role="listitem"
              data-sew-length-state={!row.valid?'unavailable':row.warning?'warning':'within-tolerance'}
              aria-pressed={nativeSewing?.seamId===row.seamId}
              onClick={()=>onSelectSeam?.(row.seamId)}>
              <span className="clo-finishing-seam-pair-name">{row.seamId}</span>
              <span className="clo-finishing-seam-pair-values">{row.valid?
                `${row.firstCm.toFixed(2)} / ${row.secondCm.toFixed(2)} cm`:'Measurement unavailable'}</span>
              <strong>{row.valid?`${row.signedDifferenceCm>=0?'+':''}${row.signedDifferenceCm.toFixed(2)} cm · ${row.differencePercent.toFixed(1)}%`:'—'}</strong>
            </button>)}
          </div>
          <small>Measured along the native 2D sewing intervals. The signed difference is first minus second; percent difference uses the longer edge. The 3D draped lengths remain independent in Sewing Properties.</small>
        </div>}
      </div>
    </CloFloatingPanel>
    <CloFloatingPanel kind="steam" title="Steam Brush" open={openSteam}
      active={active==='steam'} onClose={onClose} onActivate={onActivate}>
      <div className="clo-floating-tool-body">
        <div className="clo-finishing-inset" aria-label="Steam brush parameters">
          <SteamSlider label="Shrinkage" value={steam.shrinkage} onChange={value=>setSteamValue('shrinkage',value)}
            min={-100} max={100} unit="%" ticks/>
          <SteamSlider label="Size" value={steam.size} onChange={value=>setSteamValue('size',value)}
            min={10} max={300} unit="mm"/>
          <SteamSlider label="Hardness" value={steam.hardness} onChange={value=>setSteamValue('hardness',value)}
            min={0} max={100} unit="%"/>
        </div>
        <div className="clo-steam-footer">
          <button type="button" aria-label="Reset steam brush settings" title="Reset to CLO reference values"
            onClick={()=>setSteam({shrinkage:-3,size:130,hardness:70})}><CornerUpLeft size={15}/></button>
          <span>Brush settings preview · cloth steam simulation unavailable</span>
        </div>
      </div>
    </CloFloatingPanel>
  </>
}
