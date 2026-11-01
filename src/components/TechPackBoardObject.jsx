import React,{useEffect,useLayoutEffect,useRef,useState} from 'react'
import {boardObjectMove,boardObjectResize,boardObjectTransform} from '../core/techPackBoardObjects.js'

// Universal transform envelope for EXO's native document objects (not only
// drawn arrows). The same id is saved in the project draft for the page.
export default function TechPackBoardObject({id,pageId,enabled=false,selected=false,keyboardEnabled=true,value={},maxTranslation=400,onSelect=()=>{},onChange=()=>{},onGestureStart=()=>{},onContextAction=()=>{},onEnterContent=()=>{},rightClickOpensEditor=false,tightMedia=false,style={},children}){
  const box=useRef(null),session=useRef(null),overlayClicks=useRef({time:0,count:0})
  const [preview,setPreview]=useState(null)
  const [context,setContext]=useState(null)
  const [mediaBounds,setMediaBounds]=useState(null)
  // A template rectangle is not the visible photo. Resolve its actual
  // displayed content, factoring object-fit:contain and native aspect ratio.
  // Selection and pointer capture then target only the visible artwork.
  useLayoutEffect(()=>{
    if(!tightMedia)return
    const root=box.current
    if(!root)return
    const target=root.querySelector('.tpbc-photo-filled img, .tpbc-composed-swatch-color, .tpbc-native-media-object, .tpws-custom-page-image img, .tpws-sheet-gallery img, .tpws-sheet-small-assets img')
    if(!target){setMediaBounds(null);return}
    const measure=()=>{
      if(!root.isConnected||!target.isConnected)return
      const parent=root.getBoundingClientRect(),rect=target.getBoundingClientRect()
      const unitX=parent.width/Math.max(1,root.offsetWidth)
      const unitY=parent.height/Math.max(1,root.offsetHeight)
      if(!Number.isFinite(unitX)||!Number.isFinite(unitY)||unitX<=0||unitY<=0||
         rect.width<=0||rect.height<=0)return
      let left=(rect.left-parent.left)/unitX,top=(rect.top-parent.top)/unitY
      let width=rect.width/unitX,height=rect.height/unitY
      if(target instanceof HTMLImageElement && target.naturalWidth>0 && target.naturalHeight>0 &&
         getComputedStyle(target).objectFit==='contain'){
        const aspect=target.naturalWidth/target.naturalHeight
        const fittedWidth=Math.min(width,height*aspect)
        const fittedHeight=Math.min(height,width/aspect)
        left+=(width-fittedWidth)/2;top+=(height-fittedHeight)/2
        width=fittedWidth;height=fittedHeight
      }
      const next={left,top,width,height}
      setMediaBounds(previous=>previous&&Object.keys(next).every(k=>Math.abs(previous[k]-next[k])<.5)?previous:next)
    }
    measure()
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null
    observer?.observe(root);observer?.observe(target)
    target.addEventListener('load',measure)
    return()=>{observer?.disconnect();target.removeEventListener('load',measure)}
  },[tightMedia,children])
  useEffect(()=>{if(!enabled)setContext(null)},[enabled])
  useEffect(()=>{
    const close=event=>{if(event.key==='Escape'){session.current=null;setPreview(null);setContext(null);overlayClicks.current={time:0,count:0}}}
    window.addEventListener('keydown',close)
    return()=>window.removeEventListener('keydown',close)
  },[])
  useEffect(()=>{
    if(!selected||!enabled||!keyboardEnabled)return
    const key=event=>{
      if(event.target?.closest?.('input,textarea,select,button,[contenteditable="true"]')||event.metaKey||event.ctrlKey||event.altKey)return
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){
        event.preventDefault()
        const step=event.shiftKey?10:1
        const delta=event.key==='ArrowUp'?[0,-step]:event.key==='ArrowDown'?[0,step]:event.key==='ArrowLeft'?[-step,0]:[step,0]
        onChange(pageId,id,boardObjectMove(value,delta,maxTranslation))
      }else if(event.key==='Backspace'||event.key==='Delete'){
        event.preventDefault();onContextAction(pageId,id,'delete')
      }else if(event.key==='Escape')onSelect(null)
    }
    window.addEventListener('keydown',key)
    return()=>window.removeEventListener('keydown',key)
  },[selected,enabled,keyboardEnabled,onChange,onContextAction,onSelect,id,pageId,value])
  const state=boardObjectTransform(preview||value,maxTranslation)
  const begin=(event,handle)=>{
    if(!enabled||event.button!==0)return
    if(handle==='move'){
      const now=Date.now(),last=overlayClicks.current
      overlayClicks.current={time:now,count:now-last.time<500?last.count+1:1}
      // Only repeated presses ON THIS SAME overlay can enter the content.
      // A browser dblclick event synthesized across a grid/overlay transition
      // must never switch Layout mode back to Content on the first click.
      if(overlayClicks.current.count>=2){
        overlayClicks.current={time:0,count:0}
        event.preventDefault();event.stopPropagation()
        onEnterContent(pageId,id,'doubleclick')
        return
      }
    }
    event.preventDefault();event.stopPropagation();onSelect({pageId,id},event.shiftKey||event.metaKey||event.ctrlKey)
    const root=box.current
    if(!root)return
    const size=[root.offsetWidth,root.offsetHeight]
    const bounds=root.getBoundingClientRect()
    const initial=boardObjectTransform(value,maxTranslation)
    const renderScale=[bounds.width/Math.max(1,size[0]*initial.scaleX),bounds.height/Math.max(1,size[1]*initial.scaleY)]
    const gesture=onGestureStart(pageId,id,handle)
    session.current={pointerId:event.pointerId,handle,size,renderScale,start:[event.clientX,event.clientY],initial,moved:false,last:[0,0],wasSelected:selected,gesture}
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move=event=>{
    const s=session.current
    if(!s||s.pointerId!==event.pointerId)return
    const delta=[(event.clientX-s.start[0])/Math.max(.05,s.renderScale[0]),(event.clientY-s.start[1])/Math.max(.05,s.renderScale[1])]
    // A normal finger/mouse click often jitters by 2–4 px; don't accidentally
    // move precise framed header/table artwork while trying to select it.
    if(!delta.every(Number.isFinite)||Math.hypot(...delta)<(rightClickOpensEditor?6:3)&&!s.moved)return
    s.last=delta;s.moved=true;s.preserveAspect=event.shiftKey
    setPreview(s.handle==='move'?boardObjectMove(s.initial,delta,maxTranslation):boardObjectResize(s.initial,delta,s.size,s.handle,s.preserveAspect,maxTranslation))
  }
  const finish=event=>{
    move(event) // Capture the final pointer position even if no move event preceded it.
    const s=session.current
    if(!s||s.pointerId!==event.pointerId)return
    if(s.moved){
      overlayClicks.current={time:0,count:0}
      const updated=s.handle==='move'?boardObjectMove(s.initial,s.last,maxTranslation):boardObjectResize(s.initial,s.last,s.size,s.handle,s.preserveAspect,maxTranslation)
      onChange(pageId,id,updated,{handle:s.handle,initial:s.initial,gesture:s.gesture})
    }
    session.current=null;setPreview(null)
  }
  return <div ref={box} className={`tpws-board-object ${enabled?'tpws-object-transformable':''} ${selected?'tpws-object-selected':''} ${tightMedia?'tpws-object-media-tight':''}`}
    data-board-object={id} data-board-page={pageId} data-media-bounds={tightMedia&&mediaBounds?'actual-content':undefined}
    onClick={event=>{if(!enabled&&event.button===0)onSelect({pageId,id})}}
    onContextMenu={event=>{
      if(rightClickOpensEditor){
        event.preventDefault();event.stopPropagation()
        setContext(null);session.current=null;setPreview(null)
        onEnterContent(pageId,id,'contextmenu')
        return
      }
      if(!enabled)return
      event.preventDefault();event.stopPropagation();onSelect({pageId,id})
      const rect=event.currentTarget.getBoundingClientRect()
      setContext({x:Math.max(4,Math.min(rect.width-130,event.clientX-rect.left)),y:Math.max(4,Math.min(rect.height-38,event.clientY-rect.top))})
    }}
    style={{...style,transform:`translate(${state.x}px,${state.y}px) scale(${state.scaleX},${state.scaleY})`,transformOrigin:'top left'}}>
    {children}
    {enabled&&<div className="tpws-object-transform-cover" title={`Drag to move ${id}. Double-click to edit content. Escape cancels.`} aria-label={`Move ${id} on ${pageId}`} style={tightMedia&&mediaBounds?mediaBounds:undefined} onPointerDown={e=>begin(e,'move')} onPointerMove={move} onPointerUp={finish} onLostPointerCapture={()=>{session.current=null;setPreview(null)}} onPointerCancel={()=>{session.current=null;setPreview(null)}}/>}
    {enabled&&selected&&<div className="tpws-object-bounding-box" data-object-bounds={id} style={tightMedia&&mediaBounds?mediaBounds:undefined}>
      {['nw','n','ne','e','se','s','sw','w'].map(handle=><div key={handle} className={`tpws-object-transform-handle tpws-handle-${handle}`}
        data-object-handle={handle} title="Drag to resize. Shift + corner preserves proportions. Escape cancels." aria-label={`Resize ${id} ${handle}`} onPointerDown={e=>begin(e,handle)} onPointerMove={move} onPointerUp={finish} onLostPointerCapture={()=>{session.current=null;setPreview(null)}} onPointerCancel={()=>{session.current=null;setPreview(null)}}/>)}
    </div>}
    {enabled&&context&&<div className="tpws-board-object-menu" role="menu" style={{left:context.x,top:context.y}}>
      <button type="button" role="menuitem" onClick={()=>{onEnterContent(pageId,id,'menu');setContext(null)}}>Edit this object's content</button>
      <button type="button" role="menuitem" onClick={()=>{onContextAction(pageId,id,'replace');setContext(null)}}>Replace visual / reference</button>
      {id.startsWith('asset-')&&<button type="button" role="menuitem" onClick={()=>{onContextAction(pageId,id,'expand-vector');setContext(null)}}>Ungroup SVG into editable paths</button>}
      <button type="button" role="menuitem" onClick={()=>{onContextAction(pageId,id,'duplicate');setContext(null)}}>Duplicate object</button>
      <button type="button" role="menuitem" onClick={()=>{onContextAction(pageId,id,'front');setContext(null)}}>Bring to front</button>
      <button type="button" role="menuitem" onClick={()=>{onContextAction(pageId,id,'back');setContext(null)}}>Send to back</button>
      <button type="button" role="menuitem" onClick={()=>{onContextAction(pageId,id,'delete');setContext(null)}}>Delete / remove from page</button>
      <button type="button" role="menuitem" onClick={()=>{onContextAction(pageId,id,'reset');setContext(null)}}>Reset position and size</button>
      <button type="button" role="menuitem" onClick={()=>setContext(null)}>Cancel</button>
    </div>}
  </div>
}
