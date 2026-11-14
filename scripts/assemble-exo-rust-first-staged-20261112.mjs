#!/usr/bin/env node
/**
 * Assemble ONLY a non-installable QA staging directory from three native
 * Rust current-source build candidates plus existing integrity-checked WASM.
 * Never signs, overwrites, launches or updates the installed EXO application.
 * The release directory is purposely named NOT-INSTALL.
 *
 * node scripts/assemble-exo-rust-first-staged-20261112.mjs
 */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,copyFileSync,existsSync,mkdirSync} from 'node:fs'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const folder=join(root,'release-artifacts/EXO-RustFirst-Staging-20261112-NOT-INSTALL')
const native=JSON.parse(readFileSync(join(root,'docs/reports/EXO_NATIVE_SESSION_SOURCE_CANDIDATE_20261112.json')))
const other=JSON.parse(readFileSync(join(root,'docs/reports/EXO_SOURCE_MATCHED_CANDIDATE_20261112.json')))
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const filehash=p=>hash(readFileSync(p))

assert.equal(native.sourceMatchVerified,true,'Native Rust session candidate is not source-matched')
assert.equal(other.sourceMatchesCurrentCheckout,true,'Metadata and HTTP host candidate are not source-matched')
assert.equal(other.artifacts.length,2,'Exactly two helper native Rust services expected')
const sources=[
  {id:'native-rust-session',src:native.binaryPath,expected:native.binarySha256,inputs:native.inputs},
  ...other.artifacts.map(x=>({id:x.id,src:x.path,expected:x.sha256,inputs:x.inputs})),
]
for(const a of sources){
  assert(existsSync(a.src),`${a.id}: compiled candidate missing on disk`)
  assert.equal(filehash(a.src),a.expected,`${a.id}: candidate hash changed`)
  assert(a.inputs?.length,`${a.id}: missing pinned source inputs`)
  for(const input of a.inputs){
    assert.equal(filehash(join(root,input.source??input.path)),input.sha256,
      `${a.id}: Rust source input changed after candidate compilation`)
  }
}
assert(!existsSync(folder),`Staging path already exists; not overwriting: ${folder}`)
mkdirSync(join(folder,'native'),{recursive:true})
mkdirSync(join(folder,'wasm'),{recursive:true})
const manifests=[]
for(const a of sources){
  const filename=a.id==='native-rust-session'?'exo-session':
    a.id==='rust-metadata-validator'?'exo-metadata-validation':'exo-rust-static-host'
  const dest=join(folder,'native',filename)
  copyFileSync(a.src,dest)
  assert.equal(filehash(dest),a.expected,`staged ${a.id} differs from source-fenced build`)
  manifests.push({id:a.id,file:`native/${filename}`,sha256:a.expected,
    sourcePinned:true,compiledFromCurrentSource:true})
}
const check=spawnSync(join(folder,'native/exo-session'),['--exo-capabilities'],{
  cwd:join(root,'research/oss/clothcraft'),timeout:4000,encoding:'utf8'})
assert.equal(check.status,0,'Staged Rust session CLI failed')
const flags=JSON.parse(check.stdout)
assert.equal(flags.nativePropertyMetadataV1,true)
assert.equal(flags.nativeProjectGenerationV1,true)
const wasmNames=['fabric','geometry','grading','sewing','ui']
for(const name of wasmNames){
  const src=join(root,`public/wasm/exo_${name}_kernel.wasm`)
  const bytes=readFileSync(src)
  const dest=join(folder,`wasm/exo_${name}_kernel.wasm`)
  const entry=other.wasm.find(x=>x.id===`wasm-${name}`)
  assert(entry?.abiValid,`${name}: earlier WASM ABI verification not passed`)
  const checksumPath=join(root,`public/wasm/exo_${name}_kernel.sha256`)
  // The UI/POM WASM historically shipped without a sidecar checksum. Pin it
  // to the current-source candidate's independently recorded SHA instead.
  const sourceRecorded=existsSync(checksumPath)?
    readFileSync(checksumPath,'utf8').trim().split(/\s+/)[0]:entry.sha256
  assert.equal(hash(bytes),sourceRecorded,`${name}: source WASM hash not pinned`)
  assert.equal(entry.sha256,sourceRecorded,`${name}: WASM changed since ABI verification`)
  copyFileSync(src,dest)
  assert.equal(filehash(dest),sourceRecorded)
  manifests.push({id:`wasm-${name}`,file:`wasm/exo_${name}_kernel.wasm`,sha256:sourceRecorded,
    abiValid:true,compiledFromCurrentSource:'unverified',
    note:'WASM source/current-Cargo rebuild provenance not established; source artifact checksum and ABI passed'})
}
const manifest={schema:'exo-rust-first-noninstall-staged-runtime.v1',date:'2026-11-12',
  stagingRoot:folder,artifacts:manifests,
  nativeCandidatesSourceMatched:true,wasmSourceRebuildVerified:false,
  installedAppUpdated:false,standaloneMacApp:false,signed:false,notarized:false,
  rolloutAuthorized:false,rollbackTested:false,
  readme:'QA staging only. DO NOT INSTALL, REPLACE OR DISTRIBUTE AS A VALIDATED EXO APP.',
  remainingGates:['full signed macOS app package with matched JS bridge and native binary',
    'real frontend grading Save + Undo + Redo full run',
    'full physics/GPU fit equivalence and independent cutter factory acceptance',
    'WASM source rebuild provenance, notarization, rollback and user-project migration validation']}
writeFileSync(join(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
writeFileSync(join(folder,'README-NOT-FOR-INSTALL.txt'),manifest.readme+'\n')
writeFileSync(join(root,'docs/reports/EXO_RUST_FIRST_STAGING_20261112.json'),
  JSON.stringify(manifest,null,2)+'\n')
console.log(JSON.stringify({pass:true,stagingRoot:folder,nativeCandidates:3,
  wasmWithABI:5,wasmSourceRebuildVerified:false,macAppReady:false,installedAppUpdated:false},null,2))
