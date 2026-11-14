// Browser voice controller: no React dependency and no credentials in the client.
const EXCLUDED = /Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Jester|Junior|Organ|Trinoids|Whisper|Wobble|Zarvox|Superstar|Good News/i
export const cleanCompanionSpeech = value => String(value ?? '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().slice(0, 600)
export function listCompanionVoices(synthesis) {
  return (synthesis?.getVoices?.() ?? []).filter(v => /^en(?:-|_)/i.test(v.lang || '') && !EXCLUDED.test(v.name || ''))
}
export function selectCompanionVoice(voices, choice = 'auto') {
  if (choice !== 'auto' && choice !== 'azure') return voices.find(v => v.voiceURI === choice) ?? null
  const scored = [...voices].sort((a, b) => voiceScore(b) - voiceScore(a))
  return scored[0] ?? null
}
function voiceScore(v) {
  const n = v.name || ''
  return (/Microsoft.*(?:Aria|Jenny|Guy|Christopher|Andrew|Ava|Ryan|Sonia)/i.test(n) ? 100 : 0)
    + (/Natural|Neural|Premium/i.test(n) ? 70 : 0)
    + (/Microsoft/i.test(n) ? 30 : 0)
    + (/Samantha|Daniel|Alex|Eddy|Reed|Flo|Google.*English/i.test(n) ? 25 : 0)
    + (v.localService ? 10 : 0)
}
export function createCompanionVoice({
  environment = globalThis, fetcher = environment.fetch?.bind(environment),
  synthesis = environment.speechSynthesis, AudioCtor = environment.Audio,
  UtteranceCtor = environment.SpeechSynthesisUtterance, urls = environment.URL,
  onState = () => {}, onError = () => {},
  speechEndpoint = '/api/exo-assistant/speech',
} = {}) {
  let active = 0, audio = null, objectUrl = null, utterance = null, controller = null, recognition = null
  let completion = null
  const finishSpeech = (reason, provider) => {
    if (!completion || completion.done) return
    completion.done = true
    const outcome = { ok: reason === 'ended', reason, ...(provider ? { provider } : {}) }
    completion.outcome = outcome
    completion.resolve(outcome)
  }
  const beginSpeech = () => {
    const session = { done: false, outcome: null, promise: null, resolve: null }
    session.promise = new Promise(resolve => { session.resolve = resolve })
    completion = session
    return session
  }
  function waitForSpeechEnd({ timeoutMs = 90000, session = completion } = {}) {
    if (!session) return Promise.resolve({ ok: false, reason: 'idle' })
    if (session.done) return Promise.resolve(session.outcome)
    const ms = Number.isFinite(timeoutMs) ? Math.max(1, timeoutMs) : 90000
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        if (completion === session && !session.done) {
          finishSpeech('timeout')
          cancelSpeech('timeout')
        }
        resolve(session.outcome || { ok: false, reason: 'timeout' })
      }, ms)
      session.promise.then(result => { clearTimeout(timer); resolve(result) })
    })
  }
  const state = (name, info = {}) => onState({ state: name, ...info })
  // Invoke synchronously inside a click handler before any network request.
  // This also releases a paused synthesis engine on browsers which suspend it.
  function activateSpeechGesture() {
    try { if (synthesis?.paused) synthesis.resume?.() } catch {}
    return Boolean(synthesis?.speak || AudioCtor)
  }
  function browserSpeech(text, token, choice) {
    if (!synthesis?.speak || !UtteranceCtor) {
      finishSpeech('unsupported'); state('idle'); onError('Speech playback is unavailable in this browser. Check your browser audio settings.')
      return { ok: false, reason: 'unsupported' }
    }
    try {
      utterance = new UtteranceCtor(text)
      const voice = selectCompanionVoice(listCompanionVoices(synthesis), choice)
      if (voice) utterance.voice = voice
      utterance.lang = voice?.lang || 'en-US'
      utterance.rate = 0.99
      utterance.pitch = 1
      utterance.onstart = () => { if (token === active) state('speaking', { provider: 'browser' }) }
      utterance.onend = () => { if (token === active) { finishSpeech('ended', 'browser'); cancelSpeech() } }
      utterance.onerror = event => { if (token === active) { onError('Browser speech: ' + (event?.error || 'playback failed')); finishSpeech('error', 'browser'); cancelSpeech() } }
      synthesis.speak(utterance)
      // Browser synthesis can be suspended without emitting onstart.
      if (synthesis.paused) synthesis.resume?.()
      return { ok: true, provider: 'browser' }
    } catch (error) {
      if (token === active) { onError(error?.message || 'Browser speech failed'); finishSpeech('error', 'browser'); cancelSpeech() }
      return { ok: false, reason: 'error' }
    }
  }
  function cancelSpeech(reason = 'cancelled') {
    finishSpeech(reason)
    active++
    controller?.abort(); controller = null
    synthesis?.cancel?.()
    if (audio) { audio.onended = null; audio.onerror = null; audio.pause?.(); audio = null }
    if (objectUrl) { urls?.revokeObjectURL?.(objectUrl); objectUrl = null }
    if (utterance) { utterance.onstart = utterance.onend = utterance.onerror = null; utterance = null }
    state('idle')
  }
  async function speak(input, { choice = 'auto', azureAvailable = false, neuralAvailable = false, localAvailable = false } = {}) {
    cancelSpeech()
    beginSpeech()
    activateSpeechGesture()
    const text = cleanCompanionSpeech(input)
    if (!text) { finishSpeech('empty'); return { ok: false, reason: 'empty' } }
    const token = active
    if (azureAvailable && (choice === 'auto' || choice === 'azure') && fetcher && AudioCtor && urls?.createObjectURL) {
      controller = new AbortController()
      try {
        state('loading')
        const result = await fetcher(speechEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: controller.signal })
        if (!result.ok) throw new Error('Neural speech request failed')
        const blob = await result.blob()
        if (token !== active) return { ok: false, reason: 'cancelled' }
        if (blob.type && !/^audio\//i.test(blob.type)) throw new Error('Neural speech returned a non-audio response')
        objectUrl = urls.createObjectURL(blob)
        audio = new AudioCtor(objectUrl)
        audio.onended = () => { if (token === active) { finishSpeech('ended', 'azure'); cancelSpeech() } }
        audio.onerror = () => { if (token === active) { onError('Neural audio playback failed; switching to browser speech.'); audio?.pause?.(); audio = null; if (objectUrl) urls?.revokeObjectURL?.(objectUrl); objectUrl = null; browserSpeech(text, token, choice) } }
        await audio.play()
        if (token !== active) return { ok: false, reason: 'cancelled' }
        state('speaking', { provider: 'azure' })
        return { ok: true, provider: 'azure' }
      } catch (error) {
        if (token !== active) return { ok: false, reason: 'cancelled' }
        if (objectUrl) urls.revokeObjectURL?.(objectUrl)
        objectUrl = null; audio = null
        onError('Neural voice unavailable; switching to the browser voice.')
      } finally { controller = null }
    }
    if (neuralAvailable && text.length <= 400 && (choice === 'auto' || choice.startsWith('neural:')) && fetcher && AudioCtor && urls?.createObjectURL) {
      controller = new AbortController()
      try {
        state('loading')
        const voice = choice.startsWith('neural:') ? choice.slice(7) : 'af_heart'
        const result = await fetcher('/api/exo-assistant/speech-neural', {
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({text,voice}),signal:controller.signal,
        })
        if (!result.ok) throw new Error('Neural voice is unavailable')
        const blob = await result.blob()
        if (token !== active) return {ok:false,reason:'cancelled'}
        if (blob.type && !/^audio\//i.test(blob.type)) throw new Error('Neural voice returned non-audio data')
        objectUrl = urls.createObjectURL(blob)
        audio = new AudioCtor(objectUrl)
        audio.onended = () => {if(token===active){finishSpeech('ended','local-neural');cancelSpeech()}}
        audio.onerror = () => {if(token===active){onError('Neural voice playback failed; switching to browser speech.');audio?.pause?.();audio=null;if(objectUrl)urls?.revokeObjectURL?.(objectUrl);objectUrl=null;browserSpeech(text,token,choice)}}
        await audio.play()
        if (token !== active) return {ok:false,reason:'cancelled'}
        state('speaking',{provider:'local-neural'})
        return {ok:true,provider:'local-neural'}
      } catch(error) {
        if(token!==active)return{ok:false,reason:'cancelled'}
        if(objectUrl)urls?.revokeObjectURL?.(objectUrl)
        objectUrl=null;audio=null
        onError('Local neural speech unavailable; trying a system voice.')
      } finally {controller=null}
    }
    if (localAvailable && (choice === 'auto' || choice.startsWith('mac:')) && fetcher && AudioCtor && urls?.createObjectURL) {
      const voice = choice.startsWith('mac:') ? choice.slice(4) : 'Flo (English (US))'
      controller = new AbortController()
      try {
        state('loading')
        const result = await fetcher('/api/exo-assistant/speech-local', {
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({text,voice}),signal:controller.signal,
        })
        if (!result.ok) throw new Error('Local macOS speech request failed')
        const blob = await result.blob()
        if (token !== active) return {ok:false,reason:'cancelled'}
        if (blob.type && !/^audio\//i.test(blob.type)) throw new Error('Local voice returned a non-audio response')
        objectUrl = urls.createObjectURL(blob)
        audio = new AudioCtor(objectUrl)
        audio.onended = () => {if (token === active) {finishSpeech('ended','macos');cancelSpeech()}}
        audio.onerror = () => {if (token === active){onError('macOS voice playback failed; switching to browser speech.');audio?.pause?.();audio=null;if(objectUrl)urls?.revokeObjectURL?.(objectUrl);objectUrl=null;browserSpeech(text,token,choice)}}
        await audio.play()
        if (token !== active) return {ok:false,reason:'cancelled'}
        state('speaking',{provider:'macos'})
        return {ok:true,provider:'macos'}
      } catch(error) {
        if (token !== active) return {ok:false,reason:'cancelled'}
        if (objectUrl) urls?.revokeObjectURL?.(objectUrl)
        objectUrl=null;audio=null
        onError('Local studio voice unavailable; using a browser voice.')
      } finally {controller=null}
    }
    return browserSpeech(text, token, choice)
  }
  async function speakAndWait(input, options = {}) {
    const started = speak(input, options)
    const session = completion
    const result = await started
    if (!result.ok) return result
    return waitForSpeechEnd({ session, timeoutMs: options.timeoutMs })
  }
  function stopRecognition() {
    const old = recognition
    recognition = null
    if (old) { old.onresult = old.onerror = old.onend = old.onstart = null; try { old.abort?.() } catch {} }
    state('idle')
  }
  function startRecognition({ lang = 'en-US', onInterim = () => {}, onFinal = () => {} } = {}) {
    stopRecognition()
    cancelSpeech()
    const Ctor = environment.SpeechRecognition || environment.webkitSpeechRecognition
    if (!Ctor) { onError('Speech recognition is unavailable in this browser'); return { ok: false, reason: 'unsupported' } }
    try {
      const session = new Ctor()
      recognition = session
      session.lang = lang; session.continuous = false; session.interimResults = true; session.maxAlternatives = 1
      let committed = '', failed = false
      session.onstart = () => { if (recognition === session) state('listening') }
      session.onresult = event => {
        if (recognition !== session) return
        // Rebuild the full result list: browsers may repeat earlier finals on later events.
        let finalText = '', interimText = ''
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i]
          const phrase = item?.[0]?.transcript || ''
          if (item?.isFinal) finalText += phrase + ' '
          else interimText += phrase + ' '
        }
        committed = finalText.replace(/\s+/g, ' ').trim()
        onInterim([committed, interimText.replace(/\s+/g, ' ').trim()].filter(Boolean).join(' '))
      }
      session.onerror = event => {
        if (recognition !== session) return
        failed = true
        onError('Microphone: ' + (event?.error || 'recognition error'))
        state('idle')
      }
      session.onend = () => {
        if (recognition !== session) return
        recognition = null
        state('idle')
        onInterim('')
        if (!failed && committed) onFinal(committed)
      }
      session.start()
      return { ok: true, stop: stopRecognition }
    } catch (error) {
      recognition = null
      onError(error?.message || 'Unable to start microphone recognition')
      return { ok: false, reason: 'error' }
    }
  }
  function cancel() { stopRecognition(); cancelSpeech() }
  return { speak, speakAndWait, waitForSpeechEnd, activateSpeechGesture, cancelSpeech, startRecognition, stopRecognition, cancel, listVoices: () => listCompanionVoices(synthesis) }
}
