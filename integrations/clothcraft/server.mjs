// Personal localhost-only EXO -> ClothCraft bridge, no network exposure.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { nativeExport, paths } from './bridge.mjs'
import { runContact } from './contact_run.mjs'
import { createWorkspace } from './workspace.mjs'
import { createAgentApi } from './agent-api.mjs'
import { createAgentKeyStore } from './agent-key-store.mjs'
import { createCollaborationApi } from './collaboration.mjs'
import { createAppleVisionHand } from './apple-vision-hand.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
// Standalone signed .apps must not write generated garments into Contents/Resources.
const outputs = path.resolve(process.env.EXO_CLOTHCRAFT_OUTPUT_DIR || path.join(root, 'integrations/clothcraft/output'))
const host = '127.0.0.1'
const port = Number(process.env.EXO_CLOTHCRAFT_PORT || 5193)
const origins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173',
  'http://127.0.0.1:5174', 'http://localhost:5174',
  'http://127.0.0.1:5188', 'http://localhost:5188',
  'http://127.0.0.1:5189', 'http://localhost:5189',
  'http://127.0.0.1:5416', 'http://localhost:5416',
  'http://127.0.0.1:5386', 'http://localhost:5386',
  'http://127.0.0.1:5284', 'http://localhost:5284',
  'http://127.0.0.1:5286', 'http://localhost:5286'])
const maxBytes = 8 * 1024 * 1024
const files = new Map([
  ['template.json', 'application/json'], ['cloth.obj', 'text/plain'],
  ['patterns.svg', 'image/svg+xml'], ['fibers.json', 'application/json'],
  ['grain-guides.obj', 'text/plain'],
])
let activeContactRun = false
const workspace = createWorkspace(outputs)
const agentApi = createAgentApi(workspace, {
  audit: entry => console.info('[agent-api]', JSON.stringify(entry)),
  allowOrigin: origin => origins.has(origin),
  // This directory lives in per-user Application Support in signed V2;
  // credentials survive app updates and are never packed into the web bundle.
  keyStorePath: path.join(outputs, 'agent-keys.json'),
})
// Collaboration uses the existing revocable, scoped local-agent credentials.
// Browser Origin alone is never an identity or permission grant.
const collaborationKeys = createAgentKeyStore(path.join(outputs, 'agent-keys.json'))
const collaborationApi = createCollaborationApi({
  directory: path.join(outputs, 'collaboration'),
  allowOrigin: origin => origins.has(origin),
  authenticate: async token => {
    const identity = collaborationKeys.authenticate(token)
    return identity?.scopes?.includes('read') ? {userId: identity.id, scopes:identity.scopes} : null
  },
})
const appleVisionHand=createAppleVisionHand()
process.on("exit", () => {appleVisionHand.close();workspace.close()})
process.on("SIGTERM", () => { appleVisionHand.close(); collaborationApi.close(); workspace.close(); server.close(); process.exit(0) })

function send(res, code, payload, origin = '') {
  const content = JSON.stringify(payload)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    ...(origins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) })
  res.end(content)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', chunk => {
      size += chunk.length
      if (size > maxBytes) { reject(new Error('Project exceeds 8 MB')); req.destroy(); return }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
      catch { reject(new Error('Invalid project JSON')) }
    })
    req.on('error', reject)
  })
}

function runClothCraft(config, command, template, output) {
  if (!config.upstream) throw new Error('ClothCraft source checkout unavailable')
  const bin = config.rustTemplate
  const useBinary = bin && fs.existsSync(bin)
  const argv = [command, template, ...(command === 'bake' ? ['--output', output] : [])]
  const exe = useBinary ? bin : config.cargo
  const args = useBinary ? argv : ['run', '--locked', '--no-default-features', '-j', '2', '--bin', 'cloth-template', '--', ...argv]
  const result = spawnSync(exe, args, { cwd: config.upstream, env: config.rustEnv,
    encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 })
  if (result.error || result.status !== 0) throw new Error(`ClothCraft ${command} failed: ${result.error?.message || result.stderr || 'exit ' + result.status}`)
  if (command === 'validate') {
    try { return JSON.parse(result.stdout) }
    catch { throw new Error('ClothCraft validate returned non-JSON output') }
  }
  return { message: result.stdout.trim(), artifacts: [...files.keys()].filter(name =>
    name !== 'template.json' && fs.existsSync(path.join(output, name))) }
}

const server = http.createServer(async (req, res) => {
  const origin = String(req.headers.origin || '')
  if (origin && !origins.has(origin)) return send(res, 403, { error: 'Origin not allowed' })
  if (req.method === 'OPTIONS') {
    if (!origins.has(origin)) return send(res, 403, { error: 'Origin not allowed' })
    // Agent clients may use the RFC 6750 bearer credential or the legacy
    // ClothCraft header. Other native routes keep their existing header list.
    const agentRequest=req.url?.split('?')[0]?.startsWith('/agent/v1/')
    const collabRequest=req.url?.split('?')[0]?.startsWith('/collab/v1/')
    const authorizedHeaders=collabRequest ? 'Content-Type, Authorization' : agentRequest
      ? 'Content-Type, Authorization, X-ClothCraft-Token'
      : 'Content-Type'
    res.writeHead(204, { 'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': collabRequest ? 'GET,POST,PUT,DELETE,OPTIONS' : agentRequest ? 'GET,POST,DELETE,OPTIONS' : 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': authorizedHeaders,
      'Access-Control-Max-Age': '600', 'Vary': 'Origin' })
    return res.end()
  }
  if (await agentApi.handle(req, res)) return
  if (await collaborationApi.handle(req, res)) return
  if (req.method==='GET'&&req.url==='/vision/hand/status')return send(res,200,{ok:true,...appleVisionHand.status()},origin)
  if (req.method==='POST'&&req.url==='/vision/hand'){
    try{
      if(!appleVisionHand.status().available)return send(res,503,{ok:false,error:'Apple Vision hand detector is unavailable'},origin)
      const body=await readBody(req)
      const frame=await appleVisionHand.detect(body?.image)
      return send(res,200,{ok:true,...frame},origin)
    }catch(error){return send(res,422,{ok:false,error:error.message},origin)}
  }
  if (req.method === 'POST' && req.url === '/workspace') {
    try { const result = await workspace.request(await readBody(req)); return send(res, result.ok ? 200 : 422, result, origin) }
    catch (error) { return send(res, 422, {ok:false,error:error.message}, origin) }
  }
  if (req.method === 'GET' && req.url === '/health') {
    const config = paths()
    return send(res, 200, { ok: true, backend: 'clothcraft-exo-local',
      nativeReady: fs.existsSync(config.cli), rustCheckoutReady: Boolean(config.upstream),
      ogcBackend: Boolean(config.rustFit && fs.existsSync(config.rustFit)),
      nativeSession:workspace.status(),
      contactBusy: activeContactRun, fitCertified: false }, origin)
  }
  if (req.method === 'GET' && req.url?.startsWith('/runs/')) {
    const match = /^\/runs\/([0-9a-f-]{36})\/(cloth|avatar)\.obj$/.exec(req.url)
    if (!match) return send(res, 404, { error: 'Unrecognized OGC artifact' }, origin)
    const filename = match[2] === 'cloth'
      ? path.join(outputs, 'runs', match[1], 'solution', 'cloth.obj')
      : path.join(outputs, 'runs', match[1], 'avatar.obj')
    if (!fs.existsSync(filename)) return send(res, 404, { error: 'Missing solver artifact' }, origin)
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(origins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}) })
    return fs.createReadStream(filename).pipe(res)
  }
  if (req.method === 'GET' && req.url?.startsWith('/artifacts/')) {
    const filename = decodeURIComponent(req.url.slice('/artifacts/'.length))
    if (!files.has(filename) || !fs.existsSync(path.join(outputs, 'bake', filename))) {
      return send(res, 404, { error: 'No such generated artifact' }, origin)
    }
    res.writeHead(200, { 'Content-Type': files.get(filename), 'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `attachment; filename="${filename}"`,
      ...(origins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}) })
    return fs.createReadStream(path.join(outputs, 'bake', filename)).pipe(res)
  }
  if (req.method !== 'POST' || !['/export', '/validate', '/bake', '/contact-simulate'].includes(req.url)) {
    return send(res, 404, { error: 'Unknown integration operation' }, origin)
  }
  if (req.url === '/contact-simulate' && activeContactRun) {
    return send(res, 409, { error: 'A ClothCraft OGC simulation is already running; wait for it to finish' }, origin)
  }
  try {
    const data = await readBody(req)
    if (!data?.document || typeof data.document !== 'object' || Array.isArray(data.document)) {
      return send(res, 400, { error: 'Expected a garment document object' }, origin)
    }
    if (req.url === '/contact-simulate') {
      activeContactRun = true
      try {
        const result = await runContact(data, outputs)
        return send(res, result.ok ? 200 : 422, result, origin)
      } finally { activeContactRun = false }
    }
    const config = paths()
    const converted = nativeExport(data.document, config.cli)
    fs.mkdirSync(outputs, { recursive: true })
    const templateFile = path.join(outputs, 'template.json')
    fs.writeFileSync(templateFile, JSON.stringify(converted.template, null, 2) + '\n')
    let rust = null
    let baking = null
    if (req.url === '/validate' || req.url === '/bake') rust = runClothCraft(config, 'validate', templateFile)
    if (req.url === '/bake') {
      const bakeOut = path.join(outputs, 'bake')
      fs.mkdirSync(bakeOut, { recursive: true })
      baking = runClothCraft(config, 'bake', templateFile, bakeOut)
    }
    send(res, 200, { ok: true, template: converted.template, warnings: converted.warnings,
      rustValidation: rust, baking, rustValidated: Boolean(rust), fitAccepted: false,
      mode: 'pattern-interchange-not-approved-fit' }, origin)
  } catch (error) {
    send(res, 422, { ok: false, fitAccepted: false, error: String(error.message || error) }, origin)
  }
})

server.listen(port, host, () => console.log(`EXO ClothCraft personal bridge listening at http://${host}:${port}`))
