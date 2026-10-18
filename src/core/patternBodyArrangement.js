// Anatomical roles for editable 2D cut pieces. These affect the initial 3D
// arrangement only: 2D contours, edge indices, sewing, fabrics and grading
// remain authoritative and unchanged. Ambiguous pieces stay unassigned.
const tokenize = value => String(value || '').toLowerCase().replace(/([a-z])([0-9])/g, '$1 $2').split(/[^a-z0-9]+/).filter(Boolean)
const includesAny = (tokens, words) => words.some(word => tokens.includes(word))

export function inferPatternBodyRole(piece, project = {}) {
  const current = piece?.arrangement3d?.wrap
  if (typeof current === 'string' && current && current !== 'flat') return current
  const tokens = tokenize(`${piece?.id || ''} ${piece?.name || ''} ${piece?.generatedRole || ''}`)
  const context = tokenize(`${project?.templateId || ''} ${project?.name || ''}`)
  const isLegGarment = includesAny(context, ['pants', 'pant', 'trouser', 'trousers', 'jeans', 'denim', 'shorts', 'joggers'])
  const side = tokens.includes('left') ? 'left' : tokens.includes('right') ? 'right' : null
  const back = includesAny(tokens, ['back', 'rear'])
  const front = tokens.includes('front')
  if (includesAny(tokens, ['sleeve', 'arm']) && side) return `${side}-arm`
  if (tokens.includes('hood') && side) return `hood-${side}`
  if (includesAny(tokens, ['cuff', 'wrist']) && side) return `${side}-wrist`
  if (includesAny(tokens, ['waistband', 'waist', 'belt']) && !tokens.includes('pocket')) return 'waist-band'
  if (includesAny(tokens, ['neckband', 'collar', 'neck', 'ribneck'])) return 'neck'
  if (tokens.includes('pocket') || includesAny(tokens, ['facing', 'lining', 'interfacing'])) return null
  if ((isLegGarment || tokens.includes('leg')) && side && (front || back)) return `${side}-leg-${front ? 'front' : 'back'}`
  if ((front || back) && (isLegGarment || includesAny(context, ['skirt', 'dress']) || tokens.includes('skirt'))) return `lower-${front ? 'front' : 'back'}`
  if (front || back) return front ? 'front' : 'back'
  return null
}

function inferredOffset(role, piece) {
  const prior = piece.arrangement3d || {}
  if (role.endsWith('-arm')) return { x: role.startsWith('left') ? -0.285 : 0.285, y: 1.26, z: 0.045 }
  if (role.includes('-leg-')) return { x: role.startsWith('left') ? -0.15 : 0.15, y: 0, z: role.endsWith('front') ? 0.14 : -0.14 }
  if (role === 'front' || role === 'back') {
    // Existing garments use 0.9–1.0m for the lower hem; match the pattern's
    // physical height without scaling the source contour.
    const ys = piece.points?.map(point => Number(point.y)).filter(Number.isFinite) || []
    const heightM = ys.length ? (Math.max(...ys) - Math.min(...ys)) / 100 : 0.65
    return { x: 0, y: Math.max(.63, 1.66 - heightM), z: role === 'front' ? .245 : -.245 }
  }
  if (role === 'lower-front' || role === 'lower-back') return { x: 0, y: 0, z: role === 'lower-front' ? .16 : -.16 }
  if (role === 'waist-band') return { x: 0, y: .88, z: 0 }
  if (role === 'neck') return { x: 0, y: 1.59, z: 0 }
  if (role.startsWith('hood-')) return { x: 0, y: 1.59, z: -.2 }
  if (role.endsWith('-wrist')) return { x: role.startsWith('left') ? -.73 : .73, y: 1.0, z: 0 }
  return { x: prior.x || 0, y: prior.y || 0, z: prior.z || 0 }
}

export function resolvePatternArrangement(piece, project = {}) {
  const existing = piece?.arrangement3d || {}
  const role = inferPatternBodyRole(piece, project)
  if (!role || (existing.wrap && existing.wrap !== 'flat')) return existing
  const defaults = inferredOffset(role, piece)
  return { ...defaults, ...existing, wrap: role,
    // Imported panels without a placement tend to supply x/y/z=0 as a
    // placeholder; use anatomical defaults in that specific case.
    ...(Object.keys(existing).length && ['x','y','z'].every(axis => Number(existing[axis] || 0) === 0)
      ? defaults : {}),
    flip: existing.flip ?? (role.startsWith('right-leg-')),
  }
}

export function arrangePatternProject(project) {
  if (!project || !Array.isArray(project.pieces)) return project
  return { ...project, pieces: project.pieces.map(piece => ({ ...piece,
    arrangement3d: resolvePatternArrangement(piece, project),
  })) }
}
