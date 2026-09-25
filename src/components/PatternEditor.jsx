import React, { useMemo, useRef, useState } from 'react'
import { closestEdgeFraction, edgeLength, edgePointAt, getEdgeSeamAllowance, sampleEdge, samplePieceBoundary, seamAllowanceBoundary } from '../core/project.js'
import { offsetEdgePath, topstitchPaths, zipperPaths } from '../core/trims.js'

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

export default function PatternEditor({
  project,
  gradeNestProjects = [],
  highlightSeamId = null,
  selectedPieceId,
  tool,
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
    if (tool !== 'select' || piece.locked) return
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
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onSelectPiece(null)
        }}
      >
        <defs>
          <pattern id="minor-grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(255,255,255,.035)" strokeWidth=".35" />
          </pattern>
          <pattern id="major-grid" width="25" height="25" patternUnits="userSpaceOnUse">
            <rect width="25" height="25" fill="url(#minor-grid)" />
            <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(255,255,255,.075)" strokeWidth=".45" />
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
        <rect width="100%" height="100%" fill="url(#major-grid)" />

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
            <g key={piece.id} className={`pattern-piece ${selected ? 'selected' : ''}`}>
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
              {piece.points.map((point, pointIndex) => {
                const rendered = svgPoint(point, piece.layout2d)
                return (
                  <circle
                    key={`${piece.id}-point-${pointIndex}`}
                    cx={rendered.x}
                    cy={rendered.y}
                    r={tool === 'point' && selected ? 1.6 : 0.8}
                    className={`pattern-node ${tool === 'point' && selected ? 'editable' : ''}`}
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
      </svg>
      <div className="canvas-scale"><span />10 cm</div>
    </div>
  )
}
