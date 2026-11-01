import React,{useEffect,useRef,useState} from 'react'
import {Eye,EyeOff,Lock,LockOpen,AlignLeft,AlignCenter,AlignRight,AlignHorizontalJustifyStart,AlignHorizontalJustifyCenter,AlignHorizontalJustifyEnd,AlignVerticalJustifyStart,AlignVerticalJustifyCenter,AlignVerticalJustifyEnd,BringToFront,SendToBack,Trash2,Copy,Square,Type,Shapes,Layers3} from 'lucide-react'
import {vectorBounds} from '../core/techPackVectorStudio.js'
import {appendTechPackPenAnchor,closeTechPackPenPath,createTechPackPencilPath,
  insertTechPackPathAnchor,deleteTechPackPathAnchor,
  moveTechPackEditableAnchor,moveTechPackEditableHandle} from '../core/techPackVectorPathTools20261031.js'

const pointAt=(event,svg,width,height)=>{
  if(svg?.createSVGPoint&&svg?.getScreenCTM){
    const matrix=svg.getScreenCTM()
    if(matrix){
      const point=svg.createSVGPoint()
      point.x=event.clientX;point.y=event.clientY
      const local=point.matrixTransform(matrix.inverse())
      if(Number.isFinite(local.x)&&Number.isFinite(local.y))return {x:local.x,y:local.y}
    }
  }
  const rect=svg.getBoundingClientRect()
  return {x:(event.clientX-rect.left)*width/Math.max(1,rect.width),
    y:(event.clientY-rect.top)*height/Math.max(1,rect.height)}
}
function VectorGraphic({item}){
  const {x,y,width,height}=vectorBounds(item)
  const shared={fill:item.fill||'none',stroke:item.stroke||'none',strokeWidth:Math.max(0,Number(item.strokeWidth)||0),
    opacity:Math.max(0,Math.min(1,Number(item.opacity??1))),pointerEvents:'visiblePainted'}
  if(item.kind==='rect')return <rect x={x} y={y} width={width} height={height} rx={Math.max(0,Number(item.cornerRadius)||0)} {...shared}/>
  if(item.kind==='grid'){
    const rows=Math.max(1,Math.min(40,Math.trunc(Number(item.rows)||5)))
    const cols=Math.max(1,Math.min(40,Math.trunc(Number(item.columns)||5)))
    return <g fill="none" stroke={item.stroke||'#222222'} strokeWidth={Math.max(.1,Number(item.strokeWidth)||1)} opacity={shared.opacity}>
      <rect x={x} y={y} width={width} height={height} fill="transparent" pointerEvents="all"/>
      {Array.from({length:cols-1},(_,i)=><line key={'c'+i} x1={x+width*(i+1)/cols} x2={x+width*(i+1)/cols} y1={y} y2={y+height}/>)}
      {Array.from({length:rows-1},(_,i)=><line key={'r'+i} x1={x} x2={x+width} y1={y+height*(i+1)/rows} y2={y+height*(i+1)/rows}/>)}
    </g>
  }
  if(item.kind==='ellipse')return <ellipse cx={x+width/2} cy={y+height/2} rx={width/2} ry={height/2} {...shared}/>
  if(item.kind==='path')return <path d={item.d||''} transform={`translate(${x} ${y})`}
    fillRule={item.fillRule||'nonzero'} {...shared}/>
  if(item.kind==='text')return <text x={item.textAlign==='center'?x+width/2:item.textAlign==='right'?x+width:x} y={y} dominantBaseline="hanging" {...shared}
    fontFamily={item.fontFamily||'Arial'} fontSize={Math.max(6,Number(item.fontSize)||24)}
    fontWeight={item.fontWeight||400} letterSpacing={Number(item.letterSpacing)||0}
    textAnchor={item.textAlign==='center'?'middle':item.textAlign==='right'?'end':'start'}>
    {String(item.text||'').split('\n').slice(0,50).map((line,index)=><tspan key={index}
      x={item.textAlign==='center'?x+width/2:item.textAlign==='right'?x+width:x}
      dy={index===0?0:`${Math.max(.6,Number(item.lineHeight)||1.2)}em`}>{line||' '}</tspan>)}
  </text>
  return null
}

export function TechPackVectorLayer({pageId,items=[],selectedIds=[],tool='select',width=612,height=792,
  enabled=false,onCreate,onChange,onSelect,onToolComplete=()=>{}}){
  const svg=useRef(null),session=useRef(null),penDraft=useRef(null)
  const [preview,setPreview]=useState(null)
  const [activeAnchor,setActiveAnchor]=useState(null)
  const shapeTool=['rect','ellipse','text','grid'].includes(tool)&&enabled
  const drawPathTool=['pen','pencil'].includes(tool)&&enabled
  const directTool=['direct','anchor','add-anchor','delete-anchor'].includes(tool)
  useEffect(()=>{
    if(tool!=='pen')penDraft.current=null
  },[tool,pageId])
  useEffect(()=>{
    if(!enabled||tool!=='pen')return
    const key=event=>{
      if(event.target?.closest?.('input,textarea,select,[contenteditable=true]'))return
      if(event.key==='Enter'||event.key==='Escape'){
        event.preventDefault();penDraft.current=null;setPreview(null)
        if(event.key==='Enter')onToolComplete()
      }
    }
    window.addEventListener('keydown',key)
    return()=>window.removeEventListener('keydown',key)
  },[enabled,tool,onToolComplete])
  const nearestSegment=(item,p)=>{
    const arr=item.anchors||[],segments=item.closed===false?arr.length-1:arr.length
    let closest={index:-1,t:.5,dist:Infinity}
    for(let i=0;i<segments;i++){
      const a=arr[i],b=arr[(i+1)%arr.length]
      if(!a||!b)continue
      for(let j=1;j<24;j++){
        const t=j/24,u=1-t
        const q=[0,1].map(k=>u*u*u*a.p[k]+3*u*u*t*a.hOut[k]+3*u*t*t*b.hIn[k]+t*t*t*b.p[k])
        const dist=Math.hypot(q[0]-p[0],q[1]-p[1])
        if(dist<closest.dist)closest={index:i,t,dist}
      }
    }
    return closest
  }
  const begin=(event,item,handle)=>{
    if(!enabled||item.locked||event.button!==0)return
    event.stopPropagation();event.preventDefault()
    if(tool==='add-anchor'&&item.kind==='path'&&item.anchors?.length>=2){
      const at=pointAt(event,svg.current,width,height)
      const segment=nearestSegment(item,[at.x-item.x,at.y-item.y])
      // A click in the path's bounding box is not necessarily on its ink.
      // Restrict insertion to a nearby actual curve/line segment.
      if(segment.index>=0&&segment.dist<=Math.max(5,Number(item.strokeWidth)||0)){
        try{
          onChange(pageId,item.id,insertTechPackPathAnchor(item,segment.index,segment.t))
          onSelect(pageId,item.id,false)
          setActiveAnchor({id:item.id,index:segment.index+1})
        }catch{}
      }
      return
    }
    if(tool==='delete-anchor'||tool==='pen'||tool==='pencil')return
    if(directTool&&!handle){
      onSelect(pageId,item.id,event.shiftKey||event.metaKey||event.ctrlKey)
      return
    }
    const start=pointAt(event,svg.current,width,height)
    session.current={mode:handle?'resize':'move',id:item.id,item,start,handle,pointerId:event.pointerId}
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect(pageId,item.id,event.shiftKey||event.metaKey||event.ctrlKey)
  }
  const beginAnchor=(event,item,index,which='anchor')=>{
    if(!enabled||item.locked||event.button!==0||!Array.isArray(item.anchors))return
    event.stopPropagation();event.preventDefault()
    if(tool==='delete-anchor'&&which==='anchor'){
      try{onChange(pageId,item.id,deleteTechPackPathAnchor(item,index))}
      catch{}
      setActiveAnchor(null);return
    }
    if(tool==='add-anchor'||tool==='select'||tool==='pen'||tool==='pencil')return
    session.current={mode:'edit-anchor',item,id:item.id,index,which,pointerId:event.pointerId}
    setActiveAnchor({id:item.id,index})
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect(pageId,item.id,false)
  }
  const proposeAnchor=(s,event)=>{
    const point=pointAt(event,svg.current,width,height)
    const local=[point.x-s.item.x,point.y-s.item.y]
    return s.which==='anchor'?moveTechPackEditableAnchor(s.item,s.index,local):
      moveTechPackEditableHandle(s.item,s.index,s.which,local,{independent:event.altKey})
  }
  const drawStart=event=>{
    if(!shapeTool&&!drawPathTool||event.button!==0)return
    event.preventDefault();event.stopPropagation()
    const at=pointAt(event,svg.current,width,height)
    if(tool==='pen'){
      const prior=items.find(item=>item.id===penDraft.current)
      if(prior?.anchors?.length>=2&&Math.hypot(
        at.x-(prior.x+prior.anchors[0].p[0]),at.y-(prior.y+prior.anchors[0].p[1]))<10){
        try{onChange(pageId,prior.id,closeTechPackPenPath(prior));penDraft.current=null;onToolComplete()}
        catch{}
        return
      }
      session.current={mode:'pen-point',start:at,pointerId:event.pointerId}
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if(tool==='pencil'){
      session.current={mode:'pencil',start:at,points:[[at.x,at.y]],pointerId:event.pointerId}
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if(tool==='text'){
      onCreate(pageId,'text',{x:at.x,y:at.y,width:195,height:50})
      return
    }
    session.current={mode:'draw',tool,start:at,pointerId:event.pointerId}
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move=event=>{
    const s=session.current
    if(!s||s.pointerId!==event.pointerId)return
    if(s.mode==='edit-anchor'){
      try{setPreview({id:s.id,...proposeAnchor(s,event)})}
      catch{setPreview(null)}
      return
    }
    const at=pointAt(event,svg.current,width,height)
    if(s.mode==='pen-point'){
      setPreview({mode:'pen-point',x:s.start.x,y:s.start.y,toX:at.x,toY:at.y})
      return
    }
    if(s.mode==='pencil'){
      if(s.points.length<3000&&Math.hypot(at.x-s.points.at(-1)[0],at.y-s.points.at(-1)[1])>=.8)
        s.points.push([at.x,at.y])
      setPreview({mode:'pencil',points:s.points.slice()})
      return
    }
    if(s.mode==='draw'){
      setPreview({x:Math.min(s.start.x,at.x),y:Math.min(s.start.y,at.y),
        width:Math.abs(at.x-s.start.x),height:Math.abs(at.y-s.start.y)})
      return
    }
    const dx=at.x-s.start.x,dy=at.y-s.start.y
    const p=vectorBounds(s.item)
    if(s.mode==='move')setPreview({id:s.id,x:p.x+dx,y:p.y+dy,width:p.width,height:p.height})
    else {
      const east=s.handle.includes('e'),west=s.handle.includes('w'),north=s.handle.includes('n'),south=s.handle.includes('s')
      const x=west?p.x+dx:p.x,y=north?p.y+dy:p.y
      setPreview({id:s.id,x:east?p.x:Math.min(p.x+p.width-4,x),y:south?p.y:Math.min(p.y+p.height-4,y),
        width:east?Math.max(4,p.width+dx):west?Math.max(4,p.width-dx):p.width,
        height:south?Math.max(4,p.height+dy):north?Math.max(4,p.height-dy):p.height})
    }
  }
  const finish=event=>{
    const s=session.current
    if(!s||s.pointerId!==event.pointerId)return
    if(s.mode==='edit-anchor'){
      try{onChange(pageId,s.id,proposeAnchor(s,event))}
      catch{/* Invalid coordinates never mutate user geometry. */}
      session.current=null;setPreview(null)
      return
    }
    if(s.mode==='pen-point'){
      const at=pointAt(event,svg.current,width,height)
      const drag=Math.hypot(at.x-s.start.x,at.y-s.start.y)>3?at:null
      const prior=items.find(item=>item.id===penDraft.current)
      try{
        if(prior&&prior.kind==='path'&&prior.closed===false){
          const local=[s.start.x-prior.x,s.start.y-prior.y]
          const outgoing=drag?[drag.x-prior.x,drag.y-prior.y]:null
          onChange(pageId,prior.id,appendTechPackPenAnchor(prior,local,outgoing))
          onSelect(pageId,prior.id,false)
        }else{
          const initial=appendTechPackPenAnchor(null,[0,0],
            drag?[drag.x-s.start.x,drag.y-s.start.y]:null)
          penDraft.current=onCreate(pageId,'path',{...initial,x:s.start.x,y:s.start.y,
            width:1,height:1,name:'Pen path',fill:'none',stroke:'#20242a',strokeWidth:1.5})
        }
      }catch{}
      session.current=null;setPreview(null)
      return
    }
    if(s.mode==='pencil'){
      move(event)
      const points=s.points
      try{
        if(points.length>=2){
          const minX=Math.min(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1]))
          const local=points.map(p=>[p[0]-minX,p[1]-minY])
          const path=createTechPackPencilPath(local,{tolerance:1.25,smooth:event.shiftKey})
          onCreate(pageId,'path',{...path,x:minX,y:minY,
            width:Math.max(1,Math.max(...points.map(p=>p[0]))-minX),
            height:Math.max(1,Math.max(...points.map(p=>p[1]))-minY),
            name:'Pencil drawing',fill:'none',stroke:'#20242a',strokeWidth:1.5})
        }
      }catch{}
      session.current=null;setPreview(null)
      return
    }
    move(event)
    const at=pointAt(event,svg.current,width,height)
    if(s.mode==='draw'){
      const x=Math.min(at.x,s.start.x),y=Math.min(at.y,s.start.y)
      const w=Math.abs(at.x-s.start.x),h=Math.abs(at.y-s.start.y)
      if(w>=5&&h>=5)onCreate(pageId,s.tool,{x,y,width:w,height:h})
    }else{
      const p=vectorBounds(s.item)
      const dx=at.x-s.start.x,dy=at.y-s.start.y
      // Commit the release position even when React did not render a move.
      if(s.mode==='move')onChange(pageId,s.id,{x:Math.round(s.item.x+dx),y:Math.round(s.item.y+dy)})
      else {
        const east=s.handle.includes('e'),west=s.handle.includes('w'),north=s.handle.includes('n'),south=s.handle.includes('s')
        onChange(pageId,s.id,{
          x:west?Math.min(p.x+p.width-4,p.x+dx):p.x,
          y:north?Math.min(p.y+p.height-4,p.y+dy):p.y,
          width:east?Math.max(4,p.width+dx):west?Math.max(4,p.width-dx):p.width,
          height:south?Math.max(4,p.height+dy):north?Math.max(4,p.height-dy):p.height,
        })
      }
    }
    session.current=null;setPreview(null)
  }
  return <svg className="tpws-vector-artboard" aria-label={`Vector artwork on ${pageId}`} data-vector-artboard={pageId}
    viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
    style={{pointerEvents:enabled?'auto':'none'}}
    ref={svg} onPointerDown={drawStart} onPointerMove={move} onPointerUp={finish}
    onDoubleClick={event=>{if(tool==='pen'){event.preventDefault();event.stopPropagation();penDraft.current=null;onToolComplete()}}}
    onPointerCancel={()=>{session.current=null;setPreview(null)}}>
    {items.filter(item=>!item.hidden).map(item=>{
      const active=selectedIds.includes(item.id)
      const current=preview?.id===item.id?{...item,...preview}:item
      const bounds=vectorBounds(current)
      return <g key={item.id} data-vector-id={item.id}
        style={{pointerEvents:enabled&&!shapeTool&&!drawPathTool?'visiblePainted':'none',
          cursor:item.locked?'not-allowed':directTool?'crosshair':'move'}}
        onPointerDown={event=>begin(event,item)}
        onPointerMove={move} onPointerUp={finish}>
        <VectorGraphic item={current}/>
        {active&&enabled&&<g className="tpws-vector-outline" pointerEvents="none">
          <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="none" stroke="#3197df" strokeWidth="1" strokeDasharray="5 3" vectorEffect="non-scaling-stroke"/>
        </g>}
        {active&&enabled&&!item.locked&&!shapeTool&&!drawPathTool&&!directTool&&['nw','ne','se','sw'].map(handle=>{
          const hx=bounds.x+(handle.includes('e')?bounds.width:0),hy=bounds.y+(handle.includes('s')?bounds.height:0)
          return <rect key={handle} x={hx-4} y={hy-4} width={8} height={8} fill="white" stroke="#238dd3"
            strokeWidth="1.5" style={{cursor:`${handle}-resize`,pointerEvents:'all'}}
            onPointerDown={event=>begin(event,item,handle)} onPointerMove={move} onPointerUp={finish}/>
        })}
      </g>
    })}
    {/* A separate, final overlay keeps anchor handles above the other paths,
        while preserving source Illustrator paint/stacking order. */}
    {enabled&&directTool&&!shapeTool&&!drawPathTool&&items.filter(item=>
      selectedIds.includes(item.id)&&!item.hidden&&!item.locked&&Array.isArray(item.anchors)).map(item=>{
      const current=preview?.id===item.id?{...item,...preview}:item
      return <g key={'anchors-'+item.id} data-vector-anchor-owner={item.id} pointerEvents="none">
        {current.anchors.slice(0,250).map((anchor,index)=><g key={index}>
          {activeAnchor?.id===item.id&&activeAnchor.index===index&&['hIn','hOut'].map(which=>{
            const handle=anchor[which]
            if(!Array.isArray(handle)||Math.hypot(handle[0]-anchor.p[0],handle[1]-anchor.p[1])<.5)return null
            return <g key={which}>
              <line x1={current.x+anchor.p[0]} y1={current.y+anchor.p[1]}
                x2={current.x+handle[0]} y2={current.y+handle[1]}
                stroke="#ad52ba" strokeWidth="1.3" pointerEvents="none" vectorEffect="non-scaling-stroke"/>
              <circle data-vector-handle={which} cx={current.x+handle[0]} cy={current.y+handle[1]} r="5"
                fill="#ffffff" stroke="#a044bd" strokeWidth="1.7"
                style={{cursor:'crosshair',pointerEvents:'all'}}
                onPointerDown={event=>beginAnchor(event,item,index,which)} onPointerMove={move} onPointerUp={finish}/>
            </g>
          })}
          <circle data-vector-anchor={index} cx={current.x+anchor.p[0]} cy={current.y+anchor.p[1]} r="5"
            fill={activeAnchor?.id===item.id&&activeAnchor.index===index?'#087ac4':'#ffffff'}
            stroke="#087ac4" strokeWidth="1.6" style={{cursor:'crosshair',pointerEvents:'all'}}
            onPointerDown={event=>beginAnchor(event,item,index)} onPointerMove={move} onPointerUp={finish}/>
        </g>)}
      </g>
    })}
    {shapeTool&&preview&&!preview.id&&<rect className="tpws-vector-drawing-preview" x={preview.x} y={preview.y}
      width={preview.width} height={preview.height} fill="#ec8b3340" stroke="#2496e3" strokeDasharray="5 3" pointerEvents="none"/>}
    {drawPathTool&&preview?.mode==='pencil'&&preview.points?.length>1&&
      <polyline points={preview.points.map(p=>p.join(',')).join(' ')} stroke="#238dd3" fill="none"
        strokeWidth="1.5" pointerEvents="none" vectorEffect="non-scaling-stroke"/>}
    {drawPathTool&&preview?.mode==='pen-point'&&
      <line x1={preview.x} y1={preview.y} x2={preview.toX} y2={preview.toY}
        stroke="#238dd3" strokeWidth="1.5" pointerEvents="none" vectorEffect="non-scaling-stroke"/>}
  </svg>
}

export function TechPackVectorLayers({items=[],selectedIds=[],onSelect,onPatch,onReorder,onDuplicate,onDelete}){
  return <section className="tpws-illustrator-layers" aria-label="Vector layers">
    <div className="tpws-ai-panel-heading"><Layers3 size={14}/> LAYERS <span>{items.length}</span></div>
    <div className="tpws-ai-layer-parent"><Layers3 size={14}/> Layer 1 <small>Tech Pack artwork</small></div>
    {[...items].reverse().map(item=><div key={item.id} className={`tpws-ai-layer ${selectedIds.includes(item.id)?'selected':''}`}>
      <button aria-label={item.hidden?`Show ${item.name}`:`Hide ${item.name}`} title="Toggle visibility" onClick={()=>onPatch(item.id,{hidden:!item.hidden})}>{item.hidden?<EyeOff size={13}/>:<Eye size={13}/>}</button>
      <button aria-label={item.locked?`Unlock ${item.name}`:`Lock ${item.name}`} title="Toggle lock" onClick={()=>onPatch(item.id,{locked:!item.locked})}>{item.locked?<Lock size={12}/>:<LockOpen size={12}/>}</button>
      <button className="tpws-ai-layer-name" aria-pressed={selectedIds.includes(item.id)}
        onClick={event=>onSelect(item.id,event.shiftKey||event.metaKey||event.ctrlKey)}>
        {item.kind==='text'?<Type size={13}/>:item.kind==='path'?<Shapes size={13}/>:item.kind==='grid'?<Layers3 size={13}/>:<Square size={13}/>}
        <span>{item.name||item.kind}</span>
      </button>
      <button aria-label={`Duplicate ${item.name}`} onClick={()=>onDuplicate(item.id)} title="Duplicate"><Copy size={12}/></button>
    </div>)}
    {!items.length&&<p className="tpws-ai-empty">Draw a shape or insert a text frame to create your first layer.</p>}
    <div className="tpws-ai-layer-footer">
      <button disabled={!selectedIds.length} onClick={()=>onReorder('up')} title="Bring selected forward"><BringToFront size={14}/></button>
      <button disabled={!selectedIds.length} onClick={()=>onReorder('down')} title="Send selected backward"><SendToBack size={14}/></button>
      <button disabled={!selectedIds.length} onClick={()=>onDelete()} title="Delete selected"><Trash2 size={14}/></button>
    </div>
  </section>
}

// Existing technical sheet objects are layers too. They remain distinct from
// freely authored SVG layers because their content is source-bound.
export function TechPackDocumentLayers({items=[],selectedIds=[],hiddenIds=[],lockedIds=[],onSelect,onVisibility,onLock=()=>{}}){
  const hidden=new Set(hiddenIds)
  const locked=new Set(lockedIds)
  return <section className="tpws-document-layers" aria-label="Existing document layers">
    <div className="tpws-ai-panel-heading"><Layers3 size={14}/> DOCUMENT LAYERS <span>{items.length}</span></div>
    {items.map(item=><div key={item.id} className={`tpws-ai-layer ${selectedIds.includes(item.id)?'selected':''}`}>
      <button type="button" aria-label={hidden.has(item.id)?`Show ${item.name}`:`Hide ${item.name}`}
        title={hidden.has(item.id)?'Show layer':'Hide layer'}
        onClick={()=>onVisibility(item.id,hidden.has(item.id))}>{hidden.has(item.id)?<EyeOff size={13}/>:<Eye size={13}/>}</button>
      <button type="button" aria-label={locked.has(item.id)?`Unlock ${item.name}`:`Lock ${item.name}`}
        title={locked.has(item.id)?'Unlock this layer':'Lock this layer'}
        aria-pressed={locked.has(item.id)}
        onClick={()=>onLock(item.id,!locked.has(item.id))}>{locked.has(item.id)?<Lock size={13}/>:<LockOpen size={13}/>}</button>
      <button type="button" className="tpws-ai-layer-name" aria-pressed={selectedIds.includes(item.id)}
        onClick={event=>onSelect(item.id,event.shiftKey||event.metaKey||event.ctrlKey)}>
        {item.kind==='image'?<Shapes size={13}/>:item.kind==='table'?<Layers3 size={13}/>:<Square size={13}/>}
        <span>{item.name}</span>
      </button>
      <span className="tpws-ai-layer-origin">{item.kind==='image'?'Image':item.kind==='table'?'Table':'Page'}</span>
    </div>)}
  </section>
}

export function TechPackVectorInspector({items=[],selectedIds=[],onPatch,onPatchSelected=()=>{},onAlign,onBuild,onDelete,onCreate,onGroup=()=>{},onUngroup=()=>{},uiTheme,onTheme}){
  const selected=items.filter(item=>selectedIds.includes(item.id))
  const current=selected.length===1?selected[0]:null
  const update=(key,value)=>{if(current)onPatch(current.id,{[key]:value})}
  const num=(label,key,min,max,step=1)=><label>{label}<input type="number" min={min} max={max} step={step}
    value={Number(current[key]??0)} onChange={e=>update(key,Math.max(min,Math.min(max,Number(e.target.value)||0)))}/></label>
  return <div className="tpws-illustrator-inspector" aria-label="Vector appearance and type">
    <div className="tpws-ai-panel-heading"><Shapes size={14}/> VECTOR STUDIO <span>EDITABLE</span></div>
    <div className="tpws-ai-section"><label>Workspace color theme
      <select value={uiTheme||'studio'} onChange={e=>onTheme(e.target.value)}>
        <option value="studio">EXO Studio</option><option value="illustrator">Illustrator-inspired charcoal</option>
      </select></label>
      <div className="tpws-ai-quick-add">
        <button onClick={()=>onCreate('rect')}><Square size={13}/> Rectangle</button>
        <button onClick={()=>onCreate('grid')}><Layers3 size={13}/> Rectangular grid</button>
        <button onClick={()=>onCreate('ellipse')}><Shapes size={13}/> Ellipse</button>
        <button onClick={()=>onCreate('text')}><Type size={13}/> Text</button>
      </div>
    </div>
    {(selected.length>1||selected.some(item=>item.groupId))&&<div className="tpws-ai-section" aria-label="VectorCraft group operations">
      <strong>VECTOR GROUPS · {selected.length} PATH{selected.length===1?'':'S'}</strong>
      <div className="tpws-ai-buttons">
        <button type="button" disabled={selected.length<2} onClick={onGroup}>Group selected paths</button>
        <button type="button" disabled={!selected.some(item=>item.groupId)} onClick={onUngroup}>Ungroup selected paths</button>
      </div>
      <small>Group paths to move them as one mockup; ungroup to select each seam, neckline and contour independently.</small>
    </div>}
    {selected.length>1&&<div className="tpws-ai-section" aria-label="Grouped vector appearance">
      <strong>GROUP APPEARANCE · {selected.length} CONTOURS</strong>
      <div className="tpws-ai-grid">
        <label>Fill colored shapes<input type="color" aria-label="Group vector fill color"
          defaultValue="#dddddd" onChange={e=>onPatchSelected({fill:e.target.value},{filledOnly:true})}/></label>
        <label>Stroke all paths<input type="color" aria-label="Group vector stroke color"
          defaultValue="#222222" onChange={e=>onPatchSelected({stroke:e.target.value})}/></label>
      </div>
      <small>Changes apply to each selected editable path, not the purchased master SVG.</small>
    </div>}
    {selected.length>1&&selected.every(item=>item.kind==='rect'&&!item.locked)&&
    <div className="tpws-ai-section"><strong>SHAPE BUILDER · {selected.length} SELECTED</strong>
      <p>Combine or subtract selected unlocked rectangles into one editable vector path.</p>
      <div className="tpws-ai-buttons"><button onClick={()=>onBuild('unite')}>Unite</button><button onClick={()=>onBuild('subtract')}>Minus Front</button></div>
    </div>}
    {current&&<><div className="tpws-ai-section"><strong>PROPERTIES · {current.kind.toUpperCase()}</strong>
      <label>Layer name<input aria-label="Vector layer name" value={current.name||''} maxLength={72} onChange={e=>update('name',e.target.value)}/></label>
      <div className="tpws-ai-grid">{num('X','x',-1000,2000)}{num('Y','y',-1000,2000)}{num('W','width',4,2500)}{num('H','height',4,2500)}</div>
      {current.kind==='rect'&&num('Corner radius','cornerRadius',0,250)}
      {current.kind==='grid'&&<><strong>RECTANGULAR GRID · INDEPENDENT VECTOR</strong>
        <div className="tpws-ai-grid">{num('Rows','rows',1,40)}{num('Columns','columns',1,40)}</div>
        <small>Use the Select tool to move and resize this grid. It is separate from editable specification tables.</small></>}
      {current.kind==='path'&&Array.isArray(current.anchors)&&<div className="tpws-ai-section">
        <strong>VECTORCRAFT ANCHOR EDITING · {current.anchors.length} POINTS</strong>
        <small>Drag blue anchor nodes to reshape the copied outline; purple Bézier control handles edit its curves. Source garment geometry, dimensions and grading remain unchanged.</small>
      </div>}
    </div>
    <div className="tpws-ai-section"><strong>APPEARANCE</strong>
      <div className="tpws-ai-grid">
        <label>Fill<input type="color" aria-label="Vector fill color" value={/^#[0-9a-f]{6}$/i.test(current.fill||'')?current.fill:'#ffffff'} onChange={e=>update('fill',e.target.value)}/></label>
        <label>Stroke<input type="color" aria-label="Vector stroke color" value={/^#[0-9a-f]{6}$/i.test(current.stroke||'')?current.stroke:'#222222'} onChange={e=>update('stroke',e.target.value)}/></label>
      </div><div className="tpws-ai-grid">{num('Stroke pt','strokeWidth',0,40,.5)}{num('Opacity %','opacity',0,1,.05)}</div>
      <div className="tpws-ai-buttons"><button onClick={()=>update('fill','none')}>No fill</button><button onClick={()=>update('stroke','none')}>No stroke</button></div>
    </div>
    {current.kind==='text'&&<><div className="tpws-ai-section"><strong>CHARACTER</strong>
      <label>Text frame<textarea aria-label="Text frame content" rows={4} value={current.text||''} onChange={e=>update('text',e.target.value.slice(0,4000))}/></label>
      <label>Typeface<select aria-label="Text font family" value={current.fontFamily||'Arial'} onChange={e=>update('fontFamily',e.target.value)}>
        {['Arial','Helvetica Neue','Inter','Georgia','Times New Roman','Courier New','Futura','Avenir Next','Menlo'].map(f=><option key={f}>{f}</option>)}
      </select></label>
      <div className="tpws-ai-grid">{num('Size pt','fontSize',6,250)}{num('Tracking','letterSpacing',-5,35,.5)}
        {num('Leading','lineHeight',.6,4,.1)}<label>Weight<select value={current.fontWeight||400} onChange={e=>update('fontWeight',Number(e.target.value))}>
        {[300,400,500,600,700,800,900].map(w=><option key={w} value={w}>{w}</option>)}</select></label></div>
    </div><div className="tpws-ai-section"><strong>PARAGRAPH</strong>
      <div className="tpws-ai-buttons">{[['left',AlignLeft],['center',AlignCenter],['right',AlignRight]].map(([v,Icon])=><button key={v} aria-label={`Text align ${v}`} className={current.textAlign===v?'active':''} onClick={()=>update('textAlign',v)}><Icon size={14}/></button>)}</div>
    </div></>}
    <div className="tpws-ai-section"><strong>ALIGN</strong>
      <div className="tpws-ai-compact-tools tpws-ai-align" role="group" aria-label="Align vector artwork">
        {[['left','Align left',AlignHorizontalJustifyStart],['center','Align center horizontally',AlignHorizontalJustifyCenter],['right','Align right',AlignHorizontalJustifyEnd],['top','Align top',AlignVerticalJustifyStart],['middle','Align center vertically',AlignVerticalJustifyCenter],['bottom','Align bottom',AlignVerticalJustifyEnd]].map(([key,label,Icon])=><button key={key} aria-label={label} title={label} onClick={()=>onAlign(key)}><Icon size={16}/></button>)}
      </div>
      <button className="tpws-ai-delete" onClick={onDelete}><Trash2 size={13}/> Delete selected art</button>
    </div></>}
    {!current&&selected.length===0&&<p className="tpws-ai-empty">Choose the Selection tool and click artwork to edit fill, stroke, type and dimensions.</p>}
  </div>
}
