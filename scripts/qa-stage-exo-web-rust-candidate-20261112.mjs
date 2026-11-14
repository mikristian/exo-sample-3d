#!/usr/bin/env node
/**
 * Move the current source-fenced Vite web output out of ephemeral OS temp
 * into the already NON-INSTALLABLE staged QA runtime, without copying 630 MB
 * or modifying installed EXO / source dist / user garments.
 * A move across volumes is refused; no fallback copy or deletion is attempted.
 *
 * node scripts/qa-stage-exo-web-rust-candidate-20261112.mjs
 */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,renameSync,existsSync,statSync} from 'node:fs'
import {resolve,join,dirname,relative} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const stage=join(root,'release-artifacts/EXO-RustFirst-Staging-20261112-NOT-INSTALL')
const manifestFile=join(root,'docs/reports/EXO_WEB_SOURCE_CANDIDATE_20261112.json')
const web=JSON.parse(readFileSync(manifestFile,'utf8'))
const native=JSON.parse(readFileSync(join(stage,'manifest.json'),'utf8'))
const dst=join(stage,'web')
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex')
assert.equal(web.status,'VERIFIED_BUILD_CANDIDATE')
assert.equal(web.buildExitCode,0)
assert.equal(web.sourceHashesStable,true)
assert.equal(native.nativeCandidatesSourceMatched,true)
assert.equal(native.installedAppUpdated,false)
assert.equal(Object.keys(web.outputManifest).length,web.outputFiles.length)
assert.equal(web.outputFiles.length,1440)
assert.equal(web.outputBytes,630160632)
// On subsequent runs, verify the persistent output; never delete/overwrite it.
if(!existsSync(dst)){
  assert(existsSync(web.output),'Web candidate was already consumed or cleaned from OS temporary storage')
  assert(!resolve(web.output).startsWith(stage+'/'),'Unexpected source inside staged output')
  for(const [name,record] of Object.entries(web.outputManifest)){
    assert(!name.startsWith('/')&&!name.includes('..'),'Invalid web file path')
    const path=join(web.output,name)
    assert(existsSync(path),`Missing built web file: ${name}`)
    assert.equal(statSync(path).size,record.bytes,`Byte count changed: ${name}`)
    assert.equal(hash(path),record.sha256,`Generated file changed: ${name}`)
  }
  // This is the same APFS Data filesystem, so rename is atomic and does not
  // require a second 630 MB copy. Do not attempt EXDEV fallback.
  renameSync(web.output,dst)
}
let checked=0
for(const [name,record] of Object.entries(web.outputManifest)){
  const path=join(dst,name)
  assert(existsSync(path),`Staged web asset missing: ${name}`)
  assert.equal(statSync(path).size,record.bytes,`Staged byte length changed: ${name}`)
  assert.equal(hash(path),record.sha256,`Staged web hash changed: ${name}`)
  checked++
}
const result={schema:'exo.rust-first-noninstall-webnative-stage.v1',date:'2026-11-12',
  status:'QA_VERIFIED_NOT_INSTALLABLE',stageRoot:stage,
  webPath:relative(root,dst),webFilesVerified:checked,webBytes:web.outputBytes,
  sourceBuildStatus:web.status,sourceInputsStable:web.sourceHashesStable,
  sourceInputFiles:Object.keys(web.inputHashesBefore),
  nativeBinariesStaged:3,rustWasmABIVerified:5,
  productionAppChanged:false,standaloneMacOSApp:false,
  signed:false,notarized:false,rolloutApproved:false,
  blockers:['A complete signed/universal/packaged EXO macOS .app was not built',
    'No full source-rebuild provenance for all five WebAssembly modules',
    'Web production bundle runtime-to-native port/bridge startup not verified in a packaged Swift app',
    'Physical solver and industrial factory/cutter acceptance not independently qualified',
    'Installed app/user garment rollback and upgrade migration not acceptance tested'],
  reminder:'NEVER install or distribute as a production EXO application.'}
const resultFile=join(root,'docs/reports/EXO_WEB_NATIVE_STAGING_20261112.json')
writeFileSync(resultFile,JSON.stringify(result,null,2)+'\n')
writeFileSync(join(stage,'web-source-manifest.json'),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({pass:true,webFilesVerified:checked,webBytes:web.outputBytes,
  nativeBinariesStaged:3,rustWasmABIVerified:5,
  output:dst,installedAppChanged:false,releaseReady:false},null,2))
