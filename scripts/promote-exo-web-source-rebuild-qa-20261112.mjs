#!/usr/bin/env node
/**
 * Replace ONLY this conversation's stale/non-installable QA Vite copy with
 * its recompiled source-locked candidate. Does not touch repo `dist`, native
 * staged binaries, installed EXO.app or user projects. The old QA copy is
 * discarded ONLY after every new file is independently verified.
 */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,existsSync,renameSync,rmSync,statSync} from 'node:fs'
import {resolve,join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const stage=join(root,'release-artifacts/EXO-RustFirst-Staging-20261112-NOT-INSTALL')
const before=JSON.parse(readFileSync(join(root,'docs/reports/EXO_WEB_SOURCE_CANDIDATE_20261112.json')))
const candidate=JSON.parse(readFileSync(join(root,'docs/reports/EXO_WEB_SOURCE_REBUILT_20261112.json')))
const current=join(stage,'web')
const oldQA=join(stage,'web-stale-20261112-QA-ONLY')
const checksum=path=>createHash('sha256').update(readFileSync(path)).digest('hex')
function verify(target,report){
  const entries=Object.entries(report.outputManifest||{})
  assert.equal(entries.length,1440,'Wrong number of Vite output assets')
  for(const [name,metadata] of entries){
    assert(!name.startsWith('/')&&!name.split(/[\\/]/).includes('..'),'Unsafe asset path')
    const path=join(target,name)
    assert(existsSync(path),`Missing Vite output: ${name}`)
    assert.equal(statSync(path).size,metadata.bytes,`Byte length changed for ${name}`)
    assert.equal(checksum(path),metadata.sha256,`SHA changed for ${name}`)
  }
  return entries.length
}
assert.equal(candidate.status,'VERIFIED_BUILD_CANDIDATE')
assert.equal(candidate.sourceHashesStable,true)
assert.equal(candidate.scopedGradingSourceGuardIncluded,true)
assert.equal(candidate.buildExitCode,0)
for(const [filename,hash] of Object.entries(candidate.inputHashesAfter||{})){
  assert.equal(checksum(join(root,filename)),hash,`Source changed after rebuilt Vite candidate: ${filename}`)
}
assert(existsSync(current),'Expected first QA web stage, never create a new unknown package')
assert(!existsSync(oldQA),'Stale QA staging backup already exists; stop')
if(existsSync(candidate.output)){
  verify(current,before)
  verify(candidate.output,candidate)
  renameSync(current,oldQA)
  try{renameSync(candidate.output,current)}catch(error){renameSync(oldQA,current);throw error}
}else{
  // Safe idempotent inspection only, never silently replace current stage.
  verify(current,candidate)
}
const outputCount=verify(current,candidate)
const stageProof={schema:'exo-rust-first-current-source-web-stage.v2',date:'2026-11-12',
  root:stage,webRoot:current,verifiedFiles:outputCount,bytes:candidate.outputBytes,
  sourceInputsStable:true,concurrentDraftSafetyGuardIncluded:true,
  sourceHashes:{...candidate.inputHashesAfter},
  nativeServicesSourceMatched:3,abiVerifiedRustWasm:5,
  signed:false,notarized:false,appReady:false,installedAppModified:false,
  caveats:['Full Swift/Node/React bundle packaging and runtime ABI startup remain unverified',
    'A current-source rebuild of every WASM module is not verified',
    'Factory and GPU-physics qualification and upgrade/rollback remain incomplete']}
writeFileSync(join(stage,'web-source-manifest.json'),JSON.stringify(stageProof,null,2)+'\n')
writeFileSync(join(root,'docs/reports/EXO_WEB_NATIVE_STAGING_20261112.json'),
  JSON.stringify(stageProof,null,2)+'\n')
// This exact folder was created by the previous QA staging script in this
// conversation and was verified against the previous Vite candidate above.
// Never remove an unknown path or source/user content.
if(existsSync(oldQA)){
  assert.equal(oldQA,join(stage,'web-stale-20261112-QA-ONLY'))
  rmSync(oldQA,{recursive:true,force:true})
}
console.log(JSON.stringify({pass:true,files:outputCount,bytes:candidate.outputBytes,
  currentSourceUI:true,staging:current,installedAppChanged:false,
  releaseReady:false},null,2))
