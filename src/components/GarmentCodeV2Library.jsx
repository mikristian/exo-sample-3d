import React, {useEffect, useState} from 'react'
import {nativeBridgeFetch} from '../core/nativeWorkspaceTransport.js'
import './GarmentCodeV2Library.css'

function bridgeUrl() {
  const port = window.location.port
  return port === '5486' ? 'http://127.0.0.1:5485' : port === '5386' ? 'http://127.0.0.1:5385'
    : (import.meta.env.VITE_CLOTHCRAFT_BRIDGE_URL || 'http://127.0.0.1:5193')
}

/** Sources are unmodified sewing JSON; generic DXF is separately labeled. */
export default function GarmentCodeV2Library({search = ''}) {
  const [body, setBody] = useState('all')
  const [page, setPage] = useState(1)
  const [state, setState] = useState({status:'loading', files:[], total:0, ingestion:null})
  useEffect(() => { setPage(1) }, [search, body])
  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({page:String(page), limit:'20', search:search.trim().slice(0,100)})
    if (body !== 'all') params.set('body', body)
    setState(previous => ({...previous, status:'loading'}))
    nativeBridgeFetch(`${bridgeUrl()}/pattern-intelligence/v1/garmentcodedata-v2?${params}`, {
      signal:controller.signal, cache:'no-store'
    }).then(async response => {
      const data = await response.json()
      if (!response.ok || !data.ok || !Array.isArray(data.files)) {
        throw new Error(data.error || 'Source library is not available')
      }
      if (!controller.signal.aborted) setState({status:'ready', files:data.files, total:data.total, ingestion:data.ingestion})
    }).catch(error => {
      if (!controller.signal.aborted) setState({status:'error', files:[], total:0, error:error.message})
    })
    return () => controller.abort()
  }, [page, body, search])
  const pageCount = Math.ceil(state.total / 20)
  return <section className="exo-gcdv2" aria-label="GarmentCodeData v2 source-pattern library">
    <header className="exo-gcdv2-head"><strong>ETH GARMENTCODEDATA V2</strong><span>CC BY 4.0 · RESEARCH PATTERNS</span></header>
    <p>Source-verified 2D sewing specifications, retained with their original geometry and conversion records. These patterns are not factory certified.</p>
    <label className="exo-gcdv2-filter">Body variation
      <select value={body} onChange={event => setBody(event.target.value)}>
        <option value="all">All body variants</option>
        <option value="default">Reference-body patterns</option>
        <option value="random">Adapted-body patterns</option>
      </select>
    </label>
    {state.status === 'loading' && <p role="status">Reading the local source catalog…</p>}
    {state.status === 'error' && <p role="status">No bulk pattern collection available yet. {state.error}</p>}
    {state.status === 'ready' && <>
      <p role="status">{state.total.toLocaleString()} saved specification{state.total === 1 ? '' : 's'} match this search.</p>
      {state.ingestion && <p>Archive ingestion: <strong>{state.ingestion.cloudArchivedSpecifications.toLocaleString()} backed up</strong> to ExpansionCloud · {state.ingestion.cloudArchivedBatches} of {state.ingestion.availableBatches} batches safely archived.</p>}
      <div className="exo-gcdv2-items">
        {state.files.map(file => <details key={file.id}>
          <summary><strong>{file.name}</strong><small>{file.panelCount} panels · {file.body} · {file.cloudArchived ? 'ExpansionCloud backed up' : 'Local source'} · {file.converted ? 'Research DXF available' : 'Original JSON'}</small></summary>
          <p><b>Original JSON</b> <code>{file.sourcePath}</code></p>
          {file.converted && <p><b>Research DXF</b> <code>{file.dxfPath}</code></p>}
          {file.cloudArchived && <p><b>ExpansionCloud archive</b> <code>{file.cloudArchivePath}</code></p>}
          <p><b>SHA-256</b> <code>{file.sourceSha256}</code></p>
          <p><b>Attribution</b> {file.attribution}</p>
          <p><b>Manufacturing approval</b> Not certified</p>
        </details>)}
      </div>
      {state.total > 20 && <div className="exo-gcdv2-pages">
        <button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button>
        <span>Page {page} of {pageCount}</span>
        <button type="button" disabled={page >= pageCount} onClick={() => setPage(value => value + 1)}>Next</button>
      </div>}
    </>}
    <a href="https://doi.org/10.3929/ethz-b-000690432" target="_blank" rel="noopener noreferrer">Original ETH dataset and attribution</a>
  </section>
}
