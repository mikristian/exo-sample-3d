import React,{useMemo,useState} from 'react'
import {evaluateValentinaExtendedGeometry20261031} from '../core/valentinaExtendedGeometry20261031.js'
import {evaluateValentinaGradedMeasurements20261031} from '../core/valentinaGradedMeasurements20261031.js'
import {evaluateValentinaConnectedSizeRun20261031} from '../core/valentinaConnectedSizeRun20261031.js'

/** Source-connected construction point editor, independent of physical CUT.
 * All coordinates and dependents originate in parsed Valentina source tools.
 */
export default function ValentinaNativeConnectedDraft20261031({reference,measurementReference,onEditSource}){
  const [increment,setIncrement]=useState('')
  const [expression,setExpression]=useState('')
  const [previewEdit,setPreviewEdit]=useState(true)
  const [sizeSteps,setSizeSteps]=useState(0)
  const [heightSteps,setHeightSteps]=useState(0)
  const [showGradedRun,setShowGradedRun]=useState(false)
  const [toolId,setToolId]=useState('')
  const [toolAttribute,setToolAttribute]=useState('length')
  const [toolExpression,setToolExpression]=useState('')
  const selected=reference?.increments?.find(row=>row.name===increment)
  const differs=Boolean(selected&&expression!==selected.formula&&expression.trim())
  const override=differs&&previewEdit?{[increment]:expression}:{}
  const editableTools=useMemo(()=>{
    const occurrences=new Map()
    for(const block of reference?.blocks||[])for(const node of block.nodes||[])
      occurrences.set(node.id,(occurrences.get(node.id)||0)+1)
    return (reference?.blocks||[]).flatMap((block,drawIndex)=>(block.nodes||[])
      .filter(node=>node.family==='point'&&occurrences.get(node.id)===1&&
        ['length','angle','x','y'].some(key=>Object.hasOwn(node.attributes||{},key)))
      .map(node=>({...node,drawIndex})))
  },[reference])
  const selectedTool=editableTools.find(t=>t.id===toolId)
  const toolDiffers=Boolean(selectedTool&&toolExpression.trim()&&
    toolExpression!==selectedTool.attributes[toolAttribute])
  const toolOverrides=toolDiffers&&previewEdit?{[toolId]:{[toolAttribute]:toolExpression}}:{}
  const graded=useMemo(()=>{
    try{return measurementReference?{ok:true,result:evaluateValentinaGradedMeasurements20261031(
      measurementReference,{sizeSteps,heightSteps,patternUnit:reference?.unit||'cm'})}:{ok:true,result:null}}
    catch(error){return {ok:false,reason:String(error?.message||error)}}
  },[measurementReference,sizeSteps,heightSteps,reference?.unit])
  const evaluated=useMemo(()=>{
    try{
      if(!graded.ok)throw Error(graded.reason)
      return {ok:true,value:evaluateValentinaExtendedGeometry20261031(reference,{
        increments:override,measurements:graded.result?.measurements||{},
        formulaEdits:toolOverrides,maxPoints:2000})}
    }catch(error){return {ok:false,reason:String(error?.message||error)}}
  },[reference,increment,expression,previewEdit,graded,toolId,toolAttribute,toolExpression])
  const sizeRun=useMemo(()=>{
    if(!showGradedRun||measurementReference?.kind!=='vst')return null
    try{
      return {ok:true,value:evaluateValentinaConnectedSizeRun20261031(reference,measurementReference,{
        sizeSteps:[-2,-1,0,1,2],heightSteps:[heightSteps],maxCases:5,maxPoints:2000,
      })}
    }catch(error){return {ok:false,reason:String(error?.message||error)}}
  },[reference,measurementReference,heightSteps,showGradedRun])
  const points=evaluated.ok?evaluated.value.blocks.flatMap((block,index)=>block.points.map(p=>({...p,block:index}))):[]
  const coords=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<1e5&&Math.abs(p.y)<1e5)
  const extent=coords.length?{
    minX:Math.min(...coords.map(p=>p.x)),maxX:Math.max(...coords.map(p=>p.x)),
    minY:Math.min(...coords.map(p=>p.y)),maxY:Math.max(...coords.map(p=>p.y)),
  }:{minX:-20,maxX:20,minY:-20,maxY:20}
  const margin=8
  const vb=[extent.minX-margin,extent.minY-margin,
    Math.max(5,extent.maxX-extent.minX)+2*margin,
    Math.max(5,extent.maxY-extent.minY)+2*margin]
  const segments=evaluated.ok?evaluated.value.blocks.flatMap((block,index)=>{
    const indexed=new Map(block.points.map(p=>[p.id,p]))
    const source=reference.blocks[index]?.nodes||[]
    return source.flatMap(node=>{
      const end=indexed.get(node.id),start=indexed.get(node.attributes?.firstPoint||node.attributes?.basePoint)
      if(!start||!end||start===end)return []
      return [{key:index+'-'+node.id,start,end}]
    })
  }):[]
  return <section className="panel-section" aria-label="Connected Valentina 2D construction drafting">
    <div className="panel-title"><span>Connected Valentina 2D construction</span><strong>ORIGINAL TOOL DEPENDENCIES</strong></div>
    <p className="panel-copy">EXO evaluates source-linked construction points and their dependencies. Changes to an original increment recalculate its downstream points. Unsupported curves and tool types remain diagnostic, not fabricated geometry.</p>
    {measurementReference&&<div className="panel-copy" aria-label="Connected Valentina body measurements and size axes">
      <strong>{measurementReference.measurementCount} original body measurements · {measurementReference.kind.toUpperCase()}</strong>
      <p>Body measurements are resolved in the source pattern unit before evaluating connected drafting points. A size step represents one original table increment, not a guessed clothing size.</p>
      {measurementReference.kind==='vst'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <label>Original size steps
          <input type="number" min="-20" max="20" step="1" aria-label="Valentina size grade steps"
            value={sizeSteps} onChange={e=>setSizeSteps(Number(e.target.value))}/>
        </label>
        <label>Original height steps
          <input type="number" min="-20" max="20" step="1" aria-label="Valentina height grade steps"
            value={heightSteps} onChange={e=>setHeightSteps(Number(e.target.value))}/>
        </label>
      </div>}
      {graded.ok&&graded.result&&<small>Resolved {graded.result.rows.length} source measurements in {graded.result.patternUnit}. Original size-axis base: {graded.result.sizeBase??'individual'}; height-axis base: {graded.result.heightBase??'individual'}.</small>}
      {!graded.ok&&<small role="alert">Measurement grading refused: {graded.reason}</small>}
      {measurementReference.kind==='vst'&&<label style={{display:'flex',alignItems:'center',gap:6,marginTop:7}}>
        <input type="checkbox" checked={showGradedRun} onChange={e=>setShowGradedRun(e.target.checked)}/>
        Compare five source-linked 2D sizes (−2 through +2 original increments)
      </label>}
      {sizeRun?.ok&&<div role="status">
        <strong>Measured 2D size run: {sizeRun.value.cases.length} source constructions</strong>
        {sizeRun.value.comparisons.map(c=><small key={c.sizeSteps} style={{display:'block'}}>
          Size step {c.sizeSteps>0?'+':''}{c.sizeSteps}: {c.commonCount} common points, {c.movedCount} moved, maximum point displacement {c.maxPointShift.toFixed(2)} {reference.unit}
        </small>)}
        <small>Measured source-point grading only. CUT/STITCH nesting and factory approval are not inferred.</small>
      </div>}
      {sizeRun&&!sizeRun.ok&&<small role="alert">Source-linked size run refused: {sizeRun.reason}</small>}
    </div>}
    {reference?.increments?.length>0&&<div className="panel-copy">
      <label style={{display:'block'}}>Editable source increment
        <select aria-label="Connected Valentina increment" value={increment} onChange={e=>{
          const next=reference.increments.find(i=>i.name===e.target.value)
          setIncrement(e.target.value);setExpression(next?.formula||'')
        }}>
          <option value="">Select increment</option>
          {reference.increments.map(entry=><option value={entry.name} key={entry.name}>{entry.name}</option>)}
        </select>
      </label>
      {selected&&<label style={{display:'block'}}>Formula expression
        <input aria-label="Valentina connected point formula" type="text" value={expression}
          spellCheck={false} onChange={event=>setExpression(event.target.value)}/>
      </label>}
      {selected&&<label style={{display:'flex',alignItems:'center',gap:6}}>
        <input type="checkbox" checked={previewEdit} onChange={event=>setPreviewEdit(event.target.checked)}/>
        Preview recalculated dependent construction
      </label>}
      {differs&&<button className="wide-action compact-action" type="button" disabled={!evaluated.ok||typeof onEditSource!=='function'}
        onClick={()=>onEditSource({incrementName:increment,attribute:'formula',formula:expression})}>
        COMMIT ORIGINAL FORMULA · UNDOABLE SOURCE EDIT
      </button>}
      {selected&&<button type="button" className="wide-action compact-action" onClick={()=>setExpression(selected.formula)}>
        REVERT PREVIEW FORMULA
      </button>}
    </div>}
    {editableTools.length>0&&<div className="panel-copy" aria-label="Direct Valentina construction-point editing">
      <strong>Individual source construction tools · {editableTools.length} editable point commands</strong>
      <label style={{display:'block'}}>Original point ID and operation
        <select aria-label="Valentina point tool" value={toolId} onChange={event=>{
          const found=editableTools.find(t=>t.id===event.target.value)
          const attribute=['length','angle','x','y'].find(key=>Object.hasOwn(found?.attributes||{},key))||'length'
          setToolId(event.target.value);setToolAttribute(attribute);setToolExpression(found?.attributes?.[attribute]||'')
        }}>
          <option value="">Select a connected source point</option>
          {editableTools.map(node=><option value={node.id} key={node.id}>
            {node.name||'Point'} · ID {node.id} · {node.type}
          </option>)}
        </select>
      </label>
      {selectedTool&&<>
        <label style={{display:'block'}}>Editable original tool expression
          <select aria-label="Valentina point attribute" value={toolAttribute} onChange={event=>{
            setToolAttribute(event.target.value);setToolExpression(selectedTool.attributes[event.target.value])
          }}>
            {['length','angle','x','y'].filter(key=>Object.hasOwn(selectedTool.attributes,key))
              .map(key=><option value={key} key={key}>{key}</option>)}
          </select>
          <input type="text" aria-label="Edit Valentina point construction expression" value={toolExpression}
            onChange={e=>setToolExpression(e.target.value)} spellCheck={false}/>
        </label>
        {toolDiffers&&<button type="button" className="wide-action compact-action"
          disabled={!evaluated.ok||typeof onEditSource!=='function'}
          onClick={()=>onEditSource({toolId,drawIndex:selectedTool.drawIndex,attribute:toolAttribute,formula:toolExpression})}>
          COMMIT ORIGINAL TOOL EXPRESSION · UNDOABLE
        </button>}
        <button type="button" className="wide-action compact-action"
          onClick={()=>setToolExpression(selectedTool.attributes[toolAttribute])}>REVERT TOOL PREVIEW</button>
      </>}
    </div>}
    {evaluated.ok?<div className="panel-copy" role="status">
      {evaluated.value.pointCount} evaluated source construction points · {evaluated.value.diagnostics.length} unsupported/dependency diagnostic(s)
      {coords.length>0&&<svg aria-label="Valentina original calculated 2D point geometry" role="img"
        viewBox={vb.join(' ')} style={{display:'block',background:'#f7f7f4',width:'100%',height:260,borderRadius:6}}>
        {segments.map(s=><line key={s.key} x1={s.start.x} y1={s.start.y} x2={s.end.x} y2={s.end.y}
          stroke="#6c8089" strokeWidth={0.27} vectorEffect="non-scaling-stroke"/>)}
        {coords.slice(0,500).map(p=><circle key={p.block+'-'+p.id} cx={p.x} cy={p.y} r={0.4}
          stroke="#fff" strokeWidth={0.1} fill="#1e6b9d"><title>{p.name||p.id} ({p.x.toFixed(2)}, {p.y.toFixed(2)})</title></circle>)}
        {sizeRun?.ok&&sizeRun.value.cases.flatMap((candidate,index)=>{
          if(candidate.sizeSteps===0)return []
          const fill=index<2?'#8a7389':'#26857f'
          return Object.values(candidate.points).slice(0,500).map(p=>
            <circle key={'graded-'+index+'-'+p.blockIndex+'-'+p.id} cx={p.x} cy={p.y}
              r={0.29} fill={fill} fillOpacity={0.55}>
              <title>Size step {candidate.sizeSteps}: {p.name||p.id} ({p.x.toFixed(2)}, {p.y.toFixed(2)})</title>
            </circle>)
        })}
      </svg>}
      {evaluated.value.diagnostics.slice(0,6).map((d,i)=><small key={i} style={{display:'block'}}>
        {d.code} · {d.name||d.id||d.block}: {d.message}
      </small>)}
      <p>Calculated source points are not automatically factory-approved physical CUT/STITCH contours. Native Rust 3D sewing and graded rule tables are preserved unchanged.</p>
    </div>:<p role="alert" className="panel-copy">Original connected construction could not be evaluated: {evaluated.reason}</p>}
  </section>
}
