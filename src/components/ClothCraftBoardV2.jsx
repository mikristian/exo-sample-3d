import React, {useEffect, useId, useMemo, useRef, useState} from 'react'
import FlatAvatarSilhouette from './FlatAvatarSilhouette.jsx'

const COLORS = ['#527e91', '#d29465', '#7a9e79', '#a889b2', '#c3ab5d', '#76a5a4']
const SEAM_COLORS = ['#eb775e', '#55aecd', '#dbb44c', '#8dc575', '#a98cd9', '#dd91b9']
const INITIAL_VIEW = [-1.1, -.24, 2.2, 2]
const finite = value => Number.isFinite(value)
const formatCm = metres => `${(metres * 100).toFixed(1)} cm`

function transform(panel, range, uv) {
  const a = (panel.layout_rotation_degrees || 0) * Math.PI / 180
  return [range.layout[0] + uv[0] * Math.cos(a) - uv[1] * Math.sin(a),
    range.layout[1] + uv[0] * Math.sin(a) + uv[1] * Math.cos(a)]
}

function weighted(weights, values) {
  if (!Array.isArray(weights) || !values.length) return null
  const result = [0, 0]
  for (const [index, weight] of weights) {
    if (!values[index] || !finite(weight)) return null
    result[0] += values[index][0] * weight
    result[1] += values[index][1] * weight
  }
  return result
}

function Dimensions({points, selected}) {
  if (points.length < 3) return null
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const width = maxX - minX, height = maxY - minY
  if (!(width > .015 && height > .015)) return null
  const line = '#67767b', offset = .045, arrow = .009
  const y = maxY + offset, x = maxX + offset
  const font = {fontSize: '.019', fill: '#55656a', textAnchor: 'middle', paintOrder: 'stroke', stroke: '#eef0ef', strokeWidth: '.008'}
  return <g pointerEvents="none" opacity={selected ? .95 : .65}>
    <line x1={minX} x2={maxX} y1={y} y2={y} stroke={line} strokeWidth=".002"/>
    <path d={`M${minX + arrow},${y - arrow / 2}L${minX},${y}L${minX + arrow},${y + arrow / 2} M${maxX - arrow},${y - arrow / 2}L${maxX},${y}L${maxX - arrow},${y + arrow / 2}`} stroke={line} fill="none" strokeWidth=".002"/>
    <line x1={minX} x2={minX} y1={maxY + .012} y2={y + .012} stroke={line} strokeWidth=".001"/>
    <line x1={maxX} x2={maxX} y1={maxY + .012} y2={y + .012} stroke={line} strokeWidth=".001"/>
    <text x={(minX + maxX) / 2} y={y - .009} {...font}>{formatCm(width)}</text>
    <line x1={x} x2={x} y1={minY} y2={maxY} stroke={line} strokeWidth=".002"/>
    <path d={`M${x - arrow / 2},${minY + arrow}L${x},${minY}L${x + arrow / 2},${minY + arrow} M${x - arrow / 2},${maxY - arrow}L${x},${maxY}L${x + arrow / 2},${maxY - arrow}`} stroke={line} fill="none" strokeWidth=".002"/>
    <line x1={maxX + .012} x2={x + .012} y1={minY} y2={minY} stroke={line} strokeWidth=".001"/>
    <line x1={maxX + .012} x2={x + .012} y1={maxY} y2={maxY} stroke={line} strokeWidth=".001"/>
    <text x={x + .014} y={(minY + maxY) / 2} fontSize=".019" fill="#55656a" paintOrder="stroke" stroke="#eef0ef" strokeWidth=".008">{formatCm(height)}</text>
    <line x1={(minX + maxX) / 2} x2={(minX + maxX) / 2} y1={minY} y2={maxY} stroke="#657f8d" strokeWidth=".002" strokeDasharray=".015 .012"/>
    {selected && [{f: .30, label: 'Chest guide'}, {f: .48, label: 'Stomach guide'}, {f: .64, label: 'Waist guide'}].map(({f, label}) => <g key={f}>
      <line x1={minX} x2={maxX} y1={minY + height * f} y2={minY + height * f} stroke="#7b8791" strokeWidth=".0018" strokeDasharray=".01 .012"/>
      <text x={minX + .012} y={minY + height * f - .009} fontSize=".016" fill="#637278" paintOrder="stroke" stroke="#eef0ef" strokeWidth=".006">{label}</text>
    </g>)}
  </g>
}

/**
 * Linked metric board. Props are compatible with the original ClothCraftWorkspace Board:
 * s, active, pick, hover, edit, mode, busy, onPolygon.
 * Optional overlays: showMeasurements, showSilhouette, showSeamDots (default true).
 * Dimensions measure each panel's current rotated bounding box in material space.
 * Chest/stomach/waist lines are proportional guides, not body circumference measurements.
 */
export default function ClothCraftBoardV2({
  s, active, pick = () => {}, hover = () => {}, edit = () => {},
  mode = 'edit', busy = false, onPolygon = () => {},
  showMeasurements = true, showSilhouette = true, showSeamDots = true,
}) {
  const svg = useRef(null), drag = useRef(null), [view, setView] = useState(INITIAL_VIEW), [draft, setDraft] = useState([])
  const [viewPreset, setViewPreset] = useState('FRONT')
  const uid = useId().replace(/:/g, '')
  const panels = useMemo(() => {
    if (!s?.panels || !s?.template?.panels || !s?.uv) return []
    return s.panels.map((range, i) => {
      const panel = s.template.panels.find(p => p.id === range.id)
      if (!panel) return null
      const localIndices = Object.values(range.boundaries || {}).flat()
      const unique = [...new Set(localIndices)]
      const points = unique.map(n => s.uv[n] && transform(panel, range, s.uv[n])).filter(Boolean)
      return {panel, range, color: COLORS[i % COLORS.length], points}
    }).filter(Boolean)
  }, [s])
  const boardUV = useMemo(() => {
    if (!s?.uv) return []
    const map = []
    for (const item of panels) {
      const [first, last] = item.range.vertices || []
      for (let i = first; i < last; i++) if (s.uv[i]) map[i] = transform(item.panel, item.range, s.uv[i])
    }
    return map
  }, [s, panels])
  const bounds = useMemo(() => {
    const points = panels.flatMap(p => p.points)
    if (!points.length) return {cx:0, cy:0, minX:-.3, maxX:.3, minY:0, maxY:1}
    const xs = points.map(p => p[0]), ys = points.map(p => p[1])
    const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys)
    return {cx:(minX+maxX)/2, cy:(minY+maxY)/2, minX,maxX,minY,maxY}
  },[panels])
  // FRONT matches our original Garment Studio front-body drafting convention:
  // the *front garment* is centered over the avatar on the dark X=0 axis.
  // A whole-board midpoint incorrectly places the body between front and back.
  // GRID keeps the upstream ClothCraft side-by-side layout centered as a set.
  // Both transforms affect presentation only. UVs, seam links, physical metres,
  // pointer inversions and upstream authored panel origins stay unchanged.
  const front = panels.find(({panel})=>/front/i.test(`${panel.id} ${panel.name}`)) || panels[0]
  const frontBounds = front?.points?.length ? {
    cx:(Math.min(...front.points.map(p=>p[0]))+Math.max(...front.points.map(p=>p[0])))/2,
    cy:(Math.min(...front.points.map(p=>p[1]))+Math.max(...front.points.map(p=>p[1])))/2,
  } : bounds
  const originalAlignment = useRef(null)
  const documentKey = s?.template?.id ?? s?.template?.name ?? null
  if (panels.length && (!originalAlignment.current || originalAlignment.current.key !== documentKey)) {
    originalAlignment.current = {
      key: documentKey,
      front: [-frontBounds.cx, .76-frontBounds.cy],
      grid: [-bounds.cx, .76-bounds.cy],
    }
  }
  // Freeze this offset during edits: otherwise moving the front panel would
  // recompute its origin every frame and visually snap the shirt back to X=0.
  const offset = viewPreset === 'FRONT'
    ? (originalAlignment.current?.front || [0,0])
    : (originalAlignment.current?.grid || [0,0])
  const displayed = {minX:bounds.minX+offset[0],maxX:bounds.maxX+offset[0],minY:bounds.minY+offset[1],maxY:bounds.maxY+offset[1]}
  const spanX = displayed.maxX-displayed.minX, spanY=displayed.maxY-displayed.minY
  // This vector is Garment Studio's full-height 175cm body proportion,
  // not a miniature silhouette that shrinks to the two panels' dimensions.
  const avatarScale = 1.75 / 185
  const avatarAnchorY = .95
  const focus = (selection=false) => {
    let b=displayed
    if(selection && active?.panel){
      const entry=panels.find(p=>p.panel.id===active.panel)
      if(entry?.points.length){
        const xs=entry.points.map(p=>p[0]+offset[0]),ys=entry.points.map(p=>p[1]+offset[1])
        b={minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}
      }
    }
    const pad=.22
    const w=Math.max(.9,b.maxX-b.minX+pad*2),h=Math.max(.9,b.maxY-b.minY+pad*2)
    const width=Math.max(w,h*1.1)
    setView([(b.minX+b.maxX-width)/2,(b.minY+b.maxY-width/1.1)/2,width,width/1.1])
  }
  const initialized = useRef(null)
  useEffect(()=>{
    const key=s?.template?.id ?? s?.template?.name ?? null
    if(key !== initialized.current && panels.length){
      initialized.current=key
      // FRONT keeps x=0 centered on the visible figure; extend both sides
      // enough to retain the complete neighboring back panel, rather than
      // clipping its sleeve at the right edge of a split viewport.
      const largestExtent = Math.max(Math.abs(displayed.minX),Math.abs(displayed.maxX))
      const w=Math.max(2.15,2*(largestExtent+.17),(spanY+.65)*1.1)
      setView([-w/2,avatarAnchorY-w/2.2,w,w/1.1])
    }
  },[s?.template?.id,s?.template?.name,panels.length,spanX,spanY])
  const point = e => {
    const el = svg.current
    const matrix = el?.getScreenCTM()
    if (!matrix) return null
    const p = el.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    const q = p.matrixTransform(matrix.inverse())
    return [q.x-offset[0], q.y-offset[1]]
  }
  const start = (e, panel, anchor) => {
    if (busy || ['sew', 'pen', 'line'].includes(mode) || e.button !== 0) return
    const startPoint = point(e)
    if (!startPoint) return
    e.stopPropagation()
    svg.current.setPointerCapture(e.pointerId)
    drag.current = {panel, anchor, start: startPoint}
    pick({panel: panel.id, ...(anchor !== undefined ? {anchor} : {})})
  }
  const up = e => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const q = point(e)
    if (!q) return
    const delta = q.map((n, i) => n - d.start[i])
    if (Math.hypot(...delta) < .002) return
    if (d.pan) {
      setView(v => [v[0] - delta[0], v[1] - delta[1], v[2], v[3]])
      return
    }
    const range = s.panels.find(p => p.id === d.panel.id)
    if (!range) return
    if (d.anchor !== undefined) {
      const a = -(d.panel.layout_rotation_degrees || 0) * Math.PI / 180
      const local = [delta[0] * Math.cos(a) - delta[1] * Math.sin(a), delta[0] * Math.sin(a) + delta[1] * Math.cos(a)]
      if (typeof d.anchor === 'string') {
        const [, edge, index] = d.anchor.split(':')
        const polygon = structuredClone(d.panel.polygon)
        if (!polygon.curves?.[edge]?.[Number(index)]) return
        polygon.curves[edge][Number(index)] = polygon.curves[edge][Number(index)].map((n, i) => n + local[i])
        edit({kind: 'Shape', panel: d.panel.id, polygon})
      } else {
        const origin = d.panel.polygon?.points?.[d.anchor]
        if (origin) edit({kind: 'Anchor', panel: d.panel.id, anchor: d.anchor, position: origin.map((n, i) => n + local[i])})
      }
    } else {
      edit({kind: 'BoardTransform', panel: d.panel.id, origin: range.layout.map((n, i) => n + delta[i]), rotation_degrees: d.panel.layout_rotation_degrees || 0})
    }
  }
  const zoom = e => {
    e.preventDefault()
    const localCursor = point(e)
    if (!localCursor) return
    const cursor = [localCursor[0]+offset[0],localCursor[1]+offset[1]]
    const factor = e.deltaY > 0 ? 1.1 : .9
    setView(v => {
      const width = Math.max(.08, Math.min(15, v[2] * factor))
      const scale = width / v[2]
      return [cursor[0] - (cursor[0] - v[0]) * scale, cursor[1] - (cursor[1] - v[1]) * scale, width, v[3] * scale]
    })
  }
  const isDrawing = mode === 'pen' || mode === 'line'
  return <div className="cc-board" style={{position: 'relative', background: '#e9ebeb'}}>
    <div role="group" aria-label="2D board view controls" style={{position:'absolute',top:8,left:10,zIndex:3,display:'flex',gap:3,alignItems:'center',border:'1px solid #c2ccce',borderRadius:7,padding:3,background:'rgba(241,244,244,.94)',boxShadow:'0 2px 6px #00000012'}}>
      <span style={{fontSize:10,fontWeight:700,color:'#61757b',padding:'0 7px'}}>2D</span>
      {['FRONT','GRID'].map(preset=><button key={preset} type="button" aria-pressed={viewPreset===preset} onClick={()=>setViewPreset(preset)} style={{fontSize:10,letterSpacing:'.06em',fontWeight:700,border:'none',borderRadius:4,padding:'5px 9px',cursor:'pointer',color:viewPreset===preset?'#fff':'#566970',background:viewPreset===preset?'#50656d':'transparent'}}>{preset}</button>)}
    </div>
    <div className="cc-canvas-tools" style={{top:44}}>
      <button type="button" onClick={() => focus()}>Frame all</button>
      <button type="button" onClick={() => focus(true)}>Focus selected</button>
      <button type="button" onClick={() => setView(v=>[-v[2]/2,avatarAnchorY-v[3]/2,v[2],v[3]])}>Center axis</button>
      {isDrawing && <>
        <button type="button" disabled={busy || draft.length < (mode === 'line' ? 2 : 3)} onClick={() => {onPolygon(draft); setDraft([])}}>{mode === 'line' ? 'Create internal line' : 'Close pattern'} ({draft.length})</button>
        <button type="button" onClick={() => setDraft([])}>Cancel</button>
      </>}
    </div>
    <svg ref={svg} viewBox={view.join(' ')} preserveAspectRatio="xMidYMid meet"
      aria-label="Metric 2D pattern board with linked sewing and measurements"
      onPointerUp={up} onPointerCancel={() => {drag.current = null}}
      onContextMenu={e => e.preventDefault()}
      onPointerDown={e => {
        if (isDrawing && !busy && e.button === 0) {
          const p = point(e)
          if (p) setDraft(v => [...v, p])
          return
        }
        if (e.button !== 0) return
        const p = point(e)
        if (!p) return
        drag.current = {pan: true, start: p}
        svg.current.setPointerCapture(e.pointerId)
      }}
      onWheel={zoom}>
      <defs>
        <pattern id={`${uid}-minor`} width=".05" height=".05" patternUnits="userSpaceOnUse">
          <path d="M .05 0 L 0 0 0 .05" fill="none" stroke="#d3d8d9" strokeWidth=".001"/>
        </pattern>
        <pattern id={`${uid}-major`} width=".25" height=".25" patternUnits="userSpaceOnUse">
          <path d="M .25 0 L 0 0 0 .25" fill="none" stroke="#bcc5c7" strokeWidth=".0014"/>
        </pattern>
      </defs>
      <rect x={view[0]-view[2]} y={view[1]-view[3]} width={view[2]*3} height={view[3]*3} fill="#e8e9e9" pointerEvents="none"/>
      <rect x={view[0]-view[2]} y={view[1]-view[3]} width={view[2]*3} height={view[3]*3} fill={`url(#${uid}-minor)`} opacity={viewPreset==='GRID'?1:.6} pointerEvents="none"/>
      <rect x={view[0]-view[2]} y={view[1]-view[3]} width={view[2]*3} height={view[3]*3} fill={`url(#${uid}-major)`} opacity={viewPreset==='GRID'?1:.65} pointerEvents="none"/>
      <line x1={view[0]-view[2]} x2={view[0]+view[2]*2} y1=".76" y2=".76" stroke="#9aaeb3" strokeWidth=".002" pointerEvents="none"/>
      <line x1="0" x2="0" y1={view[1]-view[3]} y2={view[1]+view[3]*2} stroke="#424b4f" strokeWidth=".006" pointerEvents="none"/>
      <g pointerEvents="none" fontSize=".022" fill="#6c8188">
        <text x=".02" y=".745">X</text><text x=".015" y=".805">Y</text>
      </g>
      {showSilhouette && viewPreset==='FRONT' && <g pointerEvents="none" opacity=".24" fill="#747d84" stroke="#858e94" strokeWidth=".15" transform={`translate(0 ${avatarAnchorY}) scale(${avatarScale})`} aria-label="Centered front avatar silhouette">
        {/* Direct reuse of our original Garment Studio's orthographic body profile.
            It is a visual drafting reference, not a certified anthropometric scan. */}
        <FlatAvatarSilhouette avatar={{heightCm:175,shoulderWidthCm:46,chestCm:96,waistCm:78,hipCm:94,armAngleDeg:6}}/>
      </g>}
      <g transform={`translate(${offset[0]} ${offset[1]})`}>
      {panels.map(({panel, range, color, points}) => {
        const selected = active?.panel === panel.id
        return <g key={panel.id} onPointerEnter={() => hover({panel: panel.id})} onPointerLeave={() => hover(null)}>
          <path data-panel={panel.id} d={(s.triangles || []).slice(...range.triangles).map(tri => 'M' + tri.map(index => boardUV[index]?.join(',')).filter(Boolean).join('L') + 'Z').join('')}
            fill={selected ? '#f4deb7' : color} fillOpacity=".75"
            onPointerDown={e => start(e, panel)}
            onClick={e => {e.stopPropagation(); pick({panel: panel.id})}}/>
          {Object.entries(range.boundaries || {}).map(([edge, indices]) => <polyline key={edge} data-edge={`${panel.id}:${edge}`}
            points={indices.map(i => boardUV[i]?.join(',')).filter(Boolean).join(' ')}
            fill="none" stroke={selected && active.edge === edge ? '#ef6339' : '#374e57'}
            strokeWidth={selected && active.edge === edge ? '.009' : '.003'}
            style={{cursor: 'crosshair'}}
            onPointerDown={e => e.stopPropagation()}
            onPointerEnter={e => {e.stopPropagation(); hover({panel: panel.id, edge})}}
            onClick={e => {e.stopPropagation(); pick({panel: panel.id, edge})}}/>)}
          <text x={range.layout[0]} y={range.layout[1] - .035} fontSize=".027" fill="#34454a" pointerEvents="none">{panel.name}</text>
          {showMeasurements && <Dimensions points={points} selected={selected}/>}
          {selected && mode === 'edit' && panel.polygon?.points?.map((uv, n) => {
            const p = transform(panel, range, uv)
            return <circle key={n} cx={p[0]} cy={p[1]} r=".009" fill="white" stroke="#f2693d" strokeWidth=".003" onPointerDown={e => start(e, panel, n)}/>
          })}
          {selected && mode === 'edit' && Object.entries(panel.polygon?.curves || {}).flatMap(([edge, controls]) => controls.map((uv, index) => {
            const p = transform(panel, range, uv)
            const edgeIndex = panel.polygon.edges.indexOf(edge)
            const original = panel.polygon.points[(edgeIndex + index) % panel.polygon.points.length]
            if (!original) return null
            const anchor = transform(panel, range, original)
            return <g key={`${edge}-${index}`}>
              <line x1={anchor[0]} y1={anchor[1]} x2={p[0]} y2={p[1]} stroke="#527e91" strokeWidth=".002"/>
              <circle cx={p[0]} cy={p[1]} r=".008" fill="#527e91" stroke="white" strokeWidth=".002" onPointerDown={e => start(e, panel, `c:${edge}:${index}`)}/>
            </g>
          }))}
        </g>
      })}
      {(s?.seams || []).flatMap((seam, i) => {
        const spec = s.template?.seams?.find(item => item.id === seam.id)
        if (!spec) return []
        // A selected *piece* should not flood the board with hundreds of
        // cross-panel correspondence lines. Spotlight full seam structure
        // only when an actual colored boundary is hovered/selected.
        const emphasized = !!active?.edge && [spec.a, spec.b].some(b => b?.panel === active.panel && b.edge === active.edge)
        const color = SEAM_COLORS[i % SEAM_COLORS.length]
        return (seam.guides || []).filter((_, j) => j % (emphasized ? 3 : 16) === 0).flatMap((pair, j) => {
          const a = weighted(pair[0], boardUV), b = weighted(pair[1], boardUV)
          if (!a || !b) return []
          return <g key={`${seam.id}-${j}`} pointerEvents="none">
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={emphasized ? '#ef6339' : color}
              strokeWidth={emphasized ? '.003' : '.00125'} strokeDasharray=".01 .012" opacity={emphasized ? 1 : .42}/>
            {showSeamDots && <>
              <circle cx={a[0]} cy={a[1]} r={emphasized ? '.008' : '.005'} fill={color} stroke="#f4f4f4" strokeWidth=".0015"/>
              <circle cx={b[0]} cy={b[1]} r={emphasized ? '.008' : '.005'} fill={color} stroke="#f4f4f4" strokeWidth=".0015"/>
            </>}
          </g>
        })
      })}
      {draft.length > 0 && <polyline points={draft.map(p => p.join(',')).join(' ')} fill="none" stroke="#ef6339" strokeWidth=".005" pointerEvents="none"/>}
      </g>
    </svg>
    <span className="cc-hint">50 mm grid · 25 cm major grid · measured panel bounds · drag to reshape / arrange · wheel to zoom</span>
  </div>
}
