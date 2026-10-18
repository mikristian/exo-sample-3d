import React, {useEffect, useRef, useState} from 'react'
import {ImagePlus, Lock, LockOpen, Eye, EyeOff, Trash2, Ruler, X} from 'lucide-react'
import './PatternReferenceImage.css'

// Reference photos are editor aids, never printed garment graphics or solver data.
// Store the compressed photo with its placement in IndexedDB so browser storage
// limits on the actual pattern project are not affected by image file size.
const DB_NAME = 'exo-clothcraft-2d-references'
const STORE = 'images'
const between = (value, min, max) => Math.max(min, Math.min(max, value))
const pendingSaves = new Map()

function imageDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('Image storage is unavailable in this browser')); return }
    const request = window.indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

async function storedImage(key, replacement) {
  const db = await imageDB()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, replacement === undefined ? 'readonly' : 'readwrite')
      const request = replacement === undefined ? transaction.objectStore(STORE).get(key)
        : replacement === null ? transaction.objectStore(STORE).delete(key)
          : transaction.objectStore(STORE).put(replacement, key)
      let value
      request.onsuccess = () => { value = request.result }
      request.onerror = () => reject(request.error)
      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => resolve(value)
    })
  } finally { db.close() }
}

function saveImageInOrder(key, image) {
  const previous = pendingSaves.get(key) || Promise.resolve()
  const next = previous.catch(() => {}).then(() => storedImage(key, image))
  pendingSaves.set(key, next)
  next.finally(() => { if (pendingSaves.get(key) === next) pendingSaves.delete(key) }).catch(() => {})
  return next
}

async function convertFile(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPG or WebP image')
  if (file.size > 30 * 1024 * 1024) throw new Error('The reference image must be under 30 MB')
  const source = URL.createObjectURL(file)
  try {
    const photo = new Image()
    await new Promise((resolve, reject) => {
      photo.onload = resolve
      photo.onerror = () => reject(new Error('This image could not be opened'))
      photo.src = source
    })
    const naturalWidth = photo.naturalWidth, naturalHeight = photo.naturalHeight
    if (!naturalWidth || !naturalHeight) throw new Error('The selected photo has no dimensions')
    const shrink = Math.min(1, 2400 / Math.max(naturalWidth, naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(naturalWidth * shrink))
    canvas.height = Math.max(1, Math.round(naturalHeight * shrink))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('The image could not be processed')
    context.drawImage(photo, 0, 0, canvas.width, canvas.height)
    return {src:canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', .86), naturalWidth, naturalHeight}
  } finally { URL.revokeObjectURL(source) }
}

// Use the image node's own screen matrix: it works for both the standalone
// centimetre SVG and the translated native metre SVG, at every zoom level.
function localSvgPoint(event, node) {
  const matrix = node?.getScreenCTM()?.inverse()
  if (!matrix) return null
  const p = node.ownerSVGElement.createSVGPoint()
  p.x = event.clientX
  p.y = event.clientY
  const converted = p.matrixTransform(matrix)
  return {x:converted.x, y:converted.y}
}

/** One photo below pattern artwork, with control panel independently overlaid. */
export function usePatternReferenceImage(documentKey) {
  const [image, setImage] = useState(null)
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState('')
  useEffect(() => {
    let active = true
    setReady(false)
    setImage(null)
    setStorageError('')
    storedImage(`ref2d:${documentKey}`).then(saved => {
      if (active) { setImage(saved || null); setReady(true) }
    }).catch(() => {
      if (active) { setReady(true); setStorageError('Photo changes will be available only until this tab closes') }
    })
    return () => { active = false }
  }, [documentKey])
  useEffect(() => {
    if (!ready) return undefined
    const timer = window.setTimeout(() => {
      saveImageInOrder(`ref2d:${documentKey}`, image ? {...image,calibrating:false} : null).then(() => setStorageError(''))
        .catch(() => setStorageError('Could not save the photo on this device; free browser storage to keep it'))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [documentKey, ready, image])
  return {image, setImage, storageError}
}

export function PatternReferenceImageLayer({image, setImage, unitsPerCm=1, interactive=true}) {
  const drag = useRef(null)
  const [calibration, setCalibration] = useState([])
  useEffect(() => { setCalibration([]) }, [image?.src])
  if (!image || image.visible === false) return null
  const w=image.width, h=w * image.naturalHeight / image.naturalWidth
  const onDown=event => {
    if (!interactive || (image.locked && !image.calibrating) || event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()
    if (image.calibrating) {
      const p=localSvgPoint(event,event.currentTarget)
      if (!p) return
      const points=calibration.length===1 ? [...calibration,p] : [p]
      setCalibration(points)
      if (points.length===2) {
        const measured=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)
        const lengthCm=Number(image.calibrationCm??10)
        if (!Number.isFinite(lengthCm)||lengthCm<=0 || measured<1e-6) {
          setImage(previous=>previous&&({...previous,calibrationError:'Enter a positive known distance and select two different points'}))
        } else {
          const ratio=lengthCm*unitsPerCm/measured
          setImage(previous=>previous&&({ ...previous,width:between(previous.width*ratio,unitsPerCm,100000*unitsPerCm),
            x:points[0].x-(points[0].x-previous.x)*ratio,
            y:points[0].y-(points[0].y-previous.y)*ratio,
            calibrating:false,locked:true,calibrationError:'' }))
          setCalibration([])
        }
      }
      return
    }
    const start=localSvgPoint(event,event.currentTarget)
    if (!start) return
    drag.current={pointerId:event.pointerId,start,x:image.x,y:image.y}
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move=event=>{
    if (!drag.current || drag.current.pointerId!==event.pointerId) return
    event.stopPropagation()
    const now=localSvgPoint(event,event.currentTarget)
    if (now) setImage(previous=>previous&&({...previous,
      x:drag.current.x+now.x-drag.current.start.x,
      y:drag.current.y+now.y-drag.current.start.y}))
  }
  const end=event=>{
    if(drag.current?.pointerId===event.pointerId){event.stopPropagation();drag.current=null}
  }
  return <>
    <g data-2d-reference-image={image.name} data-reference-locked={String(image.locked)} data-reference-width-cm={(w/unitsPerCm).toFixed(2)}
      data-calibration-error={image.calibrationError||undefined}>
      <image href={image.src} x={image.x} y={image.y} width={w} height={h}
        opacity={image.opacity ?? .5} preserveAspectRatio="none" pointerEvents="none"/>
      <rect x={image.x} y={image.y} width={w} height={h} fill="transparent"
        pointerEvents={interactive && (!image.locked || image.calibrating)?'all':'none'}
        data-2d-reference-hit="true" style={{cursor:image.calibrating?'crosshair':'move'}}
        onPointerDown={onDown} onPointerMove={move} onPointerUp={end} onPointerCancel={end}/>
      {interactive && image.calibrating && calibration.map((p,i)=><circle key={i} cx={p.x} cy={p.y}
        r={Math.max(w/100,.007*unitsPerCm)} fill="#12b8e6" stroke="#ffffff" strokeWidth={Math.max(w/300,.002*unitsPerCm)} pointerEvents="none"/>)}
    </g>
  </>
}

function ReferenceNumberField({label,ariaLabel,value,onCommit,min=-Infinity,max=Infinity}) {
  const [draft,setDraft]=useState(String(Number(value.toFixed(2))))
  useEffect(()=>setDraft(String(Number(value.toFixed(2)))),[value])
  const commit=()=>{
    const n=Number(draft)
    if(draft.trim()&&Number.isFinite(n)&&n>=min&&n<=max)onCommit(n)
    else setDraft(String(Number(value.toFixed(2))))
  }
  return <label>{label}<input aria-label={ariaLabel} type="text" inputMode="decimal" value={draft}
    onChange={e=>setDraft(e.target.value)} onBlur={commit}
    onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}else if(e.key==='Escape'){setDraft(String(Number(value.toFixed(2))));e.currentTarget.blur()}}}/></label>
}

export function PatternReferenceImageControls({image, setImage, storageError, unitsPerCm=1, viewBounds=[0,0,100,100], className='', menuOnly=false, editorScope='draft'}) {
  const chooser=useRef(null)
  const [open, setOpen]=useState(false)
  const [error,setError]=useState('')
  // Native and draft canvases can both stay mounted; scope commands to the
  // visible editor so they never trigger two file pickers or settings dialogs.
  useEffect(()=>{
    if(!menuOnly)return undefined
    const show=event=>{
      if(event?.detail?.editor && event.detail.editor!==editorScope)return
      const action=event?.detail?.action||'open'
      if(action==='remove'){setImage(null);setOpen(false);return}
      if(action==='add'||action==='replace'||!image){setOpen(false);chooser.current?.click();return}
      setOpen(true)
    }
    window.addEventListener('exo-open-2d-background-image',show)
    return()=>window.removeEventListener('exo-open-2d-background-image',show)
  },[menuOnly,image,editorScope,setImage])
  const update=(patch)=>setImage(previous=>previous&&({...previous,...patch}))
  const choose=async event=>{
    const file=event.target.files?.[0]
    event.target.value=''
    if (!file) return
    try {
      const converted=await convertFile(file)
      const width=between(viewBounds[2]*.66,20*unitsPerCm,500*unitsPerCm)
      setImage({name:file.name,...converted,width,x:viewBounds[0]+viewBounds[2]*.17,
        y:viewBounds[1]+viewBounds[3]*.17,opacity:.48,visible:true,locked:true,calibrating:false})
      setError('');setOpen(true)
    } catch(e) {setError(e.message);setOpen(true)}
  }
  const widthCm=image ? image.width/unitsPerCm : 0
  return <div className={`cc-reference-toolbar ${menuOnly?'cc-reference-menu-only':''} ${className}`} data-reference-controls="2d">
    <input ref={chooser} type="file" accept="image/png,image/jpeg,image/webp,.jpg,.jpeg,.png,.webp"
      aria-label="Choose 2D reference image" hidden onChange={choose}/>
    {!menuOnly&&<button type="button" className="cc-reference-add" onClick={()=>chooser.current?.click()}
      title="Add a photo behind the 2D pattern to trace" aria-label="Add background reference image">
      <ImagePlus size={14}/><span>{image?'Reference Photo':'Add Reference Photo'}</span>
    </button>}
    {!menuOnly&&image&&<button type="button" className="cc-reference-toggle" aria-expanded={open}
      aria-label="Reference photo settings" onClick={()=>setOpen(v=>!v)}>Settings</button>}
    {open && <div className="cc-reference-panel" role="group" aria-label="2D reference photo settings" onPointerDown={e=>e.stopPropagation()}>
      <div className="cc-reference-panel-head"><strong>2D Background Image</strong><button type="button" aria-label="Close reference settings" onClick={()=>setOpen(false)}><X size={14}/></button></div>
      {image && <>
        <div className="cc-reference-file" title={image.name}>{image.name}</div>
        <label>Opacity <span>{Math.round((image.opacity??.5)*100)}%</span><input aria-label="Reference image opacity" type="range" min="5" max="100" step="1" value={Math.round((image.opacity??.5)*100)} onChange={e=>update({opacity:Number(e.target.value)/100})}/></label>
        <div className="cc-reference-fields">
          <ReferenceNumberField label="Width (cm)" ariaLabel="Reference width in centimeters" value={widthCm} min={1} max={100000} onCommit={n=>update({width:n*unitsPerCm})}/>
          <ReferenceNumberField label="X (cm)" ariaLabel="Reference X position in centimeters" value={image.x/unitsPerCm} onCommit={n=>update({x:n*unitsPerCm})}/>
          <ReferenceNumberField label="Y (cm)" ariaLabel="Reference Y position in centimeters" value={image.y/unitsPerCm} onCommit={n=>update({y:n*unitsPerCm})}/>
        </div>
        <div className="cc-reference-actions">
          <button type="button" aria-pressed={image.locked} onClick={()=>update({locked:!image.locked,calibrating:false})}>{image.locked?<Lock size={13}/>:<LockOpen size={13}/>} {image.locked?'Locked':'Move Photo'}</button>
          <button type="button" aria-pressed={image.visible!==false} onClick={()=>update({visible:image.visible===false})}>{image.visible===false?<EyeOff size={13}/>:<Eye size={13}/>} {image.visible===false?'Show':'Visible'}</button>
          <button type="button" aria-pressed={image.calibrating===true} onClick={()=>update({calibrating:!image.calibrating,visible:true})}><Ruler size={13}/> {image.calibrating?'Cancel Scale':'Calibrate'}</button>
          <button type="button" onClick={()=>{setImage(null);setOpen(false)}} aria-label="Remove background reference image"><Trash2 size={13}/> Remove</button>
        </div>
        {image.calibrating&&<label className="cc-reference-calibration">Known length (cm)
          <input aria-label="Known calibration length in centimeters" type="number" min="0.01" step="0.1"
            value={image.calibrationCm??10} onChange={e=>update({calibrationCm:e.target.value})}/>
        </label>}
        {image.calibrationError&&<p className="cc-reference-error" role="alert">{image.calibrationError}</p>}
        <p>{image.calibrating?'In Select mode, click the two endpoints of that known distance on the photo. The image scales to the measured length.':'Unlock to drag the photo, then lock it before tracing. Use the drawing tools to redraw the pattern.'}</p>
      </>}
      {(error||storageError)&&<p className="cc-reference-error" role="alert">{error||storageError}</p>}
    </div>}
  </div>
}
