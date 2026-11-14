// Valentina .vit (individual) / .vst (multisize) XML measurement interchange.
// Format provenance: https://github.com/dismine/valentina (GPLv3 source);
// this is an independently written parser, not copied upstream code.
import { XMLParser, XMLValidator } from 'fast-xml-parser'

const UNITS = Object.freeze({ mm: 0.1, cm: 1, inch: 2.54, in: 2.54 })
const NAME = /^[A-Za-z_][A-Za-z0-9_-]{0,127}$/
const list = value => value === undefined ? [] : Array.isArray(value) ? value : [value]
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
const numeric = (raw, label) => {
  if (typeof raw !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim()))
    throw new Error(`Unsupported formula or invalid numeric ${label}`)
  const n = Number(raw)
  if (!Number.isFinite(n) || Math.abs(n) > 1000000) throw new Error(`Invalid numeric ${label}`)
  return n
}
const attributes = node => Object.fromEntries(Object.entries(node).filter(([key]) => key.startsWith('@_')).map(([key, value]) => [key.slice(2), String(value)]))
const scalar = value => typeof value === 'string' ? value : ''

/** Parse one Valentina .vit or .vst source without evaluating arithmetic expressions. */
export function parseValentinaMeasurements(source, { filename = '' } = {}) {
  if (typeof source !== 'string' || !source.trim() || new TextEncoder().encode(source).length > 2 * 1024 * 1024) throw new Error('Valentina measurement XML must be nonempty and at most 2 MB')
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(source) || /<\?(?!xml\s)[\s\S]*?\?>/i.test(source) || /&(?!(?:amp|lt|gt|quot|apos);)/i.test(source)) throw new Error('External entities, DTDs and XML processing instructions are unsupported')
  const validation = XMLValidator.validate(source)
  if (validation !== true) throw new Error(`Invalid Valentina XML: ${validation?.err?.msg || 'malformed XML'}`)
  const parsed = new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',parseTagValue:false,parseAttributeValue:false,trimValues:true,processEntities:false}).parse(source)
  const roots = ['vit', 'vst'].filter(key => own(parsed, key))
  if (roots.length !== 1 || Object.keys(parsed).some(key => key !== roots[0] && key !== '?xml')) throw new Error('Expected exactly one Valentina vit or vst root')
  const kind = roots[0]
  if (filename && !String(filename).toLowerCase().endsWith(`.${kind}`)) throw new Error('File extension and Valentina XML root disagree')
  const root = parsed[kind]
  if (!root || typeof root !== 'object' || Array.isArray(root)) throw new Error('Invalid Valentina measurement root')
  const unit = scalar(root.unit).trim().toLowerCase()
  if (!own(UNITS, unit)) throw new Error(`Unsupported Valentina measurement unit: ${unit || 'missing'}`)
  const entries = list(root['body-measurements']?.m)
  if (!entries.length || entries.length > 1000) throw new Error('Valentina file must have 1–1000 measurement entries')
  const measurements = Object.create(null)
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid Valentina measurement entry')
    const attrs = attributes(entry)
    const name = attrs.name
    if (!NAME.test(name || '') || own(measurements, name)) throw new Error(`Invalid or duplicate Valentina measurement name: ${name}`)
    const baseRaw = kind === 'vit' ? attrs.value : attrs.base
    if (baseRaw === undefined || !baseRaw.trim()) throw new Error(`Missing ${name} ${kind === 'vit' ? 'value' : 'base'}`)
    const formula = !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(baseRaw.trim())
    const item = { name, raw: Object.freeze({ ...attrs }), expression: baseRaw, isFormula: formula,
      valueCm: formula ? null : numeric(baseRaw, name) * UNITS[unit] }
    if (kind === 'vst') {
      item.sizeIncreaseExpression = attrs.size_increase ?? '0'
      item.heightIncreaseExpression = attrs.height_increase ?? '0'
      item.sizeIncreaseCm = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(item.sizeIncreaseExpression.trim()) ? numeric(item.sizeIncreaseExpression, `${name} size increment`) * UNITS[unit] : null
      item.heightIncreaseCm = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(item.heightIncreaseExpression.trim()) ? numeric(item.heightIncreaseExpression, `${name} height increment`) * UNITS[unit] : null
      item.isFormula ||= item.sizeIncreaseCm === null || item.heightIncreaseCm === null
    }
    measurements[name] = item
  }
  const readAxis = axis => {
    const node = root[axis]
    if (!node || typeof node !== 'object' || Array.isArray(node)) return null
    const raw = attributes(node)
    return { raw, base: raw.base === undefined ? null : numeric(raw.base, `${axis} base`),
      step: raw.step === undefined ? null : numeric(raw.step, `${axis} step`),
      min: raw.min === undefined ? null : numeric(raw.min, `${axis} min`),
      max: raw.max === undefined ? null : numeric(raw.max, `${axis} max`) }
  }
  return { format:'exo-valentina-measurements.v1',kind,sourceUnit:unit,unitToCm:UNITS[unit],
    sourceName:filename ? String(filename).slice(0,255) : null, measurementCount:entries.length,
    measurements, size:kind === 'vst' ? readAxis('size') : null,
    height:kind === 'vst' ? readAxis('height') : null,
    notes:scalar(root.notes),hasUnevaluatedFormulas:Object.values(measurements).some(item => item.isFormula),
    manufacturingApproved:false,
    qualification:'Raw Valentina formulas are retained verbatim; full expression and size-table evaluation requires the original Valentina engine.' }
}
