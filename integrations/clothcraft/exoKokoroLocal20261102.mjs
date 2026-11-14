import {existsSync} from 'node:fs'
import {resolve, join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {homedir} from 'node:os'

const VOICES = ['af_heart', 'af_bella', 'am_michael', 'am_adam']
const PACKAGE_DIR = process.env.EXO_KOKORO_PACKAGE_DIR || join(homedir(), 'Library/Application Support/EXO/NeuralVoice')
const CACHE_DIR = process.env.EXO_KOKORO_CACHE_DIR || join(PACKAGE_DIR, 'model-cache')
// Check readiness on each request: the local neural runtime may be installed
// after the Vite server starts, without requiring a server restart.
const isReady = () => existsSync(join(PACKAGE_DIR, 'node_modules/kokoro-js/dist/kokoro.js')) && existsSync(CACHE_DIR)
let modelPromise
let active = false

export function validateKokoroInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid request')
  const {text, voice = 'af_heart'} = input
  if (typeof text !== 'string' || !text.trim() || text.length > 400 || /[\u0000-\u001f\u007f]/.test(text)) throw Error('Invalid speech text')
  if (!VOICES.includes(voice)) throw Error('Invalid voice')
  return {text: text.trim(), voice}
}

export function pcmToWave(samples, rate = 24000) {
  if (!(samples instanceof Float32Array) || !samples.length || samples.length > 24000 * 35 || rate !== 24000) throw Error('Invalid audio')
  const buffer = Buffer.alloc(44 + samples.length * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(buffer.length - 8, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(rate, 24)
  buffer.writeUInt32LE(rate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples.length * 2, 40)
  for (let i = 0; i < samples.length; i++) buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, Number.isFinite(samples[i]) ? samples[i] : 0)) * 32767), 44 + i * 2)
  return buffer
}

async function getModel() {
  if (!isReady()) throw Error('Neural runtime not installed')
  modelPromise ??= (async () => {
    const {KokoroTTS} = await import(pathToFileURL(resolve(PACKAGE_DIR, 'node_modules/kokoro-js/dist/kokoro.js')).href)
    const {env} = await import(pathToFileURL(resolve(PACKAGE_DIR, 'node_modules/@huggingface/transformers/src/env.js')).href)
    env.cacheDir = CACHE_DIR
    env.allowRemoteModels = false
    return KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {dtype: 'q8', device: 'cpu', local_files_only: true})
  })().catch(error => {modelPromise = undefined; throw error})
  return modelPromise
}

export async function synthesizeKokoro(input) {
  const request = validateKokoroInput(input)
  if (active) throw Error('Neural synthesizer busy')
  active = true
  try {
    const model = await getModel()
    const output = await model.generate(request.text, {voice: request.voice})
    return pcmToWave(output.audio, output.sampling_rate)
  } finally {active = false}
}

export function installKokoroEndpoint(server) {
  server.middlewares.use('/api/exo-assistant/speech-neural', async (req, res, next) => {
    if (req.url === '/status' && req.method === 'GET') {
      res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'})
      res.end(JSON.stringify({available: isReady(), voices: VOICES, engine: 'Kokoro-82M-q8'}))
      return
    }
    if (req.url !== '/' || req.method !== 'POST') return next()
    res.setHeader('Cache-Control', 'no-store')
    try {
      let body = ''
      for await (const chunk of req) {body += chunk; if (body.length > 1200) throw Error('Invalid request')}
      const wave = await synthesizeKokoro(JSON.parse(body))
      res.writeHead(200, {'Content-Type': 'audio/wav', 'Content-Length': wave.length})
      res.end(wave)
    } catch(error) {
      const invalid = error instanceof SyntaxError || /^Invalid (request|speech text|voice)$/.test(error.message)
      res.writeHead(invalid ? 400 : error.message === 'Neural synthesizer busy' ? 429 : 503, {'Content-Type': 'application/json'})
      res.end(JSON.stringify({error: invalid ? 'Invalid speech request.' : 'Neural voice unavailable.'}))
    }
  })
}
