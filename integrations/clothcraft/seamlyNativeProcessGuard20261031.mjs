// Synchronous, cooperative cross-process serialization for the native Seamly CLI.
// Every Seamly entry point must use this wrapper around its spawnSync call.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'

const pause = new Int32Array(new SharedArrayBuffer(4))
const ownerName = 'owner.json'
const sleep = ms => Atomics.wait(pause, 0, 0, ms)
const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 24)

export function defaultSeamlyNativeLockPath20261031() {
  // One lock per user installation, independent of per-call export folders.
  return path.join(os.tmpdir(), `exo-seamly-native-${hash(os.homedir())}.lock`)
}

function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true }
  catch (e) { return e?.code === 'EPERM' }
}

function statIdentity(p) {
  const st = fs.lstatSync(p)
  if (!st.isDirectory() || st.isSymbolicLink()) throw new Error('Invalid Seamly lock directory')
  return { dev: st.dev, ino: st.ino, mtimeMs: st.mtimeMs }
}

function recoverAbandoned(lockPath, graceMs) {
  let identity
  try { identity = statIdentity(lockPath) }
  catch (e) { if (e?.code === 'ENOENT') return; throw e }
  let owner
  try { owner = JSON.parse(fs.readFileSync(path.join(lockPath, ownerName), 'utf8')) }
  catch (e) { if (e?.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e }
  // Never steal an active owner, even if its calculation exceeds its timeout.
  if (owner && alive(owner.pid)) return
  const age = Date.now() - identity.mtimeMs
  if (age < graceMs) return
  let check
  try { check = statIdentity(lockPath) }
  catch (e) { if (e?.code === 'ENOENT') return; throw e }
  if (check.dev !== identity.dev || check.ino !== identity.ino || check.mtimeMs !== identity.mtimeMs) return
  // Only remove the known metadata file and empty directory. Never recursively
  // delete arbitrary lock contents or paths provided by another process.
  try {
    if (owner) {
      const current = fs.readFileSync(path.join(lockPath, ownerName), 'utf8')
      if (current !== JSON.stringify(owner)) return
      fs.unlinkSync(path.join(lockPath, ownerName))
    }
    fs.rmdirSync(lockPath)
  } catch (e) {
    if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(e?.code)) throw e
  }
}

/**
 * Executes `operation` while holding the machine-local, per-user Seamly lock.
 * Intended usage: withSeamlyNativeProcessGuard20261031(() => spawnSync(binary,args,opts)).
 * This API is synchronous because the existing engine uses spawnSync.
 */
export function withSeamlyNativeProcessGuard20261031(operation, {
  lockPath = defaultSeamlyNativeLockPath20261031(),
  acquireTimeoutMs = 90000,
  pollMs = 40,
  staleGraceMs = 2000,
} = {}) {
  if (typeof operation !== 'function') throw new TypeError('operation must be a function')
  if (typeof lockPath !== 'string' || !path.isAbsolute(lockPath)) throw new TypeError('lockPath must be absolute')
  if (![acquireTimeoutMs, pollMs, staleGraceMs].every(n => Number.isSafeInteger(n) && n >= 0) || pollMs < 1)
    throw new RangeError('Invalid Seamly lock timing')
  const token = randomUUID()
  const metadata = JSON.stringify({ pid: process.pid, token, createdAt: Date.now() })
  const deadline = Date.now() + acquireTimeoutMs
  let locked = false
  while (!locked) {
    try {
      fs.mkdirSync(lockPath, { mode: 0o700 })
      locked = true
      fs.writeFileSync(path.join(lockPath, ownerName), metadata, { flag: 'wx', mode: 0o600 })
    } catch (e) {
      if (locked) {
        try { fs.rmdirSync(lockPath) } catch {}
        throw e
      }
      if (e?.code !== 'EEXIST') throw e
      recoverAbandoned(lockPath, staleGraceMs)
      if (Date.now() >= deadline) throw Object.assign(new Error('Timed out waiting for Seamly native process lock'), { code: 'SEAMLY_NATIVE_LOCK_TIMEOUT' })
      sleep(Math.min(pollMs, Math.max(1, deadline - Date.now())))
    }
  }
  try { return operation() }
  finally {
    try {
      const current = fs.readFileSync(path.join(lockPath, ownerName), 'utf8')
      if (current === metadata) {
        fs.unlinkSync(path.join(lockPath, ownerName))
        fs.rmdirSync(lockPath)
      }
    } catch (e) { if (e?.code !== 'ENOENT') throw e }
  }
}
