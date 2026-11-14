import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanCompanionSpeech, listCompanionVoices, selectCompanionVoice, createCompanionVoice } from './exoCompanionVoice20261102.js'

test('cleans text and chooses an English natural voice', () => {
  assert.equal(cleanCompanionSpeech('  **Hello**   EXO '), 'Hello EXO')
  const voices = [{ name: 'French', lang: 'fr-FR' }, { name: 'Alex', lang: 'en-US', voiceURI: 'alex' }, { name: 'Microsoft Jenny Natural', lang: 'en-US', voiceURI: 'jenny' }, { name: 'Boing', lang: 'en-US' }]
  assert.deepEqual(listCompanionVoices({ getVoices: () => voices }).map(v => v.name), ['Alex', 'Microsoft Jenny Natural'])
  assert.equal(selectCompanionVoice(voices.slice(1, 3)).voiceURI, 'jenny')
  assert.equal(selectCompanionVoice(voices, 'alex').voiceURI, 'alex')
})

test('recognition delivers the final transcript once even with repeated result events', () => {
  let session, final = [], interim = []
  class Recognition {
    constructor() { session = this }
    start() { this.onstart?.() }
    abort() {}
  }
  const controller = createCompanionVoice({ environment: { SpeechRecognition: Recognition }, onError: message => { throw Error(message) } })
  assert.equal(controller.startRecognition({ onFinal: text => final.push(text), onInterim: text => interim.push(text) }).ok, true)
  const results = [{ isFinal: true, 0: { transcript: 'make a' } }, { isFinal: true, 0: { transcript: ' T-shirt' } }]
  session.onresult({ results, resultIndex: 1 })
  session.onresult({ results, resultIndex: 0 })
  session.onend()
  assert.deepEqual(final, ['make a T-shirt'])
  assert.equal(interim.at(-1), '')
})

test('cancel prevents stale neural playback and revokes no nonexistent URL', async () => {
  let respond, created = 0
  const fetched = new Promise(resolve => { respond = resolve })
  const controller = createCompanionVoice({
    environment: {}, fetcher: () => fetched,
    AudioCtor: class { play() { return Promise.resolve() } },
    urls: { createObjectURL: () => { created++; return 'blob:voice' }, revokeObjectURL() {} },
  })
  const task = controller.speak('hello', { azureAvailable: true })
  controller.cancel()
  respond({ ok: true, blob: async () => ({ type: 'audio/mpeg' }) })
  assert.deepEqual(await task, { ok: false, reason: 'cancelled' })
  assert.equal(created, 0)
})

test('neural network failure falls back to browser speech', async () => {
  let spoken, warnings = []
  class Utterance { constructor(text) { this.text = text } }
  const controller = createCompanionVoice({
    environment: {}, fetcher: async () => { throw Error('network') },
    AudioCtor: class {}, urls: { createObjectURL() {} },
    synthesis: { getVoices: () => [], speak: utterance => { spoken = utterance }, cancel() {} },
    UtteranceCtor: Utterance, onError: warning => warnings.push(warning),
  })
  assert.equal((await controller.speak('Hi', { azureAvailable: true })).provider, 'browser')
  assert.equal(spoken.text, 'Hi')
  assert.equal(warnings.length, 1)
  controller.cancel()
})
test('local macOS voice requests selected voice and plays audio, then cleans up', async () => {
  let request, played=false, revoked=[],audio
  class FakeAudio {
    constructor(url){this.url=url;audio=this}
    play(){played=true;return Promise.resolve()}
    pause(){}
  }
  const voice=createCompanionVoice({
    environment:{},
    fetcher:async(url,options)=>{request={url,body:JSON.parse(options.body)};return {ok:true,blob:async()=>({type:'audio/wav'})}},
    AudioCtor:FakeAudio,
    urls:{createObjectURL:()=>'blob:test',revokeObjectURL:url=>revoked.push(url)},
  })
  assert.equal((await voice.speak('Hello EXO',{choice:'mac:Reed (English (US))',localAvailable:true})).provider,'macos')
  assert.equal(request.url,'/api/exo-assistant/speech-local')
  assert.equal(request.body.voice,'Reed (English (US))')
  assert.equal(played,true)
  audio.onended()
  assert.deepEqual(revoked,['blob:test'])
})
test('local neural synthesis is preferred over the system fallback for short speech',async()=>{
  let request,played=false
  const voice=createCompanionVoice({
    environment:{},
    fetcher:async(url,options)=>{request={url,body:JSON.parse(options.body)};return{ok:true,blob:async()=>({type:'audio/wav'})}},
    AudioCtor:class{play(){played=true;return Promise.resolve()} pause(){}},
    urls:{createObjectURL:()=> 'blob:neural',revokeObjectURL(){}},
  })
  const result=await voice.speak('Hello, welcome to EXO.',{neuralAvailable:true,localAvailable:true,choice:'neural:af_bella'})
  assert.equal(result.provider,'local-neural')
  assert.equal(request.url,'/api/exo-assistant/speech-neural')
  assert.equal(request.body.voice,'af_bella')
  assert.equal(played,true)
  voice.cancel()
})
test('audio playback error recovers using browser speech and releases blob', async () => {
  let remote, browser, revoked = []
  class Utterance { constructor(text) { this.text = text } }
  class Audio { constructor() { remote = this } play() { return Promise.resolve() } pause() {} }
  const voice = createCompanionVoice({ environment: {}, fetcher: async () => ({ ok: true, blob: async () => ({ type: 'audio/wav' }) }),
    AudioCtor: Audio, urls: { createObjectURL: () => 'blob:remote', revokeObjectURL: url => revoked.push(url) },
    synthesis: { speak: utterance => { browser = utterance }, getVoices: () => [], cancel() {} }, UtteranceCtor: Utterance })
  assert.equal((await voice.speak('Tour narration', { azureAvailable: true })).provider, 'azure')
  remote.onerror()
  assert.equal(browser.text, 'Tour narration')
  assert.deepEqual(revoked, ['blob:remote'])
  voice.cancel()
})

test('speakAndWait waits for browser end rather than start', async () => {
  let spoken, finished = false
  class Utterance { constructor(text) { this.text = text } }
  const voice = createCompanionVoice({ environment: {}, synthesis: { speak: item => { spoken = item; item.onstart?.() }, cancel() {}, getVoices: () => [] }, UtteranceCtor: Utterance })
  const pending = voice.speakAndWait('Tour step', { timeoutMs: 500 })
  pending.then(() => { finished = true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(finished, false)
  spoken.onend()
  assert.deepEqual(await pending, { ok: true, reason: 'ended', provider: 'browser' })
})

test('waitForSpeechEnd resolves on neural playback end and on cancellation', async () => {
  let sound
  const voice = createCompanionVoice({ environment: {}, fetcher: async () => ({ ok: true, blob: async () => ({ type: 'audio/wav' }) }), AudioCtor: class { constructor() { sound = this } play() { return Promise.resolve() } pause() {} }, urls: { createObjectURL: () => 'blob:voice', revokeObjectURL() {} } })
  await voice.speak('one', { neuralAvailable: true })
  const ended = voice.waitForSpeechEnd({ timeoutMs: 500 })
  sound.onended()
  assert.deepEqual(await ended, { ok: true, reason: 'ended', provider: 'local-neural' })
  await voice.speak('two', { localAvailable: true })
  const cancelled = voice.waitForSpeechEnd({ timeoutMs: 500 })
  voice.cancelSpeech()
  assert.deepEqual(await cancelled, { ok: false, reason: 'cancelled' })
})

test('speech timeout terminates hung playback and permits next speech', async () => {
  let spoken
  class Utterance { constructor(text) { this.text = text } }
  const voice = createCompanionVoice({ environment: {}, synthesis: { speak: item => { spoken = item }, cancel() {}, getVoices: () => [] }, UtteranceCtor: Utterance })
  const result = await voice.speakAndWait('hanging', { timeoutMs: 15 })
  assert.deepEqual(result, { ok: false, reason: 'timeout' })
  const next = voice.speakAndWait('next', { timeoutMs: 500 })
  spoken.onend()
  assert.equal((await next).ok, true)
})

test('replacing an active speech resolves its waiter without settling its successor', async () => {
  let spoken
  class Utterance { constructor(text) { this.text = text } }
  const voice = createCompanionVoice({ environment: {}, synthesis: { speak: item => { spoken = item }, cancel() {}, getVoices: () => [] }, UtteranceCtor: Utterance })
  const first = voice.speakAndWait('first')
  const obsolete = spoken
  const second = voice.speakAndWait('second')
  assert.deepEqual(await first, { ok: false, reason: 'cancelled' })
  obsolete.onend?.()
  spoken.onend()
  assert.equal((await second).ok, true)
})
