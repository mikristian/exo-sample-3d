import { parseValentinaConstructionReference } from './valentinaConstructionReference20261031.js'
import { evaluateValentinaConnectedDraft20261031, evaluateValentinaFormula20261031 } from './valentinaConnectedDraft20261031.js'

// Extra Valentina construction tools. Keep the original graph intact and inject
// resolved coordinates into a temporary copy for the connected point evaluator.
export const EXTENDED_VALENTINA_POINT_TYPES_20261031 = Object.freeze([
  'lineIntersect', 'height', 'pointOfIntersectionCircles', 'bisector',
])
const extraTypes = new Set(EXTENDED_VALENTINA_POINT_TYPES_20261031)
const finite = (n) => {
  if (!Number.isFinite(n) || Math.abs(n) > 1e7) throw Error('Invalid or out-of-bounds geometry')
  return n
}
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y })
const dot = (a, b) => a.x * b.x + a.y * b.y
const cross = (a, b) => a.x * b.y - a.y * b.x
const squared = v => dot(v, v)
const point = (x, y) => ({ x: finite(x), y: finite(y) })
const EPS = 1e-10

export function intersectValentinaLines20261031(a, b, c, d) {
  const u = sub(b, a), v = sub(d, c), det = cross(u, v)
  if (squared(u) < EPS * EPS || squared(v) < EPS * EPS || Math.abs(det) <= EPS * Math.sqrt(squared(u) * squared(v)))
    throw Error('Degenerate or parallel lines')
  const t = cross(sub(c, a), v) / det
  return point(a.x + t * u.x, a.y + t * u.y)
}

export function projectValentinaPoint20261031(p, a, b) {
  const d = sub(b, a), l2 = squared(d)
  if (l2 < EPS * EPS) throw Error('Degenerate projection line')
  const t = dot(sub(p, a), d) / l2
  return point(a.x + t * d.x, a.y + t * d.y)
}

/** Valentina VToolBisector: vertex is secondPoint, and length can be negative. */
export function valentinaBisector20261031(first, vertex, third, distance) {
  distance = finite(distance)
  const a = sub(first, vertex), b = sub(third, vertex)
  const la = Math.hypot(a.x, a.y), lb = Math.hypot(b.x, b.y)
  if (la < EPS || lb < EPS) throw Error('Degenerate bisector ray')
  const vx = a.x / la + b.x / lb, vy = a.y / la + b.y / lb
  const norm = Math.hypot(vx, vy)
  if (norm < EPS) throw Error('Opposite bisector rays')
  return point(vertex.x + distance * vx / norm, vertex.y + distance * vy / norm)
}

export function intersectValentinaCircles20261031(c1, r1, c2, r2, branch = 1) {
  r1 = finite(r1); r2 = finite(r2)
  if (r1 < 0 || r2 < 0) throw Error('Negative circle radius')
  if (branch !== 1 && branch !== 2) throw Error('Invalid circle intersection branch')
  const v = sub(c2, c1), dist = Math.hypot(v.x, v.y)
  if (dist < EPS) throw Error('Concentric circle centers')
  if (dist > r1 + r2 + EPS || dist < Math.abs(r1 - r2) - EPS) throw Error('Circles do not intersect')
  const along = (r1 * r1 - r2 * r2 + dist * dist) / (2 * dist)
  const height2 = r1 * r1 - along * along
  if (height2 < -EPS * Math.max(1, r1 * r1)) throw Error('Circles do not intersect')
  const offset = Math.sqrt(Math.max(0, height2)) * (branch === 1 ? 1 : -1)
  return point(c1.x + along * v.x / dist - offset * v.y / dist,
    c1.y + along * v.y / dist + offset * v.x / dist)
}

/** Resolve additional point commands, repeatedly evaluating the existing connected
 * graph so dependent original commands see each newly resolved point. Formula edits
 * and increment overrides remain effective through every round.
 */
export function evaluateValentinaExtendedGeometry20261031(reference, options = {}) {
  const original = typeof reference === 'string' ? parseValentinaConstructionReference(reference) : reference
  if (original?.format !== 'exo-valentina-construction-reference.v1' || !Array.isArray(original.blocks))
    throw Error('Invalid Valentina construction reference')
  const doc = { ...original, blocks: original.blocks.map(block => ({
    ...block, nodes: block.nodes.map(node => ({ ...node, attributes: { ...node.attributes } })),
  })) }
  const pending = new Set()
  for (let bi = 0; bi < doc.blocks.length; bi++)
    for (const node of doc.blocks[bi].nodes)
      if (node.family === 'point' && extraTypes.has(node.type)) pending.add(bi + ':' + node.id)

  const originalNodes = new Map(original.blocks.flatMap((b, bi) =>
    b.nodes.filter(n => n.family === 'point' && extraTypes.has(n.type)).map(n => [bi + ':' + n.id, n])))
  let result = evaluateValentinaConnectedDraft20261031(doc, options)
  const maximumRounds = Math.min(pending.size + 1, 6001)
  for (let round = 0; pending.size && round < maximumRounds; round++) {
    let advanced = 0
    for (const key of [...pending]) {
      const separator = key.indexOf(':'), bi = Number(key.slice(0, separator)), id = key.slice(separator + 1)
      const block = doc.blocks[bi], source = originalNodes.get(key)
      const coords = new Map(result.blocks[bi].points.map(p => [p.id, p]))
      const attrs = source.attributes || {}, edits = options.formulaEdits?.[id] || {}
      const get = name => {
        const p = coords.get(attrs[name])
        if (!p) throw Error('Unresolved source point ' + attrs[name])
        return p
      }
      const names = new Map(original.blocks[bi].nodes.filter(n => n.name).map(n => [n.name, n.id]))
      const increments = new Map((original.increments || []).map(i => [i.name, String(options.increments?.[i.name] ?? i.formula)]))
      const resolving = new Set()
      const symbol = name => {
        if (Object.hasOwn(options.measurements || {}, name)) return finite(Number(options.measurements[name]))
        const line = /^Line_(.+)_(.+)$/.exec(name)
        if (line) {
          const a = coords.get(names.get(line[1])), b = coords.get(names.get(line[2]))
          if (!a || !b) throw Error('Unresolved formula line ' + name)
          return Math.hypot(b.x - a.x, b.y - a.y)
        }
        if (!increments.has(name) || resolving.has(name)) throw Error('Unknown or cyclic formula symbol ' + name)
        resolving.add(name)
        try { return evaluateValentinaFormula20261031(increments.get(name), symbol) }
        finally { resolving.delete(name) }
      }
      const formula = attr => evaluateValentinaFormula20261031(String(edits[attr] ?? attrs[attr]), symbol)
      let p
      try {
        if (source.type === 'lineIntersect')
          p = intersectValentinaLines20261031(get('p1Line1'), get('p2Line1'), get('p1Line2'), get('p2Line2'))
        else if (source.type === 'height')
          p = projectValentinaPoint20261031(get('basePoint'), get('p1Line'), get('p2Line'))
        else if (source.type === 'bisector')
          p = valentinaBisector20261031(get('firstPoint'), get('secondPoint'), get('thirdPoint'), formula('length'))
        else if (source.type === 'pointOfIntersectionCircles')
          p = intersectValentinaCircles20261031(get('c1Center'), formula('c1Radius'),
            get('c2Center'), formula('c2Radius'), Number(edits.crossPoint ?? attrs.crossPoint ?? 1))
      } catch { continue }
      const target = block.nodes.find(n => n.id === id)
      target.type = 'single'
      target.attributes = { ...target.attributes, x: String(p.x), y: String(p.y) }
      pending.delete(key)
      advanced++
    }
    if (!advanced) break
    result = evaluateValentinaConnectedDraft20261031(doc, options)
  }
  const unresolved = [...pending].map(key => {
    const [bi, id] = key.split(':')
    return { block: doc.blocks[Number(bi)].id, id, code: 'EXTENDED_GEOMETRY_UNRESOLVED',
      message: 'Unresolved or degenerate ' + originalNodes.get(key).type + ' construction' }
  })
  return { ...result, format: 'exo-valentina-extended-geometry.v1',
    diagnostics: [...result.diagnostics.filter(d => !originalNodes.has(doc.blocks.findIndex(b => b.id === d.block) + ':' + d.id)), ...unresolved],
    extendedPointTypes: EXTENDED_VALENTINA_POINT_TYPES_20261031,
    resolvedExtendedPointCount: originalNodes.size - pending.size }
}
