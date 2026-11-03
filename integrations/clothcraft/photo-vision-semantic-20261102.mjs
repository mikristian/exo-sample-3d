// Optional on-demand local Ollama vision inference. Visual descriptions only.
// This module performs no geometry mutation, remote requests, or pattern certification.
const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat'
const MODEL = 'qwen3-vl-instruct:2b'
const MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])
const FAMILIES = ['hoodie', 'zip-hoodie', 'sweatshirt', 't-shirt', 'shirt', 'jacket', 'dress',
  'skirt', 'pants', 'jeans', 'shorts', 'other', 'unknown']
const SILHOUETTES = ['oversized', 'relaxed', 'regular', 'slim', 'cropped', 'boxy', 'fitted', 'unknown']
const COLORS = ['black', 'white', 'gray', 'brown', 'beige', 'cream', 'red', 'orange',
  'yellow', 'green', 'blue', 'purple', 'pink', 'multicolor', 'unknown']
const CLOSURES = ['zipper', 'buttons', 'snaps', 'drawstring', 'none-visible', 'unknown']
const UNCERTAINTIES = ['occlusion', 'pose', 'perspective', 'lighting', 'complex-background',
  'multiple-garments', 'back-not-visible', 'construction-hidden', 'low-resolution']

export const EXO_GARMENT_PHOTO_VISION_SCHEMA_20261102 = {
  type: 'object',
  additionalProperties: false,
  required: ['family', 'silhouette', 'approximateColor', 'visibleClosure', 'uncertainties', 'confidence'],
  properties: {
    family: { type: 'string', enum: FAMILIES },
    silhouette: { type: 'string', enum: SILHOUETTES },
    approximateColor: { type: 'string', enum: COLORS },
    visibleClosure: { type: 'string', enum: CLOSURES },
    uncertainties: { type: 'array', items: { type: 'string', enum: UNCERTAINTIES }, maxItems: 9 },
    confidence: { type: 'string', enum: ['uncalibrated'] },
  },
}

const COMMON = { kind: 'photo-vision-semantic', provider: 'local-ollama', model: MODEL,
  measurementCalibrationVerified: false, physicalCalibrationVerified: false,
  manufacturingApproved: false, needsHumanReview: true, executed: false }
const failure = (code, reason) => ({ ...COMMON, ok: false, code, reason })

/** Accept only exact base64, with a bounded payload and a matching image MIME type.
 * The caller is trusted to obtain photo bytes from the user but model output is untrusted.
 */
export function validateExoGarmentPhotoVisionInput20261102(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).some(key => !['imageBase64', 'mimeType'].includes(key)) ||
      !MIME.has(data.mimeType) || typeof data.imageBase64 !== 'string')
    return null
  const value = data.imageBase64
  // Decode at most 2MB. Base64 is encoded text, no data URLs or whitespace.
  if (value.length < 64 || value.length > 2_800_000 ||
      value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    return null
  const bytes = Buffer.from(value, 'base64')
  if (bytes.length < 32 || bytes.length > 2_000_000 || bytes.toString('base64') !== value)
    return null
  const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  if (!(data.mimeType === 'image/png' && png ||
        data.mimeType === 'image/jpeg' && jpeg ||
        data.mimeType === 'image/webp' && webp)) return null
  // PNG dimensional verification, rejecting huge decompression targets.
  if (png) {
    if (bytes.length < 24 || bytes.toString('ascii', 12, 16) !== 'IHDR') return null
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20)
    if (!width || !height || width > 8192 || height > 8192 || width * height > 4_000_000) return null
  }
  return { imageBase64: value, mimeType: data.mimeType, decodedBytes: bytes.length }
}

function validateSemantic(raw) {
  if (typeof raw !== 'string' || raw.length > 5000) return null
  let candidate
  try { candidate = JSON.parse(raw) } catch { return null }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
  const keys = Object.keys(EXO_GARMENT_PHOTO_VISION_SCHEMA_20261102.properties)
  if (Object.keys(candidate).length !== keys.length || keys.some(key => !Object.hasOwn(candidate, key))) return null
  if (!FAMILIES.includes(candidate.family) || !SILHOUETTES.includes(candidate.silhouette) ||
      !COLORS.includes(candidate.approximateColor) || !CLOSURES.includes(candidate.visibleClosure) ||
      candidate.confidence !== 'uncalibrated' || !Array.isArray(candidate.uncertainties) ||
      candidate.uncertainties.length > UNCERTAINTIES.length ||
      candidate.uncertainties.some(value => !UNCERTAINTIES.includes(value))) return null
  // Local model sometimes repeats an allowed uncertainty verbatim. Repetition
  // contributes no new claim, so canonicalize it without accepting new values.
  return { ...candidate, uncertainties: [...new Set(candidate.uncertainties)] }
}

let active = false
/** Make one bounded local vision call. Concurrent calls fail fast rather than queueing large images. */
export async function analyzeExoGarmentPhotoVision20261102(data, { fetchImpl = globalThis.fetch, timeoutMs = 20000 } = {}) {
  const input = validateExoGarmentPhotoVisionInput20261102(data)
  if (!input) return failure('INVALID_IMAGE', 'Provide a valid PNG, JPEG, or WebP photograph (maximum 2 MB encoded source bytes).')
  if (active) return failure('MODEL_BUSY', 'Another local photo analysis is already running.')
  if (typeof fetchImpl !== 'function') return failure('MODEL_UNAVAILABLE', 'Local Ollama transport is unavailable.')
  active = true
  const controller = new AbortController()
  const duration = Math.min(30000, Math.max(1000, Number.isFinite(timeoutMs) ? timeoutMs : 20000))
  const timeout = setTimeout(() => controller.abort(), duration)
  try {
    const instruction = [
      'Analyze only the garment visibly shown in this user-provided photograph.',
      'The background may be complex and the garment may be worn by a person. Use only direct visual evidence.',
      'If multiple garments are visible or identification is uncertain, use unknown and include multiple-garments or occlusion.',
      'Describe one primary garment family and visible silhouette and approximate color from the specified enums.',
      'Visible closure is visual only; if hidden or ambiguous choose unknown.',
      'Never infer measurements, physical dimensions, units, seam topology, grading, fabric composition, fit validation or manufacturing approval.',
      'Do not include numerical dimensions, descriptions, explanations, additional properties, prose, markdown or code fences.',
      'Set confidence exactly to uncalibrated. Return JSON only conforming to the provided schema.',
    ].join(' ')
    const response = await fetchImpl(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL, stream: false, format: EXO_GARMENT_PHOTO_VISION_SCHEMA_20261102,
        options: { temperature: 0, num_predict: 175 },
        messages: [{ role: 'system', content: instruction },
          { role: 'user', content: 'Identify only visible, uncertain garment traits in this photo.', images: [input.imageBase64] }],
      }),
      signal: controller.signal,
    })
    if (!response?.ok)
      return failure(response?.status === 404 ? 'MODEL_NOT_INSTALLED' : 'MODEL_UNAVAILABLE',
        'The local Ollama vision model did not return a successful response.')
    if (Number(response.headers?.get?.('content-length')) > 15000)
      return failure('INVALID_MODEL_OUTPUT', 'Local model returned an oversized response.')
    const packetText = await response.text()
    if (packetText.length > 15000) return failure('INVALID_MODEL_OUTPUT', 'Local model returned an oversized response.')
    let packet
    try { packet = JSON.parse(packetText) } catch { return failure('INVALID_MODEL_OUTPUT', 'Local model returned invalid JSON.') }
    // Ollama protocol: success must be complete, and the assistant content must satisfy the rigid schema.
    if (packet?.done !== true || packet?.message?.role !== 'assistant')
      return failure('INCOMPLETE_MODEL_OUTPUT', 'Local model reply was incomplete or missing its assistant message.')
    const semantic = validateSemantic(packet.message.content)
    if (!semantic) return failure('INVALID_MODEL_OUTPUT', 'Local model returned fields outside the verified visual-evidence schema.')
    return { ...COMMON, ok: true, semantic, family: semantic.family, silhouette: semantic.silhouette,
      approximateColor: semantic.approximateColor, visibleClosure: semantic.visibleClosure,
      uncertainties: semantic.uncertainties, confidence: 'uncalibrated',
      evidence: { source: 'local-vision-inference', imageMimeType: input.mimeType, imageBytes: input.decodedBytes,
        modelPredictionsVerified: false },
      warning: 'The model inferred visual appearance only. It cannot verify physical cut lines, dimensions, or garment construction.' }
  } catch (error) {
    return failure(controller.signal.aborted || error?.name === 'AbortError' ? 'MODEL_TIMEOUT' : 'MODEL_UNAVAILABLE',
      'Local Ollama vision inference failed or timed out.')
  } finally {
    clearTimeout(timeout)
    active = false
  }
}
