import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseValentinaConstructionReference } from './valentinaConstructionReference20261031.js'
import { editValentinaConstructionFormula20261031 as edit, valentinaConstructionDependents20261031 as dependents } from './valentinaConstructionEdit20261031.js'

const original = readFileSync(new URL('./fixtures/valentina/Basic_block_women-2016.val', import.meta.url), 'utf8')

test('edits genuine construction tool while preserving every other XML byte and original graph', () => {
  const result = edit(original, {toolId:'2',formula:'#L+2'})
  const before = '<point angle="270" basePoint="1" id="2" length="#L"'
  const after = '<point angle="270" basePoint="1" id="2" length="#L+2"'
  assert.equal(result, original.replace(before, after))
  assert.notEqual(result, original)
  const graph = parseValentinaConstructionReference(result)
  assert.equal(graph.blocks[0].nodes[1].attributes.length, '#L+2')
  assert.equal(graph.toolCount, 151)
  assert.equal(graph.blocks[0].nodes[2].attributes.length, '#SD+#SD_ease')
})

test('edits authentic increment and exposes transitive construction graph dependents', () => {
  const result = edit(original,{incrementName:'#SD',attribute:'formula',formula:'#CG/10+15'})
  assert.equal(result, original.replace('formula="#CG/10+(#CG&lt;116?11:10.5 )" name="#SD"', 'formula="#CG/10+15" name="#SD"'))
  const graph = parseValentinaConstructionReference(result)
  assert.equal(graph.increments.find(row => row.name === '#SD').formula, '#CG/10+15')
  const affected = dependents(result,'#CG')
  assert.ok(affected.increments.includes('#SD'))
  assert.ok(affected.tools.some(node => node.id === '3'))
  assert.equal(graph.blocks[0].nodes[2].attributes.length, '#SD+#SD_ease')
})

test('rejects missing or ambiguous edit targets, unsafe XML, bad formulas and unknown references', () => {
  assert.throws(() => edit(original,{toolId:999999,formula:'5'}), /Unknown/)
  assert.throws(() => edit(original,{toolId:2,attribute:'basePoint',formula:'5'}), /Unsupported/)
  assert.throws(() => edit(original,{toolId:2,formula:'#Missing+1'}), /Unknown/)
  assert.throws(() => edit(original,{incrementName:'#L',attribute:'formula',formula:'#L+1'}), /Cyclic/)
  assert.throws(() => edit(original,{toolId:2,formula:'<script>'}), /Invalid/)
  assert.throws(() => edit(original.replace('<pattern>', '<!DOCTYPE pattern><pattern>'),{toolId:2,formula:'8'}), /DOCTYPE/)
  assert.throws(() => edit(original,{toolId:2,incrementName:'#L',formula:'8'}), /exactly one/)
  assert.throws(() => edit(original,{toolId:2,formula:'5',drawIndex:100}), /Unknown/)
})
