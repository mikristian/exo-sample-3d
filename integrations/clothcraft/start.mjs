// Start both isolated EXO dev UI and the personal Rust bridge with one command.
import { spawn } from 'node:child_process'
import {randomBytes} from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const children = []
let stopping = false
// The Vite dev editor has no AppKit WKUserScript. Give the paired loopback Vite
// process and Node bridge an ephemeral shared credential instead of making
// the production /workspace API unauthenticated again. Never log this value.
const developmentToken=randomBytes(32).toString('hex')
const bridgeEnvironment={...process.env,EXO_WORKSPACE_TOKEN:developmentToken}
const viteEnvironment={...bridgeEnvironment,VITE_CLOTHCRAFT_WORKSPACE_TOKEN:developmentToken}
const commands = [
  ['bridge', process.execPath, ['integrations/clothcraft/server.mjs'],bridgeEnvironment],
  ['EXO UI', process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'],viteEnvironment],
]

const stop = () => {
  if (stopping) return
  stopping = true
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM')
}
for (const [name, binary, args, environment] of commands) {
  const child = spawn(binary, args, { cwd: root, stdio: 'inherit', env:environment })
  children.push(child)
  child.on('error', error => {
    console.error(`${name} failed: ${error.message}`)
    process.exitCode = 1
    stop()
  })
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`${name} stopped: ${signal || `exit ${code}`}`)
      process.exitCode = code || 1
      stop()
    }
  })
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
console.log('EXO × ClothCraft personal app: http://127.0.0.1:5174/?desktop=1')
