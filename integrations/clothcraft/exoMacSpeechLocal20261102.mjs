import {execFile} from 'node:child_process'
import {mkdtemp, readFile, rm, stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

const VOICES = Object.freeze(['Samantha', 'Flo (English (US))', 'Reed (English (US))', 'Eddy (English (US))'])
const MAX_AUDIO_BYTES = 6_000_000

export function validateMacSpeechRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid speech request')
  const {text, voice = 'Samantha'} = input
  if (typeof text !== 'string' || !text.trim() || text.length > 650 || /[\u0000-\u001f\u007f]/.test(text)) throw new Error('Speech input must contain 1–650 printable characters')
  if (!VOICES.includes(voice)) throw new Error('Unsupported speech voice')
  return {text: text.trim(), voice}
}

export async function synthesizeMacSpeech(input, {run = execFile} = {}) {
  if (process.platform !== 'darwin') throw new Error('macOS speech is unavailable')
  const {text, voice} = validateMacSpeechRequest(input)
  const dir = await mkdtemp(join(tmpdir(), 'exo-local-speech-'))
  const output = join(dir, 'speech.aiff')
  const browserAudio = join(dir, 'speech.wav')
  try {
    await new Promise((resolve, reject) => {
      run('/usr/bin/say', ['-v', voice, '-o', output, '--', text], {timeout: 12000, maxBuffer: 16_384, windowsHide: true}, (error) => error ? reject(error) : resolve())
    })
    // Chrome, Edge and Safari all support PCM WAV. AIFF is not reliably
    // supported by HTMLAudioElement, even though macOS can play it locally.
    await new Promise((resolve, reject) => {
      run('/usr/bin/afconvert', ['-f','WAVE','-d','LEI16@22050',output,browserAudio],
        {timeout: 10000, maxBuffer: 16_384, windowsHide: true}, (error) => error ? reject(error) : resolve())
    })
    const details = await stat(browserAudio)
    if (!details.size || details.size > MAX_AUDIO_BYTES) throw new Error('Invalid speech audio size')
    return await readFile(browserAudio)
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
}

export function installMacSpeechEndpoint(server) {
  server.middlewares.use('/api/exo-assistant/speech-local', async (req, res, next) => {
    if (req.url === '/status' && req.method === 'GET') {
      res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'})
      res.end(JSON.stringify({available: process.platform === 'darwin', voices: VOICES}))
      return
    }
    if (req.url !== '/' || req.method !== 'POST') return next()
    res.setHeader('Cache-Control', 'no-store')
    try {
      let raw = ''
      for await (const chunk of req) {
        raw += chunk
        if (raw.length > 1800) throw new Error('Request too large')
      }
      const audio = await synthesizeMacSpeech(JSON.parse(raw))
      res.writeHead(200, {'Content-Type': 'audio/wav', 'Content-Length': audio.length})
      res.end(audio)
    } catch (error) {
      const invalid = error instanceof SyntaxError || /Invalid speech request|Speech input|Unsupported speech voice|Request too large/.test(error.message)
      res.writeHead(invalid ? 400 : 503, {'Content-Type': 'application/json'})
      res.end(JSON.stringify({error: invalid ? 'Invalid local speech request.' : 'Local macOS speech is unavailable.'}))
    }
  })
}
