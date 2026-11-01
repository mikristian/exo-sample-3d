// Valentina GPLv3 XML source-graph reader. No GPL implementation code is copied here.
// This describes source construction commands, not resolved geometric outlines.
import { XMLParser, XMLValidator } from 'fast-xml-parser'

const MAX_BYTES = 4 * 1024 * 1024
const MAX_TOOLS = 6000
const MAX_BLOCKS = 100
const MAX_INCREMENTS = 6000
const MAX_ATTRIBUTES = 80
const list = value => value == null ? [] : Array.isArray(value) ? value : [value]
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)
const string = (value, max, label) => {
  if (value == null) return ''
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error(`Invalid Valentina ${label}`)
  const s = String(value)
  if (s.length > max) throw new Error(`Valentina ${label} exceeds limit`)
  return s
}

function attributes(item) {
  const result = Object.create(null)
  for (const [key, value] of Object.entries(item)) {
    if (!key.startsWith('@_')) continue
    if (Object.keys(result).length >= MAX_ATTRIBUTES) throw new Error('Too many Valentina tool attributes')
    result[key.slice(2)] = string(value, 4096, 'attribute')
  }
  return result
}

export function parseValentinaConstructionReference(xml, { filename = '' } = {}) {
  if (typeof xml !== 'string' || BufferByteLength(xml) > MAX_BYTES) throw new Error('Valentina .val source must be XML no larger than 4 MB')
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('DOCTYPE/ENTITY forbidden in Valentina imports')
  if (/<!\s*\[CDATA\[/i.test(xml)) throw new Error('CDATA unsupported in Valentina source import')
  const valid = XMLValidator.validate(xml)
  if (valid !== true) throw new Error(`Invalid Valentina source XML: ${valid?.err?.msg || 'not well formed'}`)
  const document = new XMLParser({ ignoreAttributes:false, attributeNamePrefix:'@_', parseTagValue:false,
    parseAttributeValue:false, trimValues:false, processEntities:true }).parse(xml)
  const root = document?.pattern
  if (!root || typeof root !== 'object' || !own(root, 'version') || !own(root, 'unit') || Object.keys(document).filter(k => k !== '?xml').length !== 1)
    throw new Error('Not a Valentina .val pattern')
  const version = string(root.version, 80, 'version').trim()
  if (!/^\d+(?:\.\d+){1,4}$/.test(version)) throw new Error('Unsupported Valentina version')
  const unit = string(root.unit, 20, 'unit').trim().toLowerCase()
  if (!['cm', 'mm', 'inch', 'in'].includes(unit)) throw new Error('Unsupported Valentina unit')
  const draws = list(root.draw)
  if (!draws.length || draws.length > MAX_BLOCKS) throw new Error('Expected 1–100 Valentina draw blocks')
  const increments = list(root.increments?.increment).map(value => {
    if (!value || typeof value !== 'object') throw new Error('Invalid Valentina increment')
    const a = attributes(value)
    if (!a.name) throw new Error('Valentina increment missing name')
    return {name:string(a.name,128,'increment name'),formula:string(a.formula,4096,'increment formula'),description:string(a.description,2048,'increment description')}
  })
  if (increments.length > MAX_INCREMENTS) throw new Error('Too many Valentina increments')
  const names = new Set()
  for (const increment of increments) {
    if (names.has(increment.name)) throw new Error(`Duplicate Valentina increment: ${increment.name}`)
    names.add(increment.name)
  }
  const toolTypes = Object.create(null)
  const usedIncrements = new Set()
  const blocks = []
  let toolCount = 0
  const allowedFamilies = new Set(['point','line','spline','arc','splinePath','operation','ellipticalArc'])
  for (const [blockIndex, draw] of draws.entries()) {
    if (!draw || typeof draw !== 'object') throw new Error('Invalid Valentina draw block')
    const calculation = draw.calculation
    if (!calculation || typeof calculation !== 'object' || Array.isArray(calculation)) throw new Error('Valentina draw block missing calculation')
    const nodes = []
    const ids = new Set()
    for (const [family, raw] of Object.entries(calculation)) {
      if (family.startsWith('@_')) continue
      if (family === '#text' && typeof raw === 'string' && !raw.trim()) continue
      if (!allowedFamilies.has(family)) throw new Error(`Unsupported Valentina construction family: ${family}`)
      for (const item of list(raw)) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid Valentina construction tool')
        const a = attributes(item)
        const id = a.id
        if (!id || !/^\d+$/.test(id) || ids.has(id)) throw new Error(`Valentina duplicate or invalid construction ID: ${id || ''}`)
        ids.add(id)
        if (++toolCount > MAX_TOOLS) throw new Error('Too many Valentina construction tools')
        const type = a.type || family
        for (const value of Object.values(a)) for (const found of value.matchAll(/#[A-Za-z][A-Za-z_0-9]*/g)) usedIncrements.add(found[0])
        const references = Object.fromEntries(['firstPoint','secondPoint','basePoint','point1','point4','curve','idObject','p1Line','p2Line','center','firstCurve','secondCurve'].filter(k => own(a,k)).map(k => [k,a[k]]))
        // Nested geometry control points and formulas are preserved as source objects.
        const children = Object.fromEntries(Object.entries(item).filter(([key,value]) => !key.startsWith('@_') && (key !== '#text' || String(value).trim())))
        nodes.push({id, family, type, name:a.name || null, attributes:a, references, children})
        const key = `${family}:${type}`
        toolTypes[key] = (toolTypes[key] || 0) + 1
      }
    }
    blocks.push({id:`draw-${blockIndex+1}`, name:string(draw['@_name'] || `Draw ${blockIndex+1}`,160,'draw name'),
      toolCount:nodes.length, nodes, modelingCount:list(draw.modeling && Object.values(draw.modeling).flatMap(list)).length,
      detailCount:list(draw.details?.detail).length})
  }
  return {format:'exo-valentina-construction-reference.v1', kind:'val', version, unit,
    sourceName:string(filename,255,'filename') || null, sourceByteLength:BufferByteLength(xml),
    description:string(root.description,2048,'description'), measurementPath:string(root.measurements,512,'measurements'),
    patternName:string(root.patternName,256,'pattern name'), blocks, toolCount, incrementCount:increments.length,
    increments, toolTypes, unresolvedIncrements:[...usedIncrements].filter(x => !names.has(x)).sort(),
    note:'Read-only Valentina source graph. Formula evaluation, sewing geometry, grading and manufacturing validity are not established.'}
}

// TextEncoder is available in browsers and Node; count actual UTF-8 source bytes.
function BufferByteLength(value) { return new TextEncoder().encode(value).byteLength }

// Stable date-qualified entry point used by EXO's application integration.
export const parseValentinaConstructionReference20261031 = parseValentinaConstructionReference
