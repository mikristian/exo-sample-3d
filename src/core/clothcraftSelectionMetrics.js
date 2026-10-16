/** Native ClothCraft selection dimensions, measured from the exact active
 * VBD mesh (3D) and authored UV pattern (2D), never from the unrelated EXO
 * draft. Mesh positions and UV are metres, return values are centimetres. */
const finitePoint = (p, dimensions) => Array.isArray(p) && p.length >= dimensions && p.slice(0, dimensions).every(Number.isFinite)

export function boundaryLength(indices, points, dimensions = 3) {
  if (!Array.isArray(indices) || indices.length < 2 || !Array.isArray(points)) return null
  let length = 0
  for (let i = 1; i < indices.length; i++) {
    const a = points[indices[i - 1]], b = points[indices[i]]
    if (!finitePoint(a, dimensions) || !finitePoint(b, dimensions)) return null
    length += Math.hypot(...a.slice(0, dimensions).map((v, d) => v - b[d]))
  }
  return Number.isFinite(length) ? length * 100 : null
}

export function measureNativeSelection(snapshot, selected) {
  if (!snapshot?.template?.panels || !selected?.panel) return null
  const panel = snapshot.template.panels.find(p => p.id === selected.panel)
  const meshPanel = snapshot.panels?.find(p => p.id === selected.panel)
  if (!panel || !meshPanel) return null
  const edges = meshPanel.boundaries || {}
  if (selected.edge && !Object.hasOwn(edges, selected.edge)) return null
  const selectedEdges = selected.edge ? [selected.edge] : Object.keys(edges)
  const measured = selectedEdges.map(id => ({
    edgeId: id,
    flatCm: boundaryLength(edges[id], snapshot.uv, 2),
    drapedCm: boundaryLength(edges[id], snapshot.positions, 3),
  }))
  const allMeasured = measured.every(e => Number.isFinite(e.flatCm) && Number.isFinite(e.drapedCm))
  const length2DCm = allMeasured ? measured.reduce((total, e) => total + e.flatCm, 0) : null
  const length3DCm = allMeasured ? measured.reduce((total, e) => total + e.drapedCm, 0) : null
  const seams = (snapshot.template.seams || []).filter(spec =>
    [spec.a, spec.b].some(side => side?.panel === selected.panel && (!selected.edge || side?.edge === selected.edge)))
  return {
    kind: selected.edge ? 'line' : 'pattern', source: 'rust',
    panelId:panel.id, panelName:panel.name, edgeId:selected.edge || null,
    fabricId:panel.fabric, revision:snapshot.revision,
    fabricName: snapshot.template.fabrics?.find(f=>f.id===panel.fabric)?.name || panel.fabric,
    positionCm:Array.isArray(panel.placement?.translation)? panel.placement.translation.map(x=>x*100):null,
    rotationDeg:panel.placement?.rotation_degrees || null,
    length2DCm, length3DCm,
    elongationPercent:length2DCm > 0 && length3DCm != null ? (length3DCm / length2DCm - 1) * 100 : null,
    edgeCount:selectedEdges.length,
    seamIds:seams.map(spec=>spec.id),
    targetLengthCm: selected.edge ? Number.isFinite(panel.polygon?.target_lengths?.[selected.edge])
      ? panel.polygon.target_lengths[selected.edge] * 100 : null : null,
  }
}
