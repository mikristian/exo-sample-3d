import {createHash, randomBytes, timingSafeEqual} from 'node:crypto'

// Origin alone cannot authenticate a local caller: it is forgeable outside browsers.
export function createWorkspaceAuth(configuredToken = process.env.EXO_WORKSPACE_TOKEN) {
  const token = configuredToken || randomBytes(32).toString('hex')
  if (token.length < 32) throw new Error('EXO_WORKSPACE_TOKEN must contain at least 32 characters')
  const expected = Buffer.from(token)
  return {
    token,
    identity:createHash('sha256').update(expected).digest('hex'),
    authorize(value) {
      if (typeof value !== 'string' || !value.startsWith('Bearer ')) return false
      const actual = Buffer.from(value.slice(7))
      return actual.length === expected.length && timingSafeEqual(actual, expected)
    },
  }
}
