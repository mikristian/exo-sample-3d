// Read-only 2D print DTO. Native board coordinates are metres; print engines consume mm.
// The snapshot is deliberately detached from the live Rust-owned geometry.
const METRES_TO_MM = 1000

export function selectNativePatternPrintSnapshot20261030(snapshot) {
  if (!snapshot || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 ||
      !Array.isArray(snapshot.panels) || !Array.isArray(snapshot.uv) ||
      !Array.isArray(snapshot.template?.panels)) {
    throw new Error('Native print source is missing a valid revision or 2D geometry')
  }
  const pieces = new Map(snapshot.template.panels.map(panel => [panel.id, panel]))
  const linesMm = snapshot.panels.flatMap(range => {
    const panel = pieces.get(range.id)
    if (!panel || !Array.isArray(range.layout) || range.layout.length !== 2 ||
        !range.layout.every(Number.isFinite) || !range.boundaries ||
        typeof range.boundaries !== 'object') {
      throw new Error('Native print source has an invalid panel boundary')
    }
    const radians = (panel.layout_rotation_degrees || 0) * Math.PI / 180
    if (!Number.isFinite(radians)) throw new Error('Native print rotation is invalid')
    const cos = Math.cos(radians), sin = Math.sin(radians)
    return Object.values(range.boundaries).map(indices => {
      if (!Array.isArray(indices)) throw new Error('Native print boundary is invalid')
      return Object.freeze(indices.map(index => {
        const uv = snapshot.uv[index]
        if (!Number.isSafeInteger(index) || !Array.isArray(uv) || uv.length !== 2 ||
            !uv.every(Number.isFinite)) throw new Error('Native print vertex is invalid')
        return Object.freeze([
          (range.layout[0] + uv[0] * cos - uv[1] * sin) * METRES_TO_MM,
          (range.layout[1] + uv[0] * sin + uv[1] * cos) * METRES_TO_MM,
        ])
      }))
    })
  })
  return Object.freeze({
    format: 'exo-native-pattern-print-snapshot.v1',
    sourceRevision: snapshot.revision,
    sourceIdentity: snapshot.template.id ?? snapshot.template.name ?? null,
    coordinateUnit: 'mm',
    sourceCoordinateUnit: 'm',
    cloth3DCoordinateUnit: 'm',
    linesMm: Object.freeze(linesMm),
  })
}
