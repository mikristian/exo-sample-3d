import React, { useEffect, useMemo, useRef, useState } from 'react'
import { closestEdgeFraction, edgeLength, edgePointAt, getEdgeSeamAllowance, sampleEdge, samplePieceBoundary, seamAllowanceBoundary } from '../core/project.js'
import { offsetEdgePath, topstitchPaths, zipperPaths } from '../core/trims.js'
import ViewportQuickTools from './ViewportQuickTools.jsx'
import FlatAvatarSilhouette from './FlatAvatarSilhouette.jsx'

const VIEWBOX = { width: 330, height: 170 }

function edgeToken(pieceId, edgeIndex) {
  return `${pieceId}:${edgeIndex}`
}

function svgPoint(point, layout) {
  return {
    x: layout.x + point.x,
    y: layout.y - point.y,
  }
}

function polygonPath(piece) {
  if (!piece.points.length) return ''
  const first = svgPoint(piece.points[0], piece.layout2d)
  const commands = [`M ${first.x} ${first.y}`]
  for (let edgeIndex = 0; edgeIndex < piece.points.length; edgeIndex += 1) {
    const next = piece.points[(edgeIndex + 1) % piece.points.length]
    const end = svgPoint(next, piece.layout2d)
    const curve = piece.curves?.[edgeIndex]
    if (curve) {
      const control = svgPoint({ x: curve.cx, y: curve.cy }, piece.layout2d)
      commands.push(`Q ${control.x} ${control.y} ${end.x} ${end.y}`)
    } else {
      commands.push(`L ${end.x} ${end.y}`)
    }
  }
  return `${commands.join(' ')} Z`
}

function pointsPath(points, layout) {
  if (!points.length) return ''
  const coords = points.map((point) => svgPoint(point, layout))
  return `${coords.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')} Z`
}

// Read POM directly from the actual stitched curve, not from the control
// polygon. This also follows subsequent point/curve edits in real time.
function horizontalSpanAt(piece, y) {
  const outline = samplePieceBoundary(piece, 24).points
  const xs = []
  for (let index=0; index<outline.length; index++) {
    const a=outline[index], b=outline[(index+1)%outline.length]
    if (!a || !b) continue
    if (Math.abs(a.y-b.y)<1e-6) {
      if (Math.abs(y-a.y)<.01) xs.push(a.x,b.x)
      continue
    }
    if (y>=Math.min(a.y,b.y) && y<=Math.max(a.y,b.y)) xs.push(a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y))
  }
  return xs.length>=2 ? { left:Math.min(...xs), right:Math.max(...xs), width:Math.max(...xs)-Math.min(...xs) } : null
}

export default function PatternEditor({
  project,
  showGrid = true,
  showSeamLinks = true,
  layout2DSignal = 0,
  onToggleGrid,
  onToggleSeams,
  onAutoArrange,
  gradeNestProjects = [],
  highlightSeamId = null,
  selectedPieceId,
  tool,
  onChangeTool,
  onSelectPiece,
  onMovePiece,
  onMovePoint,
  onMoveCurve,
  onSplitEdge,
  onDeletePoint,
  onCreatePin,
  onRemovePin,
  onCreateInternalLine,
  onCreateNotch,
  onCreateSeam,
  onCreateFastener,
  onCreateMeasurement,
  onBeginGesture,
  onEndGesture,
}) {
  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const [pendingEdge, setPendingEdge] = useState(null)
  const [pendingFastener, setPendingFastener] = useState(null)
  const [pendingMeasurement, setPendingMeasurement] = useState(null)
  const [hoverEdge, setHoverEdge] = useState(null)
  const [internalPreview, setInternalPreview] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [view, setView] = useState({ x: 0, y: 0, width: VIEWBOX.width, height: VIEWBOX.height })
  const panRef = useRef(null)
  const resetView = () => setView({ x: 0, y: 0, width: VIEWBOX.width, height: VIEWBOX.height })
  const focusPieces = (pieces, padding = 14) => {
    const locations = pieces.flatMap((piece) => samplePieceBoundary(piece, 14).points
      .map((point) => svgPoint(point, piece.layout2d)))
    if (!locations.length) return resetView()
    const xs = locations.map((point) => point.x)
    const ys = locations.map((point) => point.y)
    const minimumX = Math.min(...xs) - padding
    const maximumX = Math.max(...xs) + padding
    const minimumY = Math.min(...ys) - padding
    const maximumY = Math.max(...ys) + padding
    const rect = svgRef.current?.getBoundingClientRect()
    const canvasWidth = Math.max(200, rect?.width || 500)
    const canvasHeight = Math.max(200, rect?.height || 700)
    // Floating navigation was removed: the drafting surface is now fully
    // available for patterns and focus-to-fit may use its entire footprint.
    const reserved = { left: 14, right: 14, top: 23, bottom: 23 }
    const scale = Math.max(0.05, Math.min(
      (canvasWidth - reserved.left - reserved.right) / Math.max(1, maximumX - minimumX),
      (canvasHeight - reserved.top - reserved.bottom) / Math.max(1, maximumY - minimumY),
    ))
    const width = canvasWidth / scale
    const height = canvasHeight / scale
    setView({
      x: (minimumX + maximumX) * 0.5 + (reserved.right - reserved.left) / (2 * scale) - width * 0.5,
      y: (minimumY + maximumY) * 0.5 + (reserved.bottom - reserved.top) / (2 * scale) - height * 0.5,
      width,
      height,
    })
  }
  const focusSelected = () => {
    const piece = project.pieces.find((item) => item.id === selectedPieceId)
    if (piece) focusPieces([piece], 12)
    else focusPieces(project.pieces)
  }
  // Opening a new garment frames its pieces instead of preserving the old
  // zoom and leaving the 2D editor looking empty or illegibly small.
  useEffect(() => {
    const id = requestAnimationFrame(() => focusPieces(project.pieces, 14))
    return () => cancelAnimationFrame(id)
  }, [project.templateId])
  useEffect(() => {
    if (!layout2DSignal) return undefined
    const id = requestAnimationFrame(() => focusPieces(project.pieces, 14))
    return () => cancelAnimationFrame(id)
  }, [layout2DSignal])
  const zoomAt = (factor, x = 0.5, y = 0.5) => setView((old) => {
    // Large detail zoom is essential for inspecting 1 mm seam, notch and
    // control-point geometry, not just whole-garment compositions.
    const width = Math.max(1.5, Math.min(2000, old.width * factor))
    const height = width * VIEWBOX.height / VIEWBOX.width
    return { x: old.x + old.width * x - width * x, y: old.y + old.height * y - height * y, width, height }
  })
  const onCanvasWheel = (event) => {
    event.preventDefault()
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds) return
    zoomAt(event.deltaY > 0 ? 1.12 : 1 / 1.12, (event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height)
  }
  const onCanvasKeyDown = (event) => {
    if (event.key === 'Escape') { setContextMenu(null); return }
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const key = event.key.toLowerCase()
    // CLO-style 2D arrow nudging changes the *layout* in centimeters; it
    // never edits the actual pattern outline or its sewing edge lengths.
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
      const piece = project.pieces.find((item) => item.id === selectedPieceId)
      if (!piece || piece.locked) return
      const stepCm = event.shiftKey ? 10 : 1
      onMovePiece(piece.id, {
        x: Number(piece.layout2d?.x || 0) + (key === 'arrowright' ? stepCm : key === 'arrowleft' ? -stepCm : 0),
        y: Number(piece.layout2d?.y || 0) + (key === 'arrowdown' ? stepCm : key === 'arrowup' ? -stepCm : 0),
      })
      event.preventDefault()
      return
    }
    if (key === 'f') { event.preventDefault(); event.shiftKey ? focusSelected() : focusPieces(project.pieces, 14) }
    if (key === '+' || key === '=') { event.preventDefault(); zoomAt(0.8) }
    if (key === '-') { event.preventDefault(); zoomAt(1.25) }
    if (key === 'a' && event.shiftKey) { event.preventDefault(); onAutoArrange?.() }
  }

  useEffect(() => {
    if (!contextMenu) return undefined
    const close = (event) => {
      if (event?.target?.closest?.('.clo-pattern-context-menu')) return
      setContextMenu(null)
    }
    const escape = (event) => { if (event.key === 'Escape') close() }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [contextMenu])

  const openPatternContextMenu = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const element = event.target.closest?.('.pattern-piece')
    const pieceId = element?.getAttribute('data-piece-id') || selectedPieceId
    if (pieceId && pieceId !== selectedPieceId) onSelectPiece(pieceId)
    // The menu is positioned relative to .pattern-editor-shell, not to the
    // SVG. Include the 39 px workspace header when computing its position.
    const bounds = svgRef.current?.parentElement?.getBoundingClientRect()
    if (!bounds) return
    const x = Math.max(4, Math.min(bounds.width - 210, event.clientX - bounds.left))
    const y = Math.max(38, Math.min(bounds.height - 335, event.clientY - bounds.top))
    setContextMenu({x,y,pieceId})
  }
  const createCenterLine = () => {
    const piece = project.pieces.find(item => item.id === contextMenu?.pieceId)
    if (!piece || piece.locked) return
    const xs = piece.points.map(p => p.x), ys = piece.points.map(p => p.y)
    const x = (Math.min(...xs) + Math.max(...xs)) / 2
    onCreateInternalLine?.(piece.id, { a:{x,y:Math.min(...ys)+2}, b:{x,y:Math.max(...ys)-2} })
    setContextMenu(null)
  }

  const seamEdges = useMemo(() => {
    const set = new Set()
    for (const seam of project.seams || []) {
      for (const endpoint of [seam.a, seam.b]) {
        const start = Number(endpoint?.startT ?? 0)
        const end = Number(endpoint?.endT ?? 1)
        if (start <= 0.0001 && end >= 0.9999) set.add(edgeToken(endpoint.pieceId, endpoint.edgeIndex))
      }
    }
    return set
  }, [project.seams])
  const partialSeamRanges = useMemo(() => {
    const map = new Map()
    for (const seam of project.seams || []) {
      for (const endpoint of [seam.a, seam.b]) {
        let start = Math.max(0, Math.min(1, Number(endpoint?.startT ?? 0)))
        let end = Math.max(0, Math.min(1, Number(endpoint?.endT ?? 1)))
        if (start > end) [start, end] = [end, start]
        if (start <= 0.0001 && end >= 0.9999) continue
        const token = edgeToken(endpoint.pieceId, endpoint.edgeIndex)
        if (!map.has(token)) map.set(token, [])
        map.get(token).push({ seamId: seam.id, start, end, walking: seam.id === highlightSeamId })
      }
    }
    return map
  }, [project.seams, highlightSeamId])
  const walkEdges = useMemo(() => {
    const set = new Set()
    const seam = (project.seams || []).find((item) => item.id === highlightSeamId)
    for (const endpoint of [seam?.a, seam?.b]) {
      if (!endpoint) continue
      const start = Number(endpoint.startT ?? 0)
      const end = Number(endpoint.endT ?? 1)
      if (start <= 0.0001 && end >= 0.9999) set.add(edgeToken(endpoint.pieceId, endpoint.edgeIndex))
    }
    return set
  }, [project.seams, highlightSeamId])

  const clientToSvg = (event) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const matrix = svg.getScreenCTM()?.inverse()
    if (!matrix) return { x: 0, y: 0 }
    const transformed = point.matrixTransform(matrix)
    return { x: transformed.x, y: transformed.y }
  }

  const beginPieceDrag = (event, piece) => {
    if (event.button !== 0 || tool !== 'select' || piece.locked) return
    event.preventDefault()
    event.stopPropagation()
    onSelectPiece(piece.id)
    onBeginGesture?.()
    const start = clientToSvg(event)
    dragRef.current = {
      kind: 'piece',
      pointerId: event.pointerId,
      pieceId: piece.id,
      start,
      origin: { ...piece.layout2d },
    }
    svgRef.current?.setPointerCapture?.(event.pointerId)
  }

  const beginPointDrag = (event, piece, pointIndex) => {
    if (tool !== 'point' || piece.locked) return
    event.preventDefault()
    event.stopPropagation()
    onSelectPiece(piece.id)
    onBeginGesture?.()
    const start = clientToSvg(event)
    dragRef.current = {
      kind: 'point',
      pointerId: event.pointerId,
      pieceId: piece.id,
      pointIndex,
      start,
      origin: { ...piece.points[pointIndex] },
    }
    svgRef.current?.setPointerCapture?.(event.pointerId)
  }

  const beginCurveDrag = (event, piece, edgeIndex) => {
    if (tool !== 'curve' || piece.locked) return
    event.preventDefault()
    event.stopPropagation()
    onSelectPiece(piece.id)
    onBeginGesture?.()
    const a = piece.points[edgeIndex]
    const b = piece.points[(edgeIndex + 1) % piece.points.length]
    const existing = piece.curves?.[edgeIndex]
    const origin = existing
      ? { x: existing.cx, y: existing.cy }
      : { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 }
    dragRef.current = {
      kind: 'curve',
      pointerId: event.pointerId,
      pieceId: piece.id,
      edgeIndex,
      start: clientToSvg(event),
      origin,
    }
    svgRef.current?.setPointerCapture?.(event.pointerId)
  }

  const localPoint = (event, piece) => {
    const point = clientToSvg(event)
    return { x: point.x - piece.layout2d.x, y: piece.layout2d.y - point.y }
  }

  const beginInternalDrag = (event, piece) => {
    if (tool !== 'internal' || piece.locked) return
    event.preventDefault()
    event.stopPropagation()
    onSelectPiece(piece.id)
    onBeginGesture?.()
    const start = localPoint(event, piece)
    dragRef.current = {
      kind: 'internal',
      pointerId: event.pointerId,
      pieceId: piece.id,
      piece,
      startLocal: start,
      currentLocal: start,
    }
    setInternalPreview({ pieceId: piece.id, a: start, b: start })
    svgRef.current?.setPointerCapture?.(event.pointerId)
  }

  const createPinAtEvent = (event, piece) => {
    if (tool !== 'pin' || piece.locked) return
    event.preventDefault()
    event.stopPropagation()
    onSelectPiece(piece.id)
    onCreatePin?.(piece.id, localPoint(event, piece))
  }

  const createFastenerAtEvent = (event, piece) => {
    if (tool !== 'fastener' || piece.locked) return
    event.preventDefault()
    event.stopPropagation()
    onSelectPiece(piece.id)
    const endpoint = { pieceId: piece.id, ...localPoint(event, piece) }
    if (!pendingFastener) {
      setPendingFastener(endpoint)
      return
    }
    if (pendingFastener.pieceId === endpoint.pieceId && Math.hypot(pendingFastener.x - endpoint.x, pendingFastener.y - endpoint.y) < 0.5) {
      setPendingFastener(null)
      return
    }
    onCreateFastener?.(pendingFastener, endpoint)
    setPendingFastener(null)
  }

  const createMeasurementAtEvent = (event, piece) => {
    if (tool !== 'measure' || piece.locked) return
    event.preventDefault()
    event.stopPropagation()
    onSelectPiece(piece.id)
    const endpoint = { pieceId: piece.id, ...localPoint(event, piece) }
    if (!pendingMeasurement || pendingMeasurement.pieceId !== piece.id) {
      setPendingMeasurement(endpoint)
      return
    }
    if (Math.hypot(pendingMeasurement.x - endpoint.x, pendingMeasurement.y - endpoint.y) < 0.2) {
      setPendingMeasurement(null)
      return
    }
    onCreateMeasurement?.(pendingMeasurement, endpoint)
    setPendingMeasurement(null)
  }

  const handlePointerMove = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const current = clientToSvg(event)
    const dx = current.x - drag.start.x
    const dy = current.y - drag.start.y
    if (drag.kind === 'piece') {
      onMovePiece(drag.pieceId, {
        x: drag.origin.x + dx,
        y: drag.origin.y + dy,
      })
    } else if (drag.kind === 'point') {
      onMovePoint(drag.pieceId, drag.pointIndex, {
        x: Math.round((drag.origin.x + dx) * 10) / 10,
        y: Math.round((drag.origin.y - dy) * 10) / 10,
      })
    } else if (drag.kind === 'curve') {
      onMoveCurve(drag.pieceId, drag.edgeIndex, {
        cx: Math.round((drag.origin.x + dx) * 10) / 10,
        cy: Math.round((drag.origin.y - dy) * 10) / 10,
      })
    } else if (drag.kind === 'internal') {
      const currentLocal = localPoint(event, drag.piece)
      drag.currentLocal = currentLocal
      setInternalPreview({ pieceId: drag.pieceId, a: drag.startLocal, b: currentLocal })
    }
  }

  const endDrag = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (drag.kind === 'internal') {
      const distance = Math.hypot(drag.currentLocal.x - drag.startLocal.x, drag.currentLocal.y - drag.startLocal.y)
      if (distance >= 1.5) onCreateInternalLine?.(drag.pieceId, { a: drag.startLocal, b: drag.currentLocal })
      setInternalPreview(null)
    }
    dragRef.current = null
    svgRef.current?.releasePointerCapture?.(event.pointerId)
    onEndGesture?.()
  }

  const handleEdgeClick = (event, piece, edgeIndex) => {
    if (tool === 'notch') {
      event.preventDefault()
      event.stopPropagation()
      onSelectPiece(piece.id)
      const cursor = localPoint(event, piece)
      const fraction = closestEdgeFraction(piece, edgeIndex, cursor, 48)
      onCreateNotch?.(piece.id, edgeIndex, Math.max(0.02, Math.min(0.98, fraction)))
      return
    }
    if (tool === 'split') {
      event.preventDefault()
      event.stopPropagation()
      onSelectPiece(piece.id)
      const cursor = localPoint(event, piece)
      const path = sampleEdge(piece, edgeIndex, 24)
      let bestT = 0.5
      let bestDistance = Infinity
      for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex += 1) {
        const a = path[segmentIndex]
        const b = path[segmentIndex + 1]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const lengthSq = dx * dx + dy * dy || 1
        const localT = Math.max(0, Math.min(1, ((cursor.x - a.x) * dx + (cursor.y - a.y) * dy) / lengthSq))
        const px = a.x + dx * localT
        const py = a.y + dy * localT
        const distance = Math.hypot(cursor.x - px, cursor.y - py)
        if (distance < bestDistance) {
          bestDistance = distance
          bestT = (segmentIndex + localT) / (path.length - 1)
        }
      }
      onSplitEdge?.(piece.id, edgeIndex, Math.max(0.05, Math.min(0.95, bestT)))
      return
    }
    if (tool !== 'sew') return
    event.preventDefault()
    event.stopPropagation()
    onSelectPiece(piece.id)
    const next = { pieceId: piece.id, edgeIndex }
    if (!pendingEdge) {
      setPendingEdge(next)
      return
    }
    if (pendingEdge.pieceId === next.pieceId && pendingEdge.edgeIndex === next.edgeIndex) {
      setPendingEdge(null)
      return
    }
    onCreateSeam(pendingEdge, next)
    setPendingEdge(null)
  }

  return (
    <div className="pattern-editor-shell">
      <ViewportQuickTools dimension="2d" activeTool={tool} onChangeTool={onChangeTool}/>
      <div className="workspace-head">
        <div>
          <strong>2D PATTERN</strong>
          <span>{project.units.toUpperCase()} · {project.pieces.length} PIECES</span>
        </div>
        <div className="workspace-hint">
          {tool === 'select' && 'Drag a piece to arrange it'}
          {tool === 'point' && 'Drag anchor points to edit · Option/Alt-click a point to delete it'}
          {tool === 'split' && 'Click an edge to insert a new pattern point'}
          {tool === 'curve' && 'Drag an edge handle to shape a curve · double-click to straighten'}
          {tool === 'internal' && 'Drag inside a pattern to create a construction line · classify it as fold or dart in the inspector'}
          {tool === 'pin' && 'Click inside the pattern to add a manual 3D pin · click a pin to remove it'}
          {tool === 'notch' && 'Click a pattern edge to place a production notch at that exact curve position'}
          {tool === 'sew' && (pendingEdge ? 'Select the second edge' : 'Select the first seam edge')}
          {tool === 'fastener' && (pendingFastener ? 'Click the mating buttonhole / snap point' : 'Click the first fastener point')}
          {tool === 'measure' && (pendingMeasurement ? 'Click the second measurement point on this pattern' : 'Click the first measurement point')}
        </div>
      </div>
      <svg
        ref={svgRef}
        className={`pattern-canvas tool-${tool}`}
        role="application"
        tabIndex={0}
        aria-label="2D pattern canvas: wheel to zoom; F fit all; Shift F focus selected; plus or minus zoom; Shift A tidy"
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        onWheel={onCanvasWheel}
        onKeyDown={onCanvasKeyDown}
        onContextMenu={openPatternContextMenu}
        onPointerMove={(event) => {
          if (panRef.current?.pointerId === event.pointerId) {
            const bounds = svgRef.current.getBoundingClientRect()
            const dx = (event.clientX - panRef.current.x) * view.width / bounds.width
            const dy = (event.clientY - panRef.current.y) * view.height / bounds.height
            setView((old) => ({ ...old, x: old.x - dx, y: old.y - dy }))
            panRef.current.x = event.clientX
            panRef.current.y = event.clientY
          } else handlePointerMove(event)
        }}
        onPointerUp={(event) => { if (panRef.current?.pointerId === event.pointerId) panRef.current = null; else endDrag(event) }}
        onPointerCancel={(event) => { panRef.current = null; endDrag(event) }}
        onPointerDown={(event) => {
          if (event.button === 1 || (event.button === 0 && event.altKey && event.target === event.currentTarget)) {
            panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
            event.currentTarget.setPointerCapture(event.pointerId)
            event.preventDefault()
            return
          }
          if (event.target === event.currentTarget) onSelectPiece(null)
        }}
      >
        <defs>
          <pattern id="minor-grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(77,78,82,.16)" strokeWidth=".28" />
          </pattern>
          <pattern id="major-grid" width="25" height="25" patternUnits="userSpaceOnUse">
            <rect width="25" height="25" fill="url(#minor-grid)" />
            <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(75,76,79,.27)" strokeWidth=".38" />
          </pattern>
          <marker id="grain-arrow" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto-start-reverse" markerUnits="strokeWidth">
            <path d="M 0 0 L 5 2.5 L 0 5 z" fill="currentColor" />
          </marker>
          {project.pieces.map((piece) => (
            <clipPath id={`pattern-clip-${piece.id}`} key={`clip-${piece.id}`}>
              <path d={polygonPath(piece)} />
            </clipPath>
          ))}
          {project.pieces.map((piece) => {
            const fabric = project.fabrics?.[piece.fabricId] || project.fabrics?.main
            if (!fabric?.texture?.src) return null
            const repeatWidth = Math.max(0.5, Number(fabric.texture.repeatWidthCm ?? 20))
            const repeatHeight = Math.max(0.5, Number(fabric.texture.repeatHeightCm ?? 20))
            const rotation = -(Number(piece.grainAngleDeg || 0) + Number(fabric.texture.rotationDeg || 0))
            return (
              <pattern
                id={`fabric-texture-${piece.id}`}
                key={`fabric-texture-${piece.id}`}
                width={repeatWidth}
                height={repeatHeight}
                patternUnits="userSpaceOnUse"
                patternTransform={`rotate(${rotation})`}
              >
                <rect width={repeatWidth} height={repeatHeight} fill={fabric.color || '#d3d3d3'} />
                <image href={fabric.texture.src} width={repeatWidth} height={repeatHeight} preserveAspectRatio="none" />
              </pattern>
            )
          })}
        </defs>
        {/* Overscan the SVG camera's visible rectangle. Grid coverage is
            continuous even during rapid cursor-centric zoom and panning. */}
        {showGrid && <rect x={view.x-view.width} y={view.y-view.height} width={view.width*3} height={view.height*3} fill="url(#major-grid)" pointerEvents="none" data-grid-coverage="overscanned"/>}
        {/* World-space drafting origin is aligned with the center of the guide
            figure. Unlike an HTML overlay, it pans and zooms with the patterns.
            The reference figure never intercepts pattern selection or sewing. */}
        <g className="draft-avatar-guide" aria-label={`Centered 2D drafting avatar: ${project.avatar?.name || 'Fitting body'}`} pointerEvents="none" transform={`translate(165 85) scale(${Math.max(.82, Math.min(1.22, Number(project.avatar?.heightCm || 180) / 180))})`}>
          <FlatAvatarSilhouette avatar={project.avatar}/>
        </g>
        {showGrid && <g className="draft-center-axes" pointerEvents="none" aria-label="2D drafting center axes">
          <path className="draft-center-horizontal" d="M-900 85H1230"/>
          <path className="draft-center-vertical" d="M165-900V1100"/>
          <circle className="draft-origin-dot" cx="165" cy="85" r="1.5"/>
        </g>}

        {gradeNestProjects.map((gradedProject, index) => {
          const piece = gradedProject.pieces?.find((item) => item.id === selectedPieceId)
          if (!piece) return null
          return (
            <g key={`grade-nest-${gradedProject.previewSize || index}`} className="grade-nest-group">
              <path d={polygonPath(piece)} className="grade-nest-path" />
              <text x={piece.layout2d.x} y={piece.layout2d.y - Math.max(...piece.points.map((point) => point.y)) - 3 - index * 3.2} className="grade-nest-label">{gradedProject.previewSize || ''}</text>
            </g>
          )
        })}

        {project.pieces.map((piece) => {
          const selected = piece.id === selectedPieceId
          const pieceFabric = project.fabrics?.[piece.fabricId] || project.fabrics?.main
          const patternFill = pieceFabric?.texture?.src ? `url(#fabric-texture-${piece.id})` : undefined
          const hasSeamAllowance = piece.points.some((_, edgeIndex) => getEdgeSeamAllowance(piece, edgeIndex) > 0)
          return (
            <g key={piece.id} data-piece-id={piece.id} className={`pattern-piece ${selected ? 'selected' : ''}`}>
              {selected && (() => {
                const samples = samplePieceBoundary(piece, 12).points.map((p) => svgPoint(p, piece.layout2d))
                const xs = samples.map(p => p.x), ys = samples.map(p => p.y)
                const x = Math.min(...xs) - 3, y = Math.min(...ys) - 3
                const width = Math.max(...xs) - Math.min(...xs) + 6
                const height = Math.max(...ys) - Math.min(...ys) + 6
                return <rect className="pattern-selection-box" x={x} y={y} width={width} height={height} fill="none" pointerEvents="none" />
              })()}
              {hasSeamAllowance && (
                <path
                  d={pointsPath(seamAllowanceBoundary(piece, 8), piece.layout2d)}
                  className={`seam-allowance ${selected ? 'selected' : ''}`}
                />
              )}
              <path
                d={polygonPath(piece)}
                className="pattern-fill"
                style={patternFill ? { fill: patternFill } : undefined}
                onPointerDown={(event) => tool === 'internal'
                  ? beginInternalDrag(event, piece)
                  : tool === 'pin'
                    ? createPinAtEvent(event, piece)
                    : tool === 'fastener'
                      ? createFastenerAtEvent(event, piece)
                      : tool === 'measure'
                        ? createMeasurementAtEvent(event, piece)
                      : beginPieceDrag(event, piece)}
                onClick={() => onSelectPiece(piece.id)}
              />
              {(piece.graphics || []).map((graphic) => {
                const center = svgPoint({ x: graphic.x ?? 0, y: graphic.y ?? 0 }, piece.layout2d)
                const width = Math.max(0.1, Number(graphic.widthCm ?? 20))
                const height = Math.max(0.1, Number(graphic.heightCm ?? 20))
                return (
                  <image
                    key={graphic.id}
                    className="pattern-graphic"
                    href={graphic.src}
                    x={center.x - width * 0.5}
                    y={center.y - height * 0.5}
                    width={width}
                    height={height}
                    opacity={graphic.opacity ?? 1}
                    preserveAspectRatio="none"
                    clipPath={`url(#pattern-clip-${piece.id})`}
                    transform={`rotate(${-(graphic.rotationDeg || 0)} ${center.x} ${center.y})`}
                  />
                )
              })}
              {(piece.pins || []).map((pin) => {
                const rendered = svgPoint(pin, piece.layout2d)
                return (
                  <g
                    key={pin.id}
                    className="pattern-pin"
                    transform={`translate(${rendered.x} ${rendered.y})`}
                    onPointerDown={(event) => {
                      if (tool !== 'pin') return
                      event.preventDefault()
                      event.stopPropagation()
                      onRemovePin?.(piece.id, pin.id)
                    }}
                  >
                    <circle r="2.15" />
                    <line x1="-1.1" y1="0" x2="1.1" y2="0" />
                    <line x1="0" y1="-1.1" x2="0" y2="1.1" />
                  </g>
                )
              })}
              {(project.fasteners || []).flatMap((fastener) => {
                const markers = []
                for (const [role, endpoint] of [['a', fastener.a], ['b', fastener.b]]) {
                  if (endpoint?.pieceId !== piece.id) continue
                  const rendered = svgPoint(endpoint, piece.layout2d)
                  markers.push(
                    <g key={`${fastener.id}-${role}`} className={`pattern-fastener ${fastener.closed === false ? 'open' : 'closed'} role-${role}`} transform={`translate(${rendered.x} ${rendered.y})`}>
                      {role === 'a' ? <circle r={2.3} /> : <><line x1={-3.2} y1="0" x2={3.2} y2="0" /><line x1={-2.3} y1="-.7" x2={-2.3} y2=".7" /><line x1={2.3} y1="-.7" x2={2.3} y2=".7" /></>}
                    </g>,
                  )
                }
                return markers
              })}
              {(project.customMeasurements || []).filter((measurement) => measurement.pieceId === piece.id).map((measurement) => {
                const a = svgPoint(measurement.a, piece.layout2d)
                const b = svgPoint(measurement.b, piece.layout2d)
                const cm = Math.hypot(measurement.b.x - measurement.a.x, measurement.b.y - measurement.a.y)
                return (
                  <g key={measurement.id} className="pattern-measurement">
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                    <circle cx={a.x} cy={a.y} r="1.35" />
                    <circle cx={b.x} cy={b.y} r="1.35" />
                    <text x={(a.x + b.x) * 0.5} y={(a.y + b.y) * 0.5 - 2}>{cm.toFixed(1)} cm</text>
                  </g>
                )
              })}
              {pendingMeasurement?.pieceId === piece.id && (() => {
                const point = svgPoint(pendingMeasurement, piece.layout2d)
                return <circle className="measurement-pending" cx={point.x} cy={point.y} r="2.2" />
              })()}
              {(piece.internalLines || []).map((line) => {
                const a = svgPoint(line.a, piece.layout2d)
                const b = svgPoint(line.b, piece.layout2d)
                if (line.type === 'dart') {
                  const dx = b.x - a.x
                  const dy = b.y - a.y
                  const length = Math.hypot(dx, dy) || 1
                  const width = (line.widthCm ?? 2.5) * 0.5
                  const nx = -dy / length * width
                  const ny = dx / length * width
                  return (
                    <g key={line.id} className="internal-line dart-line">
                      <line x1={a.x + nx} y1={a.y + ny} x2={b.x} y2={b.y} />
                      <line x1={a.x - nx} y1={a.y - ny} x2={b.x} y2={b.y} />
                      <line className="dart-center" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                    </g>
                  )
                }
                if (line.type === 'pleat') {
                  const dx = b.x - a.x
                  const dy = b.y - a.y
                  const length = Math.hypot(dx, dy) || 1
                  const nx = -dy / length
                  const ny = dx / length
                  const count = Math.max(1, Math.min(16, Math.round(Number(line.count ?? 5))))
                  const spacing = Math.max(1, Number(line.spacingCm ?? 4))
                  return (
                    <g key={line.id} className="internal-line pleat-line-set">
                      {Array.from({ length: count }, (_, index) => {
                        const offset = (index - (count - 1) * 0.5) * spacing
                        return <line key={`${line.id}-${index}`} x1={a.x + nx * offset} y1={a.y + ny * offset} x2={b.x + nx * offset} y2={b.y + ny * offset} />
                      })}
                    </g>
                  )
                }
                return <line key={line.id} className={`internal-line internal-${line.type || 'construction'}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              })}
              {internalPreview?.pieceId === piece.id && (() => {
                const a = svgPoint(internalPreview.a, piece.layout2d)
                const b = svgPoint(internalPreview.b, piece.layout2d)
                return <line className="internal-line-preview" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              })()}
              {(() => {
                const sampled = samplePieceBoundary(piece, 10).points
                if (!sampled.length) return null
                const xs = sampled.map((sample) => sample.x)
                const ys = sampled.map((sample) => sample.y)
                const center = { x: (Math.min(...xs) + Math.max(...xs)) * 0.5, y: (Math.min(...ys) + Math.max(...ys)) * 0.5 }
                const length = Math.max(10, (Math.max(...ys) - Math.min(...ys)) * 0.52)
                const angle = (Number(piece.grainAngleDeg || 0) * Math.PI) / 180
                const direction = { x: Math.sin(angle), y: Math.cos(angle) }
                const a = svgPoint({ x: center.x - direction.x * length * 0.5, y: center.y - direction.y * length * 0.5 }, piece.layout2d)
                const b = svgPoint({ x: center.x + direction.x * length * 0.5, y: center.y + direction.y * length * 0.5 }, piece.layout2d)
                return <line className="grainline" x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerStart="url(#grain-arrow)" markerEnd="url(#grain-arrow)" />
              })()}
              {/* True curve-intersection POM stations remain aligned when the
                  manufacturer or designer edits the armscye and side seams.
                  CF/CB, chest and stomach/waist lines are drafting annotations
                  only: never convert these into unintended cut boundaries. */}
              {['front','back'].includes(piece.id) && (() => {
                const xs = piece.points.map(p => p.x), ys = piece.points.map(p => p.y)
                const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys)
                const cx=(minX+maxX)/2, chestY=minY+(maxY-minY)*.70, stomachY=minY+(maxY-minY)*.42
                const a=svgPoint({x:cx,y:minY+2},piece.layout2d),b=svgPoint({x:cx,y:maxY-2},piece.layout2d)
                const chest=horizontalSpanAt(piece,chestY), stomach=horizontalSpanAt(piece,stomachY)
                const center=svgPoint({x:cx,y:chestY},piece.layout2d)
                return <g className="clo-bodice-drafting-guides" pointerEvents="none" clipPath={`url(#pattern-clip-${piece.id})`}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="bodice-center-guide"/>
                  {[[chest,chestY,'bodice-chest-guide','CHEST'],[stomach,stomachY,'bodice-stomach-guide','STOMACH']].map(([span,y,klass,label])=> span && (()=>{
                    const left=svgPoint({x:span.left+.6,y},piece.layout2d)
                    const right=svgPoint({x:span.right-.6,y},piece.layout2d)
                    const mid=svgPoint({x:cx,y},piece.layout2d)
                    return <g key={label} className={`clo-pom-station ${klass}`} data-pom={label.toLowerCase()}>
                      <line x1={left.x} x2={right.x} y1={left.y} y2={right.y}/>
                      <circle cx={left.x} cy={left.y} r=".95"/><circle cx={right.x} cy={right.y} r=".95"/>
                      <circle cx={mid.x} cy={mid.y} r="1.35"/>
                      <path d={`M${mid.x-2.8} ${mid.y}h5.6M${mid.x} ${mid.y-2.8}v5.6`} />
                      {selected && <text x={mid.x+3.9} y={mid.y-1.8} className="clo-pom-measurement-label">{label} {span.width.toFixed(1)} CM</text>}
                    </g>
                  })())}
                  <circle cx={center.x} cy={center.y} r=".85"/>
                </g>
              })()}
              {(piece.notches || []).map((notch) => {
                const length = edgeLength(piece, notch.edgeIndex)
                const gap = length > 0 ? Math.min(0.045, 0.38 / length) : 0.02
                const fractions = notch.type === 'double'
                  ? [Math.max(0.01, (notch.t ?? 0.5) - gap), Math.min(0.99, (notch.t ?? 0.5) + gap)]
                  : [notch.t ?? 0.5]
                return (
                  <g key={notch.id} className={`pattern-notch ${notch.matchGroupId ? 'matched' : ''}`}>
                    {fractions.map((fraction, notchIndex) => {
                      const located = edgePointAt(piece, notch.edgeIndex, fraction, 48)
                      if (!located) return null
                      const depth = Number(notch.depthCm ?? 0.45)
                      const a = svgPoint({ x: located.point.x - located.normal.x * depth * 0.15, y: located.point.y - located.normal.y * depth * 0.15 }, piece.layout2d)
                      const b = svgPoint({ x: located.point.x + located.normal.x * depth, y: located.point.y + located.normal.y * depth }, piece.layout2d)
                      return <line key={`${notch.id}-${notchIndex}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                    })}
                  </g>
                )
              })}
              {(piece.topstitches || []).map((stitch) => (
                <g key={stitch.id} className="pattern-topstitch">
                  {topstitchPaths(piece, stitch).map((path, rowIndex) => (
                    <polyline
                      key={`${stitch.id}-${rowIndex}`}
                      points={path.map((point) => {
                        const rendered = svgPoint(point, piece.layout2d)
                        return `${rendered.x},${rendered.y}`
                      }).join(' ')}
                      style={{ stroke: stitch.color || '#8d8d8d' }}
                    />
                  ))}
                </g>
              ))}
              {(piece.bindings || []).map((binding) => {
                const path = offsetEdgePath(piece, binding.edgeIndex, Number(binding.widthCm ?? 1.8) * 0.45, 32)
                return (
                  <polyline
                    key={binding.id}
                    className="pattern-binding"
                    points={path.map((point) => {
                      const rendered = svgPoint(point, piece.layout2d)
                      return `${rendered.x},${rendered.y}`
                    }).join(' ')}
                    style={{ stroke: binding.color || '#656565', strokeWidth: Math.max(0.65, Number(binding.widthCm ?? 1.8) * 0.32) }}
                  />
                )
              })}
              {(piece.zippers || []).map((zipper) => {
                const rails = zipperPaths(piece, zipper)
                const centerPath = sampleEdge(piece, zipper.edgeIndex, 32)
                return (
                  <g key={zipper.id} className="pattern-zipper">
                    {rails.map((path, railIndex) => (
                      <polyline key={`${zipper.id}-rail-${railIndex}`} points={path.map((point) => {
                        const rendered = svgPoint(point, piece.layout2d)
                        return `${rendered.x},${rendered.y}`
                      }).join(' ')} />
                    ))}
                    <polyline className="zipper-teeth" points={centerPath.map((point) => {
                      const rendered = svgPoint(point, piece.layout2d)
                      return `${rendered.x},${rendered.y}`
                    }).join(' ')} />
                  </g>
                )
              })}
              {(piece.buttons || []).map((button) => {
                const center = svgPoint(button, piece.layout2d)
                const radius = Math.max(0.35, Number(button.diameterCm ?? 1.8) * 0.5)
                return (
                  <g key={button.id} className="pattern-button">
                    <circle cx={center.x} cy={center.y} r={radius} />
                    <circle className="button-hole" cx={center.x - radius * 0.24} cy={center.y} r={Math.max(0.12, radius * 0.11)} />
                    <circle className="button-hole" cx={center.x + radius * 0.24} cy={center.y} r={Math.max(0.12, radius * 0.11)} />
                  </g>
                )
              })}
              {(piece.buttonholes || []).map((buttonhole) => {
                const center = svgPoint(buttonhole, piece.layout2d)
                const halfLength = Math.max(0.3, Number(buttonhole.lengthCm ?? 2.4) * 0.5)
                const angle = (Number(buttonhole.orientationDeg || 0) * Math.PI) / 180
                const dx = Math.cos(angle) * halfLength
                const dy = Math.sin(angle) * halfLength
                return (
                  <g key={buttonhole.id} className="pattern-buttonhole">
                    <line x1={center.x - dx} y1={center.y - dy} x2={center.x + dx} y2={center.y + dy} />
                    <circle cx={center.x - dx} cy={center.y - dy} r={0.18} />
                    <circle cx={center.x + dx} cy={center.y + dy} r={0.18} />
                  </g>
                )
              })}
              {piece.points.map((point, edgeIndex) => {
                const next = piece.points[(edgeIndex + 1) % piece.points.length]
                const a = svgPoint(point, piece.layout2d)
                const b = svgPoint(next, piece.layout2d)
                const edgePath = sampleEdge(piece, edgeIndex, 18).map((sample) => svgPoint(sample, piece.layout2d))
                const edgePathD = edgePath.map((sample, index) => `${index ? 'L' : 'M'} ${sample.x} ${sample.y}`).join(' ')
                const token = edgeToken(piece.id, edgeIndex)
                const sewn = seamEdges.has(token)
                const walking = walkEdges.has(token)
                const pending = pendingEdge && edgeToken(pendingEdge.pieceId, pendingEdge.edgeIndex) === token
                const hovered = hoverEdge === token
                const partialRanges = partialSeamRanges.get(token) || []
                return (
                  <g key={`${piece.id}-edge-${edgeIndex}`}>
                    <path
                      d={edgePathD}
                      fill="none"
                      className={`pattern-edge ${sewn ? 'sewn' : ''} ${walking ? 'walk-highlight' : ''} ${pending ? 'pending' : ''} ${hovered ? 'hovered' : ''}`}
                    />
                    {partialRanges.map((range, rangeIndex) => {
                      const samples = []
                      for (let sampleIndex = 0; sampleIndex <= 18; sampleIndex += 1) {
                        const fraction = range.start + (range.end - range.start) * (sampleIndex / 18)
                        const located = edgePointAt(piece, edgeIndex, fraction, 64)
                        if (located?.point) samples.push(svgPoint(located.point, piece.layout2d))
                      }
                      if (samples.length < 2) return null
                      const partialPath = samples.map((sample, sampleIndex) => `${sampleIndex ? 'L' : 'M'} ${sample.x} ${sample.y}`).join(' ')
                      const first = samples[0]
                      const last = samples[samples.length - 1]
                      return (
                        <g key={`${range.seamId}-${rangeIndex}`} className={`partial-seam-range ${range.walking ? 'walk-highlight' : ''}`}>
                          <path d={partialPath} fill="none" className={`pattern-edge sewn partial-sewn ${range.walking ? 'walk-highlight' : ''}`} />
                          <circle className="partial-seam-cap" cx={first.x} cy={first.y} r={0.7} />
                          <circle className="partial-seam-cap" cx={last.x} cy={last.y} r={0.7} />
                        </g>
                      )
                    })}
                    <path
                      d={edgePathD}
                      fill="none"
                      className="edge-hit"
                      onPointerEnter={() => setHoverEdge(token)}
                      onPointerLeave={() => setHoverEdge(null)}
                      onPointerDown={(event) => handleEdgeClick(event, piece, edgeIndex)}
                    />
                    {selected && !['sew', 'notch'].includes(tool) && edgeIndex % 2 === 0 && (
                      <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 1.5} className="edge-measure">
                        {edgeLength(piece, edgeIndex).toFixed(1)}
                      </text>
                    )}
                  </g>
                )
              })}
              {selected && <path
                d={polygonPath(piece)}
                className="pattern-selection-outline"
                fill="none"
                pointerEvents="none"
                aria-hidden="true"
              />}
              {piece.points.map((point, pointIndex) => {
                const rendered = svgPoint(point, piece.layout2d)
                return (
                  <circle
                    key={`${piece.id}-point-${pointIndex}`}
                    cx={rendered.x}
                    cy={rendered.y}
                    r={tool === 'point' && selected ? 2.25 : selected ? 1.8 : 1.25}
                    className={`pattern-node ${selected ? 'selected-point' : ''} ${tool === 'point' && selected ? 'editable' : ''}`}
                    onPointerDown={(event) => {
                      if (tool === 'point' && (event.altKey || event.metaKey)) {
                        event.preventDefault()
                        event.stopPropagation()
                        onDeletePoint?.(piece.id, pointIndex)
                        return
                      }
                      beginPointDrag(event, piece, pointIndex)
                    }}
                    onDoubleClick={(event) => {
                      if (tool !== 'point') return
                      event.preventDefault()
                      event.stopPropagation()
                      onDeletePoint?.(piece.id, pointIndex)
                    }}
                  />
                )
              })}
              {selected && tool === 'curve' && piece.points.map((point, edgeIndex) => {
                const next = piece.points[(edgeIndex + 1) % piece.points.length]
                const curve = piece.curves?.[edgeIndex]
                const controlLocal = curve
                  ? { x: curve.cx, y: curve.cy }
                  : { x: (point.x + next.x) * 0.5, y: (point.y + next.y) * 0.5 }
                const control = svgPoint(controlLocal, piece.layout2d)
                const a = svgPoint(point, piece.layout2d)
                const b = svgPoint(next, piece.layout2d)
                return (
                  <g key={`${piece.id}-curve-${edgeIndex}`} className={`curve-control ${curve ? 'active' : ''}`}>
                    {curve && <><line x1={a.x} y1={a.y} x2={control.x} y2={control.y} /><line x1={b.x} y1={b.y} x2={control.x} y2={control.y} /></>}
                    <circle
                      cx={control.x}
                      cy={control.y}
                      r={1.55}
                      onPointerDown={(event) => beginCurveDrag(event, piece, edgeIndex)}
                      onDoubleClick={(event) => { event.stopPropagation(); onMoveCurve(piece.id, edgeIndex, null) }}
                    />
                  </g>
                )
              })}
              <g transform={`translate(${piece.layout2d.x}, ${piece.layout2d.y + 11})`} className="piece-label">
                <rect x="-20" y="-5" width="40" height="9" rx="4.5" />
                <text textAnchor="middle" y="1.5">{piece.name.toUpperCase()}</text>
              </g>
            </g>
          )
        })}
        {showSeamLinks && (project.seams || []).map((seam) => {
          const pieceA = project.pieces.find((piece) => piece.id === seam.a?.pieceId)
          const pieceB = project.pieces.find((piece) => piece.id === seam.b?.pieceId)
          if (!pieceA || !pieceB) return null
          const links = []
          // Show a legible sparse correspondence at rest; a chosen sewing
          // relationship expands to nine exact matching stations.
          const segments = highlightSeamId === seam.id ? 8 : 2
          for (let index = 0; index <= segments; index += 1) {
            const t = index / segments
            const aStart = Number(seam.a?.startT ?? 0)
            const aEnd = Number(seam.a?.endT ?? 1)
            const bStart = Number(seam.b?.startT ?? 0)
            const bEnd = Number(seam.b?.endT ?? 1)
            const aPoint = edgePointAt(pieceA, seam.a.edgeIndex, aStart + t * (aEnd - aStart), 48)?.point
            const bFraction = seam.reverseB ? 1 - t : t
            const bPoint = edgePointAt(pieceB, seam.b.edgeIndex, bStart + bFraction * (bEnd - bStart), 48)?.point
            if (!aPoint || !bPoint) continue
            const a = svgPoint(aPoint, pieceA.layout2d)
            const b = svgPoint(bPoint, pieceB.layout2d)
            links.push(<line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />)
          }
          return <g className={`pattern-seam-correspondence ${highlightSeamId === seam.id ? 'active' : ''}`} key={`link-${seam.id}`} aria-label={`${seam.name || seam.id} sewing correspondence`}>{links}</g>
        })}
      </svg>
      {contextMenu && <div className="clo-pattern-context-menu" role="menu" aria-label="2D pattern context menu" style={{left:contextMenu.x,top:contextMenu.y}} onContextMenu={event=>event.preventDefault()}>
        <strong>{project.pieces.find(piece=>piece.id===contextMenu.pieceId)?.name || '2D Pattern Window'}</strong>
        {[
          ['Select / Transform',()=>onChangeTool?.('select')],
          ['Edit Pattern Points',()=>onChangeTool?.('point')],
          ['Edit Curve',()=>onChangeTool?.('curve')],
          ['Add / Split Point',()=>onChangeTool?.('split')],
          ['Edit Sewing',()=>onChangeTool?.('sew')],
          ['Add Notch',()=>onChangeTool?.('notch')],
          ['Add Pin',()=>onChangeTool?.('pin')],
          ['Add Fastener',()=>onChangeTool?.('fastener')],
          ['Internal Line / Dart',()=>onChangeTool?.('internal')],
          ['Create Center Internal Line',createCenterLine],
          ['Measure',()=>onChangeTool?.('measure')],
          ['Zoom Selected',focusSelected],
          ['Zoom In',()=>zoomAt(.8)],
          ['Zoom Out',()=>zoomAt(1.25)],
          ['Fit All Patterns',()=>focusPieces(project.pieces,14)],
          ['Arrange Patterns',()=>onAutoArrange?.()],
          ['Toggle Sewing Links',()=>onToggleSeams?.()],
          ['Toggle Grid',()=>onToggleGrid?.()],
        ].map(([label,handler])=><button key={label} role="menuitem" type="button" onClick={()=>{handler();setContextMenu(null)}}>{label}</button>)}
      </div>}
      <div className="canvas-scale"><span />10 cm</div>
    </div>
  )
}
