import test from 'node:test'
import assert from 'node:assert/strict'
import {synthesizeMacSpeech, validateMacSpeechRequest} from './exoMacSpeechLocal20261102.mjs'

test('only approved voices and bounded printable speech reach the macOS executable', () => {
  assert.deepEqual(validateMacSpeechRequest({text: ' EXO hello '}), {text: 'EXO hello', voice: 'Samantha'})
  for (const request of [
    {text: ''}, {text: 'x'.repeat(651)}, {text: 'a\nb'},
    {text: 'Hello', voice: 'Samantha; touch /tmp/bad'}, {text: 17}, null,
  ]) assert.throws(() => validateMacSpeechRequest(request))
})

test('macOS produces browser-playable WAV audio through fixed execFile args', {skip: process.platform !== 'darwin'}, async () => {
  const audio = await synthesizeMacSpeech({text: 'Hello, this is EXO.'})
  assert.equal(audio.subarray(0, 4).toString(), 'RIFF')
  assert.equal(audio.subarray(8, 12).toString(), 'WAVE')
  assert.ok(audio.length > 1000)
})
