import test from 'node:test'
import assert from 'node:assert/strict'
import {pcmToWave, synthesizeKokoro, validateKokoroInput} from './exoKokoroLocal20261102.mjs'

test('neural endpoint validates voice, text, and input size', () => {
  assert.deepEqual(validateKokoroInput({text: ' Hello '}), {text: 'Hello', voice: 'af_heart'})
  for (const input of [{text: ''}, {text: 'a'.repeat(401)}, {text: 'Hi\n'}, {text: 'Hello',voice: '../../etc'}, null]) assert.throws(() => validateKokoroInput(input))
})

test('PCM output has valid 24kHz mono WAV header', () => {
  const result = pcmToWave(new Float32Array([0, 1, -1]))
  assert.equal(result.toString('ascii', 0, 4), 'RIFF')
  assert.equal(result.toString('ascii', 8, 12), 'WAVE')
  assert.equal(result.readUInt32LE(24), 24000)
  assert.equal(result.readUInt32LE(40), 6)
})

test('cached quantized Kokoro generates actual local neural speech', async () => {
  const bytes = await synthesizeKokoro({text: 'EXO neural voice test.'})
  assert.ok(bytes.length > 1000)
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF')
})
