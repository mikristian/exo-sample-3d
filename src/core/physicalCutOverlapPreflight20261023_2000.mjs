// Experimental source-only preflight. This is not a manufacturing certification.
import {assertOrderedCutLightVertexPairs20261029} from './industrialCutLightVertexSequence20261029.mjs'
import {assertNoIndirectCutEntity20261029, assertNoExternalCutEntity20261030, assertNoExternalCutBlock20261030, assertKnownDirectCutEntity20261030} from './industrialCutIndirectEntityGuard20261029.mjs'
const EPS = 1e-8
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
const finite = v => Number.isFinite(v)
const fail = (code, detail) => ({code, detail})
const near = (a, b) => Math.abs(a - b) <= EPS
const same = (a, b) => near(a.x, b.x) && near(a.y, b.y)
const cutLayerKey = layer => layer.toUpperCase()
const isCutLayer = layer => cutLayerKey(layer).startsWith('CUT_')
// EXO's factory DXF exporter uses NOTCH_* for authored notch cuts and SA_*
// for seam-allowance outlines in legacy drafting exports. An explicitly
// declared production layer must not be hidden or non-plottable at receipt.
// This checks metadata visibility only, not notch/allowance geometry validity.
const isNotchAllowanceLayer = layer => {
  const key = cutLayerKey(layer)
  return ['NOTCH', 'ALLOWANCE', 'SEAM_ALLOWANCE'].includes(key) ||
    ['NOTCH_', 'SA_', 'ALLOWANCE_', 'SEAM_ALLOWANCE_'].some(prefix => key.startsWith(prefix))
}

function parsePairs(source) {
  if (typeof source !== 'string' || !source.trim()) throw Error('DXF source must be nonempty text')
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  if (lines.at(-1) === '') lines.pop()
  if (lines.length % 2) throw Error('DXF has incomplete group-code pair')
  const pairs = []
  for (let i = 0; i < lines.length; i += 2) {
    const raw = lines[i].trim()
    if (!/^\d+$/.test(raw)) throw Error('DXF contains invalid group code at line ' + (i + 1))
    pairs.push({code: Number(raw), value: lines[i + 1].trim()})
  }
  return pairs
}
function numeric(value, label) {
  if (value === '' || !finite(Number(value))) throw Error('invalid ' + label)
  return Number(value)
}
function attrs(pairs, start, end) {
  const map = new Map()
  for (let i = start; i < end; i++) {
    const {code, value} = pairs[i]
    if (!map.has(code)) map.set(code, [])
    map.get(code).push(value)
  }
  return map
}
function one(map, code, label, required = true) {
  const entries = map.get(code) || []
  if (entries.length > 1 || (required && entries.length !== 1)) throw Error('invalid ' + label + ' multiplicity')
  return entries[0]
}
function checkZeroWidth(map, code, label, repeated = false) {
  const values=map.get(code) || []
  if (!repeated && values.length>1) throw Error('invalid '+label+' multiplicity')
  for (const value of values) {
    if (numeric(value,label)!==0) throw Error('unsupported nonzero '+label)
  }
}
function assertPlanarCutRecord(map, label, oldStyle = false) {
  for (const [code, expected, name] of [
    [38, 0, 'elevation'], [39, 0, 'thickness'],
    [210, 0, 'extrusion x'], [220, 0, 'extrusion y'], [230, 1, 'extrusion z'],
  ]) {
    const value = one(map, code, label + ' ' + name, false)
    if (value !== undefined && numeric(value, label + ' ' + name) !== expected) {
      throw Error('nonplanar ' + label + ' ' + name)
    }
  }
  const z = one(map, 30, label + ' z', false)
  if (z !== undefined && (!oldStyle || numeric(z, label + ' z') !== 0)) {
    throw Error('unsupported ' + label + ' z coordinate')
  }
}
function assertModelSpaceCutRecord(map, label) {
  // A paper-space outline can be visually identical in XY but must never be
  // interpreted as a model-space contour for physical marker/CUT inspection.
  const space = one(map, 67, label + ' space flag', false)
  if (space !== undefined && numeric(space, label + ' space flag') !== 0) {
    throw Error('unsupported paper-space ' + label)
  }
  const layout = one(map, 410, label + ' layout', false)
  if (layout !== undefined && layout !== 'Model') {
    throw Error('unsupported non-model layout for ' + label)
  }
}
function assertResolvedCutMetadataHandles(pairs) {
  // A DXF receiver can follow ownership and dictionary links that do not
  // affect the XY contours this inspector extracts. For source-only CUT
  // inspection, do not silently accept a partial or ambiguous handle graph.
  // HEADER $HANDSEED is a counter, not a record handle; exclude HEADER.
  const sections = new Set(['TABLES', 'BLOCKS', 'ENTITIES', 'OBJECTS'])
  const declarations = new Map()
  const references = []
  const registeredAppIds = new Set()
  const xdataAppIds = []
  const handle = (value, label, allowNull = false) => {
    if (!/^[0-9a-fA-F]+$/.test(value ?? '')) throw Error('invalid DXF ' + label + ' handle')
    const key = value.toUpperCase().replace(/^0+/, '') || '0'
    if (!allowNull && key === '0') throw Error('invalid null DXF ' + label + ' handle')
    return key
  }
  let section = null
  for (let i = 0; i < pairs.length;) {
    const {code, value} = pairs[i]
    if (code === 0 && value === 'SECTION') {
      section = pairs[i + 1]?.value
      i += 2
      continue
    }
    if (code === 0 && value === 'ENDSEC') { section = null; i++; continue }
    if (code !== 0 || !sections.has(section)) { i++; continue }
    let end = i + 1
    while (end < pairs.length && pairs[end].code !== 0) end++
    const record = pairs.slice(i + 1, end)
    if (section === 'TABLES' && value === 'APPID') {
      const appName = one(attrs(pairs, i + 1, end), 2, 'DXF APPID name')
      if (!appName.trim()) throw Error('invalid blank DXF APPID name')
      const key = appName.toUpperCase()
      if (registeredAppIds.has(key)) throw Error('duplicate DXF APPID registration: ' + appName)
      registeredAppIds.add(key)
    }
    // DIMSTYLE uses 105 for its object handle. Its groups 5/6/7 are arrow
    // block names, often empty in genuine Seamly AAMA TABLES records.
    const ids = record.filter(p => value === 'DIMSTYLE' ? p.code === 105 : p.code === 5)
    if (ids.length > 1) throw Error('duplicate DXF record handle declaration: ' + value)
    const id = ids.length ? handle(ids[0].value, 'record') : null
    if (id !== null) {
      if (declarations.has(id)) throw Error('duplicate DXF record handle: ' + id)
      declarations.set(id, {kind:value})
    }
    if (section === 'OBJECTS' && id === null &&
        record.some(p => p.code === 330 || p.code === 350 || p.code === 360)) {
      throw Error('DXF OBJECTS owner/reference record lacks its own handle: ' + value)
    }
    // Group 390 is a plot-style handle, not an inert rendering string. A
    // receiving CAD can dereference it even when all CUT XY contours agree.
    // The default plot-style handle F is a well-known built-in in ordinary
    // AutoCAD-style LAYER records; it need not have a local OBJECTS record.
    // Custom plot-style object typing is not yet covered by this inspector.
    if (record.filter(p => p.code === 390).length > 1) {
      throw Error('duplicate DXF plot-style 390 handle: ' + value)
    }
    let inXdata = false
    for (const p of record) {
      if (p.code === 1001) {
        if (!p.value) throw Error('invalid blank DXF XDATA application name')
        xdataAppIds.push(p.value.toUpperCase())
        inXdata = true
      }
      if (p.code >= 1000 && p.code <= 1071 && !inXdata) {
        throw Error('orphan DXF XDATA group without application marker: ' + p.code)
      }
      if (inXdata && p.code < 1000) throw Error('interrupted DXF XDATA trailing record')
      if (inXdata && p.code > 1071) throw Error('unsupported DXF XDATA group: ' + p.code)
      // 1005 is an XDATA object-handle reference, not an opaque string.
      // A receiver may dereference it even when the physical XY CUT contours
      // are unaffected. Do not inspect a partial CAD metadata graph as safe.
      if (p.code === 1005 && !inXdata) throw Error('DXF XDATA 1005 handle without application marker')
      if (p.code !== 330 && p.code !== 350 && p.code !== 360 && p.code !== 390 && p.code !== 1005) continue
      references.push({source:id, target:handle(p.value, p.code === 1005 ? 'XDATA 1005' : p.code === 390 ? 'plot-style 390' : 'reference', true), code:p.code, kind:value})
    }
    i = end
  }
  // A 390 outside a recognized TABLES/BLOCKS/ENTITIES/OBJECTS record (for
  // example a HEADER plot-style pointer) is not covered by the typed source
  // inspection contract either; it must not silently disappear from inventory.
  if (pairs.filter(p => p.code === 390).length !== references.filter(r => r.code === 390).length) {
    throw Error('unsupported DXF plot-style 390 outside recognized record')
  }
  // XDATA application names are registered in APPID, not arbitrary labels.
  // Reject missing APPID tables for XDATA-bearing source-only CUT handoffs.
  for (const name of xdataAppIds) {
    if (!registeredAppIds.has(name)) throw Error('unregistered DXF XDATA APPID: ' + name)
  }
  const owner = new Map()
  for (const {source, target, code, kind} of references) {
    // A resolved handle is NOT proof that the target is a plot-style object:
    // a DICTIONARY, LWPOLYLINE or XRECORD can have the same handle. Until a
    // receiver-profile-aware typed plot-style contract is verified, only the
    // ordinary undeclared LAYER default F is supported for source-only CUT.
    if (code === 390) {
      if (kind === 'LAYER' && target === 'F' && !declarations.has('F')) continue
      throw Error('unsupported DXF plot-style 390 handle from ' + kind + ': ' + target)
    }
    // A 330 owner may be the root/null owner. A DICTIONARY value or hard-owner
    // 350/360 cannot resolve to that sentinel as an actual CAD object.
    if (target === '0' && code === 330) continue
    if (target === '0') throw Error('null DXF dictionary/owner handle reference ' + code + ' from ' + kind)
    if (!declarations.has(target)) {
      throw Error('dangling DXF handle reference ' + code + ' from ' + kind + ': ' + target)
    }
    // XDATA 1005 is a pointer, not ownership: an entity may legitimately
    // annotate itself. Owner/dictionary self-links remain invalid.
    if (source === target && code !== 1005) throw Error('self-referential DXF handle ' + code + ': ' + target)
    if (code === 330 && source !== null) {
      if (owner.has(source) && owner.get(source) !== target) {
        throw Error('ambiguous DXF owner handle: ' + source)
      }
      owner.set(source, target)
    }
  }
  // Only 330 is an ownership edge here. Dictionary 350/360 links can be
  // references rather than parentage, so they must resolve but are not used
  // to infer cycles.
  const settled = new Set()
  for (const source of owner.keys()) {
    const visited = new Set()
    let cursor = source
    while (owner.has(cursor) && !settled.has(cursor)) {
      if (visited.has(cursor)) throw Error('cyclic DXF owner handle: ' + cursor)
      visited.add(cursor)
      cursor = owner.get(cursor)
    }
    for (const id of visited) settled.add(id)
  }
}
function assertProductionLineGeometry(record, layer) {
  // Layer visibility is not enough: a receiving CAD may render a malformed
  // NOTCH/SA LINE differently (or drop it) while all CUT outlines stay valid.
  // This is limited to direct LINE marks, not proof of complete notch stations
  // or correct seam-allowance offsets for every graded piece.
  const label = 'production NOTCH/ALLOWANCE LINE ' + layer
  assertModelSpaceCutRecord(record, label)
  assertPlanarCutRecord(record, label, true)
  const endZ = one(record, 31, label + ' end z', false)
  if (endZ !== undefined && numeric(endZ, label + ' end z') !== 0) {
    throw Error('nonplanar ' + label + ' end z')
  }
  const x1 = numeric(one(record, 10, label + ' start x'), label + ' start x')
  const y1 = numeric(one(record, 20, label + ' start y'), label + ' start y')
  const x2 = numeric(one(record, 11, label + ' end x'), label + ' end x')
  const y2 = numeric(one(record, 21, label + ' end y'), label + ' end y')
  const length = Math.hypot(x2 - x1, y2 - y1)
  if (!finite(length) || length <= EPS) {
    throw Error('invalid zero-length or unrepresentable ' + label)
  }
}
function assertSectionEnvelope(pairs) {
  let section = null, entities = 0, ended = false, inBlock = false
  const declaredCutLayers = new Set()
  const declaredLayerNames = new Set()
  const referencedProductionLayers = new Set()
  let openTable = null
  const declaredTables = new Set()
  // Direct drawing entities belong in ENTITIES. BLOCKS may contain dormant
  // definitions, but only between a matching BLOCK / ENDBLK pair. Otherwise
  // a receiving CAD may interpret geometry that this inspector never visits.
  const geometry = new Set([
    'LINE','LWPOLYLINE','POLYLINE','VERTEX','SEQEND','ARC','CIRCLE','ELLIPSE',
    'SPLINE','POINT','HATCH','SOLID','TRACE','3DFACE','3DSOLID','BODY','REGION',
    'MLINE','MESH','RAY','XLINE','INSERT','DIMENSION','TEXT','MTEXT','LEADER',
    'IMAGE','ATTDEF','ATTRIB',
  ])
  // A self-contained CUT inspection may carry ordinary dictionary metadata,
  // but must not silently accept vendor-defined OBJECTS or HEADER entities.
  // Other OBJECTS kinds require a separate, explicit receiving-CAD contract.
  const knownMetadataObjects = new Set(['DICTIONARY','DICTIONARYWDFLT','XRECORD','ACDBPLACEHOLDER'])
  const knownTableRecords = new Set([
    'TABLE','ENDTAB','VPORT','LTYPE','LAYER','STYLE','VIEW','UCS',
    'APPID','DIMSTYLE','BLOCK_RECORD',
  ])
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i]
    if (ended) throw Error('data after DXF EOF')
    if (p.code === 0 && p.value === 'SECTION') {
      if (section !== null) throw Error('nested DXF SECTION')
      if (pairs[i + 1]?.code !== 2 || !pairs[i + 1].value) throw Error('SECTION without name')
      section = pairs[++i].value
      if (section === 'ENTITIES' && ++entities !== 1) throw Error('duplicate ENTITIES section')
    } else if (p.code === 0 && p.value === 'ENDSEC') {
      if (section === null) throw Error('unmatched DXF ENDSEC')
      if (inBlock) throw Error('unterminated DXF BLOCK definition')
      if (openTable !== null) throw Error('unterminated DXF TABLE: ' + openTable)
      section = null
    } else if (p.code === 0 && p.value === 'EOF') {
      if (section !== null) throw Error('EOF before ENDSEC')
      if (i !== pairs.length - 1) throw Error('nonterminal DXF EOF')
      ended = true
    } else if (section === null && p.code !== 999) {
      throw Error('DXF content outside SECTION')
    } else if (p.code === 0 && section !== 'BLOCKS' &&
               (p.value === 'BLOCK' || p.value === 'ENDBLK')) {
      throw Error('DXF BLOCK marker outside BLOCKS section')
    } else if (p.code === 0 && section === 'BLOCKS' && p.value === 'BLOCK') {
      if (inBlock) throw Error('nested DXF BLOCK definition')
      let stop = i + 1
      while (stop < pairs.length && pairs[stop].code !== 0) stop++
      assertNoExternalCutBlock20261030(pairs.slice(i + 1, stop))
      inBlock = true
    } else if (p.code === 0 && section === 'BLOCKS' && p.value === 'ENDBLK') {
      if (!inBlock) throw Error('orphan DXF ENDBLK')
      inBlock = false
    } else if (p.code === 0 && section !== 'ENTITIES') {
      // A dormant BLOCK can still carry an external file dependency; do not
      // certify a source-only factory handoff that needs receiver-side assets.
      assertNoExternalCutEntity20261030(p.value)
      if (section === 'HEADER') throw Error('unexpected drawing entity outside ENTITIES in HEADER: ' + p.value)
      if (section === 'OBJECTS' && !knownMetadataObjects.has(p.value)) {
        throw Error('unsupported unknown DXF OBJECTS drawing record outside ENTITIES: ' + p.value)
      }
      if (section === 'BLOCKS' && inBlock) assertKnownDirectCutEntity20261030(p.value)
      if (section === 'BLOCKS' && !inBlock) {
        throw Error('unsupported drawing entity outside ENTITIES or a defined BLOCK: ' + p.value)
      }
      if (section === 'TABLES' && !knownTableRecords.has(p.value)) {
        throw Error('unsupported DXF TABLES record outside ENTITIES: ' + p.value)
      }
      if (section === 'TABLES') {
        if (p.value === 'TABLE') {
          if (openTable !== null) throw Error('nested DXF TABLE')
          let stop = i + 1
          while (stop < pairs.length && pairs[stop].code !== 0) stop++
          const name = one(attrs(pairs, i + 1, stop), 2, 'DXF TABLE name')
          if (!knownTableRecords.has(name) || name === 'TABLE' || name === 'ENDTAB') {
            throw Error('unsupported DXF TABLE name: ' + name)
          }
          if (declaredTables.has(name)) throw Error('duplicate DXF TABLE: ' + name)
          declaredTables.add(name)
          openTable = name
        } else if (p.value === 'ENDTAB') {
          if (openTable === null) throw Error('orphan DXF ENDTAB')
          openTable = null
        } else if (openTable !== p.value) {
          throw Error('DXF TABLE record outside matching TABLE: ' + p.value)
        }
      }
      if (section === 'TABLES' && p.value === 'LAYER') {
        let stop = i + 1
        while (stop < pairs.length && pairs[stop].code !== 0) stop++
        const record = attrs(pairs, i + 1, stop)
        const name = one(record, 2, 'LAYER table name')
        if (!name.trim()) throw Error('invalid blank DXF LAYER table name')
        // Every LAYER identity is case-insensitive at the receiving CAD
        // boundary, not only CUT_ layers. Duplicate NOTCH/ALLOWANCE/annotation
        // declarations can resolve differently between CAD implementations.
        const layerKey = cutLayerKey(name)
        if (declaredLayerNames.has(layerKey)) {
          throw Error((isCutLayer(name) ? 'duplicate physical CUT LAYER table record: ' :
            'duplicate DXF LAYER table record: ') + name)
        }
        declaredLayerNames.add(layerKey)
        if (isCutLayer(name) || isNotchAllowanceLayer(name)) {
          const cut = isCutLayer(name)
          const label = cut ? 'CUT LAYER' : 'production NOTCH/ALLOWANCE LAYER'
          if (cut) declaredCutLayers.add(layerKey)
          const flagsValue = one(record, 70, label + ' flags', false)
          const flags = flagsValue === undefined ? 0 : numeric(flagsValue, label + ' flags')
          // DXF layer flags are small integer bitsets. Reject frozen and
          // xref-dependent/resolved production layers, not the locked bit.
          if (!Number.isSafeInteger(flags) || flags < 0 || flags > 127 || (flags & (1 | 2 | 16 | 32))) {
            throw Error('unsupported frozen or externally dependent ' + label + ': ' + name)
          }
          const colorValue = one(record, 62, label + ' color', false)
          if (colorValue !== undefined) {
            const color = numeric(colorValue, label + ' color')
            if (!Number.isInteger(color) || Math.abs(color) > 255 || color < 0) {
              throw Error('unsupported off or invalid ' + label + ' color: ' + name)
            }
          }
          const plotValue = one(record, 290, label + ' plot flag', false)
          if (plotValue !== undefined && plotValue !== '1') {
            throw Error('unsupported non-plot or invalid ' + label + ': ' + name)
          }
        }
      }
      if (section === 'CLASSES' && p.value !== 'CLASS') {
        throw Error('unsupported DXF CLASSES record outside ENTITIES: ' + p.value)
      }
      if (!['HEADER','OBJECTS','BLOCKS','TABLES','CLASSES'].includes(section)) {
        throw Error('unsupported DXF section entity outside ENTITIES: ' + section + '/' + p.value)
      }
      let next = i + 1
      while (next < pairs.length && pairs[next].code !== 0) next++
      const layer = pairs.slice(i + 1, next).filter(v => v.code === 8)
      if ((section !== 'BLOCKS' || !inBlock) &&
          (geometry.has(p.value) || layer.some(v => isCutLayer(v.value)))) {
        throw Error('drawing entity outside ENTITIES or a defined BLOCK: ' + p.value)
      }
    } else if (p.code === 0 && section === 'ENTITIES') {
      // When the sender declares a LAYER table, non-CUT production marks must
      // resolve to it too. Otherwise a receiving CAD can silently synthesize
      // a missing notch/allowance layer even while all CUT outlines look valid.
      let next = i + 1
      while (next < pairs.length && pairs[next].code !== 0) next++
      const layers = pairs.slice(i + 1, next).filter(v => v.code === 8)
      if (layers.some(v => isNotchAllowanceLayer(v.value))) {
        if (layers.length !== 1) throw Error('ambiguous production NOTCH/ALLOWANCE entity layer: ' + p.value)
        referencedProductionLayers.add(cutLayerKey(layers[0].value))
        // Only direct LINE production marks have a physical-geometry contract
        // here. Other types (including an otherwise valid LWPOLYLINE or ARC)
        // were previously ignored while CUT contours passed, allowing a
        // receiver to drop or reinterpret a notch/allowance without warning.
        // Refuse inspection rather than pretending an unsupported entity was
        // measured. Profile-specific polyline/curve support needs its own QA.
        if (p.value !== 'LINE') {
          throw Error('unsupported production NOTCH/ALLOWANCE entity type: ' + p.value + ' on ' + layers[0].value)
        }
        assertProductionLineGeometry(attrs(pairs, i + 1, next), layers[0].value)
      }
    }
  }
  if (!ended || section !== null || entities !== 1) throw Error('missing ENTITIES section or terminal EOF')
  if (declaredTables.has('LAYER')) {
    for (const name of referencedProductionLayers) {
      if (!declaredLayerNames.has(name)) {
        throw Error('production NOTCH/ALLOWANCE entity references undeclared DXF LAYER: ' + name)
      }
    }
  }
  assertResolvedCutMetadataHandles(pairs)
  // A legacy minimal DXF can omit the optional LAYER table. Once a sender
  // supplies that table, every physical CUT contour must resolve to a
  // declared layer: receiving CAD must not silently synthesize missing layers.
  return declaredTables.has('LAYER') ? declaredCutLayers : null
}
function parsePolyline(pairs, begin, end) {
  let next = begin + 1
  while (next < end && pairs[next].code !== 0) next++
  const head = attrs(pairs, begin + 1, next)
  const layer = one(head, 8, 'POLYLINE layer', false) || '0'
  const flags = numeric(one(head, 70, 'POLYLINE flags', false) ?? '0', 'POLYLINE flags')
  if (isCutLayer(layer)) {
    assertModelSpaceCutRecord(head, 'CUT POLYLINE')
    for (const code of [40,41]) checkZeroWidth(head,code,'CUT POLYLINE default width '+code)
    assertPlanarCutRecord(head, 'CUT POLYLINE', true)
  }
  if(isCutLayer(layer) && one(head,66,'CUT POLYLINE vertices-follow')!=='1') throw Error('invalid CUT POLYLINE vertices-follow')
  const points = []
  let done = false
  while (next < end) {
    if (pairs[next].code !== 0) throw Error('malformed POLYLINE sequence')
    const kind = pairs[next].value
    let stop = next + 1
    while (stop < end && pairs[stop].code !== 0) stop++
    if (kind === 'SEQEND') { next = stop; done = true; break }
    if (kind !== 'VERTEX') throw Error('POLYLINE missing SEQEND')
    const a = attrs(pairs, next + 1, stop)
    if (isCutLayer(layer)) {
      assertModelSpaceCutRecord(a, 'CUT VERTEX')
      if (a.has(42)) throw Error('CUT vertex bulge unsupported')
      const vertexLayer=one(a,8,'CUT vertex layer',false)
      if(vertexLayer!==undefined && cutLayerKey(vertexLayer)!==cutLayerKey(layer)) throw Error('CUT vertex layer differs from parent')
      if (numeric(one(a, 70, 'vertex flags', false) ?? '0', 'vertex flags') !== 0) throw Error('unsupported CUT vertex flags')
      for (const code of [40,41]) checkZeroWidth(a,code,'CUT VERTEX width '+code)
      for (const [code, expected, label] of [[30,0,'z'],[38,0,'elevation'],[39,0,'thickness'],[210,0,'extrusion x'],[220,0,'extrusion y'],[230,1,'extrusion z']]) {
        const value=one(a,code,'CUT vertex '+label,false)
        if(value!==undefined && numeric(value,'CUT vertex '+label)!==expected) throw Error('nonplanar CUT vertex '+label)
      }
      points.push({x: numeric(one(a, 10, 'vertex x'), 'vertex x'), y: numeric(one(a, 20, 'vertex y'), 'vertex y')})
    }
    next = stop
  }
  if (!done) throw Error('unterminated POLYLINE')
  if (isCutLayer(layer) && flags !== 1 && flags !== 129) throw Error('CUT POLYLINE must be closed planar 2D without fit, spline or mesh flags')
  return {next, contour: isCutLayer(layer) ? {layer, points} : null}
}
function parseLightPolyline(pairs, begin, end) {
  const a = attrs(pairs, begin + 1, end)
  const layer = one(a, 8, 'LWPOLYLINE layer', false) || '0'
  if (!isCutLayer(layer)) return null
  assertModelSpaceCutRecord(a, 'CUT LWPOLYLINE')
  assertPlanarCutRecord(a, 'CUT LWPOLYLINE')
  assertOrderedCutLightVertexPairs20261029(pairs.slice(begin + 1, end))
  if (a.has(42)) throw Error('CUT bulge unsupported')
  for (const code of [40,41]) checkZeroWidth(a,code,'CUT LWPOLYLINE vertex width '+code,true)
  checkZeroWidth(a,43,'CUT LWPOLYLINE constant width 43')
  let hasVertex=false, seenWidths=new Set()
  for (let i=begin+1;i<end;i++) {
    const code=pairs[i].code
    if (code===10) { hasVertex=true; seenWidths=new Set(); continue }
    if (code!==40 && code!==41) continue
    if (!hasVertex) throw Error('CUT LWPOLYLINE width before first vertex')
    if (seenWidths.has(code)) throw Error('duplicate CUT LWPOLYLINE width on one vertex')
    seenWidths.add(code)
  }
  const flags = numeric(one(a, 70, 'LWPOLYLINE flags', false) ?? '0', 'flags')
  if (flags !== 1 && flags !== 129) throw Error('CUT LWPOLYLINE must be closed 2D without unsupported flags')
  const xs = a.get(10) || [], ys = a.get(20) || []
  if (xs.length !== ys.length || numeric(one(a, 90, 'point count'), 'point count') !== xs.length) throw Error('CUT LWPOLYLINE vertex count mismatch')
  return {layer, points: xs.map((x, i) => ({x: numeric(x, 'x'), y: numeric(ys[i], 'y')}))}
}
function parseCuts(source) {
  const pairs = parsePairs(source)
  const declaredCutLayers = assertSectionEnvelope(pairs)
  const contours = []
  let inEntities = false, sawEntities = false, ended = false
  for (let i = 0; i < pairs.length;) {
    const p = pairs[i]
    if (p.code !== 0) { i++; continue }
    if (p.value === 'SECTION') {
      if (pairs[i + 1]?.code !== 2) throw Error('SECTION has no name')
      inEntities = pairs[i + 1].value === 'ENTITIES'
      if (inEntities) sawEntities = true
      i += 2; continue
    }
    if (p.value === 'ENDSEC') { inEntities = false; i++; continue }
    if (p.value === 'EOF') { ended = true; break }
    if (!inEntities) { i++; continue }
    assertNoIndirectCutEntity20261029(p.value)
    let end = i + 1
    while (end < pairs.length && pairs[end].code !== 0) end++
    if (p.value === 'POLYLINE') {
      const result = parsePolyline(pairs, i, pairs.length)
      if (result.contour) contours.push(result.contour)
      i = result.next; continue
    }
    if (p.value === 'LWPOLYLINE') {
      const cut = parseLightPolyline(pairs, i, end)
      if (cut) contours.push(cut)
    } else {
      const layer = one(attrs(pairs, i + 1, end), 8, 'entity layer', false)
      if (layer && isCutLayer(layer)) throw Error('unsupported CUT entity: ' + p.value)
    }
    i = end
  }
  if (!sawEntities || !ended) throw Error('DXF missing ENTITIES section or EOF')
  if (!contours.length) throw Error('DXF contains no physical CUT contours')
  if (declaredCutLayers !== null) {
    for (const contour of contours) {
      if (!declaredCutLayers.has(cutLayerKey(contour.layer))) {
        throw Error('physical CUT contour references undeclared DXF LAYER: ' + contour.layer)
      }
    }
  }
  return contours
}
function onSegment(a, b, p) {
  return Math.abs(cross(a, b, p)) < EPS && p.x >= Math.min(a.x,b.x)-EPS &&
    p.x <= Math.max(a.x,b.x)+EPS && p.y >= Math.min(a.y,b.y)-EPS && p.y <= Math.max(a.y,b.y)+EPS
}
function intersect(a,b,c,d) {
  const p = cross(a,b,c), q = cross(a,b,d), r = cross(c,d,a), s = cross(c,d,b)
  if ((p > EPS && q < -EPS || p < -EPS && q > EPS) && (r > EPS && s < -EPS || r < -EPS && s > EPS)) return true
  return onSegment(a,b,c) || onSegment(a,b,d) || onSegment(c,d,a) || onSegment(c,d,b)
}
function validate(contour) {
  const p = contour.points
  if (p.length > 4096 || p.length < 3) throw Error('CUT polygon requires 3 to 4096 vertices')
  if (p.some(v => !finite(v.x) || !finite(v.y))) throw Error('nonfinite CUT coordinates')
  if (same(p[0], p.at(-1))) p.pop() // Explicit repeated closure is harmless.
  if (p.length < 3) throw Error('degenerate CUT polygon')
  let area = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i+1)%p.length]
    if (same(a,b)) throw Error('zero-length CUT edge')
    area += a.x*b.y-b.x*a.y
  }
  if (Math.abs(area) <= EPS) throw Error('zero-area CUT polygon')
  for (let i = 0; i < p.length; i++) for (let j = i+1; j < p.length; j++) {
    if (j === i+1 || (i === 0 && j === p.length-1)) continue
    if (intersect(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length])) throw Error('self-intersecting CUT polygon')
  }
  return contour
}
function horizontalIntervals(poly, y) {
  const xs = []
  for (let i = 0; i < poly.length; i++) {
    const a=poly[i], b=poly[(i+1)%poly.length]
    if ((a.y < y && b.y > y) || (b.y < y && a.y > y)) xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y))
  }
  xs.sort((a,b)=>a-b)
  if (xs.length%2) throw Error('invalid polygon scanline')
  const intervals=[]
  for(let i=0;i<xs.length;i+=2) if(xs[i+1]-xs[i]>EPS) intervals.push([xs[i],xs[i+1]])
  return intervals
}
function overlap(a,b) {
  const ya=a.map(p=>p.y), yb=b.map(p=>p.y)
  const levels=[...ya,...yb]
  // Split at crossings too: the ordering of scanline edges can change there.
  for(let i=0;i<a.length;i++) for(let j=0;j<b.length;j++) {
    const p=a[i], q=a[(i+1)%a.length], r=b[j], s=b[(j+1)%b.length]
    const den=(q.x-p.x)*(s.y-r.y)-(q.y-p.y)*(s.x-r.x)
    if(Math.abs(den)<=EPS) continue
    const t=((r.x-p.x)*(s.y-r.y)-(r.y-p.y)*(s.x-r.x))/den
    const u=((r.x-p.x)*(q.y-p.y)-(r.y-p.y)*(q.x-p.x))/den
    if(t>0 && t<1 && u>0 && u<1) levels.push(p.y+t*(q.y-p.y))
  }
  levels.sort((x,y)=>x-y)
  for(let i=1;i<levels.length;i++) {
    if(levels[i]-levels[i-1]<=EPS) continue
    const y=(levels[i]+levels[i-1])/2
    const ia=horizontalIntervals(a,y), ib=horizontalIntervals(b,y)
    for(const x of ia) for(const z of ib) if(Math.min(x[1],z[1])-Math.max(x[0],z[0])>EPS) return true
  }
  return false
}
export function preflightPhysicalCutOverlap20261023_2000(dxf) {
  try {
    const contours=parseCuts(dxf).map(validate)
    const layers = new Set()
    for (const contour of contours) {
      if (layers.has(cutLayerKey(contour.layer))) throw Error('duplicate physical CUT layer: ' + contour.layer)
      layers.add(cutLayerKey(contour.layer))
    }
    const overlaps=[]
    for(let i=0;i<contours.length;i++) for(let j=i+1;j<contours.length;j++) {
      if(overlap(contours[i].points,contours[j].points)) overlaps.push({
        firstIndex:i,secondIndex:j,firstLayer:contours[i].layer,secondLayer:contours[j].layer,
        code:'PHYSICAL_CUT_INTERIOR_OVERLAP'
      })
    }
    return {ok:overlaps.length===0,contourCount:contours.length,overlaps,
      diagnostics:overlaps.map(o=>fail(o.code, o.firstLayer+' intersects '+o.secondLayer)),
      manufacturingApproved:false}
  } catch(error) {
    return {ok:false,contourCount:0,overlaps:[],diagnostics:[fail('INVALID_CUT_DXF',String(error.message))],manufacturingApproved:false}
  }
}
