#!/usr/bin/env node
// Bounded, read-only desktop packaging assessment. Never installs or launches an app.
import {readFileSync,existsSync,statSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolve,dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const stage=join(root,'release-artifacts/EXO-RustFirst-Staging-20261112-NOT-INSTALL')
const dist=join(root,'dist')
const output=join(root,'release-artifacts/EXO-Desktop-Candidate-QA-20261112-NOT-INSTALL')
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex')
const fail=[]
const check=(condition,message)=>{if(!condition)fail.push(message);return condition}
const requireFile=(file,nonempty=true)=>check(existsSync(file)&&(!nonempty||statSync(file).size>0),`missing file: ${file.replace(root+'/','')}`)

const stagingManifest=JSON.parse(readFileSync(join(stage,'manifest.json'),'utf8'))
check(stagingManifest.schema==='exo-rust-first-noninstall-staged-runtime.v1','unexpected Rust manifest schema')
const mappings={
  'native-rust-session':'Contents/Resources/research/oss/clothcraft/target/debug/exo-session',
  'rust-metadata-validator':'Contents/Resources/integrations/clothcraft/rust-service/target/debug/exo-metadata-validation',
  'rust-static-web-host':'Contents/Resources/integrations/clothcraft/rust-static-host/target/debug/exo-rust-static-host',
}
const runtime=stagingManifest.artifacts.map(a=>{
  const file=join(stage,a.file)
  const valid=requireFile(file)&&check(hash(file)===a.sha256,`checksum mismatch: ${a.id}`)
  const dest=mappings[a.id]||`Contents/Resources/web/${a.file}`
  if(a.id.startsWith('native-')||a.id.startsWith('rust-')){
    check(Boolean(mappings[a.id]),`unknown native mapping: ${a.id}`)
    check(a.sourcePinned===true&&a.compiledFromCurrentSource===true,`unverified Rust provenance: ${a.id}`)
  }
  return {id:a.id,source:a.file,expectedSHA256:a.sha256,verified:valid,destination:dest,
    ...(a.id.startsWith('wasm-')?{sourceRebuildVerified:a.compiledFromCurrentSource===true}:{})}
})
const htmlFile=join(dist,'index.html')
const html=requireFile(htmlFile)?readFileSync(htmlFile,'utf8'):''
const assetPaths=[...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(m=>m[1].slice(1))
check(assetPaths.some(p=>p.endsWith('.js')),'HTML missing Vite JS entry')
check(assetPaths.some(p=>p.endsWith('.css')),'HTML missing Vite CSS')
for(const p of assetPaths)requireFile(join(dist,p))
const js=assetPaths.filter(p=>p.endsWith('.js')).map(p=>readFileSync(join(dist,p),'utf8')).join('\n')
const hasStagingBridge=js.includes('127.0.0.1:5485')
const hasProductionBridge=js.includes('127.0.0.1:5385')
check(hasStagingBridge,'existing dist lacks isolated staging bridge 5485')
check(!hasProductionBridge,'existing dist carries production bridge 5385')
for(const a of runtime.filter(a=>a.id.startsWith('wasm-'))){
  const f=join(dist,'wasm',a.source.split('/').at(-1))
  check(requireFile(f)&&hash(f)===a.expectedSHA256,`existing Vite dist WASM differs from staged candidate: ${a.id}`)
}
const nativeRequired=[
  'integrations/clothcraft/bridge.mjs','integrations/clothcraft/server.mjs',
  'integrations/clothcraft/workspace.mjs','integrations/clothcraft/static.mjs',
  'integrations/clothcraft/rust-service/validator-client.mjs',
  'integrations/clothcraft/macos/EXOClothCraftWorkspaceV2.swift',
]
for(const p of nativeRequired)requireFile(join(root,p))
const matchedNative=runtime.filter(a=>mappings[a.id]).every(a=>a.verified)
const appSizeGiB=3.1
const ready=false
const manifest={
  schema:'exo-desktop-candidate-package-assessment.v1',date:'2026-11-12',
  label:'NOT-INSTALL',candidateAppCreated:false,installedAppModified:false,
  existingDistSourceMatchVerified:false,wasmRebuildSourceVerified:false,
  macOSAppBuildReady:ready,stagedNativeRustVerified:matchedNative,
  expectedBundleIdentifier:'com.mikristian.exo.clothcraft.workspace.v2.candidate',
  expectedBridgePort:5485,expectedStaticPort:5486,
  webIndex:'Contents/Resources/web/index.html',
  htmlSHA256:html?hash(htmlFile):null,
  htmlAssets:assetPaths.map(p=>({path:`Contents/Resources/web/${p}`,sha256:existsSync(join(dist,p))?hash(join(dist,p)):null})),
  runtime,observedViteBridge:{staging5485:hasStagingBridge,production5385:hasProductionBridge},
  blockers:[
    ...fail,
    'existing dist dates to November 2 and source identity against current React code is unverified',
    'full build release script requires at least 4 GiB available; current Mac has approximately 3.2 GiB',
    'installed personal app occupies approximately 3.1 GiB; copying it would consume the remaining disk',
    'Web UI, Node closure, Swift shell, and full Rust dependency runtime are not packaged in a source-matched signed app',
  ],
}
if(process.argv.includes('--write')){
  if(existsSync(join(output,'manifest.json'))){console.error('Refusing to overwrite prior QA manifest');process.exit(2)}
  mkdirSync(output,{recursive:true})
  writeFileSync(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
}
console.log(JSON.stringify(manifest,null,2))
if(process.argv.includes('--require-app')||!matchedNative)process.exitCode=1
