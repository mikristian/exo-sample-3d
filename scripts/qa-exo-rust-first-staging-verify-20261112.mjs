#!/usr/bin/env node
/** Read-only integrity gate for explicitly non-installable EXO Rust QA stage. */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync,existsSync} from 'node:fs'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const stage=join(root,'release-artifacts/EXO-RustFirst-Staging-20261112-NOT-INSTALL')
const manifest=JSON.parse(readFileSync(join(stage,'manifest.json'),'utf8'))
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
function verify(item){
  assert(/^(?:native|wasm)\/[A-Za-z0-9_.-]+$/.test(item.file),'Unsafe artifact path')
  const file=join(stage,item.file)
  assert(existsSync(file),`Missing ${item.file}`)
  assert.equal(sha(readFileSync(file)),item.sha256,`Staged artifact checksum mismatch: ${item.file}`)
  if(item.id.startsWith('wasm-')){
    const exports=WebAssembly.Module.exports(new WebAssembly.Module(readFileSync(file)))
    assert(exports.some(e=>e.kind==='function'),`${item.file} has no WASM functions`)
  }
}
assert.equal(manifest.schema,'exo-rust-first-noninstall-staged-runtime.v1')
assert.equal(manifest.nativeCandidatesSourceMatched,true)
assert.equal(manifest.artifacts.length,8)
assert.equal(new Set(manifest.artifacts.map(a=>a.id)).size,8)
for(const item of manifest.artifacts)verify(item)
const webProof=JSON.parse(readFileSync(join(stage,'web-source-manifest.json'),'utf8'))
const webCandidate=JSON.parse(readFileSync(join(root,'docs/reports/EXO_WEB_SOURCE_REBUILT_20261112.json'),'utf8'))
assert.equal(webProof.schema,'exo-rust-first-current-source-web-stage.v2')
assert.equal(webProof.concurrentDraftSafetyGuardIncluded,true)
assert.equal(webCandidate.status,'VERIFIED_BUILD_CANDIDATE')
assert.equal(webCandidate.scopedGradingSourceGuardIncluded,true)
assert.equal(webCandidate.sourceHashesStable,true)
assert.equal(webProof.verifiedFiles,1440)
let webHashes=0
for(const [name,entry] of Object.entries(webCandidate.outputManifest)){
  assert(!name.startsWith('/')&&!name.split(/[\\/]/).includes('..'),'Unsafe web asset path')
  const file=join(stage,'web',name)
  assert(existsSync(file),`Missing staged React asset: ${name}`)
  assert.equal(sha(readFileSync(file)),entry.sha256,`Staged web asset changed: ${name}`)
  webHashes++
}
assert.equal(webHashes,1440)
for(const [source,expected] of Object.entries(webProof.sourceHashes)){
  assert.equal(sha(readFileSync(join(root,source))),expected,`React source changed after staging: ${source}`)
}
assert.throws(()=>verify({...manifest.artifacts[0],sha256:'0'.repeat(64)}),
  /checksum mismatch/i,'Corrupted binary digest was not rejected')
assert.throws(()=>verify({...manifest.artifacts[0],file:'native/../app.app'}),
  /Unsafe artifact path/,'Traversal artifact path was not rejected')
const native=spawnSync(join(stage,'native/exo-session'),['--exo-capabilities'],{
  encoding:'utf8',cwd:join(root,'research/oss/clothcraft'),timeout:4000})
assert.equal(native.status,0)
const flags=JSON.parse(native.stdout.trim())
assert.equal(flags.nativePropertyMetadataV1,true)
assert.equal(flags.nativeProjectGenerationV1,true)
assert.equal(manifest.standaloneMacApp,false)
assert.equal(manifest.installedAppUpdated,false)
assert.equal(manifest.signed,false)
assert.equal(manifest.wasmSourceRebuildVerified,false)
console.log(JSON.stringify({pass:true,nativeSourceMatched:3,wasmABIArtifacts:5,
  candidateHashesVerified:8,stagedReactFilesVerified:webHashes,
  scopedGradeHistorySourceIncluded:true,negativeControls:2,
  standaloneApp:false,sourceRebuiltWasm:false,installedAppChanged:false,
  factoryApproved:false,releaseReady:false}))
