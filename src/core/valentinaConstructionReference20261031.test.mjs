import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseValentinaConstructionReference } from './valentinaConstructionReference20261031.js'

const fixture = readFileSync(new URL('./fixtures/valentina/Basic_block_women-2016.val', import.meta.url), 'utf8')

test('imports unchanged GPL Valentina reference fixture, preserves source formula and graph', () => {
  assert.equal(createHash('sha256').update(fixture).digest('hex'), '6d56f2a2ca539dc09479333af22721fb4a6ad86252bd6ef264235e9dd21799f9')
  const result = parseValentinaConstructionReference(fixture, {filename:'Basic_block_women-2016.val'})
  assert.equal(result.kind, 'val')
  assert.equal(result.unit, 'cm')
  assert.equal(result.blocks.length, 1)
  assert.equal(result.toolCount, 151)
  assert.equal(result.incrementCount, 42)
  assert.equal(result.sourceByteLength, Buffer.byteLength(fixture))
  assert.equal(result.blocks[0].nodes[1].attributes.length, '#L')
  assert.equal(result.blocks[0].nodes[2].attributes.length, '#SD+#SD_ease')
  assert.equal(result.blocks[0].nodes[2].references.firstPoint, '1')
  assert.equal(result.blocks[0].nodes[2].references.secondPoint, '2')
  assert.ok(result.blocks[0].nodes.some(n => n.family === 'spline' && Object.keys(n.children).length > 0))
})

test('rejects malicious, malformed and unsupported Valentina XML', () => {
  const replace = (source, target) => fixture.replace(source, target)
  assert.throws(() => parseValentinaConstructionReference('<!DOCTYPE pattern [<!ENTITY x SYSTEM "file:///etc/passwd">]>'+fixture), /DOCTYPE/)
  assert.throws(() => parseValentinaConstructionReference('<pattern><unit>cm</unit></pattern>'), /Valentina/)
  assert.throws(() => parseValentinaConstructionReference(replace('<unit>cm</unit>', '<unit>kilometers</unit>')), /unit/)
  assert.throws(() => parseValentinaConstructionReference(replace('<calculation>', '<calculation><laser id="999"/>')), /Unsupported/)
  assert.throws(() => parseValentinaConstructionReference(replace('id="2"', 'id="1"')), /duplicate/)
  assert.throws(() => parseValentinaConstructionReference(fixture + '<more/>'), /Invalid|Not a Valentina/)
  assert.throws(() => parseValentinaConstructionReference(fixture.repeat(100)), /4 MB/)
})

test('retains unevaluated formula strings without interpreting executable content', () => {
  const xml = `<?xml version="1.0"?><pattern><version>0.7.8</version><unit>cm</unit><increments><increment name="#A" formula="2 + 2"/></increments><draw name="Test"><calculation><point id="1" type="single" x="0" y="0"/><point id="2" type="endLine" basePoint="1" length="#A + 1" angle="90"/></calculation></draw></pattern>`
  const parsed = parseValentinaConstructionReference(xml)
  assert.equal(parsed.increments[0].formula, '2 + 2')
  assert.equal(parsed.blocks[0].nodes[1].attributes.length, '#A + 1')
  assert.deepEqual(parsed.unresolvedIncrements, [])
  assert.equal(parsed.toolCount, 2)
})
