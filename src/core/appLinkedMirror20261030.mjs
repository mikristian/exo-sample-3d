import {cloneProject} from './project.js'

function mirroredEdgeIndex(edgeIndex, edgeCount) {
  return (edgeCount - 2 - Number(edgeIndex) + edgeCount) % edgeCount
}

export function buildLinkedMirror(source, target) {
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
  next.foamPads = (source.foamPads || []).map(pad=>({
    ...cloneProject(pad),
    id:`${target.id}-${pad.id}`,
    x:centerX-(Number(pad.x||0)-centerX),
    rotationDeg:-(Number(pad.rotationDeg)||0),
    points:(pad.points||[]).map(point=>({...point,x:-point.x})).reverse(),
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
