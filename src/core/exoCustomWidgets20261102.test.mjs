import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EXO_WIDGET_STORAGE_KEY, makeExoCustomWidget, validateExoCustomWidget,
  importExoCustomWidgetJson, readExoCustomWidgetLibrary, saveExoCustomWidgetLibrary,
  parseExoCustomWidgetJson, exportExoCustomWidgetJson, importExoCustomWidgetFile,
} from './exoCustomWidgets20261102.js'

test('widget definitions round trip using a bounded declarative schema', () => {
  const widget = makeExoCustomWidget({ id: 'proof', title: 'Fit QA', blocks: [{ type: 'progress', label: 'Ready', value: 77.5 }, { type: 'button', label: 'Simulate', command: 'simulation.start' }] })
  assert.deepEqual(parseExoCustomWidgetJson(exportExoCustomWidgetJson(widget)), validateExoCustomWidget(widget))
})

test('uploaded JSON file is checked before reading and validated through the same importer', async () => {
  const original = makeExoCustomWidget({ id: 'uploaded', title: 'Upload sample' })
  const contents = JSON.stringify(original)
  const file = { name: 'panel.json', size: Buffer.byteLength(contents), text: async () => contents }
  const imported = await importExoCustomWidgetFile(file, [original])
  assert.equal(imported.title, 'Upload sample')
  assert.notEqual(imported.id, original.id)
  let read = false
  await assert.rejects(() => importExoCustomWidgetFile({ name: 'oversize.json', size: 32769, text: async () => { read = true; return contents } }), /32 KB/)
  assert.equal(read, false)
  await assert.rejects(() => importExoCustomWidgetFile({ ...file, name: 'dangerous.js' }), /\.json/)
  await assert.rejects(() => importExoCustomWidgetFile({ name: 'broken.json', size: 4, text: async () => 'oops' }), /Invalid JSON/)
})

test('import drops executable fields and refuses script or malformed command values', () => {
  const input = makeExoCustomWidget({ id: 'safe', blocks: [{ type: 'text', label: 'Test', value: 'safe', onclick: 'alert(1)' }], dangerouslySetInnerHTML: { __html: '<script />' } })
  const validated = parseExoCustomWidgetJson(JSON.stringify(input))
  assert.equal('dangerouslySetInnerHTML' in validated, false)
  assert.equal('onclick' in validated.blocks[0], false)
  assert.throws(() => validateExoCustomWidget({ ...input, blocks: [{ type: 'button', command: 'alert(1)' }] }), /invalid characters/)
  assert.throws(() => parseExoCustomWidgetJson('{"constructor"'), /Invalid JSON/)
})

test('library persists validated widgets, prevents duplicates, and skips damaged records', () => {
  const data = new Map()
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }
  const first = makeExoCustomWidget({ id: 'first' })
  assert.equal(saveExoCustomWidgetLibrary([first], storage).length, 1)
  assert.equal(readExoCustomWidgetLibrary(storage)[0].id, 'first')
  assert.throws(() => saveExoCustomWidgetLibrary([first, first], storage), /Duplicate/)
  data.set(EXO_WIDGET_STORAGE_KEY, JSON.stringify([{}, first, first]))
  assert.equal(readExoCustomWidgetLibrary(storage).length, 1)
  assert.notEqual(importExoCustomWidgetJson(JSON.stringify(first), [first]).id, first.id)
})
