import React, {useEffect,useMemo,useState} from 'react'
import {Download,Upload,Ruler} from 'lucide-react'
import {nativeBridgeFetch,nativeBridgeOrigin} from '../core/nativeWorkspaceTransport.js'
import {parseValentinaMeasurements} from '../core/valentinaMeasurements20261031.js'
import {applyValentinaVitMeasurementEdits20261031} from '../core/valentinaSourceMeasurementEdit20261031.js'
import {editValentinaConstructionFormula20261031} from '../core/valentinaConstructionEdit20261031.js'

const MAX_SOURCE=8*1024*1024
const MAX_MEASURES=2*1024*1024

/** The original Valentina graph is never flattened or asserted to be an EXO Rust graph. */
export default function ValentinaUpstreamEngineStudio20261031({onReferenceImport,nativeMode=false}){
  const [source,setSource]=useState(null)
  const [measurements,setMeasurements]=useState(null)
  const [measurementEdits,setMeasurementEdits]=useState({})
  const [incrementName,setIncrementName]=useState('')
  const [incrementFormula,setIncrementFormula]=useState('')
  const [format,setFormat]=useState('svg')
  const [executionMode,setExecutionMode]=useState('semantic')
  const [unit,setUnit]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [result,setResult]=useState(null)
  const [preview,setPreview]=useState('')
  const increments=useMemo(()=>{
    if(!source?.content)return []
    const entries=[]
    for(const match of source.content.matchAll(/<increment\b[^>]*\/\s*>/g)){
      const name=/\bname="(#[A-Za-z_][A-Za-z0-9_]*)"/.exec(match[0])?.[1]
      const formula=/\bformula="([^"]*)"/.exec(match[0])?.[1]
      if(name&&formula!==undefined) entries.push({name,formula:
        formula.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&')})
    }
    return entries
  },[source])
  const selectedIncrement=increments.find(i=>i.name===incrementName)
  const formulaChanged=Boolean(selectedIncrement&&incrementFormula.trim()&&incrementFormula!==selectedIncrement.formula)
  useEffect(()=>{
    const xml=result?.artifacts?.find(a=>a.name.endsWith('.svg'))?.content
    if(!xml){setPreview('');return}
    const object=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'}))
    setPreview(object)
    return ()=>URL.revokeObjectURL(object)
  },[result])
  const load=async(event,kind)=>{
    const file=event.target.files?.[0]
    event.target.value=''
    if(!file)return
    try{
      const pattern=kind==='pattern'
      if(!((pattern?/\.val$/i:/\.(vit|vst)$/i).test(file.name))||
        !file.size||file.size>(pattern?MAX_SOURCE:MAX_MEASURES))
        throw Error(pattern?'Select a Valentina .val pattern up to 8 MB':'Select a Valentina .vit or .vst measurement file up to 2 MB')
      const next={name:file.name,content:await file.text()}
      if(pattern){
        setSource(next)
        setIncrementName('')
        setIncrementFormula('')
      }
      else {
        next.parsed=parseValentinaMeasurements(next.content,{filename:file.name})
        setMeasurements(next)
        setMeasurementEdits({})
      }
      setError('');setResult(null)
    }catch(e){setError(e.message)}
  }
  const evaluate=async()=>{
    if(!source||!measurements||busy)return
    setError('');setResult(null);setBusy(true)
    try{
      const root=nativeBridgeOrigin()
      if(!root)throw Error('A trusted local EXO calculation bridge is required')
      if(format==='aama-r10'&&!unit)throw Error('Select source drawing units for DXF exchange')
      if(measurements.parsed.kind!=='vit')throw Error('Executable upstream mapping currently accepts individual .vit measurements; .vst tables remain view-only')
      const updatedMeasurements=applyValentinaVitMeasurementEdits20261031(measurements.content,measurementEdits)
      const constructionEdits=formulaChanged?[{kind:'increment',name:incrementName,formula:incrementFormula.trim()}]:[]
      const semantic=executionMode==='semantic'
      const sourceForEvaluation=semantic&&constructionEdits.length
        ?editValentinaConstructionFormula20261031(source.content,{
          incrementName,attribute:'formula',formula:incrementFormula.trim()})
        :source.content
      const endpoint=semantic?'semantic-evaluate':(constructionEdits.length?'connected-evaluate':'evaluate')
      const response=await nativeBridgeFetch(root+'/valentina/v1/'+endpoint,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({patternXml:sourceForEvaluation,measurementsXml:updatedMeasurements,format,
          ...(!semantic&&constructionEdits.length?{constructionEdits}:{}),
          ...(format==='aama-r10'?{sourceUnit:unit}:{})}),
        signal:AbortSignal.timeout(90000),
      })
      const data=await response.json()
      if(!response.ok||!data?.ok||data.manufacturingApproved!==false||!data.artifacts?.length)
        throw Error(data?.reason||'Valentina source evaluation is unsupported by the connected upstream calculator')
      setResult({...data,sourceMeasurementsXml:updatedMeasurements,
        ...(semantic?{editedOriginalPatternXml:sourceForEvaluation,constructionEdits}:{}),
      })
    }catch(e){setError(e.message||'Source evaluation failed')}
    finally{setBusy(false)}
  }
  const download=(file)=>{
    const object=URL.createObjectURL(new Blob([file.content],{type:file.name.endsWith('.svg')?'image/svg+xml':'application/dxf'}))
    const anchor=document.createElement('a')
    try{anchor.href=object;anchor.download=file.name;document.body.appendChild(anchor);anchor.click()}
    finally{anchor.remove();setTimeout(()=>URL.revokeObjectURL(object),1000)}
  }
  return <section className="panel-section" aria-label="Valentina pattern calculation">
    <div className="panel-title"><span>Valentina → Original Drafting Engine</span><strong>ACTUAL GEOMETRY OUTPUT</strong></div>
    <p className="panel-copy">Check whether an original Valentina pattern can be evaluated by the installed upstream drafting engine. The converter rejects unsupported source operations rather than substituting drawn approximations. This is not an embedded Valentina C++ engine.</p>
    <label className="panel-copy">Source calculation mode
      <select aria-label="Valentina calculation mode" value={executionMode} onChange={e=>{
        setExecutionMode(e.target.value);setResult(null)
      }}>
        <option value="semantic">Broader semantic .VAL → original Seamly2D calculation</option>
        <option value="verified">Verified paired original construction · Shirt/Trousers</option>
      </select>
    </label>
    <p className="panel-copy">{executionMode==='semantic'
      ?'Convert the actual uploaded source commands and formulas into a compatible construction before running the genuine engine. Unsupported constructs fail explicitly. Independent cross-engine dimensional parity is not yet certified.'
      :'Execute the two previously source-authenticated original construction pairs. Unknown and modified files without an accepted connected edit are rejected.'}</p>
    <label className="wide-action compact-action" style={{display:'block',cursor:'pointer'}}>
      <Upload size={14}/> {source?.name||'1 · SELECT VALENTINA .VAL PATTERN'}
      <input hidden type="file" accept=".val" onChange={e=>load(e,'pattern')}/>
    </label>
    <label className="wide-action compact-action" style={{display:'block',cursor:'pointer'}}>
      <Ruler size={14}/> {measurements?.name||'2 · SELECT .VIT / .VST MEASUREMENTS'}
      <input hidden type="file" accept=".vit,.vst" onChange={e=>load(e,'measurements')}/>
    </label>
    {measurements?.parsed&&<div className="panel-copy" aria-label="Editable Valentina source measurements" style={{padding:'8px 0'}}>
      <strong>Source measurements · {measurements.parsed.sourceUnit}</strong>
      <p>{measurements.parsed.kind==='vit'
        ?'Edit numeric measurements here, then calculate again with the original upstream engine. Original uploaded files are not modified.'
        :'Multisize .vst fields are preserved; this executable source pairing currently requires individual .vit measurements.'}</p>
      {measurements.parsed.kind==='vit'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(125px,1fr))',gap:7}}>
        {Object.values(measurements.parsed.measurements).slice(0,30).map(entry=><label key={entry.name} style={{display:'flex',flexDirection:'column',gap:4}}>
          <small>{entry.name.replaceAll('_',' ')}</small>
          <input type="number" min="0.001" max="1000000" step="0.1"
            aria-label={`Valentina ${entry.name} measurement`}
            disabled={busy||entry.isFormula}
            value={measurementEdits[entry.name]??entry.raw.value??''}
            onChange={e=>{setMeasurementEdits(prev=>({...prev,[entry.name]:e.target.value}));setResult(null)}}/>
        </label>)}
      </div>}
      {Object.keys(measurementEdits).length>0&&<button className="wide-action compact-action" type="button"
        onClick={()=>{setMeasurementEdits({});setResult(null)}}>RESTORE UPLOADED MEASUREMENTS</button>}
    </div>}
    {source&&increments.length>0&&<div className="panel-copy" aria-label="Editable original Valentina construction formulas" style={{padding:'8px 0'}}>
      <strong>Connected construction formulas · {increments.length} source variables</strong>
      <p>Choose a source formula to edit. Recalculation executes the full matching upstream construction graph and recomputes all dependent pattern pieces. The original uploaded file is preserved.</p>
      <label style={{display:'block'}}>Original construction variable
        <select aria-label="Valentina connected construction increment" value={incrementName}
          onChange={e=>{
            const entry=increments.find(i=>i.name===e.target.value)
            setIncrementName(e.target.value);setIncrementFormula(entry?.formula??'');setResult(null)
          }}>
          <option value="">Select a construction formula</option>
          {increments.map(v=><option key={v.name} value={v.name}>{v.name}</option>)}
        </select>
      </label>
      {selectedIncrement&&<label style={{display:'block'}}>Live construction expression
        <input aria-label="Edit Valentina construction formula" type="text" value={incrementFormula}
          onChange={e=>{setIncrementFormula(e.target.value);setResult(null)}} disabled={busy}
          autoComplete="off" spellCheck={false}/>
      </label>}
      {formulaChanged&&<p role="status">Modified {incrementName}: recalculation will update the original dependent geometric construction. Factory release remains blocked.</p>}
      {selectedIncrement&&<button type="button" className="wide-action compact-action"
        onClick={()=>{setIncrementFormula(selectedIncrement.formula);setResult(null)}}>RESTORE ORIGINAL CONSTRUCTION FORMULA</button>}
    </div>}
    <label className="panel-copy">Export format
      <select aria-label="Valentina source output format" value={format} onChange={e=>{setFormat(e.target.value);setResult(null)}}>
        <option value="svg">SVG editable vector reference</option>
        <option value="aama-r10">AAMA DXF candidate output</option>
      </select>
    </label>
    {format==='aama-r10'&&<label className="panel-copy">Declared drawing units
      <select aria-label="Valentina DXF output units" value={unit} onChange={e=>{setUnit(e.target.value);setResult(null)}}>
        <option value="">Select units</option><option value="mm">Millimeters</option>
        <option value="cm">Centimeters</option><option value="inch">Inches</option>
      </select>
    </label>}
    <button className="wide-action" type="button" disabled={!source||!measurements||measurements.parsed.kind!=='vit'||busy||(format==='aama-r10'&&!unit)} onClick={evaluate}>
      <Ruler size={14}/>{busy?'RUNNING UPSTREAM ENGINE…':'3 · CALCULATE ORIGINAL PATTERN'}
    </button>
    {error&&<p className="panel-copy" role="alert">{error}</p>}
    {result&&<div role="status" className="panel-copy">
      <strong>Upstream pattern geometry produced</strong> · {result.artifacts.length} output file(s) · not factory approved.
      {preview&&<img src={preview} alt="Upstream-calculated Valentina-compatible pattern preview" style={{width:'100%',maxHeight:240,objectFit:'contain',background:'#fff'}}/>}
      {result.artifacts.map((file,i)=><button type="button" key={i} className="wide-action compact-action" onClick={()=>download(file)}>
        <Download size={14}/> DOWNLOAD {file.name} · {(file.sizeBytes/1024).toFixed(1)} KB
      </button>)}
      {typeof onReferenceImport==='function'&&format==='aama-r10'&&result.artifacts.length===1&&
        <button type="button" className="wide-action compact-action"
          disabled={Boolean(result.constructionEdits?.length)&&
            !['verified-connected-maleshirt','semantic-source-translation'].includes(result.bridge)}
          onClick={()=>onReferenceImport(result.artifacts[0],result,{
            editable:true,
            patternXml:result.bridge==='semantic-source-translation'
              ?result.editedOriginalPatternXml:source.content,
            measurementsXml:result.sourceMeasurementsXml,
          })}>
          {result.constructionEdits?.length&&
            !['verified-connected-maleshirt','semantic-source-translation'].includes(result.bridge)
            ?'EDITED SOURCE: SAVE DXF; TRANSFER REQUIRES REVALIDATION'
            :result.constructionEdits?.length
              ?'OPEN SOURCE-CALCULATED EXO 2D CUT DRAFT · NOT APPROVED'
              :'OPEN CALCULATED EXO 2D CUT DRAFT · NOT APPROVED'}
        </button>}
      {nativeMode&&format==='aama-r10'&&result.artifacts.length===1&&<p>This opens editable CUT outlines in the legacy EXO 2D draft. It does not replace the native Rust parametric graph or approve a factory pattern. Undo restores your previous garment.</p>}
      {result.constructionEdits?.length>0&&<p>Original construction recalculated: {result.constructionEdits.map(v=>v.name||v.id).join(', ')}. Downstream original engine geometry is refreshed. Native Rust source-dependent editing is a separate milestone.</p>}
      {result.bridge==='semantic-source-translation'&&<p>Translated original source: {result.convertedSourceToolCount} construction commands, {result.convertedSourcePieceCount} pieces and {result.convertedBlocks} drafting blocks. SVG/DXF output is unapproved; source-to-EXO native CUT transfer awaits an independent mapping check.</p>}
      <p>Original source SHA-256: {(result.originalPatternSha256||result.inputSha256)?.slice(0,16)}… . Construction formulas remain attached to the original source, not EXO native grading.</p>
    </div>}
  </section>
}
