// INSERT and DIMENSION can expand BLOCK geometry with its own CUT_* layers,
// regardless of the referencing entity's layer. A source-only polygon
// inspector does not resolve that geometry or its transforms.
// Reject it instead of reporting incomplete physical CUT inspection as valid.
const opaqueExternalEntities = new Set([
  'IMAGE', 'PDFUNDERLAY', 'DWFUNDERLAY', 'DGNUNDERLAY',
  'WIPEOUT', 'ACAD_PROXY_ENTITY', 'ACAD_PROXY_OBJECT',
  'OLE2FRAME', 'OLEFRAME',
  'IMAGEDEF', 'PDFDEFINITION', 'DWFDEFINITION', 'DGNDEFINITION',
])

// Source-only CUT inspection can ignore these recognized *direct* drawing
// primitives on non-CUT layers. Unknown/vendor entities may expand into
// geometry at the receiver and cannot be assumed harmless based on layer 0.
// This is deliberately narrower than the full DXF entity vocabulary and is
// not a claim of receiving-CAD compatibility or manufacturing authorization.
const knownDirectEntities = new Set([
  'LINE','LWPOLYLINE','POLYLINE','VERTEX','SEQEND',
  'ARC','CIRCLE','ELLIPSE','SPLINE','POINT','HATCH',
  'SOLID','TRACE','3DFACE','RAY','XLINE','TEXT','MTEXT',
])

export function assertKnownDirectCutEntity20261030(kind) {
  if (!knownDirectEntities.has(kind)) {
    throw Error('unsupported unknown or indirect DXF entity in CUT source: ' + kind)
  }
}

export function assertNoExternalCutEntity20261030(kind) {
  if (opaqueExternalEntities.has(kind)) {
    throw Error('unsupported external or opaque CUT dependency entity: ' + kind)
  }
}

export function assertNoExternalCutBlock20261030(record) {
  const flags = record.filter(p => p.code === 70)
  const paths = record.filter(p => p.code === 1)
  if (flags.length > 1 || paths.length > 1) throw Error('ambiguous DXF BLOCK external-reference metadata')
  const value = flags.length ? Number(flags[0].value) : 0
  // DXF flags are decimal integers. JS bitwise operators truncate to 32 bits:
  // 2^32 would otherwise look like zero and silently bypass this check.
  if (!Number.isSafeInteger(value) || value < 0 || value > 3) {
    throw Error('unsupported external-reference or unknown DXF BLOCK flags')
  }
  if (paths.length && paths[0].value.trim()) {
    throw Error('unsupported DXF BLOCK external-reference path')
  }
}

export function assertNoIndirectCutEntity20261029(kind) {
  assertNoExternalCutEntity20261030(kind)
  if (kind === 'INSERT' || kind === 'DIMENSION') {
    throw Error('unsupported indirect CUT geometry entity: ' + kind)
  }
  assertKnownDirectCutEntity20261030(kind)
}
