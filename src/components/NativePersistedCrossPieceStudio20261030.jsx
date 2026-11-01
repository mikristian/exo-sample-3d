import React,{useMemo,useState} from 'react'

const finite=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)
const isInt=value=>Number.isSafeInteger(value)&&value>=0
const sourcePoint=(snapshot,link)=>snapshot?.template?.panels?.find(p=>p.id===link?.sourcePanelId)
  ?.polygon?.points?.[link?.sourcePointIndex]

/** An explicit, versioned Rust-owned reference. This is not a browser-side
 * AnchorGroup and does not infer general Modaris-grade parametric parity. */
export default function NativePersistedCrossPieceStudio20261030({snapshot,disabled=false,onCommit}){
  const panels=(snapshot?.template?.panels||[]).filter(p=>p?.polygon?.points?.length>=3)
  const [sourceId,setSourceId]=useState('')
  const [targetId,setTargetId]=useState('')
  const [sourceIndex,setSourceIndex]=useState('1')
  const [targetIndex,setTargetIndex]=useState('1')
  const [x,setX]=useState('')
  const [y,setY]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const link=snapshot?.nativeCrossPieceLink
  const blocked=disabled||busy||!Number.isSafeInteger(snapshot?.revision)||
    (snapshot?.gradeRunPersisted&&!snapshot?.nativeCrossPieceGradingSupported)||snapshot?.nativePointBindings!=null||
    snapshot?.fabricGradeEnvelope||snapshot?.nativeFacingDependency||
    snapshot?.pieceVariant?.persisted||(snapshot?.printGraphics?.length||0)>0||
    (snapshot?.importedHardware?.length||0)>0
  const selected=useMemo(()=>panels.find(p=>p.id===(sourceId||panels[0]?.id)),[panels,sourceId])
  const other=useMemo(()=>panels.find(p=>p.id===(targetId||panels.find(q=>q.id!==selected?.id)?.id)),[panels,targetId,selected])
  const current=sourcePoint(snapshot,link)
  const nums=()=>[Number(x),Number(y)].map(v=>v/1000)
  const run=async request=>{
    if(blocked||typeof onCommit!=='function')return
    setBusy(true);setMessage('')
    try{
      const result=await onCommit({...request,revision:snapshot.revision})
      if(!result?.ok)throw Error(result?.reason||'Native cross-piece operation was not witnessed')
      setMessage(`Native ${request.op.replace('native-cross-piece-','')} verified at revision ${result.revision}. ${result.oneUndoStep?'One Rust Undo step.':''} Detached source; compatible six-size grades regenerate together.`)
      setX('');setY('')
    }catch(error){setMessage(`Review latest garment and Undo history before retrying: ${error?.message||String(error)}`)}
    finally{setBusy(false)}
  }
  const configure=()=>{
    if(!selected||!other||selected.id===other.id)return
    const a=Number(sourceIndex),b=Number(targetIndex)
    if(!isInt(a)||!isInt(b)||!finite(selected.polygon.points[a])||!finite(other.polygon.points[b])){
      setMessage('Choose valid anchors from different pattern pieces.');return
    }
    void run({op:'native-cross-piece-install',sourcePanelId:selected.id,
      sourcePointIndex:a,targetPanelId:other.id,targetPointIndex:b})
  }
  const move=()=>{
    if(!link?.active||!finite(current)||x.trim()===''||y.trim()===''||
      !Number.isFinite(Number(x))||!Number.isFinite(Number(y))){
      setMessage('Enter finite millimetre X and Y for the saved source anchor.');return
    }
    const target=nums()
    if(!finite(target)||target.some(v=>Math.abs(v)>10)){
      setMessage('Source coordinates are outside supported 2D material bounds.');return
    }
    void run({op:'native-cross-piece-move',sourcePanelId:link.sourcePanelId,
      expectedPosition:[...current],position:target})
  }
  return <section data-native-durable-cross-piece="true" aria-label="Persistent native cross-piece reference">
    <strong>RUST CONNECTED PIECE REFERENCE</strong>
    <p>Save a board-relative point relationship between two detached pieces, optionally with a compatible six-size grading catalog. Subsequent source edits made here regenerate the target point and adjacent Bézier control handles in one native Undo transaction.</p>
    {!link?.active?<>
      <label>Source piece
        <select aria-label="Persistent link source piece" value={selected?.id||''} onChange={event=>{setSourceId(event.target.value);setTargetId('');setMessage('')}} disabled={blocked}>
          {panels.map(p=><option key={p.id} value={p.id}>{p.name||p.id}</option>)}
        </select>
      </label>
      <label>Source point
        <select aria-label="Persistent link source point" value={sourceIndex} onChange={event=>setSourceIndex(event.target.value)} disabled={blocked}>
          {(selected?.polygon.points||[]).map((_,i)=><option key={i} value={i}>P{i+1}</option>)}
        </select>
      </label>
      <label>Dependent piece
        <select aria-label="Persistent link dependent piece" value={other?.id||''} onChange={event=>{setTargetId(event.target.value);setMessage('')}} disabled={blocked}>
          {panels.filter(p=>p.id!==selected?.id).map(p=><option key={p.id} value={p.id}>{p.name||p.id}</option>)}
        </select>
      </label>
      <label>Dependent point
        <select aria-label="Persistent link dependent point" value={targetIndex} onChange={event=>setTargetIndex(event.target.value)} disabled={blocked}>
          {(other?.polygon.points||[]).map((_,i)=><option key={i} value={i}>P{i+1}</option>)}
        </select>
      </label>
      <button type="button" disabled={blocked||!selected||!other||selected.id===other.id} onClick={configure}>
        Save native cross-piece relationship · one Undo
      </button>
    </>:<>
      <p role="status">Saved: {link.sourcePanelId} point {link.sourcePointIndex+1} → {link.targetPanelId} point {link.targetPointIndex+1}. Board displacement {link.boardOffsetM?.map(v=>(v*1000).toFixed(2)).join(' / ')} mm.</p>
      <label>New source X (mm)
        <input aria-label="Persistent cross-piece new source X mm" inputMode="decimal" value={x}
          placeholder={finite(current)?String(current[0]*1000):''} disabled={blocked} onChange={event=>setX(event.target.value)}/>
      </label>
      <label>New source Y (mm)
        <input aria-label="Persistent cross-piece new source Y mm" inputMode="decimal" value={y}
          placeholder={finite(current)?String(current[1]*1000):''} disabled={blocked} onChange={event=>setY(event.target.value)}/>
      </label>
      <button type="button" disabled={blocked||!finite(current)} onClick={move}>Move source + regenerate linked piece · one Undo</button>
      <button type="button" disabled={blocked} onClick={()=>void run({op:'native-cross-piece-clear'})}>Remove saved link · one Undo</button>
    </>}
    {blocked&&<p role="status">Persistent cross-piece references require an idle compatible native engine and detached source pieces without other native dependency or hardware attachments.</p>}
    {message&&<p role="status">{message}</p>}
    <small>Source and target geometry are computed in the Rust backend. Ordinary unrelated edits invalidate or remove this qualified link; use these commands to preserve its dependency. This is not automatic continuous regeneration during arbitrary dragging.</small>
  </section>
}
