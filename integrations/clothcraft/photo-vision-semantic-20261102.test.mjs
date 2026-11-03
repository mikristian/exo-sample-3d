import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateExoGarmentPhotoVisionInput20261102 as validate,
  analyzeExoGarmentPhotoVision20261102 as analyze,
} from './photo-vision-semantic-20261102.mjs'

function png() {
  const data = Buffer.alloc(80)
  Buffer.from([137,80,78,71,13,10,26,10]).copy(data)
  data.write('IHDR', 12, 'ascii')
  data.writeUInt32BE(160, 16)
  data.writeUInt32BE(160, 20)
  return { imageBase64: data.toString('base64'), mimeType: 'image/png' }
}
const semantic = { family: 'hoodie', silhouette: 'oversized', approximateColor: 'blue',
  visibleClosure: 'drawstring', uncertainties: ['pose', 'construction-hidden'], confidence: 'uncalibrated' }
const mock = (content = JSON.stringify(semantic), extra = {}) => async (_url, opts) => {
  const body = JSON.parse(opts.body)
  assert.equal(body.stream, false)
  assert.equal(body.model, 'qwen3-vl-instruct:2b')
  assert.equal(body.messages[1].images[0], png().imageBase64)
  assert.equal(_url, 'http://127.0.0.1:11434/api/chat')
  return { ok: true, headers: { get: () => null },
    text: async () => JSON.stringify({ done: true, message: { role: 'assistant', content }, ...extra }) }
}

test('accepts local valid PNG with exact schema, uncalibrated photo inference', async () => {
  const out = await analyze(png(), { fetchImpl: mock() })
  assert.equal(out.ok, true)
  assert.equal(out.kind, 'photo-vision-semantic')
  assert.equal(out.family, 'hoodie')
  assert.equal(out.measurementCalibrationVerified, false)
  assert.equal(out.manufacturingApproved, false)
  assert.equal(out.needsHumanReview, true)
  assert.equal(out.confidence, 'uncalibrated')
})
test('rejects MIME mismatch, data URL, excess payload, and bad PNG dimensions', () => {
  assert.equal(validate({ ...png(), mimeType: 'image/jpeg' }), null)
  assert.equal(validate({ ...png(), imageBase64: 'data:image/png;base64,' + png().imageBase64 }), null)
  assert.equal(validate({ ...png(), imageBase64: 'A'.repeat(2_800_004) }), null)
  const bad = Buffer.from(png().imageBase64, 'base64')
  bad.writeUInt32BE(100000, 16)
  assert.equal(validate({ ...png(), imageBase64: bad.toString('base64') }), null)
})
test('refuses malformed/invented fields, measurements, and partial protocol', async () => {
  const invented = { ...semantic, chestCm: 120 }
  assert.equal((await analyze(png(), { fetchImpl: mock(JSON.stringify(invented)) })).code, 'INVALID_MODEL_OUTPUT')
  assert.equal((await analyze(png(), { fetchImpl: mock('{invalid') })).code, 'INVALID_MODEL_OUTPUT')
  assert.equal((await analyze(png(), { fetchImpl: mock(JSON.stringify({ ...semantic, confidence: 'high' })) })).code, 'INVALID_MODEL_OUTPUT')
  const incomplete = await analyze(png(), { fetchImpl: async () => ({
    ok: true, headers: { get: () => null },
    text: async () => JSON.stringify({ done: false, message: { role: 'assistant', content: JSON.stringify(semantic) } }),
  }) })
  assert.equal(incomplete.code, 'INCOMPLETE_MODEL_OUTPUT')
})
test('deduplicates only known uncertainty values from real-model style output', async () => {
  const output = await analyze(png(), { fetchImpl: mock(JSON.stringify({
    ...semantic, uncertainties: ['pose', 'pose', 'construction-hidden'],
  })) })
  assert.equal(output.ok, true)
  assert.deepEqual(output.uncertainties, ['pose', 'construction-hidden'])
})
test('fails closed when Ollama is unavailable', async () => {
  const missing = await analyze(png(), { fetchImpl: async () => ({ ok: false, status: 404 }) })
  assert.equal(missing.code, 'MODEL_NOT_INSTALLED')
  const unavailable = await analyze(png(), { fetchImpl: async () => { throw Error('ECONNREFUSED') } })
  assert.equal(unavailable.code, 'MODEL_UNAVAILABLE')
})
test('single concurrency gate rejects simultaneous calls', async () => {
  let release
  const hold = new Promise(resolve => { release = resolve })
  let started
  const entered = new Promise(resolve => { started = resolve })
  const ongoing = analyze(png(), { fetchImpl: async () => {
    started()
    await hold
    return { ok: true, headers: { get: () => null },
      text: async () => JSON.stringify({ done: true, message: { role: 'assistant', content: JSON.stringify(semantic) } }) }
  } })
  await entered
  assert.equal((await analyze(png(), { fetchImpl: mock() })).code, 'MODEL_BUSY')
  release()
  assert.equal((await ongoing).ok, true)
})
test('timeout aborts pending local request and unlocks concurrency gate', async () => {
  const abortable = (_url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      reject(error)
    }, { once: true })
  })
  const output = await analyze(png(), { fetchImpl: abortable, timeoutMs: 1000 })
  assert.equal(output.code, 'MODEL_TIMEOUT')
  assert.equal((await analyze(png(), { fetchImpl: mock() })).ok, true)
})
