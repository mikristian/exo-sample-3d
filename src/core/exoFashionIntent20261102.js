/** Grounded designer vocabulary: editorial references become editable fit proposals, never proprietary patterns. */
const DESIGNERS = Object.freeze({
  balenciaga: { label: 'Balenciaga', attributes: ['oversized', 'boxy', 'drop-shoulder', 'extended-sleeve'], description: 'Exaggerated volume, broad shoulder line and deliberate proportions; interpretation varies by season and garment.' },
  'rick owens': { label: 'Rick Owens', attributes: ['longline', 'slim', 'draped'], description: 'Elongated line, lean layering and drape; use garment-specific references to resolve shape.' },
  'fear of god': { label: 'Fear of God', attributes: ['relaxed', 'boxy', 'drop-shoulder'], description: 'Relaxed layering, ease and understated volume.' },
  yeezy: { label: 'Yeezy', attributes: ['oversized', 'boxy', 'cropped'], description: 'Generous volume and compact lengths in selected apparel references.' },
  'acne studios': { label: 'Acne Studios', attributes: ['relaxed', 'boxy'], description: 'Contemporary relaxed and squared proportions.' },
  vetements: { label: 'Vetements', attributes: ['oversized', 'drop-shoulder', 'extended-sleeve'], description: 'Deliberately exaggerated scale and sleeve/shoulder proportions.' },
  'comme des garçons': { label: 'Comme des Garçons', attributes: ['sculptural', 'asymmetric'], description: 'Experimental volume and proportion that require a specific reference.' },
  'maison margiela': { label: 'Maison Margiela', attributes: ['deconstructed', 'relaxed'], description: 'Deconstruction and reworked proportions; reference dependent.' },
  'the row': { label: 'The Row', attributes: ['relaxed', 'longline'], description: 'Controlled ease and elongated, minimal proportions.' },
  'raf simons': { label: 'Raf Simons', attributes: ['oversized', 'extended-sleeve'], description: 'Expressive youthwear volume and proportion; reference dependent.' },
})

export const EXO_FASHION_BRAND_VOCABULARY = DESIGNERS
export const EXO_FASHION_FIT_BOUNDS_CM = Object.freeze({ torsoHalfSideAdd: [0, 8], crop: [0, 20], shoulderDrop: [0, 7], sleeveExtension: [0, 12], bodyLengthExtension: [0, 15] })

const ATTRIBUTES = Object.freeze({
  oversized: { label: 'Oversized', metric: 'torsoHalfSideAdd', defaultCm: 5, note: 'Additional width at each half-panel side near hem; chest and shoulder require separate drafting.' },
  relaxed: { label: 'Relaxed fit', metric: 'torsoHalfSideAdd', defaultCm: 3, note: 'Moderate added ease.' },
  boxy: { label: 'Boxy fit', metric: 'torsoHalfSideAdd', defaultCm: 3.5, note: 'Squared torso with reduced waist shaping.' },
  cropped: { label: 'Cropped length', metric: 'crop', defaultCm: 8, note: 'Shorter body measured from the existing hem.' },
  'drop-shoulder': { label: 'Dropped shoulder', metric: 'shoulderDrop', defaultCm: 4, note: 'Shoulder seam extends down/away from anatomical shoulder; must rebalance armhole and sleeve cap.' },
  'extended-sleeve': { label: 'Extended sleeves', metric: 'sleeveExtension', defaultCm: 5, note: 'Sleeve length increased from an agreed sleeve-measurement point.' },
  longline: { label: 'Longline', metric: 'bodyLengthExtension', defaultCm: 8, note: 'Body lengthened from original hem; verify balance.' },
  slim: { label: 'Slim', metric: null, note: 'Requires current body/POM measurements and ease before safely reducing circumference.' },
  draped: { label: 'Draped', metric: null, note: 'Requires fabric weight, grain, geometry and simulation.' },
  sculptural: { label: 'Sculptural', metric: null, note: 'Requires reference-driven pattern pieces and volume placement.' },
  asymmetric: { label: 'Asymmetric', metric: null, note: 'Requires side-specific reference and geometry.' },
  deconstructed: { label: 'Deconstructed', metric: null, note: 'Requires construction reference and seam/articulation decisions.' },
})

const PHRASES = Object.freeze([
  [/\b(?:over\s*size(?:d)?|baggy|extra\s+loose)\b/i, 'oversized'],
  [/\b(?:boxy|boxier|square\s+cut)\b/i, 'boxy'],
  [/\b(?:crop(?:ped)?|shorter\s+body)\b/i, 'cropped'],
  [/\b(?:drop(?:ped)?[ -]?shoulder|lower(?:ed)?\s+shoulder)\b/i, 'drop-shoulder'],
  [/\b(?:long(?:er)?\s+sleeves?|extended[ -]?sleeves?)\b/i, 'extended-sleeve'],
  [/\b(?:longline|elongated\s+body|longer\s+body)\b/i, 'longline'],
  [/\b(?:relaxed\s+fit|roomier)\b/i, 'relaxed'],
  [/\b(?:slim(?:mer)?\s+fit|fitted)\b/i, 'slim'],
  [/\b(?:drape|draped|flowing)\b/i, 'draped'],
  [/\b(?:sculptural|sculpted)\b/i, 'sculptural'],
  [/\b(?:asymmetric|asymmetrical)\b/i, 'asymmetric'],
  [/\b(?:deconstruct(?:ed|ion)?)\b/i, 'deconstructed'],
])

function normalizedInput(request) {
  if (typeof request !== 'string' || !request.trim() || request.length > 2000 || /[\0-\x08\x0e-\x1f]/.test(request)) return null
  return request.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim()
}

function explicitMeasurement(input, tokens) {
  const text = tokens.join('|')
  const re = new RegExp(`(?:\\b(?:${text})\\b(?:\\s+(?:by|of|about|around))?|(?:by|of)\\s+)\\s*(\\d+(?:\\.\\d+)?)\\s*(cm|centimet(?:er|re)s?|mm|in(?:ch(?:es)?)?)\\b`, 'i')
  const match = input.match(re)
  if (!match) return null
  const number = Number(match[1])
  return Math.round((match[2] === 'mm' ? number / 10 : /^in/.test(match[2]) ? number * 2.54 : number) * 100) / 100
}

/** Pure proposal. No actual geometry is changed, and a brand is never a pattern source. */
export function interpretExoFashionIntent(request, { garment = 'tee' } = {}) {
  const normalized = normalizedInput(request)
  if (!normalized) return null
  const brand = Object.keys(DESIGNERS).sort((a, b) => b.length - a.length).find(name => normalized.includes(name)) ?? null
  const explicit = PHRASES.filter(([regex]) => regex.test(normalized)).map(([, key]) => key)
  if (!brand && !explicit.length) return null
  const desired = [...new Set([...explicit, ...(brand ? DESIGNERS[brand].attributes : [])])]
  if (/\b(?:not|without|no)\s+(?:an?\s+)?(?:oversized|baggy|boxy|cropped|drop(?:ped)?[ -]?shoulder)\b/.test(normalized)) {
    return { kind: 'fashion-intent', status: 'needs-clarification', source: request, brandReference: brand && DESIGNERS[brand].label, reason: 'Negated fit attributes require explicit exclusions.', executable: false, operations: [] }
  }
  const slight = /\b(?:slightly|subtle|a little|a bit|mildly)\b/.test(normalized)
  const extreme = /\b(?:extremely|dramatically|very|super|exaggerated)\b/.test(normalized)
  const adjustments = {}
  const attributes = desired.map(key => {
    const definition = ATTRIBUTES[key]
    const metric = definition.metric
    if (metric) {
      const tokenSet = {
        torsoHalfSideAdd: ['oversized', 'boxy', 'baggy', 'loose', 'widen', 'width'],
        crop: ['crop', 'cropped', 'shorten'],
        shoulderDrop: ['drop.shoulder', 'dropped.shoulder', 'shoulder.drop'],
        sleeveExtension: ['sleeve', 'sleeves'],
        bodyLengthExtension: ['longline', 'lengthen', 'longer.body'],
      }[metric]
      const entered = explicitMeasurement(normalized, tokenSet)
      const value = entered ?? Math.round(definition.defaultCm * (slight ? 0.6 : extreme ? 1.4 : 1) * 100) / 100
      const [min, max] = EXO_FASHION_FIT_BOUNDS_CM[metric]
      if (!(metric in adjustments) || explicit.includes(key)) adjustments[metric] = { valueCm: value, minCm: min, maxCm: max, withinBounds: value >= min && value <= max, specifiedByUser: entered !== null }
    }
    return { id: key, label: definition.label, constructionNote: definition.note, requiresReference: !metric }
  })
  const applicable = garment === 'tee'
  const operations = applicable && adjustments.torsoHalfSideAdd?.withinBounds || applicable && adjustments.crop?.withinBounds
    ? [{ type: 'tee-style', status: 'supported-with-constraints', handler: 'applyExoFashionTeeEdit', widthAddHalfCm: adjustments.torsoHalfSideAdd?.withinBounds ? adjustments.torsoHalfSideAdd.valueCm : 0, cropCm: adjustments.crop?.withinBounds ? adjustments.crop.valueCm : 0, scope: 'front/back hem only; existing shoulders, chest, armscye and sleeves unchanged' }]
    : []
  const pending = desired.filter(key => !['oversized', 'relaxed', 'boxy', 'cropped'].includes(key) || !applicable)
  if (Object.values(adjustments).some(v => !v.withinBounds)) pending.push('out-of-bounds-measurement')
  return {
    kind: 'fashion-intent', status: pending.length || Object.values(adjustments).some(v => !v.withinBounds) ? 'partial-proposal' : 'actionable-proposal',
    source: request, garment, brandReference: brand ? DESIGNERS[brand].label : null,
    attribution: brand ? DESIGNERS[brand].description : null,
    provenance: 'Interpretive style vocabulary; no proprietary pattern, exact brand measurements or brand endorsement claimed.',
    attributes, measurementsCm: adjustments, operations, pendingConstruction: [...new Set(pending)],
    executable: false,
    validation: ['Review target garment, original POMs, body size and intended ease.', 'Verify sleeve cap, shoulder slope, armhole, seam lengths and grading before manufacturing.', 'Fit-test physical sample; validate fabric drape and shrinkage.'],
  }
}
