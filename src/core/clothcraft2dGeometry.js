/** Geometry helpers for the EXO V2 2D pattern board. All coordinates are metres. */
export function getBounds(points) {
  if (!points?.length) return null
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  if (![minX, maxX, minY, maxY].every(Number.isFinite)) return null
  return {minX, maxX, minY, maxY, cx:(minX + maxX)/2, cy:(minY + maxY)/2,
    width:maxX - minX, height:maxY - minY}
}

/** True cut outline crossings paired by the even-odd fill rule.
 * Boundaries are Rust mesh panel ordered per-edge boundary indices.
 * Half-open endpoints avoid double counting at joined polygon vertices.
 */
export function horizontalPatternSpans(boundaries, uv, y) {
  if (!Number.isFinite(y)) return []
  const intersections = []
  for (const indices of Object.values(boundaries || {})) {
    for (let i = 1; i < indices.length; i++) {
      const a = uv[indices[i-1]], b = uv[indices[i]]
      if (!a || !b || ![...a, ...b].every(Number.isFinite)) continue
      if ((a[1] <= y && y < b[1]) || (b[1] <= y && y < a[1]))
        intersections.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]))
    }
  }
  intersections.sort((a,b) => a-b)
  const spans = []
  for (let i = 0; i + 1 < intersections.length; i += 2)
    if (intersections[i+1] - intersections[i] > .005)
      spans.push([intersections[i], intersections[i+1]])
  return spans
}

/** Intersections with the true cut perimeter at a given pattern-space X.
 * Pairs use half-open endpoints to avoid double counting shared vertices.
 */
export function verticalPatternSpans(boundaries, uv, x) {
  if (!Number.isFinite(x)) return []
  const intersections=[]
  for (const indices of Object.values(boundaries || {})) {
    for (let i=1;i<indices.length;i++) {
      const a=uv[indices[i-1]], b=uv[indices[i]]
      if (!a || !b || ![...a,...b].every(Number.isFinite)) continue
      if ((a[0]<=x && x<b[0]) || (b[0]<=x && x<a[0]))
        intersections.push(a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]))
    }
  }
  intersections.sort((a,b)=>a-b)
  const spans=[]
  for (let i=0;i+1<intersections.length;i+=2)
    if (intersections[i+1]-intersections[i]>.005) spans.push([intersections[i],intersections[i+1]])
  return spans
}

export function previewPoint(point, preview) {
  if (!preview) return point
  if (preview.kind === 'move') return [point[0]+preview.delta[0],point[1]+preview.delta[1]]
  const cx=preview.center[0], cy=preview.center[1]
  const x=point[0]-cx
  const y=point[1]-cy
  const a=preview.kind==='rotate'?preview.angle:0
  return [cx + x*Math.cos(a) - y*Math.sin(a), cy + x*Math.sin(a) + y*Math.cos(a)]
}

export function rotatedLayoutAroundCenter(layout, deltaDegrees, center) {
  const d=deltaDegrees*Math.PI/180
  const vx=center[0]-layout[0], vy=center[1]-layout[1]
  return [center[0]-(vx*Math.cos(d)-vy*Math.sin(d)),
    center[1]-(vx*Math.sin(d)+vy*Math.cos(d))]
}
