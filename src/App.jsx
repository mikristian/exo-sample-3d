import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Box,
  Cpu,
  Download,
  Eye,
  FileDown,
  Link2,
  Lock,
  MapPin,
  MousePointer2,
  Pause,
  PenTool,
  Play,
  Plus,
  Redo2,
  Ruler,
  RotateCcw,
  Save,
  Scissors,
  Sparkles,
  Spline,
  Trash2,
  Undo2,
  Unlock,
  Upload,
} from 'lucide-react'
import PatternEditor from './components/PatternEditor.jsx'
import GarmentViewport from './components/GarmentViewport.jsx'
import MarkerPreview from './components/MarkerPreview.jsx'
import SeamWalkPreview from './components/SeamWalkPreview.jsx'
import { createDefaultProject, FABRIC_PRESETS } from './data/defaultProject.js'
import { createTemplateProject, GARMENT_TEMPLATES } from './data/templates.js'
import { cloneProject, closestEdgeFraction, edgeLength, getEdgeSeamAllowance, makeRectanglePiece, pieceArea, projectArea, seamLengthReport, seamWalkReport, touchProject, uniqueId } from './core/project.js'
import { pieceCenter } from './core/trims.js'
import { buildSizeRun, gradePointForPiece, gradeProject, sizeOffset } from './core/grading.js'
import { buildFabricMarkers, buildMarker } from './core/marker.js'
import { parseDxfPatterns, projectToDxf } from './core/dxf.js'
import { buildMeasurementSizeRun, buildTechPack, measurementRunToCSV } from './core/measurements.js'
import { buildFactoryPackageZip } from './core/factoryPackage.js'
import { listSimulationBackends } from './core/backends/registry.js'
import { garmentCodeToProject, projectToGarmentCode } from './core/garmentCode.js'

const STORAGE_KEY = 'garment-studio-project-v1'
const MAX_HISTORY = 60
const SIMULATION_BACKENDS = listSimulationBackends()

const SECTIONS = ['Pattern', 'Sewing', 'Fabric', 'Avatar', 'Fit', 'Production', 'Render']

function loadProject() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if ((parsed.version || 1) < 21) {
        parsed.version = 21
        parsed.pieces = (parsed.pieces || []).map((piece) => ({
          ...piece,
          arrangement3d: {
            ...piece.arrangement3d,
            y: (piece.arrangement3d?.y ?? 0) < 0.7 ? 0.98 : piece.arrangement3d.y,
            z: Math.sign(piece.arrangement3d?.z || 1) * Math.min(0.255, Math.abs(piece.arrangement3d?.z || 0.245)),
            flip: piece.id === 'back' ? false : Boolean(piece.arrangement3d?.flip),
            wrap: piece.id === 'front' ? 'front' : piece.id === 'back' ? 'back' : piece.arrangement3d?.wrap,
          },
        }))
        parsed.simulation = {
          ...parsed.simulation,
          backendId: parsed.simulation?.backendId || 'browser-pbd',
          autoFitTacks: parsed.simulation?.autoFitTacks !== false,
          substeps: Math.max(1, Math.min(4, Math.round(parsed.simulation?.substeps ?? 2))),
          resolution: Math.min(1, parsed.simulation?.resolution ?? 1),
          curveSegments: Math.max(2, Math.min(4, parsed.simulation?.curveSegments ?? 2)),
          collisions: parsed.simulation?.collisions !== false,
          selfCollision: parsed.simulation?.selfCollision !== false,
          selfCollisionMargin: parsed.simulation?.selfCollisionMargin ?? 0.002,
        }
        parsed.grading = {
          baseSize: parsed.grading?.baseSize || 'M',
          sizes: parsed.grading?.sizes?.length ? parsed.grading.sizes : ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
          widthPerSizeCm: parsed.grading?.widthPerSizeCm ?? 3,
          lengthPerSizeCm: parsed.grading?.lengthPerSizeCm ?? 1.2,
        }
        parsed.avatar = {
          ...parsed.avatar,
          armAngleDeg: parsed.avatar?.armAngleDeg ?? 6,
        }
        parsed.markerSettings = {
          fabricWidthCm: parsed.markerSettings?.fabricWidthCm ?? 150,
          gapCm: parsed.markerSettings?.gapCm ?? 1.5,
        }
        const defaults = createDefaultProject()
        const existingPieceIds = new Set((parsed.pieces || []).map((piece) => piece.id))
        for (const piece of defaults.pieces) {
          if (['sleeve-left', 'sleeve-right'].includes(piece.id) && !existingPieceIds.has(piece.id)) {
            parsed.pieces.push(cloneProject(piece))
          }
        }
        const existingSeamIds = new Set((parsed.seams || []).map((seam) => seam.id))
        for (const seam of defaults.seams) {
          if (seam.id.includes('sleeve-') && !existingSeamIds.has(seam.id)) parsed.seams.push(cloneProject(seam))
        }
        for (const defaultSeam of defaults.seams) {
          const currentSeam = parsed.seams.find((seam) => seam.id === defaultSeam.id)
          if (currentSeam && currentSeam.reverseB === undefined && defaultSeam.reverseB !== undefined) currentSeam.reverseB = defaultSeam.reverseB
        }
        for (const defaultPiece of defaults.pieces) {
          const currentPiece = parsed.pieces.find((piece) => piece.id === defaultPiece.id)
          if (currentPiece && !currentPiece.curves && defaultPiece.curves) currentPiece.curves = cloneProject(defaultPiece.curves)
          if (currentPiece && currentPiece.grainAngleDeg === undefined) currentPiece.grainAngleDeg = defaultPiece.grainAngleDeg ?? 0
          if (currentPiece && !currentPiece.notches?.length && defaultPiece.notches?.length) currentPiece.notches = cloneProject(defaultPiece.notches)
          if (currentPiece && !currentPiece.topstitches?.length && defaultPiece.topstitches?.length) currentPiece.topstitches = cloneProject(defaultPiece.topstitches)
          if (currentPiece && !currentPiece.bindings?.length && defaultPiece.bindings?.length) currentPiece.bindings = cloneProject(defaultPiece.bindings)
          if (currentPiece && currentPiece.simulationResolution === undefined && defaultPiece.simulationResolution !== undefined) currentPiece.simulationResolution = defaultPiece.simulationResolution
        }
        for (const piece of parsed.pieces || []) {
          if (piece.grainAngleDeg === undefined) piece.grainAngleDeg = 0
          piece.layerIndex = Math.max(0, Math.min(8, Math.round(piece.layerIndex || 0)))
          piece.notches = piece.notches || []
          piece.topstitches = piece.topstitches || []
          piece.bindings = piece.bindings || []
          piece.graphics = piece.graphics || []
          piece.zippers = piece.zippers || []
          piece.buttons = piece.buttons || []
          piece.buttonholes = piece.buttonholes || []
          piece.surfaceAttachments = piece.surfaceAttachments || []
          piece.cutQuantity = Math.max(1, Math.round(piece.cutQuantity || 1))
          piece.marker = piece.marker || { allowCrossGrain: false }
          piece.frozen3d = piece.frozen3d === true
          piece.active3d = piece.active3d !== false
        }
        parsed.fabrics = parsed.fabrics || { main: { ...FABRIC_PRESETS.fleece, id: 'main', name: 'Main Fabric' } }
        for (const [fabricId, fabricItem] of Object.entries(parsed.fabrics)) {
          fabricItem.id = fabricItem.id || fabricId
          fabricItem.name = fabricItem.name || (fabricId === 'main' ? 'Main Fabric' : fabricId)
        }
        const leftSleeve = parsed.pieces.find((piece) => piece.id === 'sleeve-left')
        const rightSleeve = parsed.pieces.find((piece) => piece.id === 'sleeve-right')
        if (leftSleeve?.arrangement3d) leftSleeve.arrangement3d.x = -0.285
        if (rightSleeve?.arrangement3d) rightSleeve.arrangement3d.x = 0.285
      }
      parsed.fasteners = parsed.fasteners || []
      parsed.customMeasurements = parsed.customMeasurements || []
      parsed.avatar = {
        ...createDefaultProject().avatar,
        ...(parsed.avatar || {}),
      }
      parsed.simulation = parsed.simulation || createDefaultProject().simulation
      parsed.simulation.wind = {
        enabled: Boolean(parsed.simulation.wind?.enabled),
        speed: parsed.simulation.wind?.speed ?? 4,
        directionDeg: parsed.simulation.wind?.directionDeg ?? 0,
        turbulence: parsed.simulation.wind?.turbulence ?? 0.18,
        response: parsed.simulation.wind?.response ?? 0.025,
      }
      return parsed
    }
  } catch (error) {
    console.warn('Could not restore garment project', error)
  }
  return createDefaultProject()
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)))
}

function splitPieceEdgeInProject(next, pieceId, edgeIndex, t = 0.5) {
  const piece = next.pieces.find((item) => item.id === pieceId)
  if (!piece || piece.points.length < 2) return null
  const count = piece.points.length
  const a = piece.points[edgeIndex]
  const b = piece.points[(edgeIndex + 1) % count]
  if (!a || !b) return null
  const safeT = Math.max(0.05, Math.min(0.95, t))
  const oldCurves = { ...(piece.curves || {}) }
  const oldEdgeAllowances = { ...(piece.edgeSeamAllowances || {}) }
  const curve = oldCurves[edgeIndex]
  let inserted
  let leftControl = null
  let rightControl = null
  if (curve) {
    const q0 = {
      x: a.x + (curve.cx - a.x) * safeT,
      y: a.y + (curve.cy - a.y) * safeT,
    }
    const q1 = {
      x: curve.cx + (b.x - curve.cx) * safeT,
      y: curve.cy + (b.y - curve.cy) * safeT,
    }
    inserted = {
      x: q0.x + (q1.x - q0.x) * safeT,
      y: q0.y + (q1.y - q0.y) * safeT,
    }
    leftControl = { cx: q0.x, cy: q0.y }
    rightControl = { cx: q1.x, cy: q1.y }
  } else {
    inserted = {
      x: a.x + (b.x - a.x) * safeT,
      y: a.y + (b.y - a.y) * safeT,
    }
  }
  if (a.gradeRule?.enabled && b.gradeRule?.enabled) {
    inserted.gradeRule = {
      enabled: true,
      dxPerSize: Number(a.gradeRule.dxPerSize || 0) + (Number(b.gradeRule.dxPerSize || 0) - Number(a.gradeRule.dxPerSize || 0)) * safeT,
      dyPerSize: Number(a.gradeRule.dyPerSize || 0) + (Number(b.gradeRule.dyPerSize || 0) - Number(a.gradeRule.dyPerSize || 0)) * safeT,
    }
  }

  const splitArcFraction = closestEdgeFraction(piece, edgeIndex, inserted, 64)
  piece.points.splice(edgeIndex + 1, 0, inserted)

  const nextCurves = {}
  for (const [rawIndex, value] of Object.entries(oldCurves)) {
    const index = Number(rawIndex)
    if (index === edgeIndex) continue
    nextCurves[index > edgeIndex ? index + 1 : index] = value
  }
  if (leftControl) nextCurves[edgeIndex] = leftControl
  if (rightControl) nextCurves[edgeIndex + 1] = rightControl
  piece.curves = nextCurves
  const nextEdgeAllowances = {}
  for (const [rawIndex, value] of Object.entries(oldEdgeAllowances)) {
    const index = Number(rawIndex)
    if (index < edgeIndex) nextEdgeAllowances[index] = value
    else if (index > edgeIndex) nextEdgeAllowances[index + 1] = value
    else {
      nextEdgeAllowances[edgeIndex] = value
      nextEdgeAllowances[edgeIndex + 1] = value
    }
  }
  piece.edgeSeamAllowances = nextEdgeAllowances

  piece.notches = (piece.notches || []).map((notch) => {
    if (notch.edgeIndex < edgeIndex) return notch
    if (notch.edgeIndex > edgeIndex) return { ...notch, edgeIndex: notch.edgeIndex + 1 }
    const notchT = Math.max(0, Math.min(1, notch.t ?? 0.5))
    if (notchT <= splitArcFraction) return { ...notch, t: splitArcFraction > 0 ? notchT / splitArcFraction : 0 }
    return {
      ...notch,
      edgeIndex: edgeIndex + 1,
      t: (notchT - splitArcFraction) / Math.max(0.001, 1 - splitArcFraction),
    }
  })

  for (const collection of ['topstitches', 'bindings', 'zippers']) {
    const remapped = []
    for (const item of piece[collection] || []) {
      if (item.edgeIndex < edgeIndex) remapped.push(item)
      else if (item.edgeIndex > edgeIndex) remapped.push({ ...item, edgeIndex: item.edgeIndex + 1 })
      else {
        remapped.push({ ...item, edgeIndex })
        remapped.push({ ...item, id: uniqueId(`${collection}-split`), edgeIndex: edgeIndex + 1 })
      }
    }
    piece[collection] = remapped
  }

  const endpointRange = (endpoint) => {
    let start = clamp(Number(endpoint?.startT ?? 0), 0, 1)
    let end = clamp(Number(endpoint?.endT ?? 1), 0, 1)
    if (start > end) [start, end] = [end, start]
    return { start, end }
  }
  const rangedEndpoint = (endpoint, nextEdgeIndex, start, end) => {
    const result = { ...endpoint, edgeIndex: nextEdgeIndex }
    if (start <= 0.0001 && end >= 0.9999) {
      delete result.startT
      delete result.endT
    } else {
      result.startT = clamp(start, 0, 1)
      result.endT = clamp(end, 0, 1)
    }
    return result
  }
  const shiftedEndpoint = (endpoint) => (
    endpoint.pieceId === pieceId && endpoint.edgeIndex > edgeIndex
      ? { ...endpoint, edgeIndex: endpoint.edgeIndex + 1 }
      : { ...endpoint }
  )
  const splitLocalEndpoint = (endpoint) => {
    const { start, end } = endpointRange(endpoint)
    const split = splitArcFraction
    if (end <= split + 1e-6) {
      return { single: rangedEndpoint(endpoint, edgeIndex, start / Math.max(split, 1e-6), end / Math.max(split, 1e-6)) }
    }
    if (start >= split - 1e-6) {
      const denominator = Math.max(1e-6, 1 - split)
      return { single: rangedEndpoint(endpoint, edgeIndex + 1, (start - split) / denominator, (end - split) / denominator) }
    }
    const progress = (split - start) / Math.max(1e-6, end - start)
    return {
      progress: clamp(progress, 0, 1),
      low: rangedEndpoint(endpoint, edgeIndex, start / Math.max(split, 1e-6), 1),
      high: rangedEndpoint(endpoint, edgeIndex + 1, 0, (end - split) / Math.max(1e-6, 1 - split)),
    }
  }

  const remappedSeams = []
  const splitSeamGroups = new Map()
  for (const sourceSeam of next.seams || []) {
    const seam = cloneProject(sourceSeam)
    const aMatches = seam.a?.pieceId === pieceId && seam.a?.edgeIndex === edgeIndex
    const bMatches = seam.b?.pieceId === pieceId && seam.b?.edgeIndex === edgeIndex
    if (!aMatches && !bMatches) {
      seam.a = shiftedEndpoint(seam.a)
      seam.b = shiftedEndpoint(seam.b)
      remappedSeams.push(seam)
      continue
    }
    // Sewing one edge to itself is not a normal garment construction case;
    // keep it deterministic by remapping each endpoint independently rather
    // than multiplying the seam graph combinatorially.
    if (aMatches && bMatches) {
      const aSplit = splitLocalEndpoint(seam.a)
      const bSplit = splitLocalEndpoint(seam.b)
      seam.a = aSplit.single || aSplit.low
      seam.b = bSplit.single || bSplit.low
      remappedSeams.push(seam)
      continue
    }

    const side = aMatches ? 'a' : 'b'
    const otherSide = aMatches ? 'b' : 'a'
    const local = splitLocalEndpoint(seam[side])
    seam[otherSide] = shiftedEndpoint(seam[otherSide])
    if (local.single) {
      seam[side] = local.single
      remappedSeams.push(seam)
      continue
    }

    const other = seam[otherSide]
    const otherRange = endpointRange(other)
    const reverse = Boolean(seam.reverseB)
    const splitProgress = local.progress
    let firstOther
    let secondOther
    if (side === 'a') {
      const splitOther = reverse
        ? otherRange.end - (otherRange.end - otherRange.start) * splitProgress
        : otherRange.start + (otherRange.end - otherRange.start) * splitProgress
      firstOther = reverse
        ? rangedEndpoint(other, other.edgeIndex, splitOther, otherRange.end)
        : rangedEndpoint(other, other.edgeIndex, otherRange.start, splitOther)
      secondOther = reverse
        ? rangedEndpoint(other, other.edgeIndex, otherRange.start, splitOther)
        : rangedEndpoint(other, other.edgeIndex, splitOther, otherRange.end)
      seam.a = local.low
      seam.b = firstOther
      const second = { ...cloneProject(seam), id: uniqueId('seam-split'), name: `${sourceSeam.name || sourceSeam.id} · 2`, a: local.high, b: secondOther }
      remappedSeams.push(seam, second)
      splitSeamGroups.set(sourceSeam.id, [seam.id, second.id])
    } else {
      const progressAlongA = reverse ? 1 - splitProgress : splitProgress
      const safeProgress = clamp(progressAlongA, 0, 1)
      const splitOther = otherRange.start + (otherRange.end - otherRange.start) * safeProgress
      firstOther = rangedEndpoint(other, other.edgeIndex, otherRange.start, splitOther)
      secondOther = rangedEndpoint(other, other.edgeIndex, splitOther, otherRange.end)
      seam.a = firstOther
      seam.b = reverse ? local.high : local.low
      const second = { ...cloneProject(seam), id: uniqueId('seam-split'), name: `${sourceSeam.name || sourceSeam.id} · 2`, a: secondOther, b: reverse ? local.low : local.high }
      remappedSeams.push(seam, second)
      splitSeamGroups.set(sourceSeam.id, [seam.id, second.id])
    }
  }
  next.seams = remappedSeams

  if (splitSeamGroups.size) {
    const endpointContainsNotch = (endpoint, notchPieceId, notchEdgeIndex, notchT) => {
      if (!endpoint || endpoint.pieceId !== notchPieceId || endpoint.edgeIndex !== notchEdgeIndex) return false
      const { start, end } = endpointRange(endpoint)
      const tValue = clamp(Number(notchT ?? 0.5), 0, 1)
      return tValue >= start - 0.002 && tValue <= end + 0.002
    }
    const groups = new Map()
    for (const pattern of next.pieces || []) {
      for (const notch of pattern.notches || []) {
        if (!notch.matchGroupId || !notch.matchedSeamId || !splitSeamGroups.has(notch.matchedSeamId)) continue
        if (!groups.has(notch.matchGroupId)) groups.set(notch.matchGroupId, [])
        groups.get(notch.matchGroupId).push({ pattern, notch })
      }
    }
    for (const entries of groups.values()) {
      const sourceSeamId = entries[0]?.notch?.matchedSeamId
      const candidateIds = splitSeamGroups.get(sourceSeamId) || []
      const candidate = candidateIds
        .map((candidateId) => next.seams.find((item) => item.id === candidateId))
        .find((candidateSeam) => candidateSeam && entries.every(({ pattern, notch }) => (
          endpointContainsNotch(candidateSeam.a, pattern.id, notch.edgeIndex, notch.t) ||
          endpointContainsNotch(candidateSeam.b, pattern.id, notch.edgeIndex, notch.t)
        )))
      if (!candidate) continue
      for (const { notch } of entries) notch.matchedSeamId = candidate.id
    }
  }

  return { inserted, splitArcFraction }
}

function NumberField({ value, onChange, min, max, step = 1, suffix }) {
  return (
    <label className="number-field">
      <input
        type="number"
        value={Number(value).toFixed(step < 1 ? 2 : 0).replace(/\.00$/, '')}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {suffix && <span>{suffix}</span>}
    </label>
  )
}

function SliderRow({ label, value, min, max, step, onChange, display }) {
  return (
    <div className="control-row slider-row">
      <div className="control-label"><span>{label}</span><strong>{display ?? value}</strong></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  )
}

function MiniStat({ label, value }) {
  return <div className="mini-stat"><span>{label}</span><strong>{value}</strong></div>
}

function mirroredEdgeIndex(edgeIndex, edgeCount) {
  return (edgeCount - 2 - Number(edgeIndex) + edgeCount) % edgeCount
}

function seamRange(endpoint) {
  let start = clamp(Number(endpoint?.startT ?? 0), 0, 1)
  let end = clamp(Number(endpoint?.endT ?? 1), 0, 1)
  if (start > end) [start, end] = [end, start]
  return { start, end, span: Math.max(1e-6, end - start) }
}

function seamFractionAtProgress(seam, side, progress) {
  const q = clamp(progress, 0, 1)
  const range = seamRange(seam?.[side])
  if (side === 'b' && seam?.reverseB) return range.end - range.span * q
  return range.start + range.span * q
}

function mapFractionAcrossSeam(seam, fromSide, fraction) {
  const sourceRange = seamRange(seam?.[fromSide])
  const naturalProgress = clamp((Number(fraction) - sourceRange.start) / sourceRange.span, 0, 1)
  const seamProgress = fromSide === 'b' && seam?.reverseB ? 1 - naturalProgress : naturalProgress
  const targetSide = fromSide === 'a' ? 'b' : 'a'
  return seamFractionAtProgress(seam, targetSide, seamProgress)
}

function buildLinkedMirror(source, target) {
  if (!source?.points?.length || !target) return target
  const xs = source.points.map((point) => point.x)
  const centerX = (Math.min(...xs) + Math.max(...xs)) * 0.5
  const edgeCount = source.points.length
  const mirrorPoint = (point) => ({ ...point, x: centerX - (point.x - centerX) })
  const keep = {
    id: target.id,
    name: target.name,
    layout2d: cloneProject(target.layout2d),
    arrangement3d: cloneProject(target.arrangement3d),
    linkedMirrorSourceId: source.id,
  }
  const next = cloneProject(source)
  Object.assign(next, keep)
  next.points = source.points.map(mirrorPoint).reverse()
  next.curves = source.curves
    ? Object.fromEntries(Object.entries(source.curves).map(([edgeIndex, curve]) => [
      mirroredEdgeIndex(edgeIndex, edgeCount),
      { cx: centerX - (curve.cx - centerX), cy: curve.cy },
    ]))
    : undefined
  next.internalLines = (source.internalLines || []).map((line) => ({
    ...cloneProject(line),
    id: `${target.id}-${line.id}`,
    a: mirrorPoint(line.a),
    b: mirrorPoint(line.b),
  }))
  next.pins = (source.pins || []).map((pin) => ({ ...cloneProject(pin), id: `${target.id}-${pin.id}`, x: centerX - (pin.x - centerX) }))
  next.buttons = (source.buttons || []).map((button) => ({ ...cloneProject(button), id: `${target.id}-${button.id}`, x: centerX - (button.x - centerX) }))
  next.buttonholes = (source.buttonholes || []).map((buttonhole) => ({
    ...cloneProject(buttonhole),
    id: `${target.id}-${buttonhole.id}`,
    x: centerX - (buttonhole.x - centerX),
    orientationDeg: -(buttonhole.orientationDeg || 0),
  }))
  next.graphics = (source.graphics || []).map((graphic) => ({
    ...cloneProject(graphic),
    id: `${target.id}-${graphic.id}`,
    x: centerX - (graphic.x - centerX),
    rotationDeg: -(graphic.rotationDeg || 0),
  }))
  next.notches = (source.notches || []).map((notch) => ({
    ...cloneProject(notch),
    id: `${target.id}-${notch.id}`,
    edgeIndex: mirroredEdgeIndex(notch.edgeIndex, edgeCount),
    t: 1 - (notch.t ?? 0.5),
  }))
  for (const collection of ['topstitches', 'bindings', 'zippers']) {
    next[collection] = (source[collection] || []).map((item) => ({
      ...cloneProject(item),
      id: `${target.id}-${item.id}`,
      edgeIndex: mirroredEdgeIndex(item.edgeIndex, edgeCount),
    }))
  }
  next.grainAngleDeg = -(source.grainAngleDeg || 0)
  return next
}

function syncLinkedMirrors(project) {
  const pieces = project.pieces || []
  const sources = new Map(pieces.map((piece) => [piece.id, piece]))
  project.pieces = pieces.map((piece) => {
    if (!piece.linkedMirrorSourceId) return piece
    const source = sources.get(piece.linkedMirrorSourceId)
    return source ? buildLinkedMirror(source, piece) : { ...piece, linkedMirrorSourceId: undefined }
  })
}

function imageFileToDataUrl(file, maxDimension = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read image file'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('Unsupported image file'))
      image.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
        const width = Math.max(1, Math.round(image.naturalWidth * scale))
        const height = Math.max(1, Math.round(image.naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        context.clearRect(0, 0, width, height)
        context.drawImage(image, 0, 0, width, height)
        resolve({
          src: canvas.toDataURL('image/png'),
          sourceWidth: image.naturalWidth,
          sourceHeight: image.naturalHeight,
        })
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function App() {
  const [project, setProject] = useState(loadProject)
  const [selectedPieceId, setSelectedPieceId] = useState('front')
  const [activeSection, setActiveSection] = useState('Pattern')
  const [tool, setTool] = useState('select')
  const [running, setRunning] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [analysisMode, setAnalysisMode] = useState('surface')
  const [selectedFabricId, setSelectedFabricId] = useState('main')
  const [markerFabricId, setMarkerFabricId] = useState('main')
  const [seamWalkId, setSeamWalkId] = useState(null)
  const [seamWalkProgress, setSeamWalkProgress] = useState(0.5)
  const [trimEdgeIndex, setTrimEdgeIndex] = useState(0)
  const [gradePreviewSize, setGradePreviewSize] = useState('M')
  const [showGradeNest, setShowGradeNest] = useState(false)
  const [meshExportSignal, setMeshExportSignal] = useState(0)
  const [glbExportSignal, setGlbExportSignal] = useState(0)
  const [renderSignal, setRenderSignal] = useState(0)
  const [hdriUrl, setHdriUrl] = useState('')
  const [hdriName, setHdriName] = useState('')
  const [resetSignal, setResetSignal] = useState(0)
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const [saveState, setSaveState] = useState('saved')
  const [stats, setStats] = useState({ vertices: 0, constraints: 0, seams: 0, fasteners: 0, treatments: 0, trims: 0, anchors: 0, manualPins: 0, internal: 0, elapsed: 0, averageStrain: 0, maxStrain: 0, averageEaseCm: 0, averagePressureIndex: 0, maxPressureIndex: 0, contactRatio: 0, tightRatio: 0, looseRatio: 0 })
  const [command, setCommand] = useState('')
  const [commandResult, setCommandResult] = useState('Ready for garment commands')
  const [transformDraft, setTransformDraft] = useState({ scaleX: 100, scaleY: 100, rotateDeg: 0, slashCm: 4 })
  const importInputRef = useRef(null)
  const graphicInputRef = useRef(null)
  const fabricTextureInputRef = useRef(null)
  const fabricNormalInputRef = useRef(null)
  const fabricRoughnessInputRef = useRef(null)
  const hdriInputRef = useRef(null)

  const applyGarmentTemplate = (templateId) => {
    const next = createTemplateProject(templateId)
    pushUndo(cloneProject(project))
    setProject(next)
    setSelectedPieceId(next.pieces[0]?.id || null)
    setSelectedFabricId(Object.keys(next.fabrics || {})[0] || 'main')
    setMarkerFabricId(Object.keys(next.fabrics || {})[0] || 'main')
    setSeamWalkId(null)
    setSeamWalkProgress(0.5)
    setGradePreviewSize(next.grading?.baseSize || 'M')
    setTool('select')
    setRunning(false)
    setAnalysisMode('surface')
    setResetSignal((signal) => signal + 1)
    setCommandResult(`Loaded ${next.name} foundation with ${next.pieces.length} pattern${next.pieces.length === 1 ? '' : 's'} and ${next.seams.length} sewing relationship${next.seams.length === 1 ? '' : 's'}`)
  }
  const gestureStartRef = useRef(null)

  const selectedPiece = project.pieces.find((piece) => piece.id === selectedPieceId) || null
  const fabric = project.fabrics?.[selectedFabricId] || project.fabrics?.main || FABRIC_PRESETS.fleece
  const totalArea = useMemo(() => projectArea(project), [project])
  const selectedArea = selectedPiece ? pieceArea(selectedPiece) : 0
  const productionProject = useMemo(
    () => gradeProject(project, gradePreviewSize || project.grading?.baseSize || 'M'),
    [project, gradePreviewSize],
  )
  const displayProject = activeSection === 'Production' ? productionProject : project
  const gradeNestProjects = useMemo(() => {
    if (activeSection !== 'Production' || !showGradeNest) return []
    return (project.grading?.sizes || []).map((size) => gradeProject(project, size))
  }, [activeSection, showGradeNest, project])
  const fabricMarkers = useMemo(() => buildFabricMarkers(
    productionProject,
    productionProject.markerSettings?.fabricWidthCm ?? 150,
    productionProject.markerSettings?.gapCm ?? 1.5,
  ), [productionProject])
  const markerFabricIds = Object.keys(fabricMarkers)
  const marker = fabricMarkers[markerFabricId] || fabricMarkers[markerFabricIds[0]] || buildMarker(
    productionProject,
    productionProject.markerSettings?.fabricWidthCm ?? 150,
    productionProject.markerSettings?.gapCm ?? 1.5,
  )
  const measurementRun = useMemo(() => buildMeasurementSizeRun(project), [project])
  const productionMeasurements = measurementRun[gradePreviewSize] || []
  const seamWalk = useMemo(() => {
    if (!seamWalkId) return null
    const seam = project.seams.find((item) => item.id === seamWalkId)
    return seam ? seamWalkReport(project, seam, 33) : null
  }, [project, seamWalkId])
  const productionFabricArea = useMemo(() => (productionProject.pieces || [])
    .filter((piece) => (piece.fabricId || 'main') === (marker.fabricId || markerFabricId))
    .reduce((sum, piece) => sum + pieceArea(piece) * Math.max(1, Math.round(Number(piece.cutQuantity || 1))), 0), [productionProject, marker.fabricId, markerFabricId])

  useEffect(() => {
    if (!markerFabricIds.length) return
    if (!fabricMarkers[markerFabricId]) setMarkerFabricId(markerFabricIds[0])
  }, [markerFabricId, markerFabricIds.join('|')])

  useEffect(() => {
    const edgeCount = selectedPiece?.points?.length || 0
    setTrimEdgeIndex((value) => edgeCount ? Math.max(0, Math.min(edgeCount - 1, value)) : 0)
  }, [selectedPieceId, selectedPiece?.points?.length])

  const pushUndo = (snapshot) => {
    setUndoStack((stack) => [...stack, snapshot].slice(-MAX_HISTORY))
    setRedoStack([])
  }

  const mutateProject = (mutator, { record = true } = {}) => {
    const before = cloneProject(project)
    const next = cloneProject(project)
    mutator(next)
    syncLinkedMirrors(next)
    touchProject(next)
    if (record) pushUndo(before)
    setProject(next)
    setSaveState('modified')
  }

  const beginGesture = () => {
    if (!gestureStartRef.current) gestureStartRef.current = cloneProject(project)
  }

  const endGesture = () => {
    if (!gestureStartRef.current) return
    pushUndo(gestureStartRef.current)
    gestureStartRef.current = null
  }

  const undo = () => {
    if (!undoStack.length) return
    const previous = undoStack[undoStack.length - 1]
    setRedoStack((stack) => [...stack, cloneProject(project)].slice(-MAX_HISTORY))
    setUndoStack((stack) => stack.slice(0, -1))
    setProject(previous)
    setSaveState('modified')
  }

  const redo = () => {
    if (!redoStack.length) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((stack) => [...stack, cloneProject(project)].slice(-MAX_HISTORY))
    setRedoStack((stack) => stack.slice(0, -1))
    setProject(next)
    setSaveState('modified')
  }

  const saveProject = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    setSaveState('saved')
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
        setSaveState('saved')
      } catch (error) {
        console.warn('Autosave failed', error)
      }
    }, 550)
    return () => window.clearTimeout(timer)
  }, [project])

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
      if (event.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        event.preventDefault()
        setRunning((value) => !value)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const movePiece = (pieceId, layout2d) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (piece) piece.layout2d = layout2d
    }, { record: false })
  }

  const movePoint = (pieceId, pointIndex, point) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (piece?.points?.[pointIndex]) piece.points[pointIndex] = point
    }, { record: false })
  }

  const moveCurve = (pieceId, edgeIndex, curve) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.curves = { ...(piece.curves || {}) }
      if (curve) piece.curves[edgeIndex] = curve
      else delete piece.curves[edgeIndex]
    }, { record: false })
  }

  useEffect(() => {
    setTransformDraft({ scaleX: 100, scaleY: 100, rotateDeg: 0, slashCm: 4 })
  }, [selectedPieceId])

  const transformPieceGeometry = (piece, mapPoint) => {
    piece.points = piece.points.map((point) => mapPoint(point))
    if (piece.curves) {
      piece.curves = Object.fromEntries(Object.entries(piece.curves).map(([edgeIndex, curve]) => {
        const transformed = mapPoint({ x: curve.cx, y: curve.cy })
        return [edgeIndex, { cx: transformed.x, cy: transformed.y }]
      }))
    }
    piece.internalLines = (piece.internalLines || []).map((line) => ({
      ...line,
      a: mapPoint(line.a),
      b: mapPoint(line.b),
    }))
    piece.pins = (piece.pins || []).map((pin) => ({ ...pin, ...mapPoint(pin) }))
  }

  const applyPatternTransform = () => {
    if (!selectedPiece) return
    const sx = clamp(transformDraft.scaleX, 10, 300) / 100
    const sy = clamp(transformDraft.scaleY, 10, 300) / 100
    const rotation = clamp(transformDraft.rotateDeg, -180, 180) * Math.PI / 180
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (!piece) return
      const center = {
        x: piece.points.reduce((sum, point) => sum + point.x, 0) / piece.points.length,
        y: piece.points.reduce((sum, point) => sum + point.y, 0) / piece.points.length,
      }
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      transformPieceGeometry(piece, (point) => {
        const x = (point.x - center.x) * sx
        const y = (point.y - center.y) * sy
        return {
          x: center.x + x * cos - y * sin,
          y: center.y + x * sin + y * cos,
        }
      })
      piece.grainAngleDeg = (piece.grainAngleDeg || 0) + clamp(transformDraft.rotateDeg, -180, 180)
    })
    setTransformDraft((current) => ({ ...current, scaleX: 100, scaleY: 100, rotateDeg: 0 }))
    setCommandResult('Applied precise scale/rotation to outline, curves, internal geometry, and grain direction.')
  }

  const applySlashSpread = () => {
    if (!selectedPiece) return
    const amount = clamp(transformDraft.slashCm, -20, 30)
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (!piece) return
      const xs = piece.points.map((point) => point.x)
      const ys = piece.points.map((point) => point.y)
      const centerX = (Math.min(...xs) + Math.max(...xs)) * 0.5
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const height = Math.max(1, maxY - minY)
      transformPieceGeometry(piece, (point) => {
        const hemInfluence = 1 - Math.max(0, Math.min(1, (point.y - minY) / height))
        const side = Math.sign(point.x - centerX)
        return {
          x: point.x + side * amount * 0.5 * hemInfluence,
          y: point.y,
        }
      })
    })
    setCommandResult(`Applied ${amount.toFixed(1)} cm slash/spread change at the hem while holding the top edge.`)
  }

  const edgeIsSewn = (pieceId, edgeIndex) => project.seams.some((seam) => (
    (seam.a.pieceId === pieceId && seam.a.edgeIndex === edgeIndex)
    || (seam.b.pieceId === pieceId && seam.b.edgeIndex === edgeIndex)
  ))

  const splitPatternEdge = (pieceId, edgeIndex, t = 0.5) => {
    mutateProject((next) => {
      splitPieceEdgeInProject(next, pieceId, edgeIndex, t)
    })
    setCommandResult(edgeIsSewn(pieceId, edgeIndex)
      ? 'Sewn pattern edge split; seam ranges were remapped across the new topology.'
      : 'Pattern edge split with a new editable anchor point.')
  }

  const deletePatternPoint = (pieceId, pointIndex) => {
    const piece = project.pieces.find((item) => item.id === pieceId)
    if (!piece || piece.points.length <= 3) {
      setCommandResult('A closed pattern needs at least three points.')
      return
    }
    const count = piece.points.length
    const previousEdge = (pointIndex - 1 + count) % count
    const currentEdge = pointIndex
    if (edgeIsSewn(pieceId, previousEdge) || edgeIsSewn(pieceId, currentEdge)) {
      setCommandResult('Unsew the adjacent edge before deleting this point.')
      return
    }
    if ((piece.notches || []).some((notch) => notch.edgeIndex === previousEdge || notch.edgeIndex === currentEdge)) {
      setCommandResult('Move or remove the notch on an adjacent edge before deleting this point.')
      return
    }

    mutateProject((next) => {
      const target = next.pieces.find((item) => item.id === pieceId)
      if (!target || target.points.length <= 3) return
      const oldCount = target.points.length
      const oldCurves = { ...(target.curves || {}) }
      const oldEdgeAllowances = { ...(target.edgeSeamAllowances || {}) }
      const oldPreviousEdge = (pointIndex - 1 + oldCount) % oldCount
      const oldCurrentEdge = pointIndex
      const mergedAllowance = Math.max(
        getEdgeSeamAllowance(target, oldPreviousEdge),
        getEdgeSeamAllowance(target, oldCurrentEdge),
      )
      target.points.splice(pointIndex, 1)
      const nextCurves = {}
      for (const [rawIndex, value] of Object.entries(oldCurves)) {
        const index = Number(rawIndex)
        if (pointIndex === 0) {
          if (index === 0 || index === oldCount - 1) continue
          nextCurves[index - 1] = value
        } else {
          if (index === pointIndex - 1 || index === pointIndex) continue
          nextCurves[index > pointIndex ? index - 1 : index] = value
        }
      }
      target.curves = nextCurves
      const nextEdgeAllowances = {}
      const mergedEdgeIndex = pointIndex === 0 ? oldCount - 2 : pointIndex - 1
      for (const [rawIndex, value] of Object.entries(oldEdgeAllowances)) {
        const index = Number(rawIndex)
        if (index === oldPreviousEdge || index === oldCurrentEdge) continue
        if (pointIndex === 0) {
          if (index > 0 && index < oldCount - 1) nextEdgeAllowances[index - 1] = value
        } else {
          nextEdgeAllowances[index > pointIndex ? index - 1 : index] = value
        }
      }
      if (Math.abs(mergedAllowance - Number(target.seamAllowance || 0)) > 1e-6) nextEdgeAllowances[mergedEdgeIndex] = mergedAllowance
      target.edgeSeamAllowances = nextEdgeAllowances

      for (const seam of next.seams) {
        for (const endpoint of [seam.a, seam.b]) {
          if (endpoint.pieceId !== pieceId) continue
          if (pointIndex === 0 && endpoint.edgeIndex > 0) endpoint.edgeIndex -= 1
          else if (pointIndex > 0 && endpoint.edgeIndex > pointIndex) endpoint.edgeIndex -= 1
        }
      }
      target.notches = (target.notches || []).map((notch) => {
        if (pointIndex === 0) return { ...notch, edgeIndex: notch.edgeIndex > 0 ? notch.edgeIndex - 1 : notch.edgeIndex }
        return { ...notch, edgeIndex: notch.edgeIndex > pointIndex ? notch.edgeIndex - 1 : notch.edgeIndex }
      })
    })
    setCommandResult('Pattern point removed and edge indices repaired.')
  }

  const createInternalLine = (pieceId, line) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.internalLines = piece.internalLines || []
      piece.internalLines.push({
        id: uniqueId('internal'),
        name: `Internal ${piece.internalLines.length + 1}`,
        type: 'construction',
        widthCm: 2.5,
        ...line,
      })
    }, { record: false })
  }

  const updateInternalLine = (pieceId, lineId, field, value) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      const line = piece?.internalLines?.find((item) => item.id === lineId)
      if (line) line[field] = value
    })
  }

  const removeInternalLine = (pieceId, lineId) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (piece) piece.internalLines = (piece.internalLines || []).filter((line) => line.id !== lineId)
    })
  }

  const createPin = (pieceId, point) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.pins = piece.pins || []
      piece.pins.push({ id: uniqueId('pin'), x: point.x, y: point.y, stiffness: 1 })
    })
    setCommandResult('Manual cloth pin added. It will hold this location during simulation.')
  }

  const removePin = (pieceId, pinId) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (piece) piece.pins = (piece.pins || []).filter((pin) => pin.id !== pinId)
    })
    setCommandResult('Manual cloth pin removed.')
  }

  const createSeam = (a, b) => {
    const duplicate = project.seams.some((seam) => {
      const straight = seam.a.pieceId === a.pieceId && seam.a.edgeIndex === a.edgeIndex && seam.b.pieceId === b.pieceId && seam.b.edgeIndex === b.edgeIndex
      const reverse = seam.a.pieceId === b.pieceId && seam.a.edgeIndex === b.edgeIndex && seam.b.pieceId === a.pieceId && seam.b.edgeIndex === a.edgeIndex
      return straight || reverse
    })
    if (duplicate) {
      setCommandResult('Those two edges are already sewn')
      return
    }
    mutateProject((next) => {
      next.seams.push({
        id: uniqueId('seam'),
        name: `Seam ${next.seams.length + 1}`,
        a,
        b,
      })
    })
    setCommandResult('Seam created and added to the 3D solver')
  }

  const createFastener = (a, b) => {
    if (!a || !b) return
    mutateProject((next) => {
      next.fasteners = next.fasteners || []
      next.fasteners.push({
        id: uniqueId('fastener'),
        name: `Fastener ${next.fasteners.length + 1}`,
        type: 'button',
        a,
        b,
        closed: true,
        diameterCm: 1.8,
      })
    })
    setCommandResult('Fastener pair created. Configure button, snap, or hook and its open/closed state in Sewing.')
  }

  const updateFastener = (fastenerId, field, value) => {
    mutateProject((next) => {
      const fastener = (next.fasteners || []).find((item) => item.id === fastenerId)
      if (fastener) fastener[field] = value
    })
  }

  const removeFastener = (fastenerId) => {
    mutateProject((next) => {
      next.fasteners = (next.fasteners || []).filter((item) => item.id !== fastenerId)
    })
  }

  const createCustomMeasurement = (a, b) => {
    if (!a || !b || a.pieceId !== b.pieceId) {
      setCommandResult('Tape measurements must use two points on the same pattern piece')
      return
    }
    const id = uniqueId('measure')
    mutateProject((next) => {
      next.customMeasurements = next.customMeasurements || []
      next.customMeasurements.push({
        id,
        pieceId: a.pieceId,
        label: `Custom measure ${next.customMeasurements.length + 1}`,
        a: { x: a.x, y: a.y },
        b: { x: b.x, y: b.y },
        toleranceCm: 0.5,
      })
    })
    setCommandResult(`Added ${(Math.hypot(b.x - a.x, b.y - a.y)).toFixed(1)} cm tape measurement`)
  }

  const updateCustomMeasurement = (measurementId, field, value) => {
    mutateProject((next) => {
      const measurement = (next.customMeasurements || []).find((item) => item.id === measurementId)
      if (measurement) measurement[field] = value
    })
  }

  const removeCustomMeasurement = (measurementId) => {
    mutateProject((next) => {
      next.customMeasurements = (next.customMeasurements || []).filter((item) => item.id !== measurementId)
    })
  }

  const addPiece = () => {
    const piece = makeRectanglePiece(project.pieces.length)
    mutateProject((next) => next.pieces.push(piece))
    setSelectedPieceId(piece.id)
    setTool('point')
  }

  const deleteSelectedPiece = () => {
    if (!selectedPiece) return
    mutateProject((next) => {
      const ids = new Set([selectedPiece.id])
      for (const piece of next.pieces) {
        if (piece.liningForPieceId === selectedPiece.id || piece.interfacingForPieceId === selectedPiece.id) ids.add(piece.id)
      }
      next.pieces = next.pieces.filter((piece) => !ids.has(piece.id))
      next.seams = next.seams.filter((seam) => !ids.has(seam.a?.pieceId) && !ids.has(seam.b?.pieceId))
      next.fasteners = (next.fasteners || []).filter((fastener) => !ids.has(fastener.a?.pieceId) && !ids.has(fastener.b?.pieceId))
      next.customMeasurements = (next.customMeasurements || []).filter((measurement) => !ids.has(measurement.pieceId))
      for (const piece of next.pieces) {
        if (ids.has(piece.fusedToPieceId)) {
          delete piece.fusedToPieceId
          delete piece.interfacingForPieceId
        }
        if (ids.has(piece.liningForPieceId)) delete piece.liningForPieceId
      }
    })
    setSelectedPieceId(null)
  }

  const removeSeam = (seamId) => {
    mutateProject((next) => {
      next.seams = next.seams.filter((seam) => seam.id !== seamId)
    })
  }

  const updateSeam = (seamId, field, value) => {
    mutateProject((next) => {
      const seam = next.seams.find((item) => item.id === seamId)
      if (!seam) return
      seam[field] = value
      if (field === 'type' && value === 'gather' && seam.ratio === undefined) seam.ratio = 0.7
      if (field === 'type' && value === 'elastic' && seam.ratio === undefined) seam.ratio = 0.85
      if (field === 'type' && value === 'ease' && seam.ratio === undefined) seam.ratio = 0.96
    })
  }

  const setSeamPartial = (seamId, enabled) => {
    mutateProject((next) => {
      const seam = next.seams.find((item) => item.id === seamId)
      if (!seam) return
      if (enabled) {
        seam.a = { ...seam.a, startT: seam.a?.startT ?? 0.25, endT: seam.a?.endT ?? 0.75 }
        seam.b = { ...seam.b, startT: seam.b?.startT ?? 0.25, endT: seam.b?.endT ?? 0.75 }
      } else {
        seam.a = { ...seam.a }
        seam.b = { ...seam.b }
        delete seam.a.startT
        delete seam.a.endT
        delete seam.b.startT
        delete seam.b.endT
      }
    })
  }

  const updateSeamRange = (seamId, side, field, value) => {
    mutateProject((next) => {
      const seam = next.seams.find((item) => item.id === seamId)
      const endpoint = seam?.[side]
      if (!endpoint) return
      const nextValue = clamp(Number(value), 0, 1)
      const minimumGap = 0.02
      if (field === 'startT') endpoint.startT = Math.min(nextValue, Number(endpoint.endT ?? 1) - minimumGap)
      if (field === 'endT') endpoint.endT = Math.max(nextValue, Number(endpoint.startT ?? 0) + minimumGap)
    })
  }

  const autoEaseSeam = (seamId) => {
    const seam = project.seams.find((item) => item.id === seamId)
    if (!seam) return
    const report = seamLengthReport(project, seam)
    if (report.mismatchPercent <= 0.25) {
      setCommandResult(`${seam.name} is already length matched`)
      return
    }
    const longerSide = report.lengthA >= report.lengthB ? 'a' : 'b'
    const shorter = Math.min(report.lengthA, report.lengthB)
    const longer = Math.max(report.lengthA, report.lengthB)
    const ratio = longer > 0 ? clamp(shorter / longer, 0.3, 1.2) : 1
    mutateProject((next) => {
      const target = next.seams.find((item) => item.id === seamId)
      if (!target) return
      target.type = 'ease'
      target.easeSide = longerSide
      target.ratio = ratio
    })
    setCommandResult(`${seam.name}: easing ${longerSide.toUpperCase()} to ${(ratio * 100).toFixed(1)}% to match the shorter edge`)
  }

  const addSeamWalkNotches = (seamId) => {
    const seam = project.seams.find((item) => item.id === seamId)
    if (!seam) return
    mutateProject((next) => {
      const targetSeam = next.seams.find((item) => item.id === seamId)
      const pieceA = next.pieces.find((item) => item.id === targetSeam?.a?.pieceId)
      const pieceB = next.pieces.find((item) => item.id === targetSeam?.b?.pieceId)
      if (!targetSeam || !pieceA || !pieceB) return
      pieceA.notches = pieceA.notches || []
      pieceB.notches = pieceB.notches || []
      for (const [fraction, type] of [[0.25, 'single'], [0.5, 'double'], [0.75, 'single']]) {
        const sourceFraction = seamFractionAtProgress(targetSeam, 'a', fraction)
        const targetFraction = seamFractionAtProgress(targetSeam, 'b', fraction)
        const existing = pieceA.notches.find((notch) => notch.edgeIndex === targetSeam.a.edgeIndex && Math.abs(Number(notch.t ?? 0.5) - sourceFraction) < 0.025 && notch.matchedSeamId === seamId)
        if (existing) continue
        const groupId = uniqueId('notch-match')
        pieceA.notches.push({
          id: uniqueId('notch'),
          edgeIndex: targetSeam.a.edgeIndex,
          t: sourceFraction,
          type,
          depthCm: 0.45,
          matchGroupId: groupId,
          matchedSeamId: seamId,
        })
        pieceB.notches.push({
          id: uniqueId('notch'),
          edgeIndex: targetSeam.b.edgeIndex,
          t: targetFraction,
          type,
          depthCm: 0.45,
          matchGroupId: groupId,
          matchedSeamId: seamId,
        })
      }
    })
    setCommandResult(`${seam.name}: added matched quarter, center, and three-quarter seam-walk notches`)
  }

  const createNotch = (pieceId, edgeIndex, t = 0.5) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.notches = piece.notches || []
      piece.notches.push({
        id: uniqueId('notch'),
        edgeIndex,
        t: clamp(t, 0.02, 0.98),
        type: 'single',
        depthCm: 0.45,
      })
    })
    setCommandResult('Pattern notch added and linked to the selected edge')
  }

  const notchSeams = (pieceId, edgeIndex, t = 0.5) => project.seams.filter((seam) => {
    for (const endpoint of [seam.a, seam.b]) {
      if (endpoint?.pieceId !== pieceId || endpoint.edgeIndex !== edgeIndex) continue
      const range = seamRange(endpoint)
      const notchT = clamp(Number(t ?? 0.5), 0, 1)
      if (notchT >= range.start - 1e-6 && notchT <= range.end + 1e-6) return true
    }
    return false
  })

  const matchNotchAcrossSeam = (pieceId, notchId, seamId) => {
    const sourcePieceNow = project.pieces.find((item) => item.id === pieceId)
    const sourceNotchNow = sourcePieceNow?.notches?.find((item) => item.id === notchId)
    const seamNow = project.seams.find((item) => item.id === seamId)
    if (!sourceNotchNow || !seamNow) return
    const sideNow = seamNow.a?.pieceId === pieceId && seamNow.a?.edgeIndex === sourceNotchNow.edgeIndex
      ? 'a'
      : seamNow.b?.pieceId === pieceId && seamNow.b?.edgeIndex === sourceNotchNow.edgeIndex
        ? 'b'
        : null
    if (!sideNow) return
    const rangeNow = seamRange(seamNow[sideNow])
    const sourceTNow = Number(sourceNotchNow.t ?? 0.5)
    if (sourceTNow < rangeNow.start - 1e-6 || sourceTNow > rangeNow.end + 1e-6) {
      setCommandResult('Move the notch into the stitched seam range before matching it across the seam.')
      return
    }
    mutateProject((next) => {
      const sourcePiece = next.pieces.find((item) => item.id === pieceId)
      const sourceNotch = sourcePiece?.notches?.find((item) => item.id === notchId)
      const seam = next.seams.find((item) => item.id === seamId)
      if (!sourcePiece || !sourceNotch || !seam) return
      const sourceIsA = seam.a?.pieceId === pieceId && seam.a?.edgeIndex === sourceNotch.edgeIndex
      const sourceIsB = seam.b?.pieceId === pieceId && seam.b?.edgeIndex === sourceNotch.edgeIndex
      if (!sourceIsA && !sourceIsB) return
      const targetEndpoint = sourceIsA ? seam.b : seam.a
      const targetPiece = next.pieces.find((item) => item.id === targetEndpoint?.pieceId)
      if (!targetPiece) return
      const matchGroupId = sourceNotch.matchGroupId || uniqueId('notch-match')
      const targetT = mapFractionAcrossSeam(seam, sourceIsA ? 'a' : 'b', Number(sourceNotch.t ?? 0.5))
      sourceNotch.matchGroupId = matchGroupId
      sourceNotch.matchedSeamId = seam.id
      targetPiece.notches = targetPiece.notches || []
      let targetNotch = targetPiece.notches.find((item) => item.matchGroupId === matchGroupId)
      if (!targetNotch) {
        targetNotch = {
          id: uniqueId('notch'),
          edgeIndex: targetEndpoint.edgeIndex,
          t: clamp(targetT, 0, 1),
          type: sourceNotch.type || 'single',
          depthCm: Number(sourceNotch.depthCm ?? 0.45),
          matchGroupId,
          matchedSeamId: seam.id,
        }
        targetPiece.notches.push(targetNotch)
      } else {
        targetNotch.edgeIndex = targetEndpoint.edgeIndex
        targetNotch.t = clamp(targetT, 0, 1)
        targetNotch.type = sourceNotch.type || 'single'
        targetNotch.depthCm = Number(sourceNotch.depthCm ?? 0.45)
        targetNotch.matchedSeamId = seam.id
      }
    })
    const seam = project.seams.find((item) => item.id === seamId)
    setCommandResult(`Matched notch across ${seam?.name || 'the sewn seam'}`)
  }

  const updateNotch = (pieceId, notchId, field, value) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      const notch = piece?.notches?.find((item) => item.id === notchId)
      if (!notch) return
      const seam = notch.matchedSeamId ? next.seams.find((item) => item.id === notch.matchedSeamId) : null
      let nextValue = value
      if (field === 't' && seam) {
        const sourceSide = seam.a?.pieceId === pieceId && seam.a?.edgeIndex === notch.edgeIndex
          ? 'a'
          : seam.b?.pieceId === pieceId && seam.b?.edgeIndex === notch.edgeIndex
            ? 'b'
            : null
        if (sourceSide) {
          const range = seamRange(seam[sourceSide])
          nextValue = clamp(Number(value), range.start, range.end)
        }
      }
      notch[field] = nextValue
      if (!notch.matchGroupId || !seam) return
      if (!seam) return
      for (const targetPiece of next.pieces) {
        for (const targetNotch of targetPiece.notches || []) {
          if (targetNotch.id === notch.id || targetNotch.matchGroupId !== notch.matchGroupId) continue
          if (field === 'type' || field === 'depthCm') targetNotch[field] = value
          if (field === 't') {
            const sourceIsA = seam.a?.pieceId === pieceId && seam.a?.edgeIndex === notch.edgeIndex
            const sourceIsB = seam.b?.pieceId === pieceId && seam.b?.edgeIndex === notch.edgeIndex
            if (sourceIsA || sourceIsB) targetNotch.t = clamp(mapFractionAcrossSeam(seam, sourceIsA ? 'a' : 'b', Number(nextValue)), 0, 1)
          }
        }
      }
    })
  }

  const removeNotch = (pieceId, notchId) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      const notch = piece?.notches?.find((item) => item.id === notchId)
      if (!piece || !notch) return
      const matchGroupId = notch.matchGroupId
      if (matchGroupId) {
        for (const item of next.pieces) item.notches = (item.notches || []).filter((candidate) => candidate.matchGroupId !== matchGroupId)
      } else {
        piece.notches = (piece.notches || []).filter((candidate) => candidate.id !== notchId)
      }
    })
  }

  const addTopstitch = (pieceId, edgeIndex) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.topstitches = piece.topstitches || []
      piece.topstitches.push({
        id: uniqueId('topstitch'),
        edgeIndex,
        offsetCm: 0.7,
        rows: 1,
        rowGapCm: 0.45,
        stitchLengthMm: 3,
        color: '#8d8d8d',
      })
    })
    setCommandResult('Topstitch added; the edge is now visually and physically reinforced')
  }

  const addBinding = (pieceId, edgeIndex) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.bindings = piece.bindings || []
      piece.bindings.push({
        id: uniqueId('binding'),
        edgeIndex,
        ratio: 0.96,
        stiffness: 0.72,
        widthCm: 1.8,
        color: '#3b3b3b',
      })
    })
    setCommandResult('Edge binding added with a 96% stay ratio')
  }

  const addZipper = (pieceId, edgeIndex) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      piece.zippers = piece.zippers || []
      piece.zippers.push({
        id: uniqueId('zipper'),
        edgeIndex,
        widthCm: 1.2,
        offsetCm: 0,
        type: 'coil',
        color: '#777777',
      })
    })
    setCommandResult('Zipper tape added and reinforced in the cloth solver')
  }

  const addButtonRow = (pieceId, count = 5) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece?.points?.length) return
      piece.buttons = piece.buttons || []
      const center = pieceCenter(piece)
      const ys = piece.points.map((point) => point.y)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const top = maxY - (maxY - minY) * 0.25
      const bottom = minY + (maxY - minY) * 0.22
      for (let index = 0; index < count; index += 1) {
        const t = count === 1 ? 0.5 : index / (count - 1)
        piece.buttons.push({
          id: uniqueId('button'),
          x: center.x,
          y: top + (bottom - top) * t,
          diameterCm: 1.8,
          holes: 4,
          color: '#222222',
        })
      }
    })
    setCommandResult(`${count}-button center row added to ${selectedPiece?.name || 'pattern'}`)
  }

  const addButtonholeRow = (pieceId, count = 5) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece?.points?.length) return
      piece.buttonholes = piece.buttonholes || []
      const center = pieceCenter(piece)
      const ys = piece.points.map((point) => point.y)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const top = maxY - (maxY - minY) * 0.25
      const bottom = minY + (maxY - minY) * 0.22
      for (let index = 0; index < count; index += 1) {
        const t = count === 1 ? 0.5 : index / (count - 1)
        const buttonholeId = uniqueId('buttonhole')
        const pairedButton = piece.buttons?.length === count ? piece.buttons[index] : null
        piece.buttonholes.push({
          id: buttonholeId,
          x: center.x,
          y: top + (bottom - top) * t,
          lengthCm: 2.4,
          widthCm: 0.35,
          orientationDeg: 0,
          color: '#575757',
          pairedButtonId: pairedButton?.id || null,
        })
        if (pairedButton) pairedButton.pairedButtonholeId = buttonholeId
      }
    })
    setCommandResult(`${count}-buttonhole center row added to ${selectedPiece?.name || 'pattern'}`)
  }

  const updateButtonhole = (pieceId, buttonholeId, field, value) => {
    mutateProject((next) => {
      const buttonhole = next.pieces.find((item) => item.id === pieceId)?.buttonholes?.find((item) => item.id === buttonholeId)
      if (buttonhole) buttonhole[field] = value
    })
  }

  const removeButtonhole = (pieceId, buttonholeId) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (!piece) return
      const buttonhole = (piece.buttonholes || []).find((item) => item.id === buttonholeId)
      if (buttonhole?.pairedButtonId) {
        const button = (piece.buttons || []).find((item) => item.id === buttonhole.pairedButtonId)
        if (button?.pairedButtonholeId === buttonholeId) button.pairedButtonholeId = null
      }
      piece.buttonholes = (piece.buttonholes || []).filter((item) => item.id !== buttonholeId)
    })
  }

  const addRibNeckband = () => {
    const front = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'front' && piece.points?.length >= 12)
    const back = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'back' && piece.points?.length >= 12)
    if (!front || !back) {
      setCommandResult('Neckband generator needs a front and back upper-body pattern with a segmented neckline')
      return
    }
    if (project.pieces.some((piece) => piece.generatedRole === 'neckband')) {
      setCommandResult('This garment already has a generated neckband')
      return
    }

    const ratio = 0.88
    const widthCm = 4
    const attachments = [
      { pieceId: front.id, edgeIndex: 11 },
      { pieceId: front.id, edgeIndex: 10 },
      { pieceId: front.id, edgeIndex: 9 },
      { pieceId: back.id, edgeIndex: 9 },
      { pieceId: back.id, edgeIndex: 10 },
      { pieceId: back.id, edgeIndex: 11 },
    ]
    const segmentLengths = attachments.map(({ pieceId, edgeIndex }) => {
      const piece = project.pieces.find((item) => item.id === pieceId)
      return edgeLength(piece, edgeIndex) * ratio
    })
    const totalLength = segmentLengths.reduce((sum, value) => sum + value, 0)
    const neckRadiusM = Math.max(0.048, Math.min(0.09, (totalLength / 100) / (Math.PI * 2)))
    let cursor = -totalLength * 0.5
    const bottom = [{ x: cursor, y: 0 }]
    for (const length of segmentLengths) {
      cursor += length
      bottom.push({ x: cursor, y: 0 })
    }
    const neckbandId = uniqueId('neckband')
    const points = [
      ...bottom,
      { x: cursor, y: widthCm },
      { x: -totalLength * 0.5, y: widthCm },
    ]

    mutateProject((next) => {
      const mainFabric = next.fabrics?.main || FABRIC_PRESETS.jersey
      if (!next.fabrics.rib) {
        next.fabrics.rib = {
          ...cloneProject(mainFabric),
          id: 'rib',
          name: '1×1 Rib Knit',
          gsm: Math.max(180, Math.round((mainFabric.gsm || 220) * 0.9)),
          stretchWarp: Math.max(0.20, mainFabric.stretchWarp || 0),
          stretchWeft: Math.max(0.38, mainFabric.stretchWeft || 0),
          bend: Math.min(0.64, mainFabric.bend ?? 0.65),
          damping: 0.987,
        }
      }
      next.pieces.push({
        id: neckbandId,
        name: 'Rib Neckband',
        generatedRole: 'neckband',
        points,
        layout2d: { x: 145, y: 42 },
        arrangement3d: { x: 0, y: 1.595, z: 0, radius: neckRadiusM, wrap: 'neck', phaseDeg: 180, direction: -1 },
        simulationResolution: 2,
        grainAngleDeg: 90,
        layerIndex: 1,
        notches: [],
        topstitches: [{ id: `${neckbandId}-topstitch`, edgeIndex: 7, offsetCm: 0.55, rows: 1, rowGapCm: 0.4, stitchLengthMm: 2.8, color: '#737373' }],
        bindings: [],
        graphics: [],
        zippers: [],
        buttons: [],
        internalLines: [],
        pins: [],
        seamAllowance: 0.7,
        fabricId: 'rib',
        cutQuantity: 1,
        locked: false,
      })
      attachments.forEach((attachment, index) => {
        next.seams.push({
          id: uniqueId('neck-seam'),
          name: `Neckband segment ${index + 1}`,
          type: 'normal',
          a: { pieceId: neckbandId, edgeIndex: index },
          b: attachment,
          reverseB: index < 3,
        })
      })
      next.seams.push({
        id: uniqueId('neckband-loop'),
        name: 'Neckband center-back closure',
        a: { pieceId: neckbandId, edgeIndex: 6 },
        b: { pieceId: neckbandId, edgeIndex: 8 },
      })
    })
    setSelectedPieceId(neckbandId)
    setSelectedFabricId('rib')
    setCommandResult(`Generated ${totalLength.toFixed(1)} cm rib neckband at ${Math.round(ratio * 100)}% of neckline length`)
  }

  const addStandCollar = () => {
    const front = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'front' && piece.points?.length >= 12)
    const back = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'back' && piece.points?.length >= 12)
    if (!front || !back) {
      setCommandResult('Stand collar generator needs a front and back upper-body pattern with a segmented neckline')
      return
    }
    if (project.pieces.some((piece) => piece.generatedRole === 'stand-collar')) {
      setCommandResult('This garment already has a generated stand collar')
      return
    }

    const ratio = 1.015
    const widthCm = 8
    const attachments = [
      { pieceId: front.id, edgeIndex: 11 },
      { pieceId: front.id, edgeIndex: 10 },
      { pieceId: front.id, edgeIndex: 9 },
      { pieceId: back.id, edgeIndex: 9 },
      { pieceId: back.id, edgeIndex: 10 },
      { pieceId: back.id, edgeIndex: 11 },
    ]
    const segmentLengths = attachments.map(({ pieceId, edgeIndex }) => {
      const piece = project.pieces.find((item) => item.id === pieceId)
      return edgeLength(piece, edgeIndex) * ratio
    })
    const totalLength = segmentLengths.reduce((sum, value) => sum + value, 0)
    const neckRadiusM = Math.max(0.055, Math.min(0.11, (totalLength / 100) / (Math.PI * 2)))
    let cursor = -totalLength * 0.5
    const bottom = [{ x: cursor, y: 0 }]
    for (const length of segmentLengths) {
      cursor += length
      bottom.push({ x: cursor, y: 0 })
    }
    const collarId = uniqueId('stand-collar')
    const points = [
      ...bottom,
      { x: cursor, y: widthCm },
      { x: -totalLength * 0.5, y: widthCm },
    ]

    mutateProject((next) => {
      next.pieces.push({
        id: collarId,
        name: 'Stand Collar',
        generatedRole: 'stand-collar',
        points,
        layout2d: { x: 145, y: 52 },
        arrangement3d: { x: 0, y: 1.59, z: 0, radius: neckRadiusM, wrap: 'neck', phaseDeg: 180, direction: -1 },
        simulationResolution: 2,
        grainAngleDeg: 90,
        layerIndex: 1,
        notches: [],
        topstitches: [
          { id: `${collarId}-top`, edgeIndex: 7, offsetCm: 0.6, rows: 1, rowGapCm: 0.4, stitchLengthMm: 3, color: '#777777' },
        ],
        bindings: [],
        graphics: [],
        zippers: [],
        buttons: [],
        internalLines: [
          { id: `${collarId}-roll`, type: 'fold', a: { x: -totalLength * 0.48, y: widthCm * 0.52 }, b: { x: totalLength * 0.48, y: widthCm * 0.52 }, foldAngleDeg: 155 },
        ],
        pins: [],
        seamAllowance: 1,
        fabricId: 'main',
        cutQuantity: 1,
        locked: false,
      })
      attachments.forEach((attachment, index) => {
        next.seams.push({
          id: uniqueId('collar-seam'),
          name: `Collar neckline segment ${index + 1}`,
          type: 'normal',
          a: { pieceId: collarId, edgeIndex: index },
          b: attachment,
          reverseB: index < 3,
        })
      })
      next.seams.push({
        id: uniqueId('collar-loop'),
        name: 'Collar center-back closure',
        a: { pieceId: collarId, edgeIndex: 6 },
        b: { pieceId: collarId, edgeIndex: 8 },
      })
    })
    setSelectedPieceId(collarId)
    setCommandResult(`Generated ${widthCm.toFixed(1)} cm stand collar from the measured neckline`)
  }

  const addTwoPanelHood = () => {
    const front = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'front' && piece.points?.length >= 12)
    const back = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'back' && piece.points?.length >= 12)
    if (!front || !back) {
      setCommandResult('Hood generator needs a front and back upper-body pattern with a segmented neckline')
      return
    }
    if (project.pieces.some((piece) => ['neckband', 'stand-collar', 'hood-left', 'hood-right'].includes(piece.generatedRole))) {
      setCommandResult('Remove the existing generated neckline construction before adding a hood')
      return
    }
    if (edgeIsSewn(front.id, 10) || edgeIsSewn(back.id, 10)) {
      setCommandResult('The center neckline edges must be unsewn before generating a two-panel hood')
      return
    }

    const leftId = uniqueId('hood-left')
    const rightId = uniqueId('hood-right')

    mutateProject((next) => {
      splitPieceEdgeInProject(next, front.id, 10, 0.5)
      splitPieceEdgeInProject(next, back.id, 10, 0.5)
      const nextFront = next.pieces.find((piece) => piece.id === front.id)
      const nextBack = next.pieces.find((piece) => piece.id === back.id)
      if (!nextFront || !nextBack) return

      // The tee neckline finish is replaced by the hood-to-neck seam.
      for (const bodyPiece of [nextFront, nextBack]) {
        bodyPiece.bindings = (bodyPiece.bindings || []).filter((item) => item.edgeIndex < 9 || item.edgeIndex > 12)
        bodyPiece.topstitches = (bodyPiece.topstitches || []).filter((item) => item.edgeIndex < 9 || item.edgeIndex > 12)
      }

      const rightAttachments = [
        { endpoint: { pieceId: nextFront.id, edgeIndex: 10 }, reverseB: true },
        { endpoint: { pieceId: nextFront.id, edgeIndex: 9 }, reverseB: true },
        { endpoint: { pieceId: nextBack.id, edgeIndex: 9 }, reverseB: false },
        { endpoint: { pieceId: nextBack.id, edgeIndex: 10 }, reverseB: false },
      ]
      const leftAttachments = [
        { endpoint: { pieceId: nextFront.id, edgeIndex: 11 }, reverseB: false },
        { endpoint: { pieceId: nextFront.id, edgeIndex: 12 }, reverseB: false },
        { endpoint: { pieceId: nextBack.id, edgeIndex: 12 }, reverseB: true },
        { endpoint: { pieceId: nextBack.id, edgeIndex: 11 }, reverseB: true },
      ]

      const buildHoodPiece = (id, name, attachments, wrap, layoutX) => {
        const lengths = attachments.map(({ endpoint }) => {
          const piece = next.pieces.find((item) => item.id === endpoint.pieceId)
          return edgeLength(piece, endpoint.edgeIndex)
        })
        const bottom = [{ x: 0, y: 0 }]
        let cursor = 0
        for (const length of lengths) {
          cursor += length
          bottom.push({ x: cursor, y: 0 })
        }
        const total = Math.max(24, cursor)
        return {
          id,
          name,
          generatedRole: wrap,
          hoodState: 'up',
          points: [
            ...bottom,
            { x: total, y: 31 },
            { x: total * 0.62, y: 49 },
            { x: total * 0.08, y: 41 },
          ],
          curves: {
            4: { cx: total + 3.5, cy: 16 },
            5: { cx: total * 0.93, cy: 48 },
            6: { cx: total * 0.34, cy: 55 },
            7: { cx: -2.5, cy: 21 },
          },
          layout2d: { x: layoutX, y: 52 },
          arrangement3d: { x: 0, y: 1.59, z: 0, wrap },
          simulationResolution: 1,
          grainAngleDeg: 0,
          layerIndex: 1,
          notches: [{ id: `${id}-neck-notch`, edgeIndex: 1, t: 0.5, type: 'single', depthCm: 0.45 }],
          topstitches: [{ id: `${id}-opening-stitch`, edgeIndex: 7, offsetCm: 2.1, rows: 2, rowGapCm: 0.5, stitchLengthMm: 3, color: '#777777' }],
          bindings: [],
          graphics: [],
          zippers: [],
          buttons: [],
          internalLines: [],
          pins: [],
          seamAllowance: 1,
          fabricId: 'main',
          cutQuantity: 1,
          marker: { allowCrossGrain: false },
          locked: false,
        }
      }

      const leftHood = buildHoodPiece(leftId, 'Hood Left', leftAttachments, 'hood-left', 62)
      const rightHood = buildHoodPiece(rightId, 'Hood Right', rightAttachments, 'hood-right', 248)
      next.pieces.push(leftHood, rightHood)

      const attachHood = (hood, attachments, sideName) => {
        attachments.forEach(({ endpoint, reverseB }, index) => {
          next.seams.push({
            id: uniqueId('hood-neck'),
            name: `${sideName} hood neckline ${index + 1}`,
            type: 'normal',
            a: { pieceId: hood.id, edgeIndex: index },
            b: endpoint,
            reverseB,
          })
        })
      }
      attachHood(leftHood, leftAttachments, 'Left')
      attachHood(rightHood, rightAttachments, 'Right')

      for (const edgeIndex of [4, 5, 6]) {
        next.seams.push({
          id: uniqueId('hood-center'),
          name: `Hood center seam ${edgeIndex - 3}`,
          type: 'normal',
          a: { pieceId: leftId, edgeIndex },
          b: { pieceId: rightId, edgeIndex },
          reverseB: false,
        })
      }
    })

    setSelectedPieceId(leftId)
    setCommandResult('Generated two-panel hood with measured neckline attachment and center crown seam')
  }

  const setGeneratedHoodState = (state) => {
    mutateProject((next) => {
      for (const piece of next.pieces || []) {
        if (['hood-left', 'hood-right'].includes(piece.generatedRole)) piece.hoodState = state
      }
    })
    setRunning(false)
    setResetSignal((signal) => signal + 1)
    setCommandResult(`Hood set ${state}`)
  }

  const addRibFinishSet = () => {
    const front = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'front')
    const back = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'back')
    const leftSleeve = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'left-arm')
    const rightSleeve = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'right-arm')
    if (!front || !back || !leftSleeve || !rightSleeve) {
      setCommandResult('Rib finish generator needs front, back, left sleeve, and right sleeve patterns')
      return
    }
    if (project.pieces.some((piece) => ['rib-waistband', 'rib-cuff-left', 'rib-cuff-right'].includes(piece.generatedRole))) {
      setCommandResult('This garment already has generated rib cuffs or waistband')
      return
    }

    const cuffRatio = 0.92
    const waistbandRatio = 0.94
    const cuffHeightCm = 9
    const waistbandHeightCm = 10
    const leftCuffId = uniqueId('rib-cuff-left')
    const rightCuffId = uniqueId('rib-cuff-right')
    const waistbandId = uniqueId('rib-waistband')

    mutateProject((next) => {
      const mainFabric = next.fabrics?.main || FABRIC_PRESETS.fleece
      if (!next.fabrics.rib) {
        next.fabrics.rib = {
          ...cloneProject(mainFabric),
          id: 'rib',
          name: '1×1 Rib Knit',
          gsm: Math.max(260, Math.round((mainFabric.gsm || 350) * 0.78)),
          stretchWarp: Math.max(0.22, mainFabric.stretchWarp || 0),
          stretchWeft: Math.max(0.42, mainFabric.stretchWeft || 0),
          bend: Math.min(0.68, mainFabric.bend ?? 0.7),
          damping: 0.987,
        }
      }

      const makeCuff = (id, name, sleeve, wrap, layoutX) => {
        const sleeveLength = edgeLength(sleeve, 3)
        const circumference = sleeveLength * cuffRatio
        const half = circumference * 0.5
        const radius = Math.max(0.055, Math.min(0.082, (circumference / 100) / (Math.PI * 2)))
        const cuff = {
          id,
          name,
          generatedRole: id.includes('left') ? 'rib-cuff-left' : 'rib-cuff-right',
          points: [
            { x: -half, y: 0 },
            { x: half, y: 0 },
            { x: half, y: cuffHeightCm },
            { x: -half, y: cuffHeightCm },
          ],
          layout2d: { x: layoutX, y: 206 },
          arrangement3d: { x: 0, y: 0, z: 0, wrap, radius, alongOffsetM: 0.075 },
          simulationResolution: 2,
          grainAngleDeg: 90,
          layerIndex: 1,
          notches: [],
          topstitches: [{ id: `${id}-finish`, edgeIndex: 0, offsetCm: 1.2, rows: 2, rowGapCm: 0.4, stitchLengthMm: 3, color: '#777777' }],
          bindings: [],
          graphics: [],
          zippers: [],
          buttons: [],
          internalLines: [{ id: `${id}-fold`, type: 'fold', a: { x: -half * 0.95, y: cuffHeightCm * 0.5 }, b: { x: half * 0.95, y: cuffHeightCm * 0.5 }, foldAngleDeg: 175 }],
          pins: [],
          seamAllowance: 0.8,
          fabricId: 'rib',
          cutQuantity: 1,
          marker: { allowCrossGrain: false },
          locked: false,
        }
        next.pieces.push(cuff)
        next.seams.push(
          {
            id: uniqueId('cuff-attach'),
            name: `${name} attachment`,
            type: 'normal',
            a: { pieceId: id, edgeIndex: 2 },
            b: { pieceId: sleeve.id, edgeIndex: 3 },
            reverseB: true,
          },
          {
            id: uniqueId('cuff-loop'),
            name: `${name} loop closure`,
            type: 'normal',
            a: { pieceId: id, edgeIndex: 1 },
            b: { pieceId: id, edgeIndex: 3 },
            reverseB: true,
          },
        )
      }

      const nextLeftSleeve = next.pieces.find((piece) => piece.id === leftSleeve.id)
      const nextRightSleeve = next.pieces.find((piece) => piece.id === rightSleeve.id)
      makeCuff(leftCuffId, 'Left Rib Cuff', nextLeftSleeve, 'left-wrist', 52)
      makeCuff(rightCuffId, 'Right Rib Cuff', nextRightSleeve, 'right-wrist', 268)

      const nextFront = next.pieces.find((piece) => piece.id === front.id)
      const nextBack = next.pieces.find((piece) => piece.id === back.id)
      const frontLength = edgeLength(nextFront, 4) * waistbandRatio
      const backLength = edgeLength(nextBack, 4) * waistbandRatio
      const total = frontLength + backLength
      const half = total * 0.5
      const waist = {
        id: waistbandId,
        name: 'Rib Waistband',
        generatedRole: 'rib-waistband',
        points: [
          { x: -half, y: waistbandHeightCm },
          { x: -half + frontLength, y: waistbandHeightCm },
          { x: half, y: waistbandHeightCm },
          { x: half, y: 0 },
          { x: -half + frontLength, y: 0 },
          { x: -half, y: 0 },
        ],
        layout2d: { x: 145, y: 238 },
        arrangement3d: { x: 0, y: 0.89, z: 0, wrap: 'waist-band', phaseDeg: 180, direction: -1, easeM: 0.018 },
        simulationResolution: 2,
        grainAngleDeg: 90,
        layerIndex: 1,
        notches: [{ id: `${waistbandId}-side-notch`, edgeIndex: 0, t: 1, type: 'single', depthCm: 0.45 }],
        topstitches: [{ id: `${waistbandId}-finish`, edgeIndex: 3, offsetCm: 1.2, rows: 2, rowGapCm: 0.45, stitchLengthMm: 3, color: '#777777' }],
        bindings: [],
        graphics: [],
        zippers: [],
        buttons: [],
        internalLines: [{ id: `${waistbandId}-fold`, type: 'fold', a: { x: -half * 0.96, y: waistbandHeightCm * 0.5 }, b: { x: half * 0.96, y: waistbandHeightCm * 0.5 }, foldAngleDeg: 175 }],
        pins: [],
        seamAllowance: 0.8,
        fabricId: 'rib',
        cutQuantity: 1,
        marker: { allowCrossGrain: false },
        locked: false,
      }
      next.pieces.push(waist)
      next.seams.push(
        {
          id: uniqueId('waistband-front'),
          name: 'Waistband to front hem',
          type: 'normal',
          a: { pieceId: waistbandId, edgeIndex: 0 },
          b: { pieceId: nextFront.id, edgeIndex: 4 },
          reverseB: false,
        },
        {
          id: uniqueId('waistband-back'),
          name: 'Waistband to back hem',
          type: 'normal',
          a: { pieceId: waistbandId, edgeIndex: 1 },
          b: { pieceId: nextBack.id, edgeIndex: 4 },
          reverseB: true,
        },
        {
          id: uniqueId('waistband-loop'),
          name: 'Waistband loop closure',
          type: 'normal',
          a: { pieceId: waistbandId, edgeIndex: 2 },
          b: { pieceId: waistbandId, edgeIndex: 5 },
          reverseB: true,
        },
      )
    })

    setSelectedPieceId(waistbandId)
    setSelectedFabricId('rib')
    setCommandResult('Generated separate rib cuffs and waistband from measured sleeve/body hems')
  }

  const addKangarooPocket = () => {
    const front = project.pieces.find((piece) => piece.arrangement3d?.wrap === 'front')
    if (!front) {
      setCommandResult('Kangaroo pocket generator needs a front upper-body pattern')
      return
    }
    if (project.pieces.some((piece) => piece.generatedRole === 'kangaroo-pocket')) {
      setCommandResult('This garment already has a generated kangaroo pocket')
      return
    }

    const pocketId = uniqueId('kangaroo-pocket')
    const targetYOffset = 10
    const points = [
      { x: -21, y: 0 },
      { x: 21, y: 0 },
      { x: 24, y: 14 },
      { x: 16, y: 24 },
      { x: -16, y: 24 },
      { x: -24, y: 14 },
    ]

    mutateProject((next) => {
      const nextFront = next.pieces.find((piece) => piece.id === front.id)
      if (!nextFront) return
      next.pieces.push({
        id: pocketId,
        name: 'Kangaroo Pocket',
        generatedRole: 'kangaroo-pocket',
        points,
        curves: {
          1: { cx: 23, cy: 6 },
          2: { cx: 23, cy: 19 },
          4: { cx: -23, cy: 19 },
          5: { cx: -23, cy: 6 },
        },
        layout2d: { x: 158, y: 166 },
        arrangement3d: { x: 0, y: 0.98 + targetYOffset / 100, z: 0, wrap: 'front' },
        simulationResolution: 2,
        grainAngleDeg: 0,
        layerIndex: 2,
        notches: [],
        topstitches: [
          { id: `${pocketId}-bottom`, edgeIndex: 0, offsetCm: 0.7, rows: 1, rowGapCm: 0.4, stitchLengthMm: 3, color: '#777777' },
          { id: `${pocketId}-right-opening`, edgeIndex: 2, offsetCm: 1.4, rows: 2, rowGapCm: 0.45, stitchLengthMm: 3, color: '#777777' },
          { id: `${pocketId}-top`, edgeIndex: 3, offsetCm: 0.7, rows: 1, rowGapCm: 0.4, stitchLengthMm: 3, color: '#777777' },
          { id: `${pocketId}-left-opening`, edgeIndex: 4, offsetCm: 1.4, rows: 2, rowGapCm: 0.45, stitchLengthMm: 3, color: '#777777' },
        ],
        bindings: [],
        graphics: [],
        zippers: [],
        buttons: [],
        internalLines: [],
        pins: [],
        surfaceAttachments: [
          { id: `${pocketId}-bottom-stitch`, targetPieceId: nextFront.id, sourceEdgeIndex: 0, targetA: { x: -21, y: targetYOffset }, targetB: { x: 21, y: targetYOffset }, stiffness: 0.96 },
          { id: `${pocketId}-right-lower-stitch`, targetPieceId: nextFront.id, sourceEdgeIndex: 1, targetA: { x: 21, y: targetYOffset }, targetB: { x: 24, y: targetYOffset + 14 }, stiffness: 0.95 },
          { id: `${pocketId}-top-stitch`, targetPieceId: nextFront.id, sourceEdgeIndex: 3, targetA: { x: 16, y: targetYOffset + 24 }, targetB: { x: -16, y: targetYOffset + 24 }, stiffness: 0.96 },
          { id: `${pocketId}-left-lower-stitch`, targetPieceId: nextFront.id, sourceEdgeIndex: 5, targetA: { x: -24, y: targetYOffset + 14 }, targetB: { x: -21, y: targetYOffset }, stiffness: 0.95 },
        ],
        seamAllowance: 1,
        fabricId: 'main',
        cutQuantity: 1,
        marker: { allowCrossGrain: false },
        locked: false,
      })
    })
    setSelectedPieceId(pocketId)
    setCommandResult('Generated kangaroo pocket with real interior surface-stitch constraints and open hand entries')
  }

  const updatePieceTrim = (pieceId, collection, trimId, field, value) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      const trim = piece?.[collection]?.find((item) => item.id === trimId)
      if (trim) trim[field] = value
    })
  }

  const removePieceTrim = (pieceId, collection, trimId) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (piece) piece[collection] = (piece[collection] || []).filter((item) => item.id !== trimId)
    })
  }

  const importGraphic = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !selectedPiece) return
    try {
      const image = await imageFileToDataUrl(file)
      const aspect = image.sourceWidth / Math.max(1, image.sourceHeight)
      const widthCm = 20
      const heightCm = clamp(widthCm / Math.max(0.1, aspect), 4, 32)
      const center = pieceCenter(selectedPiece)
      mutateProject((next) => {
        const piece = next.pieces.find((item) => item.id === selectedPiece.id)
        if (!piece) return
        piece.graphics = piece.graphics || []
        piece.graphics.push({
          id: uniqueId('graphic'),
          name: file.name,
          src: image.src,
          x: center.x,
          y: center.y,
          widthCm,
          heightCm,
          rotationDeg: 0,
          opacity: 1,
        })
      })
      setCommandResult(`Placed ${file.name} on ${selectedPiece.name}`)
    } catch (error) {
      setCommandResult(`Artwork import failed: ${error.message}`)
    }
  }

  const updateGraphic = (pieceId, graphicId, field, value) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      const graphic = piece?.graphics?.find((item) => item.id === graphicId)
      if (graphic) graphic[field] = value
    })
  }

  const removeGraphic = (pieceId, graphicId) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      if (piece) piece.graphics = (piece.graphics || []).filter((item) => item.id !== graphicId)
    })
  }

  const updateSelectedPiece = (field, value) => {
    if (!selectedPiece) return
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (piece) piece[field] = value
    })
  }

  const updateSelectedEdgeAllowance = (edgeIndex, value) => {
    if (!selectedPiece) return
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (!piece) return
      piece.edgeSeamAllowances = { ...(piece.edgeSeamAllowances || {}) }
      const clamped = clamp(value, 0, 8)
      if (Math.abs(clamped - Number(piece.seamAllowance || 0)) < 1e-6) delete piece.edgeSeamAllowances[edgeIndex]
      else piece.edgeSeamAllowances[edgeIndex] = clamped
    })
  }

  const resetSelectedEdgeAllowances = () => {
    if (!selectedPiece) return
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (piece) piece.edgeSeamAllowances = {}
    })
    setCommandResult(`Reset ${selectedPiece.name} edge seam allowances to the pattern default`)
  }

  const updateSelectedArrangement = (field, value) => {
    if (!selectedPiece) return
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (!piece) return
      piece.arrangement3d = piece.arrangement3d || { x: 0, y: 0.9, z: 0.2, flip: false }
      piece.arrangement3d[field] = value
      if (field === 'wrap' && value === 'front') piece.arrangement3d.z = Math.abs(piece.arrangement3d.z || 0.245)
      if (field === 'wrap' && value === 'back') piece.arrangement3d.z = -Math.abs(piece.arrangement3d.z || 0.245)
    })
  }

  const updateSelectedMarker = (field, value) => {
    if (!selectedPiece) return
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (!piece) return
      piece.marker = piece.marker || { allowCrossGrain: false }
      piece.marker[field] = value
    })
  }

  const duplicateSelectedPiece = (mirrored = false, linked = false) => {
    if (!selectedPiece) return
    const source = cloneProject(selectedPiece)
    const xs = source.points.map((point) => point.x)
    const centerX = (Math.min(...xs) + Math.max(...xs)) * 0.5
    source.id = uniqueId('piece')
    source.name = `${selectedPiece.name}${linked ? ' Linked Mirror' : mirrored ? ' Mirror' : ' Copy'}`
    source.layout2d = { x: selectedPiece.layout2d.x + 72, y: selectedPiece.layout2d.y }
    source.arrangement3d = {
      ...(selectedPiece.arrangement3d || {}),
      x: (selectedPiece.arrangement3d?.x || 0) + (mirrored ? -0.65 : 0.65),
      wrap: undefined,
    }
    source.pins = (source.pins || []).map((pin) => ({ ...pin, id: uniqueId('pin') }))
    if (mirrored) {
      const edgeCount = source.points.length
      source.points = source.points
        .map((point) => ({ x: centerX - (point.x - centerX), y: point.y }))
        .reverse()
      if (source.curves) {
        source.curves = Object.fromEntries(Object.entries(source.curves).map(([edgeIndex, curve]) => {
          const oldIndex = Number(edgeIndex)
          const newIndex = (edgeCount - 2 - oldIndex + edgeCount) % edgeCount
          return [newIndex, { cx: centerX - (curve.cx - centerX), cy: curve.cy }]
        }))
      }
      source.internalLines = (source.internalLines || []).map((line) => ({
        ...line,
        a: { x: centerX - (line.a.x - centerX), y: line.a.y },
        b: { x: centerX - (line.b.x - centerX), y: line.b.y },
      }))
      source.pins = (source.pins || []).map((pin) => ({ ...pin, x: centerX - (pin.x - centerX) }))
      source.buttons = (source.buttons || []).map((button) => ({ ...button, id: uniqueId('button'), x: centerX - (button.x - centerX) }))
      source.buttonholes = (source.buttonholes || []).map((buttonhole) => ({
        ...buttonhole,
        id: uniqueId('buttonhole'),
        x: centerX - (buttonhole.x - centerX),
        orientationDeg: -(buttonhole.orientationDeg || 0),
      }))
      source.notches = (source.notches || []).map((notch) => ({
        ...notch,
        id: uniqueId('notch'),
        edgeIndex: (edgeCount - 2 - notch.edgeIndex + edgeCount) % edgeCount,
        t: 1 - (notch.t ?? 0.5),
      }))
      source.grainAngleDeg = -(source.grainAngleDeg || 0)
    }
    if (linked) source.linkedMirrorSourceId = selectedPiece.id
    mutateProject((next) => next.pieces.push(source))
    setSelectedPieceId(source.id)
  }

  const createLiningCopy = () => {
    if (!selectedPiece) return
    if (selectedPiece.generatedRole === 'lining') {
      setCommandResult('This pattern is already a lining piece')
      return
    }
    const liningId = uniqueId('lining')
    mutateProject((next) => {
      const shell = next.pieces.find((item) => item.id === selectedPiece.id)
      if (!shell) return
      if (next.pieces.some((piece) => piece.liningForPieceId === shell.id)) {
        setCommandResult(`${shell.name} already has a lining copy`)
        return
      }

      if (!next.fabrics.lining) {
        next.fabrics.lining = {
          ...cloneProject(FABRIC_PRESETS.silk),
          id: 'lining',
          name: 'Lightweight Lining',
          gsm: 82,
          friction: 0.16,
          bend: 0.36,
          damping: 0.991,
          thickness: 0.001,
          color: '#7b7b80',
        }
      }

      const lining = cloneProject(shell)
      lining.id = liningId
      lining.name = `${shell.name} Lining`
      lining.generatedRole = 'lining'
      lining.liningForPieceId = shell.id
      lining.layerIndex = Math.max(0, (shell.layerIndex || 0))
      shell.layerIndex = Math.max(1, (shell.layerIndex || 0) + 1)
      lining.fabricId = 'lining'
      lining.layout2d = {
        x: (shell.layout2d?.x || 0) + 66,
        y: (shell.layout2d?.y || 0) + 12,
      }
      lining.arrangement3d = {
        ...(shell.arrangement3d || {}),
        surfaceOffsetM: Number(shell.arrangement3d?.surfaceOffsetM || 0) - 0.004,
      }
      lining.graphics = []
      lining.topstitches = []
      lining.bindings = []
      lining.zippers = []
      lining.buttons = []
      lining.buttonholes = []
      lining.surfaceAttachments = shell.points.map((_, edgeIndex) => ({
        id: `${liningId}-edge-${edgeIndex}`,
        targetPieceId: shell.id,
        sourceEdgeIndex: edgeIndex,
        targetEdgeIndex: edgeIndex,
        restM: 0.0025,
        stiffness: 0.84,
      }))
      lining.marker = { allowCrossGrain: false }
      lining.linkedMirrorSourceId = undefined
      next.pieces.push(lining)
    })
    setSelectedPieceId(liningId)
    setSelectedFabricId('lining')
    setCommandResult(`Created separate lining layer for ${selectedPiece.name}`)
  }

  const createInterfacingCopy = () => {
    if (!selectedPiece) return
    if (selectedPiece.generatedRole === 'interfacing') {
      setCommandResult('This pattern is already an interfacing piece')
      return
    }
    const interfacingId = uniqueId('interfacing')
    mutateProject((next) => {
      const shell = next.pieces.find((item) => item.id === selectedPiece.id)
      if (!shell) return
      if (next.pieces.some((piece) => piece.interfacingForPieceId === shell.id)) {
        setCommandResult(`${shell.name} already has a fused interfacing copy`)
        return
      }
      next.fabrics = next.fabrics || {}
      if (!next.fabrics.interfacing) next.fabrics.interfacing = { ...cloneProject(FABRIC_PRESETS.interfacing), id: 'interfacing', name: 'Fusible Interfacing' }

      const interfacing = cloneProject(shell)
      interfacing.id = interfacingId
      interfacing.name = `${shell.name} Interfacing`
      interfacing.generatedRole = 'interfacing'
      interfacing.interfacingForPieceId = shell.id
      interfacing.fusedToPieceId = shell.id
      interfacing.fuseStiffness = 0.985
      interfacing.fuseGapM = 0.001
      interfacing.fabricId = 'interfacing'
      interfacing.layerIndex = shell.layerIndex || 0
      interfacing.layout2d = {
        x: (shell.layout2d?.x || 0) + 76,
        y: (shell.layout2d?.y || 0) + 18,
      }
      interfacing.arrangement3d = {
        ...(shell.arrangement3d || {}),
        surfaceOffsetM: Number(shell.arrangement3d?.surfaceOffsetM || 0) - 0.002,
      }
      interfacing.graphics = []
      interfacing.topstitches = []
      interfacing.bindings = []
      interfacing.zippers = []
      interfacing.buttons = []
      interfacing.buttonholes = []
      interfacing.surfaceAttachments = []
      interfacing.pins = []
      interfacing.linkedMirrorSourceId = undefined
      interfacing.marker = { allowCrossGrain: false }
      interfacing.strengthened = false
      interfacing.visible3d = false
      next.pieces.push(interfacing)
    })
    setSelectedPieceId(interfacingId)
    setSelectedFabricId('interfacing')
    setCommandResult(`Created fused interfacing layer for ${selectedPiece.name}`)
  }

  const unlinkSelectedMirror = () => {
    if (!selectedPiece?.linkedMirrorSourceId) return
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === selectedPiece.id)
      if (piece) delete piece.linkedMirrorSourceId
    })
    setCommandResult(`${selectedPiece.name} is now an independent pattern`)
  }

  const updateFabric = (field, value) => {
    mutateProject((next) => {
      const target = next.fabrics?.[selectedFabricId] || next.fabrics?.main
      if (target) target[field] = value
    })
  }

  const applyFabricPreset = (presetId) => {
    const preset = FABRIC_PRESETS[presetId]
    if (!preset) return
    mutateProject((next) => {
      const current = next.fabrics?.[selectedFabricId] || next.fabrics?.main
      const targetId = current?.id || selectedFabricId || 'main'
      const texture = current?.texture ? cloneProject(current.texture) : null
      next.fabrics[targetId] = { ...preset, id: targetId, name: preset.name, ...(texture ? { texture } : {}) }
    })
  }

  const importFabricTexture = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const image = await imageFileToDataUrl(file, 1536)
      mutateProject((next) => {
        const target = next.fabrics?.[selectedFabricId] || next.fabrics?.main
        if (!target) return
        target.texture = {
          ...(target.texture || {}),
          src: image.src,
          name: file.name,
          repeatWidthCm: target.texture?.repeatWidthCm ?? 20,
          repeatHeightCm: target.texture?.repeatHeightCm ?? 20,
          rotationDeg: target.texture?.rotationDeg ?? 0,
        }
      })
      setCommandResult(`Applied ${file.name} as the ${fabric.name || 'fabric'} surface texture`)
    } catch (error) {
      setCommandResult(`Fabric texture import failed: ${error.message}`)
    }
  }

  const updateFabricTexture = (field, value) => {
    mutateProject((next) => {
      const target = next.fabrics?.[selectedFabricId] || next.fabrics?.main
      if (!target) return
      target.texture = target.texture || { src: '', name: 'Texture', repeatWidthCm: 20, repeatHeightCm: 20, rotationDeg: 0 }
      target.texture[field] = value
    })
  }

  const importFabricPbrMap = async (event, kind) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !['normal', 'roughness'].includes(kind)) return
    try {
      const image = await imageFileToDataUrl(file, 1536)
      mutateProject((next) => {
        const target = next.fabrics?.[selectedFabricId] || next.fabrics?.main
        if (!target) return
        target.texture = target.texture || { src: '', name: 'Texture', repeatWidthCm: 20, repeatHeightCm: 20, rotationDeg: 0 }
        target.texture[`${kind}Src`] = image.src
        target.texture[`${kind}Name`] = file.name
      })
      setCommandResult(`Applied ${file.name} as the ${fabric.name || 'fabric'} ${kind} map`)
    } catch (error) {
      setCommandResult(`${kind} map import failed: ${error.message}`)
    }
  }

  const removeFabricPbrMap = (kind) => {
    if (!['normal', 'roughness'].includes(kind)) return
    mutateProject((next) => {
      const target = next.fabrics?.[selectedFabricId] || next.fabrics?.main
      if (!target?.texture) return
      delete target.texture[`${kind}Src`]
      delete target.texture[`${kind}Name`]
    })
    setCommandResult(`${kind[0].toUpperCase()}${kind.slice(1)} map removed`)
  }

  const removeFabricTexture = () => {
    mutateProject((next) => {
      const target = next.fabrics?.[selectedFabricId] || next.fabrics?.main
      if (!target?.texture) return
      delete target.texture.src
      delete target.texture.name
      if (!target.texture.normalSrc && !target.texture.roughnessSrc) delete target.texture
    })
    setCommandResult('Fabric color texture removed; PBR detail maps were preserved')
  }

  const addFabricSwatch = () => {
    const id = uniqueId('fabric')
    mutateProject((next) => {
      const source = next.fabrics?.[selectedFabricId] || next.fabrics?.main || FABRIC_PRESETS.fleece
      next.fabrics = next.fabrics || {}
      next.fabrics[id] = {
        ...cloneProject(source),
        id,
        name: `Fabric ${Object.keys(next.fabrics).length + 1}`,
      }
    })
    setSelectedFabricId(id)
  }

  const deleteFabricSwatch = (fabricId) => {
    if (fabricId === 'main') return
    mutateProject((next) => {
      if (!next.fabrics?.[fabricId]) return
      delete next.fabrics[fabricId]
      for (const piece of next.pieces || []) {
        if (piece.fabricId === fabricId) piece.fabricId = 'main'
      }
    })
    setSelectedFabricId('main')
  }

  const updateAvatar = (field, value) => {
    mutateProject((next) => {
      next.avatar[field] = value
    })
  }

  const updateSimulation = (field, value) => {
    mutateProject((next) => {
      next.simulation[field] = value
    })
  }

  const updateRenderSetting = (field, value) => {
    mutateProject((next) => {
      next.render = next.render || { environmentPreset: 'studio', exposure: 1.1, showEnvironment: false, widthPx: 2048, heightPx: 2560 }
      next.render[field] = value
    })
  }

  const updateRenderResolution = (widthPx, heightPx) => {
    mutateProject((next) => {
      next.render = next.render || { environmentPreset: 'studio', exposure: 1.1, showEnvironment: false, widthPx: 2048, heightPx: 2560 }
      next.render.widthPx = Math.round(clamp(widthPx, 512, 6144))
      next.render.heightPx = Math.round(clamp(heightPx, 512, 6144))
    })
  }

  const importHdri = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (hdriUrl) URL.revokeObjectURL(hdriUrl)
    const url = URL.createObjectURL(file)
    setHdriUrl(url)
    setHdriName(file.name)
    updateRenderSetting('environmentPreset', 'studio')
    setCommandResult(`Loaded HDRI environment ${file.name}`)
  }

  const clearHdri = () => {
    if (hdriUrl) URL.revokeObjectURL(hdriUrl)
    setHdriUrl('')
    setHdriName('')
    setCommandResult('Restored built-in studio environment')
  }

  const updateWind = (field, value) => {
    mutateProject((next) => {
      next.simulation.wind = next.simulation.wind || { enabled: false, speed: 4, directionDeg: 0, turbulence: 0.18, response: 0.025 }
      next.simulation.wind[field] = value
    })
  }

  const applySimulationQuality = (quality) => {
    const presets = {
      draft: { substeps: 1, iterations: 7 },
      balanced: { substeps: 2, iterations: 7 },
      final: { substeps: 4, iterations: 7 },
    }
    const preset = presets[quality]
    if (!preset) return
    mutateProject((next) => {
      next.simulation = { ...next.simulation, ...preset }
    })
    setCommandResult(`Simulation quality set to ${quality}`)
  }

  const updateGrading = (field, value) => {
    mutateProject((next) => {
      next.grading = next.grading || { baseSize: 'M', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] }
      next.grading[field] = value
    })
  }

  const automaticGradeDelta = (piece, point) => {
    const sizes = project.grading?.sizes || ['M']
    const baseSize = project.grading?.baseSize || sizes[0]
    const baseIndex = Math.max(0, sizes.indexOf(baseSize))
    const previewSize = sizes[baseIndex + 1] || sizes[baseIndex - 1] || baseSize
    const offset = sizeOffset(project.grading, previewSize)
    if (!offset) return { dxPerSize: 0, dyPerSize: 0 }
    const automaticPoint = gradePointForPiece(piece, project.grading, previewSize, { ...point, gradeRule: undefined })
    return {
      dxPerSize: (automaticPoint.x - point.x) / offset,
      dyPerSize: (automaticPoint.y - point.y) / offset,
    }
  }

  const setPointGradeRuleEnabled = (pieceId, pointIndex, enabled) => {
    mutateProject((next) => {
      const piece = next.pieces.find((item) => item.id === pieceId)
      const point = piece?.points?.[pointIndex]
      if (!piece || !point) return
      if (!enabled) {
        point.gradeRule = undefined
        return
      }
      const sizes = next.grading?.sizes || ['M']
      const baseSize = next.grading?.baseSize || sizes[0]
      const baseIndex = Math.max(0, sizes.indexOf(baseSize))
      const previewSize = sizes[baseIndex + 1] || sizes[baseIndex - 1] || baseSize
      const offset = sizeOffset(next.grading, previewSize)
      const automaticPoint = gradePointForPiece(piece, next.grading, previewSize, { ...point, gradeRule: undefined })
      point.gradeRule = {
        enabled: true,
        dxPerSize: offset ? (automaticPoint.x - point.x) / offset : 0,
        dyPerSize: offset ? (automaticPoint.y - point.y) / offset : 0,
      }
    })
  }

  const updatePointGradeRule = (pieceId, pointIndex, field, value) => {
    mutateProject((next) => {
      const point = next.pieces.find((item) => item.id === pieceId)?.points?.[pointIndex]
      if (!point) return
      point.gradeRule = point.gradeRule || { enabled: true, dxPerSize: 0, dyPerSize: 0 }
      point.gradeRule.enabled = true
      point.gradeRule[field] = value
    })
  }

  const updateMarkerSetting = (field, value) => {
    mutateProject((next) => {
      next.markerSettings = next.markerSettings || { fabricWidthCm: 150, gapCm: 1.5 }
      next.markerSettings[field] = value
    })
  }

  const updateMarkerFabricWidth = (fabricId, value) => {
    mutateProject((next) => {
      next.markerSettings = next.markerSettings || { fabricWidthCm: 150, gapCm: 1.5 }
      next.markerSettings.fabricWidthsCm = { ...(next.markerSettings.fabricWidthsCm || {}) }
      next.markerSettings.fabricWidthsCm[fabricId] = value
    })
  }

  const resetSimulation = () => {
    setRunning(false)
    setResetSignal((value) => value + 1)
    setCommandResult('3D garment returned to its arrangement state')
  }

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}.garment.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const exportGarmentCode = () => {
    const payload = projectToGarmentCode(project)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-garmentcode.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setCommandResult(`GarmentCode JSON exported with ${Object.keys(payload.pattern.panels).length} panels and ${payload.pattern.stitches.length} stitches`)
  }

  const exportSizeRun = () => {
    const payload = {
      format: 'garment-studio-size-run',
      version: 1,
      sourceProject: project.id,
      sourceRevision: project.revision,
      baseSize: project.grading?.baseSize || 'M',
      rules: project.grading,
      sizes: buildSizeRun(project),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-size-run.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const exportDxf = () => {
    const dxf = projectToDxf(productionProject, gradePreviewSize)
    const blob = new Blob([dxf], { type: 'application/dxf' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-${gradePreviewSize.toLowerCase()}.dxf`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const exportMeasurements = () => {
    const csv = measurementRunToCSV(project)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-pom-spec.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    setCommandResult('POM measurement spec exported for the full size run')
  }

  const exportTechPack = () => {
    const payload = buildTechPack(project)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-tech-pack.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setCommandResult('Structured tech pack exported with POMs, materials, construction, grading, and marker data')
  }

  const exportFactoryPackage = () => {
    const zip = buildFactoryPackageZip(project)
    const blob = new Blob([zip], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-factory-package.zip`
    anchor.click()
    URL.revokeObjectURL(url)
    setCommandResult('Factory package exported with all graded DXFs, POMs, BOM, seams, marker reports, trims, tech pack, and source garment data')
  }

  const downloadObj = (obj) => {
    const blob = new Blob([obj], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    const size = activeSection === 'Production' ? gradePreviewSize : (project.grading?.baseSize || 'M')
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-${String(size).toLowerCase()}-3d.obj`
    anchor.click()
    URL.revokeObjectURL(url)
    setCommandResult(`3D garment OBJ exported from the current ${running ? 'draped' : 'arranged'} mesh`)
  }

  const requestObjExport = () => setMeshExportSignal((signal) => signal + 1)

  const downloadGlb = (payload) => {
    const contents = payload instanceof ArrayBuffer ? payload : JSON.stringify(payload)
    const blob = new Blob([contents], { type: payload instanceof ArrayBuffer ? 'model/gltf-binary' : 'model/gltf+json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    const size = activeSection === 'Production' ? gradePreviewSize : (project.grading?.baseSize || 'M')
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-${String(size).toLowerCase()}-3d.${payload instanceof ArrayBuffer ? 'glb' : 'gltf'}`
    anchor.click()
    URL.revokeObjectURL(url)
    setCommandResult('3D garment GLB exported with mesh and material data')
  }

  const requestGlbExport = () => setGlbExportSignal((signal) => signal + 1)

  const downloadRenderStill = ({ dataUrl, width, height }) => {
    const anchor = document.createElement('a')
    anchor.href = dataUrl
    anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'garment'}-${width}x${height}-render.png`
    anchor.click()
    setCommandResult(`Rendered ${width}×${height} PNG from the current camera and drape`)
  }

  const requestRenderStill = () => setRenderSignal((signal) => signal + 1)

  const importProject = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const source = await file.text()
      if (/\.dxf$/i.test(file.name)) {
        const imported = parseDxfPatterns(source)
        const next = cloneProject(project)
        next.id = uniqueId('project')
        next.name = file.name.replace(/\.dxf$/i, '') || 'Imported DXF'
        next.pieces = imported.pieces
        next.seams = []
        touchProject(next)
        pushUndo(cloneProject(project))
        setProject(next)
        setSelectedPieceId(next.pieces[0]?.id || null)
        setTool('select')
        setRunning(false)
        setCommandResult(`Imported ${next.pieces.length} closed DXF pattern${next.pieces.length === 1 ? '' : 's'} at ${(imported.scaleToCm * 10).toFixed(2)} mm/unit. Sewing is intentionally left unassigned for review.`)
      } else {
        const parsed = JSON.parse(source)
        if (parsed?.pattern?.panels && Array.isArray(parsed?.pattern?.stitches)) {
          const imported = garmentCodeToProject(parsed, createDefaultProject())
          pushUndo(cloneProject(project))
          touchProject(imported)
          setProject(imported)
          setSelectedPieceId(imported.pieces[0]?.id || null)
          setSelectedFabricId(Object.keys(imported.fabrics || {})[0] || 'main')
          setMarkerFabricId(Object.keys(imported.fabrics || {})[0] || 'main')
          setRunning(false)
          setResetSignal((signal) => signal + 1)
          setCommandResult(`Imported GarmentCode pattern with ${imported.pieces.length} panels and ${imported.seams.length} stitches`)
        } else {
          if (!Array.isArray(parsed.pieces) || !parsed.fabrics || !parsed.simulation) throw new Error('Invalid garment document')
          pushUndo(cloneProject(project))
          touchProject(parsed)
          setProject(parsed)
          setSelectedPieceId(parsed.pieces[0]?.id || null)
          setCommandResult(`Loaded ${file.name}`)
        }
      }
    } catch (error) {
      setCommandResult(`Import failed: ${error.message}`)
    } finally {
      event.target.value = ''
    }
  }

  const runCommand = (event) => {
    event?.preventDefault?.()
    const raw = command.trim()
    if (!raw) return
    const lower = raw.toLowerCase()
    const percent = Number(lower.match(/(-?\d+(?:\.\d+)?)\s*%/)?.[1])
    const centimeters = Number(lower.match(/(-?\d+(?:\.\d+)?)\s*(?:cm|centimeter)/)?.[1])

    if ((lower.includes('widen') || lower.includes('wider')) && selectedPiece && Number.isFinite(percent)) {
      mutateProject((next) => {
        const piece = next.pieces.find((item) => item.id === selectedPiece.id)
        const center = piece.points.reduce((sum, point) => sum + point.x, 0) / piece.points.length
        const scale = 1 + percent / 100
        piece.points = piece.points.map((point) => ({ ...point, x: center + (point.x - center) * scale }))
      })
      setCommandResult(`${selectedPiece.name} widened ${percent}%`)
    } else if (lower.includes('crop') && selectedPiece && Number.isFinite(centimeters)) {
      mutateProject((next) => {
        const piece = next.pieces.find((item) => item.id === selectedPiece.id)
        const maxY = Math.max(...piece.points.map((point) => point.y))
        piece.points = piece.points.map((point) => {
          const influence = Math.max(0, 1 - point.y / Math.max(1, maxY * 0.36))
          return { ...point, y: point.y + centimeters * influence }
        })
      })
      setCommandResult(`${selectedPiece.name} cropped approximately ${centimeters} cm from the hem`)
    } else if (lower.includes('seam allowance') && selectedPiece && Number.isFinite(centimeters)) {
      updateSelectedPiece('seamAllowance', clamp(centimeters, 0, 8))
      setCommandResult(`Seam allowance set to ${centimeters} cm`)
    } else if (lower.includes('heavier')) {
      updateFabric('gsm', clamp(fabric.gsm + 40, 40, 900))
      setCommandResult('Fabric weight increased by 40 gsm')
    } else if (lower.includes('lighter')) {
      updateFabric('gsm', clamp(fabric.gsm - 40, 40, 900))
      setCommandResult('Fabric weight reduced by 40 gsm')
    } else if (lower.includes('reset') && lower.includes('sim')) {
      resetSimulation()
    } else if (lower.includes('simulate') || lower.includes('drape')) {
      setRunning(true)
      setCommandResult('Simulation started')
    } else {
      setCommandResult('Command understood as a future AI action. Current local verbs: widen %, crop cm, seam allowance cm, heavier/lighter fabric, simulate, reset simulation.')
    }
    setCommand('')
  }

  const estimatedLength = marker.length / 100

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">GS</div>
          <div><strong>GARMENT STUDIO</strong><span>PARAMETRIC FASHION CAD</span></div>
        </div>
        <nav className="section-tabs">
          {SECTIONS.map((section) => (
            <button key={section} className={activeSection === section ? 'active' : ''} onClick={() => setActiveSection(section)}>{section}</button>
          ))}
        </nav>
        <div className="file-actions">
          <button className="icon-button" title="Undo" disabled={!undoStack.length} onClick={undo}><Undo2 size={17} /></button>
          <button className="icon-button" title="Redo" disabled={!redoStack.length} onClick={redo}><Redo2 size={17} /></button>
          <span className="toolbar-divider" />
          <button className="icon-button" title="Import garment" onClick={() => importInputRef.current?.click()}><Upload size={17} /></button>
          <button className="icon-button" title="Export garment" onClick={exportProject}><Download size={17} /></button>
          <button className={`save-button ${saveState}`} onClick={saveProject}><Save size={15} />{saveState === 'saved' ? 'SAVED' : 'SAVE'}</button>
          <input ref={importInputRef} hidden type="file" accept=".json,.garment,.dxf" onChange={importProject} />
          <input ref={graphicInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={importGraphic} />
          <input ref={fabricTextureInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={importFabricTexture} />
          <input ref={fabricNormalInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => importFabricPbrMap(event, 'normal')} />
          <input ref={fabricRoughnessInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => importFabricPbrMap(event, 'roughness')} />
          <input ref={hdriInputRef} hidden type="file" accept=".hdr,image/vnd.radiance" onChange={importHdri} />
        </div>
      </header>

      <div className="project-strip">
        <div className="project-name">
          <span>PROJECT</span>
          <input
            value={project.name}
            onChange={(event) => mutateProject((next) => { next.name = event.target.value }, { record: false })}
          />
          <select className="template-select" value={project.templateId || 'custom'} onChange={(event) => event.target.value !== 'custom' && applyGarmentTemplate(event.target.value)}>
            <option value="custom">Custom</option>
            {GARMENT_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </div>
        <div className="project-meta"><span>REV {project.revision}</span><span>{project.pieces.length} PATTERNS</span><span>{project.seams.length} SEAMS</span></div>
        <form className="command-bar" onSubmit={runCommand}>
          <Sparkles size={15} />
          <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Tell the garment what to change…" />
          <button type="submit">RUN</button>
        </form>
      </div>

      <main className="main-layout">
        <aside className="tool-rail">
          <button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')} title="Select / move"><MousePointer2 size={18} /></button>
          <button className={tool === 'point' ? 'active' : ''} onClick={() => setTool('point')} title="Edit points"><PenTool size={18} /></button>
          <button className={tool === 'split' ? 'active' : ''} onClick={() => setTool('split')} title="Split edge / add point"><Plus size={18} /></button>
          <button className={tool === 'curve' ? 'active' : ''} onClick={() => setTool('curve')} title="Curve edges"><Spline size={18} /></button>
          <button className={tool === 'internal' ? 'active' : ''} onClick={() => setTool('internal')} title="Internal line / dart"><Scissors size={18} /></button>
          <button className={tool === 'pin' ? 'active' : ''} onClick={() => setTool('pin')} title="Manual cloth pin"><MapPin size={18} /></button>
          <button className={tool === 'notch' ? 'active' : ''} onClick={() => setTool('notch')} title="Add notch"><span className="notch-tool-symbol">N</span></button>
          <button className={tool === 'sew' ? 'active' : ''} onClick={() => setTool('sew')} title="Sew edges"><Link2 size={18} /></button>
          <button className={tool === 'fastener' ? 'active' : ''} onClick={() => setTool('fastener')} title="Button / snap / hook fastener"><span className="fastener-tool-symbol">●</span></button>
          <button className={tool === 'measure' ? 'active' : ''} onClick={() => setTool('measure')} title="Tape measure"><Ruler size={18} /></button>
          <span className="rail-divider" />
          <button onClick={addPiece} title="Add pattern"><Plus size={18} /></button>
          <button onClick={deleteSelectedPiece} disabled={!selectedPiece} title="Delete selected"><Trash2 size={18} /></button>
        </aside>

        <section className="workspaces">
          <PatternEditor
            project={displayProject}
            gradeNestProjects={gradeNestProjects}
            highlightSeamId={activeSection === 'Sewing' ? seamWalkId : null}
            selectedPieceId={selectedPieceId}
            tool={activeSection === 'Production' && gradePreviewSize !== project.grading?.baseSize ? 'inspect' : tool}
            onSelectPiece={setSelectedPieceId}
            onMovePiece={movePiece}
            onMovePoint={movePoint}
            onMoveCurve={moveCurve}
            onSplitEdge={splitPatternEdge}
            onDeletePoint={deletePatternPoint}
            onCreatePin={createPin}
            onRemovePin={removePin}
            onCreateInternalLine={createInternalLine}
            onCreateNotch={createNotch}
            onCreateSeam={createSeam}
            onCreateFastener={createFastener}
            onCreateMeasurement={createCustomMeasurement}
            onBeginGesture={beginGesture}
            onEndGesture={endGesture}
          />
          <GarmentViewport
            project={displayProject}
            running={running}
            resetSignal={resetSignal}
            wireframe={wireframe}
            analysisMode={analysisMode}
            backendId={displayProject.simulation?.backendId || 'browser-pbd'}
            exportSignal={meshExportSignal}
            glbExportSignal={glbExportSignal}
            renderSignal={renderSignal}
            hdriUrl={hdriUrl}
            onExportMesh={downloadObj}
            onExportGlb={downloadGlb}
            onRenderStill={downloadRenderStill}
            onStats={setStats}
          />
        </section>

        <aside className="inspector">
          <div className="inspector-head"><span>INSPECTOR</span><strong>{activeSection.toUpperCase()}</strong></div>

          {activeSection === 'Pattern' && (
            <>
              <div className="panel-section">
                <div className="panel-title"><span>Pattern pieces</span><button onClick={addPiece}><Plus size={14} /></button></div>
                <div className="piece-list">
                  {project.pieces.map((piece, index) => (
                    <button key={piece.id} className={piece.id === selectedPieceId ? 'active' : ''} onClick={() => setSelectedPieceId(piece.id)}>
                      <span>{String(index + 1).padStart(2, '0')}</span><strong>{piece.name}</strong><em>{pieceArea(piece).toFixed(0)} cm²</em>
                    </button>
                  ))}
                </div>
                {project.pieces.some((piece) => piece.arrangement3d?.wrap === 'front') && project.pieces.some((piece) => piece.arrangement3d?.wrap === 'back') && (
                  <div className="pattern-generator-grid">
                    <button className="wide-action compact-action" onClick={addRibNeckband}><Plus size={14} />RIB NECKBAND</button>
                    <button className="wide-action compact-action" onClick={addStandCollar}><Plus size={14} />STAND COLLAR</button>
                    <button className="wide-action compact-action" onClick={addTwoPanelHood}><Plus size={14} />2-PANEL HOOD</button>
                    <button className="wide-action compact-action" onClick={addRibFinishSet}><Plus size={14} />CUFFS + WAIST RIB</button>
                    <button className="wide-action compact-action" onClick={addKangarooPocket}><Plus size={14} />KANGAROO POCKET</button>
                  </div>
                )}
              </div>
              {selectedPiece && (
                <>
                  <div className="panel-section">
                    <div className="panel-title"><span>Selected pattern</span><button title={selectedPiece.locked ? 'Unlock 2D pattern editing' : 'Lock 2D pattern editing'} onClick={() => updateSelectedPiece('locked', !selectedPiece.locked)}>{selectedPiece.locked ? <Lock size={14} /> : <Unlock size={14} />}</button></div>
                    <label className="text-field"><span>Name</span><input value={selectedPiece.name} onChange={(event) => updateSelectedPiece('name', event.target.value)} /></label>
                    <div className="field-grid two">
                      <label><span>Points</span><strong>{selectedPiece.points.length}</strong></label>
                      <label><span>Area</span><strong>{selectedArea.toFixed(0)} cm²</strong></label>
                    </div>
                    <div className="control-row split-control"><span>Seam allowance</span><NumberField value={selectedPiece.seamAllowance} min={0} max={8} step={0.1} suffix="cm" onChange={(value) => updateSelectedPiece('seamAllowance', clamp(value, 0, 8))} /></div>
                    <div className="control-row split-control"><span>Grain angle</span><NumberField value={selectedPiece.grainAngleDeg ?? 0} min={-90} max={90} step={1} suffix="°" onChange={(value) => updateSelectedPiece('grainAngleDeg', clamp(value, -90, 90))} /></div>
                    <div className="control-row split-control"><span>Cut quantity</span><NumberField value={selectedPiece.cutQuantity ?? 1} min={1} max={99} step={1} suffix="×" onChange={(value) => updateSelectedPiece('cutQuantity', Math.max(1, Math.round(value)))} /></div>
                    <div className="control-row split-control"><span>Collision layer</span><NumberField value={selectedPiece.layerIndex ?? 0} min={0} max={8} step={1} suffix="L" onChange={(value) => updateSelectedPiece('layerIndex', Math.max(0, Math.min(8, Math.round(value))))} /></div>
                    <button className={`toggle-row ${selectedPiece.locked ? 'active' : ''}`} onClick={() => updateSelectedPiece('locked', !selectedPiece.locked)}><span><Lock size={15} />Lock 2D editing</span><i /></button>
                    <button className={`toggle-row ${selectedPiece.frozen3d ? 'active' : ''}`} onClick={() => updateSelectedPiece('frozen3d', !selectedPiece.frozen3d)}><span><Pause size={15} />Freeze 3D cloth</span><i /></button>
                    <button className={`toggle-row ${selectedPiece.active3d !== false ? 'active' : ''}`} onClick={() => updateSelectedPiece('active3d', selectedPiece.active3d === false)}><span><Cpu size={15} />Active in 3D solver</span><i /></button>
                    <button className={`toggle-row ${selectedPiece.strengthened ? 'active' : ''}`} onClick={() => updateSelectedPiece('strengthened', !selectedPiece.strengthened)}><span><Activity size={15} />Strengthen pattern</span><i /></button>
                    <button className={`toggle-row ${selectedPiece.visible3d !== false ? 'active' : ''}`} onClick={() => updateSelectedPiece('visible3d', selectedPiece.visible3d === false)}><span><Eye size={15} />Show pattern in 3D</span><i /></button>
                    {['hood-left', 'hood-right'].includes(selectedPiece.generatedRole) && (
                      <div className="hood-state-switch">
                        <span>Hood state</span>
                        <button className={(selectedPiece.hoodState || 'up') === 'up' ? 'active' : ''} onClick={() => setGeneratedHoodState('up')}>UP</button>
                        <button className={selectedPiece.hoodState === 'down' ? 'active' : ''} onClick={() => setGeneratedHoodState('down')}>DOWN</button>
                      </div>
                    )}
                    <button className={`toggle-row ${selectedPiece.marker?.allowCrossGrain ? 'active' : ''}`} onClick={() => updateSelectedMarker('allowCrossGrain', !selectedPiece.marker?.allowCrossGrain)}><span><RotateCcw size={15} />Allow 90° cross-grain marker rotation</span><i /></button>
                    <label className="select-field"><span>Simulation detail</span><select value={selectedPiece.simulationResolution ?? project.simulation.resolution ?? 1} onChange={(event) => updateSelectedPiece('simulationResolution', Number(event.target.value))}><option value={0}>Draft · coarse</option><option value={1}>Normal</option><option value={2}>Fine</option><option value={3}>Ultra</option></select></label>
                    {selectedPiece.linkedMirrorSourceId && (
                      <div className="linked-pattern-notice">
                        <div><Link2 size={13} /><span>Linked mirror</span></div>
                        <small>Geometry and construction follow {project.pieces.find((piece) => piece.id === selectedPiece.linkedMirrorSourceId)?.name || 'source pattern'}.</small>
                        <button onClick={unlinkSelectedMirror}>UNLINK</button>
                      </div>
                    )}
                    <div className="pattern-copy-actions">
                      <button onClick={() => duplicateSelectedPiece(false)}>DUPLICATE</button>
                      <button onClick={() => duplicateSelectedPiece(true)}>MIRROR COPY</button>
                      {!selectedPiece.linkedMirrorSourceId && <button onClick={() => duplicateSelectedPiece(true, true)}>LINKED MIRROR</button>}
                      {!['lining', 'interfacing'].includes(selectedPiece.generatedRole) && <button onClick={createLiningCopy}>CREATE LINING</button>}
                      {!['lining', 'interfacing'].includes(selectedPiece.generatedRole) && <button onClick={createInterfacingCopy}>CREATE INTERFACING</button>}
                    </div>
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>Edge seam allowances</span><strong>{Object.keys(selectedPiece.edgeSeamAllowances || {}).length} CUSTOM</strong></div>
                    <p className="panel-copy">Each edge inherits the pattern default above until overridden. Use wider allowances for hems, zipper fronts, facings, or special construction without changing the rest of the pattern.</p>
                    <div className="edge-allowance-list">
                      {selectedPiece.points.map((_, edgeIndex) => {
                        const custom = selectedPiece.edgeSeamAllowances?.[edgeIndex] !== undefined
                        return (
                          <div className={`edge-allowance-row ${custom ? 'custom' : ''}`} key={`${selectedPiece.id}-allowance-${edgeIndex}`}>
                            <span>E{String(edgeIndex + 1).padStart(2, '0')}</span>
                            <em>{edgeLength(selectedPiece, edgeIndex).toFixed(1)} cm</em>
                            <NumberField value={getEdgeSeamAllowance(selectedPiece, edgeIndex)} min={0} max={8} step={0.1} suffix="cm" onChange={(value) => updateSelectedEdgeAllowance(edgeIndex, value)} />
                          </div>
                        )
                      })}
                    </div>
                    {Object.keys(selectedPiece.edgeSeamAllowances || {}).length > 0 && <button className="wide-action compact-action" onClick={resetSelectedEdgeAllowances}><RotateCcw size={14} />RESET EDGE OVERRIDES</button>}
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>Pattern transform</span><strong>PRECISE</strong></div>
                    <div className="transform-grid">
                      <div><span>Scale X</span><NumberField value={transformDraft.scaleX} min={10} max={300} step={1} suffix="%" onChange={(value) => setTransformDraft((current) => ({ ...current, scaleX: value }))} /></div>
                      <div><span>Scale Y</span><NumberField value={transformDraft.scaleY} min={10} max={300} step={1} suffix="%" onChange={(value) => setTransformDraft((current) => ({ ...current, scaleY: value }))} /></div>
                      <div><span>Rotate</span><NumberField value={transformDraft.rotateDeg} min={-180} max={180} step={1} suffix="°" onChange={(value) => setTransformDraft((current) => ({ ...current, rotateDeg: value }))} /></div>
                    </div>
                    <button className="wide-action" onClick={applyPatternTransform}><RotateCcw size={15} />APPLY SCALE / ROTATION</button>
                    <div className="control-row split-control"><span>Slash / spread hem</span><NumberField value={transformDraft.slashCm} min={-20} max={30} step={0.5} suffix="cm" onChange={(value) => setTransformDraft((current) => ({ ...current, slashCm: value }))} /></div>
                    <button className="wide-action compact-action" onClick={applySlashSpread}><Spline size={15} />APPLY SLASH / SPREAD</button>
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>Tape measurements</span><strong>{(project.customMeasurements || []).filter((measurement) => measurement.pieceId === selectedPiece.id).length}</strong></div>
                    <p className="panel-copy">Use the ruler tool and click two points on this pattern. Measurements stay attached to pattern coordinates and feed the graded POM/tech-pack export.</p>
                    <div className="custom-measure-list">
                      {(project.customMeasurements || []).filter((measurement) => measurement.pieceId === selectedPiece.id).map((measurement) => {
                        const cm = Math.hypot(measurement.b.x - measurement.a.x, measurement.b.y - measurement.a.y)
                        return (
                          <div className="custom-measure-row" key={measurement.id}>
                            <div className="custom-measure-head">
                              <input value={measurement.label || ''} onChange={(event) => updateCustomMeasurement(measurement.id, 'label', event.target.value)} />
                              <strong>{cm.toFixed(1)} cm</strong>
                              <button onClick={() => removeCustomMeasurement(measurement.id)}><Trash2 size={12} /></button>
                            </div>
                            <div className="control-row split-control"><span>Tolerance</span><NumberField value={measurement.toleranceCm ?? 0.5} min={0} max={5} step={0.1} suffix="cm" onChange={(value) => updateCustomMeasurement(measurement.id, 'toleranceCm', clamp(value, 0, 5))} /></div>
                          </div>
                        )
                      })}
                    </div>
                    <button className="wide-action" onClick={() => setTool('measure')}><Ruler size={14} />PLACE TAPE MEASUREMENT</button>
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>Artwork / graphics</span><strong>{selectedPiece.graphics?.length || 0}</strong></div>
                    <p className="panel-copy">Placed artwork is clipped to the 2D pattern and projected onto the live simulated cloth in 3D.</p>
                    <button className="wide-action" onClick={() => graphicInputRef.current?.click()}><Upload size={14} />PLACE IMAGE</button>
                    <div className="graphic-editor-list">
                      {(selectedPiece.graphics || []).map((graphic) => (
                        <div className="graphic-editor-item" key={graphic.id}>
                          <div className="graphic-editor-head">
                            <img src={graphic.src} alt="" />
                            <div><strong>{graphic.name || 'Artwork'}</strong><small>{graphic.widthCm?.toFixed?.(1) || graphic.widthCm} × {graphic.heightCm?.toFixed?.(1) || graphic.heightCm} cm</small></div>
                            <button onClick={() => removeGraphic(selectedPiece.id, graphic.id)}><Trash2 size={12} /></button>
                          </div>
                          <div className="graphic-field-grid">
                            <div><span>X</span><NumberField value={graphic.x ?? 0} min={-100} max={100} step={0.5} suffix="cm" onChange={(value) => updateGraphic(selectedPiece.id, graphic.id, 'x', value)} /></div>
                            <div><span>Y</span><NumberField value={graphic.y ?? 0} min={-100} max={150} step={0.5} suffix="cm" onChange={(value) => updateGraphic(selectedPiece.id, graphic.id, 'y', value)} /></div>
                            <div><span>W</span><NumberField value={graphic.widthCm ?? 20} min={1} max={120} step={0.5} suffix="cm" onChange={(value) => updateGraphic(selectedPiece.id, graphic.id, 'widthCm', clamp(value, 1, 120))} /></div>
                            <div><span>H</span><NumberField value={graphic.heightCm ?? 20} min={1} max={120} step={0.5} suffix="cm" onChange={(value) => updateGraphic(selectedPiece.id, graphic.id, 'heightCm', clamp(value, 1, 120))} /></div>
                            <div><span>ROT</span><NumberField value={graphic.rotationDeg ?? 0} min={-180} max={180} step={1} suffix="°" onChange={(value) => updateGraphic(selectedPiece.id, graphic.id, 'rotationDeg', value)} /></div>
                            <div><span>OP</span><NumberField value={(graphic.opacity ?? 1) * 100} min={0} max={100} step={1} suffix="%" onChange={(value) => updateGraphic(selectedPiece.id, graphic.id, 'opacity', clamp(value, 0, 100) / 100)} /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>Internal geometry</span><strong>{selectedPiece.internalLines?.length || 0}</strong></div>
                    <p className="panel-copy">Use the internal-line tool and drag inside the pattern. Construction, fold, and dart lines stay attached to the pattern and export to production DXF.</p>
                    <div className="internal-line-list">
                      {(selectedPiece.internalLines || []).map((line, index) => (
                        <div className="internal-line-row" key={line.id}>
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <select value={line.type || 'construction'} onChange={(event) => updateInternalLine(selectedPiece.id, line.id, 'type', event.target.value)}>
                            <option value="construction">Construction</option>
                            <option value="fold">Fold</option>
                            <option value="dart">Dart</option>
                            <option value="pleat">Pleat set</option>
                          </select>
                          {line.type === 'fold' && <NumberField value={line.foldAngleDeg ?? 135} min={0} max={180} step={5} suffix="°" onChange={(value) => updateInternalLine(selectedPiece.id, line.id, 'foldAngleDeg', clamp(value, 0, 180))} />}
                          {line.type === 'dart' && <NumberField value={line.widthCm ?? 2.5} min={0.5} max={8} step={0.1} suffix="cm" onChange={(value) => updateInternalLine(selectedPiece.id, line.id, 'widthCm', clamp(value, 0.5, 8))} />}
                          {line.type === 'pleat' && <div className="pleat-inline-controls"><NumberField value={line.count ?? 5} min={1} max={16} step={1} suffix="×" onChange={(value) => updateInternalLine(selectedPiece.id, line.id, 'count', Math.max(1, Math.round(value)))} /><NumberField value={line.spacingCm ?? 4} min={1} max={20} step={0.5} suffix="sp" onChange={(value) => updateInternalLine(selectedPiece.id, line.id, 'spacingCm', clamp(value, 1, 20))} /><NumberField value={line.depthCm ?? 3} min={0.5} max={12} step={0.5} suffix="dp" onChange={(value) => updateInternalLine(selectedPiece.id, line.id, 'depthCm', clamp(value, 0.5, 12))} /></div>}
                          <button onClick={() => removeInternalLine(selectedPiece.id, line.id)}><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                    <button className="wide-action" onClick={() => setTool('internal')}><Scissors size={15} />DRAW INTERNAL LINE</button>
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>Manual cloth pins</span><strong>{selectedPiece.pins?.length || 0}</strong></div>
                    <p className="panel-copy">Manual pins hold the nearest cloth particle at the pattern's current 3D arrangement point while the rest of the garment drapes.</p>
                    <div className="pin-list">
                      {(selectedPiece.pins || []).map((pin, index) => (
                        <div className="pin-row" key={pin.id}>
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <em>{pin.x.toFixed(1)}, {pin.y.toFixed(1)} cm</em>
                          <button onClick={() => removePin(selectedPiece.id, pin.id)}><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                    <button className="wide-action" onClick={() => setTool('pin')}><MapPin size={15} />ADD MANUAL PIN</button>
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>Production notches</span><strong>{selectedPiece.notches?.length || 0}</strong></div>
                    <p className="panel-copy">Notches stay attached by arc-length position, so they follow the edge when you reshape a curve. Single and double notches export into DXF.</p>
                    <div className="notch-list">
                      {(selectedPiece.notches || []).map((notch, index) => {
                        const seams = notchSeams(selectedPiece.id, notch.edgeIndex, notch.t)
                        const matchedSeam = notch.matchedSeamId ? project.seams.find((seam) => seam.id === notch.matchedSeamId) : null
                        const matchableSeam = matchedSeam || seams[0]
                        return (
                          <div className={`notch-row ${matchedSeam ? 'matched' : ''}`} key={notch.id}>
                            <span>{String(index + 1).padStart(2, '0')}</span>
                            <em>E{notch.edgeIndex + 1}</em>
                            <select value={notch.type || 'single'} onChange={(event) => updateNotch(selectedPiece.id, notch.id, 'type', event.target.value)}>
                              <option value="single">Single</option>
                              <option value="double">Double</option>
                            </select>
                            <NumberField value={(notch.t ?? 0.5) * 100} min={1} max={99} step={1} suffix="%" onChange={(value) => updateNotch(selectedPiece.id, notch.id, 't', clamp(value / 100, 0.01, 0.99))} />
                            <button
                              className={matchedSeam ? 'notch-match active' : 'notch-match'}
                              disabled={!matchableSeam || Boolean(matchedSeam)}
                              title={matchedSeam ? `Matched across ${matchedSeam.name}` : matchableSeam ? `Match across ${matchableSeam.name}` : 'This edge is not sewn'}
                              onClick={() => matchableSeam && matchNotchAcrossSeam(selectedPiece.id, notch.id, matchableSeam.id)}
                            ><Link2 size={12} /></button>
                            <button onClick={() => removeNotch(selectedPiece.id, notch.id)}><Trash2 size={13} /></button>
                          </div>
                        )
                      })}
                    </div>
                    <button className="wide-action" onClick={() => setTool('notch')}><span className="notch-action-symbol">N</span>ADD EDGE NOTCH</button>
                  </div>
                  <div className="panel-section">
                    <div className="panel-title"><span>3D arrangement</span><Box size={15} /></div>
                    <label className="select-field"><span>Placement mode</span><select value={selectedPiece.arrangement3d?.wrap || 'flat'} onChange={(event) => updateSelectedArrangement('wrap', event.target.value === 'flat' ? undefined : event.target.value)}><option value="flat">Flat plane</option><option value="front">Wrap front torso</option><option value="back">Wrap back torso</option><option value="left-arm">Wrap left arm</option><option value="right-arm">Wrap right arm</option></select></label>
                    <div className="arrangement-grid">
                      <div><span>X</span><NumberField value={(selectedPiece.arrangement3d?.x || 0) * 100} min={-200} max={200} step={0.5} suffix="cm" onChange={(value) => updateSelectedArrangement('x', value / 100)} /></div>
                      <div><span>Y</span><NumberField value={(selectedPiece.arrangement3d?.y || 0) * 100} min={0} max={250} step={0.5} suffix="cm" onChange={(value) => updateSelectedArrangement('y', value / 100)} /></div>
                      <div><span>Z</span><NumberField value={(selectedPiece.arrangement3d?.z || 0) * 100} min={-150} max={150} step={0.5} suffix="cm" onChange={(value) => updateSelectedArrangement('z', value / 100)} /></div>
                    </div>
                    <button className={`toggle-row ${selectedPiece.arrangement3d?.flip ? 'active' : ''}`} onClick={() => updateSelectedArrangement('flip', !selectedPiece.arrangement3d?.flip)}><span><RotateCcw size={15} />Flip pattern orientation</span><i /></button>
                  </div>
                </>
              )}
            </>
          )}

          {activeSection === 'Sewing' && (
            <>
              <div className="panel-section grow-section">
                <div className="panel-title"><span>Seam graph</span><strong>{project.seams.length}</strong></div>
                <p className="panel-copy">Choose the sew tool, then click two pattern edges. The same seam relationship is sent directly to the cloth solver.</p>
                <div className="seam-health-strip">
                  <span><i className="good" />{project.seams.filter((seam) => seamLengthReport(project, seam).status === 'good').length} matched</span>
                  <span><i className="warning" />{project.seams.filter((seam) => seamLengthReport(project, seam).status === 'warning').length} warning</span>
                  <span><i className="error" />{project.seams.filter((seam) => seamLengthReport(project, seam).status === 'error').length} mismatch</span>
                </div>
                <div className="seam-list">
                  {project.seams.map((seam, index) => (
                    <div key={seam.id} className={`seam-item seam-${seamLengthReport(project, seam).status}`}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{seam.name}</strong>
                        <em>{seam.a.pieceId}:{seam.a.edgeIndex} ↔ {seam.b.pieceId}:{seam.b.edgeIndex}</em>
                        <small>{seamLengthReport(project, seam).lengthA.toFixed(1)} / {seamLengthReport(project, seam).lengthB.toFixed(1)} cm · {seamLengthReport(project, seam).mismatchPercent.toFixed(1)}% mismatch</small>
                        <div className="seam-range-mode">
                          <button className={seam.a?.startT === undefined && seam.a?.endT === undefined && seam.b?.startT === undefined && seam.b?.endT === undefined ? 'active' : ''} onClick={() => setSeamPartial(seam.id, false)}>FULL</button>
                          <button className={seam.a?.startT !== undefined || seam.a?.endT !== undefined || seam.b?.startT !== undefined || seam.b?.endT !== undefined ? 'active' : ''} onClick={() => setSeamPartial(seam.id, true)}>PARTIAL</button>
                        </div>
                        {(seam.a?.startT !== undefined || seam.a?.endT !== undefined || seam.b?.startT !== undefined || seam.b?.endT !== undefined) && (
                          <div className="seam-range-controls">
                            <div><span>A start</span><NumberField value={(seam.a?.startT ?? 0) * 100} min={0} max={98} step={1} suffix="%" onChange={(value) => updateSeamRange(seam.id, 'a', 'startT', value / 100)} /></div>
                            <div><span>A end</span><NumberField value={(seam.a?.endT ?? 1) * 100} min={2} max={100} step={1} suffix="%" onChange={(value) => updateSeamRange(seam.id, 'a', 'endT', value / 100)} /></div>
                            <div><span>B start</span><NumberField value={(seam.b?.startT ?? 0) * 100} min={0} max={98} step={1} suffix="%" onChange={(value) => updateSeamRange(seam.id, 'b', 'startT', value / 100)} /></div>
                            <div><span>B end</span><NumberField value={(seam.b?.endT ?? 1) * 100} min={2} max={100} step={1} suffix="%" onChange={(value) => updateSeamRange(seam.id, 'b', 'endT', value / 100)} /></div>
                          </div>
                        )}
                        <div className="seam-treatment-controls">
                          <select value={seam.type || 'normal'} onChange={(event) => updateSeam(seam.id, 'type', event.target.value)}>
                            <option value="normal">Normal sew</option>
                            <option value="zipper">Zipper</option>
                            <option value="ease">Ease</option>
                            <option value="elastic">Elastic</option>
                            <option value="gather">Gather</option>
                            <option value="binding">Binding</option>
                          </select>
                          {seam.type === 'zipper' && <NumberField value={(seam.openFraction ?? 0) * 100} min={0} max={100} step={5} suffix="% open" onChange={(value) => updateSeam(seam.id, 'openFraction', clamp(value, 0, 100) / 100)} />}
                          {seam.type === 'zipper' && <select value={seam.openFrom || 'end'} onChange={(event) => updateSeam(seam.id, 'openFrom', event.target.value)}><option value="end">Open from end</option><option value="start">Open from start</option></select>}
                          {['elastic', 'gather', 'ease'].includes(seam.type) && <NumberField value={(seam.ratio ?? (seam.type === 'gather' ? 0.7 : seam.type === 'elastic' ? 0.85 : 0.96)) * 100} min={30} max={120} step={1} suffix="%" onChange={(value) => updateSeam(seam.id, 'ratio', clamp(value, 30, 120) / 100)} />}
                          {seam.type === 'gather' && <select value={seam.gatherSide || 'a'} onChange={(event) => updateSeam(seam.id, 'gatherSide', event.target.value)}><option value="a">Gather A</option><option value="b">Gather B</option></select>}
                          {seam.type === 'ease' && <select value={seam.easeSide || 'a'} onChange={(event) => updateSeam(seam.id, 'easeSide', event.target.value)}><option value="a">Ease A</option><option value="b">Ease B</option></select>}
                        </div>
                        <div className="seam-quick-actions">
                          <button className={seam.reverseB ? 'active' : ''} onClick={() => updateSeam(seam.id, 'reverseB', !seam.reverseB)}>REVERSE B</button>
                          <button className={seamWalkId === seam.id ? 'active' : ''} onClick={() => { setSeamWalkId((current) => current === seam.id ? null : seam.id); setSeamWalkProgress(0.5) }}>WALK</button>
                          {seamLengthReport(project, seam).mismatchPercent > 2 && <button onClick={() => autoEaseSeam(seam.id)}>AUTO MATCH</button>}
                        </div>
                      </div>
                      <button onClick={() => removeSeam(seam.id)}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
                {seamWalk && (
                  <div className="seam-walk-card">
                    <div className="seam-walk-head">
                      <div><span>SEAM WALK</span><strong>{seamWalk.name}</strong></div>
                      <button onClick={() => setSeamWalkId(null)}>CLOSE</button>
                    </div>
                    <SeamWalkPreview report={seamWalk} progress={seamWalkProgress} />
                    <div className="seam-walk-metrics">
                      <div><span>Edge A</span><strong>{seamWalk.lengthA.toFixed(2)} cm</strong></div>
                      <div><span>Edge B</span><strong>{seamWalk.lengthB.toFixed(2)} cm</strong></div>
                      <div><span>Length delta</span><strong>{seamWalk.difference.toFixed(2)} cm</strong></div>
                      <div><span>Shape deviation</span><strong>{seamWalk.maxShapeDeviationCm.toFixed(2)} cm max</strong></div>
                    </div>
                    <SliderRow label="Walk position" value={seamWalkProgress * 100} min={0} max={100} step={1} display={`${Math.round(seamWalkProgress * 100)}%`} onChange={(value) => setSeamWalkProgress(clamp(value / 100, 0, 1))} />
                    {(() => {
                      const index = Math.max(0, Math.min(seamWalk.samples.length - 1, Math.round(seamWalkProgress * (seamWalk.samples.length - 1))))
                      const sample = seamWalk.samples[index]
                      return sample ? (
                        <div className="seam-walk-position">
                          <span>A {sample.distanceA.toFixed(1)} cm</span>
                          <span>B {sample.distanceB.toFixed(1)} cm</span>
                          <strong>{sample.cumulativeDeltaCm >= 0 ? '+' : ''}{sample.cumulativeDeltaCm.toFixed(2)} cm cumulative</strong>
                        </div>
                      ) : null
                    })()}
                    <div className="seam-walk-actions">
                      <button onClick={() => addSeamWalkNotches(seamWalk.seamId)}>ADD ¼ · ½ · ¾ MATCH NOTCHES</button>
                      {seamWalk.mismatchPercent > 2 && <button onClick={() => autoEaseSeam(seamWalk.seamId)}>AUTO EASE TO MATCH</button>}
                    </div>
                  </div>
                )}
                <button className="wide-action" onClick={() => { setTool('sew'); setActiveSection('Sewing') }}><Link2 size={15} />SEW NEW EDGES</button>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Point fasteners</span><strong>{project.fasteners?.length || 0}</strong></div>
                <p className="panel-copy">Place a mating pair directly on two patterns. Closed buttons, snaps, and hooks become physical point constraints in the cloth solver.</p>
                <div className="fastener-list">
                  {(project.fasteners || []).map((fastener, index) => (
                    <div className={`fastener-row ${fastener.closed === false ? 'open' : 'closed'}`} key={fastener.id}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{fastener.name}</strong>
                        <small>{fastener.a?.pieceId} ↔ {fastener.b?.pieceId}</small>
                      </div>
                      <select value={fastener.type || 'button'} onChange={(event) => updateFastener(fastener.id, 'type', event.target.value)}>
                        <option value="button">Button</option>
                        <option value="snap">Snap</option>
                        <option value="hook">Hook</option>
                      </select>
                      <button className={`fastener-state ${fastener.closed === false ? '' : 'active'}`} onClick={() => updateFastener(fastener.id, 'closed', fastener.closed === false)}>{fastener.closed === false ? 'OPEN' : 'CLOSED'}</button>
                      <button className="fastener-delete" onClick={() => removeFastener(fastener.id)}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
                <button className="wide-action" onClick={() => { setTool('fastener'); setActiveSection('Sewing') }}><Plus size={14} />PLACE FASTENER PAIR</button>
              </div>
              {selectedPiece && (
                <div className="panel-section trim-editor">
                  <div className="panel-title"><span>Edge construction · {selectedPiece.name}</span><strong>{stats.trims} LIVE</strong></div>
                  <label className="select-field"><span>Target edge</span><select value={trimEdgeIndex} onChange={(event) => setTrimEdgeIndex(Number(event.target.value))}>{selectedPiece.points.map((_, edgeIndex) => <option key={edgeIndex} value={edgeIndex}>Edge {edgeIndex + 1} · {edgeLength(selectedPiece, edgeIndex).toFixed(1)} cm</option>)}</select></label>
                  <div className="trim-add-grid">
                    <button onClick={() => addTopstitch(selectedPiece.id, trimEdgeIndex)}>+ TOPSTITCH</button>
                    <button onClick={() => addBinding(selectedPiece.id, trimEdgeIndex)}>+ BINDING</button>
                    <button onClick={() => addZipper(selectedPiece.id, trimEdgeIndex)}>+ ZIPPER</button>
                    <button onClick={() => addButtonRow(selectedPiece.id, 5)}>+ 5 BUTTONS</button>
                    <button onClick={() => addButtonholeRow(selectedPiece.id, 5)}>+ 5 BUTTONHOLES</button>
                  </div>

                  <div className="trim-editor-list">
                    {(selectedPiece.topstitches || []).map((stitch) => (
                      <div key={stitch.id} className="trim-editor-item">
                        <div><strong>Topstitch · E{stitch.edgeIndex + 1}</strong><small>{stitch.rows || 1} row · {stitch.stitchLengthMm || 3} mm stitch</small></div>
                        <NumberField value={stitch.offsetCm ?? 0.7} min={0} max={5} step={0.1} suffix="cm" onChange={(value) => updatePieceTrim(selectedPiece.id, 'topstitches', stitch.id, 'offsetCm', clamp(value, 0, 5))} />
                        <select value={stitch.rows || 1} onChange={(event) => updatePieceTrim(selectedPiece.id, 'topstitches', stitch.id, 'rows', Number(event.target.value))}><option value={1}>1 row</option><option value={2}>2 rows</option><option value={3}>3 rows</option></select>
                        <button onClick={() => removePieceTrim(selectedPiece.id, 'topstitches', stitch.id)}><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {(selectedPiece.bindings || []).map((binding) => (
                      <div key={binding.id} className="trim-editor-item">
                        <div><strong>Binding · E{binding.edgeIndex + 1}</strong><small>{Math.round((binding.ratio ?? 0.96) * 100)}% edge ratio</small></div>
                        <NumberField value={(binding.ratio ?? 0.96) * 100} min={60} max={110} step={1} suffix="%" onChange={(value) => updatePieceTrim(selectedPiece.id, 'bindings', binding.id, 'ratio', clamp(value, 60, 110) / 100)} />
                        <NumberField value={binding.widthCm ?? 1.8} min={0.5} max={8} step={0.1} suffix="cm" onChange={(value) => updatePieceTrim(selectedPiece.id, 'bindings', binding.id, 'widthCm', clamp(value, 0.5, 8))} />
                        <button onClick={() => removePieceTrim(selectedPiece.id, 'bindings', binding.id)}><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {(selectedPiece.zippers || []).map((zipper) => (
                      <div key={zipper.id} className="trim-editor-item">
                        <div><strong>Zipper · E{zipper.edgeIndex + 1}</strong><small>{zipper.type || 'coil'} tape</small></div>
                        <NumberField value={zipper.widthCm ?? 1.2} min={0.5} max={5} step={0.1} suffix="cm" onChange={(value) => updatePieceTrim(selectedPiece.id, 'zippers', zipper.id, 'widthCm', clamp(value, 0.5, 5))} />
                        <span />
                        <button onClick={() => removePieceTrim(selectedPiece.id, 'zippers', zipper.id)}><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {(selectedPiece.buttonholes || []).map((buttonhole, index) => (
                      <div key={buttonhole.id} className="trim-editor-item buttonhole-editor-item">
                        <div><strong>Buttonhole {index + 1}</strong><small>{buttonhole.lengthCm ?? 2.4} cm · {Math.round(buttonhole.orientationDeg || 0)}°</small></div>
                        <NumberField value={buttonhole.lengthCm ?? 2.4} min={0.8} max={6} step={0.1} suffix="cm" onChange={(value) => updateButtonhole(selectedPiece.id, buttonhole.id, 'lengthCm', clamp(value, 0.8, 6))} />
                        <NumberField value={buttonhole.orientationDeg ?? 0} min={-180} max={180} step={5} suffix="°" onChange={(value) => updateButtonhole(selectedPiece.id, buttonhole.id, 'orientationDeg', clamp(value, -180, 180))} />
                        <button onClick={() => removeButtonhole(selectedPiece.id, buttonhole.id)}><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {(selectedPiece.buttons || []).length > 0 && (
                      <div className="trim-editor-item trim-summary-item">
                        <div><strong>Buttons</strong><small>{selectedPiece.buttons.length} placed on pattern</small></div>
                        <button className="trim-clear" onClick={() => mutateProject((next) => {
                          const piece = next.pieces.find((item) => item.id === selectedPiece.id)
                          if (!piece) return
                          piece.buttons = []
                          piece.buttonholes = (piece.buttonholes || []).map((buttonhole) => ({ ...buttonhole, pairedButtonId: null }))
                        })}>CLEAR ALL</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {activeSection === 'Fabric' && (
            <>
              <div className="panel-section">
                <div className="panel-title"><span>Fabric library</span><button onClick={addFabricSwatch}><Plus size={14} /></button></div>
                <div className="fabric-library">
                  {Object.entries(project.fabrics || {}).map(([fabricId, item]) => {
                    const usage = project.pieces.filter((piece) => (piece.fabricId || 'main') === fabricId).length
                    return (
                      <button key={fabricId} className={selectedFabricId === fabricId ? 'active' : ''} onClick={() => setSelectedFabricId(fabricId)}>
                        <i style={{ background: item.color || '#777777' }} />
                        <div><strong>{item.name || fabricId}</strong><small>{item.gsm || 0} gsm · {usage} pattern{usage === 1 ? '' : 's'}</small></div>
                        <span>{fabricId === 'main' ? 'MAIN' : 'SWATCH'}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Physical fabric</span><strong>{selectedFabricId.toUpperCase().slice(0, 10)}</strong></div>
                <label className="text-field"><span>Name</span><input value={fabric.name || ''} onChange={(event) => updateFabric('name', event.target.value)} /></label>
                <label className="select-field"><span>Preset</span><select value={Object.keys(FABRIC_PRESETS).find((key) => FABRIC_PRESETS[key].name === fabric.name) || ''} onChange={(event) => applyFabricPreset(event.target.value)}><option value="">Custom</option>{Object.entries(FABRIC_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.name}</option>)}</select></label>
                <label className="color-field"><span>Surface color</span><input type="color" value={fabric.color} onChange={(event) => updateFabric('color', event.target.value)} /><strong>{fabric.color.toUpperCase()}</strong></label>
                {selectedPiece && <label className="select-field"><span>{selectedPiece.name} material</span><select value={selectedPiece.fabricId || 'main'} onChange={(event) => updateSelectedPiece('fabricId', event.target.value)}>{Object.entries(project.fabrics || {}).map(([fabricId, item]) => <option key={fabricId} value={fabricId}>{item.name || fabricId}</option>)}</select></label>}
                {selectedFabricId !== 'main' && <button className="wide-action danger-action" onClick={() => deleteFabricSwatch(selectedFabricId)}><Trash2 size={14} />DELETE SWATCH · REASSIGN TO MAIN</button>}
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Textile surface</span><strong>{fabric.texture?.src ? 'MAPPED' : 'COLOR'}</strong></div>
                {fabric.texture?.src ? (
                  <>
                    <div className="fabric-texture-card">
                      <img src={fabric.texture.src} alt="" />
                      <div><strong>{fabric.texture.name || 'Surface texture'}</strong><small>Pattern-centimeter UV · follows grainline</small></div>
                      <button onClick={removeFabricTexture}><Trash2 size={12} /></button>
                    </div>
                    <div className="field-grid two">
                      <div><span>Repeat W</span><NumberField value={fabric.texture.repeatWidthCm ?? 20} min={0.5} max={200} step={0.5} suffix="cm" onChange={(value) => updateFabricTexture('repeatWidthCm', clamp(value, 0.5, 200))} /></div>
                      <div><span>Repeat H</span><NumberField value={fabric.texture.repeatHeightCm ?? 20} min={0.5} max={200} step={0.5} suffix="cm" onChange={(value) => updateFabricTexture('repeatHeightCm', clamp(value, 0.5, 200))} /></div>
                    </div>
                    <div className="control-row split-control"><span>Texture rotation</span><NumberField value={fabric.texture.rotationDeg ?? 0} min={-180} max={180} step={1} suffix="°" onChange={(value) => updateFabricTexture('rotationDeg', value)} /></div>
                    <button className="wide-action" onClick={() => fabricTextureInputRef.current?.click()}><Upload size={14} />REPLACE TEXTURE</button>
                  </>
                ) : (
                  <>
                    <p className="panel-copy">Upload a weave, knit, print, wash, or photographed textile. Repeat dimensions are interpreted in real garment centimeters.</p>
                    <button className="wide-action" onClick={() => fabricTextureInputRef.current?.click()}><Upload size={14} />UPLOAD TEXTILE IMAGE</button>
                  </>
                )}
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Textile PBR maps</span><strong>{[fabric.texture?.normalSrc, fabric.texture?.roughnessSrc].filter(Boolean).length}/2</strong></div>
                <p className="panel-copy">Normal and roughness maps share the color texture's real-centimeter repeat and grain rotation, so weave detail stays registered to the pattern.</p>
                {fabric.texture?.normalSrc ? (
                  <div className="fabric-texture-card">
                    <img src={fabric.texture.normalSrc} alt="" />
                    <div><strong>{fabric.texture.normalName || 'Normal map'}</strong><small>Linear normal detail · shared textile UV</small></div>
                    <button onClick={() => removeFabricPbrMap('normal')}><Trash2 size={12} /></button>
                  </div>
                ) : <button className="wide-action compact-action" onClick={() => fabricNormalInputRef.current?.click()}><Upload size={14} />LOAD NORMAL MAP</button>}
                {fabric.texture?.roughnessSrc ? (
                  <div className="fabric-texture-card">
                    <img src={fabric.texture.roughnessSrc} alt="" />
                    <div><strong>{fabric.texture.roughnessName || 'Roughness map'}</strong><small>Linear roughness · green channel</small></div>
                    <button onClick={() => removeFabricPbrMap('roughness')}><Trash2 size={12} /></button>
                  </div>
                ) : <button className="wide-action compact-action" onClick={() => fabricRoughnessInputRef.current?.click()}><Upload size={14} />LOAD ROUGHNESS MAP</button>}
                {fabric.texture?.normalSrc && <button className="wide-action compact-action" onClick={() => fabricNormalInputRef.current?.click()}><Upload size={13} />REPLACE NORMAL</button>}
                {fabric.texture?.roughnessSrc && <button className="wide-action compact-action" onClick={() => fabricRoughnessInputRef.current?.click()}><Upload size={13} />REPLACE ROUGHNESS</button>}
                <SliderRow label="Normal strength" value={fabric.normalStrength ?? 1} min={0} max={4} step={0.05} display={`${(fabric.normalStrength ?? 1).toFixed(2)}×`} onChange={(value) => updateFabric('normalStrength', value)} />
                <SliderRow label="Surface roughness" value={fabric.roughness ?? 0.82} min={0.04} max={1} step={0.01} display={(fabric.roughness ?? 0.82).toFixed(2)} onChange={(value) => updateFabric('roughness', value)} />
                <SliderRow label="Sheen" value={fabric.sheen ?? 0.22} min={0} max={1} step={0.01} display={(fabric.sheen ?? 0.22).toFixed(2)} onChange={(value) => updateFabric('sheen', value)} />
                <SliderRow label="Sheen roughness" value={fabric.sheenRoughness ?? 0.84} min={0.04} max={1} step={0.01} display={(fabric.sheenRoughness ?? 0.84).toFixed(2)} onChange={(value) => updateFabric('sheenRoughness', value)} />
                <SliderRow label="Metalness" value={fabric.metalness ?? 0} min={0} max={1} step={0.01} display={(fabric.metalness ?? 0).toFixed(2)} onChange={(value) => updateFabric('metalness', value)} />
              </div>
              <div className="panel-section">
                <SliderRow label="Weight" value={fabric.gsm} min={40} max={900} step={5} display={`${fabric.gsm} gsm`} onChange={(value) => updateFabric('gsm', value)} />
                <SliderRow label="Warp stretch" value={fabric.stretchWarp} min={0} max={0.5} step={0.005} display={`${Math.round(fabric.stretchWarp * 100)}%`} onChange={(value) => updateFabric('stretchWarp', value)} />
                <SliderRow label="Weft stretch" value={fabric.stretchWeft} min={0} max={0.5} step={0.005} display={`${Math.round(fabric.stretchWeft * 100)}%`} onChange={(value) => updateFabric('stretchWeft', value)} />
                <SliderRow label="Warp shrink" value={fabric.shrinkWarp ?? 0} min={-0.15} max={0.25} step={0.005} display={`${Math.round((fabric.shrinkWarp ?? 0) * 100)}%`} onChange={(value) => updateFabric('shrinkWarp', value)} />
                <SliderRow label="Weft shrink" value={fabric.shrinkWeft ?? 0} min={-0.15} max={0.25} step={0.005} display={`${Math.round((fabric.shrinkWeft ?? 0) * 100)}%`} onChange={(value) => updateFabric('shrinkWeft', value)} />
                <SliderRow label="Thickness" value={(fabric.thickness ?? 0.002) * 1000} min={0.2} max={12} step={0.1} display={`${((fabric.thickness ?? 0.002) * 1000).toFixed(1)} mm`} onChange={(value) => updateFabric('thickness', value / 1000)} />
                <SliderRow label="Bending" value={fabric.bend} min={0.1} max={0.99} step={0.01} display={fabric.bend.toFixed(2)} onChange={(value) => updateFabric('bend', value)} />
                <SliderRow label="Friction" value={fabric.friction} min={0.05} max={0.9} step={0.01} display={fabric.friction.toFixed(2)} onChange={(value) => updateFabric('friction', value)} />
                <SliderRow label="Motion damping" value={fabric.damping ?? 0.985} min={0.90} max={0.999} step={0.001} display={(fabric.damping ?? 0.985).toFixed(3)} onChange={(value) => updateFabric('damping', value)} />
              </div>
            </>
          )}

          {activeSection === 'Avatar' && (
            <>
              <div className="panel-section">
                <div className="panel-title"><span>Avatar</span><strong>{project.avatar.name}</strong></div>
                <div className="avatar-card"><div className="avatar-silhouette"><i /><i /><i /></div><div><span>BODY PROFILE</span><strong>{project.avatar.heightCm} cm</strong><em>Parametric collision body</em></div></div>
              </div>
              <div className="panel-section measure-list">
                {[
                  ['heightCm', 'Height', 150, 205],
                  ['chestCm', 'Chest', 70, 145],
                  ['waistCm', 'Waist', 55, 145],
                  ['hipCm', 'Hip', 70, 150],
                  ['shoulderWidthCm', 'Shoulder width', 34, 62],
                  ['neckCm', 'Neck', 28, 58],
                  ['bicepCm', 'Bicep', 20, 60],
                ].map(([field, label, min, max]) => (
                  <div className="control-row split-control" key={field}><span>{label}</span><NumberField value={project.avatar[field]} min={min} max={max} suffix="cm" onChange={(value) => updateAvatar(field, clamp(value, min, max))} /></div>
                ))}
                <div className="control-row split-control"><span>Arm length</span><NumberField value={project.avatar.armLengthCm ?? Number((72 * (project.avatar.heightCm ?? 180) / 180).toFixed(1))} min={42} max={86} step={0.5} suffix="cm" onChange={(value) => updateAvatar('armLengthCm', clamp(value, 42, 86))} /></div>
                <SliderRow label="Arm pose" value={project.avatar.armAngleDeg ?? 6} min={0} max={70} step={1} display={`${Math.round(project.avatar.armAngleDeg ?? 6)}°`} onChange={(value) => updateAvatar('armAngleDeg', value)} />
                <SliderRow label="Avatar visibility" value={project.avatar.visibility} min={0.05} max={1} step={0.05} display={`${Math.round(project.avatar.visibility * 100)}%`} onChange={(value) => updateAvatar('visibility', value)} />
              </div>
            </>
          )}

          {activeSection === 'Fit' && (
            <>
              <div className="panel-section">
                <div className="panel-title"><span>Fit analysis</span><Activity size={15} /></div>
                <div className="analysis-switch">
                  <button className={analysisMode === 'surface' ? 'active' : ''} onClick={() => setAnalysisMode('surface')}>SURFACE</button>
                  <button className={analysisMode === 'strain' ? 'active' : ''} onClick={() => setAnalysisMode('strain')}>STRAIN MAP</button>
                  <button className={analysisMode === 'pressure' ? 'active' : ''} onClick={() => setAnalysisMode('pressure')}>PRESSURE</button>
                  <button className={analysisMode === 'ease' ? 'active' : ''} onClick={() => setAnalysisMode('ease')}>EASE</button>
                </div>
                <div className="stat-grid">
                  <MiniStat label="Vertices" value={stats.vertices.toLocaleString()} />
                  <MiniStat label="Constraints" value={stats.constraints.toLocaleString()} />
                  <MiniStat label="Internal constraints" value={stats.internal.toLocaleString()} />
                  <MiniStat label="Seam treatments" value={stats.treatments.toLocaleString()} />
                  <MiniStat label="Average strain" value={`${(stats.averageStrain * 100).toFixed(1)}%`} />
                  <MiniStat label="Peak strain" value={`${(stats.maxStrain * 100).toFixed(1)}%`} />
                  <MiniStat label="Average ease" value={`${stats.averageEaseCm.toFixed(1)} cm`} />
                  <MiniStat label="Body contact" value={`${Math.round(stats.contactRatio * 100)}%`} />
                  <MiniStat label="Tight area" value={`${Math.round(stats.tightRatio * 100)}%`} />
                  <MiniStat label="Pressure peak" value={`${Math.round(stats.maxPressureIndex * 100)}%`} />
                </div>
              </div>
              <div className="panel-section">
                <label className="select-field"><span>Simulation backend</span><select value={project.simulation.backendId || 'browser-pbd'} onChange={(event) => updateSimulation('backendId', event.target.value)}>{SIMULATION_BACKENDS.map((backend) => <option key={backend.id} value={backend.id}>{backend.label}</option>)}</select></label>
                <label className="select-field"><span>Simulation quality</span><select value={(project.simulation.substeps ?? 2) === 1 ? 'draft' : (project.simulation.substeps ?? 2) === 4 ? 'final' : 'balanced'} onChange={(event) => applySimulationQuality(event.target.value)}><option value="draft">Draft · 1× substep</option><option value="balanced">Balanced · 2× substeps</option><option value="final">Final · 4× substeps</option></select></label>
                <button className={`toggle-row ${project.simulation.autoFitTacks !== false ? 'active' : ''}`} onClick={() => updateSimulation('autoFitTacks', project.simulation.autoFitTacks === false)}><span><Link2 size={15} />Auto-fit shoulder tacks</span><i /></button>
                <p className="panel-copy">Fit tacks behave like temporary garment placement pins: they keep the shoulder construction seated on the avatar while the sewn panels drape and settle.</p>
                <button className={`toggle-row ${project.simulation.collisions !== false ? 'active' : ''}`} onClick={() => updateSimulation('collisions', project.simulation.collisions === false)}><span><Box size={15} />Avatar collision</span><i /></button>
                <button className={`toggle-row ${project.simulation.selfCollision !== false ? 'active' : ''}`} onClick={() => updateSimulation('selfCollision', project.simulation.selfCollision === false)}><span><Spline size={15} />Cloth self-collision</span><i /></button>
                <div className="control-row split-control"><span>Self-collision gap</span><NumberField value={(project.simulation.selfCollisionMargin ?? 0.002) * 1000} min={0} max={12} step={0.5} suffix="mm" onChange={(value) => updateSimulation('selfCollisionMargin', clamp(value, 0, 12) / 1000)} /></div>
                <SliderRow label="Solver stiffness" value={project.simulation.stiffness} min={0.5} max={0.995} step={0.005} display={project.simulation.stiffness.toFixed(3)} onChange={(value) => updateSimulation('stiffness', value)} />
                <SliderRow label="Seam stiffness" value={project.simulation.seamStiffness} min={0.5} max={0.999} step={0.005} display={project.simulation.seamStiffness.toFixed(3)} onChange={(value) => updateSimulation('seamStiffness', value)} />
                <SliderRow label="Solver substeps" value={project.simulation.substeps ?? 1} min={1} max={4} step={1} display={`${project.simulation.substeps ?? 1}×`} onChange={(value) => updateSimulation('substeps', Math.round(value))} />
                <SliderRow label="Iterations" value={project.simulation.iterations} min={2} max={14} step={1} display={project.simulation.iterations} onChange={(value) => updateSimulation('iterations', value)} />
                <SliderRow label="Gravity" value={project.simulation.gravity} min={0} max={18} step={0.1} display={`${project.simulation.gravity.toFixed(1)} m/s²`} onChange={(value) => updateSimulation('gravity', value)} />
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Wind / motion test</span><strong>{project.simulation.wind?.enabled ? 'LIVE' : 'OFF'}</strong></div>
                <button className={`toggle-row ${project.simulation.wind?.enabled ? 'active' : ''}`} onClick={() => updateWind('enabled', !project.simulation.wind?.enabled)}><span><Activity size={15} />Aerodynamic wind</span><i /></button>
                <SliderRow label="Wind speed" value={project.simulation.wind?.speed ?? 4} min={0} max={20} step={0.25} display={`${(project.simulation.wind?.speed ?? 4).toFixed(1)} m/s`} onChange={(value) => updateWind('speed', value)} />
                <SliderRow label="Direction" value={project.simulation.wind?.directionDeg ?? 0} min={-180} max={180} step={1} display={`${Math.round(project.simulation.wind?.directionDeg ?? 0)}°`} onChange={(value) => updateWind('directionDeg', value)} />
                <SliderRow label="Turbulence" value={project.simulation.wind?.turbulence ?? 0.18} min={0} max={1} step={0.01} display={`${Math.round((project.simulation.wind?.turbulence ?? 0.18) * 100)}%`} onChange={(value) => updateWind('turbulence', value)} />
                <SliderRow label="Cloth response" value={project.simulation.wind?.response ?? 0.025} min={0.005} max={0.08} step={0.005} display={(project.simulation.wind?.response ?? 0.025).toFixed(3)} onChange={(value) => updateWind('response', value)} />
                <p className="panel-copy">Wind response is calculated from the live triangle normals and fabric mass per square meter, so lightweight cloth reacts more strongly than heavy denim or fleece.</p>
              </div>
            </>
          )}

          {activeSection === 'Production' && (
            <>
              <div className="panel-section">
                <div className="panel-title"><span>Size grading</span><strong>BASE {project.grading?.baseSize || 'M'}</strong></div>
                <div className="grade-size-row">
                  {(project.grading?.sizes || []).map((size) => (
                    <button key={size} className={gradePreviewSize === size ? 'active' : ''} onClick={() => setGradePreviewSize(size)}>{size}</button>
                  ))}
                </div>
                <p className="panel-copy">Grade preview is non-destructive. The base pattern stays unchanged while the 2D and 3D workspaces show the selected production size.</p>
                <div className="control-row split-control"><span>Width / size</span><NumberField value={project.grading?.widthPerSizeCm ?? 3} min={0} max={12} step={0.1} suffix="cm" onChange={(value) => updateGrading('widthPerSizeCm', clamp(value, 0, 12))} /></div>
                <div className="control-row split-control"><span>Length / size</span><NumberField value={project.grading?.lengthPerSizeCm ?? 1.2} min={0} max={8} step={0.1} suffix="cm" onChange={(value) => updateGrading('lengthPerSizeCm', clamp(value, 0, 8))} /></div>
                <button className={`toggle-row ${showGradeNest ? 'active' : ''}`} onClick={() => setShowGradeNest((value) => !value)}><span><Eye size={15} />Grade nest · XS–XXL</span><i /></button>
              </div>
              {selectedPiece && (
                <div className="panel-section">
                  <div className="panel-title"><span>Grade points · {selectedPiece.name}</span><strong>{selectedPiece.points.filter((point) => point.gradeRule?.enabled).length} CUSTOM</strong></div>
                  <p className="panel-copy">AUTO points follow the garment-wide width/length rule. CUSTOM points move by their own X/Y centimeters for each size step away from the base size.</p>
                  <div className="grade-point-table">
                    <div className="grade-point-header"><span>Point</span><span>X / size</span><span>Y / size</span><span>Rule</span></div>
                    {selectedPiece.points.map((point, pointIndex) => {
                      const automatic = automaticGradeDelta(selectedPiece, point)
                      const custom = point.gradeRule?.enabled
                      return (
                        <div className={`grade-point-row ${custom ? 'custom' : ''}`} key={`${selectedPiece.id}-grade-${pointIndex}`}>
                          <span>P{String(pointIndex + 1).padStart(2, '0')}</span>
                          {custom
                            ? <NumberField value={point.gradeRule.dxPerSize ?? 0} min={-12} max={12} step={0.1} suffix="cm" onChange={(value) => updatePointGradeRule(selectedPiece.id, pointIndex, 'dxPerSize', clamp(value, -12, 12))} />
                            : <em>{automatic.dxPerSize >= 0 ? '+' : ''}{automatic.dxPerSize.toFixed(2)}</em>}
                          {custom
                            ? <NumberField value={point.gradeRule.dyPerSize ?? 0} min={-12} max={12} step={0.1} suffix="cm" onChange={(value) => updatePointGradeRule(selectedPiece.id, pointIndex, 'dyPerSize', clamp(value, -12, 12))} />
                            : <em>{automatic.dyPerSize >= 0 ? '+' : ''}{automatic.dyPerSize.toFixed(2)}</em>}
                          <button className={custom ? 'active' : ''} onClick={() => setPointGradeRuleEnabled(selectedPiece.id, pointIndex, !custom)}>{custom ? 'CUSTOM' : 'AUTO'}</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="panel-section">
                <div className="panel-title"><span>Automatic marker · {gradePreviewSize}</span><strong>{marker.unusedPieces ? 'INCOMPLETE' : `${Math.round(marker.efficiency * 100)}% EFF.`}</strong></div>
                {markerFabricIds.length > 1 && (
                  <div className="marker-fabric-tabs">
                    {markerFabricIds.map((fabricId) => (
                      <button key={fabricId} className={`${marker.fabricId === fabricId ? 'active' : ''} ${fabricMarkers[fabricId].unusedPieces ? 'incomplete' : ''}`} onClick={() => setMarkerFabricId(fabricId)}>
                        <span>{project.fabrics?.[fabricId]?.name || fabricId}</span>
                        <em>{fabricMarkers[fabricId].unusedPieces ? `${fabricMarkers[fabricId].unusedPieces} MISS` : `${fabricMarkers[fabricId].length.toFixed(1)} cm`}</em>
                      </button>
                    ))}
                  </div>
                )}
                <div className="control-row split-control"><span>{markerFabricIds.length > 1 ? 'Selected fabric width' : 'Fabric width'}</span><NumberField value={marker.width ?? project.markerSettings?.fabricWidthCm ?? 150} min={30} max={300} step={0.5} suffix="cm" onChange={(value) => updateMarkerFabricWidth(marker.fabricId || markerFabricId || 'main', clamp(value, 30, 300))} /></div>
                <div className="control-row split-control"><span>Piece spacing</span><NumberField value={project.markerSettings?.gapCm ?? 1.5} min={0} max={10} step={0.1} suffix="cm" onChange={(value) => updateMarkerSetting('gapCm', clamp(value, 0, 10))} /></div>
                <MarkerPreview marker={marker} />
                <div className="production-number"><strong>{estimatedLength.toFixed(2)}</strong><span>m {marker.unusedPieces ? 'PLACED ONLY · ' : ''}{project.fabrics?.[marker.fabricId]?.name || marker.fabricId || 'FABRIC'} / {marker.width.toFixed(0)} cm width</span></div>
                <div className="field-grid two">
                  <label><span>Selected fabric area</span><strong>{(productionFabricArea / 10000).toFixed(3)} m²</strong></label>
                  <label><span>Marker efficiency</span><strong>{Math.round(marker.efficiency * 100)}%</strong></label>
                </div>
                {markerFabricIds.length > 1 && (
                  <div className="marker-material-summary">
                    {markerFabricIds.map((fabricId) => {
                      const item = fabricMarkers[fabricId]
                      return <div key={`${fabricId}-marker-summary`}><span>{project.fabrics?.[fabricId]?.name || fabricId}</span><strong>{(item.length / 100).toFixed(2)} m</strong><em>{item.unusedPieces ? `${item.unusedPieces} MISS` : `${Math.round(item.efficiency * 100)}%`}</em></div>
                    })}
                  </div>
                )}
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>POM spec · {gradePreviewSize}</span><strong>{productionMeasurements.length} POM</strong></div>
                <div className="pom-table">
                  {productionMeasurements.map((measurement) => (
                    <div className="pom-row" key={measurement.id}>
                      <span>{measurement.label}</span>
                      <strong>{measurement.cm.toFixed(1)} cm</strong>
                      <em>±{measurement.toleranceCm.toFixed(1)}</em>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Production data</span><strong>LIVE</strong></div>
                <div className="production-list"><span><i />Pattern geometry</span><span><i />Seam graph</span><span><i />Fabric physicals</span><span><i />Avatar measurements</span><span><i />XS–XXL graded size run</span><span><i />Grain-safe configurable marker</span><span><i />POM measurement size run</span><span><i />DXF cut + allowance + notches</span><span><i />DXF grainlines + piece labels</span><span><i />GarmentCode / PyGarment JSON</span><span><i />3D OBJ garment mesh</span><span><i />Binary GLB / glTF garment</span><span><i />Structured tech-pack data</span></div>
              </div>
              <button className="wide-action" onClick={exportDxf}><FileDown size={15} />EXPORT DXF · {gradePreviewSize}</button>
              <button className="wide-action" onClick={requestObjExport}><Box size={15} />EXPORT 3D OBJ · {gradePreviewSize}</button>
              <button className="wide-action" onClick={requestGlbExport}><Box size={15} />EXPORT GLB · {gradePreviewSize}</button>
              <button className="wide-action" onClick={exportMeasurements}><FileDown size={15} />EXPORT POM CSV</button>
              <button className="wide-action" onClick={exportGarmentCode}><FileDown size={15} />EXPORT GARMENTCODE JSON</button>
              <button className="wide-action" onClick={exportFactoryPackage}><FileDown size={15} />EXPORT FACTORY PACKAGE · ZIP</button>
              <button className="wide-action" onClick={exportTechPack}><FileDown size={15} />EXPORT TECH PACK</button>
              <button className="wide-action" onClick={exportSizeRun}><FileDown size={15} />EXPORT XS–XXL SIZE RUN</button>
              <button className="wide-action" onClick={exportProject}><FileDown size={15} />EXPORT GARMENT DOCUMENT</button>
            </>
          )}

          {activeSection === 'Render' && (
            <>
              <div className="panel-section">
                <div className="panel-title"><span>Viewport</span><Eye size={15} /></div>
                <button className={`toggle-row ${wireframe ? 'active' : ''}`} onClick={() => setWireframe((value) => !value)}><span><Box size={15} />Wireframe topology</span><i /></button>
                <p className="panel-copy">The viewport is rendered directly from the same particle positions used by the cloth solver. Editing the 2D pattern rebuilds the 3D mesh.</p>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Environment lighting</span><strong>{hdriName ? 'HDRI' : 'PMREM'}</strong></div>
                <label className="select-field"><span>Lighting preset</span><select value={project.render?.environmentPreset || 'studio'} onChange={(event) => updateRenderSetting('environmentPreset', event.target.value)}><option value="studio">Studio</option><option value="softbox">Softbox</option><option value="dramatic">Dramatic</option><option value="neutral">Neutral</option></select></label>
                <SliderRow label="Exposure" value={project.render?.exposure ?? 1.1} min={0.2} max={3} step={0.05} display={`${(project.render?.exposure ?? 1.1).toFixed(2)}×`} onChange={(value) => updateRenderSetting('exposure', value)} />
                <button className={`toggle-row ${project.render?.showEnvironment ? 'active' : ''}`} onClick={() => updateRenderSetting('showEnvironment', !project.render?.showEnvironment)}><span><Eye size={15} />Show environment background</span><i /></button>
                {hdriName ? (
                  <div className="fabric-texture-card">
                    <div><strong>{hdriName}</strong><small>Radiance HDR · PMREM filtered</small></div>
                    <button onClick={clearHdri}><Trash2 size={12} /></button>
                  </div>
                ) : <p className="panel-copy">The built-in PMREM studio environment lights PBR fabrics without an external file. Load a Radiance .HDR to use your own environment.</p>}
                <button className="wide-action" onClick={() => hdriInputRef.current?.click()}><Upload size={14} />{hdriName ? 'REPLACE HDRI' : 'LOAD HDRI ENVIRONMENT'}</button>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Final still</span><strong>PNG</strong></div>
                <label className="select-field"><span>Output preset</span><select value={`${project.render?.widthPx ?? 2048}x${project.render?.heightPx ?? 2560}`} onChange={(event) => {
                  const [width, height] = event.target.value.split('x').map(Number)
                  updateRenderResolution(width, height)
                }}><option value="1080x1350">1080 × 1350 · 4:5</option><option value="2048x2560">2048 × 2560 · 4:5</option><option value="4096x5120">4096 × 5120 · 4:5</option><option value="2048x2048">2048 × 2048 · Square</option></select></label>
                <div className="field-grid two">
                  <div><span>Width</span><NumberField value={project.render?.widthPx ?? 2048} min={512} max={6144} step={64} suffix="px" onChange={(value) => updateRenderSetting('widthPx', Math.round(clamp(value, 512, 6144)))} /></div>
                  <div><span>Height</span><NumberField value={project.render?.heightPx ?? 2560} min={512} max={6144} step={64} suffix="px" onChange={(value) => updateRenderSetting('heightPx', Math.round(clamp(value, 512, 6144)))} /></div>
                </div>
                <p className="panel-copy">Uses the current orbit camera, settled cloth state, PBR fabrics, trims, environment lighting, ACES tone mapping, and soft shadows. The live viewport size is restored immediately after capture.</p>
                <button className="wide-action" onClick={requestRenderStill}><Download size={14} />RENDER PNG STILL</button>
              </div>
              <div className="panel-section">
                <div className="panel-title"><span>Renderer capabilities</span><strong>LIVE</strong></div>
                <div className="production-list"><span><i />PBR fabric surface</span><span><i />PMREM environment lighting</span><span><i />Custom HDRI environments</span><span><i />Studio lighting presets</span><span><i />Soft shadows</span><span><i />High-resolution PNG stills</span><span className="future"><i />Path-traced final · next</span></div>
              </div>
            </>
          )}

          <div className="inspector-footer">
            <Cpu size={14} /><span>{commandResult}</span>
          </div>
        </aside>
      </main>

      <footer className="simulation-bar">
        <div className="sim-left">
          <button className={`sim-play ${running ? 'active' : ''}`} onClick={() => setRunning((value) => !value)}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? 'PAUSE' : 'SIMULATE'}</button>
          <button className="sim-reset" onClick={resetSimulation}><RotateCcw size={15} />RESET</button>
          <span className="sim-copy">SPACE toggles simulation</span>
        </div>
        <div className="sim-stats"><span><Activity size={13} />{stats.vertices.toLocaleString()} vertices</span><span>{stats.constraints.toLocaleString()} constraints</span><span>{stats.seams.toLocaleString()} seam links</span><span>{stats.anchors.toLocaleString()} fit tacks</span></div>
        <div className="engine-badge"><i className={running ? 'active' : ''} /><span>XPBD CLOTH</span><strong>GPU UI / CPU SOLVER</strong></div>
      </footer>
    </div>
  )
}
