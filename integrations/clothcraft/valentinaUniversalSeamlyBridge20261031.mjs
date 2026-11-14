// Semantic Valentina source transfer to independently executable Seamly2D XML.
// Original GPL Valentina/Seamly2D source fixtures are external to this module.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser'
import { evaluateSeamly2DPattern20261023 } from './seamly2dNativeEngine20261023.mjs'

const fail = (code, reason, diagnostics = []) => ({ ok: false, code, reason, diagnostics, manufacturingApproved: false })
const list = x => x == null ? [] : Array.isArray(x) ? x : [x]
const key = '@_'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const allowedRoot = new Set(['version','unit','author','description','notes','patternName','patternNumber','company','customer','patternLabel','measurements','increments','previewCalculations','draw','image','@_readOnly','#text'])
const allowedBlock = new Set(['calculation','modeling','details','groups','@_name','#text'])
const allowedTop = new Set(['point','line','spline','arc','path','operation'])
const allowedTool = new Set([
  'point:single','point:endLine','point:alongLine','point:normal','point:height',
  'point:shoulder','point:curveIntersectAxis','point:cutSpline','point:cutSplinePath',
  'point:lineIntersectAxis','point:lineIntersect','point:pointOfIntersection',
  'point:pointOfIntersectionCircles',
  'spline:simpleInteractive','spline:pathInteractive','spline:cubicBezier',
  'line:','path:2','operation:rotation',
])
const forbiddenXml = /<!\s*(?:DOCTYPE|ENTITY|\[CDATA\[)|<\?(?!xml\s)[\s\S]*?\?>/i
const parser = () => new XMLParser({ignoreAttributes:false, attributeNamePrefix:key,
  parseTagValue:false,parseAttributeValue:false,trimValues:false,processEntities:true,
  ignoreDeclaration:true,ignorePiTags:false,allowBooleanAttributes:false})
const builder = () => new XMLBuilder({ignoreAttributes:false,attributeNamePrefix:key,
  suppressEmptyNode:true,format:true,indentBy:'    ',processEntities:true})

function preserveConstructionOrder(originalXml, formattedXml) {
  // The default object-style XML parser groups same-name elements. Native
  // construction requires points, splines, operations and lines in the exact
  // original command sequence, including interleaved types.
  const source = new XMLParser({preserveOrder:true,ignoreAttributes:false,
    attributeNamePrefix:key,parseAttributeValue:false,parseTagValue:false,
    trimValues:false,processEntities:true}).parse(originalXml)
  const ordered = new XMLParser({preserveOrder:true,ignoreAttributes:false,
    attributeNamePrefix:key,parseAttributeValue:false,parseTagValue:false,
    trimValues:false,processEntities:true}).parse(formattedXml)
  const sourceRoot = source.find(e=>e.pattern)?.pattern || []
  const outputRoot = ordered.find(e=>e.pattern)?.pattern || []
  const originalBlocks = sourceRoot.filter(e=>Object.hasOwn(e,'draw'))
  const outputBlocks = outputRoot.filter(e=>Object.hasOwn(e,'draftBlock'))
  if (originalBlocks.length !== outputBlocks.length) throw new Error('CONVERSION_MISMATCH: draft blocks changed')
  for (let i = 0; i < originalBlocks.length; i++) {
    const sourceCalc = originalBlocks[i].draw.find(e=>Object.hasOwn(e,'calculation'))?.calculation
    const targetCalc = outputBlocks[i].draftBlock.find(e=>Object.hasOwn(e,'calculation'))?.calculation
    if (!sourceCalc || !targetCalc) throw new Error('CONVERSION_MISMATCH: calculation missing')
    const sourceOrder = sourceCalc.filter(e => allowedTop.has(Object.keys(e)[0]))
      .map(e=>[Object.keys(e)[0],String(e[':@']?.['@_id'] || '')])
    const outputById = new Map()
    for (const e of targetCalc) {
      const tag = Object.keys(e)[0]
      if (!allowedTop.has(tag)) continue
      const id = String(e[':@']?.['@_id'] || '')
      if (!id || outputById.has(id)) throw new Error(`CONVERSION_MISMATCH: duplicate or missing tool ID ${id}`)
      outputById.set(id,e)
    }
    if (sourceOrder.length !== outputById.size) throw new Error('CONVERSION_MISMATCH: tool counts differ')
    const reordered = sourceOrder.map(([tag,id])=>{
      const item = outputById.get(id)
      if (!item || Object.keys(item)[0] !== tag) throw new Error(`CONVERSION_MISMATCH: tool ID ${id} changed`)
      return item
    })
    targetCalc.splice(0,targetCalc.length,...reordered)
  }
  const xml = new XMLBuilder({preserveOrder:true,ignoreAttributes:false,attributeNamePrefix:key,
    suppressEmptyNode:true,format:true,indentBy:'    ',processEntities:true}).build(ordered)
  return restoreBooleanAttributeSerialization(xml)
}

function restoreBooleanAttributeSerialization(xml) {
  // The upstream XML builder abbreviates the literal string "true" as a
  // valueless HTML-style attribute. XML requires the quoted assignment.
  return xml.replace(/<([A-Za-z_][A-Za-z0-9_.:-]*)(\s[^<>]*?)?\s*\/?>/g, whole => {
    if (whole.startsWith('</')) return whole
    let output = '', insideQuote = false, quote = '', index = 0
    while (index < whole.length) {
      const c = whole[index]
      if (insideQuote) {
        if (c === quote) insideQuote = false
        output += c; index++; continue
      }
      if (c === '"' || c === "'") {insideQuote = true; quote = c; output += c; index++;continue}
      if (c === ' ' && /[A-Za-z_:]/.test(whole[index+1] || '')) {
        let next = index + 1
        while (/[A-Za-z0-9_:.-]/.test(whole[next] || '')) next++
        if (next > index + 1 && /[\s/>]/.test(whole[next] || '')) {
          output += whole.slice(index,next) + '="true"'; index = next; continue
        }
      }
      output += c; index++
    }
    return output
  })
}

function sanitizeParsedTree(node) {
  if (!node || typeof node !== 'object') return
  for (const [tag, item] of Object.entries(node)) {
    if (tag === '#text' && (typeof item !== 'string' || item.trim() === '')) {delete node[tag];continue}
    if (typeof item === 'object') {
      for (const entry of list(item)) sanitizeParsedTree(entry)
    } else if (tag.startsWith('@_') && typeof item === 'string') {
      // fast-xml-parser retains numeric references in attributes; the builder
      // otherwise escapes their ampersands a second time.
      node[tag] = item.replace(/&#(?:x([0-9a-fA-F]+)|([0-9]+));/g, (match, hex, dec) => {
        const scalar = Number.parseInt(hex || dec, hex ? 16 : 10)
        if (scalar < 32 && scalar !== 10 && scalar !== 9 && scalar !== 13) return match
        return scalar > 0 && scalar <= 0x10ffff && !(scalar >= 0xd800 && scalar <= 0xdfff) ? String.fromCodePoint(scalar) : match
      })
    }
  }
}

function readXml(xml, extension) {
  if (typeof xml !== 'string' || !xml.length || Buffer.byteLength(xml) > 8 * 1024 * 1024)
    throw new Error(`INVALID_XML: ${extension} source exceeds 8 MB or is empty`)
  if (forbiddenXml.test(xml)) throw new Error('UNSAFE_XML: external entities, document types, CDATA and processing instructions are prohibited')
  const valid = XMLValidator.validate(xml)
  if (valid !== true) throw new Error(`INVALID_XML: ${valid?.err?.msg || 'Malformed XML'}`)
  const data = parser().parse(xml)
  if (!data || typeof data !== 'object' || !data.pattern || Object.keys(data).some(k => !['pattern','?xml'].includes(k)))
    throw new Error('UNSUPPORTED_SOURCE: Expected exactly one Valentina pattern root')
  sanitizeParsedTree(data.pattern)
  return data.pattern
}

function inspectTree(node, where, diagnostics) {
  if (!node || typeof node !== 'object') return
  for (const [name, value] of Object.entries(node)) {
    if (name === '__proto__' || name === 'constructor' || name === 'prototype')
      diagnostics.push({code:'UNSUPPORTED_TAG', location:where, tag:name})
    if (name.startsWith('@_')) {
      if (typeof value !== 'string' || value.length > 32768)
        diagnostics.push({code:'UNSUPPORTED_ATTRIBUTE', location:where, tag:name})
    } else if (typeof value === 'object') {
      for (const child of list(value)) inspectTree(child, `${where}/${name}`, diagnostics)
    } else if (typeof value === 'string' && value.length > 65536 && name !== 'image' && name !== '#text' && !where.endsWith('/image')) {
      diagnostics.push({code:'OVERSIZED_TEXT', location:where, tag:name})
    }
    if (diagnostics.length > 50) return
  }
}

function convertDetail(detail) {
  const out = structuredClone(detail)
  // Valentina detail and Seamly piece use the same construction node ids and contour semantics.
  // Older Valentina pieces omit the modern per-piece envelope. Supply neutral metadata.
  if (!Object.hasOwn(out, '@_seamAllowance')) out['@_seamAllowance'] = '1'
  if (!Object.hasOwn(out, '@_version')) out['@_version'] = '2'
  if (!Object.hasOwn(out, '@_width')) out['@_width'] = '1'
  if (out['@_supplement'] != null) delete out['@_supplement']
  if (!Object.hasOwn(out, 'nodes')) {
    const nodes = list(out.node)
    if (!nodes.length) throw new Error('UNSUPPORTED_PIECE: Detail contains no contour nodes')
    out.nodes = {node:nodes.map(n => {
      const copy = structuredClone(n)
      delete copy['@_nodeType']; delete copy['@_mx']; delete copy['@_my']
      return copy
    })}
    delete out.node
  }
  return out
}

/** Convert authentic, editable Valentina source geometry and formulas to Seamly2D XML.
 * Unsupported geometry is refused instead of being silently replaced.
 */
export function convertValentinaSourceToSeamly20261031(xml, { measurementReference = 'measurements.smis' } = {}) {
  try {
    if (typeof measurementReference !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}\.smis$/.test(measurementReference))
      return fail('INVALID_MEASUREMENT_REFERENCE', 'Expected a local .smis measurement filename')
    const root = readXml(xml,'.val')
    const diagnostics = []
    inspectTree(root,'pattern',diagnostics)
    for (const k of Object.keys(root)) if (!allowedRoot.has(k)) diagnostics.push({code:'UNSUPPORTED_TAG',location:'pattern',tag:k})
    if (!/^(?:0\.[3-7]\.[0-9]+)$/.test(String(root.version || '')))
      diagnostics.push({code:'UNSUPPORTED_VERSION',location:'pattern/version',value:String(root.version || '')})
    if (!['cm','mm','inch','in'].includes(String(root.unit || '').toLowerCase()))
      diagnostics.push({code:'UNSUPPORTED_UNITS',location:'pattern/unit',value:String(root.unit || '')})
    const draws = list(root.draw)
    if (!draws.length || draws.length > 100) diagnostics.push({code:'INVALID_BLOCKS',location:'pattern/draw',count:draws.length})
    let toolCount = 0, pieceCount = 0
    for (const [i, draw] of draws.entries()) {
      if (!draw || typeof draw !== 'object' || !draw['@_name']) {
        diagnostics.push({code:'INVALID_BLOCK',location:`draw[${i}]`});continue
      }
      for (const tag of Object.keys(draw)) if (!allowedBlock.has(tag)) diagnostics.push({code:'UNSUPPORTED_TAG',location:`draw[${i}]`,tag})
      for (const tag of Object.keys(draw.calculation || {})) {
        if (tag === '#text') continue
        if (!allowedTop.has(tag)) diagnostics.push({code:'UNSUPPORTED_TOOL_FAMILY',location:`draw[${i}]/calculation`,tag})
        else for (const tool of list(draw.calculation[tag])) {
          const type = `${tag}:${tool?.['@_type'] || ''}`
          if (!allowedTool.has(type)) diagnostics.push({code:'UNSUPPORTED_TOOL',location:`draw[${i}]/calculation`,tag:type,id:tool?.['@_id']})
          if (!tool || typeof tool !== 'object' || !tool['@_id']) diagnostics.push({code:'INVALID_TOOL',location:`draw[${i}]/calculation`,tag})
          toolCount++
        }
      }
      for (const detail of list(draw.details?.detail)) {
        if (!detail || typeof detail !== 'object' || !detail['@_id']) diagnostics.push({code:'INVALID_PIECE',location:`draw[${i}]/details`})
        pieceCount++
      }
    }
    for (const [i,draw] of draws.entries()) {
      for (const item of list(draw.calculation?.path)) {
        diagnostics.push({code:'UNSUPPORTED_INTERNAL_PATH',location:`draw[${i}]/calculation/path`,id:item?.['@_id'],
          reason:'Valentina internal-path commands are not supported by Seamly2D 0.6 native schema'})
      }
      for (const item of list(draw.modeling?.path)) {
        diagnostics.push({code:'UNSUPPORTED_INTERNAL_PATH',location:`draw[${i}]/modeling/path`,id:item?.['@_id'],
          reason:'Valentina internal-path modeling objects are absent from Seamly2D 0.6'})
      }
    }
    if (toolCount < 1 || toolCount > 6000 || pieceCount > 500) diagnostics.push({code:'INVALID_SIZE',location:'pattern',toolCount,pieceCount})
    if (diagnostics.length) return fail('UNSUPPORTED_SOURCE',`Valentina source uses ${diagnostics.length} unsupported or invalid feature(s)`,diagnostics.slice(0,50))
    const result = structuredClone(root)
    delete result.author
    delete result.image
    delete result.previewCalculations
    result.version = '0.6.8'
    result.measurements = measurementReference
    if (!result.patternLabel) result.patternLabel = {line:{'@_alignment':'0','@_bold':'false','@_italic':'false','@_sfIncrement':'0','@_text':'%pName%'}}
    result.draftBlock = draws.map(draw => {
      const block = structuredClone(draw)
      for (const tag of ['point','line','spline','arc','path','operation']) {
        for (const item of list(block.calculation?.[tag])) {
          if (!item || typeof item !== 'object') continue
          if (Object.hasOwn(item,'@_typeLine')) {
            // Valentina's hairline is the Seamly solidLine display style.
            item['@_lineType'] = item['@_typeLine'] === 'hair' ? 'solidLine' : item['@_typeLine']
            delete item['@_typeLine']
          }
          // Valentina 0.7 point-label display state is absent from Seamly 0.6's
          // construction-point schema; it has no geometric role.
          if (tag === 'point' && Object.hasOwn(item,'@_showLabel')) delete item['@_showLabel']
        }
      }
      for (const point of list(block.modeling?.point)) {
        if (point && typeof point === 'object') delete point['@_showLabel']
      }
      const details = list(block.details?.detail)
      block.pieces = details.length ? {piece:details.map(convertDetail)} : ''
      delete block.details
      // Schema order: calculation, modeling, pieces, groups.
      const sorted = {'@_name':block['@_name'],calculation:block.calculation,
        modeling:block.modeling,pieces:block.pieces}
      if (Object.hasOwn(block,'groups')) sorted.groups = block.groups
      for (const point of list(block.calculation?.point)) {
        if (point['@_type'] === 'pointOfIntersection') {
          point['@_type'] = 'intersectXY'
          point['@_lineColor'] ??= 'black'
          point['@_lineType'] ??= 'dashLine'
          point['@_lineWeight'] ??= '0.35'
        }
      }
      return sorted
    })
    delete result.draw
    const ordered = {}
    if (Object.hasOwn(result,'@_readOnly')) ordered['@_readOnly'] = result['@_readOnly']
    for (const field of ['version','unit','description','notes','patternName','patternNumber','company','customer','patternLabel','measurements','increments','draftBlock']) {
      if (Object.hasOwn(result,field)) ordered[field] = result[field]
    }
    const serialized = `<?xml version="1.0" encoding="UTF-8"?>\n${preserveConstructionOrder(xml,restoreBooleanAttributeSerialization(builder().build({pattern:ordered})))}\n`
    const sourceTools = list(result.draftBlock).reduce((n, b) => n + Object.entries(b.calculation || {}).reduce((k,[tag,v])=>k + (allowedTop.has(tag) ? list(v).length : 0),0),0)
    if (sourceTools !== toolCount) throw new Error('CONVERSION_MISMATCH: tool counts changed')
    return {ok:true,xml:serialized,sourceSha256:hash(Buffer.from(xml)),outputSha256:hash(Buffer.from(serialized)),
      blocks:draws.length,constructionTools:toolCount,pieces:pieceCount,
      geometry:'source-construction-tools',formulas:'preserved',manufacturingApproved:false}
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return fail(reason.split(':')[0].startsWith('UNSUPPORTED')?'UNSUPPORTED_SOURCE':'CONVERSION_FAILED',reason)
  }
}

/** Run genuine native Seamly2D on a converted .val, with an explicit .smis fixture. */
export function evaluateConvertedValentina20261031({patternPath,measurementsPath,format='svg',outputRoot,executablePath}={}) {
  let scratch
  try {
    if (typeof patternPath !== 'string' || !/\.val$/i.test(patternPath)) return fail('INVALID_PATTERN_PATH','Expected a Valentina .val file')
    if (typeof measurementsPath !== 'string' || !/\.smis$/i.test(measurementsPath)) return fail('MEASUREMENTS_REQUIRED','Native evaluation requires validated .smis measurements')
    const stat = fs.lstatSync(patternPath)
    if (!stat.isFile() || stat.size > 8 * 1024 * 1024) return fail('INVALID_PATTERN','Invalid Valentina pattern file')
    const result = convertValentinaSourceToSeamly20261031(fs.readFileSync(patternPath,'utf8'))
    if (!result.ok) return result
    scratch = fs.mkdtempSync(path.join(os.tmpdir(),'exo-valentina-universal-'))
    const converted = path.join(scratch,'converted.sm2d')
    fs.writeFileSync(converted,result.xml,{flag:'wx'})
    const evaluated = evaluateSeamly2DPattern20261023({patternPath:converted,measurementsPath,format,
      ...(outputRoot?{outputRoot}:{}),...(executablePath?{executablePath}:{})})
    return {...evaluated,bridge:'semantic-valentina-conversion',sourceSha256:result.sourceSha256,
      convertedSha256:result.outputSha256,sourceTools:result.constructionTools,sourcePieces:result.pieces,manufacturingApproved:false}
  } catch(error) { return fail('EVALUATION_FAILED',error instanceof Error?error.message:String(error)) }
  finally {if(scratch)fs.rmSync(scratch,{recursive:true,force:true})}
}
