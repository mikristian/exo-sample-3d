import React,{useEffect,useState} from 'react'
import {nativeBridgeFetch,nativeBridgeOrigin} from '../core/nativeWorkspaceTransport.js'
import './ExoArchiveSearch20261102.css'

export default function ExoArchiveSearch20261102(){
  const [query,setQuery]=useState('')
  const [body,setBody]=useState('')
  const [minPanels,setMinPanels]=useState('')
  const [maxPanels,setMaxPanels]=useState('')
  const [limit,setLimit]=useState('12')
  const [filters,setFilters]=useState({query:'',body:'',minPanels:'',maxPanels:'',limit:'12'})
  const [snapshot,setSnapshot]=useState({state:'loading',results:[]})
  useEffect(()=>{
    const controller=new AbortController()
    const origin=nativeBridgeOrigin()
    if(!origin){setSnapshot({state:'error',error:'Local native bridge is unavailable.',results:[]});return}
    const params=new URLSearchParams()
    for(const [key,value] of Object.entries(filters))if(String(value).trim())params.set(key,String(value).trim())
    setSnapshot(previous=>({...previous,state:'loading'}))
    nativeBridgeFetch(`${origin}/pattern-intelligence/v1/archive-search?${params.toString()}`,{cache:'no-store',signal:controller.signal})
      .then(async response=>{
        const payload=await response.json()
        if(!response.ok||!payload?.ok||!Array.isArray(payload.results))throw new Error(payload?.error||'Archive search unavailable')
        if(!controller.signal.aborted)setSnapshot({state:'ready',...payload})
      }).catch(error=>{if(!controller.signal.aborted)setSnapshot({state:'error',error:error.message,results:[]})})
    return()=>controller.abort()
  },[filters])
  const submit=event=>{
    event.preventDefault()
    const min=minPanels===''?null:Number(minPanels),max=maxPanels===''?null:Number(maxPanels)
    if((min!==null&&(!Number.isInteger(min)||min<0||min>1000))||(max!==null&&(!Number.isInteger(max)||max<0||max>1000))||(min!==null&&max!==null&&min>max)){
      setSnapshot({state:'error',error:'Panel counts must be between 0 and 1000, with minimum ≤ maximum.',results:[]});return
    }
    setFilters({query:query.slice(0,120),body:body.slice(0,40),minPanels,maxPanels,limit})
  }
  return <section className="exo-archive" aria-label="Source archive pattern search">
    <div className="exo-archive-heading"><div><small>EXO / SOURCE ARCHIVE</small><h3>Archive pattern search</h3><p>Search recorded source identifiers and inspect local DXF availability and provenance.</p></div><span>READ ONLY</span></div>
    <form className="exo-archive-filters" onSubmit={submit}>
      <label>Source ID / tag<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Body or element ID" maxLength={120}/></label>
      <label>Body<input value={body} onChange={event=>setBody(event.target.value)} placeholder="Exact body" maxLength={40}/></label>
      <label>Min panels<input type="number" value={minPanels} onChange={event=>setMinPanels(event.target.value)} min="0" max="1000" placeholder="Any"/></label>
      <label>Max panels<input type="number" value={maxPanels} onChange={event=>setMaxPanels(event.target.value)} min="0" max="1000" placeholder="Any"/></label>
      <label>Results<select value={limit} onChange={event=>setLimit(event.target.value)}><option value="12">12</option><option value="25">25</option><option value="50">50</option></select></label>
      <button type="submit">Search archive</button>
    </form>
    {snapshot.state==='loading'&&<p role="status" className="exo-archive-message">Searching local source index…</p>}
    {snapshot.state==='error'&&<p role="status" className="exo-archive-message">Archive search unavailable: {snapshot.error}</p>}
    {snapshot.state==='ready'&&<>
      <p className="exo-archive-message">{snapshot.matched} matching source records · showing {snapshot.results.length} · {snapshot.coverage?.indexed??'—'} indexed overall</p>
      <div className="exo-archive-list">{snapshot.results.map((record,index)=><article key={record.sourceId||index} className="exo-archive-result">
        <div className="exo-archive-result-head"><strong>{record.sourceId||[record.body,record.batch,record.element].filter(Boolean).join(' / ')}</strong><span>{Number.isFinite(Number(record.panel_count))?record.panel_count:'Unknown'} panels</span></div>
        <dl><div><dt>Source SHA-256</dt><dd className="exo-archive-sha">{record.sha256||'Unavailable'}</dd></div><div><dt>DXF on local disk</dt><dd>{record.dxfLocallyAvailable?'Available':'Not available'}</dd></div><div><dt>License</dt><dd>{record.license||'Not recorded'}</dd></div><div><dt>Manufacturing</dt><dd>Not approved</dd></div></dl>
      </article>)}</div>
      {!snapshot.results.length&&<p className="exo-archive-message">No source records match these filters.</p>}
    </>}
    <p className="exo-archive-footnote">Source metadata only. Results are reference material, not verified production patterns. DXF files are never downloaded or imported by this search.</p>
  </section>
}
