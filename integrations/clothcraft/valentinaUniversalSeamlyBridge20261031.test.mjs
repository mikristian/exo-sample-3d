import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { XMLParser } from 'fast-xml-parser'
import { parseSeamlyConstructionReference } from '../../src/core/seamlyConstructionReference.js'
import { SEAMLY2D_RUNTIME_20261023 } from './seamly2dNativeEngine20261023.mjs'
import { convertValentinaSourceToSeamly20261031 as convert,
  evaluateConvertedValentina20261031 as evaluate } from './valentinaUniversalSeamlyBridge20261031.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const originals = path.join(root,'research/oss/pattern-cad/ValentinaDevelop20261031/src/app/share/collection')
const measurements = path.join(root,'research/oss/pattern-cad/Seamly2D/src/app/share/samples/measurements/individual')
const cases = [
  ['MaleShirt/MaleShirt.val','male_shirt.smis',188,17,5],
  ['Trousers/Trousers.val','trousers.smis',150,11,2],
]
const engine = fs.existsSync(SEAMLY2D_RUNTIME_20261023)

function constructionElements(xml) {
  const parser = new XMLParser({preserveOrder:true,ignoreAttributes:false,
    attributeNamePrefix:'@_',parseAttributeValue:false,parseTagValue:false})
  const pattern = parser.parse(xml).find(x=>x.pattern).pattern
  const blocks = pattern.filter(x=>x.draw || x.draftBlock)
  return blocks.map(block => {
    const calc = (block.draw || block.draftBlock).find(x=>x.calculation)?.calculation || []
    return calc.filter(x=>['point','spline','line','path','arc','operation'].includes(Object.keys(x)[0]))
      .map(x=>[Object.keys(x)[0],x[':@']?.['@_id']])
  })
}

test('authentic Valentina tool graph and order survive semantic conversion', () => {
  for (const [source,,tools,pieces,blocks] of cases) {
    const xml = fs.readFileSync(path.join(originals,source),'utf8')
    const out = convert(xml)
    assert.equal(out.ok,true,`${source}: ${out.reason}`)
    assert.equal(out.constructionTools,tools)
    assert.equal(out.pieces,pieces)
    assert.equal(out.blocks,blocks)
    assert.match(out.xml,/<draftBlock\b/)
    assert.doesNotMatch(out.xml,/<draw\b|<detail\b|typeLine=/)
    const parsed = parseSeamlyConstructionReference(out.xml)
    assert.equal(parsed.toolCount,tools)
    assert.deepEqual(constructionElements(xml),constructionElements(out.xml),
      'Construction command ordering and source IDs must remain identical')
  }
})

test('independent Valentina womens basic block reports unsupported internal paths', () => {
  const source = fs.readFileSync(path.join(originals,'Basic_block_women-2016.val'),'utf8')
  const result = convert(source)
  assert.equal(result.ok,false)
  assert.equal(result.code,'UNSUPPORTED_SOURCE')
  assert.ok(result.diagnostics.some(x=>x.code==='UNSUPPORTED_INTERNAL_PATH'))
  assert.ok(result.diagnostics.some(x=>x.id==='378'))
})

test('unsafe, malformed and unknown tool XML are refused with diagnostics', () => {
  const source = fs.readFileSync(path.join(originals,'MaleShirt/MaleShirt.val'),'utf8')
  const bad = [
    ['<!DOCTYPE pattern [<!ENTITY lol SYSTEM "file:///etc/passwd">]>\n'+source,'UNSAFE_XML'],
    [source.replace('</pattern>','<evil/></pattern>'),'UNSUPPORTED_SOURCE'],
    [source.replace('type="normal"','type="unknownDrill"'),'UNSUPPORTED_SOURCE'],
    [source.replace('</pattern>',''),'CONVERSION_FAILED'],
  ]
  for(const [xml,code] of bad) {
    const result = convert(xml)
    assert.equal(result.ok,false)
    if(code==='UNSAFE_XML') assert.match(result.reason,/UNSAFE_XML/)
    else assert.equal(result.code,code)
  }
})

test('native Seamly2D creates SVG and genuine AAMA from converted authentic source', {skip:!engine}, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'exo-valentina-semantic-test-'))
  try {
    for (const [source,table,tools] of cases) {
      const options = {patternPath:path.join(originals,source),measurementsPath:path.join(measurements,table),outputRoot:temp}
      const svg = evaluate({...options,format:'svg'})
      assert.equal(svg.ok,true,`${source}: ${svg.reason}`)
      assert.equal(svg.constructionTools,tools)
      assert.match(fs.readFileSync(svg.artifacts[0].filename,'utf8'),/<svg\b/)
      const dxf = evaluate({...options,format:'aama-r10'})
      assert.equal(dxf.ok,true,`${source}: ${dxf.reason}`)
      assert.match(fs.readFileSync(dxf.artifacts[0].filename,'utf8'),/SECTION\s*\n\s*2\s*\nENTITIES/)
      assert.equal(dxf.manufacturingApproved,false)
    }
  } finally {fs.rmSync(temp,{recursive:true,force:true})}
})

test('a numeric measurement edit changes the real solver SVG output', {skip:!engine}, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'exo-valentina-measurement-test-'))
  try {
    const original = fs.readFileSync(path.join(measurements,'male_shirt.smis'),'utf8')
    const edited = original.replace(/(name="bust_circ"[^>]*value=")([0-9.]+)/,(_,start,number)=>start+String(Number(number)+8))
    assert.notEqual(edited,original)
    const changedPath=path.join(temp,'edited.smis')
    fs.writeFileSync(changedPath,edited)
    const source=path.join(originals,'MaleShirt/MaleShirt.val')
    const a=evaluate({patternPath:source,measurementsPath:path.join(measurements,'male_shirt.smis'),outputRoot:temp})
    const b=evaluate({patternPath:source,measurementsPath:changedPath,outputRoot:temp})
    assert.equal(a.ok,true,a.reason)
    assert.equal(b.ok,true,b.reason)
    assert.notEqual(a.artifacts[0].sha256,b.artifacts[0].sha256)
  } finally {fs.rmSync(temp,{recursive:true,force:true})}
})
