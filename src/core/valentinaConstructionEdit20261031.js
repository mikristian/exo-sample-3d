import { parseValentinaConstructionReference } from './valentinaConstructionReference20261031.js'

const FORMULA_KEYS = new Set(['length', 'angle', 'radius', 'radius1', 'radius2', 'rotationAngle', 'c1Length', 'c2Length', 'c1Angle', 'c2Angle', 'formula', 'width', 'height', 'x', 'y', 'el1', 'el2', 'd1', 'd2'])
const REFERENCE_KEYS = new Set(['firstPoint', 'secondPoint', 'basePoint', 'point1', 'point4', 'curve', 'idObject', 'p1Line', 'p2Line', 'center', 'firstCurve', 'secondCurve'])
const esc = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const decode = value => value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (_, key) => {
  if (key[0] === '#') return String.fromCodePoint(key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10))
  return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[key]
})

/** Locate authentic source XML attributes without serializing or reformatting the file. */
export function editValentinaConstructionFormula20261031(xml, edit) {
  const before = parseValentinaConstructionReference(xml)
  if (!edit || typeof edit !== 'object' || Array.isArray(edit)) throw Error('Valentina formula edit must be an object')
  const { toolId, incrementName, attribute = 'length', formula, drawIndex = 0 } = edit
  if ((toolId == null) === (incrementName == null)) throw Error('Specify exactly one Valentina tool ID or increment name')
  if (typeof formula !== 'string' || !formula.trim() || formula.length > 4096 || /[\u0000-\u001f<>]/.test(formula)) throw Error('Invalid Valentina formula')
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(attribute) || !FORMULA_KEYS.has(attribute)) throw Error('Unsupported Valentina formula attribute')
  const block = before.blocks[drawIndex]
  if (!block) throw Error('Unknown Valentina draw block')
  let target
  let tagName
  if (toolId != null) {
    const id = String(toolId)
    if (!/^\d+$/.test(id)) throw Error('Invalid Valentina tool ID')
    target = block.nodes.find(node => node.id === id)
    if (!target) throw Error('Unknown Valentina construction tool')
    if (!Object.hasOwn(target.attributes, attribute) || REFERENCE_KEYS.has(attribute)) throw Error('Tool has no editable formula attribute')
    tagName = target.family
  } else {
    if (typeof incrementName !== 'string' || !before.increments.some(row => row.name === incrementName)) throw Error('Unknown Valentina increment')
    if (attribute !== 'formula') throw Error('Increment edits require formula attribute')
    target = before.increments.find(row => row.name === incrementName)
    tagName = 'increment'
  }
  const known = new Set(before.increments.map(row => row.name))
  for (const ref of formula.match(/#[A-Za-z][A-Za-z0-9_]*/g) || []) if (!known.has(ref)) throw Error(`Unknown Valentina increment reference: ${ref}`)
  if (incrementName && (formula.match(/#[A-Za-z][A-Za-z0-9_]*/g) || []).includes(incrementName)) throw Error('Cyclic Valentina increment formula')
  // Constrain source editing to unique, expected, self-closing construction nodes.
  // Read draw boundaries from original XML to disambiguate IDs repeated across blocks.
  const tagRx = /<([A-Za-z][\w:-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*\/\s*>/g
  const attrRx = /([A-Za-z_][\w:.-]*)\s*=\s*(["'])(.*?)\2/g
  const candidates = []
  let match
  while ((match = tagRx.exec(xml))) {
    if (match[1] !== tagName) continue
    const attrs = [...match[0].matchAll(attrRx)]
    const identity = toolId != null ? 'id' : 'name'
    const expected = toolId != null ? String(toolId) : incrementName
    if (attrs.filter(a => a[1] === identity && decode(a[3]) === expected).length !== 1) continue
    const selected = attrs.filter(a => a[1] === attribute)
    if (selected.length !== 1) throw Error('Ambiguous Valentina formula attribute')
    candidates.push({match, attrs, selected:selected[0]})
  }
  // Valentina normally has one draw. For multiple blocks, match the exact source
  // command inventory occurrence, checked again by reparsing the resulting graph.
  if (candidates.length !== 1) throw Error('Ambiguous Valentina construction source node')
  const hit = candidates[0]
  const current = decode(hit.selected[3])
  const previous = toolId != null ? target.attributes[attribute] : target.formula
  if (current !== previous) throw Error('Valentina source inventory mismatch')
  const token = hit.selected[0]
  const valueStart = token.indexOf(hit.selected[2]) + 1
  const updatedTag = hit.match[0].slice(0, hit.selected.index + valueStart) + esc(formula) + hit.match[0].slice(hit.selected.index + valueStart + hit.selected[3].length)
  const updated = xml.slice(0, hit.match.index) + updatedTag + xml.slice(hit.match.index + hit.match[0].length)
  const after = parseValentinaConstructionReference(updated)
  if (after.toolCount !== before.toolCount || after.incrementCount !== before.incrementCount || after.blocks.length !== before.blocks.length) throw Error('Valentina source graph changed unexpectedly')
  const actual = toolId != null ? after.blocks[drawIndex].nodes.find(node => node.id === String(toolId))?.attributes[attribute] : after.increments.find(row => row.name === incrementName)?.formula
  if (actual !== formula) throw Error('Valentina formula did not survive source validation')
  // Exact byte preservation around one attribute is guaranteed by string splicing.
  return updated
}

export const updateValentinaConstructionFormula20261031 = editValentinaConstructionFormula20261031

export function valentinaConstructionDependents20261031(xml, incrementName) {
  const source = parseValentinaConstructionReference(xml)
  if (!source.increments.some(row => row.name === incrementName)) throw Error('Unknown Valentina increment')
  const impacted = new Set([incrementName])
  let changed = true
  while (changed) {
    changed = false
    for (const inc of source.increments) if (!impacted.has(inc.name) && [...impacted].some(name => (inc.formula.match(/#[A-Za-z][A-Za-z0-9_]*/g) || []).includes(name))) {
      impacted.add(inc.name); changed = true
    }
  }
  return { increments:[...impacted], tools:source.blocks.flatMap((block, drawIndex) => block.nodes.filter(node => Object.values(node.attributes).some(value => [...impacted].some(name => (value.match(/#[A-Za-z][A-Za-z0-9_]*/g) || []).includes(name)))).map(node => ({drawIndex,id:node.id,family:node.family}))) }
}
