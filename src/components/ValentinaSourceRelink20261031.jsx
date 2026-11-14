import React,{useMemo,useState} from 'react'
import {RefreshCcw} from 'lucide-react'
import {nativeBridgeFetch,nativeBridgeOrigin} from '../core/nativeWorkspaceTransport.js'
import {parseValentinaMeasurements} from '../core/valentinaMeasurements20261031.js'
import {editValentinaConstructionFormula20261031} from '../core/valentinaConstructionEdit20261031.js'
import {updateValentinaVitMeasurement20261031} from '../core/valentinaSourceMeasurementEdit20261031.js'

/** Refreshes real source-engine CUT geometry only by an explicit validated
 * action; never changes project pieces after a mere formula keystroke.
 */
export default function ValentinaSourceRelink20261031({patternSource,projectIdentity,onRefresh}){
  const [name,setName]=useState('')
  const [expression,setExpression]=useState('')
  const [measurementName,setMeasurementName]=useState('')
  const [measurementValue,setMeasurementValue]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [finished,setFinished]=useState(null)
  const increments=useMemo(()=>{
    const source=patternSource?.originalPatternXml
    if(typeof source!=='string')return []
    const entries=[]
    for(const match of source.matchAll(/<increment\b[^>]*\/\s*>/g)){
      const key=/\bname\s*=\s*"([^"]*)"/.exec(match[0])?.[1]
      const raw=/\bformula\s*=\s*"([^"]*)"/.exec(match[0])?.[1]
      if(/^#[A-Za-z_][A-Za-z0-9_]*$/.test(key||'')&&raw!==undefined)
        entries.push({name:key,formula:raw.replaceAll('&lt;','<').replaceAll('&gt;','>')
          .replaceAll('&quot;','"').replaceAll('&amp;','&')})
    }
    return entries
  },[patternSource?.originalPatternXml])
  const measures=useMemo(()=>{
    try{
      const doc=parseValentinaMeasurements(patternSource?.originalMeasurementsXml||'',{filename:'source.vit'})
      return doc.kind==='vit'?Object.values(doc.measurements).filter(v=>!v.isFormula&&Number.isFinite(v.valueCm)):[]
    }catch{return []}
  },[patternSource?.originalMeasurementsXml])
  const selected=increments.find(item=>item.name===name)
  const selectedMeasure=measures.find(item=>item.name===measurementName)
  const editFormula=Boolean(selected&&expression.trim()&&expression!==selected.formula)
  const editMeasure=Boolean(selectedMeasure&&measurementValue.trim()&&
    Number(measurementValue)!==Number(selectedMeasure.raw.value))
  const sourceUnit=patternSource?.sourceUnit||
    /^explicit (mm|cm|inch)\/unit$/.exec(patternSource?.sourceScale||'')?.[1]
  const execute=async()=>{
    if(busy||!patternSource?.originalPatternXml||!patternSource?.originalMeasurementsXml||(!editFormula&&!editMeasure))
      return
    setBusy(true);setError('');setFinished(null)
    try{
      const root=nativeBridgeOrigin()
      if(!root)throw Error('EXO trusted local calculation bridge is not running')
      if(!['mm','cm','inch'].includes(sourceUnit))throw Error('Unknown source units; reopen from an original calculated AAMA source')
      const baseline=patternSource
      const patternXml=editFormula
        ?editValentinaConstructionFormula20261031(baseline.originalPatternXml,{
          incrementName:name,formula:expression.trim(),attribute:'formula',
        }):baseline.originalPatternXml
      const measurementsXml=editMeasure
        ?updateValentinaVitMeasurement20261031(baseline.originalMeasurementsXml,
          measurementName,Number(measurementValue))
        :baseline.originalMeasurementsXml
      const response=await nativeBridgeFetch(root+'/valentina/v1/semantic-evaluate',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({patternXml,measurementsXml,format:'aama-r10',sourceUnit}),
        signal:AbortSignal.timeout(180000),
      })
      const data=await response.json()
      if(!response.ok||!data?.ok||data.bridge!=='semantic-source-translation'||
         data.manufacturingApproved!==false||data.factoryExportAllowed!==false||
         data.artifacts?.length!==1)
        throw Error(data?.reason||'Original source engine could not recalculate this construction')
      if(typeof onRefresh!=='function')throw Error('EXO source refresh is not connected')
      const committed=await onRefresh({patternXml,measurementsXml,engineResult:data,
        expectedProjectIdentity:projectIdentity,
        expectedOriginalPatternSha256:baseline.originalPatternSha256,
        expectedOriginalMeasurementsSha256:baseline.originalMeasurementsSha256,
        expectedOriginalAamaSha256:baseline.originalAamaSha256,
      })
      setFinished(committed)
      setName('');setExpression('');setMeasurementName('');setMeasurementValue('')
    }catch(cause){
      setError(String(cause?.message||cause))
    }finally{setBusy(false)}
  }
  return <section className="panel-section" aria-label="Source-linked Valentina CUT recalculation">
    <div className="panel-title"><span>Recalculate source-linked CUT pieces</span><strong>ORIGINAL ENGINE · UNAPPROVED</strong></div>
    <p className="panel-copy">This draft retains the original Valentina construction and measurements. Change a source formula or body measurement, then recalculate its actual CUT pieces with the original Seamly2D engine. EXO verifies the source hashes and current draft before replacing any geometry. Undo restores the previous pieces.</p>
    <label className="panel-copy">Construction formula
      <select aria-label="Recalculate Valentina increment" disabled={busy} value={name}
        onChange={event=>{
          const item=increments.find(v=>v.name===event.target.value)
          setName(event.target.value);setExpression(item?.formula||'')
          setFinished(null)
        }}>
        <option value="">Leave formula unchanged</option>
        {increments.map(v=><option value={v.name} key={v.name}>{v.name}</option>)}
      </select>
    </label>
    {selected&&<label className="panel-copy">Original source expression
      <input aria-label="Source-linked CUT expression" type="text" spellCheck={false}
        disabled={busy} value={expression} onChange={event=>setExpression(event.target.value)}/>
    </label>}
    <label className="panel-copy">Individual body measurement
      <select aria-label="Recalculate Valentina measurement" disabled={busy} value={measurementName}
        onChange={event=>{
          const item=measures.find(v=>v.name===event.target.value)
          setMeasurementName(event.target.value);setMeasurementValue(String(item?.raw.value??''))
          setFinished(null)
        }}>
        <option value="">Leave body measurements unchanged</option>
        {measures.map(item=><option key={item.name} value={item.name}>{item.name}</option>)}
      </select>
    </label>
    {selectedMeasure&&<label className="panel-copy">Original body measurement · {selectedMeasure.name}
      <input aria-label="Source-linked CUT body measurement" type="number" step="0.1"
        min="0.001" max="1000000" disabled={busy} value={measurementValue}
        onChange={event=>setMeasurementValue(event.target.value)}/>
    </label>}
    <button className="wide-action" type="button" onClick={execute}
      disabled={busy||(!editFormula&&!editMeasure)||!sourceUnit}>
      <RefreshCcw size={14}/>{busy?'RECALCULATING ORIGINAL CONSTRUCTION…':'RECALCULATE + REPLACE LINKED CUT · UNDOABLE'}
    </button>
    <p className="panel-copy">Source units: {sourceUnit||'unknown'} · factory release: blocked. Previously hand-edited CUT geometry or annotations may require manual resolution; they are never silently discarded.</p>
    {error&&<p className="panel-copy" role="alert">CUT recalculation refused: {error}</p>}
    {finished&&<p className="panel-copy" role="status">Updated {finished.pieceCount} source CUT pieces through verified upstream calculation. {finished.changedCount} physical outlines changed. Undo is available. Manufacturing output remains unapproved.</p>}
  </section>
}
