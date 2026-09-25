export const DEFAULT_NATIVE_SERVICE_URL = 'http://127.0.0.1:5194'

export async function getNativeServiceHealth(baseUrl = DEFAULT_NATIVE_SERVICE_URL, options = {}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
    method: 'GET',
    cache: 'no-store',
    signal: options.signal,
  })
  if (!response.ok) throw new Error(`Native solver service returned HTTP ${response.status}`)
  return response.json()
}

export async function solveWithNativeService(project, options = {}) {
  const baseUrl = (options.baseUrl || DEFAULT_NATIVE_SERVICE_URL).replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project,
      frames: options.frames ?? 60,
      clothModel: options.clothModel || 'distance',
      bendingModel: options.bendingModel || 'distance',
    }),
    signal: options.signal,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || `Native solver service returned HTTP ${response.status}`)
  return payload
}

export async function stepNativePayload(payload, options = {}) {
  const baseUrl = (options.baseUrl || DEFAULT_NATIVE_SERVICE_URL).replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload,
      frames: options.frames ?? 8,
    }),
    signal: options.signal,
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.ok) throw new Error(body?.error || `Native solver service returned HTTP ${response.status}`)
  return body
}
