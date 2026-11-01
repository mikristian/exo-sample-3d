import { parseValentinaMeasurements } from './valentinaMeasurements20261031.js'

/** Apply independent measurement edits to the original Valentina .vit XML.
 * No construction graph, description, size rule or unrelated XML is altered.
 * Only a validated, existing numeric value attribute may change.
 */
export function updateValentinaVitMeasurement20261031(originalXml, name, sourceUnitValue) {
  const original = parseValentinaMeasurements(originalXml)
  if (original.kind !== 'vit') throw Error('Only individual Valentina .vit measurements can be directly edited')
  if (!Object.hasOwn(original.measurements, name)) throw Error('Unknown Valentina measurement')
  const previous = original.measurements[name]
  if (previous.isFormula || previous.valueCm === null) throw Error('Expression-driven Valentina measurements require upstream formula evaluation')
  if (!Number.isFinite(sourceUnitValue) || sourceUnitValue <= 0 || sourceUnitValue > 1000000)
    throw Error('Valentina measurement value must be a positive finite number')
  const numeric = String(sourceUnitValue)
  // The original parser accepts only simple identifier names.
  if (!/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/.test(name)) throw Error('Invalid Valentina measurement identifier')
  const rows = [...originalXml.matchAll(/<m\b[^>]*\/\s*>/g)]
  let replaced = false
  const nextXml = originalXml.replace(/<m\b[^>]*\/\s*>/g, row => {
    const identifying = /\bname\s*=\s*(["'])(.*?)\1/.exec(row)
    if (identifying?.[2] !== name) return row
    if (replaced) throw Error('Duplicate Valentina measurement element')
    replaced = true
    if (!/\bvalue\s*=\s*(["'])(.*?)\1/.test(row)) throw Error('Missing original Valentina measurement value')
    return row.replace(/\bvalue\s*=\s*(["'])(.*?)\1/, (_, quote) => `value=${quote}${numeric}${quote}`)
  })
  if (!replaced || rows.length !== original.measurementCount) throw Error('Valentina XML measurement inventory mismatch')
  const parsed = parseValentinaMeasurements(nextXml)
  if (parsed.measurementCount !== original.measurementCount || parsed.sourceUnit !== original.sourceUnit ||
    parsed.measurements[name].valueCm !== Number(numeric) * parsed.unitToCm)
    throw Error('Edited Valentina measurement failed post-validation')
  for (const key of Object.keys(original.measurements)) {
    if (key === name) continue
    if (parsed.measurements[key].expression !== original.measurements[key].expression)
      throw Error('Unrelated Valentina measurement changed unexpectedly')
  }
  return nextXml
}

export function applyValentinaVitMeasurementEdits20261031(xml, values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw Error('Valentina measurement edits must be keyed by name')
  let result = xml
  for (const [key, raw] of Object.entries(values)) {
    if (raw === '' || raw === null || raw === undefined) throw Error('Valentina measurement edit missing value')
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN
    result = updateValentinaVitMeasurement20261031(result, key, value)
  }
  return result
}
