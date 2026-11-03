import React, {useMemo, useState} from 'react'
import {describePatternGeometry,recommendSimilarPatternPanels,recommendSeamPartners} from '../core/exoPatternIntelligence20261102.js'
import './ExoPatternIntelligence20261102.css'

const finite = value => Number.isFinite(Number(value))
const distance = (a, b) => Math.hypot(Number(b?.x) - Number(a?.x), Number(b?.y) - Number(a?.y))
const nameOf = piece => String(piece?.name || piece?.id || 'Unnamed panel')

function describePiece(piece) {
  const points = Array.isArray(piece?.points) ? piece.points.filter(point => finite(point?.x) && finite(point?.y)) : []
  if (points.length < 3) return null
  const edges = points.map((point, index) => ({index, length: distance(point, points[(index + 1) % points.length])}))
  const xs = points.map(point => Number(point.x))
  const ys = points.map(point => Number(point.y))
  const width = Math.max(...xs) - Math.min(...xs)
  const height = Math.max(...ys) - Math.min(...ys)
  const perimeter = edges.reduce((total, edge) => total + edge.length, 0)
  return {id:piece.id, name:nameOf(piece), points, edges, width, height, perimeter, aspect:width / Math.max(height,0.001)}
}

function MiniOutline({points}) {
  const xs = points.map(p => Number(p.x)), ys = points.map(p => Number(p.y))
  const minX = Math.min(...xs), minY = Math.min(...ys), width = Math.max(1,Math.max(...xs)-minX), height = Math.max(1,Math.max(...ys)-minY)
  const fitted = points.map(p => `${10+(Number(p.x)-minX)*80/width},${10+(Number(p.y)-minY)*80/height}`).join(' ')
  return <svg className="exo-pi2-outline" viewBox="0 0 100 100" role="img" aria-label="Scaled outline preview"><polygon points={fitted} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/></svg>
}

export default function ExoPatternIntelligence20261102({pieces = [], selectedPiece = null, onSelectPiece}) {
  const [tab, setTab] = useState('shapes')
  const [previewId, setPreviewId] = useState(null)
  const current = useMemo(() => describePiece(selectedPiece),[selectedPiece])
  const peers = useMemo(() => (Array.isArray(pieces) ? pieces : []).map(describePiece).filter(Boolean).filter(piece=>describePatternGeometry(piece,{units:'cm'}).ok),[pieces])
  const matches = useMemo(() => {
    if (!current) return []
    const candidates=peers.filter(piece=>piece.id!==current.id)
    const result=recommendSimilarPatternPanels(current,candidates,{units:'cm',candidateUnits:'cm',limit:6})
    return (result.suggestions||[]).map(item=>({...candidates.find(piece=>piece.id===item.candidate.id),score:item.score})).filter(item=>item.points)
  },[current,peers])
  const edgeMatches = useMemo(() => {
    if (!current) return []
    const candidateEdges=peers.filter(piece=>piece.id!==current.id).flatMap(piece=>piece.edges.map(edge=>({id:String(edge.index),panelId:piece.id,lengthMm:edge.length*10})))
    return current.edges.flatMap(edge => {
      const result=recommendSeamPartners({id:String(edge.index),panelId:current.id,lengthMm:edge.length*10},candidateEdges,{toleranceMm:50,limit:5})
      return (result.suggestions||[]).map(suggestion=>({sourceEdge:edge.index,candidateEdge:Number(suggestion.edgeId),piece:peers.find(piece=>piece.id===suggestion.panelId),gap:suggestion.lengthDifferenceMm/10,sourceLength:edge.length,candidateLength:suggestion.edgeLengthMm/10}))
    }).filter(item=>item.piece).sort((a,b)=>a.gap-b.gap).slice(0,8)
  },[current,peers])
  const preview = matches.find(item => item.id === previewId) || edgeMatches.find(item => item.piece.id === previewId)?.piece || null

  return <section className="exo-pi2" aria-label="Pattern Intelligence 2.0 recommendations">
    <header className="exo-pi2-header"><div><span className="exo-pi2-eyebrow">EXO / PATTERN ANALYSIS</span><h3>Pattern Intelligence 2.0</h3><p>Explore comparable geometry and compatible edge lengths in this garment.</p></div><span className="exo-pi2-status">Research preview</span></header>
    <div className="exo-pi2-context"><span>Selected pattern</span><strong>{current?.name || 'No valid pattern selected'}</strong><small>{current ? `${current.points.length} vertices · ${current.edges.length} edges` : 'Choose a piece with at least three valid outline points in the 2D editor.'}</small></div>
    <div className="exo-pi2-tabs" role="tablist" aria-label="Recommendation type"><button type="button" role="tab" aria-selected={tab==='shapes'} onClick={()=>setTab('shapes')}>Similar pieces</button><button type="button" role="tab" aria-selected={tab==='edges'} onClick={()=>setTab('edges')}>Seam edge candidates</button></div>
    {!current ? <p className="exo-pi2-empty">Select a valid pattern piece to inspect its geometric neighbors.</p> : <>
      {tab==='shapes' && <div className="exo-pi2-results">{matches.length ? matches.map(match => <button type="button" key={match.id} className="exo-pi2-result" onFocus={()=>setPreviewId(match.id)} onMouseEnter={()=>setPreviewId(match.id)} onClick={()=>{setPreviewId(match.id);onSelectPiece?.(match.id)}} aria-label={`Select ${match.name}; geometric similarity ${Math.round(match.score*100)} percent`}><MiniOutline points={match.points}/><span><strong>{match.name}</strong><small>{match.edges.length} edges · {Math.round(match.score*100)}% shape similarity</small></span><span aria-hidden="true">↗</span></button>) : <p className="exo-pi2-empty">No other valid pieces in this garment yet.</p>}</div>}
      {tab==='edges' && <div className="exo-pi2-results">{edgeMatches.length ? edgeMatches.map((match,index)=><button type="button" className="exo-pi2-result" key={`${match.sourceEdge}-${match.piece.id}-${match.candidateEdge}-${index}`} onFocus={()=>setPreviewId(match.piece.id)} onMouseEnter={()=>setPreviewId(match.piece.id)} onClick={()=>{setPreviewId(match.piece.id);onSelectPiece?.(match.piece.id)}}><span className="exo-pi2-edge-symbol">{match.sourceEdge+1} ↔ {match.candidateEdge+1}</span><span><strong>{match.piece.name}</strong><small>Edge {match.sourceEdge+1} → edge {match.candidateEdge+1} · length difference {match.gap.toFixed(2)} cm</small></span><span aria-hidden="true">↗</span></button>) : <p className="exo-pi2-empty">No comparable edges found.</p>}</div>}
      {preview && <div className="exo-pi2-preview"><MiniOutline points={preview.points}/><div><strong>{preview.name}</strong><p>Scaled preview · {preview.edges.length} outline edges</p><small>Geometric comparison only; evaluate notch placement, grain, ease and stitch direction before sewing.</small></div></div>}
    </>}
    <footer className="exo-pi2-footer"><strong>Validation: advisory geometry analysis</strong><span>Suggestions use current outline measurements and edge-length comparisons. Scores are heuristic and are not model confidence, seam verification, or proof of training coverage. No pattern changes occur automatically. Research data and source rights require review before factory use.</span></footer>
  </section>
}
