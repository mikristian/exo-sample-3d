import React,{useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {Camera,Grip,Hand,X} from 'lucide-react'
import {recognizeFabricPinch} from '../core/cameraFabricHandGesture.js'
import './CameraFabricHand.css'

// Ships with the signed Mac app. Frames, model and wasm all stay local.
const MODEL='/hand-tracking/models/hand_landmarker.task'
const WASM='/hand-tracking/wasm'
const BRIDGE=typeof window!=='undefined'&&window.location.port==='5486'?'http://127.0.0.1:5485':typeof window!=='undefined'&&window.location.port==='5386'?'http://127.0.0.1:5385':(import.meta.env.VITE_CLOTHCRAFT_BRIDGE_URL||'http://127.0.0.1:5193')
const emit=detail=>window.dispatchEvent(new CustomEvent('exo-clothcraft-camera-fabric-hand',{detail}))

const clamp=(value,min,max)=>Math.min(Math.max(value,min),Math.max(min,max))

export default function CameraFabricHand({onActivate,disabled=false,viewportRef}){
  const [open,setOpen]=useState(false)
  const [toolbarTarget,setToolbarTarget]=useState(null)
  const [status,setStatus]=useState('idle')
  const [message,setMessage]=useState('Pinch thumb and index finger over the garment to grab fabric.')
  const [pointer,setPointer]=useState(null)
  const [provider,setProvider]=useState('mediapipe')
  const [position,setPosition]=useState(null)
  const panel=useRef(null),drag=useRef(null)
  const video=useRef(null),active=useRef(false),tracker=useRef(null),stream=useRef(null)
  const animation=useRef(null),lastFrame=useRef(-1),lastTime=useRef(0),pinched=useRef(false),processing=useRef(false),generation=useRef(0)
  const release=()=>{pinched.current=false;emit({tracking:false,pinched:false})}
  const stop=()=>{
    generation.current++
    active.current=false
    if(animation.current!=null)cancelAnimationFrame(animation.current)
    animation.current=null
    release()
    if(stream.current){stream.current.getTracks().forEach(track=>track.stop());stream.current=null}
    if(video.current){video.current.pause();video.current.srcObject=null}
    tracker.current?.close?.();tracker.current=null
    setPointer(null);lastFrame.current=-1;lastTime.current=0
  }
  useEffect(()=>()=>stop(),[])
  useEffect(()=>{
    // Prefer the 3D garment toolbar's slot immediately below Press. Standalone
    // ClothCraft uses its own left quick-toolbar slot as a safe fallback.
    const locate=()=>{
      const preferred=document.querySelector('.tool-rail [data-camera-hand-toolbar-slot="true"]')
      const fallback=document.querySelector('.cc-scene [data-camera-hand-toolbar-fallback-slot="true"]')
      const next=preferred||fallback||null
      setToolbarTarget(previous=>previous===next?previous:next)
    }
    locate()
    const observer=new MutationObserver(locate)
    observer.observe(document.body,{childList:true,subtree:true})
    return()=>observer.disconnect()
  },[])
  const start=async(chosen=provider)=>{
    if(active.current||disabled)return
    const session=++generation.current
    active.current=true
    setOpen(true);setStatus('loading');setMessage('Requesting camera and loading hand tracking…')
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera access requires localhost or a secure browser connection.')
      const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:30}}})
      if(!active.current){acquired.getTracks().forEach(track=>track.stop());return}
      stream.current=acquired
      const element=video.current
      if(!element)throw Error('Camera preview did not mount.')
      element.srcObject=acquired
      await element.play()
      const factory=import.meta.env.DEV?window.__exoFabricHandTrackerFactory:null
      let detector
      if(chosen==='apple-vision'){
        const response=await fetch(`${BRIDGE}/vision/hand/status`)
        const status=await response.json()
        if(!response.ok||!status.available)throw Error('Apple Vision requires the local ClothCraft native Vision adapter. Relaunch the updated V2 app.')
      }else if(typeof factory==='function')detector=await factory()
      else{
        const mp=await import('@mediapipe/tasks-vision')
        const files=await mp.FilesetResolver.forVisionTasks(WASM)
        detector=await mp.HandLandmarker.createFromOptions(files,{
          baseOptions:{modelAssetPath:MODEL,delegate:'CPU'},runningMode:'VIDEO',numHands:1,
          minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.55,
        })
      }
      if(!active.current||generation.current!==session){detector?.close?.();return}
      tracker.current=detector
      onActivate?.()
      setStatus('ready');setMessage(`${chosen==='apple-vision'?'Apple Vision':'MediaPipe'} camera ready. Pinch on fabric, move to pull, open fingers to release.`)
      const appleCanvas=document.createElement('canvas')
      appleCanvas.width=320;appleCanvas.height=240
      const appleContext=appleCanvas.getContext('2d')
      const accept=landmarks=>{
        if(!active.current||generation.current!==session)return
        const observed=recognizeFabricPinch(landmarks,pinched.current)
        pinched.current=Boolean(observed?.pinched)
        setPointer(observed)
        emit(observed?{...observed,tracking:true}:{tracking:false,pinched:false})
      }
      const update=timestamp=>{
        if(!active.current||generation.current!==session)return
        animation.current=requestAnimationFrame(update)
        if(processing.current||!video.current||video.current.readyState<2||timestamp-lastTime.current<(chosen==='apple-vision'?125:65))return
        if(video.current.currentTime===lastFrame.current)return
        lastTime.current=timestamp;lastFrame.current=video.current.currentTime
        processing.current=true
        void (async()=>{
          try{
            if(chosen==='apple-vision'){
              appleContext.drawImage(video.current,0,0,appleCanvas.width,appleCanvas.height)
              const image=appleCanvas.toDataURL('image/jpeg',.62).split(',')[1]
              const response=await fetch(`${BRIDGE}/vision/hand`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image})})
              const result=await response.json()
              if(!response.ok||!result.ok)throw Error(result.error||'Apple Vision frame failed')
              accept(result.landmarks)
            }else accept(tracker.current.detectForVideo(video.current,performance.now())?.landmarks?.[0])
          }catch(error){
            if(active.current&&generation.current===session){stop();setStatus('error');setMessage(`Hand detection stopped: ${error.message}`)}
          }finally{processing.current=false}
        })()
      }
      animation.current=requestAnimationFrame(update)
    }catch(error){
      stop();setStatus('error')
      setMessage(error?.name==='NotAllowedError'?'Camera permission denied. Allow camera access in your Mac/browser settings and try again.':
        `Hand camera unavailable: ${error.message}`)
    }
  }
  const close=()=>{stop();setOpen(false);setStatus('idle')}
  // The preview is a movable tool window within the real 3D viewport. Hand
  // coordinates are always full-viewport coordinates, independent of this UI.
  useEffect(()=>{
    if(!open||!viewportRef?.current)return
    const container=viewportRef.current
    const measure=()=>{
      const bounds=container.getBoundingClientRect()
      const width=panel.current?.offsetWidth||285,height=panel.current?.offsetHeight||325
      setPosition(prior=>prior
        ?{x:clamp(prior.x,8,bounds.width-width-8),y:clamp(prior.y,8,bounds.height-height-8)}
        :{x:clamp(bounds.width-width-14,8,bounds.width-width-8),y:clamp(bounds.height-height-14,8,bounds.height-height-8)})
    }
    measure()
    const resize=new ResizeObserver(measure)
    resize.observe(container)
    return()=>resize.disconnect()
  },[open,viewportRef])
  const startDrag=event=>{
    if(event.button!==0||event.target.closest('button,select,label'))return
    const container=viewportRef?.current
    if(!container||!panel.current)return
    const rect=container.getBoundingClientRect(),current=panel.current.getBoundingClientRect()
    drag.current={pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,
      x:current.left-rect.left,y:current.top-rect.top}
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }
  const moveDrag=event=>{
    const grabbed=drag.current
    if(!grabbed||grabbed.pointerId!==event.pointerId||!viewportRef?.current||!panel.current)return
    const rect=viewportRef.current.getBoundingClientRect()
    setPosition({x:clamp(grabbed.x+event.clientX-grabbed.clientX,8,rect.width-panel.current.offsetWidth-8),
      y:clamp(grabbed.y+event.clientY-grabbed.clientY,8,rect.height-panel.current.offsetHeight-8)})
  }
  const endDrag=event=>{
    if(drag.current?.pointerId!==event.pointerId)return
    drag.current=null
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const viewer=open&&<section ref={panel} className="cc-camera-hand-panel" aria-label="Camera Fabric Hand controls"
    data-camera-hand-state={status} data-draggable-camera-widget="true" style={position?{left:position.x,top:position.y}:undefined}>
      <div className="cc-camera-hand-heading" aria-label="Drag camera viewer"
        onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag}
        onPointerCancel={endDrag} onLostPointerCapture={event=>{if(drag.current?.pointerId===event.pointerId)drag.current=null}}>
        <Grip size={13} aria-hidden="true"/><strong>CAMERA FABRIC HAND</strong>
        <label><span>Tracker</span><select aria-label="Hand tracking provider" value={provider} onChange={event=>{const selected=event.target.value;stop();setProvider(selected);void start(selected)}}><option value="mediapipe">MediaPipe</option><option value="apple-vision">Apple Vision · Mac</option></select></label>
        <button type="button" aria-label="Close Camera Fabric Hand" onClick={close}><X size={14}/></button>
      </div>
      <div className="cc-camera-hand-feed">
        <video ref={video} muted autoPlay playsInline aria-label="Live hand tracking camera preview"/>
        {pointer&&<span className={`cc-camera-hand-point${pointer.pinched?' cc-camera-hand-grabbing':''}`} style={{left:`${pointer.x*100}%`,top:`${pointer.y*100}%`}}/>}
        {status!=='ready'&&<span className="cc-camera-hand-loading">{status==='loading'?'STARTING TRACKER':'CAMERA STOPPED'}</span>}
      </div>
      <p role="status" className="cc-camera-hand-status">{pointer?.pinched?'PINCH · GRAB FABRIC':pointer?'HAND TRACKED · MOVE CURSOR':'WAITING FOR HAND'} · {message}</p>
      <div className="cc-camera-hand-footer"><span>Move to aim · pinch to grab · release to drop</span>{status==='error'&&<button type="button" onClick={()=>void start()}>Retry</button>}<button type="button" onClick={close}>Stop camera</button></div>
    </section>
  const trigger=<button type="button" className={`cc-camera-hand-launch${open?' active':''}`}
      title="Use webcam hand tracking to pull real simulated fabric" aria-label="Camera Fabric Hand"
      aria-pressed={open} disabled={disabled&&!open} onClick={()=>open?close():void start()}>
      <Camera size={16} aria-hidden="true"/><span className="cc-camera-hand-icon"><Hand size={8} aria-hidden="true"/></span>
    </button>
  return <>
    {toolbarTarget&&createPortal(trigger,toolbarTarget)}
    {viewer&&(viewportRef?.current?createPortal(viewer,viewportRef.current):viewer)}
  </>
}
