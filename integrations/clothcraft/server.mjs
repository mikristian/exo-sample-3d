// Personal localhost-only EXO -> ClothCraft bridge, no network exposure.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { nativeExport, paths } from './bridge.mjs'
import { runContact } from './contact_run.mjs'
import { createWorkspace } from './workspace.mjs'
import { createWorkspaceAuth } from './workspace-auth.mjs'
import {EXO_WORKSPACE_BRIDGE_PROTOCOL,EXO_WORKSPACE_BRIDGE_CAPABILITIES} from './workspaceBridgeProtocol20261030.mjs'
import { createAgentApi } from './agent-api.mjs'
import { createAgentKeyStore } from './agent-key-store.mjs'
import { createCollaborationApi } from './collaboration.mjs'
import { createAppleVisionHand } from './apple-vision-hand.mjs'
import {suggestExoAssistantLocal20261102} from './exoAppAssistantLocal20261102.mjs'
import { readPatternIntelligenceCatalog } from './pattern-intelligence-catalog.mjs'
import { readGarmentCodeDataV2Catalog } from './garmentcodedata-v2-catalog.mjs'
import { searchExoArchivePatterns } from '../../src/core/exoArchivePatternRetrieval20261102.js'
import { readArchiveSourceGeometry } from './source-geometry-bridge-20261102.mjs'
import {runResearchContourDecoder20261102} from './research-contour-bridge-20261102.mjs'
import {suggestResearchSewing20261102} from './research-seam-bridge-20261102.mjs'
import {analyzeExoGarmentPhotoVision20261102} from './photo-vision-semantic-20261102.mjs'
import { evaluateSeamly2DRequest20261023 } from './seamly2dEngineRoute20261023.mjs'
import {evaluateValentina2DRequest20261031} from './valentinaEngineRoute20261031.mjs'
import {evaluateValentinaConnected2DRequest20261031} from './valentinaConnectedCalculation20261031.mjs'
import {evaluateValentinaSemanticRequest20261031} from './valentinaSemanticEngineRoute20261031.mjs'
import { gridcraftStatus, evaluateGridcraftFormula } from './gridcraftBridge.mjs'
import {gridcraftWorkbookStatus,evaluateGridcraftWorkbook} from './gridcraftWorkbookBridge20261030.mjs'
import {verifyRuntimeProvenance} from './runtime-provenance.mjs'
import {inspectNativeVerifiedProductionSourceRun37,createNativeVerifiedProductionOrderRun37} from './native-verified-production-order-run37.mjs'
import {buildNativeVerifiedCutroomIntakeRun44,inspectNativeVerifiedCutroomIntakeRun44} from './native-verified-cutroom-intake-run44.mjs'
import {buildNativeVerifiedSinglePlyRollPlanRun44,inspectNativeVerifiedSinglePlyRollPlanRun44} from './native-verified-single-ply-roll-plan-run44.mjs'
import {publishNativeVerifiedMarkerArtifactsRun42,readNativeVerifiedMarkerArtifactRun42} from './native-verified-marker-artifacts-run42.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
// The installed resource tree is immutable for the lifetime of this server.
// Fingerprint once per process instead of hashing JS/WASM on every health poll.
let runtimeProvenanceSnapshot
const runtimeProvenance = () => runtimeProvenanceSnapshot ??= verifyRuntimeProvenance(root)
// Standalone signed .apps must not write generated garments into Contents/Resources.
const outputs = path.resolve(process.env.EXO_CLOTHCRAFT_OUTPUT_DIR || path.join(root, 'integrations/clothcraft/output'))
const host = '127.0.0.1'
const port = Number(process.env.EXO_CLOTHCRAFT_PORT || 5193)
// Reject rebinding/proxy aliases before any route sees the request. Binding
// loopback alone does not establish which hostname a browser resolved.
const acceptedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`])
const origins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173',
  'http://127.0.0.1:5174', 'http://localhost:5174',
  'http://127.0.0.1:5188', 'http://localhost:5188',
  'http://127.0.0.1:5189', 'http://localhost:5189',
  'http://127.0.0.1:5416', 'http://localhost:5416',
  'http://127.0.0.1:5386', 'http://localhost:5386',
  'http://127.0.0.1:5486', 'http://localhost:5486',
  'http://127.0.0.1:5284', 'http://localhost:5284',
  'http://127.0.0.1:5286', 'http://localhost:5286'])
const maxBytes = 8 * 1024 * 1024
const files = new Map([
  ['template.json', 'application/json'], ['cloth.obj', 'text/plain'],
  ['patterns.svg', 'image/svg+xml'], ['fibers.json', 'application/json'],
  ['grain-guides.obj', 'text/plain'],
])
let activeContactRun = false
// Multi-step native SOURCE→CUT→order calls must not interleave with another
// native production request, including while its HTTP body is being read.
// Workspace mutations through /workspace still require independent revision
// and dependency revalidation inside each verified workflow.
let nativeVerifiedRequestBusy = false
let workspaceHttpInflight = 0
let agentHttpInflight = 0
const workspace = createWorkspace(outputs)
const workspaceAuth = createWorkspaceAuth()
// Build/maintenance scripts running as the signed-in owner can retrieve the
// current process credential from its private output directory. Never bundle it.
fs.mkdirSync(outputs, {recursive:true})
fs.writeFileSync(path.join(outputs, 'workspace-auth-token'), workspaceAuth.token + '\n', {mode:0o600})
fs.chmodSync(path.join(outputs, 'workspace-auth-token'), 0o600)
const agentApi = createAgentApi(workspace, {
  audit: entry => console.info('[agent-api]', JSON.stringify(entry)),
  allowOrigin: origin => origins.has(origin),
  authorizeUi: authorization => workspaceAuth.authorize(authorization),
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
process.on("exit", () => {agentApi.close();appleVisionHand.close();workspace.close()})
process.on("SIGTERM", () => { agentApi.close(); appleVisionHand.close(); collaborationApi.close(); workspace.close(); server.close(); process.exit(0) })

function send(res, code, payload, origin = '') {
  const content = JSON.stringify(payload)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    ...(origins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) })
  res.end(content)
}

// Optional private local Rust validator/serializer. Its output is only accepted
// when byte-identical to Node, so route contracts survive missing binaries.
function rustHealthPayload(snapshot) {
  const original = JSON.stringify(snapshot)
  if (process.env.EXO_HEALTH_RUST !== '1') return original
  const binary = process.env.EXO_HEALTH_RUST_BINARY || path.join(root, 'rust/exo_health_kernel/target/release/exo-health-kernel')
  if (!fs.existsSync(binary)) return original
  const result = spawnSync(binary, [], {input:original,encoding:'utf8',timeout:250,maxBuffer:65536})
  return !result.error && result.status===0 && result.stdout===original ? result.stdout : original
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let completed = false
    const settle = (error, value) => {
      if (completed) return
      completed = true
      req.setTimeout(0)
      if (error) reject(error)
      else resolve(value)
    }
    // A disconnected or stalled loopback client must not retain the native
    // production mutex forever before its request body reaches 'end'.
    req.setTimeout(30000, () => {
      settle(new Error('Request body timed out'))
      req.destroy()
    })
    req.on('aborted', () => settle(new Error('Request body aborted')))
    req.on('data', chunk => {
      size += chunk.length
      if (size > maxBytes) {
        settle(new Error('Project exceeds 8 MB'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try { settle(null,JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
      catch { settle(new Error('Invalid project JSON')) }
    })
    req.on('error', error => settle(error))
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
  if (!acceptedHosts.has(req.headers.host))
    return send(res, 403, {ok:false,code:'HOST_FORBIDDEN'})
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
      : 'Content-Type, Authorization'
    res.writeHead(204, { 'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': collabRequest ? 'GET,POST,PUT,DELETE,OPTIONS' : agentRequest ? 'GET,POST,DELETE,OPTIONS' : 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': authorizedHeaders,
      'Access-Control-Max-Age': '600', 'Vary': 'Origin' })
    return res.end()
  }
  // Authenticated agent edit/undo/assembly calls use the SAME native workspace.
  // They cannot bypass the source/CUT/roll read lease while native production
  // evidence is being reconstructed. Reverse exclusion covers agent requests
  // already in flight before a native production operation begins.
  if(req.url?.split('?')[0]?.startsWith('/agent/v1/')){
    if(nativeVerifiedRequestBusy)
      return send(res,409,{ok:false,code:'NATIVE_PRODUCTION_INSPECTION_BUSY',
        factoryApproved:false,cuttingAuthorized:false},origin)
    agentHttpInflight++
    try {if(await agentApi.handle(req,res))return}
    finally{agentHttpInflight--}
  }
  if (await collaborationApi.handle(req, res)) return
  // Agent/collaboration routes above retain their separately scoped auth.
  // All remaining state-changing native endpoints share the shell session.
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && !workspaceAuth.authorize(req.headers.authorization)) {
    // Diagnostics contain request metadata only. Never log session credentials.
    console.warn('[workspace-auth-denied]',JSON.stringify({method:req.method,path:req.url?.split('?')[0],
      origin,hasAuthorization:typeof req.headers.authorization==='string',
      bearer:typeof req.headers.authorization==='string'&&req.headers.authorization.startsWith('Bearer ')}))
    return send(res,401,{ok:false,code:'WORKSPACE_AUTH_REQUIRED',error:'Workspace authorization required'},origin)
  }
  if(req.url==='/assistant/v1/local/suggest'){
    if(req.method!=='POST')return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
    if(!origin||!origins.has(origin))return send(res,403,{ok:false,code:'TRUSTED_UI_REQUIRED'},origin)
    try{
      const result=await suggestExoAssistantLocal20261102(await readBody(req))
      return send(res,result.ok?200:result.code==='INVALID_REQUEST'?400:result.code==='MODEL_NOT_INSTALLED'?404:result.code==='MODEL_TIMEOUT'?504:503,result,origin)
    }catch{return send(res,400,{ok:false,code:'INVALID_REQUEST'},origin)}
  }
  // On-demand semantic PHOTO reference analysis runs exclusively on the
  // already-installed local Ollama vision model. It returns reviewable visible
  // attributes, NEVER hidden cut-panel geometry or a native garment mutation.
  if(req.url==='/pattern-intelligence/v1/photo-vision'){
    if(req.method!=='POST')return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
    if(!origin||!origins.has(origin))return send(res,403,{ok:false,code:'TRUSTED_UI_REQUIRED'},origin)
    try{
      const packet=await readBody(req)
      const result=await analyzeExoGarmentPhotoVision20261102(packet)
      return send(res,result.ok?200:result.code==='MODEL_BUSY'?429:
        result.code==='MODEL_TIMEOUT'?504:result.code==='INVALID_IMAGE'?422:503,result,origin)
    }catch{return send(res,422,{ok:false,code:'INVALID_PHOTO_VISION_REQUEST',
      manufacturingApproved:false,measurementCalibrationVerified:false},origin)}
  }
  if (req.url?.split('?')[0]?.startsWith('/techpack/gridcraft/v2/workbook/')) {
    if (!origin || !origins.has(origin))return send(res,403,{ok:false,code:'TRUSTED_UI_REQUIRED'},origin)
    if (req.url==='/techpack/gridcraft/v2/workbook/status')
      return req.method==='GET'?send(res,200,gridcraftWorkbookStatus(),origin):
        send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
    if (req.url==='/techpack/gridcraft/v2/workbook/evaluate') {
      if(req.method!=='POST')return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
      try{
        const input=await readBody(req)
        const result=await evaluateGridcraftWorkbook(input)
        return send(res,result.ok?200:result.code==='GRIDCRAFT_WORKBOOK_UNAVAILABLE'?503:
          result.code==='GRIDCRAFT_WORKBOOK_BUSY'?429:
          result.code==='GRIDCRAFT_WORKBOOK_TIMEOUT'?504:502,result,origin)
      }catch(error){
        return send(res,422,{ok:false,code:'INVALID_GRIDCRAFT_WORKBOOK',reason:String(error?.message||'Invalid workbook')},origin)
      }
    }
    return send(res,404,{ok:false,code:'UNKNOWN_GRIDCRAFT_ROUTE'},origin)
  }
  if (req.url?.split('?')[0]?.startsWith('/techpack/gridcraft/v1/')) {
    if (!origin || !origins.has(origin)) return send(res,403,{ok:false,code:'TRUSTED_UI_REQUIRED'},origin)
    if (req.url==='/techpack/gridcraft/v1/status')return req.method==='GET'?send(res,200,gridcraftStatus(),origin):send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
    if (req.url==='/techpack/gridcraft/v1/evaluate') {
      if (req.method!=='POST')return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
      try {
        const body=await readBody(req)
        if(!body || Object.keys(body).length!==1 || typeof body.formula!=='string')return send(res,422,{ok:false,code:'INVALID_REQUEST'},origin)
        const result=await evaluateGridcraftFormula(body.formula)
        return send(res,result.ok?200:result.code==='CLI_UNAVAILABLE'?503:422,result,origin)
      }catch(error){return send(res,422,{ok:false,code:String(error.message||'INVALID_REQUEST')},origin)}
    }
    return send(res,404,{ok:false,code:'UNKNOWN_GRIDCRAFT_ROUTE'},origin)
  }
  if (req.url?.split('?')[0] === '/seamly/v1/evaluate') {
    if (req.method !== 'POST') return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
    if (!origin || !origins.has(origin)) return send(res,403,{ok:false,code:'TRUSTED_UI_REQUIRED'},origin)
    try {
      const result=evaluateSeamly2DRequest20261023(await readBody(req))
      return send(res,result.ok?200:422,result,origin)
    } catch (error) { return send(res,422,{ok:false,code:'INVALID_REQUEST',reason:String(error.message||error),manufacturingApproved:false},origin) }
  }
  if (req.url?.split('?')[0] === '/valentina/v1/evaluate') {
    if (req.method !== 'POST') return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
    if (!origin || !origins.has(origin)) return send(res,403,{ok:false,code:'TRUSTED_UI_REQUIRED'},origin)
    try {
      const result=evaluateValentina2DRequest20261031(await readBody(req))
      return send(res,result.ok?200:422,result,origin)
    } catch (error) { return send(res,422,{ok:false,code:'INVALID_REQUEST',reason:String(error?.message||error),manufacturingApproved:false},origin) }
  }
  if (req.url?.split('?')[0] === '/valentina/v1/connected-evaluate') {
    if (req.method !== 'POST') return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
    if (!origin || !origins.has(origin)) return send(res,403,{ok:false,code:'TRUSTED_UI_REQUIRED'},origin)
    try {
      const result=evaluateValentinaConnected2DRequest20261031(await readBody(req))
      return send(res,result.ok?200:422,result,origin)
    } catch (error) { return send(res,422,{ok:false,code:'INVALID_CONNECTED_CONSTRUCTION',reason:String(error?.message||error),manufacturingApproved:false},origin) }
  }
  if (req.url?.split('?')[0] === '/valentina/v1/semantic-evaluate') {
    if (req.method !== 'POST') return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
    if (!origin || !origins.has(origin)) return send(res,403,{ok:false,code:'TRUSTED_UI_REQUIRED'},origin)
    try {
      const result=evaluateValentinaSemanticRequest20261031(await readBody(req))
      return send(res,result.ok?200:422,result,origin)
    } catch(error) {
      return send(res,422,{ok:false,code:'INVALID_VALENTINA_SEMANTIC_SOURCE',
        reason:String(error?.message||error),manufacturingApproved:false},origin)
    }
  }
  if (req.url?.split('?')[0] === '/pattern-intelligence/v1/catalog') {
    if (req.method !== 'GET') return send(res, 405, {ok:false,code:'METHOD_NOT_ALLOWED'}, origin)
    // A source catalog can eventually include confidential garment names.
    // Require the known local UI Origin; never serve raw DXF bytes over HTTP.
    if (!origin || !origins.has(origin)) return send(res, 403, {ok:false,code:'TRUSTED_UI_REQUIRED'}, origin)
    try { const result = readPatternIntelligenceCatalog(root)
      return send(res, result.ok ? 200 : 503, result, origin)
    } catch { return send(res, 503, {ok:false,code:'CATALOG_READ_FAILED'}, origin) }
  }
  if (req.url?.split('?')[0] === '/pattern-intelligence/v1/garmentcodedata-v2') {
    if (req.method !== 'GET') return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
    if (!origin || !origins.has(origin)) return send(res,403,{ok:false,code:'TRUSTED_UI_REQUIRED'},origin)
    try {
      const query = new URL(req.url, 'http://127.0.0.1').searchParams
      const result = readGarmentCodeDataV2Catalog(root, Object.fromEntries(query))
      return send(res,result.ok ? 200 : 503,result,origin)
    } catch { return send(res,503,{ok:false,code:'GARMENTCODE_V2_CATALOG_READ_FAILED'},origin) }
  }
  if (req.url?.split('?')[0] === '/pattern-intelligence/v1/archive-search') {
    if (req.method !== 'GET') return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
    if (!origin || !origins.has(origin)) return send(res,403,{ok:false,code:'TRUSTED_UI_REQUIRED'},origin)
    try {
      const params = new URL(req.url, 'http://127.0.0.1').searchParams
      const allowed = new Set(['query','sourceId','body','minPanels','maxPanels','limit','offset'])
      if ([...params.keys()].some(key => !allowed.has(key) || params.getAll(key).length !== 1))
        return send(res,400,{ok:false,code:'INVALID_ARCHIVE_SEARCH_PARAMETERS',results:[]},origin)
      const filters = Object.fromEntries(params)
      for (const key of ['minPanels','maxPanels','limit','offset']) {
        if (key in filters && !/^\d{1,7}$/.test(filters[key]))
          return send(res,400,{ok:false,code:'INVALID_ARCHIVE_SEARCH_PARAMETERS',results:[]},origin)
      }
      const result = await searchExoArchivePatterns(filters)
      return send(res,result.ok?200:result.error==='archive_index_unavailable'?503:400,result,origin)
    } catch {
      return send(res,503,{ok:false,code:'ARCHIVE_SEARCH_FAILED',results:[]},origin)
    }
  }
  if (req.url?.split('?')[0] === '/pattern-intelligence/v1/source-geometry') {
    if(req.method!=='GET')return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
    if(!origin||!origins.has(origin))return send(res,403,{ok:false,code:'TRUSTED_UI_REQUIRED'},origin)
    try {
      const params=new URL(req.url,'http://127.0.0.1').searchParams
      if([...params.keys()].some(key=>key!=='sourceId'||params.getAll(key).length!==1)||!params.has('sourceId'))
        return send(res,400,{ok:false,error:'invalid_source_id'},origin)
      const result=await readArchiveSourceGeometry(params.get('sourceId'))
      return send(res,result.ok?200:result.error==='source_specification_not_local'||result.error==='archive_index_unavailable'?503:422,result,origin)
    }catch{return send(res,503,{ok:false,error:'source_geometry_unavailable'},origin)}
  }
  if(req.url?.split('?')[0]==='/pattern-intelligence/v1/research-contour'){
    if(req.method!=='POST')return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
    if(!origin||!origins.has(origin))return send(res,403,{ok:false,code:'TRUSTED_UI_REQUIRED'},origin)
    try{
      const body=await readBody(req)
      const result=await runResearchContourDecoder20261102(body)
      const status=result.ok?200:result.code==='RESEARCH_INFERENCE_BUSY'?429:
        ['RESEARCH_MODEL_NOT_AVAILABLE','INVALID_RESEARCH_MODEL_EVIDENCE','RESEARCH_MODEL_PROCESS_FAILED'].includes(result.code)?503:
        result.code==='RESEARCH_MODEL_TIMEOUT'?504:422
      return send(res,status,result,origin)
    }catch{return send(res,422,{ok:false,code:'INVALID_RESEARCH_CONTOUR_REQUEST',manufacturingApproved:false},origin)}
  }
  if(req.url?.split('?')[0]==='/pattern-intelligence/v1/research-seam'){
    if(req.method!=='GET')return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
    if(!origin||!origins.has(origin))return send(res,403,{ok:false,code:'TRUSTED_UI_REQUIRED'},origin)
    try{
      const params=new URL(req.url,'http://127.0.0.1').searchParams
      if([...params.keys()].some(key=>!['sourceId','limit'].includes(key)||params.getAll(key).length!==1)||
         !params.has('sourceId')||(params.has('limit')&&!/^\d{1,2}$/.test(params.get('limit'))))
        return send(res,400,{ok:false,code:'INVALID_SEAM_RESEARCH_QUERY',manufacturingApproved:false},origin)
      const result=await suggestResearchSewing20261102({sourceId:params.get('sourceId'),limit:Number(params.get('limit')||8)})
      return send(res,result.ok?200:result.code==='SEAM_RESEARCH_BUSY'?429:
        result.code==='SEAM_RESEARCH_TIMEOUT'?504:422,result,origin)
    }catch{return send(res,503,{ok:false,code:'SEAM_RESEARCH_UNAVAILABLE',manufacturingApproved:false},origin)}
  }
  if (req.url?.split('?')[0] === '/pattern-intelligence/v1/geometry-neighbors') {
    if (req.method !== 'GET') return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
    if (!origin || !origins.has(origin)) return send(res,403,{ok:false,code:'TRUSTED_UI_REQUIRED'},origin)
    try {
      const params = new URL(req.url,'http://127.0.0.1').searchParams
      if ([...params.keys()].some(key=>!['sourceId','limit'].includes(key)||params.getAll(key).length!==1) ||
          !params.has('sourceId') || (params.has('limit')&&!/^\d{1,2}$/.test(params.get('limit'))))
        return send(res,400,{ok:false,code:'INVALID_GEOMETRY_NEIGHBOR_PARAMETERS',results:[]},origin)
      const result=await searchExoArchivePatterns({...Object.fromEntries(params),mode:'nearest'})
      return send(res,result.ok?200:['geometry_embeddings_unavailable','numpy_unavailable','archive_index_unavailable'].includes(result.error)?503:400,result,origin)
    } catch {
      return send(res,503,{ok:false,code:'GEOMETRY_NEIGHBOR_SEARCH_FAILED',results:[]},origin)
    }
  }
  if (req.method==='GET'&&req.url==='/vision/hand/status')return send(res,200,{ok:true,...appleVisionHand.status()},origin)
  if (req.url?.split('?')[0]?.startsWith('/production/native-verified/v1/')) {
    if (!origin||!origins.has(origin))return send(res,403,{ok:false,code:'TRUSTED_UI_REQUIRED'},origin)
    const artifactPath=/^\/production\/native-verified\/v1\/artifacts\/([a-f0-9]{64})\/([A-Za-z0-9_.-]+)$/.exec(req.url||'')
    if(artifactPath){
      if(req.method!=='GET')return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
      try{
        const {bytes,contentType}=readNativeVerifiedMarkerArtifactRun42(outputs,artifactPath[1],artifactPath[2])
        res.writeHead(200,{'Content-Type':contentType,'Content-Length':bytes.length,
          'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
          'Content-Disposition':`attachment; filename="${artifactPath[2]}"`,
          'Access-Control-Allow-Origin':origin,'Vary':'Origin'})
        return res.end(bytes)
      }catch{return send(res,404,{ok:false,code:'VERIFIED_MARKER_ARTIFACT_UNAVAILABLE'},origin)}
    }
    if(req.method!=='POST')return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin)
    if(nativeVerifiedRequestBusy || workspaceHttpInflight>0 ||
      agentHttpInflight>0 ||
      workspace.status().busy||workspace.status().running)
      return send(res,409,{ok:false,code:'NATIVE_WORKSPACE_BUSY',factoryApproved:false},origin)
    nativeVerifiedRequestBusy = true
    try {
      const packet=await readBody(req)
      if(workspace.status().busy||workspace.status().running)
        return send(res,409,{ok:false,code:'NATIVE_WORKSPACE_BUSY',factoryApproved:false,
          cuttingAuthorized:false},origin)
      if(req.url==='/production/native-verified/v1/source'){
        if(!packet||Object.keys(packet).length!==0)return send(res,422,{ok:false,code:'INVALID_SOURCE_INSPECTION_REQUEST'},origin)
        const source=await inspectNativeVerifiedProductionSourceRun37(workspace)
        return send(res,200,{ok:true,source},origin)
      }
      if(req.url==='/production/native-verified/v1/order'){
        const result=await createNativeVerifiedProductionOrderRun37(workspace,packet)
        return send(res,200,{ok:true,result},origin)
      }
      if(req.url==='/production/native-verified/v1/cut-intake'){
        if(!packet||Object.keys(packet).sort().join(',')!==
          'expectedRevision,materialsByPanel,quantitiesBySize')
          return send(res,422,{ok:false,code:'INVALID_NATIVE_CUT_INTAKE_PACKET',
            cuttingAuthorized:false,factoryApproved:false},origin)
        const result=await buildNativeVerifiedCutroomIntakeRun44(workspace,packet)
        return send(res,200,{ok:true,result},origin)
      }
      if(req.url==='/production/native-verified/v1/cut-intake-inspect'){
        if(!packet||Object.keys(packet).sort().join(',')!=='order,packet')
          return send(res,422,{ok:false,code:'INVALID_NATIVE_CUT_INTAKE_INSPECTION_PACKET',
            cuttingAuthorized:false,factoryApproved:false},origin)
        const result=await inspectNativeVerifiedCutroomIntakeRun44(
          workspace,packet.order,packet.packet)
        return send(res,200,{ok:true,result},origin)
      }
      if(req.url==='/production/native-verified/v1/roll-study'){
        if(!packet||Object.keys(packet).sort().join(',')!=='order,planning')
          return send(res,422,{ok:false,code:'INVALID_NATIVE_ROLL_STUDY_PACKET',
            cuttingAuthorized:false,factoryApproved:false},origin)
        const result=await buildNativeVerifiedSinglePlyRollPlanRun44(workspace,packet.order,packet.planning)
        return send(res,result.ok?200:422,{ok:result.ok,result,
          ...(!result.ok?{code:result.issues?.[0]?.detail||'NATIVE_ROLL_STUDY_BLOCKED'}:{})},origin)
      }
      if(req.url==='/production/native-verified/v1/roll-study-inspect'){
        if(!packet||Object.keys(packet).sort().join(',')!=='order,packet,planning')
          return send(res,422,{ok:false,code:'INVALID_NATIVE_ROLL_STUDY_INSPECTION_PACKET',
            cuttingAuthorized:false,factoryApproved:false},origin)
        const result=await inspectNativeVerifiedSinglePlyRollPlanRun44(
          workspace,packet.order,packet.planning,packet.packet)
        return send(res,result.ok?200:422,{ok:result.ok,result,
          ...(!result.ok?{code:result.issues?.[0]?.detail||'NATIVE_ROLL_STUDY_BLOCKED'}:{})},origin)
      }
      if(req.url==='/production/native-verified/v1/export'){
        const result=await publishNativeVerifiedMarkerArtifactsRun42(workspace,packet,outputs)
        return send(res,200,{ok:true,result},origin)
      }
      return send(res,404,{ok:false,code:'UNKNOWN_NATIVE_PRODUCTION_ROUTE'},origin)
    }catch(error){
      return send(res,422,{ok:false,code:String(error?.message||'NATIVE_PRODUCTION_BLOCKED').slice(0,160),
        factoryApproved:false,cuttingAuthorized:false},origin)
    }finally{
      nativeVerifiedRequestBusy = false
    }
  }
  if (req.method==='POST'&&req.url==='/vision/hand'){
    try{
      if(!appleVisionHand.status().available)return send(res,503,{ok:false,error:'Apple Vision hand detector is unavailable'},origin)
      const body=await readBody(req)
      const frame=await appleVisionHand.detect(body?.image)
      return send(res,200,{ok:true,...frame},origin)
    }catch(error){return send(res,422,{ok:false,error:error.message},origin)}
  }
  if (req.method === 'POST' && req.url === '/workspace') {
    if (!workspaceAuth.authorize(req.headers.authorization))
      return send(res, 401, {ok:false,code:'WORKSPACE_AUTH_REQUIRED',error:'Workspace authorization required'}, origin)
    // An editor command received while CUT/source/roll QA is traversing
    // several native RPCs must not land between two verification reads. Nor
    // may a half-uploaded /workspace body become a write after QA begins.
    if(nativeVerifiedRequestBusy)
      return send(res,409,{ok:false,error:'NATIVE_PRODUCTION_INSPECTION_BUSY',
        cuttingAuthorized:false,factoryApproved:false},origin)
    workspaceHttpInflight++
    try {
      const packet=await readBody(req)
      const result=await workspace.request(packet)
      return send(res,result.ok?200:422,result,origin)
    }catch(error){
      return send(res,422,{ok:false,error:error.message},origin)
    }finally{
      workspaceHttpInflight--
    }
  }
  if (req.method === 'GET' && req.url === '/health') {
    const config = paths()
    const snapshot = { ok: true, backend: 'clothcraft-exo-local',
      workspaceBridgeProtocol:EXO_WORKSPACE_BRIDGE_PROTOCOL,
      workspaceBridgeCapabilities:EXO_WORKSPACE_BRIDGE_CAPABILITIES,
      workspaceAuthIdentity: workspaceAuth.identity,
      nativeReady: fs.existsSync(config.cli), rustCheckoutReady: Boolean(config.upstream),
      ogcBackend: Boolean(config.rustFit && fs.existsSync(config.rustFit)),
      nativeSession:workspace.status(),
      contactBusy: activeContactRun, fitCertified: false,
      runtimeProvenance: runtimeProvenance() }
    const content = rustHealthPayload(snapshot)
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      ...(origins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) })
    return res.end(content)
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
