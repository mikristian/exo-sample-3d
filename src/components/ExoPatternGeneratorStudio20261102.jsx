import React,{useEffect,useMemo,useState} from 'react'
import {generateEditablePatternCandidate} from '../core/exoLearnedPatternGenerator20261102.js'
import {decodeVerifiedGarmentProject} from '../core/exoDecodedGarmentProject20261102.js'
import {synthesizeExoPatternCandidate20261102} from '../core/exoPatternSynthesis20261102.js'
import {prepareNeuralContourResearchCandidate20261102} from '../core/exoResearchNeuralPattern20261102.js'
import {buildExperimentalSizeRun20261102} from '../core/exoGeneratedPatternGradeFit20261102.js'
import {projectToDxf} from '../core/dxf.js'
import {draftExoTextSketchPattern20261102} from '../core/exoTextSketchPatternCandidate20261102.js'
import {interpretExoSketchFile20261102} from '../core/exoSketchPatternInterpreter20261102.js'
import {interpretExoGarmentPhotoFile20261102} from '../core/exoGarmentPhotoReference20261102.js'
import {draftExoPhotoConditionedPattern20261102} from '../core/exoPhotoConditionedPattern20261102.js'
import {nativeBridgeFetch,nativeBridgeOrigin} from '../core/nativeWorkspaceTransport.js'
import './ExoPatternGeneratorStudio20261102.css'
import './ExoTextSketchDraft20261102.css'

export default function ExoPatternGeneratorStudio20261102({project,onApply,onExportDxf,nativeMode=false}) {
  const [percent,setPercent]=useState(2)
  const [reviewed,setReviewed]=useState(false)
  const candidate=useMemo(()=>generateEditablePatternCandidate(project,{scalePercent:percent}),[project,percent])
  const [applied,setApplied]=useState(false)
  const [sourceId,setSourceId]=useState('')
  const [lookupId,setLookupId]=useState('')
  const [neighbors,setNeighbors]=useState({state:'idle',results:[]})
  const [archiveDraft,setArchiveDraft]=useState({state:'idle'})
  const [archiveReviewed,setArchiveReviewed]=useState(false)
  const [nativeConfirmed,setNativeConfirmed]=useState(false)
  const [nativeImporting,setNativeImporting]=useState(false)
  const [donorId,setDonorId]=useState('default/00/rand_0VZLWSZ52V')
  const [blendWeight,setBlendWeight]=useState(0.5)
  const [synthesis,setSynthesis]=useState({state:'idle'})
  const [synthesisReviewed,setSynthesisReviewed]=useState(false)
  const [synthesisConfirmed,setSynthesisConfirmed]=useState(false)
  const [synthesisApplying,setSynthesisApplying]=useState(false)
  const [neuralSourceId,setNeuralSourceId]=useState('default/00/rand_V7F8J43Q5G')
  const [neuralSeed,setNeuralSeed]=useState(11)
  const [neuralStrength,setNeuralStrength]=useState(0.12)
  const [neural,setNeural]=useState({state:'idle'})
  const [neuralReviewed,setNeuralReviewed]=useState(false)
  const [neuralConfirmed,setNeuralConfirmed]=useState(false)
  const [neuralApplying,setNeuralApplying]=useState(false)
  const [sewingResearchId,setSewingResearchId]=useState('default/00/rand_00YONAPXZE')
  const [sewingResearch,setSewingResearch]=useState({state:'idle'})
  const [designPrompt,setDesignPrompt]=useState('Create an oversized cropped hoodie with long sleeves and kangaroo pocket, body length 58 cm')
  const [useSketch,setUseSketch]=useState(false)
  const [referenceKind,setReferenceKind]=useState('sketch')
  const [sketchTemplate,setSketchTemplate]=useState('tee')
  const [sketchFile,setSketchFile]=useState({state:'idle'})
  useEffect(()=>{
    const url=sketchFile.previewUrl
    return()=>{if(typeof url==='string'&&url.startsWith('blob:'))URL.revokeObjectURL(url)}
  },[sketchFile.previewUrl])
  const [designDraft,setDesignDraft]=useState({state:'idle'})
  const [designReviewed,setDesignReviewed]=useState(false)
  const [designNativeConfirmed,setDesignNativeConfirmed]=useState(false)
  const [designImporting,setDesignImporting]=useState(false)
  useEffect(()=>{
    if(!lookupId)return
    const controller=new AbortController()
    const origin=nativeBridgeOrigin()
    if(!origin){setNeighbors({state:'error',error:'Local native bridge unavailable.',results:[]});return()=>controller.abort()}
    const params=new URLSearchParams({sourceId:lookupId,limit:'5'})
    setNeighbors({state:'loading',results:[]})
    nativeBridgeFetch(`${origin}/pattern-intelligence/v1/geometry-neighbors?${params}`,{cache:'no-store',signal:controller.signal})
      .then(async response=>{const payload=await response.json();if(!response.ok||!payload?.ok||!Array.isArray(payload.results))throw Error(payload?.error||payload?.code||'Neighbor lookup unavailable');if(!controller.signal.aborted)setNeighbors({state:'ready',...payload})})
      .catch(error=>{if(!controller.signal.aborted)setNeighbors({state:'error',error:error.message,results:[]})})
    return()=>controller.abort()
  },[lookupId])
  const update=value=>{setPercent(value);setReviewed(false);setApplied(false)}
  const retrieveArchiveSource=async()=>{
    const id=sourceId.trim(),origin=nativeBridgeOrigin()
    setArchiveReviewed(false);setNativeConfirmed(false)
    if(!id||!origin){setArchiveDraft({state:'error',error:!id?'Enter an archive source ID.':'Local native bridge unavailable.'});return}
    setArchiveDraft({state:'loading'})
    try{
      const response=await nativeBridgeFetch(`${origin}/pattern-intelligence/v1/source-geometry?${new URLSearchParams({sourceId:id})}`,{cache:'no-store'})
      const payload=await response.json()
      if(!response.ok||!payload?.ok)throw Error(payload?.reason||payload?.error||payload?.code||'Source specification unavailable')
      const decoded=decodeVerifiedGarmentProject(payload,project)
      if(!decoded.ok)throw Error(decoded.reason)
      setArchiveDraft({state:'ready',...decoded})
    }catch(error){setArchiveDraft({state:'error',error:error.message})}
  }
  const retrieveSynthesis=async()=>{
    const first=sourceId.trim(),second=donorId.trim(),origin=nativeBridgeOrigin()
    setSynthesisReviewed(false);setSynthesisConfirmed(false)
    if(!first||!second||first===second||!origin){setSynthesis({state:'error',error:'Enter two different archive source IDs with an active EXO local bridge.'});return}
    setSynthesis({state:'loading'})
    try{
      const originals=[]
      for(const id of [first,second]){
        const response=await nativeBridgeFetch(`${origin}/pattern-intelligence/v1/source-geometry?${new URLSearchParams({sourceId:id})}`,{cache:'no-store'})
        const payload=await response.json()
        if(!response.ok||!payload?.ok||!payload.verified)throw Error(`${id}: ${payload?.error||payload?.reason||'Verified specification unavailable'}`)
        const decoded=decodeVerifiedGarmentProject(payload,project)
        if(!decoded.ok)throw Error(`${id}: ${decoded.reason}`)
        originals.push({sourceId:id,sourceVerified:true,verification:{status:'pass',sha256:payload.source?.sha256},project:decoded.project})
      }
      const result=synthesizeExoPatternCandidate20261102(originals,{weight:blendWeight})
      if(!result.ok)throw Error(result.reason)
      setSynthesis({state:'ready',...result})
    }catch(error){setSynthesis({state:'error',error:error.message})}
  }
  const generateTrainedContours=async()=>{
    const id=neuralSourceId.trim(),origin=nativeBridgeOrigin()
    setNeuralReviewed(false);setNeuralConfirmed(false)
    if(!id||!origin){setNeural({state:'error',error:'Provide a verified source ID and connect the native bridge.'});return}
    setNeural({state:'loading'})
    try{
      const sourceResponse=await nativeBridgeFetch(`${origin}/pattern-intelligence/v1/source-geometry?${new URLSearchParams({sourceId:id})}`,{cache:'no-store'})
      const source=await sourceResponse.json()
      if(!sourceResponse.ok||!source?.ok||source.verified!==true)throw Error(`Original source verification failed: ${source?.error||'Source unavailable'}`)
      const modelResponse=await nativeBridgeFetch(`${origin}/pattern-intelligence/v1/research-contour`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({sourceId:id,seed:neuralSeed,strength:neuralStrength}),
      })
      const model=await modelResponse.json()
      if(!modelResponse.ok||!model?.ok)throw Error(`Neural model unavailable or blocked: ${model?.reason||model?.code||'No prediction'}`)
      const checked=prepareNeuralContourResearchCandidate20261102(source,model,project)
      if(!checked.ok)throw Error(`${checked.reason}${checked.attempts?.length?` (${checked.attempts.length} constrained checks)` : ''}`)
      const grade=buildExperimentalSizeRun20261102(checked.project,{sizes:['S','M','L']})
      setNeural({state:'ready',...checked,grade,modelEvidence:model.researchModelEvidence})
    }catch(error){setNeural({state:'error',error:error.message})}
  }
  const downloadResearchSizeDxf=size=>{
    const projectForSize=neural.grade?.bySize?.[size]
    if(!projectForSize)return
    const contents=projectToDxf(projectForSize,size)
    const url=URL.createObjectURL(new Blob([contents],{type:'application/dxf'}))
    const anchor=document.createElement('a')
    anchor.href=url;anchor.download=`EXO-neural-research-${size}.dxf`
    document.body.appendChild(anchor);anchor.click();anchor.remove()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  const requestLearnedSeamGraph=async()=>{
    const id=sewingResearchId.trim(),origin=nativeBridgeOrigin()
    if(!id||!origin){setSewingResearch({state:'error',error:'Enter a verified archive source ID and use the native bridge.'});return}
    setSewingResearch({state:'loading'})
    try{
      const response=await nativeBridgeFetch(`${origin}/pattern-intelligence/v1/research-seam?${new URLSearchParams({sourceId:id,limit:'8'})}`,{cache:'no-store'})
      const data=await response.json()
      if(!response.ok||!data?.ok||!Array.isArray(data.proposals)||!Array.isArray(data.proposedDisjointGraph))throw Error(data?.reason||data?.code||'Seam-model inference unavailable')
      setSewingResearch({state:'ready',...data})
    }catch(error){setSewingResearch({state:'error',error:error.message})}
  }
  const interpretSketch=async file=>{
    setDesignDraft({state:'idle'});setDesignReviewed(false);setDesignNativeConfirmed(false)
    if(!file){setSketchFile({state:'idle'});return}
    setSketchFile({state:'loading',name:file.name})
    try{
      const parsed=referenceKind==='photo'?await interpretExoGarmentPhotoFile20261102(file):await interpretExoSketchFile20261102(file)
      if(!parsed.ok)throw Error(`${parsed.code||'UNRECOGNIZED_SKETCH'}: ${parsed.reason}`)
      setSketchFile({state:'ready',name:file.name,data:parsed,kind:referenceKind,
        previewUrl:referenceKind==='photo'?URL.createObjectURL(file):null})
      setUseSketch(true)
    }catch(error){setSketchFile({state:'error',name:file.name,error:error.message})}
  }
  const generateFromDescription=()=>{
    setDesignReviewed(false);setDesignNativeConfirmed(false)
    if(useSketch&&sketchFile.state!=='ready'){
      setDesignDraft({state:'error',error:referenceKind==='photo'?'A photo must show one complete, isolated garment against a plain contrasting background before it can guide drafting.':'A sketch must have one valid high-contrast closed silhouette before it can guide drafting.'})
      return
    }
    const options={prompt:designPrompt,forcedTemplateId:designPrompt.trim()?null:sketchTemplate}
    const result=useSketch&&referenceKind==='photo'
      ?draftExoPhotoConditionedPattern20261102({...options,photo:sketchFile.data})
      :draftExoTextSketchPattern20261102({...options,sketch:useSketch?sketchFile.data:null})
    setDesignDraft(result.ok?{state:'ready',...result}:{state:'error',error:result.reason,detail:result.detail})
  }
  const downloadDesignDxf=()=>{
    if(designDraft.state!=='ready')return
    const size=designDraft.project.grading.baseSize
    const dxf=projectToDxf(designDraft.project,size)
    const url=URL.createObjectURL(new Blob([dxf],{type:'application/dxf'}))
    const link=document.createElement('a')
    link.href=url
    link.download=`EXO-text-sketch-${designDraft.report.sourceTemplateId}-${size}-research.dxf`
    document.body.appendChild(link);link.click();link.remove()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  return <section className="exo-pattern-gen" aria-label="Editable pattern generator">
    <div className="exo-pattern-gen-head"><div><small>EXO / PATTERN DRAFT</small><h3>Editable pattern generator</h3><p>Draft a proportional variation of the complete garment and review it before applying.</p></div><span>Parametric · review required</span></div>
    <div className="exo-pattern-gen-neighbors" aria-label="Text sketch and photo to pattern studio">
      <strong>Design a garment from text, sketch or photo</strong>
      <p>Describe a garment in everyday language, optionally add a sketch or a single isolated garment photo, and create an editable sewing-pattern draft. EXO maps supported designs to authored construction, checks their seams and blocks unsupported geometry. Photo references reveal appearance and silhouette but do not expose hidden seam construction or physical fit.</p>
      <label htmlFor="exo-design-prompt">Garment description</label>
      <textarea id="exo-design-prompt" rows={3} maxLength={4000} value={designPrompt} onChange={event=>{setDesignPrompt(event.target.value);setDesignDraft({state:'idle'});setDesignReviewed(false);setDesignNativeConfirmed(false)}} placeholder="Example: oversized cropped hoodie with kangaroo pocket and body length 58 cm"/>
      <label className="exo-pattern-gen-review"><input type="checkbox" checked={useSketch} onChange={event=>{setUseSketch(event.target.checked);setSketchFile({state:'idle'});setDesignDraft({state:'idle'});setDesignReviewed(false);setDesignNativeConfirmed(false)}}/> Include an uploaded reference image</label>
      {useSketch&&<>
        <label htmlFor="exo-design-reference-kind">Reference type</label>
        <select id="exo-design-reference-kind" value={referenceKind} onChange={event=>{setReferenceKind(event.target.value);setSketchFile({state:'idle'});setDesignDraft({state:'idle'});setDesignReviewed(false);setDesignNativeConfirmed(false)}}>
          <option value="sketch">Line sketch / drawing</option><option value="photo">Photograph of an isolated garment</option>
        </select>
        <label htmlFor="exo-design-sketch">{referenceKind==='photo'?'Upload a fully visible garment photo against a plain background':'Upload a single closed front-silhouette drawing'} (PNG, JPEG or WebP, up to 8 MB)</label>
        <input id="exo-design-sketch" type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>interpretSketch(event.target.files?.[0])}/>
        <label htmlFor="exo-sketch-template">If no text description is given, select the intended garment type</label>
        <select id="exo-sketch-template" value={sketchTemplate} onChange={event=>{setSketchTemplate(event.target.value);setDesignDraft({state:'idle'})}}>
          <option value="tee">T-shirt / top</option><option value="hoodie">Hoodie / pullover</option><option value="zip-hoodie">Zip hoodie</option><option value="skirt">A-line skirt</option><option value="jeans-501-fit">Straight trousers</option><option value="jeans-501">Five-pocket jeans</option>
        </select>
        {sketchFile.state==='loading'&&<p role="status">Analyzing {referenceKind==='photo'?'photo foreground':'image silhouette'} on this computer…</p>}
        {sketchFile.state==='error'&&<p role="alert">{referenceKind==='photo'?'Photo':'Sketch'} could not be interpreted: {sketchFile.error}</p>}
        {sketchFile.state==='ready'&&<div className="exo-pattern-gen-source-preview">
          <strong>{referenceKind==='photo'?'Photo foreground':'Sketch outline'} read: {sketchFile.name}</strong>
          <span>{sketchFile.data.normalizedContour.length} outline points · pixel width/height ratio {sketchFile.data.silhouetteAspectRatio.toFixed(2)} · physical scale unknown</span>
          {referenceKind==='photo'&&sketchFile.previewUrl&&<img className="exo-pattern-gen-photo-preview" src={sketchFile.previewUrl} alt="Attached garment photograph, used only as uncalibrated shape reference"/>}
          <svg className="exo-pattern-gen-sketch-shape" viewBox="-5 -5 110 110" role="img" aria-label="Observed uncalibrated {referenceKind==='photo'?'photo':'sketch'} outline">
            <polygon points={sketchFile.data.normalizedContour.map(p=>`${p.x*100},${p.y*100}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <small>{sketchFile.data.warning}</small>
        </div>}
      </>}
      <button type="button" disabled={sketchFile.state==='loading'} onClick={generateFromDescription}>Generate editable garment pattern</button>
      {designDraft.state==='error'&&<div role="alert" className="exo-pattern-gen-source-preview"><strong>Design generation blocked</strong><span>{designDraft.error}</span><small>EXO will not invent an unsupported panel construction, zipper, drop-shoulder sleeve, lining, or padded assembly. Try a supported construction or review the pattern manually.</small></div>}
      {designDraft.state==='ready'&&<div className="exo-pattern-gen-source-preview">
        <strong>{designDraft.project.name}</strong>
        <span>{designDraft.report.panels} editable pieces · {designDraft.report.seams} original sewing relationships · base size {designDraft.report.baseSize} · digital QA passed</span>
        <div className="exo-pattern-gen-shapes" aria-label="Generated editable cutline previews">
          {designDraft.project.pieces.slice(0,12).map(piece=>{
            const points=piece.points||[]
            const xs=points.map(p=>p.x),ys=points.map(p=>p.y)
            const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys)
            const xy=p=>`${8+84*(p.x-minX)/Math.max(0.1,maxX-minX)} ${8+84*(p.y-minY)/Math.max(0.1,maxY-minY)}`
            const d=points.reduce((commands,p,i)=>{
              const next=points[(i+1)%points.length],control=piece.curves?.[i]
              return commands+(control?` Q ${xy({x:control.cx,y:control.cy})} ${xy(next)}`:` L ${xy(next)}`)
            },`M ${xy(points[0])}`)+' Z'
            return <svg key={piece.id} viewBox="0 0 100 100" role="img" aria-label={`${piece.name} editable stitchline draft`}><path d={d} fill="none" stroke="currentColor" strokeWidth="1.4"/></svg>
          })}
        </div>
        <span>Construction: {designDraft.report.sourceTemplateId} · {designDraft.report.adjustments.map(change=>change.feature).join(', ')||'authored foundation geometry'}</span>
        <small>{designDraft.report.warnings.join(' ')}</small>
        <label className="exo-pattern-gen-review"><input type="checkbox" checked={designReviewed} onChange={event=>{setDesignReviewed(event.target.checked);setDesignNativeConfirmed(false)}}/> I have reviewed the pattern shape, authored seams, and unsupported style/fit assumptions.</label>
        {nativeMode&&<label className="exo-pattern-gen-review"><input type="checkbox" checked={designNativeConfirmed} disabled={!designReviewed} onChange={event=>setDesignNativeConfirmed(event.target.checked)}/> Confirm native garment replacement and Undo reset after EXO saves an automatic File Library backup.</label>}
        <div className="exo-pattern-gen-actions">
          <button type="button" onClick={downloadDesignDxf}>Download editable research DXF</button>
          <button type="button" disabled={!designReviewed||(nativeMode&&!designNativeConfirmed)||designImporting} onClick={async()=>{
            setDesignImporting(true)
            try{
              const result=await onApply(designDraft.project)
              if(result===true){setDesignDraft({state:'idle'});setDesignReviewed(false);setDesignNativeConfirmed(false)}
              else setDesignDraft(current=>({...current,applyError:'EXO did not accept the drafted garment. Review the editor or File Library notice.'}))
            }catch(error){setDesignDraft(current=>({...current,applyError:error.message}))}
            finally{setDesignImporting(false)}
          }}>{designImporting?'Opening reviewed pattern…':nativeMode?'Confirm and open text/sketch garment':'Apply text/sketch draft through Undo'}</button>
        </div>
        {designDraft.applyError&&<p role="alert">{designDraft.applyError}</p>}
      </div>}
    </div>
    {!nativeMode&&<><label htmlFor="exo-pattern-scale">Whole-garment size adjustment <strong>{percent>0?'+':''}{percent}%</strong></label>
    <input id="exo-pattern-scale" type="range" min="-5" max="5" step="0.5" value={percent} onChange={event=>update(Number(event.target.value))}/>
    {!candidate.ok ? <p role="alert" className="exo-pattern-gen-error">Draft unavailable: {candidate.reason}</p> : <>
      <div className="exo-pattern-gen-preview" aria-label="Draft candidate preview"><strong>{candidate.project.name}</strong><span>{candidate.report.pieceCount} editable pieces · {candidate.report.seamCount} seam relationships · {candidate.report.notches} notches</span><div className="exo-pattern-gen-shapes">{candidate.project.pieces.slice(0,8).map(piece=>{const pts=piece.points;const minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));return <svg key={piece.id} viewBox="0 0 100 100" role="img" aria-label={`${piece.name} scaled outline`}><polygon points={pts.map(p=>`${8+84*(p.x-minX)/Math.max(1,maxX-minX)},${8+84*(p.y-minY)/Math.max(1,maxY-minY)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>})}</div><small>{candidate.report.caveat}</small></div>
      <label className="exo-pattern-gen-review"><input type="checkbox" checked={reviewed} onChange={event=>setReviewed(event.target.checked)}/> I reviewed the preview and want to create this editable garment.</label>
      <div className="exo-pattern-gen-actions"><button type="button" disabled={!reviewed||applied} onClick={()=>{if(onApply(candidate.project)===true){setApplied(true);setReviewed(false)}}}>{applied?'Draft applied':'Apply draft to editor'}</button><button type="button" onClick={onExportDxf}>Export current editor DXF</button></div>
    </>}</>}
    <div className="exo-pattern-gen-neighbors"><strong>Learned geometry neighbors</strong><p>Look up the five nearest archive sources using the trained geometry embedding index.</p>
      <form onSubmit={event=>{event.preventDefault();const id=sourceId.trim();if(id&&id!==lookupId)setLookupId(id);else if(!id)setNeighbors({state:'error',error:'Enter an archive source ID.',results:[]})}}>
        <label htmlFor="exo-gen-source-id">Archive source ID</label><input id="exo-gen-source-id" type="text" maxLength={256} value={sourceId} onChange={event=>setSourceId(event.target.value)} placeholder="default/00/rand_00YONAPXZE"/>
        <button type="submit" disabled={neighbors.state==='loading'}>Find nearest sources</button><button type="button" disabled={archiveDraft.state==='loading'} onClick={retrieveArchiveSource}>Load verified source draft</button>
      </form>
      {archiveDraft.state==='loading'&&<p role="status">Retrieving verified source geometry…</p>}
      {archiveDraft.state==='error'&&<p role="alert">Source import blocked: {archiveDraft.error}</p>}
      {archiveDraft.state==='ready'&&<div className="exo-pattern-gen-source-preview"><strong>{archiveDraft.project.name}</strong><span>{archiveDraft.report.pieceCount} editable pieces · {archiveDraft.report.seamCount} source seams · base size {archiveDraft.report.baseSize}</span><small>{archiveDraft.report.caveat}</small><label><input type="checkbox" checked={archiveReviewed} onChange={event=>{setArchiveReviewed(event.target.checked);setNativeConfirmed(false)}}/> I reviewed this source and its stitchline geometry.</label>{nativeMode&&<><p role="note">Opening this draft replaces the current native editor document and resets native Undo history. EXO saves an automatic backup of the current garment to File Library before replacement and blocks import if that backup fails. Physical fit remains unverified.</p><label><input type="checkbox" checked={nativeConfirmed} disabled={!archiveReviewed} onChange={event=>setNativeConfirmed(event.target.checked)}/> Confirm replacement of the native garment and reset of Undo history.</label></>}<button type="button" disabled={!archiveReviewed||(nativeMode&&!nativeConfirmed)||nativeImporting} onClick={async()=>{setNativeImporting(true);try{if(await onApply(archiveDraft.project)===true){setArchiveReviewed(false);setNativeConfirmed(false);setArchiveDraft({state:'idle'})}}finally{setNativeImporting(false)}}}>{nativeImporting?'Opening native draft…':nativeMode?'Confirm and open native draft':'Apply verified draft through Undo'}</button></div>}
      {neighbors.state==='loading'&&<p role="status">Searching trained source embeddings…</p>}
      {neighbors.state==='error'&&<p role="status">Lookup unavailable: {neighbors.error}</p>}
      {neighbors.state==='ready'&&<><p role="status">{neighbors.results.length} ranked neighbors for {neighbors.sourceId||lookupId} · {Number.isFinite(neighbors.embeddingCount)?neighbors.embeddingCount.toLocaleString():'—'} indexed geometry embeddings</p>
        <ol>{neighbors.results.map((item,index)=><li key={`${item.sourceId||index}-${index}`}><strong>{item.sourceId||'Unidentified source'}</strong><span>{Number.isFinite(item.similarity)?`${(item.similarity*100).toFixed(2)}% similarity`:'Similarity unavailable'}</span><small>License: {item.license||'Unrecorded'}</small></li>)}</ol>
        {!neighbors.results.length&&<p>No trained neighbors found for this source ID.</p>}
      </>}
      <small>Reference lookup only. Neighbor geometry is not automatically adapted, imported or applied to the editable draft. Similarity is an embedding retrieval score, not a fit or manufacturing certification.</small>
    </div>
    <div className="exo-pattern-gen-neighbors" aria-label="Novel pattern synthesis">
      <strong>Novel pattern synthesis</strong>
      <p>Combine two independently verified archive garments with matching sewing topology. The new cutlines must pass EXO’s industrial geometry and seam audit. Source selection here is manual; this is not a trained neural contour decoder.</p>
      <label htmlFor="exo-synth-donor">Second archive source ID</label>
      <input id="exo-synth-donor" type="text" maxLength={256} value={donorId} onChange={event=>{setDonorId(event.target.value);setSynthesis({state:'idle'});setSynthesisReviewed(false);setSynthesisConfirmed(false)}} placeholder="default/00/rand_0VZLWSZ52V"/>
      <label htmlFor="exo-synth-blend">Shape blend: {Math.round(blendWeight*100)}% from second source</label>
      <input id="exo-synth-blend" type="range" min="0.2" max="0.8" step="0.05" value={blendWeight} onChange={event=>{setBlendWeight(Number(event.target.value));setSynthesis({state:'idle'});setSynthesisReviewed(false);setSynthesisConfirmed(false)}}/>
      <button type="button" disabled={synthesis.state==='loading'} onClick={retrieveSynthesis}>Generate and validate new pattern</button>
      {synthesis.state==='loading'&&<p role="status">Verifying both sources, matching construction edges and validating a new cutline…</p>}
      {synthesis.state==='error'&&<p role="alert">Synthesis blocked: {synthesis.error}</p>}
      {synthesis.state==='ready'&&<div className="exo-pattern-gen-source-preview">
        <strong>New validated digital draft</strong>
        <span>{synthesis.report.pieceCount} pattern pieces · {synthesis.report.seamCount} source-derived seams · maximum change {synthesis.report.noveltyMaxDisplacementCmFromA.toFixed(2)} cm</span>
        <small>The new cutlines passed base-size digital seam and geometry QA. Their shape comes from source interpolation, not a trained neural decoder. Physical fit, additional size grading and manufacturing approval remain unverified.</small>
        <label><input type="checkbox" checked={synthesisReviewed} onChange={event=>{setSynthesisReviewed(event.target.checked);setSynthesisConfirmed(false)}}/> I reviewed the synthesized geometry and sewing relationships.</label>
        {nativeMode&&<label><input type="checkbox" checked={synthesisConfirmed} disabled={!synthesisReviewed} onChange={event=>setSynthesisConfirmed(event.target.checked)}/> Confirm native document replacement and Undo reset. EXO must first save a recoverable File Library backup.</label>}
        <button type="button" disabled={!synthesisReviewed||(nativeMode&&!synthesisConfirmed)||synthesisApplying} onClick={async()=>{setSynthesisApplying(true);try{if(await onApply(synthesis.project)===true){setSynthesis({state:'idle'});setSynthesisReviewed(false);setSynthesisConfirmed(false)}}finally{setSynthesisApplying(false)}}}>{synthesisApplying?'Opening validated draft…':nativeMode?'Confirm and open synthesized native garment':'Apply synthesized garment with Undo'}</button>
      </div>}
    </div>
    <div className="exo-pattern-gen-neighbors" aria-label="Trained neural contour research">
      <strong>Trained neural contour laboratory</strong>
      <p>A real denoising contour autoencoder trained on one exact four-panel garment family. It predicts altered pattern vertices and curves, while EXO independently audits their sewing relationships before offering an editable draft. It cannot generate arbitrary garment types or infer a full pattern from a sketch yet.</p>
      <label htmlFor="exo-neural-source">Original verified source ID (trained topology family)</label>
      <input id="exo-neural-source" type="text" maxLength={256} value={neuralSourceId} onChange={event=>{setNeuralSourceId(event.target.value);setNeural({state:'idle'});setNeuralReviewed(false);setNeuralConfirmed(false)}}/>
      <label htmlFor="exo-neural-seed">Variation seed</label>
      <input id="exo-neural-seed" type="number" min="0" max="1000000" step="1" value={neuralSeed} onChange={event=>{setNeuralSeed(Number(event.target.value));setNeural({state:'idle'})}}/>
      <label htmlFor="exo-neural-strength">Model latent variation: {Math.round(neuralStrength*100)}%</label>
      <input id="exo-neural-strength" type="range" min="0.01" max="0.35" step="0.01" value={neuralStrength} onChange={event=>{setNeuralStrength(Number(event.target.value));setNeural({state:'idle'})}}/>
      <button type="button" disabled={neural.state==='loading'} onClick={generateTrainedContours}>Generate neural contours and validate seams</button>
      {neural.state==='loading'&&<p role="status">Running the trained contour model and independently checking digital construction…</p>}
      {neural.state==='error'&&<p role="alert">Neural generation blocked: {neural.error}</p>}
      {neural.state==='ready'&&<div className="exo-pattern-gen-source-preview">
        <strong>Neural research candidate — digital base-size QA passed</strong>
        <span>{neural.report.panels} editable panels · {neural.report.seams} existing stitch relationships · {neural.report.noveltyMaxDisplacementCm.toFixed(2)} cm maximum cutline change</span>
        <small>Trained source contour decoder; accepted {Math.round(neural.report.acceptedResidualFraction*100)}% of its proposed deformation after EXO seam validation. Research model: {neural.modelEvidence.trainingGarments} training, {neural.modelEvidence.validationGarments} validation and {neural.modelEvidence.heldOutTestGarments} held-out garments; held-out contour error {neural.modelEvidence.heldOutContourRmseCm.toFixed(3)} cm RMSE. This is one narrow topology family, not a universal garment generator.</small>
        {neural.grade?.ok?<><span>Experimental S / M / L size drafts: {neural.grade.sizeReports.map(row=>`${row.size} ${row.qaStatus}`).join(' · ')}</span><small>Size drafts are shared-affine development trials, not approved pattern grading. No physical simulation, approved POMs, fabric calibration or factory sign-off.</small><div className="exo-pattern-gen-actions">{neural.grade.sizes.map(size=><button type="button" key={size} onClick={()=>downloadResearchSizeDxf(size)}>Download research {size} DXF</button>)}</div></>:<p role="note">Multi-size grading blocked: {neural.grade?.reason||'No grading data'}; base-size geometry remains reviewable.</p>}
        <label><input type="checkbox" checked={neuralReviewed} onChange={event=>{setNeuralReviewed(event.target.checked);setNeuralConfirmed(false)}}/> I reviewed the generated contour, sewing connections and research-only limitations.</label>
        {nativeMode&&<label><input type="checkbox" checked={neuralConfirmed} disabled={!neuralReviewed} onChange={event=>setNeuralConfirmed(event.target.checked)}/> Confirm native document replacement and native Undo reset after an automatic File Library backup.</label>}
        <button type="button" disabled={!neuralReviewed||(nativeMode&&!neuralConfirmed)||neuralApplying} onClick={async()=>{setNeuralApplying(true);try{if(await onApply(neural.project)===true){setNeural({state:'idle'});setNeuralReviewed(false);setNeuralConfirmed(false)}}finally{setNeuralApplying(false)}}}>{neuralApplying?'Opening research garment…':nativeMode?'Confirm and open neural research draft':'Apply neural research draft with Undo'}</button>
      </div>}
    </div>
    <div className="exo-pattern-gen-neighbors" aria-label="Learned sewing graph proposals">
      <strong>Learned sewing graph proposals</strong>
      <p>Use EXO's 40,000-garment seam classifier to rank possible unpaired sewing edges. The original verified stitches stay intact; new edges are read-only proposals with uncalibrated scores.</p>
      <label htmlFor="exo-seam-research-id">Source ID for seam predictions</label>
      <input id="exo-seam-research-id" type="text" maxLength={256} value={sewingResearchId} onChange={event=>{setSewingResearchId(event.target.value);setSewingResearch({state:'idle'})}}/>
      <button type="button" disabled={sewingResearch.state==='loading'} onClick={requestLearnedSeamGraph}>Predict sewing partners</button>
      {sewingResearch.state==='loading'&&<p role="status">Scoring unpaired sewing edges using the trained seam classifier…</p>}
      {sewingResearch.state==='error'&&<p role="alert">Seam prediction unavailable: {sewingResearch.error}</p>}
      {sewingResearch.state==='ready'&&<div className="exo-pattern-gen-source-preview">
        <strong>{sewingResearch.proposals.length} ranked edge candidates</strong>
        <span>{sewingResearch.sourceAnchors.length} preserved source stitches · {sewingResearch.proposedDisjointGraph.length} provisional disjoint graph edges · {sewingResearch.model?.trainedGarments?.toLocaleString()||'—'} training garments</span>
        <ol>{sewingResearch.proposals.map((entry,index)=><li key={`${entry.a.panel}-${entry.a.edge}-${entry.b.panel}-${entry.b.edge}-${index}`}>
          <strong>{entry.a.panel} edge {entry.a.edge} → {entry.b.panel} edge {entry.b.edge}</strong>
          <span>Classifier output {(entry.score*100).toFixed(1)}% (not calibrated confidence)</span>
          <small>Chord difference {(entry.relativeChordLengthMismatch*100).toFixed(1)}%{entry.lengthWarning?' · length warning':''}</small>
        </li>)}</ol>
        {!sewingResearch.proposals.length&&<p>No unpaired source edges available for prediction.</p>}
        <small>Predicted seams cannot be automatically sewn or manufactured: arc lengths, assembly orientation, grading, fabric stretch, physical fit, and patternmaker approval still need validation. Original stitches were not changed.</small>
      </div>}
    </div>
    <small>Drafting uses existing garment geometry and deterministic scaling. Archive neighbors remain read-only references; factory approval is required independently.</small>
  </section>
}
